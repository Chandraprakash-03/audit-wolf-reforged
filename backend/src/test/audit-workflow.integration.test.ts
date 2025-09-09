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

describe("Audit Workflow Integration", () => {
	let orchestrator: AuditOrchestrator;
	let mockWsService: jest.Mocked<WebSocketService>;

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

		// Mock database methods
		(DatabaseService.getContractById as jest.Mock).mockResolvedValue({
			id: "contract-123",
			user_id: "user-123",
			name: "TestContract",
			source_code: "pragma solidity ^0.8.0; contract Test {}",
			created_at: new Date(),
		});

		(DatabaseService.createAudit as jest.Mock).mockResolvedValue({
			id: "audit-123",
			contract_id: "contract-123",
			user_id: "user-123",
			status: "pending",
			created_at: new Date(),
		});

		(DatabaseService.updateAudit as jest.Mock).mockResolvedValue(true);
		(DatabaseService.createVulnerability as jest.Mock).mockResolvedValue(true);

		// Mock queue methods
		(auditQueue.add as jest.Mock).mockResolvedValue({ id: "job-123" });
		(auditQueue.getJobs as jest.Mock).mockResolvedValue([]);
		(auditQueue.getWaiting as jest.Mock).mockResolvedValue([]);
		(auditQueue.getActive as jest.Mock).mockResolvedValue([]);
		(auditQueue.getCompleted as jest.Mock).mockResolvedValue([]);
		(auditQueue.getFailed as jest.Mock).mockResolvedValue([]);
		(auditQueue.getDelayed as jest.Mock).mockResolvedValue([]);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("Complete Audit Workflow", () => {
		it("should successfully complete a static analysis workflow", async () => {
			// Step 1: Start audit
			const startResult = await orchestrator.startAudit({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "static",
				priority: JobPriority.NORMAL,
			});

			expect(startResult.success).toBe(true);
			expect(startResult.auditId).toBe("audit-123");
			expect(startResult.jobId).toBe("job-123");

			// Verify audit creation
			expect(DatabaseService.createAudit).toHaveBeenCalledWith({
				contract_id: "contract-123",
				user_id: "user-123",
				status: "pending",
			});

			// Verify job was added to queue
			expect(auditQueue.add).toHaveBeenCalledWith(
				"static_analysis",
				expect.objectContaining({
					auditId: "audit-123",
					contractId: "contract-123",
					userId: "user-123",
				}),
				expect.objectContaining({
					priority: JobPriority.NORMAL,
				})
			);

			// Verify WebSocket notification
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

		it("should successfully complete an AI analysis workflow", async () => {
			const startResult = await orchestrator.startAudit({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "ai",
				priority: JobPriority.HIGH,
				options: {
					includeRecommendations: true,
					severityThreshold: "medium",
				},
			});

			expect(startResult.success).toBe(true);
			expect(auditQueue.add).toHaveBeenCalledWith(
				"ai_analysis",
				expect.objectContaining({
					options: {
						includeRecommendations: true,
						severityThreshold: "medium",
					},
				}),
				expect.objectContaining({
					priority: JobPriority.HIGH,
				})
			);
		});

		it("should successfully complete a full analysis workflow", async () => {
			const startResult = await orchestrator.startAudit({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "full",
				options: {
					includeRecommendations: true,
					includeQualityMetrics: true,
					focusAreas: ["reentrancy", "access control"],
				},
			});

			expect(startResult.success).toBe(true);
			expect(auditQueue.add).toHaveBeenCalledWith(
				"full_analysis",
				expect.objectContaining({
					options: {
						includeRecommendations: true,
						includeQualityMetrics: true,
						focusAreas: ["reentrancy", "access control"],
					},
				}),
				expect.any(Object)
			);
		});

		it("should handle audit cancellation workflow", async () => {
			// Mock audit exists
			(DatabaseService.getAuditById as jest.Mock).mockResolvedValue({
				id: "audit-123",
				user_id: "user-123",
				status: "pending",
			});

			// Mock job in queue
			const mockJob = {
				data: { auditId: "audit-123" },
				remove: jest.fn(),
			};
			(auditQueue.getJobs as jest.Mock).mockResolvedValue([mockJob]);

			const cancelResult = await orchestrator.cancelAudit(
				"audit-123",
				"user-123"
			);

			expect(cancelResult.success).toBe(true);
			expect(mockJob.remove).toHaveBeenCalled();
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

		it("should get queue statistics", async () => {
			(auditQueue.getWaiting as jest.Mock).mockResolvedValue([1, 2, 3]);
			(auditQueue.getActive as jest.Mock).mockResolvedValue([1]);
			(auditQueue.getCompleted as jest.Mock).mockResolvedValue([1, 2]);
			(auditQueue.getFailed as jest.Mock).mockResolvedValue([]);
			(auditQueue.getDelayed as jest.Mock).mockResolvedValue([1]);

			const stats = await orchestrator.getQueueStats();

			expect(stats).toEqual({
				waiting: 3,
				active: 1,
				completed: 2,
				failed: 0,
				delayed: 1,
			});
		});

		it("should track audit progress correctly", async () => {
			// Mock audit exists
			(DatabaseService.getAuditById as jest.Mock).mockResolvedValue({
				id: "audit-123",
				user_id: "user-123",
				status: "completed",
				created_at: new Date("2024-01-01"),
				completed_at: new Date("2024-01-01T01:00:00"),
			});

			const progressResult = await orchestrator.getAuditProgress(
				"audit-123",
				"user-123"
			);

			expect(progressResult.success).toBe(true);
			expect(progressResult.progress).toEqual({
				auditId: "audit-123",
				status: "completed",
				progress: 100,
				currentStep: "Analysis complete",
				startedAt: new Date("2024-01-01"),
				completedAt: new Date("2024-01-01T01:00:00"),
			});
		});
	});

	describe("Error Handling", () => {
		it("should handle contract not found error", async () => {
			(DatabaseService.getContractById as jest.Mock).mockResolvedValue(null);

			const result = await orchestrator.startAudit({
				contractId: "nonexistent-contract",
				userId: "user-123",
				analysisType: "static",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Contract not found");
		});

		it("should handle access denied error", async () => {
			(DatabaseService.getContractById as jest.Mock).mockResolvedValue({
				id: "contract-123",
				user_id: "different-user",
				name: "TestContract",
				source_code: "pragma solidity ^0.8.0; contract Test {}",
			});

			const result = await orchestrator.startAudit({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "static",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Access denied");
		});

		it("should handle audit creation failure", async () => {
			(DatabaseService.createAudit as jest.Mock).mockResolvedValue(null);

			const result = await orchestrator.startAudit({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "static",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Failed to create audit record");
		});

		it("should handle database errors gracefully", async () => {
			(DatabaseService.getContractById as jest.Mock).mockRejectedValue(
				new Error("Database connection failed")
			);

			const result = await orchestrator.startAudit({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "static",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Database connection failed");
		});

		it("should handle queue errors gracefully", async () => {
			(auditQueue.add as jest.Mock).mockRejectedValue(
				new Error("Queue is full")
			);

			const result = await orchestrator.startAudit({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "static",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Queue is full");
		});
	});

	describe("Priority Handling", () => {
		it("should handle different priority levels", async () => {
			const priorities = [
				JobPriority.LOW,
				JobPriority.NORMAL,
				JobPriority.HIGH,
				JobPriority.CRITICAL,
			];

			for (const priority of priorities) {
				const result = await orchestrator.startAudit({
					contractId: "contract-123",
					userId: "user-123",
					analysisType: "static",
					priority,
				});

				expect(result.success).toBe(true);
				expect(auditQueue.add).toHaveBeenCalledWith(
					"static_analysis",
					expect.any(Object),
					expect.objectContaining({ priority })
				);
			}
		});

		it("should default to normal priority when not specified", async () => {
			const result = await orchestrator.startAudit({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "static",
			});

			expect(result.success).toBe(true);
			expect(auditQueue.add).toHaveBeenCalledWith(
				"static_analysis",
				expect.any(Object),
				expect.objectContaining({ priority: JobPriority.NORMAL })
			);
		});
	});
});
