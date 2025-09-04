// Database model interfaces for Audit Wolf Frontend

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
	ast_analysis: Record<string, unknown>[]; // AST nodes - keeping flexible for now
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
	vulnerabilities?: Vulnerability[]; // Optional for backward compatibility
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
		};
	};
}
