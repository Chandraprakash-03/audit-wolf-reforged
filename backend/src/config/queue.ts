import Queue from "bull";
import Redis from "ioredis";

// Redis configuration
const redisConfig = {
	host: process.env.REDIS_HOST || "localhost",
	port: parseInt(process.env.REDIS_PORT || "6379"),
	password: process.env.REDIS_PASSWORD,
	db: parseInt(process.env.REDIS_DB || "0"),
	retryDelayOnFailover: 100,
	enableReadyCheck: false,
	maxRetriesPerRequest: null,
};

// Create Redis connection
export const redis = new Redis(redisConfig);

// Create audit queue
export const auditQueue = new Queue("audit processing", {
	redis: redisConfig,
	defaultJobOptions: {
		removeOnComplete: 10, // Keep last 10 completed jobs
		removeOnFail: 50, // Keep last 50 failed jobs
		attempts: 3, // Retry failed jobs up to 3 times
		backoff: {
			type: "exponential",
			delay: 2000, // Start with 2 second delay
		},
	},
});

// Job types
export enum JobType {
	STATIC_ANALYSIS = "static_analysis",
	AI_ANALYSIS = "ai_analysis",
	FULL_ANALYSIS = "full_analysis",
	MULTI_CHAIN_ANALYSIS = "multi_chain_analysis",
	PLATFORM_ANALYSIS = "platform_analysis",
	CROSS_CHAIN_ANALYSIS = "cross_chain_analysis",
}

// Job data interfaces
export interface StaticAnalysisJobData {
	auditId: string;
	contractId: string;
	userId: string;
	contractName: string;
	sourceCode: string;
}

export interface AIAnalysisJobData {
	auditId: string;
	contractId: string;
	userId: string;
	contractName: string;
	sourceCode: string;
	options?: {
		includeRecommendations?: boolean;
		includeQualityMetrics?: boolean;
		focusAreas?: string[];
		severityThreshold?: string;
	};
}

export interface FullAnalysisJobData {
	auditId: string;
	contractId: string;
	userId: string;
	contractName: string;
	sourceCode: string;
	options?: {
		includeRecommendations?: boolean;
		includeQualityMetrics?: boolean;
		focusAreas?: string[];
		severityThreshold?: string;
	};
}

// Multi-chain job data interfaces
export interface MultiChainAnalysisJobData {
	multiChainAuditId: string;
	userId: string;
	auditName: string;
	platforms: string[];
	contracts: Record<string, any>;
	crossChainAnalysis: boolean;
	analysisOptions: Record<string, any>;
}

export interface PlatformAnalysisJobData {
	multiChainAuditId: string;
	userId: string;
	platform: string;
	contracts: any[];
	analysisOptions: Record<string, any>;
}

export interface CrossChainAnalysisJobData {
	multiChainAuditId: string;
	userId: string;
	platformResults: Record<string, any>;
}

// Job priority levels
export enum JobPriority {
	LOW = 1,
	NORMAL = 5,
	HIGH = 10,
	CRITICAL = 15,
}

// Queue events
auditQueue.on("completed", (job: { id: any }, result: any) => {
	console.log(`Job ${job.id} completed:`, result);
});

auditQueue.on("failed", (job: { id: any }, err: { message: any }) => {
	console.error(`Job ${job.id} failed:`, err.message);
});

auditQueue.on("stalled", (job: { id: any }) => {
	console.warn(`Job ${job.id} stalled`);
});

auditQueue.on("progress", (job: { id: any }, progress: any) => {
	console.log(`Job ${job.id} progress: ${progress}%`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
	console.log("Shutting down queue...");
	await auditQueue.close();
	await redis.disconnect();
});

process.on("SIGINT", async () => {
	console.log("Shutting down queue...");
	await auditQueue.close();
	await redis.disconnect();
});
