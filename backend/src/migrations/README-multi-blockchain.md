# Multi-Blockchain Database Schema Extension

This document describes the database schema changes implemented to support multi-blockchain smart contract analysis in Audit Wolf.

## Overview

The multi-blockchain support extends the existing database schema to accommodate smart contracts from various blockchain platforms including Ethereum, Solana, Cardano, and others. The changes maintain backward compatibility while adding new capabilities for cross-chain analysis.

## New Tables

### 1. blockchain_platforms

Stores configuration for supported blockchain platforms.

```sql
CREATE TABLE blockchain_platforms (
  id TEXT PRIMARY KEY,                    -- Platform identifier (e.g., 'ethereum', 'solana')
  name TEXT NOT NULL,                     -- Human-readable name
  supported_languages TEXT[] NOT NULL,   -- Programming languages (e.g., ['solidity'], ['rust'])
  file_extensions TEXT[] NOT NULL,       -- File extensions (e.g., ['.sol'], ['.rs'])
  static_analyzers JSONB NOT NULL,       -- Configuration for static analysis tools
  ai_models JSONB NOT NULL,              -- AI model configurations
  validation_rules JSONB NOT NULL,       -- Platform-specific validation rules
  is_active BOOLEAN DEFAULT true,        -- Whether platform is currently supported
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Default Platforms:**

- `ethereum`: Solidity contracts, Slither analysis
- `binance-smart-chain`: BSC-specific Solidity contracts
- `polygon`: Layer 2 Solidity contracts
- `solana`: Rust/Anchor programs
- `cardano`: Plutus/Haskell scripts
- `aptos`: Move language contracts

### 2. multi_chain_audits

Tracks audits that span multiple blockchain platforms.

```sql
CREATE TABLE multi_chain_audits (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  audit_name TEXT NOT NULL,              -- User-defined audit name
  platforms TEXT[] NOT NULL,             -- List of blockchain platforms
  contracts JSONB NOT NULL,              -- Contract data organized by platform
  cross_chain_analysis BOOLEAN DEFAULT false, -- Whether to perform cross-chain analysis
  status TEXT DEFAULT 'pending',         -- Audit status
  results JSONB,                         -- Analysis results per platform
  cross_chain_results JSONB,             -- Cross-chain analysis results
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### 3. platform_vulnerabilities

Stores platform-specific vulnerabilities with blockchain context.

```sql
CREATE TABLE platform_vulnerabilities (
  id UUID PRIMARY KEY,
  audit_id UUID REFERENCES audits(id),           -- Link to single-chain audit
  multi_chain_audit_id UUID REFERENCES multi_chain_audits(id), -- Link to multi-chain audit
  platform TEXT NOT NULL,                        -- Blockchain platform
  vulnerability_type TEXT NOT NULL,              -- Type of vulnerability
  severity TEXT NOT NULL,                        -- Severity level
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location JSONB NOT NULL,                       -- Code location
  recommendation TEXT NOT NULL,
  platform_specific_data JSONB,                 -- Platform-specific metadata
  confidence DECIMAL(3,2),                      -- Confidence score
  source TEXT NOT NULL,                          -- Detection source
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. cross_chain_analysis

Stores results of cross-chain interoperability analysis.

```sql
CREATE TABLE cross_chain_analysis (
  id UUID PRIMARY KEY,
  multi_chain_audit_id UUID REFERENCES multi_chain_audits(id),
  bridge_security_assessment JSONB,      -- Bridge contract security analysis
  state_consistency_analysis JSONB,      -- Cross-chain state consistency
  interoperability_risks JSONB,          -- Identified interoperability risks
  recommendations JSONB,                 -- Cross-chain recommendations
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Extended Tables

### contracts Table Extensions

The existing `contracts` table has been extended with new columns:

```sql
ALTER TABLE contracts ADD COLUMN blockchain_platform TEXT REFERENCES blockchain_platforms(id) DEFAULT 'ethereum';
ALTER TABLE contracts ADD COLUMN language TEXT NOT NULL DEFAULT 'solidity';
ALTER TABLE contracts ADD COLUMN dependencies JSONB;
ALTER TABLE contracts ADD COLUMN cross_chain_config JSONB;
```

**New Fields:**

- `blockchain_platform`: References the target blockchain platform
- `language`: Programming language of the contract
- `dependencies`: Contract dependencies and imports
- `cross_chain_config`: Cross-chain deployment configuration

## Data Types

### ContractDependency

```typescript
interface ContractDependency {
	name: string; // Dependency name
	version?: string; // Version specification
	source?: string; // Source (npm, github, etc.)
	type: "import" | "library" | "interface";
}
```

### CrossChainConfig

```typescript
interface CrossChainConfig {
	target_chains: string[]; // Target blockchain platforms
	bridge_contracts?: Record<string, string>; // Bridge contract addresses
	deployment_order?: string[]; // Deployment sequence
	shared_state?: Record<string, any>; // Shared state variables
}
```

## Platform-Specific Data Examples

### Ethereum/EVM Platforms

```json
{
	"evm_specific": true,
	"gas_impact": "high",
	"affected_functions": ["withdraw", "transfer"],
	"opcodes": ["CALL", "DELEGATECALL"]
}
```

### Solana

```json
{
	"anchor_specific": true,
	"pda_seeds": ["user", "token_mint"],
	"compute_units": 5000,
	"account_constraints": ["mut", "signer"]
}
```

### Cardano

```json
{
	"plutus_specific": true,
	"utxo_model": true,
	"datum_type": "inline",
	"script_purpose": "spending"
}
```

## Indexes

The migration creates indexes for optimal query performance:

- `idx_contracts_blockchain_platform`: Contract queries by platform
- `idx_contracts_language`: Contract queries by language
- `idx_multi_chain_audits_platforms`: Multi-chain audit platform searches
- `idx_platform_vulnerabilities_platform`: Vulnerability queries by platform
- `idx_cross_chain_analysis_multi_chain_audit_id`: Cross-chain analysis lookups

## Row Level Security (RLS)

All new tables implement RLS policies to ensure users can only access their own data:

- Users can view active blockchain platforms (read-only)
- Users can manage their own multi-chain audits
- Users can view vulnerabilities for their own audits
- Users can view cross-chain analysis for their own audits

## Migration Notes

1. **Backward Compatibility**: Existing contracts are automatically assigned `blockchain_platform='ethereum'` and `language='solidity'`
2. **Default Platforms**: The migration inserts default blockchain platform configurations
3. **Foreign Key Constraints**: New foreign key relationships maintain data integrity
4. **Flexible Schema**: JSONB fields allow for platform-specific extensions without schema changes

## Usage Examples

### Creating a Multi-Chain Audit

```typescript
const audit = await MultiChainAuditModel.create({
	user_id: "user-123",
	audit_name: "DeFi Protocol Security Review",
	platforms: ["ethereum", "polygon", "solana"],
	contracts: {
		ethereum: [{ name: "Token.sol", code: "..." }],
		polygon: [{ name: "Bridge.sol", code: "..." }],
		solana: [{ name: "program.rs", code: "..." }],
	},
	cross_chain_analysis: true,
});
```

### Platform-Specific Vulnerability

```typescript
const vulnerability = await PlatformVulnerabilityModel.create({
	multi_chain_audit_id: "audit-123",
	platform: "solana",
	vulnerability_type: "pda_security",
	severity: "high",
	title: "Insecure PDA Derivation",
	platform_specific_data: {
		anchor_specific: true,
		pda_seeds: ["predictable", "value"],
		compute_units: 1000,
	},
});
```

This schema extension provides a robust foundation for multi-blockchain smart contract analysis while maintaining the existing functionality for Ethereum-based contracts.
