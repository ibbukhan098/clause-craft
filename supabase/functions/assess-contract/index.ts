// @ts-ignore: Deno types
import "https://deno.land/x/xhr@0.1.0/mod.ts";
// @ts-ignore: Deno standard library
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Assessment {
  missing_clauses: string[];
  compliance_issues: string[];
  jurisdiction?: string;
}

function safeParseJson(body: string): any | null {
  try {
    return JSON.parse(body);
  } catch {
    // Try to extract a JSON object from extra text
    const match = body.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

async function runAssessment(token: string, model: string, contractText: string): Promise<Assessment> {
  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a senior legal counsel. Analyze the following contract (full document) and return STRICT minified JSON with keys: missing_clauses (string[] using these exact names: ['Parties','Purpose & Scope','Terms & Conditions','Payment Terms','Intellectual Property','Termination','Confidentiality','Miscellaneous']), compliance_issues (string[] short, concrete issues found e.g. 'uncapped liability', 'perpetual obligations', 'sole discretion', 'no confidentiality duration', 'no termination for convenience'), and jurisdiction (string or empty if not specified). No markdown, no prose, JSON only."
        },
        {
          role: "user",
          content:
            `Contract:\n${contractText}\n\nReturn strict JSON only with keys: missing_clauses, compliance_issues, jurisdiction.`,
        },
      ],
      max_tokens: 300,
      temperature: 0.1,
      stream: false,
    }),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`HF API ${response.status}: ${text.slice(0, 200)}`);

  const data = safeParseJson(text);
  if (!data?.choices?.[0]?.message?.content) {
    throw new Error(`Unexpected response format: ${text.slice(0, 200)}`);
  }

  const payload = safeParseJson(String(data.choices[0].message.content));
  if (!payload) throw new Error("Model did not return valid JSON content");

  const result: Assessment = {
    missing_clauses: Array.isArray(payload.missing_clauses) ? payload.missing_clauses : [],
    compliance_issues: Array.isArray(payload.compliance_issues) ? payload.compliance_issues : [],
    jurisdiction: typeof payload.jurisdiction === "string" ? payload.jurisdiction : undefined,
  };
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("HUGGING_FACE_ACCESS_TOKEN");
    if (!token) throw new Error("HUGGING_FACE_ACCESS_TOKEN is not set");

    const { contractText } = await req.json();
    if (!contractText || typeof contractText !== "string") {
      throw new Error("contractText is required");
    }

    const models = [
      "meta-llama/Llama-3.1-70B-Instruct",
      "mistralai/Mistral-7B-Instruct-v0.3",
      "google/gemma-2-2b-it",
      "HuggingFaceH4/zephyr-7b-beta",
    ];

    let lastError: unknown = undefined;
    for (const m of models) {
      try {
        const assessment = await runAssessment(token, m, contractText);
        return new Response(JSON.stringify(assessment), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError ?? new Error("All models failed for assessment");
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String((error as Error).message || error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});


