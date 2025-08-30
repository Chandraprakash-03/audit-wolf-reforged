import request from "supertest";
import { app } from "../index";
import { performanceMonitoringService } from "../services/PerformanceMonitoringService";
import { cacheService } from "../services/CacheService";
import { dbOptimizationService } from "../services/DatabaseOptimizationService";

describe("Performance Tests", () => {
	beforeAll(async () => {
		// Clear metrics before tests
		performanceMonitoringService.clearMetrics();
		await cacheService.clearCache();
	});

	afterAll(async () => {
		// Clean up after tests
		performanceMonitoringService.stopMonitoring();
	});

	describe("Concurrent Audit Processing", () => {
		const testContract = `
      pragma solidity ^0.8.0;
      contract TestContract {
        mapping(address => uint256) public balances;
        
        function deposit() public payable {
          balances[msg.sender] += msg.value;
        }
        
        function withdraw(uint256 amount) public {
          require(balances[msg.sender] >= amount, "Insufficient balance");
          balances[msg.sender] -= amount;
          payable(msg.sender).transfer(amount);
        }
      }
    `;

		test("should handle 10 concurrent audit requests", async () => {
			const concurrentRequests = 10;
			const promises: Promise<any>[] = [];

			// Create concurrent audit requests
			for (let i = 0; i < concurrentRequests; i++) {
				const promise = request(app)
					.post("/api/audits/start")
					.send({
						contractCode: testContract,
						contractName: `TestContract_${i}`,
					})
					.expect(200);

				promises.push(promise);
			}

			const startTime = Date.now();
			const results = await Promise.all(promises);
			const totalTime = Date.now() - startTime;

			// Verify all requests succeeded
			results.forEach((result, index) => {
				expect(result.body).toHaveProperty("auditId");
				expect(result.body.status).toBe("pending");
			});

			// Performance assertions
			expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
			console.log(`10 concurrent audits completed in ${totalTime}ms`);

			// Check system metrics
			const systemMetrics =
				await performanceMonitoringService.getSystemMetrics();
			expect(systemMetrics.memoryUsage.percentage).toBeLessThan(90); // Memory usage should be reasonable
			expect(systemMetrics.responseTime.avg).toBeLessThan(5000); // Average response time should be reasonable
		}, 60000);

		test("should handle 50 concurrent audit requests with queue", async () => {
			const concurrentRequests = 50;
			const promises: Promise<any>[] = [];

			// Create concurrent audit requests
			for (let i = 0; i < concurrentRequests; i++) {
				const promise = request(app)
					.post("/api/audits/start")
					.send({
						contractCode: testContract,
						contractName: `LoadTestContract_${i}`,
					});

				promises.push(promise);
			}

			const startTime = Date.now();
			const results = await Promise.allSettled(promises);
			const totalTime = Date.now() - startTime;

			// Count successful requests
			const successfulRequests = results.filter(
				(result) => result.status === "fulfilled" && result.value.status === 200
			).length;

			// Should handle at least 80% of requests successfully
			expect(successfulRequests).toBeGreaterThan(concurrentRequests * 0.8);

			console.log(
				`${successfulRequests}/${concurrentRequests} requests succeeded in ${totalTime}ms`
			);

			// Check that queue is handling the load
			const systemMetrics =
				await performanceMonitoringService.getSystemMetrics();
			expect(systemMetrics.errorRate).toBeLessThan(20); // Error rate should be reasonable
		}, 120000);
	});

	describe("Database Performance", () => {
		test("should optimize database queries", async () => {
			// Create indexes
			await dbOptimizationService.createOptimizedIndexes();

			// Test optimized user audits query
			const userId = "test-user-id";
			const result = await dbOptimizationService.getUserAuditsOptimized(
				userId,
				20,
				0
			);

			expect(result.metrics.queryTime).toBeLessThan(1000); // Should complete within 1 second
			expect(result.metrics.indexesUsed).toContain(
				"idx_audits_user_id_created_at"
			);

			console.log(
				`Optimized user audits query completed in ${result.metrics.queryTime}ms`
			);
		});

		test("should perform efficient contract search", async () => {
			const userId = "test-user-id";
			const searchTerm = "Test";

			const result = await dbOptimizationService.searchContractsOptimized(
				userId,
				searchTerm,
				10
			);

			expect(result.metrics.queryTime).toBeLessThan(500); // Should complete within 500ms
			expect(result.metrics.indexesUsed).toContain("idx_contracts_user_name");

			console.log(`Contract search completed in ${result.metrics.queryTime}ms`);
		});

		test("should generate vulnerability stats efficiently", async () => {
			const userId = "test-user-id";
			const timeRange = {
				start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
				end: new Date(),
			};

			const result = await dbOptimizationService.getVulnerabilityStatsOptimized(
				userId,
				timeRange
			);

			expect(result.metrics.queryTime).toBeLessThan(2000); // Should complete within 2 seconds
			expect(result.data).toHaveProperty("bySeverity");
			expect(result.data).toHaveProperty("byType");
			expect(result.data).toHaveProperty("total");

			console.log(
				`Vulnerability stats query completed in ${result.metrics.queryTime}ms`
			);
		});
	});

	describe("Cache Performance", () => {
		test("should improve response times with caching", async () => {
			const testData = { test: "data", timestamp: Date.now() };
			const cacheKey = "test-audit-result";

			// First request - cache miss
			const startTime1 = Date.now();
			await cacheService.cacheAuditResult(cacheKey, testData as any);
			const cacheTime = Date.now() - startTime1;

			// Second request - cache hit
			const startTime2 = Date.now();
			const cachedResult = await cacheService.getCachedAuditResult(cacheKey);
			const retrieveTime = Date.now() - startTime2;

			expect(cachedResult).toEqual(testData);
			expect(retrieveTime).toBeLessThan(cacheTime); // Cache retrieval should be faster
			expect(retrieveTime).toBeLessThan(50); // Should be very fast

			console.log(
				`Cache store: ${cacheTime}ms, Cache retrieve: ${retrieveTime}ms`
			);
		});

		test("should handle cache invalidation correctly", async () => {
			const auditId = "test-audit-id";
			const testData = { id: auditId, status: "completed" };

			// Cache the data
			await cacheService.cacheAuditResult(auditId, testData as any);

			// Verify it's cached
			let cachedResult = await cacheService.getCachedAuditResult(auditId);
			expect(cachedResult).toEqual(testData);

			// Invalidate cache
			await cacheService.invalidateAuditCache(auditId);

			// Verify it's no longer cached
			cachedResult = await cacheService.getCachedAuditResult(auditId);
			expect(cachedResult).toBeNull();
		});

		test("should provide accurate cache statistics", async () => {
			// Clear cache first
			await cacheService.clearCache();

			// Add some test data
			await cacheService.cacheAuditResult("audit1", { id: "audit1" } as any);
			await cacheService.cacheAuditResult("audit2", { id: "audit2" } as any);
			await cacheService.cacheAuditReport("audit1", {
				id: "audit1",
				report: "test",
			} as any);

			// Get cache stats
			const stats = await cacheService.getCacheStats();

			expect(stats.totalKeys).toBeGreaterThan(0);
			expect(stats.memoryUsage).toBeDefined();
			expect(typeof stats.hitRate).toBe("number");
			expect(typeof stats.missRate).toBe("number");

			console.log("Cache stats:", stats);
		});
	});

	describe("API Response Times", () => {
		test("should maintain fast response times under load", async () => {
			const endpoint = "/api/user/profile";
			const concurrentRequests = 20;
			const promises: Promise<any>[] = [];

			// Create concurrent requests
			for (let i = 0; i < concurrentRequests; i++) {
				const promise = request(app).get(endpoint).expect(200);

				promises.push(promise);
			}

			const startTime = Date.now();
			const results = await Promise.all(promises);
			const totalTime = Date.now() - startTime;
			const avgResponseTime = totalTime / concurrentRequests;

			// All requests should succeed
			expect(results).toHaveLength(concurrentRequests);

			// Average response time should be reasonable
			expect(avgResponseTime).toBeLessThan(1000); // Less than 1 second average

			console.log(
				`${concurrentRequests} concurrent requests completed in ${totalTime}ms (avg: ${avgResponseTime}ms)`
			);
		});

		test("should handle rate limiting correctly", async () => {
			const endpoint = "/api/audits/start";
			const rapidRequests = 150; // Exceed rate limit
			const promises: Promise<any>[] = [];

			// Create rapid requests
			for (let i = 0; i < rapidRequests; i++) {
				const promise = request(app)
					.post(endpoint)
					.send({
						contractCode: "contract Test {}",
						contractName: `RateLimitTest_${i}`,
					});

				promises.push(promise);
			}

			const results = await Promise.allSettled(promises);

			// Count different response types
			const successful = results.filter(
				(r) => r.status === "fulfilled" && r.value.status === 200
			).length;

			const rateLimited = results.filter(
				(r) => r.status === "fulfilled" && r.value.status === 429
			).length;

			// Should have some rate limited responses
			expect(rateLimited).toBeGreaterThan(0);
			expect(successful + rateLimited).toBe(rapidRequests);

			console.log(
				`Rate limiting test: ${successful} successful, ${rateLimited} rate limited`
			);
		});
	});

	describe("Memory Usage", () => {
		test("should not have memory leaks during processing", async () => {
			const initialMemory = process.memoryUsage();

			// Perform multiple operations
			for (let i = 0; i < 10; i++) {
				await cacheService.cacheAuditResult(`test-${i}`, {
					id: `test-${i}`,
				} as any);
				await performanceMonitoringService.recordMetric(
					"test.metric",
					Math.random() * 100
				);
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}

			const finalMemory = process.memoryUsage();
			const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
			const memoryIncreasePercent =
				(memoryIncrease / initialMemory.heapUsed) * 100;

			// Memory increase should be reasonable (less than 50% increase)
			expect(memoryIncreasePercent).toBeLessThan(50);

			console.log(
				`Memory usage: ${Math.round(
					memoryIncreasePercent
				)}% increase (${Math.round(memoryIncrease / 1024 / 1024)}MB)`
			);
		});
	});

	describe("Performance Monitoring", () => {
		test("should track performance metrics correctly", async () => {
			// Record some test metrics
			performanceMonitoringService.recordResponseTime(100, "GET /test");
			performanceMonitoringService.recordResponseTime(200, "GET /test");
			performanceMonitoringService.recordResponseTime(150, "GET /test");

			// Start and complete audit tracking
			const auditId = "perf-test-audit";
			performanceMonitoringService.startAuditTracking(auditId);
			performanceMonitoringService.recordSlitherTime(auditId, 5000);
			performanceMonitoringService.recordAIAnalysisTime(auditId, 10000);
			performanceMonitoringService.recordReportGenerationTime(auditId, 2000);
			const auditMetrics =
				performanceMonitoringService.completeAuditTracking(auditId);

			expect(auditMetrics).toBeDefined();
			expect(auditMetrics!.slitherTime).toBe(5000);
			expect(auditMetrics!.aiAnalysisTime).toBe(10000);
			expect(auditMetrics!.reportGenerationTime).toBe(2000);
			expect(auditMetrics!.totalTime).toBeGreaterThan(0);

			// Get system metrics
			const systemMetrics =
				await performanceMonitoringService.getSystemMetrics();
			expect(systemMetrics).toHaveProperty("cpuUsage");
			expect(systemMetrics).toHaveProperty("memoryUsage");
			expect(systemMetrics).toHaveProperty("responseTime");
			expect(systemMetrics).toHaveProperty("throughput");

			console.log("System metrics:", systemMetrics);
		});

		test("should provide audit performance summary", async () => {
			// Record multiple audit metrics
			for (let i = 0; i < 5; i++) {
				performanceMonitoringService.recordMetric(
					"audit.total_time",
					15000 + i * 1000
				);
				performanceMonitoringService.recordMetric(
					"audit.slither_time",
					5000 + i * 200
				);
				performanceMonitoringService.recordMetric(
					"audit.ai_analysis_time",
					8000 + i * 500
				);
			}

			const summary = performanceMonitoringService.getAuditPerformanceSummary();

			expect(summary.totalAudits).toBe(5);
			expect(summary.avgTotalTime).toBeGreaterThan(0);
			expect(summary.avgSlitherTime).toBeGreaterThan(0);
			expect(summary.avgAITime).toBeGreaterThan(0);

			console.log("Audit performance summary:", summary);
		});
	});
});
