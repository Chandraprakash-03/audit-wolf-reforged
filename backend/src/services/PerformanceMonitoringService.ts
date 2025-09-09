import { EventEmitter } from "events";
import { redis } from "../config/queue";

export interface PerformanceMetric {
	timestamp: number;
	metricName: string;
	value: number;
	tags?: { [key: string]: string };
	unit?: string;
}

export interface SystemMetrics {
	cpuUsage: number;
	memoryUsage: {
		used: number;
		total: number;
		percentage: number;
	};
	responseTime: {
		avg: number;
		p95: number;
		p99: number;
	};
	throughput: {
		requestsPerSecond: number;
		auditsPerHour: number;
	};
	errorRate: number;
	cacheHitRate: number;
}

export interface AuditPerformanceMetrics {
	auditId: string;
	totalTime: number;
	slitherTime: number;
	aiAnalysisTime: number;
	reportGenerationTime: number;
	queueWaitTime: number;
	memoryPeak: number;
}

export class PerformanceMonitoringService extends EventEmitter {
	private static instance: PerformanceMonitoringService;
	private metrics: Map<string, PerformanceMetric[]> = new Map();
	private responseTimeBuffer: number[] = [];
	private requestCount = 0;
	private errorCount = 0;
	private auditMetrics: Map<string, Partial<AuditPerformanceMetrics>> =
		new Map();
	private monitoringInterval?: NodeJS.Timeout;

	private constructor() {
		super();
		this.startSystemMonitoring();
	}

	public static getInstance(): PerformanceMonitoringService {
		if (!PerformanceMonitoringService.instance) {
			PerformanceMonitoringService.instance =
				new PerformanceMonitoringService();
		}
		return PerformanceMonitoringService.instance;
	}

	/**
	 * Record a performance metric
	 */
	recordMetric(
		metricName: string,
		value: number,
		tags?: { [key: string]: string },
		unit?: string
	): void {
		const metric: PerformanceMetric = {
			timestamp: Date.now(),
			metricName,
			value,
			tags,
			unit,
		};

		if (!this.metrics.has(metricName)) {
			this.metrics.set(metricName, []);
		}

		const metricsList = this.metrics.get(metricName)!;
		metricsList.push(metric);

		// Keep only last 1000 metrics per type to prevent memory leaks
		if (metricsList.length > 1000) {
			metricsList.shift();
		}

		// Emit event for real-time monitoring
		this.emit("metric", metric);

		// Store in Redis for persistence
		this.storeMetricInRedis(metric);
	}

	/**
	 * Record API response time
	 */
	recordResponseTime(responseTime: number, endpoint?: string): void {
		this.responseTimeBuffer.push(responseTime);
		this.requestCount++;

		// Keep buffer size manageable
		if (this.responseTimeBuffer.length > 1000) {
			this.responseTimeBuffer.shift();
		}

		this.recordMetric(
			"api.response_time",
			responseTime,
			endpoint ? { endpoint } : undefined,
			"ms"
		);
	}

	/**
	 * Record API error
	 */
	recordError(error: Error, endpoint?: string): void {
		this.errorCount++;
		this.recordMetric("api.error", 1, {
			...(endpoint && { endpoint }),
			error_type: error.constructor.name,
			message: error.message,
		});
	}

	/**
	 * Start audit performance tracking
	 */
	startAuditTracking(auditId: string): void {
		this.auditMetrics.set(auditId, {
			auditId,
			totalTime: Date.now(),
			memoryPeak: process.memoryUsage().heapUsed,
		});
	}

	/**
	 * Record Slither analysis time
	 */
	recordSlitherTime(auditId: string, duration: number): void {
		const metrics = this.auditMetrics.get(auditId);
		if (metrics) {
			metrics.slitherTime = duration;
			this.recordMetric(
				"audit.slither_time",
				duration,
				{ audit_id: auditId },
				"ms"
			);
		}
	}

	/**
	 * Record AI analysis time
	 */
	recordAIAnalysisTime(auditId: string, duration: number): void {
		const metrics = this.auditMetrics.get(auditId);
		if (metrics) {
			metrics.aiAnalysisTime = duration;
			this.recordMetric(
				"audit.ai_analysis_time",
				duration,
				{ audit_id: auditId },
				"ms"
			);
		}
	}

