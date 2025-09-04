-- Multi-Blockchain Support Migration
-- This migration extends the database schema to support multiple blockchain platforms

-- Blockchain platforms table
CREATE TABLE IF NOT EXISTS public.blockchain_platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  supported_languages TEXT[] NOT NULL,
  file_extensions TEXT[] NOT NULL,
  static_analyzers JSONB NOT NULL,
  ai_models JSONB NOT NULL,
  validation_rules JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default blockchain platforms first (before adding foreign key constraint)
INSERT INTO public.blockchain_platforms (id, name, supported_languages, file_extensions, static_analyzers, ai_models, validation_rules) VALUES
('ethereum', 'Ethereum', ARRAY['solidity'], ARRAY['.sol'], 
 '{"slither": {"command": "slither", "version": ">=0.9.0"}, "mythril": {"command": "myth", "version": ">=0.23.0"}}',
 '{"moonshotai/kimi-k2:free": {"specialization": ["solidity", "evm", "security"]}, "z-ai/glm-4.5-air:free": {"specialization": ["solidity", "security", "gas_optimization"]}}',
 '{"file_size_limit": 1048576, "max_functions": 100, "required_pragma": true}'),

('binance-smart-chain', 'Binance Smart Chain', ARRAY['solidity'], ARRAY['.sol'], 
 '{"slither": {"command": "slither", "version": ">=0.9.0"}, "mythril": {"command": "myth", "version": ">=0.23.0"}}',
 '{"moonshotai/kimi-k2:free": {"specialization": ["solidity", "bep20", "bsc"]}, "z-ai/glm-4.5-air:free": {"specialization": ["solidity", "security"]}}',
 '{"file_size_limit": 1048576, "max_functions": 100, "required_pragma": true, "bep_standards": ["BEP20", "BEP721", "BEP1155"]}'),

('polygon', 'Polygon', ARRAY['solidity'], ARRAY['.sol'], 
 '{"slither": {"command": "slither", "version": ">=0.9.0"}, "mythril": {"command": "myth", "version": ">=0.23.0"}}',
 '{"moonshotai/kimi-k2:free": {"specialization": ["solidity", "polygon", "layer2"]}, "z-ai/glm-4.5-air:free": {"specialization": ["solidity", "security"]}}',
 '{"file_size_limit": 1048576, "max_functions": 100, "required_pragma": true, "layer2_considerations": true}'),

('solana', 'Solana', ARRAY['rust'], ARRAY['.rs', '.toml'], 
 '{"clippy": {"command": "cargo clippy", "version": ">=1.70.0"}, "anchor": {"command": "anchor build", "version": ">=0.28.0"}}',
 '{"moonshotai/kimi-k2:free": {"specialization": ["rust", "solana", "anchor"]}, "z-ai/glm-4.5-air:free": {"specialization": ["rust", "security"]}}',
 '{"file_size_limit": 2097152, "max_accounts": 50, "anchor_required": true, "pda_validation": true}'),

('cardano', 'Cardano', ARRAY['plutus', 'haskell'], ARRAY['.hs', '.plutus'], 
 '{"plutus-static": {"command": "plutus-static-analysis", "version": ">=1.0.0"}, "hlint": {"command": "hlint", "version": ">=3.4.0"}}',
 '{"moonshotai/kimi-k2:free": {"specialization": ["haskell", "plutus", "cardano"]}, "z-ai/glm-4.5-air:free": {"specialization": ["haskell", "functional"]}}',
 '{"file_size_limit": 1048576, "utxo_validation": true, "datum_checks": true, "script_efficiency": true}'),

('aptos', 'Aptos', ARRAY['move'], ARRAY['.move'], 
 '{"move-prover": {"command": "move prove", "version": ">=1.0.0"}, "move-analyzer": {"command": "move check", "version": ">=1.0.0"}}',
 '{"moonshotai/kimi-k2:free": {"specialization": ["move", "aptos", "resources"]}, "z-ai/glm-4.5-air:free": {"specialization": ["move", "security"]}}',
 '{"file_size_limit": 1048576, "resource_validation": true, "capability_checks": true, "formal_verification": true}')

ON CONFLICT (id) DO NOTHING;

-- Now extend contracts table with multi-blockchain fields (after platforms are inserted)
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS blockchain_platform TEXT REFERENCES public.blockchain_platforms(id) DEFAULT 'ethereum';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'solidity';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS dependencies JSONB;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS cross_chain_config JSONB;

-- Multi-chain audits table for cross-platform analysis tracking
CREATE TABLE IF NOT EXISTS public.multi_chain_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  audit_name TEXT NOT NULL,
  platforms TEXT[] NOT NULL,
  contracts JSONB NOT NULL,
  cross_chain_analysis BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'failed')),
  results JSONB,
  cross_chain_results JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Platform-specific vulnerabilities table for blockchain-specific findings
