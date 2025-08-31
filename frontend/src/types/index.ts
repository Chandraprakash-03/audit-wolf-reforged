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
} from "../../../backend/src/types";

// Frontend-specific types
export interface ContractUploadState {
	file: File | null;
	code: string;
	isValid: boolean;
	errors: string[];
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