	/**
	 * Record report generation time
	 */
	recordReportGenerationTime(auditId: string, duration: number): void {
		const metrics = this.auditMetrics.get(auditId);
		if (metrics) {
			metrics.reportGenerationTime = duration;
			this.recordMetric(
				"audit.report_generation_time",
				duration,
				{ audit_id: auditId },
				"ms"
			);
		}
	}

	/**
	 * Record queue wait time
	 */
	recordQueueWaitTime(auditId: string, duration: number): void {
		const metrics = this.auditMetrics.get(auditId);
		if (metrics) {
			metrics.queueWaitTime = duration;
			this.recordMetric(
				"audit.queue_wait_time",
				duration,
				{ audit_id: auditId },
				"ms"
			);
		}
	}

	/**
	 * Complete audit tracking
	 */
	completeAuditTracking(auditId: string): AuditPerformanceMetrics | null {
		const metrics = this.auditMetrics.get(auditId);
		if (!metrics || !metrics.totalTime) return null;

		const completedMetrics: AuditPerformanceMetrics = {
			auditId,
			totalTime: Date.now() - metrics.totalTime,
			slitherTime: metrics.slitherTime || 0,
			aiAnalysisTime: metrics.aiAnalysisTime || 0,
			reportGenerationTime: metrics.reportGenerationTime || 0,
			queueWaitTime: metrics.queueWaitTime || 0,
			memoryPeak: Math.max(
				metrics.memoryPeak || 0,
				process.memoryUsage().heapUsed
			),
		};

		// Record total audit time
		this.recordMetric(
			"audit.total_time",
			completedMetrics.totalTime,
			{ audit_id: auditId },
			"ms"
		);
		this.recordMetric(
			"audit.memory_peak",
			completedMetrics.memoryPeak,
			{ audit_id: auditId },
			"bytes"
		);

		// Clean up
		this.auditMetrics.delete(auditId);

		return completedMetrics;
	}

	/**
	 * Get current system metrics
	 */
	async getSystemMetrics(): Promise<SystemMetrics> {
		const memoryUsage = process.memoryUsage();
		const cpuUsage = process.cpuUsage();

		// Calculate response time percentiles
		const sortedResponseTimes = [...this.responseTimeBuffer].sort(
			(a, b) => a - b
		);
		const p95Index = Math.floor(sortedResponseTimes.length * 0.95);
		const p99Index = Math.floor(sortedResponseTimes.length * 0.99);

		const avgResponseTime =
			sortedResponseTimes.length > 0
				? sortedResponseTimes.reduce((sum, time) => sum + time, 0) /
				  sortedResponseTimes.length
				: 0;

		// Get cache hit rate
		const cacheHits = (await redis.get("cache:stats:hits")) || "0";
		const cacheMisses = (await redis.get("cache:stats:misses")) || "0";
		const totalCacheRequests = parseInt(cacheHits) + parseInt(cacheMisses);
		const cacheHitRate =
			totalCacheRequests > 0
				? (parseInt(cacheHits) / totalCacheRequests) * 100
				: 0;

		// Calculate throughput
		const now = Date.now();
		const oneHourAgo = now - 60 * 60 * 1000;
		const recentAudits = await this.getMetricCount(
			"audit.total_time",
			oneHourAgo
		);
		const auditsPerHour = recentAudits;

		const oneSecondAgo = now - 1000;
		const recentRequests = await this.getMetricCount(
			"api.response_time",
			oneSecondAgo
		);
		const requestsPerSecond = recentRequests;

		return {
			cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to milliseconds
			memoryUsage: {
				used: memoryUsage.heapUsed,
				total: memoryUsage.heapTotal,
				percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
			},
			responseTime: {
				avg: Math.round(avgResponseTime),
				p95: sortedResponseTimes[p95Index] || 0,
				p99: sortedResponseTimes[p99Index] || 0,
			},
			throughput: {
				requestsPerSecond,
				auditsPerHour,
			},
			errorRate:
				this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
			cacheHitRate: Math.round(cacheHitRate * 100) / 100,
		};
	}

	/**
	 * Get performance metrics for a specific time range
	 */
	getMetrics(
		metricName: string,
		startTime?: number,
		endTime?: number
	): PerformanceMetric[] {
		const metrics = this.metrics.get(metricName) || [];

		if (!startTime && !endTime) {
			return metrics;
		}

		return metrics.filter((metric) => {
			if (startTime && metric.timestamp < startTime) return false;
			if (endTime && metric.timestamp > endTime) return false;
			return true;
		});
	}

