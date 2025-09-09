// Database model interfaces for Audit Wolf

export interface User {
	id: string;
	email: string;
	name: string;
	subscription_tier: "free" | "pro" | "enterprise";
	api_credits: number;
	created_at: Date;
	updated_at: Date;
}

export interface Contract {
	id: string;
	user_id: string;
	name: string;
	source_code: string;
	compiler_version: string;
	file_hash: string;
	blockchain_platform: string;
	language: string;
	dependencies?: ContractDependency[];
	cross_chain_config?: CrossChainConfig;
	created_at: Date;
}

export interface CodeLocation {
	file: string;
	line: number;
	column: number;
	length?: number;
}

export interface SlitherVulnerability {
	type: string;
	severity: "critical" | "high" | "medium" | "low" | "informational";
	description: string;
	location: CodeLocation;
	confidence: number;
}

export interface GasOptimization {
	type: string;
	description: string;
	location: CodeLocation;
	estimated_savings: number;
}

export interface ComplexityMetrics {
	cyclomatic_complexity: number;
	lines_of_code: number;
	function_count: number;
}

export interface StaticAnalysisResult {
	slither_findings: SlitherVulnerability[];
	ast_analysis: any[]; // AST nodes - keeping flexible for now
	gas_analysis: GasOptimization[];
	complexity: ComplexityMetrics;
}

export interface AIVulnerability {
	type:
		| "reentrancy"
		| "overflow"
		| "access_control"
		| "gas_optimization"
		| "best_practice"
		| "security";
	severity: "critical" | "high" | "medium" | "low" | "informational";
	description: string;
	location: CodeLocation;
	confidence: number;
}

export interface SecurityRecommendation {
	category: string;
	priority: "high" | "medium" | "low";
	description: string;
	implementation_guide: string;
}

export interface QualityMetrics {
	code_quality_score: number;
	maintainability_index: number;
	test_coverage_estimate: number;
}

export interface AIAnalysisResult {
	vulnerabilities: AIVulnerability[];
	recommendations: SecurityRecommendation[];
	code_quality: QualityMetrics;
	confidence: number;
}

export interface AuditReport {
	executive_summary: string;
	total_vulnerabilities: number;
	critical_count: number;
	high_count: number;
	medium_count: number;
	low_count: number;
	informational_count: number;
	gas_optimizations: GasOptimization[];
	recommendations: SecurityRecommendation[];
	generated_at: Date;
}

export interface Audit {
	id: string;
	contract_id: string;
	user_id: string;
	status: "pending" | "analyzing" | "completed" | "failed";
	static_results?: StaticAnalysisResult;
	ai_results?: AIAnalysisResult;
	final_report?: AuditReport;
	ipfs_hash?: string;
	blockchain_tx?: string;
	created_at: Date;
	completed_at?: Date;
}

export interface Vulnerability {
	id: string;
	audit_id: string;
	type:
		| "reentrancy"
		| "overflow"
		| "access_control"
		| "gas_optimization"
		| "best_practice"
		| "security";
	severity: "critical" | "high" | "medium" | "low" | "informational";
	title: string;
	description: string;
	location: CodeLocation;
	recommendation: string;
	confidence: number;
	source: "static" | "ai" | "combined";
	created_at: Date;
}

// Multi-blockchain support interfaces
export interface ContractDependency {
	name: string;
	version?: string;
	source?: string;
	type: "import" | "library" | "interface";
}

export interface CrossChainConfig {
	target_chains: string[];
	bridge_contracts?: Record<string, string>;
	deployment_order?: string[];
	shared_state?: Record<string, any>;
}

export interface BlockchainPlatform {
	id: string;
	name: string;
	supported_languages: string[];
	file_extensions: string[];
	static_analyzers: Record<string, any>;
	ai_models: Record<string, any>;
	validation_rules: Record<string, any>;
	is_active: boolean;
	created_at: Date;
	updated_at: Date;
}

export interface MultiChainAudit {
	id: string;
	user_id: string;
	audit_name: string;
	platforms: string[];
	contracts: Record<string, any>;
	cross_chain_analysis: boolean;
	status: "pending" | "analyzing" | "completed" | "failed";
	results?: Record<string, any>;
	cross_chain_results?: Record<string, any>;
	created_at: Date;
	completed_at?: Date;
}

export interface PlatformVulnerability {
	id: string;
	audit_id?: string;
	multi_chain_audit_id?: string;
	platform: string;
	vulnerability_type: string;
	severity: "critical" | "high" | "medium" | "low" | "informational";
	title: string;
	description: string;
	location: Record<string, any>;
	recommendation: string;
	platform_specific_data?: Record<string, any>;
	confidence: number;
	source: "static" | "ai" | "combined";
	created_at: Date;
}

export interface CrossChainAnalysis {
	id: string;
	multi_chain_audit_id: string;
	bridge_security_assessment?: Record<string, any>;
	state_consistency_analysis?: Record<string, any>;
	interoperability_risks?: Record<string, any>;
	recommendations?: Record<string, any>;
	created_at: Date;
}

// Database table types for Supabase
export interface Database {
	public: {
		Tables: {
			users: {
				Row: User;
				Insert: Omit<User, "id" | "created_at" | "updated_at">;
				Update: Partial<Omit<User, "id" | "created_at">>;
			};
			contracts: {
				Row: Contract;
				Insert: Omit<Contract, "id" | "created_at">;
				Update: Partial<Omit<Contract, "id" | "created_at">>;
			};
			audits: {
				Row: Audit;
				Insert: Omit<Audit, "id" | "created_at">;
				Update: Partial<Omit<Audit, "id" | "created_at">>;
			};
			vulnerabilities: {
				Row: Vulnerability;
				Insert: Omit<Vulnerability, "id" | "created_at">;
				Update: Partial<Omit<Vulnerability, "id" | "created_at">>;
			};
			blockchain_platforms: {
				Row: BlockchainPlatform;
				Insert: Omit<BlockchainPlatform, "id" | "created_at" | "updated_at">;
				Update: Partial<Omit<BlockchainPlatform, "id" | "created_at">>;
			};
			multi_chain_audits: {
				Row: MultiChainAudit;
				Insert: Omit<MultiChainAudit, "id" | "created_at">;
				Update: Partial<Omit<MultiChainAudit, "id" | "created_at">>;
			};
			platform_vulnerabilities: {
				Row: PlatformVulnerability;
				Insert: Omit<PlatformVulnerability, "id" | "created_at">;
				Update: Partial<Omit<PlatformVulnerability, "id" | "created_at">>;
			};
			cross_chain_analysis: {
				Row: CrossChainAnalysis;
				Insert: Omit<CrossChainAnalysis, "id" | "created_at">;
				Update: Partial<Omit<CrossChainAnalysis, "id" | "created_at">>;
			};
		};
	};
}
