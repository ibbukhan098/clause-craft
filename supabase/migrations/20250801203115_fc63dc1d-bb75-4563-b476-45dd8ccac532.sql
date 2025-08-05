-- Create contracts table
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  risk_score DECIMAL(3,2) DEFAULT 0.3,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'signed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own contracts" 
ON public.contracts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contracts" 
ON public.contracts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contracts" 
ON public.contracts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contracts" 
ON public.contracts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create contract_analyses table for AI analysis results
CREATE TABLE public.contract_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  clause_id TEXT NOT NULL,
  analysis_result JSONB NOT NULL,
  model_used TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for analyses
ALTER TABLE public.contract_analyses ENABLE ROW LEVEL SECURITY;

-- Create policies for analyses (tied to contract ownership)
CREATE POLICY "Users can view analyses for their contracts" 
ON public.contract_analyses 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.contracts 
    WHERE contracts.id = contract_analyses.contract_id 
    AND contracts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create analyses for their contracts" 
ON public.contract_analyses 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts 
    WHERE contracts.id = contract_analyses.contract_id 
    AND contracts.user_id = auth.uid()
  )
);

-- Create index for better performance
CREATE INDEX idx_contracts_user_id ON public.contracts(user_id);
CREATE INDEX idx_contract_analyses_contract_id ON public.contract_analyses(contract_id);