	/**
	 * Get audit performance summary
	 */
	getAuditPerformanceSummary(timeRange?: { start: number; end: number }): {
		avgTotalTime: number;
		avgSlitherTime: number;
		avgAITime: number;
		avgReportTime: number;
		avgQueueTime: number;
		totalAudits: number;
	} {
		const auditMetrics = this.getMetrics(
			"audit.total_time",
			timeRange?.start,
			timeRange?.end
		);
		const slitherMetrics = this.getMetrics(
			"audit.slither_time",
			timeRange?.start,
			timeRange?.end
		);
		const aiMetrics = this.getMetrics(
			"audit.ai_analysis_time",
			timeRange?.start,
			timeRange?.end
		);
		const reportMetrics = this.getMetrics(
			"audit.report_generation_time",
			timeRange?.start,
			timeRange?.end
		);
		const queueMetrics = this.getMetrics(
			"audit.queue_wait_time",
			timeRange?.start,
			timeRange?.end
		);

		const avgTotalTime =
			auditMetrics.length > 0
				? auditMetrics.reduce((sum, m) => sum + m.value, 0) /
				  auditMetrics.length
				: 0;

		const avgSlitherTime =
			slitherMetrics.length > 0
				? slitherMetrics.reduce((sum, m) => sum + m.value, 0) /
				  slitherMetrics.length
				: 0;

		const avgAITime =
			aiMetrics.length > 0
				? aiMetrics.reduce((sum, m) => sum + m.value, 0) / aiMetrics.length
				: 0;

		const avgReportTime =
			reportMetrics.length > 0
				? reportMetrics.reduce((sum, m) => sum + m.value, 0) /
				  reportMetrics.length
				: 0;

		const avgQueueTime =
			queueMetrics.length > 0
				? queueMetrics.reduce((sum, m) => sum + m.value, 0) /
				  queueMetrics.length
				: 0;

		return {
			avgTotalTime: Math.round(avgTotalTime),
			avgSlitherTime: Math.round(avgSlitherTime),
			avgAITime: Math.round(avgAITime),
			avgReportTime: Math.round(avgReportTime),
			avgQueueTime: Math.round(avgQueueTime),
			totalAudits: auditMetrics.length,
		};
	}

	/**
	 * Clear all metrics
	 */
	clearMetrics(): void {
		this.metrics.clear();
		this.responseTimeBuffer = [];
		this.requestCount = 0;
		this.errorCount = 0;
		this.auditMetrics.clear();
	}

	/**
	 * Stop monitoring
	 */
	stopMonitoring(): void {
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = undefined;
		}
	}

	// Private methods
	private startSystemMonitoring(): void {
		// Record system metrics every 30 seconds
		this.monitoringInterval = setInterval(() => {
			const memoryUsage = process.memoryUsage();

			this.recordMetric(
				"system.memory.heap_used",
				memoryUsage.heapUsed,
				{},
				"bytes"
			);
			this.recordMetric(
				"system.memory.heap_total",
				memoryUsage.heapTotal,
				{},
				"bytes"
			);
			this.recordMetric(
				"system.memory.external",
				memoryUsage.external,
				{},
				"bytes"
			);
			this.recordMetric("system.memory.rss", memoryUsage.rss, {}, "bytes");

			// Record active audit count
			this.recordMetric("system.active_audits", this.auditMetrics.size);
		}, 30000);
	}

	private async storeMetricInRedis(metric: PerformanceMetric): Promise<void> {
		try {
			const key = `metrics:${metric.metricName}:${Math.floor(
				metric.timestamp / 60000
			)}`; // Group by minute
			await redis.lpush(key, JSON.stringify(metric));
			await redis.expire(key, 86400); // Keep for 24 hours
		} catch (error) {
			console.error("Error storing metric in Redis:", error);
		}
	}

	private async getMetricCount(
		metricName: string,
		since: number
	): Promise<number> {
		try {
			const sinceMinute = Math.floor(since / 60000);
			const nowMinute = Math.floor(Date.now() / 60000);

			let count = 0;
			for (let minute = sinceMinute; minute <= nowMinute; minute++) {
				const key = `metrics:${metricName}:${minute}`;
				const length = await redis.llen(key);
				count += length;
			}

			return count;
		} catch (error) {
			console.error("Error getting metric count:", error);
			return 0;
		}
	}
}

export const performanceMonitoringService =
	PerformanceMonitoringService.getInstance();
