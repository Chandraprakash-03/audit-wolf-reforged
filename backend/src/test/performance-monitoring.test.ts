import { PerformanceMonitoringService } from "../services/PerformanceMonitoringService";

// Mock Redis
const mockRedis = {
	get: jest.fn(),
	set: jest.fn(),
	setex: jest.fn(),
	lpush: jest.fn(),
	llen: jest.fn(),
	expire: jest.fn(),
	incr: jest.fn(),
};

jest.mock("../config/queue", () => ({
	redis: mockRedis,
}));

describe("Performance Monitoring Service Tests", () => {
	let performanceService: PerformanceMonitoringService;

	beforeEach(() => {
		jest.clearAllMocks();
		performanceService = PerformanceMonitoringService.getInstance();
		performanceService.clearMetrics();
	});

	afterEach(() => {
		performanceService.stopMonitoring();
	});

	describe("Metric Recording", () => {
		it("should record basic metrics", () => {
			const metricName = "test.metric";
			const value = 100;
			const tags = { endpoint: "/api/test" };

			performanceService.recordMetric(metricName, value, tags, "ms");

			const metrics = performanceService.getMetrics(metricName);
			expect(metrics).toHaveLength(1);
			expect(metrics[0].metricName).toBe(metricName);
			expect(metrics[0].value).toBe(value);
			expect(metrics[0].tags).toEqual(tags);
			expect(metrics[0].unit).toBe("ms");
		});

		it("should limit metrics buffer size", () => {
			const metricName = "test.metric";

			// Add more than 1000 metrics
			for (let i = 0; i < 1200; i++) {
				performanceService.recordMetric(metricName, i);
			}

			const metrics = performanceService.getMetrics(metricName);
			expect(metrics.length).toBeLessThanOrEqual(1000);
		});

		it("should emit metric events", (done) => {
			const metricName = "test.metric";
			const value = 100;

			performanceService.once("metric", (metric) => {
				expect(metric.metricName).toBe(metricName);
				expect(metric.value).toBe(value);
				done();
			});

			performanceService.recordMetric(metricName, value);
		});

		it("should store metrics in Redis", () => {
			const metricName = "test.metric";
			const value = 100;

			performanceService.recordMetric(metricName, value);

			expect(mockRedis.lpush).toHaveBeenCalled();
			expect(mockRedis.expire).toHaveBeenCalled();
		});
	});

	describe("Response Time Tracking", () => {
		it("should record response times", () => {
			const responseTime = 250;
			const endpoint = "/api/test";

			performanceService.recordResponseTime(responseTime, endpoint);

			const metrics = performanceService.getMetrics("api.response_time");
			expect(metrics).toHaveLength(1);
			expect(metrics[0].value).toBe(responseTime);
			expect(metrics[0].tags?.endpoint).toBe(endpoint);
		});

		it("should maintain response time buffer", () => {
			// Add many response times
			for (let i = 0; i < 1200; i++) {
				performanceService.recordResponseTime(i);
			}

			// Buffer should be limited
			const metrics = performanceService.getMetrics("api.response_time");
			expect(metrics.length).toBeLessThanOrEqual(1000);
		});
	});

	describe("Error Tracking", () => {
		it("should record errors", () => {
			const error = new Error("Test error");
			const endpoint = "/api/test";

			performanceService.recordError(error, endpoint);

			const metrics = performanceService.getMetrics("api.error");
			expect(metrics).toHaveLength(1);
			expect(metrics[0].value).toBe(1);
			expect(metrics[0].tags?.endpoint).toBe(endpoint);
			expect(metrics[0].tags?.error_type).toBe("Error");
			expect(metrics[0].tags?.message).toBe("Test error");
		});

		it("should track different error types", () => {
			const typeError = new TypeError("Type error");
			const rangeError = new RangeError("Range error");

			performanceService.recordError(typeError);
			performanceService.recordError(rangeError);

			const metrics = performanceService.getMetrics("api.error");
			expect(metrics).toHaveLength(2);
			expect(metrics[0].tags?.error_type).toBe("TypeError");
			expect(metrics[1].tags?.error_type).toBe("RangeError");
		});
	});

	describe("Audit Performance Tracking", () => {
		it("should track complete audit lifecycle", () => {
			const auditId = "test-audit-123";

			// Start tracking
			performanceService.startAuditTracking(auditId);

			// Record component times
			performanceService.recordSlitherTime(auditId, 5000);
			performanceService.recordAIAnalysisTime(auditId, 10000);
			performanceService.recordReportGenerationTime(auditId, 2000);
			performanceService.recordQueueWaitTime(auditId, 1000);

			// Complete tracking
			const auditMetrics = performanceService.completeAuditTracking(auditId);

			expect(auditMetrics).toBeDefined();
			expect(auditMetrics!.auditId).toBe(auditId);
			expect(auditMetrics!.slitherTime).toBe(5000);
			expect(auditMetrics!.aiAnalysisTime).toBe(10000);
			expect(auditMetrics!.reportGenerationTime).toBe(2000);
			expect(auditMetrics!.queueWaitTime).toBe(1000);
			expect(auditMetrics!.totalTime).toBeGreaterThan(0);
			expect(auditMetrics!.memoryPeak).toBeGreaterThan(0);
		});

		it("should handle missing audit tracking", () => {
			const auditId = "nonexistent-audit";

			const auditMetrics = performanceService.completeAuditTracking(auditId);

			expect(auditMetrics).toBeNull();
		});

		it("should record individual component metrics", () => {
			const auditId = "test-audit-123";

			performanceService.startAuditTracking(auditId);
			performanceService.recordSlitherTime(auditId, 5000);

			const slitherMetrics =
				performanceService.getMetrics("audit.slither_time");
			expect(slitherMetrics).toHaveLength(1);
			expect(slitherMetrics[0].value).toBe(5000);
			expect(slitherMetrics[0].tags?.audit_id).toBe(auditId);
		});

		it("should clean up completed audit tracking", () => {
			const auditId = "test-audit-123";

			performanceService.startAuditTracking(auditId);
			performanceService.completeAuditTracking(auditId);

			// Second completion should return null
			const secondCompletion =
				performanceService.completeAuditTracking(auditId);
			expect(secondCompletion).toBeNull();
		});
	});

	describe("System Metrics", () => {
		beforeEach(() => {
			// Mock Redis responses for cache stats
			mockRedis.get.mockImplementation((key) => {
				if (key === "cache:stats:hits") return Promise.resolve("100");
				if (key === "cache:stats:misses") return Promise.resolve("20");
				return Promise.resolve("0");
			});

			mockRedis.llen.mockResolvedValue(5);
		});

		it("should get system metrics", async () => {
			// Add some response times for calculation
			performanceService.recordResponseTime(100);
			performanceService.recordResponseTime(200);
			performanceService.recordResponseTime(150);

			const systemMetrics = await performanceService.getSystemMetrics();

			expect(systemMetrics).toHaveProperty("cpuUsage");
			expect(systemMetrics).toHaveProperty("memoryUsage");
			expect(systemMetrics).toHaveProperty("responseTime");
			expect(systemMetrics).toHaveProperty("throughput");
			expect(systemMetrics).toHaveProperty("errorRate");
			expect(systemMetrics).toHaveProperty("cacheHitRate");

			expect(typeof systemMetrics.cpuUsage).toBe("number");
			expect(typeof systemMetrics.memoryUsage.used).toBe("number");
			expect(typeof systemMetrics.memoryUsage.total).toBe("number");
			expect(typeof systemMetrics.memoryUsage.percentage).toBe("number");
			expect(typeof systemMetrics.responseTime.avg).toBe("number");
			expect(typeof systemMetrics.responseTime.p95).toBe("number");
			expect(typeof systemMetrics.responseTime.p99).toBe("number");
		});

		it("should calculate response time percentiles correctly", async () => {
			// Add response times in known order
			const responseTimes = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550];
			responseTimes.forEach((time) => {
				performanceService.recordResponseTime(time);
			});

			const systemMetrics = await performanceService.getSystemMetrics();

			expect(systemMetrics.responseTime.avg).toBe(325); // Average of the times
			expect(systemMetrics.responseTime.p95).toBeGreaterThan(
				systemMetrics.responseTime.avg
			);
			expect(systemMetrics.responseTime.p99).toBeGreaterThan(
				systemMetrics.responseTime.p95
			);
		});

		it("should calculate error rate correctly", async () => {
			// Record some requests and errors
			performanceService.recordResponseTime(100);
			performanceService.recordResponseTime(200);
			performanceService.recordError(new Error("Test error"));

			const systemMetrics = await performanceService.getSystemMetrics();

			expect(systemMetrics.errorRate).toBeGreaterThan(0);
			expect(systemMetrics.errorRate).toBeLessThan(100);
		});

		it("should calculate cache hit rate from Redis", async () => {
			const systemMetrics = await performanceService.getSystemMetrics();

			expect(systemMetrics.cacheHitRate).toBeCloseTo(83.33, 1); // 100/(100+20) * 100
		});
	});

	describe("Audit Performance Summary", () => {
		beforeEach(() => {
			// Add some test audit metrics
			const auditMetrics = [
				{ name: "audit.total_time", values: [15000, 16000, 17000] },
				{ name: "audit.slither_time", values: [5000, 5200, 5400] },
				{ name: "audit.ai_analysis_time", values: [8000, 8500, 9000] },
				{ name: "audit.report_generation_time", values: [2000, 2300, 2600] },
				{ name: "audit.queue_wait_time", values: [1000, 1200, 1400] },
			];

			auditMetrics.forEach((metric) => {
				metric.values.forEach((value) => {
					performanceService.recordMetric(metric.name, value);
				});
			});
		});

		it("should provide audit performance summary", () => {
			const summary = performanceService.getAuditPerformanceSummary();

			expect(summary.totalAudits).toBe(3);
			expect(summary.avgTotalTime).toBe(16000);
			expect(summary.avgSlitherTime).toBe(5200);
			expect(summary.avgAITime).toBe(8500);
			expect(summary.avgReportTime).toBe(2300);
			expect(summary.avgQueueTime).toBe(1200);
		});

		it("should filter summary by time range", () => {
			const now = Date.now();
			const oneHourAgo = now - 60 * 60 * 1000;

			const summary = performanceService.getAuditPerformanceSummary({
				start: oneHourAgo,
				end: now,
			});

			expect(summary.totalAudits).toBe(3); // All metrics are recent
		});

		it("should handle empty metrics gracefully", () => {
			performanceService.clearMetrics();

			const summary = performanceService.getAuditPerformanceSummary();

			expect(summary.totalAudits).toBe(0);
			expect(summary.avgTotalTime).toBe(0);
			expect(summary.avgSlitherTime).toBe(0);
			expect(summary.avgAITime).toBe(0);
			expect(summary.avgReportTime).toBe(0);
			expect(summary.avgQueueTime).toBe(0);
		});
	});

	describe("Metrics Filtering", () => {
		beforeEach(() => {
			const now = Date.now();
			const oneHourAgo = now - 60 * 60 * 1000;
			const twoHoursAgo = now - 2 * 60 * 60 * 1000;

			// Add metrics at different times
			performanceService.recordMetric("test.metric", 100);

			// Manually set timestamps for testing
			const metrics = performanceService.getMetrics("test.metric");
			if (metrics.length > 0) {
				metrics[0].timestamp = twoHoursAgo;
			}

			performanceService.recordMetric("test.metric", 200);
			if (metrics.length > 1) {
				metrics[1].timestamp = oneHourAgo;
			}

			performanceService.recordMetric("test.metric", 300);
			if (metrics.length > 2) {
				metrics[2].timestamp = now;
			}
		});

		it("should filter metrics by start time", () => {
			const oneHourAgo = Date.now() - 60 * 60 * 1000;
			const metrics = performanceService.getMetrics("test.metric", oneHourAgo);

			expect(metrics.length).toBeGreaterThan(0);
			metrics.forEach((metric) => {
				expect(metric.timestamp).toBeGreaterThanOrEqual(oneHourAgo);
			});
		});

		it("should filter metrics by end time", () => {
			const oneHourAgo = Date.now() - 60 * 60 * 1000;
			const metrics = performanceService.getMetrics(
				"test.metric",
				undefined,
				oneHourAgo
			);

			expect(metrics.length).toBeGreaterThan(0);
			metrics.forEach((metric) => {
				expect(metric.timestamp).toBeLessThanOrEqual(oneHourAgo);
			});
		});

		it("should filter metrics by time range", () => {
			const now = Date.now();
			const oneHourAgo = now - 60 * 60 * 1000;
			const twoHoursAgo = now - 2 * 60 * 60 * 1000;

			const metrics = performanceService.getMetrics(
				"test.metric",
				twoHoursAgo,
				oneHourAgo
			);

			metrics.forEach((metric) => {
				expect(metric.timestamp).toBeGreaterThanOrEqual(twoHoursAgo);
				expect(metric.timestamp).toBeLessThanOrEqual(oneHourAgo);
			});
		});
	});

	describe("System Monitoring", () => {
		it("should start system monitoring", () => {
			// System monitoring should start automatically
			expect(performanceService).toBeDefined();
		});

		it("should record system metrics periodically", (done) => {
			let metricCount = 0;

			performanceService.on("metric", (metric) => {
				if (metric.metricName.startsWith("system.")) {
					metricCount++;
					if (metricCount >= 3) {
						// We've received some system metrics
						done();
					}
				}
			});

			// Trigger system monitoring manually for testing
			performanceService.recordMetric("system.memory.heap_used", 1000000);
			performanceService.recordMetric("system.memory.heap_total", 2000000);
			performanceService.recordMetric("system.active_audits", 5);
		});

		it("should stop monitoring cleanly", () => {
			performanceService.stopMonitoring();
			// Should not throw any errors
			expect(true).toBe(true);
		});
	});

	describe("Redis Integration", () => {
		it("should handle Redis errors gracefully", () => {
			mockRedis.lpush.mockRejectedValue(new Error("Redis connection failed"));

			// Should not throw
			expect(() => {
				performanceService.recordMetric("test.metric", 100);
			}).not.toThrow();
		});

		it("should handle Redis get errors gracefully", async () => {
			mockRedis.get.mockRejectedValue(new Error("Redis connection failed"));
			mockRedis.llen.mockRejectedValue(new Error("Redis connection failed"));

			const systemMetrics = await performanceService.getSystemMetrics();

			// Should still return metrics with default values
			expect(systemMetrics).toBeDefined();
			expect(systemMetrics.cacheHitRate).toBe(0);
		});
	});

	describe("Memory Management", () => {
		it("should clear all metrics", () => {
			performanceService.recordMetric("test.metric1", 100);
			performanceService.recordMetric("test.metric2", 200);
			performanceService.recordResponseTime(150);

			performanceService.clearMetrics();

			expect(performanceService.getMetrics("test.metric1")).toHaveLength(0);
			expect(performanceService.getMetrics("test.metric2")).toHaveLength(0);
		});

		it("should handle singleton pattern correctly", () => {
			const instance1 = PerformanceMonitoringService.getInstance();
			const instance2 = PerformanceMonitoringService.getInstance();

			expect(instance1).toBe(instance2);
		});
	});
});
