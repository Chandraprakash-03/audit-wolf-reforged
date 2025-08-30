import { redis } from "../config/queue";
import { Audit, AuditReport } from "../types/index";

export interface CacheConfig {
	auditResultsTTL: number; // Time to live for audit results in seconds
	reportTTL: number; // Time to live for reports in seconds
	userDataTTL: number; // Time to live for user data in seconds
	maxCacheSize: number; // Maximum cache size in MB
}

export class CacheService {
	private static instance: CacheService;
	private config: CacheConfig;

	private constructor() {
		this.config = {
			auditResultsTTL: parseInt(process.env.CACHE_AUDIT_TTL || "3600"), // 1 hour
			reportTTL: parseInt(process.env.CACHE_REPORT_TTL || "86400"), // 24 hours
			userDataTTL: parseInt(process.env.CACHE_USER_TTL || "1800"), // 30 minutes
			maxCacheSize: parseInt(process.env.CACHE_MAX_SIZE_MB || "100"), // 100 MB
		};
	}

	public static getInstance(): CacheService {
		if (!CacheService.instance) {
			CacheService.instance = new CacheService();
		}
		return CacheService.instance;
	}

	/**
	 * Cache audit results with TTL
	 */
	async cacheAuditResult(auditId: string, result: Audit): Promise<void> {
		try {
			const key = this.getAuditKey(auditId);
			const serializedResult = JSON.stringify(result);

			await redis.setex(key, this.config.auditResultsTTL, serializedResult);

			// Track cache size
			await this.trackCacheSize(key, serializedResult.length);
		} catch (error) {
			console.error("Error caching audit result:", error);
			// Don't throw - caching failures shouldn't break the application
		}
	}

	/**
	 * Get cached audit result
	 */
	async getCachedAuditResult(auditId: string): Promise<Audit | null> {
		try {
			const key = this.getAuditKey(auditId);
			const cached = await redis.get(key);

			if (cached) {
				return JSON.parse(cached) as Audit;
			}

			return null;
		} catch (error) {
			console.error("Error retrieving cached audit result:", error);
			return null;
		}
	}

	/**
	 * Cache audit report with TTL
	 */
	async cacheAuditReport(auditId: string, report: AuditReport): Promise<void> {
		try {
			const key = this.getReportKey(auditId);
			const serializedReport = JSON.stringify(report);

			await redis.setex(key, this.config.reportTTL, serializedReport);

			// Track cache size
			await this.trackCacheSize(key, serializedReport.length);
		} catch (error) {
			console.error("Error caching audit report:", error);
		}
	}

	/**
	 * Get cached audit report
	 */
	async getCachedAuditReport(auditId: string): Promise<AuditReport | null> {
		try {
			const key = this.getReportKey(auditId);
			const cached = await redis.get(key);

			if (cached) {
				return JSON.parse(cached) as AuditReport;
			}

			return null;
		} catch (error) {
			console.error("Error retrieving cached audit report:", error);
			return null;
		}
	}

	/**
	 * Cache user audit history
	 */
	async cacheUserAudits(userId: string, audits: Audit[]): Promise<void> {
		try {
			const key = this.getUserAuditsKey(userId);
			const serializedAudits = JSON.stringify(audits);

			await redis.setex(key, this.config.userDataTTL, serializedAudits);

			// Track cache size
			await this.trackCacheSize(key, serializedAudits.length);
		} catch (error) {
			console.error("Error caching user audits:", error);
		}
	}

	/**
	 * Get cached user audit history
	 */
	async getCachedUserAudits(userId: string): Promise<Audit[] | null> {
		try {
			const key = this.getUserAuditsKey(userId);
			const cached = await redis.get(key);

			if (cached) {
				return JSON.parse(cached) as Audit[];
			}

			return null;
		} catch (error) {
			console.error("Error retrieving cached user audits:", error);
			return null;
		}
	}

	/**
	 * Cache contract analysis results by file hash
	 */
	async cacheContractAnalysis(fileHash: string, analysis: any): Promise<void> {
		try {
			const key = this.getContractAnalysisKey(fileHash);
			const serializedAnalysis = JSON.stringify(analysis);

			// Contract analysis can be cached longer since it's based on file hash
			await redis.setex(key, this.config.reportTTL * 7, serializedAnalysis); // 7 days

			// Track cache size
			await this.trackCacheSize(key, serializedAnalysis.length);
		} catch (error) {
			console.error("Error caching contract analysis:", error);
		}
	}

