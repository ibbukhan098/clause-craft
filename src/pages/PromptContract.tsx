import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, PenTool, Lightbulb, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const PromptContract = () => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [selectedExample, setSelectedExample] = useState<string | null>(null);

  const promptExamples = [
    {
      title: 'Freelance Web Development',
      description: 'Project-based work agreement',
      prompt: 'Create a contract for freelance web development services including payment terms, project timeline, intellectual property rights, and revision limits for a 6-week e-commerce website project.'
    },
    {
      title: 'SaaS Partnership Agreement',
      description: 'Technology integration deal',
      prompt: 'Draft a partnership agreement between two SaaS companies for API integration, including revenue sharing, data privacy, technical support responsibilities, and termination clauses.'
    },
    {
      title: 'Photography Session Contract',
      description: 'Event photography services',
      prompt: 'Create a photography contract for wedding services covering shooting duration, deliverables, usage rights, cancellation policy, and additional services like engagement shoots.'
    },
    {
      title: 'Consulting Retainer',
      description: 'Monthly advisory services',
      prompt: 'Draft a consulting retainer agreement for business advisory services with monthly payments, scope of work, confidentiality terms, and performance expectations.'
    }
  ];

  const promptTips = [
    'Be specific about the type of contract you need',
    'Include key terms like duration, payment, and responsibilities',
    'Mention any special requirements or industry-specific needs',
    'Describe the parties involved and their relationship'
  ];

  const handleExampleSelect = (example: typeof promptExamples[0]) => {
    setPrompt(example.prompt);
    setSelectedExample(example.title);
  };

  const handleGenerate = () => {
    if (prompt.trim()) {
      // Navigate to draft with the prompt
      navigate('/draft', { state: { promptGenerated: true, prompt: prompt.trim() } });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            
            <div className="text-center">
              <PenTool className="h-12 w-12 text-primary mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Generate Contract from Prompt
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Describe your contract needs in natural language and let AI create a professional draft for you.
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Prompt Input */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Describe Your Contract
                  </CardTitle>
                  <CardDescription>
                    Write a detailed description of the contract you need. The more specific you are, the better the result.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="prompt">Contract Description</Label>
                    <Textarea
                      id="prompt"
                      placeholder="Example: Create a freelance web development contract for a 6-week e-commerce project including payment milestones, intellectual property rights, and revision limits..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-[200px] mt-2"
                    />
                  </div>
                  
                  {selectedExample && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Using example: {selectedExample}
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setPrompt('');
                          setSelectedExample(null);
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  )}

                  <Button 
                    onClick={handleGenerate}
                    disabled={!prompt.trim()}
                    size="lg"
                    className="w-full"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Generate Contract
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Tips */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lightbulb className="h-5 w-5" />
                    Writing Tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {promptTips.map((tip, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Examples */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Example Prompts</CardTitle>
                  <CardDescription>
                    Click any example to use as a starting point
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {promptExamples.map((example, index) => (
                    <div
                      key={index}
                      className="p-3 border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => handleExampleSelect(example)}
                    >
                      <h4 className="font-medium text-sm mb-1">{example.title}</h4>
                      <p className="text-xs text-muted-foreground mb-2">{example.description}</p>
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {example.prompt}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptContract;