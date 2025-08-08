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

interface ContractClause {
  id: string;
  order: number;
  type: string;
  text: string;
  riskScore: number;
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



    const { prompt } = await req.json();
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    console.log('Generating contract from prompt:', prompt.substring(0, 100) + '...');

    // Use multiple public instruct models (first that succeeds)
    const contractPrompt = `Generate a professional legal contract based on this request: "${prompt}"

IMPORTANT: Format the contract EXACTLY as follows with clear section headers:

PARTIES
[Contract parties content here]

PURPOSE AND SCOPE
[Purpose and scope content here]

TERMS AND CONDITIONS
[Terms content here]

PAYMENT TERMS
[Payment content here]

INTELLECTUAL PROPERTY
[IP content here]

TERMINATION
[Termination content here]

MISCELLANEOUS
[Miscellaneous content here]

Requirements:
- Use ALL CAPS section headers exactly as shown above
- Separate each section with double line breaks
- Write complete, professional legal language for each section
- Include specific details based on the request: "${prompt}"
- Do not include numbered lists (1., 2., 3.) in section headers
- Use the exact header names: PARTIES, PURPOSE AND SCOPE, TERMS AND CONDITIONS, PAYMENT TERMS, INTELLECTUAL PROPERTY, TERMINATION, MISCELLANEOUS`;

    // Try text generation via HF REST API
    // Prefer fully public, Inference-API-enabled models first to avoid 404/gated access
    // You can reorder or add gated models once your HF token has access
    const modelsToTry = [
      // Your accessible models with chat completions API
      'meta-llama/Llama-3.1-70B-Instruct',
      'mistralai/Mistral-7B-Instruct-v0.3',
      'google/gemma-2-2b-it',
      'HuggingFaceH4/zephyr-7b-beta',
      // Template fallback will be used if all models fail
    ];

    let generatedText: string | undefined;
    let lastError: unknown = undefined;
    for (const model of modelsToTry) {
      try {
        console.log(`Attempting HF text generation with model: ${model}`);
        generatedText = await queryHuggingFaceTextGen({
          token: HUGGING_FACE_ACCESS_TOKEN,
          model,
          prompt: contractPrompt,
          maxNewTokens: 1200,
          temperature: 0.3,
          topP: 0.9,
          repetitionPenalty: 1.1,
        });
        // Clean up the generated text by removing the prompt if echoed
        if (generatedText && generatedText.includes(contractPrompt)) {
        generatedText = generatedText.replace(contractPrompt, '').trim();
      }
        console.log('HF generation success with model:', model);
        break;
      } catch (err) {
        lastError = err;
        console.log(`Model ${model} failed:`, err);
      }
    }

    if (!generatedText) {
      console.log('All models failed, using fallback template:', lastError);
      generatedText = generateContractTemplate(prompt);
    }

    // Parse the generated text into clauses
    const clauses = parseContractText(generatedText, prompt);

    // Generate UUID for contract
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    const contract = {
      id: generateUUID(),
      title: extractContractTitle(prompt),
      clauses
    };

    console.log('Contract generated successfully');

    return new Response(JSON.stringify({ contract }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-contract function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Contract generation failed', 
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});

async function queryHuggingFaceTextGen(params: {
  token: string;
  model: string;
  prompt: string;
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
  repetitionPenalty?: number;
}): Promise<string> {
  const { token, model, prompt, maxNewTokens = 1200, temperature = 0.3, topP = 0.9 } = params;

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
            content: "You are a professional legal contract generator. Generate complete, professional contracts based on user requirements."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        max_tokens: maxNewTokens,
        temperature: temperature,
        top_p: topP,
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
    return data.choices[0].message.content;
  }
  
  throw new Error(`Unexpected response format from HF API. Data: ${JSON.stringify(data).slice(0, 200)}`);
}

