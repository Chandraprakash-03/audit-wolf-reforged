import express from "express";
import { performanceMonitoringService } from "../services/PerformanceMonitoringService";
import { cacheService } from "../services/CacheService";
import { dbOptimizationService } from "../services/DatabaseOptimizationService";
import { cdnService } from "../services/CDNService";
import { authenticateToken } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";

const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(authenticateToken);
router.use(adminMiddleware);

/**
 * Get system performance metrics
 */
router.get("/metrics/system", async (req, res) => {
	try {
		const systemMetrics = await performanceMonitoringService.getSystemMetrics();
		res.json(systemMetrics);
	} catch (error) {
		console.error("Error getting system metrics:", error);
		res.status(500).json({ error: "Failed to get system metrics" });
	}
});

/**
 * Get audit performance metrics
 */
router.get("/metrics/audits", async (req, res) => {
	try {
		const { start, end } = req.query;

		let timeRange;
		if (start && end) {
			timeRange = {
				start: parseInt(start as string),
				end: parseInt(end as string),
			};
		}

		const auditMetrics =
			performanceMonitoringService.getAuditPerformanceSummary(timeRange);
		res.json(auditMetrics);
	} catch (error) {
		console.error("Error getting audit metrics:", error);
		res.status(500).json({ error: "Failed to get audit metrics" });
	}
});

/**
 * Get cache statistics
 */
router.get("/metrics/cache", async (req, res) => {
	try {
		const cacheStats = await cacheService.getCacheStats();
		res.json(cacheStats);
	} catch (error) {
		console.error("Error getting cache stats:", error);
		res.status(500).json({ error: "Failed to get cache statistics" });
	}
});

/**
 * Get database performance analytics
 */
router.get("/metrics/database", async (req, res) => {
	try {
		const dbAnalytics = dbOptimizationService.getQueryAnalytics();
		res.json(dbAnalytics);
	} catch (error) {
		console.error("Error getting database analytics:", error);
		res.status(500).json({ error: "Failed to get database analytics" });
	}
});

/**
 * Get CDN statistics
 */
router.get("/metrics/cdn", async (req, res) => {
	try {
		const cdnStats = cdnService.getCacheStats();
		res.json(cdnStats);
	} catch (error) {
		console.error("Error getting CDN stats:", error);
		res.status(500).json({ error: "Failed to get CDN statistics" });
	}
});

/**
 * Get detailed performance metrics for a specific time range
 */
router.get("/metrics/detailed", async (req, res) => {
	try {
		const { metricName, start, end } = req.query;

		if (!metricName) {
			return res.status(400).json({ error: "metricName is required" });
		}

		const startTime = start ? parseInt(start as string) : undefined;
		const endTime = end ? parseInt(end as string) : undefined;

		const metrics = performanceMonitoringService.getMetrics(
			metricName as string,
			startTime,
			endTime
		);

		res.json(metrics);
	} catch (error) {
		console.error("Error getting detailed metrics:", error);
		res.status(500).json({ error: "Failed to get detailed metrics" });
	}
	return () => {};
});

/**
 * Clear performance metrics
 */
router.delete("/metrics/clear", async (req, res) => {
	try {
		performanceMonitoringService.clearMetrics();
		dbOptimizationService.clearQueryMetrics();

		res.json({ message: "Performance metrics cleared successfully" });
	} catch (error) {
		console.error("Error clearing metrics:", error);
		res.status(500).json({ error: "Failed to clear metrics" });
	}
});

/**
 * Clear cache
 */
router.delete("/cache/clear", async (req, res) => {
	try {
		await cacheService.clearCache();
		res.json({ message: "Cache cleared successfully" });
	} catch (error) {
		console.error("Error clearing cache:", error);
		res.status(500).json({ error: "Failed to clear cache" });
	}
});

/**
 * Invalidate specific cache entries
 */
router.delete("/cache/invalidate/:type/:id", async (req, res) => {
	try {
		const { type, id } = req.params;

		switch (type) {
			case "audit":
				await cacheService.invalidateAuditCache(id);
				break;
			case "user":
				await cacheService.invalidateUserCache(id);
				break;
			default:
				return res.status(400).json({ error: "Invalid cache type" });
		}

		res.json({ message: `${type} cache invalidated for ID: ${id}` });
	} catch (error) {
		console.error("Error invalidating cache:", error);
		res.status(500).json({ error: "Failed to invalidate cache" });
	}
	return () => {};
});

