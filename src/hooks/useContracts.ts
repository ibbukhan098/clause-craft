import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type DbContract = Database['public']['Tables']['contracts']['Row'];

export interface Contract {
  id: string;
  user_id: string;
  title: string;
  content: {
    clauses: Array<{
      id: string;
      order: number;
      type: string;
      text: string;
      riskScore: number;
      alternatives?: Array<{
        id: string;
        text: string;
        riskScore: number;
      }>;
    }>;
  };
  risk_score: number;
  status: 'draft' | 'review' | 'approved' | 'signed';
  created_at: string;
  updated_at: string;
}

const transformDbContract = (dbContract: DbContract): Contract => ({
  ...dbContract,
  content: dbContract.content as Contract['content'],
  risk_score: dbContract.risk_score || 0.3,
  status: (dbContract.status as Contract['status']) || 'draft'
});

export const useContracts = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setContracts((data || []).map(transformDbContract));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contracts');
    } finally {
      setLoading(false);
    }
  };

  const createContract = async (title: string, content: Contract['content']) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('contracts')
        .insert({
          user_id: user.id,
          title,
          content,
          risk_score: calculateOverallRisk(content.clauses),
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;
      
      const transformedContract = transformDbContract(data);
      setContracts(prev => [transformedContract, ...prev]);
      return transformedContract;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create contract';
      setError(message);
      throw new Error(message);
    }
  };

  const updateContract = async (id: string, updates: Partial<Contract>) => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      const transformedContract = transformDbContract(data);
      setContracts(prev => prev.map(contract => 
        contract.id === id ? transformedContract : contract
      ));
      
      return transformedContract;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update contract';
      setError(message);
      throw new Error(message);
    }
  };

  const deleteContract = async (id: string) => {
    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setContracts(prev => prev.filter(contract => contract.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete contract';
      setError(message);
      throw new Error(message);
    }
  };

  const saveAnalysis = async (contractId: string, clauseId: string, analysis: any) => {
    try {
      const { error } = await supabase
        .from('contract_analyses')
        .insert({
          contract_id: contractId,
          clause_id: clauseId,
          analysis_result: analysis,
          model_used: 'huggingface-transformers'
        });

      if (error) throw error;
    } catch (err) {
      console.error('Failed to save analysis:', err);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  return {
    contracts,
    loading,
    error,
    fetchContracts,
    createContract,
    updateContract,
    deleteContract,
    saveAnalysis
  };
};

const calculateOverallRisk = (clauses: Contract['content']['clauses']): number => {
  if (!clauses.length) return 0.3;
  
  const totalRisk = clauses.reduce((sum, clause) => sum + clause.riskScore, 0);
  return Math.min(1, totalRisk / clauses.length);
};