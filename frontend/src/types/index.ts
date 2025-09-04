// Re-export backend types for frontend use
export type {
	User,
	Contract,
	Audit,
	Vulnerability,
	StaticAnalysisResult,
	AIAnalysisResult,
	AuditReport,
	CodeLocation,
	SlitherVulnerability,
	ASTNode,
	GasOptimization,
	ComplexityMetrics,
	AIVulnerability,
	SecurityRecommendation,
	QualityMetrics,
	BlockchainPlatform,
	ValidationResult,
	PlatformVulnerability,
	MultiChainAnalysisRequest,
	MultiChainAnalysisResult,
	AnalysisOptions,
} from "../../../backend/src/types";

// Frontend-specific types
export interface ContractUploadState {
	file: File | null;
	code: string;
	isValid: boolean;
	errors: string[];
	warnings?: string[];
	detectedLanguage?: string;
	suggestedPlatforms?: string[];
}

// Multi-blockchain audit types
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
	location: any;
	recommendation: string;
	platform_specific_data?: Record<string, any>;
	confidence: number;
	source: "static" | "ai" | "combined";
	created_at: Date;
}

export interface MultiChainContractUploadState {
	contracts: ContractUploadState[];
	selectedPlatforms: string[];
	crossChainAnalysis: boolean;
	dependencies: ContractInput[];
}

// Temporary interface until backend types are properly imported
export interface ContractInput {
	code: string;
	filename: string;
	platform: string;
	language?: string;
	dependencies?: ContractInput[];
}

export interface AuditProgress {
	stage:
		| "uploading"
		| "static_analysis"
		| "ai_analysis"
		| "generating_report"
		| "completed";
	progress: number;
	message: string;
}

export interface Theme {
	mode: "light" | "dark";
	primary: string;
	secondary: string;
}

export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?:
		| string
		| {
				code: string;
				message: string;
				recovery?: string[];
				timestamp?: string;
				requestId?: string;
				stack?: string;
		  };
	message?: string;
}

export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	hasMore: boolean;
}