/**
 * Create database indexes
 */
router.post("/database/optimize", async (req, res) => {
	try {
		await dbOptimizationService.createOptimizedIndexes();
		res.json({ message: "Database indexes created successfully" });
	} catch (error) {
		console.error("Error creating database indexes:", error);
		res.status(500).json({ error: "Failed to create database indexes" });
	}
});

/**
 * Refresh CDN asset cache
 */
router.post("/cdn/refresh", async (req, res) => {
	try {
		cdnService.refreshAssetCache();
		res.json({ message: "CDN asset cache refreshed successfully" });
	} catch (error) {
		console.error("Error refreshing CDN cache:", error);
		res.status(500).json({ error: "Failed to refresh CDN cache" });
	}
});

/**
 * Get asset manifest
 */
router.get("/cdn/manifest", async (req, res) => {
	try {
		const manifest = cdnService.generateAssetManifest();
		res.json(manifest);
	} catch (error) {
		console.error("Error getting asset manifest:", error);
		res.status(500).json({ error: "Failed to get asset manifest" });
	}
});

/**
 * Get system health check
 */
router.get("/health", async (req, res) => {
	try {
		const systemMetrics = await performanceMonitoringService.getSystemMetrics();
		const cacheStats = await cacheService.getCacheStats();

		const health = {
			status: "healthy",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			memory: {
				usage: systemMetrics.memoryUsage.percentage,
				status:
					systemMetrics.memoryUsage.percentage < 85 ? "healthy" : "warning",
			},
			responseTime: {
				avg: systemMetrics.responseTime.avg,
				status: systemMetrics.responseTime.avg < 1000 ? "healthy" : "warning",
			},
			errorRate: {
				rate: systemMetrics.errorRate,
				status: systemMetrics.errorRate < 5 ? "healthy" : "warning",
			},
			cache: {
				hitRate: systemMetrics.cacheHitRate,
				status: systemMetrics.cacheHitRate > 70 ? "healthy" : "warning",
				totalKeys: cacheStats.totalKeys,
			},
			throughput: systemMetrics.throughput,
		};

		// Determine overall status
		const hasWarnings = [
			health.memory.status,
			health.responseTime.status,
			health.errorRate.status,
			health.cache.status,
		].some((status) => status === "warning");

		if (hasWarnings) {
			health.status = "warning";
		}

		res.json(health);
	} catch (error) {
		console.error("Error getting health status:", error);
		res.status(500).json({
			status: "unhealthy",
			timestamp: new Date().toISOString(),
			error: "Failed to get health status",
		});
	}
});

/**
 * Get performance alerts
 */
router.get("/alerts", async (req, res) => {
	try {
		const systemMetrics = await performanceMonitoringService.getSystemMetrics();
		const alerts = [];

		// Memory usage alert
		if (systemMetrics.memoryUsage.percentage > 85) {
			alerts.push({
				type: "warning",
				category: "memory",
				message: `High memory usage: ${systemMetrics.memoryUsage.percentage.toFixed(
					1
				)}%`,
				threshold: 85,
				current: systemMetrics.memoryUsage.percentage,
				timestamp: new Date().toISOString(),
			});
		}

		// Response time alert
		if (systemMetrics.responseTime.avg > 2000) {
			alerts.push({
				type: "warning",
				category: "performance",
				message: `High average response time: ${systemMetrics.responseTime.avg}ms`,
				threshold: 2000,
				current: systemMetrics.responseTime.avg,
				timestamp: new Date().toISOString(),
			});
		}

		// Error rate alert
		if (systemMetrics.errorRate > 5) {
			alerts.push({
				type: "critical",
				category: "errors",
				message: `High error rate: ${systemMetrics.errorRate.toFixed(1)}%`,
				threshold: 5,
				current: systemMetrics.errorRate,
				timestamp: new Date().toISOString(),
			});
		}

		// Cache hit rate alert
		if (systemMetrics.cacheHitRate < 50) {
			alerts.push({
				type: "warning",
				category: "cache",
				message: `Low cache hit rate: ${systemMetrics.cacheHitRate.toFixed(
					1
				)}%`,
				threshold: 50,
				current: systemMetrics.cacheHitRate,
				timestamp: new Date().toISOString(),
			});
		}

		res.json(alerts);
	} catch (error) {
		console.error("Error getting alerts:", error);
		res.status(500).json({ error: "Failed to get performance alerts" });
	}
});

export default router;
