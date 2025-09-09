import { AuditOrchestrator, JobPriority } from "../services/AuditOrchestrator";
import { WebSocketService } from "../services/WebSocketService";
import { DatabaseService } from "../services/database";
import { auditQueue } from "../config/queue";
import { createServer } from "http";

// Mock dependencies
jest.mock("../services/database");
jest.mock("../config/queue");
jest.mock("../services/SlitherAnalyzer");
jest.mock("../services/AIAnalyzer");

describe("AuditOrchestrator", () => {
	let orchestrator: AuditOrchestrator;
	let mockWsService: jest.Mocked<WebSocketService>;
	let mockContract: any;
	let mockAudit: any;

	beforeEach(() => {
		// Create mock WebSocket service
		const server = createServer();
		mockWsService = new WebSocketService(
			server
		) as jest.Mocked<WebSocketService>;
		mockWsService.notifyAuditProgress = jest.fn();
		mockWsService.notifyAuditComplete = jest.fn();
		mockWsService.notifyAuditFailed = jest.fn();

		// Create orchestrator instance
		orchestrator = new AuditOrchestrator(mockWsService);

		// Mock contract data
		mockContract = {
			id: "contract-123",
			user_id: "user-123",
			name: "TestContract",
			source_code: "pragma solidity ^0.8.0; contract Test {}",
			created_at: new Date(),
		};

		// Mock audit data
		mockAudit = {
			id: "audit-123",
			contract_id: "contract-123",
			user_id: "user-123",
			status: "pending",
			created_at: new Date(),
		};

		// Mock database methods
		(DatabaseService.getContractById as jest.Mock).mockResolvedValue(
			mockContract
		);
		(DatabaseService.createAudit as jest.Mock).mockResolvedValue(mockAudit);
		(DatabaseService.updateAudit as jest.Mock).mockResolvedValue(true);
		(DatabaseService.createVulnerability as jest.Mock).mockResolvedValue(true);

		// Mock queue methods
		(auditQueue.add as jest.Mock).mockResolvedValue({ id: "job-123" });
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("startAudit", () => {
		it("should successfully start a static analysis audit", async () => {
			const request = {
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "static" as const,
				priority: JobPriority.NORMAL,
			};

			const result = await orchestrator.startAudit(request);

			expect(result.success).toBe(true);
			expect(result.auditId).toBe("audit-123");
			expect(result.jobId).toBe("job-123");
			expect(DatabaseService.getContractById).toHaveBeenCalledWith(
				"contract-123"
			);
			expect(DatabaseService.createAudit).toHaveBeenCalledWith({
				contract_id: "contract-123",
				user_id: "user-123",
				status: "pending",
			});
			expect(auditQueue.add).toHaveBeenCalled();
			expect(mockWsService.notifyAuditProgress).toHaveBeenCalledWith(
				"user-123",
				{
					auditId: "audit-123",
					status: "queued",
					progress: 0,
					currentStep: "Queued for analysis",
				}
			);
		});

		it("should successfully start an AI analysis audit", async () => {
			const request = {
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "ai" as const,
				priority: JobPriority.HIGH,
				options: {
					includeRecommendations: true,
					severityThreshold: "medium",
				},
			};

			const result = await orchestrator.startAudit(request);

			expect(result.success).toBe(true);
			expect(result.auditId).toBe("audit-123");
			expect(auditQueue.add).toHaveBeenCalledWith(
				"ai_analysis",
				expect.objectContaining({
					auditId: "audit-123",
					contractId: "contract-123",
					userId: "user-123",
					options: request.options,
				}),
				expect.objectContaining({
					priority: JobPriority.HIGH,
				})
			);
		});

		it("should successfully start a full analysis audit", async () => {
			const request = {
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "full" as const,
			};

			const result = await orchestrator.startAudit(request);

			expect(result.success).toBe(true);
			expect(auditQueue.add).toHaveBeenCalledWith(
				"full_analysis",
				expect.any(Object),
				expect.any(Object)
			);
		});

		it("should fail when contract is not found", async () => {
			(DatabaseService.getContractById as jest.Mock).mockResolvedValue(null);

			const request = {
				contractId: "nonexistent-contract",
				userId: "user-123",
				analysisType: "static" as const,
			};

			const result = await orchestrator.startAudit(request);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Contract not found");
		});

		it("should fail when user does not own the contract", async () => {
			const contractWithDifferentOwner = {
				...mockContract,
				user_id: "different-user",
			};
			(DatabaseService.getContractById as jest.Mock).mockResolvedValue(
				contractWithDifferentOwner
			);

			const request = {
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "static" as const,
			};

			const result = await orchestrator.startAudit(request);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Access denied");
		});

		it("should fail when audit creation fails", async () => {
			(DatabaseService.createAudit as jest.Mock).mockResolvedValue(null);

			const request = {
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "static" as const,
			};

			const result = await orchestrator.startAudit(request);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Failed to create audit record");
		});

		it("should fail with invalid analysis type", async () => {
			const request = {
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "invalid" as any,
			};

			const result = await orchestrator.startAudit(request);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Invalid analysis type");
		});
	});

	describe("cancelAudit", () => {
		it("should successfully cancel an audit", async () => {
			(DatabaseService.getAuditById as jest.Mock).mockResolvedValue(mockAudit);
			(auditQueue.getJobs as jest.Mock).mockResolvedValue([
				{
					data: { auditId: "audit-123" },
					remove: jest.fn(),
				},
			]);

			const result = await orchestrator.cancelAudit("audit-123", "user-123");

			expect(result.success).toBe(true);
			expect(DatabaseService.updateAudit).toHaveBeenCalledWith("audit-123", {
				status: "failed",
			});
			expect(mockWsService.notifyAuditProgress).toHaveBeenCalledWith(
				"user-123",
				{
					auditId: "audit-123",
					status: "cancelled",
					progress: 0,
					currentStep: "Analysis cancelled",
				}
			);
		});

		it("should fail when audit is not found", async () => {
			(DatabaseService.getAuditById as jest.Mock).mockResolvedValue(null);

			const result = await orchestrator.cancelAudit(
				"nonexistent-audit",
				"user-123"
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Audit not found");
		});

		it("should fail when user does not own the audit", async () => {
			const auditWithDifferentOwner = {
				...mockAudit,
				user_id: "different-user",
			};
			(DatabaseService.getAuditById as jest.Mock).mockResolvedValue(
				auditWithDifferentOwner
			);

			const result = await orchestrator.cancelAudit("audit-123", "user-123");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Access denied");
		});
	});

	describe("getQueueStats", () => {
		it("should return queue statistics", async () => {
			(auditQueue.getWaiting as jest.Mock).mockResolvedValue([1, 2]);
			(auditQueue.getActive as jest.Mock).mockResolvedValue([1]);
			(auditQueue.getCompleted as jest.Mock).mockResolvedValue([1, 2, 3]);
			(auditQueue.getFailed as jest.Mock).mockResolvedValue([1]);
			(auditQueue.getDelayed as jest.Mock).mockResolvedValue([]);

			const stats = await orchestrator.getQueueStats();

			expect(stats).toEqual({
				waiting: 2,
				active: 1,
				completed: 3,
				failed: 1,
				delayed: 0,
			});
		});
	});

	describe("getAuditProgress", () => {
		it("should return audit progress for completed audit", async () => {
			const completedAudit = {
				...mockAudit,
				status: "completed",
				completed_at: new Date(),
			};
			(DatabaseService.getAuditById as jest.Mock).mockResolvedValue(
				completedAudit
			);
			(auditQueue.getJobs as jest.Mock).mockResolvedValue([]);

			const result = await orchestrator.getAuditProgress(
				"audit-123",
				"user-123"
			);

			expect(result.success).toBe(true);
			expect(result.progress).toEqual({
				auditId: "audit-123",
				status: "completed",
				progress: 100,
				currentStep: "Analysis complete",
				startedAt: completedAudit.created_at,
				completedAt: completedAudit.completed_at,
			});
		});

		it("should return audit progress for active job", async () => {
			const mockJob = {
				data: { auditId: "audit-123" },
				progress: jest.fn().mockReturnValue(50),
				opts: { jobId: "job-123" },
				getState: jest.fn().mockResolvedValue("active"),
			};
			(auditQueue.getJobs as jest.Mock).mockResolvedValue([mockJob]);

			const result = await orchestrator.getAuditProgress(
				"audit-123",
				"user-123"
			);

			expect(result.success).toBe(true);
			expect(result.progress?.status).toBe("processing");
			expect(result.progress?.progress).toBe(50);
		});

		it("should fail when audit is not found", async () => {
			(DatabaseService.getAuditById as jest.Mock).mockResolvedValue(null);

			const result = await orchestrator.getAuditProgress(
				"nonexistent-audit",
				"user-123"
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Audit not found");
		});

		it("should fail when user does not own the audit", async () => {
			const auditWithDifferentOwner = {
				...mockAudit,
				user_id: "different-user",
			};
			(DatabaseService.getAuditById as jest.Mock).mockResolvedValue(
				auditWithDifferentOwner
			);

			const result = await orchestrator.getAuditProgress(
				"audit-123",
				"user-123"
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Access denied");
		});
	});
});