CREATE TABLE IF NOT EXISTS public.platform_vulnerabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id UUID REFERENCES public.audits(id) ON DELETE CASCADE,
  multi_chain_audit_id UUID REFERENCES public.multi_chain_audits(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  vulnerability_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'informational')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location JSONB NOT NULL,
  recommendation TEXT NOT NULL,
  platform_specific_data JSONB,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL CHECK (source IN ('static', 'ai', 'combined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure at least one audit reference exists
  CONSTRAINT check_audit_reference CHECK (
    (audit_id IS NOT NULL AND multi_chain_audit_id IS NULL) OR
    (audit_id IS NULL AND multi_chain_audit_id IS NOT NULL) OR
    (audit_id IS NOT NULL AND multi_chain_audit_id IS NOT NULL)
  )
);

-- Cross-chain analysis results table
CREATE TABLE IF NOT EXISTS public.cross_chain_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  multi_chain_audit_id UUID NOT NULL REFERENCES public.multi_chain_audits(id) ON DELETE CASCADE,
  bridge_security_assessment JSONB,
  state_consistency_analysis JSONB,
  interoperability_risks JSONB,
  recommendations JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contracts_blockchain_platform ON public.contracts(blockchain_platform);
CREATE INDEX IF NOT EXISTS idx_contracts_language ON public.contracts(language);
CREATE INDEX IF NOT EXISTS idx_multi_chain_audits_user_id ON public.multi_chain_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_multi_chain_audits_status ON public.multi_chain_audits(status);
CREATE INDEX IF NOT EXISTS idx_multi_chain_audits_platforms ON public.multi_chain_audits USING GIN(platforms);
CREATE INDEX IF NOT EXISTS idx_multi_chain_audits_created_at ON public.multi_chain_audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_vulnerabilities_audit_id ON public.platform_vulnerabilities(audit_id);
CREATE INDEX IF NOT EXISTS idx_platform_vulnerabilities_multi_chain_audit_id ON public.platform_vulnerabilities(multi_chain_audit_id);
CREATE INDEX IF NOT EXISTS idx_platform_vulnerabilities_platform ON public.platform_vulnerabilities(platform);
CREATE INDEX IF NOT EXISTS idx_platform_vulnerabilities_severity ON public.platform_vulnerabilities(severity);
CREATE INDEX IF NOT EXISTS idx_cross_chain_analysis_multi_chain_audit_id ON public.cross_chain_analysis(multi_chain_audit_id);

-- Create trigger for blockchain_platforms table
CREATE TRIGGER update_blockchain_platforms_updated_at 
    BEFORE UPDATE ON public.blockchain_platforms 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies for new tables
ALTER TABLE public.blockchain_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multi_chain_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_vulnerabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cross_chain_analysis ENABLE ROW LEVEL SECURITY;

-- Blockchain platforms policies (read-only for users)
CREATE POLICY "Users can view active blockchain platforms" ON public.blockchain_platforms
    FOR SELECT USING (is_active = true);

-- Multi-chain audits policies
CREATE POLICY "Users can view own multi-chain audits" ON public.multi_chain_audits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own multi-chain audits" ON public.multi_chain_audits
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own multi-chain audits" ON public.multi_chain_audits
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own multi-chain audits" ON public.multi_chain_audits
    FOR DELETE USING (auth.uid() = user_id);

-- Platform vulnerabilities policies
CREATE POLICY "Users can view platform vulnerabilities for own audits" ON public.platform_vulnerabilities
    FOR SELECT USING (
        (audit_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.audits 
            WHERE audits.id = platform_vulnerabilities.audit_id 
            AND audits.user_id = auth.uid()
        )) OR
        (multi_chain_audit_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.multi_chain_audits 
            WHERE multi_chain_audits.id = platform_vulnerabilities.multi_chain_audit_id 
            AND multi_chain_audits.user_id = auth.uid()
        ))
    );

-- Cross-chain analysis policies
CREATE POLICY "Users can view cross-chain analysis for own multi-chain audits" ON public.cross_chain_analysis
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.multi_chain_audits 
            WHERE multi_chain_audits.id = cross_chain_analysis.multi_chain_audit_id 
            AND multi_chain_audits.user_id = auth.uid()
        )
    );

-- Grant necessary permissions
GRANT ALL ON public.blockchain_platforms TO anon, authenticated;
GRANT ALL ON public.multi_chain_audits TO anon, authenticated;
GRANT ALL ON public.platform_vulnerabilities TO anon, authenticated;
GRANT ALL ON public.cross_chain_analysis TO anon, authenticated;



-- Add comments for documentation
COMMENT ON TABLE public.blockchain_platforms IS 'Configuration for supported blockchain platforms';
COMMENT ON TABLE public.multi_chain_audits IS 'Audits that span multiple blockchain platforms';
COMMENT ON TABLE public.platform_vulnerabilities IS 'Platform-specific vulnerabilities with blockchain context';
COMMENT ON TABLE public.cross_chain_analysis IS 'Results of cross-chain interoperability analysis';

COMMENT ON COLUMN public.contracts.blockchain_platform IS 'The blockchain platform this contract targets';
COMMENT ON COLUMN public.contracts.language IS 'Programming language of the contract';
COMMENT ON COLUMN public.contracts.dependencies IS 'Contract dependencies and imports';
COMMENT ON COLUMN public.contracts.cross_chain_config IS 'Cross-chain deployment configuration';

COMMENT ON COLUMN public.platform_vulnerabilities.platform_specific_data IS 'Platform-specific vulnerability metadata';
COMMENT ON COLUMN public.multi_chain_audits.cross_chain_analysis IS 'Whether to perform cross-chain analysis';
COMMENT ON COLUMN public.cross_chain_analysis.bridge_security_assessment IS 'Security assessment of bridge contracts';
COMMENT ON COLUMN public.cross_chain_analysis.state_consistency_analysis IS 'Analysis of state consistency across chains';
COMMENT ON COLUMN public.cross_chain_analysis.interoperability_risks IS 'Identified interoperability risks';