function generateContractTemplate(prompt: string): string {
  const promptLower = prompt.toLowerCase();
  
  // Determine contract type
  let contractType = 'Service Agreement';
  if (promptLower.includes('freelance') || promptLower.includes('contractor')) {
    contractType = 'Freelance Service Agreement';
  } else if (promptLower.includes('employment')) {
    contractType = 'Employment Agreement';
  } else if (promptLower.includes('rental') || promptLower.includes('lease')) {
    contractType = 'Rental Agreement';
  } else if (promptLower.includes('nda') || promptLower.includes('confidential')) {
    contractType = 'Non-Disclosure Agreement';
  }

  return `${contractType}

PARTIES
This Agreement is entered into between [CLIENT_NAME] ("Client") and [SERVICE_PROVIDER_NAME] ("Service Provider") on [DATE].

PURPOSE AND SCOPE
The Service Provider agrees to provide the services described as: ${prompt}

TERMS AND CONDITIONS
1. The Service Provider shall perform the services with professional skill and diligence.
2. All work shall be completed in accordance with the agreed specifications and timeline.
3. The Client shall provide necessary access, information, and cooperation.

PAYMENT TERMS
1. Total compensation shall be [AMOUNT] as mutually agreed.
2. Payment shall be made according to the agreed schedule.
3. Late payments may incur additional charges.

INTELLECTUAL PROPERTY
1. All work product created shall be owned by [OWNER] as specified.
2. The Service Provider retains rights to pre-existing intellectual property.
3. Confidential information shall be protected according to applicable laws.

TERMINATION
1. Either party may terminate this agreement with [NOTICE_PERIOD] written notice.
2. Upon termination, all outstanding payments become due.
3. Confidentiality obligations survive termination.

MISCELLANEOUS
1. This agreement shall be governed by the laws of [JURISDICTION].
2. Any disputes shall be resolved through [RESOLUTION_METHOD].
3. This agreement constitutes the entire agreement between the parties.

IN WITNESS WHEREOF, the parties have executed this Agreement.

_________________                    _________________
[CLIENT_SIGNATURE]                   [SERVICE_PROVIDER_SIGNATURE]
Client                               Service Provider

Date: ___________                    Date: ___________`;
}

function parseContractText(text: string, originalPrompt: string): ContractClause[] {
  const clauses: ContractClause[] = [];
  let order = 1;

  // Clean up the text - remove extra whitespace and normalize line breaks
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Extract title first - look for contract type at the beginning
  const titleMatch = text.match(/^([A-Z][^A-Z\n]*(?:Agreement|Contract|NDA|AGREEMENT|CONTRACT))/i);
  if (titleMatch) {
    clauses.push({
      id: `clause-${order}`,
      order: order++,
      type: 'Title',
      text: titleMatch[1].trim(),
      riskScore: 0.1
    });
    // Remove title from text for further processing
    text = text.replace(titleMatch[0], '').trim();
  }

  // Split by all-caps section headers (our new format)
  const sectionPattern = /(?:^|\n)(PARTIES|PURPOSE AND SCOPE|TERMS AND CONDITIONS|PAYMENT TERMS|INTELLECTUAL PROPERTY|TERMINATION|MISCELLANEOUS|[A-Z][A-Z\s]{2,}(?:\s+[A-Z][A-Z\s]+)*?)(?:\n|$)/gm;
  
  let lastIndex = 0;
  let currentSection = '';
  let currentType = 'General';
  const matches = [...text.matchAll(sectionPattern)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const matchStart = match.index || 0;
    
    // Get content before this header
    if (matchStart > lastIndex) {
      const content = text.substring(lastIndex, matchStart).trim();
      if (content && currentSection) {
        currentSection += '\n\n' + content;
      } else if (content) {
        currentSection = content;
      }
    }

    // Save previous section if we have content
    if (currentSection.trim()) {
      clauses.push({
        id: `clause-${order}`,
        order: order++,
        type: currentType,
        text: currentSection.trim(),
        riskScore: calculateInitialRisk(currentSection)
      });
    }

    // Determine new section type and content
    const header = match[1] || '';
    currentType = extractClauseType(header);
    
    // Debug logging to see what we're matching
    console.log(`Found header: "${header}" -> Type: "${currentType}"`);
    
    // Get content until next header or end
    const nextMatch = matches[i + 1];
    const nextStart = nextMatch ? nextMatch.index || text.length : text.length;
    const sectionContent = text.substring(matchStart, nextStart).trim();
    
    currentSection = sectionContent;
    lastIndex = nextStart;
  }

  // Handle remaining content if no sections were found
  if (matches.length === 0) {
    // Try splitting by double line breaks and look for contract structure
    const paragraphs = text.split(/\n\s*\n+/).filter(p => p.trim());
    
    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
    if (!trimmed) continue;

      // Check if this looks like a section header
      const isHeader = /^([A-Z][A-Z\s]{2,}|[0-9]+\.\s*[A-Z])/i.test(trimmed) || 
                      /^(PARTIES|PURPOSE|SCOPE|TERMS|PAYMENT|INTELLECTUAL|TERMINATION|MISCELLANEOUS|CONFIDENTIALITY|LIABILITY)/i.test(trimmed);
    
      if (isHeader) {
        // Save previous section
      if (currentSection.trim()) {
        clauses.push({
          id: `clause-${order}`,
          order: order++,
          type: currentType,
          text: currentSection.trim(),
          riskScore: calculateInitialRisk(currentSection)
        });
      }
      
      currentType = extractClauseType(trimmed);
      currentSection = trimmed;
    } else {
      // Add to current section
      if (currentSection) {
        currentSection += '\n\n' + trimmed;
      } else {
        currentSection = trimmed;
        }
      }
    }
  }

  // Add final section
  if (currentSection.trim()) {
    clauses.push({
      id: `clause-${order}`,
      order: order++,
      type: currentType,
      text: currentSection.trim(),
      riskScore: calculateInitialRisk(currentSection)
    });
  }

  // If still no clauses parsed, create sections manually based on content
  if (clauses.length === 0 || (clauses.length === 1 && clauses[0].type === 'General')) {
    return parseContractManually(text, originalPrompt);
  }

  return clauses;
}

