import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { FileText, Upload, ArrowRight, ArrowLeft } from 'lucide-react';

interface QuestionnaireData {
  contractType: string;
  disclosingParty: string;
  receivingParty: string;
  jurisdiction: string;
  term: string;
  mutualNda: string;
  specificPurpose: string;
  additionalClauses: string;
}

const Questionnaire = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<QuestionnaireData>({
    contractType: '',
    disclosingParty: '',
    receivingParty: '',
    jurisdiction: '',
    term: '',
    mutualNda: '',
    specificPurpose: '',
    additionalClauses: ''
  });

  // Pre-select template if passed via URL params
  useEffect(() => {
    const template = searchParams.get('template');
    if (template) {
      setFormData(prev => ({ ...prev, contractType: template }));
    }
  }, [searchParams]);

  const totalSteps = 3;

  const updateFormData = (field: keyof QuestionnaireData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      // Generate contract
      navigate('/draft', { state: { formData } });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate('/');
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.contractType && formData.disclosingParty && formData.receivingParty;
      case 2:
        return formData.jurisdiction && formData.term && formData.mutualNda;
      case 3:
        return true; // Optional step
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">Create New Contract</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Step {currentStep} of {totalSteps}</span>
              <span className="text-sm text-muted-foreground">{Math.round((currentStep / totalSteps) * 100)}% Complete</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {currentStep === 1 && "Basic Information"}
                {currentStep === 2 && "Contract Terms"}
                {currentStep === 3 && "Additional Requirements"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="contractType">Contract Type</Label>
                    <Select value={formData.contractType} onValueChange={(value) => updateFormData('contractType', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select contract type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nda">Non-Disclosure Agreement</SelectItem>
                        <SelectItem value="msa">Master Service Agreement</SelectItem>
                        <SelectItem value="sow">Statement of Work</SelectItem>
                        <SelectItem value="consulting">Consulting Agreement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="disclosingParty">Disclosing Party</Label>
                    <Input
                      id="disclosingParty"
                      value={formData.disclosingParty}
                      onChange={(e) => updateFormData('disclosingParty', e.target.value)}
                      placeholder="e.g., Acme Corporation"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receivingParty">Receiving Party</Label>
                    <Input
                      id="receivingParty"
                      value={formData.receivingParty}
                      onChange={(e) => updateFormData('receivingParty', e.target.value)}
                      placeholder="e.g., John Smith or XYZ Inc."
                    />
                  </div>
                </>
              )}

              {/* Step 2: Contract Terms */}
              {currentStep === 2 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="jurisdiction">Governing Law</Label>
                    <Input
                      id="jurisdiction"
                      value={formData.jurisdiction}
                      onChange={(e) => updateFormData('jurisdiction', e.target.value)}
                      placeholder="e.g., Delaware, California, United Kingdom, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="term">Contract Term</Label>
                    <Select value={formData.term} onValueChange={(value) => updateFormData('term', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select term duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1year">1 Year</SelectItem>
                        <SelectItem value="2years">2 Years</SelectItem>
                        <SelectItem value="3years">3 Years</SelectItem>
                        <SelectItem value="5years">5 Years</SelectItem>
                        <SelectItem value="indefinite">Indefinite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label>Type of NDA</Label>
                    <RadioGroup 
                      value={formData.mutualNda} 
                      onValueChange={(value) => updateFormData('mutualNda', value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="unilateral" id="unilateral" />
                        <Label htmlFor="unilateral">Unilateral (One-way disclosure)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="mutual" id="mutual" />
                        <Label htmlFor="mutual">Mutual (Two-way disclosure)</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </>
              )}

              {/* Step 3: Additional Requirements */}
              {currentStep === 3 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="specificPurpose">Specific Purpose (Optional)</Label>
                    <Textarea
                      id="specificPurpose"
                      value={formData.specificPurpose}
                      onChange={(e) => updateFormData('specificPurpose', e.target.value)}
                      placeholder="Describe the specific purpose for which confidential information will be shared..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="additionalClauses">Additional Clauses (Optional)</Label>
                    <Textarea
                      id="additionalClauses"
                      value={formData.additionalClauses}
                      onChange={(e) => updateFormData('additionalClauses', e.target.value)}
                      placeholder="Any specific clauses or requirements you'd like to include..."
                      rows={4}
                    />
                  </div>

                </>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {currentStep === 1 ? 'Back to Home' : 'Previous'}
            </Button>
            <Button 
              onClick={handleNext}
              disabled={!canProceed()}
            >
              {currentStep === totalSteps ? 'Generate Contract' : 'Next'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;