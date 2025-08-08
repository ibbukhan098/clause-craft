import { useState, useEffect } from 'react';

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

// Storage keys
const STORAGE_KEY_CONTRACTS = 'clausecraft:contracts';
const STORAGE_KEY_ANALYSES = 'clausecraft:analyses';

// Anonymous user id (for local/demo usage)
const ANONYMOUS_USER_ID = '00000000-0000-4000-8000-000000000000';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function loadContractsFromStorage(): Contract[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONTRACTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Contract[];
    return [];
  } catch {
    return [];
  }
}

function saveContractsToStorage(contracts: Contract[]): void {
  localStorage.setItem(STORAGE_KEY_CONTRACTS, JSON.stringify(contracts));
}

function calculateOverallRisk(clauses: Contract['content']['clauses']): number {
  if (!clauses.length) return 0.3;
  const totalRisk = clauses.reduce((sum, clause) => sum + clause.riskScore, 0);
  return Math.min(1, totalRisk / clauses.length);
}

export const useContracts = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      const stored = loadContractsFromStorage();
      setContracts(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  };

  const createContract = async (title: string, content: Contract['content']) => {
    try {
      const now = new Date().toISOString();
      const newContract: Contract = {
        id: generateUUID(),
        user_id: ANONYMOUS_USER_ID,
        title,
        content,
        risk_score: calculateOverallRisk(content.clauses),
        status: 'draft',
        created_at: now,
        updated_at: now,
      };

      const stored = loadContractsFromStorage();
      const updated = [newContract, ...stored];
      saveContractsToStorage(updated);
      setContracts(updated);

      return newContract;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create contract';
      setError(message);
      throw new Error(message);
    }
  };

  const updateContract = async (id: string, updates: Partial<Contract>) => {
    try {
      const stored = loadContractsFromStorage();
      const idx = stored.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error('Contract not found');

      const merged: Contract = {
        ...stored[idx],
        ...updates,
        risk_score: updates.content
          ? calculateOverallRisk(updates.content.clauses)
          : stored[idx].risk_score,
        updated_at: new Date().toISOString(),
      } as Contract;

      stored[idx] = merged;
      saveContractsToStorage(stored);
      setContracts(stored);
      return merged;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update contract';
      setError(message);
      throw new Error(message);
    }
  };

  const deleteContract = async (id: string) => {
    try {
      const stored = loadContractsFromStorage();
      const filtered = stored.filter((c) => c.id !== id);
      saveContractsToStorage(filtered);
      setContracts(filtered);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete contract';
      setError(message);
      throw new Error(message);
    }
  };

  // Store analyses locally for demo use. Schema: Array<{ contract_id, clause_id, analysis_result, created_at }>
  const saveAnalysis = async (contractId: string, clauseId: string, analysis: any) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ANALYSES);
      const list: Array<{
        contract_id: string;
        clause_id: string;
        analysis_result: any;
        created_at: string;
      }> = raw ? JSON.parse(raw) : [];

      list.push({
        contract_id: contractId,
        clause_id: clauseId,
        analysis_result: analysis,
        created_at: new Date().toISOString(),
      });

      localStorage.setItem(STORAGE_KEY_ANALYSES, JSON.stringify(list));
    } catch (err) {
      // Non-fatal in demo mode; log and continue
      console.warn('Failed to save analysis locally:', err);
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
    saveAnalysis,
  };
};