function parseContractManually(text: string, originalPrompt: string): ContractClause[] {
  const clauses: ContractClause[] = [];
  let order = 1;

  // Enhanced keyword matching with more specific patterns
  const sections = [
    { 
      keywords: ['parties', 'party', 'between', 'entered into', 'service provider', 'client', 'agreement is entered'], 
      type: 'Parties',
      priority: 10
    },
    { 
      keywords: ['purpose', 'scope', 'work', 'services', 'shall include', 'objective', 'provide services'], 
      type: 'Purpose & Scope',
      priority: 8
    },
    { 
      keywords: ['term', 'period', 'commence', 'continue', 'year', 'governed by', 'laws of', 'district of columbia'], 
      type: 'Terms & Conditions',
      priority: 7
    },
    { 
      keywords: ['payment', 'compensation', 'fee', 'cost', 'invoice', 'billing', 'remuneration'], 
      type: 'Payment Terms',
      priority: 9
    },
    { 
      keywords: ['intellectual property', 'copyright', 'patent', 'trademark', 'ownership', 'proprietary'], 
      type: 'Intellectual Property',
      priority: 6
    },
    { 
      keywords: ['termination', 'terminate', 'end', 'expiry', 'expire', 'breach', 'default'], 
      type: 'Termination',
      priority: 5
    },
    { 
      keywords: ['confidential', 'non-disclosure', 'proprietary', 'secret', 'nda'], 
      type: 'Confidentiality',
      priority: 4
    },
    { 
      keywords: ['liability', 'damages', 'limitation', 'indemnif', 'warranties', 'disclaimers'], 
      type: 'Liability',
      priority: 3
    }
  ];

  // Split text into paragraphs and analyze each one
  const paragraphs = text.split(/\n\s*\n+/).filter(p => p.trim());
  
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    // Find best matching section type with weighted scoring
    let bestMatch = 'General Terms';
    let maxScore = 0;
    let bestPriority = 0;

    for (const section of sections) {
      let score = 0;
      const lowerText = trimmed.toLowerCase();
      
      // Count keyword matches with different weights
      for (const keyword of section.keywords) {
        if (lowerText.includes(keyword)) {
          // Weight based on keyword importance and position
          const keywordWeight = keyword.length > 5 ? 2 : 1; // Longer keywords are more specific
          const positionWeight = lowerText.indexOf(keyword) < 100 ? 1.5 : 1; // Earlier mentions are more important
          score += keywordWeight * positionWeight;
        }
      }
      
      // Factor in section priority for tie-breaking
      if (score > maxScore || (score === maxScore && section.priority > bestPriority)) {
        maxScore = score;
        bestMatch = section.type;
        bestPriority = section.priority;
      }
    }

    // Additional logic for better classification
    const lowerText = trimmed.toLowerCase();
    
    // Special cases for better detection
    if (lowerText.includes('master services agreement') || lowerText.includes('this agreement') && lowerText.includes('entered into')) {
      bestMatch = 'Parties';
    } else if (lowerText.includes('purpose') && lowerText.includes('scope')) {
      bestMatch = 'Purpose & Scope';
    } else if (lowerText.includes('term') && (lowerText.includes('year') || lowerText.includes('period'))) {
      bestMatch = 'Terms & Conditions';
    }

    clauses.push({
      id: `clause-${order}`,
      order: order++,
      type: bestMatch,
      text: trimmed,
      riskScore: calculateInitialRisk(trimmed)
    });
  }

  // If still no good parsing, create a single clause
  if (clauses.length === 0) {
    clauses.push({
      id: 'clause-1',
      order: 1,
      type: 'Generated Content',
      text: text.trim() || `Generated contract based on: "${originalPrompt}"`,
      riskScore: 0.3
    });
  }

  return clauses;
}

