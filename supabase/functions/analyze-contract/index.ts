import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2';

interface AnalysisResult {
  riskScore: number;
  suggestions: string[];
  classification: string;
  confidence: number;
  sentiment?: any;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('Analyzing clause:', clauseText.substring(0, 100) + '...');

    const hf = new HfInference(HUGGING_FACE_ACCESS_TOKEN);

    // Use DeBERTa for contract-specific analysis
    let analysisResult;
    try {
      analysisResult = await hf.questionAnswering({
        model: 'deepset/deberta-v3-base-squad2',
        inputs: {
          question: 'What are the key obligations, terms, and potential risks in this clause?',
          context: clauseText
        }
      });
      console.log('DeBERTa analysis result:', analysisResult);
    } catch (error) {
      console.log('DeBERTa model failed, using fallback analysis:', error);
      analysisResult = { answer: 'Analysis completed with fallback method', score: 0.7 };
    }

    // Calculate risk score based on analysis
    let riskScore = 0.3; // default medium-low risk
    let suggestions = [];
    
    // Analyze for risk indicators
    const riskIndicators = [
      'unlimited liability', 'perpetual', 'irrevocable', 'without limitation',
      'sole discretion', 'exclusive', 'penalty', 'forfeiture', 'liquidated damages'
    ];
    
    const beneficialTerms = [
      'mutual', 'reasonable', 'written consent', 'good faith', 
      'commercially reasonable', 'industry standard', 'fair market value'
    ];
    
    const lowerText = clauseText.toLowerCase();
    
    riskIndicators.forEach(indicator => {
      if (lowerText.includes(indicator)) {
        riskScore += 0.15;
        suggestions.push(`Consider reviewing the "${indicator}" provision for potential risk.`);
      }
    });
    
    beneficialTerms.forEach(term => {
      if (lowerText.includes(term)) {
        riskScore -= 0.05;
      }
    });

    // Additional risk assessment based on clause content
    if (lowerText.includes('indemnification') || lowerText.includes('indemnify')) {
      riskScore += 0.1;
      suggestions.push('Indemnification clauses require careful review of scope and limitations.');
    }

    if (lowerText.includes('confidential') || lowerText.includes('proprietary')) {
      suggestions.push('Ensure confidentiality obligations are clearly defined and reasonable.');
    }

    // Ensure risk score is between 0.1 and 0.9
    riskScore = Math.max(0.1, Math.min(0.9, riskScore));

    // Add general suggestions based on analysis
    if (analysisResult && analysisResult.answer) {
      suggestions.push(`Key insight: ${analysisResult.answer}`);
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

    console.log('Analysis complete:', result);

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