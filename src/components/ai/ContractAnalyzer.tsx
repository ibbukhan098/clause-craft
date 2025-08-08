import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AnalysisResult {
  riskScore: number;
  suggestions: string[];
  classification: string;
  confidence: number;
  sentiment?: any;
}

export class ContractAnalyzer {
  static async analyzeClause(text: string): Promise<AnalysisResult> {
    try {
      // console.log('Analyzing clause with Hugging Face API...');
      
      const { data, error } = await supabase.functions.invoke('analyze-contract', {
        body: { clauseText: text }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to analyze clause');
      }

      if (!data) {
        throw new Error('No data returned from analysis');
      }

      // console.log('Analysis complete:', data);
      return data as AnalysisResult;
    } catch (error) {
      console.error('Analysis failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Analysis failed');
    }
  }
}

export const useContractAnalyzer = () => {
  const [isInitialized, setIsInitialized] = useState(true); // API is always "initialized"
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeAI = async () => {
    // No initialization needed for API approach
    setIsInitialized(true);
    setError(null);
  };

  const analyzeClause = async (text: string) => {
    try {
      setError(null);
      return await ContractAnalyzer.analyzeClause(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
      throw new Error(message);
    }
  };

  return {
    isInitialized,
    isInitializing,
    error,
    initializeAI,
    analyzeClause
  };
};