import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Zap, Shield, CheckCircle, PenTool, Briefcase, Home, Users } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  const contractTemplates = [
    {
      icon: Briefcase,
      title: 'Non-Disclosure Agreement',
      description: 'Protect confidential information shared between parties. Perfect for business partnerships.',
      type: 'nda'
    },
    {
      icon: Users,
      title: 'Master Service Agreement',
      description: 'Define terms for professional services. Ideal for consultants and freelancers.',
      type: 'msa'
    },
    {
      icon: FileText,
      title: 'Statement of Work',
      description: 'Detailed project specifications and deliverables for service providers.',
      type: 'sow'
    },
    {
      icon: Users,
      title: 'Consulting Agreement',
      description: 'Professional consulting services agreement with clear terms and expectations.',
      type: 'consulting'
    }
  ];

  const features = [
    {
      icon: Zap,
      title: 'AI-Powered Generation',
      description: 'Generate professional contracts in seconds with advanced AI assistance'
    },
    {
      icon: Shield,
      title: 'Risk Assessment',
      description: 'Real-time compliance checking and risk scoring for every clause'
    },
    {
      icon: FileText,
      title: 'Clause Library',
      description: 'Access vetted alternatives for any contract clause with smart suggestions'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background to-accent/20">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-6">
              <FileText className="h-16 w-16 text-primary mx-auto mb-4" />
              <h1 className="text-5xl font-bold text-foreground mb-4">
                ClauseCraft
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                AI-assisted contract editor with clause-level swaps & compliance checks. 
                Draft, edit, and perfect your legal agreements with intelligent assistance.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6"
                onClick={() => navigate('/questionnaire')}
              >
                <FileText className="mr-2 h-5 w-5" />
                Create New Contract
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="text-lg px-8 py-6"
                onClick={() => navigate('/prompt-contract')}
              >
                <PenTool className="mr-2 h-5 w-5" />
                Generate from Prompt
              </Button>
            </div>

            {/* Demo Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent rounded-full text-sm text-accent-foreground">
              <CheckCircle className="h-4 w-4" />
              No sign-up required • Free to try
            </div>
          </div>
        </div>
      </section>

      {/* Contract Templates Section */}
      <section className="py-20 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Choose a Contract Template
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Start with a proven template tailored to your needs, or create something completely custom.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {contractTemplates.map((template, index) => (
                <Card 
                  key={index} 
                  className="text-center border-border/50 hover:border-primary/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/questionnaire?template=${template.type}`)}
                >
                  <CardHeader>
                    <template.icon className="h-12 w-12 text-primary mx-auto mb-4 group-hover:scale-110 transition-transform" />
                    <CardTitle className="text-lg">{template.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">
                      {template.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center">
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate('/prompt-contract')}
                className="text-lg px-8 py-3"
              >
                <PenTool className="mr-2 h-5 w-5" />
                Or create from custom prompt
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Everything you need for better contracts
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Stop copying and pasting from old agreements. Create structured, compliant contracts 
                with surgical precision editing.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="text-center border-border/50">
                  <CardHeader>
                    <feature.icon className="h-12 w-12 text-primary mx-auto mb-4" />
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                How ClauseCraft Works
              </h2>
              <p className="text-lg text-muted-foreground">
                From template or prompt to final contract in minutes
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  1
                </div>
                <h3 className="text-lg font-semibold mb-2">Choose Template or Prompt</h3>
                <p className="text-muted-foreground">
                  Select a template or describe your contract needs in natural language
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  2
                </div>
                <h3 className="text-lg font-semibold mb-2">AI Generates Draft</h3>
                <p className="text-muted-foreground">
                  Our AI creates a complete contract with risk-scored clauses
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  3
                </div>
                <h3 className="text-lg font-semibold mb-2">Edit & Export</h3>
                <p className="text-muted-foreground">
                  Swap clauses, make edits, and export your final document
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to craft better contracts?
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Join legal professionals who are already using AI to create more 
              accurate, compliant contracts in less time.
            </p>
            <Button 
              size="lg" 
              variant="secondary"
              className="text-lg px-8 py-6"
              onClick={() => navigate('/questionnaire')}
            >
              Start Creating Now
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
