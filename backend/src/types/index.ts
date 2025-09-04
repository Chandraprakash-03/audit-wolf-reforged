// Core entity types
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
		| "best_practice";
	severity: "critical" | "high" | "medium" | "low" | "informational";
	title: string;
	description: string;
	location: CodeLocation;
	recommendation: string;
	confidence: number;
	source: "static" | "ai" | "combined";
}

// Analysis result types
export interface StaticAnalysisResult {
	slitherFindings: SlitherVulnerability[];
	astAnalysis: ASTNode[];
	gasAnalysis: GasOptimization[];
	complexity: ComplexityMetrics;
}

export interface AIAnalysisResult {
	vulnerabilities: AIVulnerability[];
	recommendations: SecurityRecommendation[];
	codeQuality: QualityMetrics;
	confidence: number;
}

export interface AuditReport {
	id: string;
	audit_id: string;
	executive_summary: string;
	vulnerabilities: Vulnerability[];
	gas_optimizations: GasOptimization[];
	recommendations: string[];
	generated_at: Date;
}

// Supporting types
export interface CodeLocation {
	file: string;
	line: number;
	column: number;
	length: number;
}

export interface SlitherVulnerability {
	type: string;
	severity: string;
	description: string;
	location: CodeLocation;
}

export interface ASTNode {
	type: string;
	name?: string;
	children: ASTNode[];
	location: CodeLocation;
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

export interface AIVulnerability {
	type: string;
	severity: string;
	description: string;
	location: CodeLocation;
	confidence: number;
}

export interface SecurityRecommendation {
	category: string;
	description: string;
	priority: "high" | "medium" | "low";
}

export interface QualityMetrics {
	maintainability: number;
	readability: number;
	test_coverage: number;
}

// Re-export blockchain types
export * from "./blockchain";
