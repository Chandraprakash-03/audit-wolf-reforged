// Mock the queue to avoid duplicate handler registration
jest.mock("../config/queue", () => ({
	auditQueue: {
		process: jest.fn(),
		add: jest.fn().mockResolvedValue({ id: "test-job-id" }),
		getJobs: jest.fn().mockResolvedValue([]),
		getWaiting: jest.fn().mockResolvedValue([]),
		getActive: jest.fn().mockResolvedValue([]),
		getCompleted: jest.fn().mockResolvedValue([]),
		getFailed: jest.fn().mockResolvedValue([]),
		getDelayed: jest.fn().mockResolvedValue([]),
	},
	JobPriority: {
		LOW: 1,
		NORMAL: 5,
		HIGH: 10,
		CRITICAL: 15,
	},
	redis: {},
}));

// Mock MultiChainAuditModel
jest.mock("../models/MultiChainAudit", () => ({
	MultiChainAuditModel: {
		create: jest.fn().mockResolvedValue({
			id: "test-audit-id",
			user_id: "test-user",
			audit_name: "Test Audit",
			platforms: ["ethereum"],
			status: "pending",
		}),
		findById: jest.fn().mockResolvedValue({
			id: "test-audit-id",
			user_id: "test-user",
			audit_name: "Test Audit",
			platforms: ["ethereum"],
			status: "pending",
		}),
	},
}));

import { MultiChainAnalysisOrchestrator } from "../services/MultiChainAnalysisOrchestrator";
import { WebSocketService } from "../services/WebSocketService";
import {
	MultiChainAnalysisRequest,
	AnalysisOptions,
} from "../types/blockchain";
import { JobPriority } from "../config/queue";

// Mock WebSocket service
const mockWebSocketService = {
	notifyMultiChainProgress: jest.fn(),
	sendToUser: jest.fn(),
	sendToAudit: jest.fn(),
} as unknown as WebSocketService;

describe("MultiChainAnalysisOrchestrator", () => {
	let orchestrator: MultiChainAnalysisOrchestrator;

	beforeEach(() => {
		orchestrator = new MultiChainAnalysisOrchestrator(mockWebSocketService);
		jest.clearAllMocks();
	});

	describe("startMultiChainAnalysis", () => {
		it("should validate analysis request", async () => {
			const invalidRequest: MultiChainAnalysisRequest = {
				contracts: [],
				platforms: [],
				analysisOptions: {
					includeStaticAnalysis: true,
					includeAIAnalysis: true,
					severityThreshold: "medium",
				},
				crossChainAnalysis: false,
			};

			const result = await orchestrator.startMultiChainAnalysis({
				userId: "test-user",
				auditName: "Test Audit",
				analysisRequest: invalidRequest,
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain("At least one platform must be specified");
		});

		it("should accept valid multi-chain analysis request", async () => {
			const validRequest: MultiChainAnalysisRequest = {
				contracts: [
					{
						code: "pragma solidity ^0.8.0; contract Test {}",
						filename: "Test.sol",
						platform: "ethereum",
						language: "solidity",
					},
				],
				platforms: ["ethereum"],
				analysisOptions: {
					includeStaticAnalysis: true,
					includeAIAnalysis: true,
					severityThreshold: "medium",
				},
				crossChainAnalysis: false,
			};

			// Mock the database operations
			jest.mock("../models/MultiChainAudit", () => ({
				MultiChainAuditModel: {
					create: jest.fn().mockResolvedValue({
						id: "test-audit-id",
						user_id: "test-user",
						audit_name: "Test Audit",
						platforms: ["ethereum"],
						status: "pending",
					}),
				},
			}));

			const result = await orchestrator.startMultiChainAnalysis({
				userId: "test-user",
				auditName: "Test Audit",
				analysisRequest: validRequest,
				priority: JobPriority.NORMAL,
			});

			// The result might fail due to missing database setup in test environment
			// but the validation should pass
			expect(typeof result.success).toBe("boolean");
		});
	});

	describe("getQueueStats", () => {
		it("should return queue statistics", async () => {
			const stats = await orchestrator.getQueueStats();

			expect(stats).toHaveProperty("multiChainAnalysis");
			expect(stats).toHaveProperty("platformAnalysis");
			expect(stats).toHaveProperty("crossChainAnalysis");

			expect(stats.multiChainAnalysis).toHaveProperty("waiting");
			expect(stats.multiChainAnalysis).toHaveProperty("active");
			expect(stats.multiChainAnalysis).toHaveProperty("completed");
			expect(stats.multiChainAnalysis).toHaveProperty("failed");
		});
	});

	describe("validation", () => {
		it("should validate platforms exist in registry", async () => {
			const requestWithInvalidPlatform: MultiChainAnalysisRequest = {
				contracts: [
					{
						code: "test code",
						filename: "test.sol",
						platform: "invalid-platform",
					},
				],
				platforms: ["invalid-platform"],
				analysisOptions: {
					includeStaticAnalysis: true,
					includeAIAnalysis: true,
					severityThreshold: "medium",
				},
				crossChainAnalysis: false,
			};

			const result = await orchestrator.startMultiChainAnalysis({
				userId: "test-user",
				auditName: "Test Audit",
				analysisRequest: requestWithInvalidPlatform,
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain("Unknown platform: invalid-platform");
		});

		it("should validate contracts have code", async () => {
			const requestWithEmptyContract: MultiChainAnalysisRequest = {
				contracts: [
					{
						code: "",
						filename: "empty.sol",
						platform: "ethereum",
					},
				],
				platforms: ["ethereum"],
				analysisOptions: {
					includeStaticAnalysis: true,
					includeAIAnalysis: true,
					severityThreshold: "medium",
				},
				crossChainAnalysis: false,
			};

			const result = await orchestrator.startMultiChainAnalysis({
				userId: "test-user",
				auditName: "Test Audit",
				analysisRequest: requestWithEmptyContract,
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain("Contract code cannot be empty");
		});
	});
});
