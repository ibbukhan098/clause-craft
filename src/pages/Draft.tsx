import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { FileText, AlertTriangle, CheckCircle, Download, Undo2, Redo2, Edit3, Sparkles, Save, X, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useContractAnalyzer } from '@/components/ai/ContractAnalyzer';
import { useContracts } from '@/hooks/useContracts';
import { supabase } from '@/integrations/supabase/client';

// UUID generator utility
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface Clause {
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
}

interface Contract {
  id: string;
  title: string;
  clauses: Clause[];
}

// Mock data for demonstration
const mockContract: Contract = {
  id: '550e8400-e29b-41d4-a716-446655440001', // Valid UUID format
  title: 'Non-Disclosure Agreement',
  clauses: [
    {
      id: 'c1',
      order: 1,
      type: 'Parties',
      text: 'This Non-Disclosure Agreement ("Agreement") is entered into by and between [Company Name], a [State] corporation ("Disclosing Party"), and [Recipient Name] ("Receiving Party").',
      riskScore: 0.1,
      alternatives: [
        {
          id: 'c1-alt1',
          text: 'This Mutual Non-Disclosure Agreement ("Agreement") is entered into by and between [Company Name], a [State] corporation, and [Recipient Name], both parties acting as potential disclosing and receiving parties.',
          riskScore: 0.2
        }
      ]
    },
    {
      id: 'c2',
      order: 2,
      type: 'Confidential Information',
      text: 'For purposes of this Agreement, "Confidential Information" shall include all information, technical data, trade secrets, know-how, research, product plans, products, services, customers, customer lists, markets, software, developments, inventions, processes, formulas, technology, designs, drawings, engineering, hardware configuration information, marketing, finances, or other business information disclosed by the Disclosing Party.',
      riskScore: 0.3,
      alternatives: [
        {
          id: 'c2-alt1',
          text: 'For purposes of this Agreement, "Confidential Information" means any and all non-public, proprietary or confidential information, in any form or medium, that is disclosed or made available to the Receiving Party, directly or indirectly, whether orally, in writing, or by inspection of tangible objects.',
          riskScore: 0.4
        }
      ]
    },
    {
      id: 'c3',
      order: 3,
      type: 'Obligations',
      text: 'The Receiving Party agrees to: (a) hold and maintain the Confidential Information in strict confidence; (b) not disclose the Confidential Information to any third parties without prior written consent; (c) not use the Confidential Information for any purpose other than evaluating potential business opportunities.',
      riskScore: 0.2
    }
  ]
};

// Utility to ensure contract has valid UUID
const ensureValidUUID = (contract: Contract): Contract => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(contract.id)) {
    return {
      ...contract,
      id: generateUUID()
    };
  }
  return contract;
};