function extractClauseType(line: string): string {
  const trimmedLine = line.trim();
  
  console.log(`Analyzing line for type: "${trimmedLine}"`);
  
  // Direct mapping for our exact header formats
  switch (trimmedLine) {
    case 'PARTIES':
      return 'Parties';
    case 'PURPOSE AND SCOPE':
      return 'Purpose & Scope';
    case 'TERMS AND CONDITIONS':
      return 'Terms & Conditions';
    case 'PAYMENT TERMS':
      return 'Payment Terms';
    case 'INTELLECTUAL PROPERTY':
      return 'Intellectual Property';
    case 'TERMINATION':
      return 'Termination';
    case 'MISCELLANEOUS':
      return 'Miscellaneous';
  }
  
  // Fallback to keyword matching for variations
  const lowerLine = line.toLowerCase();
  
  // Parties section
  if (lowerLine.includes('parties') || lowerLine.includes('party') || 
      lowerLine.includes('between') || lowerLine.includes('entered into') ||
      lowerLine.includes('master services agreement') || lowerLine.includes('this agreement')) {
    return 'Parties';
  }
  
  // Purpose and scope
  if (lowerLine.includes('purpose') || lowerLine.includes('scope') || 
      lowerLine.includes('objective') || lowerLine.includes('work') ||
      lowerLine.includes('services') || lowerLine.includes('provide services') ||
      lowerLine.includes('shall include')) {
    return 'Purpose & Scope';
  }
  
  // Terms and conditions
  if (lowerLine.includes('terms') || lowerLine.includes('conditions') ||
      lowerLine.includes('obligations') || lowerLine.includes('requirements') ||
      lowerLine.includes('term') || lowerLine.includes('period') ||
      lowerLine.includes('governed by') || lowerLine.includes('laws of')) {
    return 'Terms & Conditions';
  }
  
  // Payment related
  if (lowerLine.includes('payment') || lowerLine.includes('compensation') ||
      lowerLine.includes('fee') || lowerLine.includes('cost') ||
      lowerLine.includes('invoice') || lowerLine.includes('billing')) {
    return 'Payment Terms';
  }
  
  // Intellectual property
  if (lowerLine.includes('intellectual') || lowerLine.includes('property') ||
      lowerLine.includes('copyright') || lowerLine.includes('patent') ||
      lowerLine.includes('trademark') || lowerLine.includes('ownership')) {
    return 'Intellectual Property';
  }
  
  // Termination
  if (lowerLine.includes('termination') || lowerLine.includes('terminate') ||
      lowerLine.includes('end') || lowerLine.includes('expiry') ||
      lowerLine.includes('expire') || lowerLine.includes('breach')) {
    return 'Termination';
  }
  
  // Confidentiality
  if (lowerLine.includes('confidential') || lowerLine.includes('privacy') ||
      lowerLine.includes('non-disclosure') || lowerLine.includes('proprietary') ||
      lowerLine.includes('secret')) {
    return 'Confidentiality';
  }
  
  // Liability and limitations
  if (lowerLine.includes('liability') || lowerLine.includes('limitation') ||
      lowerLine.includes('damages') || lowerLine.includes('indemnif') ||
      lowerLine.includes('warranties') || lowerLine.includes('disclaimers')) {
    return 'Liability';
  }
  
  // Miscellaneous/General
  if (lowerLine.includes('miscellaneous') || lowerLine.includes('general') ||
      lowerLine.includes('governing') || lowerLine.includes('jurisdiction') ||
      lowerLine.includes('signature') || lowerLine.includes('witness')) {
    return 'Miscellaneous';
  }
  
  // Default fallback
  console.log(`No specific type found for "${trimmedLine}", defaulting to General Terms`);
  return 'General Terms';
}

function calculateInitialRisk(text: string): number {
  const textLower = text.toLowerCase();
  let risk = 0.2; // Base risk
  
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

function extractContractTitle(prompt: string): string {
  const promptLower = prompt.toLowerCase();
  
  if (promptLower.includes('freelance')) return 'Freelance Service Agreement';
  if (promptLower.includes('employment')) return 'Employment Contract';
  if (promptLower.includes('rental') || promptLower.includes('lease')) return 'Rental Agreement';
  if (promptLower.includes('nda') || promptLower.includes('confidential')) return 'Non-Disclosure Agreement';
  if (promptLower.includes('partnership')) return 'Partnership Agreement';
  if (promptLower.includes('consulting')) return 'Consulting Agreement';
  if (promptLower.includes('photography')) return 'Photography Services Contract';
  if (promptLower.includes('saas') || promptLower.includes('software')) return 'Software Service Agreement';
  
  return 'Service Agreement';
}