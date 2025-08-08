// @ts-ignore: Deno types
import "https://deno.land/x/xhr@0.1.0/mod.ts";
// @ts-ignore: Deno standard library
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Declare Deno global for Edge Function environment
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

interface AnalysisResult {
  riskScore: number;
  suggestions: string[];
  classification: string;
  confidence: number;
  sentiment?: any;
}

// Keep risk scoring consistent with generate-contract function
function calculateInitialRisk(text: string): number {
  const textLower = text.toLowerCase();
  let risk = 0.2; // Base risk (same as generate-contract)

  // High risk terms
  if (textLower.includes('unlimited') || textLower.includes('perpetual')) risk += 0.3;
  if (textLower.includes('without limitation')) risk += 0.2;
  if (textLower.includes('sole discretion')) risk += 0.2;

  // Medium risk terms
  if (textLower.includes('may') || textLower.includes('reasonable')) risk += 0.1;

  // Low risk terms (reduce risk)
  if (textLower.includes('written consent') || textLower.includes('mutual agreement')) risk -= 0.1;

  return Math.max(0.1, Math.min(0.9, risk));
}

function cleanupModelText(raw: string): string {
  let text = String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[`*_>#]/g, '')
    .trim();
  // Collapse excessive whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function isAllCapsHeading(line: string): boolean {
  const alpha = line.replace(/[^A-Za-z]/g, '');
  if (alpha.length < 3) return false;
  const isAllCaps = alpha.toUpperCase() === alpha;
  const wordCount = line.trim().split(/\s+/).length;
  return isAllCaps && wordCount <= 8; // short all-caps lines are likely headers
}

function extractKeyInsightFromAnswer(answer: string, clauseText: string): string | null {
  if (!answer) return null;
  const original = answer;

  // Prefer the first bullet or numbered item if present
  const bulletMatch = original.match(/(?:^|\n)\s*(?:[-*•]|\d+\.)\s+(.+?)(?:\n|$)/);
  let candidate = bulletMatch && bulletMatch[1] ? bulletMatch[1].trim() : '';

  // Fallback to sentence-based extraction
  const cleaned = cleanupModelText(candidate || original);
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
  const nonHeaderLines = lines.filter(l => !isAllCapsHeading(l));
  const text = (nonHeaderLines.join(' ') || cleaned).trim();
  const sentences = text.split(/(?<=[.!?])\s+/);

  const sentenceWithSignal = sentences.find(s => /\b(shall|must|agrees|agreement|responsible|liab|risk|confiden|payment|fee|invoice|term|terminate|govern|jurisdiction|ownership|ip|indemnif)\b/i.test(s));
  let chosen = (candidate && candidate.length > 0 ? candidate : (sentenceWithSignal || sentences[0] || '')).trim();

  // Remove quotes and trailing punctuation noise
  chosen = chosen.replace(/^\W+|\W+$/g, '').trim();

  // Discard if it's obviously just a header or too short
  if (!chosen || chosen.length < 20 || isAllCapsHeading(chosen)) return null;

  // Truncate to keep suggestion concise
  if (chosen.length > 220) chosen = chosen.slice(0, 220).trim() + '...';
  return chosen;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function queryHuggingFaceQA(params: {
  token: string;
  question: string;
  context: string;
  model: string;
}): Promise<{ answer?: string; score?: number }> {
  const { token, question, context, model } = params;
  
  // Use the correct Hugging Face Router endpoint
  const response = await fetch(
    'https://router.huggingface.co/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content:
              "You are a senior legal counsel analyzing a single contract clause. Produce a precise, practical insight focused on material risk, key obligations, missing protections, or negotiation leverage. Respond in 1–2 complete sentences, plain text only. No headings, no bullets, no markdown, and do not restate the clause."
          },
          {
            role: "user",
            content: `Clause:\n${context}\n\nTask: ${question}. In 1–2 sentences max, state the single most important, actionable insight a lawyer should know (specific risk exposure, obligations, missing protections, or leverage). Do not repeat section titles or boilerplate. Plain text only.`
          }
        ],
        max_tokens: 120,
        temperature: 0.1,
        stream: false
      }),
    },
  );

  let text: string;
  let data: any;
  
  if (!response.ok) {
    text = await response.text();
    throw new Error(`HF API ${response.status}: ${text.slice(0, 200)}`);
  }

  // Read response text once
  text = await response.text();
  
  // Try to parse as JSON
  try {
    data = JSON.parse(text);
  } catch (parseError) {
    throw new Error(`Invalid JSON response from HF API. Response: ${text.slice(0, 200)}`);
  }
  
  // Extract content from OpenAI-compatible chat completion response
  if (data.choices && data.choices.length > 0 && data.choices[0].message) {
    const content = data.choices[0].message.content;
    return { answer: content, score: 0.8 };
  }
  
  throw new Error(`Unexpected response format from HF API. Data: ${JSON.stringify(data).slice(0, 200)}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HUGGING_FACE_ACCESS_TOKEN = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');
    if (!HUGGING_FACE_ACCESS_TOKEN) {
      throw new Error('HUGGING_FACE_ACCESS_TOKEN is not set');
    }

    const { clauseText } = await req.json();
    if (!clauseText) {
      throw new Error('Clause text is required');
    }

    // console.log('Analyzing clause:', clauseText.substring(0, 100) + '...');

    // Try models that work with the new chat completions API
    const modelsToTry = [
      'meta-llama/Llama-3.1-70B-Instruct',
      'mistralai/Mistral-7B-Instruct-v0.3',
      'google/gemma-2-2b-it',
      'HuggingFaceH4/zephyr-7b-beta',
    ];

    let analysisResult: { answer?: string; score?: number } | undefined;
    let lastError: unknown = undefined;
    for (const model of modelsToTry) {
      try {
        // console.log(`Attempting HF QA with model: ${model}`);
        analysisResult = await queryHuggingFaceQA({
          token: HUGGING_FACE_ACCESS_TOKEN,
          question: 'What are the key obligations, terms, and potential risks in this clause?',
          context: clauseText,
          model,
        });
        // console.log('HF analysis result:', { model, ...analysisResult });
        break;
      } catch (err) {
        lastError = err;
        // console.log(`Model ${model} failed:`, err);
      }
    }
    if (!analysisResult) {
      // console.log('All models failed, using fallback analysis:', lastError);
      analysisResult = { answer: 'Analysis completed with fallback method', score: 0.7 };
    }

    // Calculate risk score using the same logic as generation for consistency
    let riskScore = calculateInitialRisk(clauseText);
    let suggestions: string[] = [];

    const lowerText = clauseText.toLowerCase();

    // Provide helpful suggestions without changing the score
    const riskHints = [
      { term: 'unlimited', msg: 'Uncapped liability detected. Consider adding a liability cap.' },
      { term: 'perpetual', msg: 'Perpetual obligations present. Verify if a finite term is acceptable.' },
      { term: 'without limitation', msg: 'Broad “without limitation” language may expand exposure.' },
      { term: 'sole discretion', msg: '“Sole discretion” can be one-sided. Consider reasonableness standards.' },
      { term: 'indemnif', msg: 'Indemnification present. Review scope, exclusions, and caps.' },
    ];
    for (const hint of riskHints) {
      if (lowerText.includes(hint.term)) suggestions.push(hint.msg);
    }

    if (lowerText.includes('confidential') || lowerText.includes('proprietary')) {
      suggestions.push('Confirm confidentiality scope, duration, and permitted disclosures.');
    }

    // Add general suggestions based on analysis (cleaned and concise)
    if (analysisResult && analysisResult.answer) {
      const keyInsight = extractKeyInsightFromAnswer(analysisResult.answer, clauseText);
      if (keyInsight) {
        suggestions.push(`Key insight: ${keyInsight}`);
      }
    }
    
    if (suggestions.length === 0) {
      suggestions.push('This clause appears standard. Consider reviewing for clarity and completeness.');
    }

    const result: AnalysisResult = {
      riskScore,
      suggestions,
      classification: riskScore > 0.6 ? 'High Risk' : riskScore > 0.4 ? 'Medium Risk' : 'Low Risk',
      confidence: analysisResult?.score || 0.7
    };

    // console.log('Analysis complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-contract function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Analysis failed', 
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});