const Draft = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract>(() => ensureValidUUID(mockContract));
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [history, setHistory] = useState<Contract[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
  const [assessment, setAssessment] = useState<{
    missingClauses: string[];
    complianceIssues: string[];
    jurisdiction?: string;
  } | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const { toast } = useToast();
  const { analyzeClause, isInitialized, isInitializing, error: aiError, initializeAI } = useContractAnalyzer();
  const { saveAnalysis, createContract } = useContracts();

  // Route protection and contract generation
  useEffect(() => {
    const state = location.state as { promptGenerated?: boolean; prompt?: string; template?: string; formData?: any } | null;
    
    // If no state provided, redirect to home
    if (!state?.promptGenerated && !state?.template && !state?.formData) {
      navigate('/', { replace: true });
      return;
    }
    
    if (state?.promptGenerated && state?.prompt) {
      generateContractFromPrompt(state.prompt);
    } else if (state?.formData) {
      // Generate contract from template
      generateContractFromTemplate(state.formData);
    }
  }, [location.state, navigate]);

  const generateContractFromTemplate = async (formData: any) => {
    try {
      const prompt = `Generate a ${formData.contractType} contract between ${formData.disclosingParty} and ${formData.receivingParty} with ${formData.jurisdiction} governing law, ${formData.term} term, ${formData.mutualNda} type.`;
      await generateContractFromPrompt(prompt);
    } catch (error) {
      console.error('Template generation error:', error);
    }
  };

  const generateContractFromPrompt = async (prompt: string) => {
    try {
      setContract({
        id: generateUUID(),
        title: 'Generating Contract...',
        clauses: [
          {
            id: 'loading',
            order: 1,
            type: 'Loading',
            text: 'Generating your contract using AI models...',
            riskScore: 0
          }
        ]
      });

      // Call the generate-contract edge function
      const { data, error } = await supabase.functions.invoke('generate-contract', {
        body: { prompt }
      });

      if (error) throw error;

      if (data?.contract) {
        const validContract = ensureValidUUID(data.contract);
        
        try {
          // Save the generated contract to the database (no authentication required)
          const savedContract = await createContract(
            validContract.title,
            { clauses: validContract.clauses }
          );
          
          // Use the saved contract (which has the correct database ID)
          setContract({
            ...validContract,
            id: savedContract.id
          });
          setHistory([{
            ...validContract,
            id: savedContract.id
          }]);
          setHistoryIndex(0);
          
          toast({
            title: "Contract Generated with AI",
            description: "Your contract has been successfully generated.",
          });
        } catch (saveError) {
          console.error('Failed to generate contract', saveError);
          
          // Still use the generated contract even if database save fails
          setContract(validContract);
          setHistory([validContract]);
          setHistoryIndex(0);
          
          toast({
            title: "Contract Generated (Local Only)",
            description: `Contract generated successfully but couldn't be saved: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Contract generation error:', error);
      toast({
        title: "Generation Failed", 
        description: "Failed to generate contract. Using placeholder for now.",
        variant: "destructive",
      });
      
      // Fallback to placeholder
      const fallbackContract = {
        id: generateUUID(),
        title: 'Generated Contract',
        clauses: [
          {
            id: 'fallback',
            order: 1,
            type: 'Generated Content',
            text: `Failed to generate contract from prompt: "${prompt}". Please try again or contact support.`,
            riskScore: 0.5
          }
        ]
      };
      const validFallbackContract = ensureValidUUID(fallbackContract);
      setContract(validFallbackContract);
      setHistory([validFallbackContract]);
      setHistoryIndex(0);
    }
  };

  const getRiskBadge = (score: number) => {
    // Inclusive thresholds so that 0.3 is treated as Low (not Medium)
    if (score <= 0.3) return { variant: 'default', label: 'Low Risk', className: 'bg-risk-low text-white' };
    if (score <= 0.7) return { variant: 'secondary', label: 'Medium Risk', className: 'bg-risk-medium text-white' };
    return { variant: 'destructive', label: 'High Risk', className: 'bg-risk-high text-white' };
  };

  const computeOverallRisk = (clauses: Clause[]) => {
    if (!clauses.length) return 0.3;
    const total = clauses.reduce((sum, c) => sum + (typeof c.riskScore === 'number' ? c.riskScore : 0.3), 0);
    return Math.min(1, total / clauses.length);
  };

  const computeMissingClauses = (clauses: Clause[]) => {
    const expected: string[] = [
      'Parties',
      'Purpose & Scope',
      'Terms & Conditions',
      'Payment Terms',
      'Intellectual Property',
      'Termination',
      'Confidentiality',
    ];
    const present = new Set(clauses.map(c => c.type));
    const missing = expected.filter(t => !present.has(t));
    return { count: missing.length, list: missing };
  };

  const computeComplianceIssues = (clauses: Clause[]) => {
    const text = clauses.map(c => c.text.toLowerCase()).join('\n');
    const riskyTerms = [
      'unlimited liability',
      'without limitation',
      'sole discretion',
      'perpetual',
      'irrevocable',
      'exclusive',
      'penalty',
      'liquidated damages',
      'auto-renew',
      'automatic renewal',
      'indemnif',
    ];
    const matched = new Set<string>();
    for (const term of riskyTerms) {
      if (text.includes(term)) matched.add(term);
    }
    return { count: matched.size, terms: Array.from(matched) };
  };

  const extractJurisdictionFromClauses = (clauses: Clause[]): string => {
    if (!clauses?.length) return 'Not specified';
    const fullText = clauses.map(c => c.text).join('\n');

    const patterns: RegExp[] = [
      /governing\s+law\s*[:\-]?\s*([^\.\n;\)]+)/i,
      /governed\s+by[^\.\n]*?laws?\s+of\s+([^\.\n;\)]+)/i,
      /in\s+accordance\s+with[^\.\n]*?laws?\s+of\s+([^\.\n;\)]+)/i,
      /under\s+the?\s*laws?\s+of\s+([^\.\n;\)]+)/i,
      /jurisdiction\s*[:\-]?\s*([^\.\n;\)]+)/i,
      /venue\s*[:\-]?\s*([^\.\n;\)]+)/i,
      /construed\s+in\s+accordance\s+with\s+the?\s*laws?\s+of\s+([^\.\n;\)]+)/i,
    ];

    for (const rx of patterns) {
      const m = fullText.match(rx);
      if (m && m[1]) {
        const value = m[1].trim().replace(/^the\s+/i, '');
        if (!/[\[\]]|jurisdiction|state|country/i.test(value) || value.length > 3) {
          return value;
        }
      }
    }

    return 'Not specified';
  };

  const selectedClause = contract.clauses.find(c => c.id === selectedClauseId);

  const handleExport = () => {
    const contractText = `${contract.title}\n\n` + 
      contract.clauses
        .sort((a, b) => a.order - b.order)
        .map(clause => `${clause.order}. ${clause.type}\n${clause.text}`)
        .join('\n\n');
    
    const blob = new Blob([contractText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contract.title.toLowerCase().replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Contract Exported",
      description: "Your contract has been downloaded successfully.",
    });
  };

  const startEditing = (clause: Clause) => {
    setEditingClauseId(clause.id);
    setEditText(clause.text);
  };

  const addToHistory = (newContract: Contract) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newContract);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setContract(ensureValidUUID(history[newIndex]));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setContract(ensureValidUUID(history[newIndex]));
    }
  };

  const saveEdit = () => {
    if (!editingClauseId) return;
    
    const newContract = {
      ...contract,
      clauses: contract.clauses.map(clause =>
        clause.id === editingClauseId ? { ...clause, text: editText } : clause
      )
    };
    
    setContract(newContract);
    addToHistory(newContract);
    
    setEditingClauseId(null);
    setEditText('');
    
    toast({
      title: "Clause Updated",
      description: "Your changes have been saved.",
    });
  };

  const cancelEdit = () => {
    setEditingClauseId(null);
    setEditText('');
  };

  const useAlternative = (clauseId: string, alternative: { id: string; text: string; riskScore: number }) => {
    const newContract = {
      ...contract,
      clauses: contract.clauses.map(clause =>
        clause.id === clauseId ? { ...clause, text: alternative.text, riskScore: alternative.riskScore } : clause
      )
    };
    
    setContract(newContract);
    addToHistory(newContract);
    
    toast({
      title: "Alternative Applied",
      description: "The clause has been updated with the selected alternative.",
    });
  };

  const analyzeWithAI = async (clauseText: string, clauseId: string) => {
    setIsAnalyzing(true);
    try {
      // Debug logs removed for production cleanliness
      
      const analysis = await analyzeClause(clauseText);
      
      // console.log('Analysis result:', analysis);
      
      // Check if this is a fallback response
      const isFallback = analysis.suggestions.some(s => s.includes('fallback method'));
      
      // Update the clause with new risk score
      setContract(prev => ({
        ...prev,
        clauses: prev.clauses.map(clause =>
          clause.id === clauseId 
            ? { ...clause, riskScore: analysis.riskScore }
            : clause
        )
      }));
      
      if (isFallback) {
        toast({
          title: "⚠️ AI Analysis - Fallback Mode",
          description: "Hugging Face API unavailable. Using rule-based analysis. Check environment variables.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "🤖 Hugging Face Analysis Complete",
          description: `Risk Score: ${(analysis.riskScore * 100).toFixed(0)}% | ${analysis.suggestions.length} AI suggestions`,
        });
      }
      
      // Show first suggestion if any (and not fallback)
      if (analysis.suggestions.length > 0 && !isFallback) {
        setTimeout(() => {
          toast({
            title: "💡 AI Suggestion",
            description: analysis.suggestions[0],
          });
        }, 1500);
      }
      
      // Save analysis to database
      if (contract.id) {
        await saveAnalysis(contract.id, clauseId, analysis);
      }
      
    } catch (error) {
      console.error('AI Analysis error:', error);
      toast({
        title: "❌ Hugging Face API Error",
        description: error instanceof Error ? error.message : "Please check your API token in Supabase settings",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reanalyzeAll = async () => {
    if (!contract?.clauses?.length) return;
    setIsBulkAnalyzing(true);
    try {
      toast({ title: 'Reanalyzing all clauses…', description: `Analyzing ${contract.clauses.length} clauses with AI` });
      let updatedClauses = [...contract.clauses];
      for (const clause of contract.clauses) {
        try {
          const analysis = await analyzeClause(clause.text);
          updatedClauses = updatedClauses.map((c) =>
            c.id === clause.id ? { ...c, riskScore: analysis.riskScore } : c
          );
          if (contract.id) {
            await saveAnalysis(contract.id, clause.id, analysis);
          }
        } catch (err) {
          console.warn('Failed to analyze clause', clause.id, err);
        }
      }
      const newContract = { ...contract, clauses: updatedClauses };
      setContract(newContract);
      addToHistory(newContract);
      const overall = computeOverallRisk(updatedClauses);
      toast({ title: 'Reanalysis complete', description: `Overall risk is now ${(overall * 100).toFixed(0)}% (${getRiskBadge(overall).label}).` });
    } finally {
      setIsBulkAnalyzing(false);
    }
  };

  const assessContractAI = async () => {
    try {
      const fullText = `${contract.title}\n\n${contract.clauses.map(c => `${c.type}\n${c.text}`).join('\n\n')}`;
      const { data, error } = await supabase.functions.invoke('assess-contract', {
        body: { contractText: fullText }
      });
      if (error) throw error;
      if (data) {
        const missing = Array.isArray(data.missing_clauses) ? data.missing_clauses.length : 0;
        const issues = Array.isArray(data.compliance_issues) ? data.compliance_issues.length : 0;
        const jurisdiction = typeof data.jurisdiction === 'string' && data.jurisdiction.trim() ? data.jurisdiction : extractJurisdictionFromClauses(contract.clauses);
        toast({ title: 'AI Assessment Complete', description: `${issues} compliance issues, ${missing} missing clauses${jurisdiction ? `, jurisdiction: ${jurisdiction}` : ''}` });
        setAssessment({
          missingClauses: Array.isArray(data.missing_clauses) ? data.missing_clauses : [],
          complianceIssues: Array.isArray(data.compliance_issues) ? data.compliance_issues : [],
          jurisdiction,
        });
        return data as { missing_clauses: string[]; compliance_issues: string[]; jurisdiction?: string };
      }
    } catch (err) {
      console.error('AI assessment error', err);
      toast({ title: 'Assessment failed', description: 'Falling back to heuristic counts', variant: 'destructive' });
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-semibold text-foreground">{contract.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={undo}
                disabled={historyIndex <= 0}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Undo
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
              >
                <Redo2 className="h-4 w-4 mr-2" />
                Redo
              </Button>
              <Button onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contract Editor</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {contract.clauses.map((clause) => (
                      <div
                        key={clause.id}
                        className={`p-4 rounded-lg border transition-colors ${
                          selectedClauseId === clause.id
                            ? 'border-primary bg-clause-selected'
                            : 'border-clause-border hover:bg-clause-hover'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              {clause.order}. {clause.type}
                            </span>
                            <Badge className={getRiskBadge(clause.riskScore).className}>
                              {getRiskBadge(clause.riskScore).label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {clause.alternatives && (
                              <Badge variant="outline" className="text-xs">
                                {clause.alternatives.length} alternatives
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(clause);
                              }}
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                analyzeWithAI(clause.text, clause.id);
                              }}
                              disabled={isAnalyzing || isBulkAnalyzing}
                              title="Analyze with AI"
                            >
                              <Sparkles className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        {editingClauseId === clause.id ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="min-h-[100px] text-sm"
                              placeholder="Edit clause text..."
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveEdit}>
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                              <Button variant="outline" size="sm" onClick={cancelEdit}>
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p 
                            className="text-sm leading-relaxed text-foreground cursor-pointer"
                            onClick={() => setSelectedClauseId(clause.id)}
                          >
                            {clause.text}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Risk Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Overall Risk</span>
                    <Badge className={getRiskBadge(computeOverallRisk(contract.clauses)).className}>
                      {getRiskBadge(computeOverallRisk(contract.clauses)).label}
                    </Badge>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={reanalyzeAll} disabled={isAnalyzing || isBulkAnalyzing}>
                      <Sparkles className="h-3 w-3 mr-2" /> Reanalyze All
                    </Button>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Compliance Issues</span>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground" id="compliance-count">{assessment ? assessment.complianceIssues.length : computeComplianceIssues(contract.clauses).count}</span>
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          variant="outline"
                          onClick={async () => {
                            if (!assessment) {
                              const r = await assessContractAI();
                              if (!r) return;
                            }
                            setShowIssues(true);
                          }}
                          disabled={(assessment ? assessment.complianceIssues.length : computeComplianceIssues(contract.clauses).count) === 0}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Missing Clauses</span>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground" id="missing-count">{assessment ? assessment.missingClauses.length : computeMissingClauses(contract.clauses).count}</span>
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          variant="outline"
                          onClick={async () => {
                            if (!assessment) {
                              const r = await assessContractAI();
                              if (!r) return;
                            }
                            setShowMissing(true);
                          }}
                          disabled={(assessment ? assessment.missingClauses.length : computeMissingClauses(contract.clauses).count) === 0}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Jurisdiction</span>
                      <span className="text-foreground" id="jurisdiction-text">{assessment?.jurisdiction || extractJurisdictionFromClauses(contract.clauses)}</span>
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={async () => {
                        const result = await assessContractAI();
                        if (result) {
                          // state is already updated via setAssessment
                        }
                      }}>
                        <Sparkles className="h-3 w-3 mr-2" /> Assess with AI
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Clause Alternatives */}
            {selectedClause && selectedClause.alternatives && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Alternative Clauses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedClause.type}
                    </p>
                    <Separator />
                    {selectedClause.alternatives.map((alt) => (
                      <div
                        key={alt.id}
                        className="p-3 rounded-lg border border-clause-border hover:bg-clause-hover cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={getRiskBadge(alt.riskScore).className}>
                            {getRiskBadge(alt.riskScore).label}
                          </Badge>
                        </div>
                        <p className="text-xs leading-relaxed text-foreground line-clamp-3">
                          {alt.text}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2 w-full"
                          onClick={() => useAlternative(selectedClause.id, alt)}
                        >
                          Use This Version
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <Dialog open={showIssues} onOpenChange={setShowIssues}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compliance Issues</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {assessment?.complianceIssues?.length ? (
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {assessment.complianceIssues.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No issues detected.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMissing} onOpenChange={setShowMissing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Missing Clauses</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {assessment?.missingClauses?.length ? (
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {assessment.missingClauses.map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No missing clauses.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Draft;