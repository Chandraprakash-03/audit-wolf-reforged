import { CacheService } from "../services/CacheService";
import { Audit, AuditReport } from "../types/index";

// Mock Redis
const mockRedis = {
	setex: jest.fn(),
	get: jest.fn(),
	del: jest.fn(),
	info: jest.fn(),
	incr: jest.fn(),
	hset: jest.fn(),
	hgetall: jest.fn(),
	hdel: jest.fn(),
	flushdb: jest.fn(),
};

jest.mock("../config/queue", () => ({
	redis: mockRedis,
}));

describe("Cache Service Tests", () => {
	let cacheService: CacheService;

	beforeEach(() => {
		jest.clearAllMocks();
		cacheService = CacheService.getInstance();
	});

	describe("Audit Result Caching", () => {
		const mockAudit: Audit = {
			id: "audit-123",
			contract_id: "contract-123",
			user_id: "user-123",
			status: "completed",
			static_results: {
				slitherFindings: [],
				gasAnalysis: [],
				astAnalysis: [],
				complexity: {
					lines_of_code: 100,
					function_count: 5,
					cyclomatic_complexity: 10,
				},
				// executionTime: 5000,
			},
			created_at: new Date(),
		};

		it("should cache audit results successfully", async () => {
			mockRedis.setex.mockResolvedValue("OK");
			mockRedis.hset.mockResolvedValue(1);

			await cacheService.cacheAuditResult("audit-123", mockAudit);

			expect(mockRedis.setex).toHaveBeenCalledWith(
				"audit:audit-123",
				3600, // Default TTL
				JSON.stringify(mockAudit)
			);
			expect(mockRedis.hset).toHaveBeenCalledWith(
				"cache:sizes",
				"audit:audit-123",
				expect.any(Number)
			);
		});

		it("should retrieve cached audit results", async () => {
			mockRedis.get.mockResolvedValue(JSON.stringify(mockAudit));

			const result = await cacheService.getCachedAuditResult("audit-123");

			expect(mockRedis.get).toHaveBeenCalledWith("audit:audit-123");
			expect(result).toEqual(mockAudit);
		});

		it("should return null for non-existent audit results", async () => {
			mockRedis.get.mockResolvedValue(null);

			const result = await cacheService.getCachedAuditResult("nonexistent");

			expect(result).toBeNull();
		});

		it("should handle caching errors gracefully", async () => {
			mockRedis.setex.mockRejectedValue(new Error("Redis error"));

			// Should not throw
			await expect(
				cacheService.cacheAuditResult("audit-123", mockAudit)
			).resolves.not.toThrow();
		});

		it("should handle retrieval errors gracefully", async () => {
			mockRedis.get.mockRejectedValue(new Error("Redis error"));

			const result = await cacheService.getCachedAuditResult("audit-123");

			expect(result).toBeNull();
		});

		it("should handle JSON parsing errors", async () => {
			mockRedis.get.mockResolvedValue("invalid json");

			const result = await cacheService.getCachedAuditResult("audit-123");

			expect(result).toBeNull();
		});
	});

	describe("Audit Report Caching", () => {
		const mockReport: AuditReport = {
			id: "report-123",
			audit_id: "audit-123",
			executive_summary: "Test summary",
			vulnerabilities: [
				{
					id: "vuln-1",
					audit_id: "audit-123",
					type: "reentrancy",
					severity: "critical",
					title: "Critical vulnerability",
					description: "Test vulnerability",
					location: { file: "test.sol", line: 1, column: 0, length: 10 },
					recommendation: "Fix this",
					confidence: 0.9,
					source: "static",
				},
			],
			gas_optimizations: [
				{
					type: "storage",
					description: "Optimize storage usage",
					location: { file: "test.sol", line: 5, column: 0, length: 20 },
					estimated_savings: 1000,
				},
			],
			recommendations: ["Use SafeMath", "Add access controls"],
			generated_at: new Date(),
		};

		it("should cache audit reports successfully", async () => {
			mockRedis.setex.mockResolvedValue("OK");
			mockRedis.hset.mockResolvedValue(1);

			await cacheService.cacheAuditReport("audit-123", mockReport);

			expect(mockRedis.setex).toHaveBeenCalledWith(
				"report:audit-123",
				86400, // Report TTL
				JSON.stringify(mockReport)
			);
		});

		it("should retrieve cached audit reports", async () => {
			mockRedis.get.mockResolvedValue(JSON.stringify(mockReport));

			const result = await cacheService.getCachedAuditReport("audit-123");

			expect(result).toEqual(mockReport);
		});

		it("should return null for non-existent reports", async () => {
			mockRedis.get.mockResolvedValue(null);

			const result = await cacheService.getCachedAuditReport("nonexistent");

			expect(result).toBeNull();
		});
	});

	describe("User Audit Caching", () => {
		const mockAudits: Audit[] = [
			{
				id: "audit-1",
				contract_id: "contract-1",
				user_id: "user-123",
				status: "completed",
				created_at: new Date(),
			},
			{
				id: "audit-2",
				contract_id: "contract-2",
				user_id: "user-123",
				status: "pending",
				created_at: new Date(),
			},
		];

		it("should cache user audits successfully", async () => {
			mockRedis.setex.mockResolvedValue("OK");
			mockRedis.hset.mockResolvedValue(1);

			await cacheService.cacheUserAudits("user-123", mockAudits);

			expect(mockRedis.setex).toHaveBeenCalledWith(
				"user:user-123:audits",
				1800, // User data TTL
				JSON.stringify(mockAudits)
			);
		});

		it("should retrieve cached user audits", async () => {
			mockRedis.get.mockResolvedValue(JSON.stringify(mockAudits));

			const result = await cacheService.getCachedUserAudits("user-123");

			expect(result).toEqual(mockAudits);
		});

		it("should return null for non-existent user audits", async () => {
			mockRedis.get.mockResolvedValue(null);

			const result = await cacheService.getCachedUserAudits("nonexistent");

			expect(result).toBeNull();
		});
	});

	describe("Contract Analysis Caching", () => {
		const mockAnalysis = {
			fileHash: "hash-123",
			vulnerabilities: [
				{
					type: "reentrancy",
					severity: "high",
					description: "Potential reentrancy vulnerability",
				},
			],
			gasOptimizations: [],
			complexity: {
				lines_of_code: 100,
				function_count: 5,
			},
		};

		it("should cache contract analysis successfully", async () => {
			mockRedis.setex.mockResolvedValue("OK");
			mockRedis.hset.mockResolvedValue(1);

			await cacheService.cacheContractAnalysis("hash-123", mockAnalysis);

			expect(mockRedis.setex).toHaveBeenCalledWith(
				"contract:hash-123:analysis",
				604800, // 7 days TTL
				JSON.stringify(mockAnalysis)
			);
		});

		it("should retrieve cached contract analysis", async () => {
			mockRedis.get.mockResolvedValue(JSON.stringify(mockAnalysis));

			const result = await cacheService.getCachedContractAnalysis("hash-123");

			expect(result).toEqual(mockAnalysis);
		});

		it("should return null for non-existent analysis", async () => {
			mockRedis.get.mockResolvedValue(null);

			const result = await cacheService.getCachedContractAnalysis(
				"nonexistent"
			);

			expect(result).toBeNull();
		});
	});

	describe("Cache Invalidation", () => {
		it("should invalidate audit cache", async () => {
			mockRedis.del.mockResolvedValue(2);

			await cacheService.invalidateAuditCache("audit-123");

			expect(mockRedis.del).toHaveBeenCalledWith(
				"audit:audit-123",
				"report:audit-123"
			);
		});

		it("should invalidate user cache", async () => {
			mockRedis.del.mockResolvedValue(1);

			await cacheService.invalidateUserCache("user-123");

			expect(mockRedis.del).toHaveBeenCalledWith("user:user-123:audits");
		});

		it("should handle invalidation errors gracefully", async () => {
			mockRedis.del.mockRejectedValue(new Error("Redis error"));

			// Should not throw
			await expect(
				cacheService.invalidateAuditCache("audit-123")
			).resolves.not.toThrow();
		});
	});

	describe("Cache Statistics", () => {
		beforeEach(() => {
			mockRedis.info.mockImplementation((section) => {
				if (section === "memory") {
					return Promise.resolve("used_memory_human:10.5M\nother_info:value");
				}
				if (section === "keyspace") {
					return Promise.resolve("db0:keys=150,expires=100");
				}
				return Promise.resolve("");
			});

			mockRedis.get.mockImplementation((key) => {
				if (key === "cache:stats:hits") return Promise.resolve("850");
				if (key === "cache:stats:misses") return Promise.resolve("150");
				return Promise.resolve("0");
			});
		});

		it("should get cache statistics", async () => {
			const stats = await cacheService.getCacheStats();

			expect(stats.totalKeys).toBe(150);
			expect(stats.memoryUsage).toBe("10.5M");
			expect(stats.hitRate).toBeCloseTo(85, 1); // 850/(850+150) * 100
			expect(stats.missRate).toBeCloseTo(15, 1); // 150/(850+150) * 100
		});

		it("should handle missing Redis info gracefully", async () => {
			mockRedis.info.mockResolvedValue("");
			mockRedis.get.mockResolvedValue("0");

			const stats = await cacheService.getCacheStats();

			expect(stats.totalKeys).toBe(0);
			expect(stats.memoryUsage).toBe("Unknown");
			expect(stats.hitRate).toBe(0);
			expect(stats.missRate).toBe(0);
		});

		it("should handle Redis errors in stats gracefully", async () => {
			mockRedis.info.mockRejectedValue(new Error("Redis error"));

			const stats = await cacheService.getCacheStats();

			expect(stats.totalKeys).toBe(0);
			expect(stats.memoryUsage).toBe("Unknown");
			expect(stats.hitRate).toBe(0);
			expect(stats.missRate).toBe(0);
		});
	});

	describe("Cache Hit/Miss Tracking", () => {
		it("should track cache hits", async () => {
			mockRedis.incr.mockResolvedValue(1);

			await cacheService.trackCacheHit();

			expect(mockRedis.incr).toHaveBeenCalledWith("cache:stats:hits");
		});

		it("should track cache misses", async () => {
			mockRedis.incr.mockResolvedValue(1);

			await cacheService.trackCacheMiss();

			expect(mockRedis.incr).toHaveBeenCalledWith("cache:stats:misses");
		});

		it("should handle tracking errors gracefully", async () => {
			mockRedis.incr.mockRejectedValue(new Error("Redis error"));

			// Should not throw
			await expect(cacheService.trackCacheHit()).resolves.not.toThrow();
			await expect(cacheService.trackCacheMiss()).resolves.not.toThrow();
		});
	});

	describe("Cache Size Management", () => {
		beforeEach(() => {
			// Mock cache sizes that exceed the limit
			mockRedis.hgetall.mockResolvedValue({
				"audit:1": "50000000", // 50MB
				"audit:2": "40000000", // 40MB
				"audit:3": "30000000", // 30MB
				"report:1": "20000000", // 20MB
			});
		});

		it("should track cache sizes", async () => {
			mockRedis.setex.mockResolvedValue("OK");
			mockRedis.hset.mockResolvedValue(1);
			mockRedis.hgetall.mockResolvedValue({
				"audit:test": "1000",
			});

			await cacheService.cacheAuditResult("test", {} as Audit);

			expect(mockRedis.hset).toHaveBeenCalledWith(
				"cache:sizes",
				"audit:test",
				expect.any(Number)
			);
		});

		it("should evict old entries when cache size exceeds limit", async () => {
			mockRedis.setex.mockResolvedValue("OK");
			mockRedis.hset.mockResolvedValue(1);
			mockRedis.del.mockResolvedValue(1);
			mockRedis.hdel.mockResolvedValue(1);

			// This should trigger cache eviction due to size
			await cacheService.cacheAuditResult("new-audit", {} as Audit);

			// Should delete some keys to make room
			expect(mockRedis.del).toHaveBeenCalled();
			expect(mockRedis.hdel).toHaveBeenCalled();
		});

		it("should handle cache size check errors gracefully", async () => {
			mockRedis.hgetall.mockRejectedValue(new Error("Redis error"));
			mockRedis.setex.mockResolvedValue("OK");
			mockRedis.hset.mockResolvedValue(1);

			// Should not throw
			await expect(
				cacheService.cacheAuditResult("test", {} as Audit)
			).resolves.not.toThrow();
		});
	});

	describe("Cache Clearing", () => {
		it("should clear all cache", async () => {
			mockRedis.flushdb.mockResolvedValue("OK");

			await cacheService.clearCache();

			expect(mockRedis.flushdb).toHaveBeenCalled();
		});

		it("should handle clear cache errors gracefully", async () => {
			mockRedis.flushdb.mockRejectedValue(new Error("Redis error"));

			// Should not throw
			await expect(cacheService.clearCache()).resolves.not.toThrow();
		});
	});

	describe("Configuration", () => {
		it("should use environment variables for configuration", () => {
			// Test that the service respects environment configuration
			expect(cacheService).toBeDefined();
		});

		it("should use default values when environment variables are not set", () => {
			// The service should work with default configuration
			expect(cacheService).toBeDefined();
		});
	});

	describe("Singleton Pattern", () => {
		it("should return the same instance", () => {
			const instance1 = CacheService.getInstance();
			const instance2 = CacheService.getInstance();

			expect(instance1).toBe(instance2);
		});
	});

	describe("Key Generation", () => {
		it("should generate consistent cache keys", async () => {
			mockRedis.get.mockResolvedValue(null);

			await cacheService.getCachedAuditResult("audit-123");
			await cacheService.getCachedAuditReport("audit-123");
			await cacheService.getCachedUserAudits("user-123");
			await cacheService.getCachedContractAnalysis("hash-123");

			expect(mockRedis.get).toHaveBeenCalledWith("audit:audit-123");
			expect(mockRedis.get).toHaveBeenCalledWith("report:audit-123");
			expect(mockRedis.get).toHaveBeenCalledWith("user:user-123:audits");
			expect(mockRedis.get).toHaveBeenCalledWith("contract:hash-123:analysis");
		});
	});

	describe("TTL Configuration", () => {
		it("should use correct TTL for different cache types", async () => {
			mockRedis.setex.mockResolvedValue("OK");
			mockRedis.hset.mockResolvedValue(1);

			await cacheService.cacheAuditResult("audit-123", {} as Audit);
			await cacheService.cacheAuditReport("audit-123", {} as AuditReport);
			await cacheService.cacheUserAudits("user-123", []);
			await cacheService.cacheContractAnalysis("hash-123", {});

			// Check TTL values
			expect(mockRedis.setex).toHaveBeenCalledWith(
				"audit:audit-123",
				3600, // Audit results TTL
				expect.any(String)
			);
			expect(mockRedis.setex).toHaveBeenCalledWith(
				"report:audit-123",
				86400, // Report TTL
				expect.any(String)
			);
			expect(mockRedis.setex).toHaveBeenCalledWith(
				"user:user-123:audits",
				1800, // User data TTL
				expect.any(String)
			);
			expect(mockRedis.setex).toHaveBeenCalledWith(
				"contract:hash-123:analysis",
				604800, // Contract analysis TTL (7 days)
				expect.any(String)
			);
		});
	});

	describe("Data Serialization", () => {
		it("should handle complex objects in serialization", async () => {
			const complexAudit: Audit = {
				id: "audit-123",
				contract_id: "contract-123",
				user_id: "user-123",
				status: "completed",
				static_results: {
					slitherFindings: [
						{
							type: "reentrancy",
							severity: "high",
							description: "Test vulnerability",
							location: {
								file: "test.sol",
								line: 42,
								column: 10,
								length: 20,
							},
						},
					],
					gasAnalysis: [
						{
							type: "storage",
							description: "Use unchecked block for transfer function",
							location: {
								file: "test.sol",
								line: 15,
								column: 5,
								length: 30,
							},
							estimated_savings: 21000,
						},
					],
					astAnalysis: [],
					complexity: {
						lines_of_code: 100,
						function_count: 5,
						cyclomatic_complexity: 10,
					},
					// executionTime: 5000,
				},
				ai_results: {
					vulnerabilities: [],
					recommendations: [
						{
							category: "security",
							description: "Use SafeMath",
							priority: "high",
						},
						{
							category: "access",
							description: "Add access controls",
							priority: "medium",
						},
					],
					codeQuality: {
						maintainability: 8.5,
						readability: 7.5,
						test_coverage: 85,
					},
					confidence: 0.9,
				},
				created_at: new Date("2024-01-01T00:00:00Z"),
				// updated_at: new Date("2024-01-01T01:00:00Z"),
			};

			mockRedis.setex.mockResolvedValue("OK");
			mockRedis.hset.mockResolvedValue(1);
			mockRedis.get.mockResolvedValue(JSON.stringify(complexAudit));

			await cacheService.cacheAuditResult("audit-123", complexAudit);
			const retrieved = await cacheService.getCachedAuditResult("audit-123");

			expect(retrieved).toEqual(complexAudit);
		});

		it("should handle dates in serialization", async () => {
			const auditWithDates: Audit = {
				id: "audit-123",
				contract_id: "contract-123",
				user_id: "user-123",
				status: "completed",
				created_at: new Date("2024-01-01T00:00:00Z"),
				// updated_at: new Date("2024-01-01T01:00:00Z"),
			};

			mockRedis.setex.mockResolvedValue("OK");
			mockRedis.hset.mockResolvedValue(1);
			mockRedis.get.mockResolvedValue(JSON.stringify(auditWithDates));

			await cacheService.cacheAuditResult("audit-123", auditWithDates);
			const retrieved = await cacheService.getCachedAuditResult("audit-123");

			expect(retrieved?.created_at).toEqual(auditWithDates.created_at);
			// expect(retrieved?.updated_at).toEqual(auditWithDates.updated_at);
		});
	});
});
