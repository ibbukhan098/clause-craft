import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { FileText, AlertTriangle, CheckCircle, Download, Undo2, Redo2, Edit3, Sparkles, Save, X, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useContractAnalyzer } from '@/components/ai/ContractAnalyzer';
import { useContracts } from '@/hooks/useContracts';
import { supabase } from '@/integrations/supabase/client';

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
  id: '1',
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

const Draft = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract>(mockContract);
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [history, setHistory] = useState<Contract[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const { analyzeClause, isInitialized, isInitializing, error: aiError, initializeAI } = useContractAnalyzer();
  const { saveAnalysis } = useContracts();

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
        id: Date.now().toString(),
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
        setContract(data.contract);
        setHistory([data.contract]);
        setHistoryIndex(0);
        toast({
          title: "Contract Generated",
          description: "Your contract has been successfully generated using AI.",
        });
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
        id: Date.now().toString(),
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
      setContract(fallbackContract);
      setHistory([fallbackContract]);
      setHistoryIndex(0);
    }
  };

  const getRiskBadge = (score: number) => {
    if (score < 0.3) return { variant: 'default', label: 'Low Risk', className: 'bg-risk-low text-white' };
    if (score < 0.7) return { variant: 'secondary', label: 'Medium Risk', className: 'bg-risk-medium text-white' };
    return { variant: 'destructive', label: 'High Risk', className: 'bg-risk-high text-white' };
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
      setContract(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setContract(history[newIndex]);
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
      console.log('Starting AI analysis via Hugging Face API...');
      
      const analysis = await analyzeClause(clauseText);
      
      // Update the clause with new risk score
      setContract(prev => ({
        ...prev,
        clauses: prev.clauses.map(clause =>
          clause.id === clauseId 
            ? { ...clause, riskScore: analysis.riskScore }
            : clause
        )
      }));
      
      toast({
        title: "🤖 Hugging Face Analysis Complete",
        description: `Risk Score: ${(analysis.riskScore * 100).toFixed(0)}% | ${analysis.suggestions.length} AI suggestions`,
      });
      
      // Show first suggestion if any
      if (analysis.suggestions.length > 0) {
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
                              disabled={isAnalyzing}
                              title="Analyze with Hugging Face AI"
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
                    <Badge className="bg-risk-low text-white">Low</Badge>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Compliance Issues</span>
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Missing Clauses</span>
                      <span className="text-foreground">0</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Jurisdiction</span>
                      <span className="text-foreground">{
                        contract.clauses.find(c => 
                          c.text.toLowerCase().includes('governing law') || 
                          c.text.toLowerCase().includes('governed by') ||
                          c.text.toLowerCase().includes('jurisdiction')
                        )?.text.match(/(?:governing law|governed by|jurisdiction).*?(?:laws of |in |under )([^,.\n\)]+)/i)?.[1]?.trim() || 'Not specified'
                      }</span>
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
    </div>
  );
};

export default Draft;