	/**
	 * Get cached contract analysis by file hash
	 */
	async getCachedContractAnalysis(fileHash: string): Promise<any | null> {
		try {
			const key = this.getContractAnalysisKey(fileHash);
			const cached = await redis.get(key);

			if (cached) {
				return JSON.parse(cached);
			}

			return null;
		} catch (error) {
			console.error("Error retrieving cached contract analysis:", error);
			return null;
		}
	}

	/**
	 * Invalidate cache for specific audit
	 */
	async invalidateAuditCache(auditId: string): Promise<void> {
		try {
			const auditKey = this.getAuditKey(auditId);
			const reportKey = this.getReportKey(auditId);

			await redis.del(auditKey, reportKey);
		} catch (error) {
			console.error("Error invalidating audit cache:", error);
		}
	}

	/**
	 * Invalidate user cache
	 */
	async invalidateUserCache(userId: string): Promise<void> {
		try {
			const userKey = this.getUserAuditsKey(userId);
			await redis.del(userKey);
		} catch (error) {
			console.error("Error invalidating user cache:", error);
		}
	}

	/**
	 * Get cache statistics
	 */
	async getCacheStats(): Promise<{
		totalKeys: number;
		memoryUsage: string;
		hitRate: number;
		missRate: number;
	}> {
		try {
			const info = await redis.info("memory");
			const keyspace = await redis.info("keyspace");

			// Parse memory usage
			const memoryMatch = info.match(/used_memory_human:(.+)/);
			const memoryUsage = memoryMatch ? memoryMatch[1].trim() : "Unknown";

			// Parse total keys
			const keysMatch = keyspace.match(/keys=(\d+)/);
			const totalKeys = keysMatch ? parseInt(keysMatch[1]) : 0;

			// Get hit/miss stats from our tracking
			const hits = (await redis.get("cache:stats:hits")) || "0";
			const misses = (await redis.get("cache:stats:misses")) || "0";

			const totalRequests = parseInt(hits) + parseInt(misses);
			const hitRate =
				totalRequests > 0 ? (parseInt(hits) / totalRequests) * 100 : 0;
			const missRate =
				totalRequests > 0 ? (parseInt(misses) / totalRequests) * 100 : 0;

			return {
				totalKeys,
				memoryUsage,
				hitRate: Math.round(hitRate * 100) / 100,
				missRate: Math.round(missRate * 100) / 100,
			};
		} catch (error) {
			console.error("Error getting cache stats:", error);
			return {
				totalKeys: 0,
				memoryUsage: "Unknown",
				hitRate: 0,
				missRate: 0,
			};
		}
	}

	/**
	 * Clear all cache
	 */
	async clearCache(): Promise<void> {
		try {
			await redis.flushdb();
		} catch (error) {
			console.error("Error clearing cache:", error);
		}
	}

	/**
	 * Track cache hits and misses
	 */
	async trackCacheHit(): Promise<void> {
		try {
			await redis.incr("cache:stats:hits");
		} catch (error) {
			console.error("Error tracking cache hit:", error);
		}
	}

	async trackCacheMiss(): Promise<void> {
		try {
			await redis.incr("cache:stats:misses");
		} catch (error) {
			console.error("Error tracking cache miss:", error);
		}
	}

	// Private helper methods
	private getAuditKey(auditId: string): string {
		return `audit:${auditId}`;
	}

	private getReportKey(auditId: string): string {
		return `report:${auditId}`;
	}

	private getUserAuditsKey(userId: string): string {
		return `user:${userId}:audits`;
	}

	private getContractAnalysisKey(fileHash: string): string {
		return `contract:${fileHash}:analysis`;
	}

	private async trackCacheSize(key: string, size: number): Promise<void> {
		try {
			await redis.hset("cache:sizes", key, size);

			// Check if we need to evict old entries
			await this.checkCacheSize();
		} catch (error) {
			console.error("Error tracking cache size:", error);
		}
	}

	private async checkCacheSize(): Promise<void> {
		try {
			const sizes = await redis.hgetall("cache:sizes");
			const totalSize = Object.values(sizes).reduce(
				(sum, size) => sum + parseInt(size as string),
				0
			);
			const totalSizeMB = totalSize / (1024 * 1024);

			if (totalSizeMB > this.config.maxCacheSize) {
				// Implement LRU eviction - remove oldest entries
				const keys = Object.keys(sizes);
				const keysToRemove = keys.slice(0, Math.ceil(keys.length * 0.1)); // Remove 10% of keys

				for (const key of keysToRemove) {
					await redis.del(key);
					await redis.hdel("cache:sizes", key);
				}
			}
		} catch (error) {
			console.error("Error checking cache size:", error);
		}
	}
}

export const cacheService = CacheService.getInstance();
