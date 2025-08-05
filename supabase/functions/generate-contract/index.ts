import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2';

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

    const hf = new HfInference(HUGGING_FACE_ACCESS_TOKEN);

    // Use Llama 3.1-8B-Instruct for contract generation
    const contractPrompt = `Generate a professional legal contract based on this request: "${prompt}"

Please create a complete contract with the following sections:
1. Parties - Identify the contracting parties
2. Purpose - State the purpose and scope of work
3. Terms - Define key terms and conditions
4. Payment - Specify payment terms and schedule
5. Intellectual Property - Address IP ownership and rights
6. Termination - Include termination conditions
7. Miscellaneous - Add standard legal clauses

Format the response as proper contract language with clear clause separations.`;

    // Try text generation with Llama 3.1-8B-Instruct
    let generatedText;
    try {
      const response = await hf.textGeneration({
        model: 'meta-llama/Llama-3.1-8B-Instruct',
        inputs: contractPrompt,
        parameters: {
          max_new_tokens: 2000,
          temperature: 0.3,
          do_sample: true,
          top_p: 0.9,
          repetition_penalty: 1.1
        }
      });
      
      generatedText = response.generated_text || generateContractTemplate(prompt);
      
      // Clean up the generated text by removing the prompt
      if (generatedText.includes(contractPrompt)) {
        generatedText = generatedText.replace(contractPrompt, '').trim();
      }
    } catch (modelError) {
      console.log('Primary model failed, using fallback approach:', modelError);
      
      // Fallback: Create a structured contract template
      generatedText = generateContractTemplate(prompt);
    }

    // Parse the generated text into clauses
    const clauses = parseContractText(generatedText, prompt);

    const contract = {
      id: Date.now().toString(),
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

function parseContractText(text: string, originalPrompt: string): any[] {
  const clauses = [];
  let order = 1;

  // Extract title first - look for contract type at the beginning
  const titleMatch = text.match(/^([A-Z][^A-Z\n]*(?:Agreement|Contract|NDA))/i);
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

  // Split text into major sections based on common contract patterns
  const sections = text.split(/\n\s*\n+/);
  let currentSection = '';
  let currentType = 'General';

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Check if this is a section header
    const headerMatch = trimmed.match(/^(PARTIES|PURPOSE|SCOPE|TERMS|PAYMENT|INTELLECTUAL|TERMINATION|MISCELLANEOUS|CONFIDENTIALITY|LIABILITY)/i);
    
    if (headerMatch) {
      // If we have accumulated content, save it as a clause
      if (currentSection.trim()) {
        clauses.push({
          id: `clause-${order}`,
          order: order++,
          type: currentType,
          text: currentSection.trim(),
          riskScore: calculateInitialRisk(currentSection)
        });
      }
      
      // Start new section
      currentType = extractClauseType(trimmed);
      currentSection = trimmed;
    } else {
      // Add to current section
      if (currentSection) {
        currentSection += '\n\n' + trimmed;
      } else {
        currentSection = trimmed;
        currentType = 'General';
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

  // If no clauses parsed, create a single clause with the full text
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
  const lowerLine = line.toLowerCase();
  if (lowerLine.includes('parties')) return 'Parties';
  if (lowerLine.includes('purpose') || lowerLine.includes('scope')) return 'Purpose & Scope';
  if (lowerLine.includes('payment') || lowerLine.includes('compensation')) return 'Payment Terms';
  if (lowerLine.includes('intellectual') || lowerLine.includes('property')) return 'Intellectual Property';
  if (lowerLine.includes('termination') || lowerLine.includes('end')) return 'Termination';
  if (lowerLine.includes('confidential') || lowerLine.includes('privacy')) return 'Confidentiality';
  if (lowerLine.includes('liability') || lowerLine.includes('limitation')) return 'Liability';
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