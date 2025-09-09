export interface AuditProgress {
	auditId: string;
	status: "queued" | "processing" | "completed" | "failed" | "cancelled";
	progress: number; // 0-100
	currentStep: string;
	estimatedTimeRemaining?: number;
	startedAt?: Date;
	completedAt?: Date;
	error?: string;
}

import { JobPriority } from "../config/queue";

export interface AuditRequest {
	contractId: string;
	userId: string;
	analysisType: "static" | "ai" | "full";
	platform?: string;
	priority?: JobPriority;
	options?: {
		includeRecommendations?: boolean;
		includeQualityMetrics?: boolean;
		focusAreas?: string[];
		severityThreshold?: string;
	};
}
