"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiCall } from "@/utils/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Activity,
	Clock,
	Database,
	Zap,
	TrendingUp,
	Server,
	BarChart3,
	RefreshCw,
} from "lucide-react";

interface SystemMetrics {
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

interface AuditPerformanceMetrics {
	avgTotalTime: number;
	avgSlitherTime: number;
	avgAITime: number;
	avgReportTime: number;
	avgQueueTime: number;
	totalAudits: number;
}

interface CacheStats {
	totalKeys: number;
	memoryUsage: string;
	hitRate: number;
	missRate: number;
}

interface DatabaseStats {
	[queryName: string]: {
		avgTime: number;
		totalCalls: number;
		avgRowsReturned: number;
	};
}

export const PerformanceDashboard: React.FC = () => {
	const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(
		null
	);
	const [auditMetrics, setAuditMetrics] =
		useState<AuditPerformanceMetrics | null>(null);
	const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
	const [databaseStats, setDatabaseStats] = useState<DatabaseStats | null>(
		null
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [autoRefresh, setAutoRefresh] = useState(true);

	// Fetch performance data
	const fetchPerformanceData = useCallback(async () => {
		try {
			setError(null);

			const [systemData, auditData, cacheData, dbData] = await Promise.all([
				apiCall("/api/admin/metrics/system").catch(() => null),
				apiCall("/api/admin/metrics/audits").catch(() => null),
				apiCall("/api/admin/metrics/cache").catch(() => null),
				apiCall("/api/admin/metrics/database").catch(() => null),
			]);

			if (systemData) {
				setSystemMetrics(systemData);
			}

			if (auditData) {
				setAuditMetrics(auditData);
			}

			if (cacheData) {
				setCacheStats(cacheData);
			}

			if (dbData) {
				setDatabaseStats(dbData);
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to fetch performance data"
			);
		} finally {
			setLoading(false);
		}
	}, []);

	// Auto-refresh effect
	useEffect(() => {
		fetchPerformanceData();

		if (autoRefresh) {
			const interval = setInterval(fetchPerformanceData, 30000); // Refresh every 30 seconds
			return () => clearInterval(interval);
		}
	}, [fetchPerformanceData, autoRefresh]);

	const formatBytes = (bytes: number): string => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	};

	const formatDuration = (ms: number): string => {
		if (ms < 1000) return `${Math.round(ms)}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${(ms / 60000).toFixed(1)}m`;
	};

	const getStatusColor = (
		value: number,
		thresholds: { good: number; warning: number }
	): string => {
		if (value <= thresholds.good) return "text-green-600";
		if (value <= thresholds.warning) return "text-yellow-600";
		return "text-red-600";
	};

	const getStatusBadge = (
		value: number,
		thresholds: { good: number; warning: number }
	): string => {
		if (value <= thresholds.good) return "bg-green-100 text-green-800";
		if (value <= thresholds.warning) return "bg-yellow-100 text-yellow-800";
		return "bg-red-100 text-red-800";
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold">Performance Dashboard</h1>
					<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
					{Array.from({ length: 8 }).map((_, i) => (
						<Card key={i}>
							<CardContent className="p-6">
								<div className="animate-pulse">
									<div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
									<div className="h-8 bg-gray-200 rounded w-1/2"></div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold">Performance Dashboard</h1>
					<Button onClick={fetchPerformanceData} variant="outline">
						<RefreshCw className="h-4 w-4 mr-2" />
						Retry
					</Button>
				</div>
				<Card className="border-red-200">
					<CardContent className="p-6">
						<div className="text-center">
							<Server className="h-12 w-12 text-red-500 mx-auto mb-4" />
							<h3 className="text-lg font-semibold text-red-800 mb-2">
								Error Loading Metrics
							</h3>
							<p className="text-red-600">{error}</p>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Performance Dashboard</h1>
				<div className="flex items-center space-x-2">
					<Button
						variant={autoRefresh ? "default" : "outline"}
						size="sm"
						onClick={() => setAutoRefresh(!autoRefresh)}
					>
						<Activity className="h-4 w-4 mr-2" />
						Auto Refresh
					</Button>
					<Button onClick={fetchPerformanceData} variant="outline" size="sm">
						<RefreshCw className="h-4 w-4 mr-2" />
						Refresh
					</Button>
				</div>
			</div>

			<Tabs defaultValue="overview" className="space-y-6">
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="system">System</TabsTrigger>
					<TabsTrigger value="audits">Audits</TabsTrigger>
					<TabsTrigger value="cache">Cache</TabsTrigger>
					<TabsTrigger value="database">Database</TabsTrigger>
				</TabsList>

				{/* Overview Tab */}
				<TabsContent value="overview" className="space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
						{/* Response Time */}
						<Card>
							<CardContent className="p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-gray-600">
											Avg Response Time
										</p>
										<p
											className={`text-2xl font-bold ${getStatusColor(
												systemMetrics?.responseTime.avg || 0,
												{ good: 500, warning: 1000 }
											)}`}
										>
											{formatDuration(systemMetrics?.responseTime.avg || 0)}
										</p>
									</div>
									<Clock className="h-8 w-8 text-blue-500" />
								</div>
							</CardContent>
						</Card>

						{/* Throughput */}
						<Card>
							<CardContent className="p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-gray-600">
											Audits/Hour
										</p>
										<p className="text-2xl font-bold text-green-600">
											{systemMetrics?.throughput.auditsPerHour || 0}
										</p>
									</div>
									<TrendingUp className="h-8 w-8 text-green-500" />
								</div>
							</CardContent>
						</Card>

						{/* Error Rate */}
						<Card>
							<CardContent className="p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-gray-600">
											Error Rate
										</p>
										<p
											className={`text-2xl font-bold ${getStatusColor(
												systemMetrics?.errorRate || 0,
												{ good: 1, warning: 5 }
											)}`}
										>
											{(systemMetrics?.errorRate || 0).toFixed(1)}%
										</p>
									</div>
									<Zap className="h-8 w-8 text-red-500" />
								</div>
							</CardContent>
						</Card>

						{/* Cache Hit Rate */}
						<Card>
							<CardContent className="p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-gray-600">
											Cache Hit Rate
										</p>
										<p
											className={`text-2xl font-bold ${getStatusColor(
												100 - (systemMetrics?.cacheHitRate || 0),
												{ good: 20, warning: 50 }
											)}`}
										>
											{(systemMetrics?.cacheHitRate || 0).toFixed(1)}%
										</p>
									</div>
									<Database className="h-8 w-8 text-purple-500" />
								</div>
							</CardContent>
						</Card>
					</div>

					{/* System Health Overview */}
					<Card>
						<CardHeader>
							<CardTitle>System Health</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								<div className="text-center">
									<div className="text-3xl font-bold mb-2">
										<Badge
											className={getStatusBadge(
												systemMetrics?.memoryUsage.percentage || 0,
												{ good: 70, warning: 85 }
											)}
										>
											{(systemMetrics?.memoryUsage.percentage || 0).toFixed(1)}%
										</Badge>
									</div>
									<p className="text-sm text-gray-600">Memory Usage</p>
									<p className="text-xs text-gray-500">
										{formatBytes(systemMetrics?.memoryUsage.used || 0)} /{" "}
										{formatBytes(systemMetrics?.memoryUsage.total || 0)}
									</p>
								</div>

								<div className="text-center">
									<div className="text-3xl font-bold mb-2">
										<Badge
											className={getStatusBadge(
												systemMetrics?.responseTime.p95 || 0,
												{ good: 1000, warning: 3000 }
											)}
										>
											{formatDuration(systemMetrics?.responseTime.p95 || 0)}
										</Badge>
									</div>
									<p className="text-sm text-gray-600">95th Percentile</p>
									<p className="text-xs text-gray-500">Response Time</p>
								</div>

								<div className="text-center">
									<div className="text-3xl font-bold mb-2">
										<Badge className="bg-blue-100 text-blue-800">
											{systemMetrics?.throughput.requestsPerSecond || 0}
										</Badge>
									</div>
									<p className="text-sm text-gray-600">Requests/Second</p>
									<p className="text-xs text-gray-500">Current Load</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* System Tab */}
				<TabsContent value="system" className="space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card>
							<CardHeader>
								<CardTitle>Memory Usage</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									<div className="flex justify-between items-center">
										<span>Heap Used</span>
										<span className="font-mono">
											{formatBytes(systemMetrics?.memoryUsage.used || 0)}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span>Heap Total</span>
										<span className="font-mono">
											{formatBytes(systemMetrics?.memoryUsage.total || 0)}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span>Usage Percentage</span>
										<Badge
											className={getStatusBadge(
												systemMetrics?.memoryUsage.percentage || 0,
												{ good: 70, warning: 85 }
											)}
										>
											{(systemMetrics?.memoryUsage.percentage || 0).toFixed(1)}%
										</Badge>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Response Times</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									<div className="flex justify-between items-center">
										<span>Average</span>
										<span className="font-mono">
											{formatDuration(systemMetrics?.responseTime.avg || 0)}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span>95th Percentile</span>
										<span className="font-mono">
											{formatDuration(systemMetrics?.responseTime.p95 || 0)}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span>99th Percentile</span>
										<span className="font-mono">
											{formatDuration(systemMetrics?.responseTime.p99 || 0)}
										</span>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* Audits Tab */}
				<TabsContent value="audits" className="space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						<Card>
							<CardContent className="p-6">
								<div className="text-center">
									<p className="text-sm font-medium text-gray-600 mb-2">
										Total Audits
									</p>
									<p className="text-3xl font-bold text-blue-600">
										{auditMetrics?.totalAudits || 0}
									</p>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-6">
								<div className="text-center">
									<p className="text-sm font-medium text-gray-600 mb-2">
										Avg Total Time
									</p>
									<p className="text-3xl font-bold text-green-600">
										{formatDuration(auditMetrics?.avgTotalTime || 0)}
									</p>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-6">
								<div className="text-center">
									<p className="text-sm font-medium text-gray-600 mb-2">
										Avg Queue Time
									</p>
									<p className="text-3xl font-bold text-orange-600">
										{formatDuration(auditMetrics?.avgQueueTime || 0)}
									</p>
								</div>
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Audit Performance Breakdown</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="flex justify-between items-center">
									<span>Slither Analysis</span>
									<span className="font-mono">
										{formatDuration(auditMetrics?.avgSlitherTime || 0)}
									</span>
								</div>
								<div className="flex justify-between items-center">
									<span>AI Analysis</span>
									<span className="font-mono">
										{formatDuration(auditMetrics?.avgAITime || 0)}
									</span>
								</div>
								<div className="flex justify-between items-center">
									<span>Report Generation</span>
									<span className="font-mono">
										{formatDuration(auditMetrics?.avgReportTime || 0)}
									</span>
								</div>
								<div className="flex justify-between items-center">
									<span>Queue Wait Time</span>
									<span className="font-mono">
										{formatDuration(auditMetrics?.avgQueueTime || 0)}
									</span>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Cache Tab */}
				<TabsContent value="cache" className="space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
						<Card>
							<CardContent className="p-6">
								<div className="text-center">
									<p className="text-sm font-medium text-gray-600 mb-2">
										Total Keys
									</p>
									<p className="text-3xl font-bold text-blue-600">
										{cacheStats?.totalKeys || 0}
									</p>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-6">
								<div className="text-center">
									<p className="text-sm font-medium text-gray-600 mb-2">
										Memory Usage
									</p>
									<p className="text-3xl font-bold text-purple-600">
										{cacheStats?.memoryUsage || "0B"}
									</p>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-6">
								<div className="text-center">
									<p className="text-sm font-medium text-gray-600 mb-2">
										Hit Rate
									</p>
									<p className="text-3xl font-bold text-green-600">
										{(cacheStats?.hitRate || 0).toFixed(1)}%
									</p>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-6">
								<div className="text-center">
									<p className="text-sm font-medium text-gray-600 mb-2">
										Miss Rate
									</p>
									<p className="text-3xl font-bold text-red-600">
										{(cacheStats?.missRate || 0).toFixed(1)}%
									</p>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* Database Tab */}
				<TabsContent value="database" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Query Performance</CardTitle>
						</CardHeader>
						<CardContent>
							{databaseStats && Object.keys(databaseStats).length > 0 ? (
								<div className="space-y-4">
									{Object.entries(databaseStats).map(([queryName, stats]) => (
										<div key={queryName} className="border rounded-lg p-4">
											<div className="flex justify-between items-center mb-2">
												<h4 className="font-medium">{queryName}</h4>
												<Badge variant="outline">
													{stats.totalCalls} calls
												</Badge>
											</div>
											<div className="grid grid-cols-2 gap-4 text-sm">
												<div>
													<span className="text-gray-600">Avg Time:</span>
													<span className="ml-2 font-mono">
														{stats.avgTime}ms
													</span>
												</div>
												<div>
													<span className="text-gray-600">Avg Rows:</span>
													<span className="ml-2 font-mono">
														{stats.avgRowsReturned}
													</span>
												</div>
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="text-center py-8 text-gray-500">
									<BarChart3 className="h-12 w-12 mx-auto mb-4" />
									<p>No database statistics available</p>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
};

export default PerformanceDashboard;
