"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	CheckCircle,
	XCircle,
	AlertTriangle,
	Clock,
	RefreshCw,
	TrendingUp,
	TrendingDown,
} from "lucide-react";

interface Platform {
	id: string;
	name: string;
	displayName: string;
	isActive: boolean;
	health?: {
		status: "healthy" | "degraded" | "unhealthy" | "unknown";
		analyzers: Array<{
			name: string;
			status: "healthy" | "unhealthy" | "unknown";
			version?: string;
			error?: string;
			responseTime: number;
		}>;
		aiModels: Array<{
			modelId: string;
			status: "healthy" | "unhealthy" | "unknown";
			error?: string;
			responseTime: number;
		}>;
		lastChecked: string;
		responseTime: number;
	};
}

interface PlatformHealthMonitorProps {
	platforms: Platform[];
	onRefresh: () => void;
}

interface HealthSummary {
	total: number;
	healthy: number;
	degraded: number;
	unhealthy: number;
	unknown: number;
}

export function PlatformHealthMonitor({
	platforms,
	onRefresh,
}: PlatformHealthMonitorProps) {
	const [refreshing, setRefreshing] = useState(false);
	const [healthSummary, setHealthSummary] = useState<HealthSummary>({
		total: 0,
		healthy: 0,
		degraded: 0,
		unhealthy: 0,
		unknown: 0,
	});

	useEffect(() => {
		const summary = platforms.reduce(
			(acc, platform) => {
				acc.total++;
				const status = platform.health?.status || "unknown";
				acc[status as keyof HealthSummary]++;
				return acc;
			},
			{ total: 0, healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 }
		);
		setHealthSummary(summary);
	}, [platforms]);

	const getHealthIcon = (status: string) => {
		switch (status) {
			case "healthy":
				return <CheckCircle className="h-5 w-5 text-green-500" />;
			case "degraded":
				return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
			case "unhealthy":
				return <XCircle className="h-5 w-5 text-red-500" />;
			default:
				return <Clock className="h-5 w-5 text-gray-400" />;
		}
	};

	const getHealthColor = (status: string) => {
		switch (status) {
			case "healthy":
				return "text-green-600";
			case "degraded":
				return "text-yellow-600";
			case "unhealthy":
				return "text-red-600";
			default:
				return "text-gray-600";
		}
	};

	const getResponseTimeColor = (responseTime: number) => {
		if (responseTime < 1000) return "text-green-600";
		if (responseTime < 3000) return "text-yellow-600";
		return "text-red-600";
	};

	const handleRefresh = async () => {
		setRefreshing(true);
		await onRefresh();
		setRefreshing(false);
	};

	const healthPercentage =
		healthSummary.total > 0
			? (healthSummary.healthy / healthSummary.total) * 100
			: 0;

	return (
		<div className="space-y-6">
			{/* Health Summary */}
			<div className="grid grid-cols-1 md:grid-cols-5 gap-4">
				<div className="bg-white rounded-lg border p-6">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-gray-500">
								Overall Health
							</p>
							<p className="text-2xl font-semibold text-gray-900">
								{healthPercentage.toFixed(0)}%
							</p>
						</div>
						<div className="flex-shrink-0">
							{healthPercentage >= 80 ? (
								<TrendingUp className="h-8 w-8 text-green-600" />
							) : (
								<TrendingDown className="h-8 w-8 text-red-600" />
							)}
						</div>
					</div>
					<Progress value={healthPercentage} className="mt-2" />
				</div>

				<div className="bg-white rounded-lg border p-6">
					<div className="flex items-center">
						<CheckCircle className="h-8 w-8 text-green-600 mr-3" />
						<div>
							<p className="text-sm font-medium text-gray-500">Healthy</p>
							<p className="text-2xl font-semibold text-gray-900">
								{healthSummary.healthy}
							</p>
						</div>
					</div>
				</div>

				<div className="bg-white rounded-lg border p-6">
					<div className="flex items-center">
						<AlertTriangle className="h-8 w-8 text-yellow-600 mr-3" />
						<div>
							<p className="text-sm font-medium text-gray-500">Degraded</p>
							<p className="text-2xl font-semibold text-gray-900">
								{healthSummary.degraded}
							</p>
						</div>
					</div>
				</div>

				<div className="bg-white rounded-lg border p-6">
					<div className="flex items-center">
						<XCircle className="h-8 w-8 text-red-600 mr-3" />
						<div>
							<p className="text-sm font-medium text-gray-500">Unhealthy</p>
							<p className="text-2xl font-semibold text-gray-900">
								{healthSummary.unhealthy}
							</p>
						</div>
					</div>
				</div>

				<div className="bg-white rounded-lg border p-6">
					<div className="flex items-center">
						<Clock className="h-8 w-8 text-gray-600 mr-3" />
						<div>
							<p className="text-sm font-medium text-gray-500">Unknown</p>
							<p className="text-2xl font-semibold text-gray-900">
								{healthSummary.unknown}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Health Check Actions */}
			<div className="bg-white rounded-lg border p-6">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-lg font-medium text-gray-900">
							Health Monitoring
						</h3>
						<p className="text-sm text-gray-500 mt-1">
							Monitor analyzer health and run diagnostics
						</p>
					</div>
					<button
						onClick={handleRefresh}
						disabled={refreshing}
						className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
					>
						<RefreshCw
							className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
						/>
						{refreshing ? "Running..." : "Run Health Check"}
					</button>
				</div>
			</div>

			{/* Platform Health Details */}
			<div className="bg-white rounded-lg border">
				<div className="px-6 py-4 border-b">
					<h3 className="text-lg font-medium text-gray-900">
						Platform Health Status
					</h3>
					<p className="text-sm text-gray-500 mt-1">
						Detailed health information for each blockchain platform
					</p>
				</div>

				<div className="divide-y divide-gray-200">
					{platforms.map((platform) => (
						<div key={platform.id} className="p-6">
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center space-x-3">
									{getHealthIcon(platform.health?.status || "unknown")}
									<div>
										<h4 className="text-lg font-medium text-gray-900">
											{platform.displayName}
										</h4>
										<div className="flex items-center space-x-2 mt-1">
											<Badge
												variant={platform.isActive ? "default" : "secondary"}
												className="text-xs"
											>
												{platform.isActive ? "Active" : "Inactive"}
											</Badge>
											{platform.health && (
												<Badge
													variant={
														platform.health.status === "healthy"
															? "default"
															: platform.health.status === "degraded"
															? "secondary"
															: platform.health.status === "unhealthy"
															? "destructive"
															: "outline"
													}
													className="text-xs"
												>
													{platform.health.status}
												</Badge>
											)}
										</div>
									</div>
								</div>

								{platform.health && (
									<div className="text-right">
										<div
											className={`text-sm font-medium ${getResponseTimeColor(
												platform.health.responseTime
											)}`}
										>
											{platform.health.responseTime}ms
										</div>
										<div className="text-xs text-gray-500">
											{new Date(platform.health.lastChecked).toLocaleString()}
										</div>
									</div>
								)}
							</div>

							{platform.health && (
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
									{/* Analyzers Health */}
									<div>
										<h5 className="text-sm font-medium text-gray-700 mb-3">
											Static Analyzers ({platform.health.analyzers.length})
										</h5>
										<div className="space-y-2">
											{platform.health.analyzers.map((analyzer) => (
												<div
													key={analyzer.name}
													className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
												>
													<div className="flex items-center space-x-2">
														{analyzer.status === "healthy" ? (
															<CheckCircle className="h-4 w-4 text-green-500" />
														) : analyzer.status === "unhealthy" ? (
															<XCircle className="h-4 w-4 text-red-500" />
														) : (
															<Clock className="h-4 w-4 text-gray-400" />
														)}
														<span className="text-sm font-medium text-gray-900">
															{analyzer.name}
														</span>
														{analyzer.version && (
															<Badge variant="outline" className="text-xs">
																v{analyzer.version}
															</Badge>
														)}
													</div>
													<div className="text-right">
														<div
															className={`text-xs ${getResponseTimeColor(
																analyzer.responseTime
															)}`}
														>
															{analyzer.responseTime}ms
														</div>
														{analyzer.error && (
															<div className="text-xs text-red-600 max-w-xs truncate">
																{analyzer.error}
															</div>
														)}
													</div>
												</div>
											))}
										</div>
									</div>

									{/* AI Models Health */}
									<div>
										<h5 className="text-sm font-medium text-gray-700 mb-3">
											AI Models ({platform.health.aiModels.length})
										</h5>
										<div className="space-y-2">
											{platform.health.aiModels.map((model) => (
												<div
													key={model.modelId}
													className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
												>
													<div className="flex items-center space-x-2">
														{model.status === "healthy" ? (
															<CheckCircle className="h-4 w-4 text-green-500" />
														) : model.status === "unhealthy" ? (
															<XCircle className="h-4 w-4 text-red-500" />
														) : (
															<Clock className="h-4 w-4 text-gray-400" />
														)}
														<span className="text-sm font-medium text-gray-900">
															{model.modelId}
														</span>
													</div>
													<div className="text-right">
														<div
															className={`text-xs ${getResponseTimeColor(
																model.responseTime
															)}`}
														>
															{model.responseTime}ms
														</div>
														{model.error && (
															<div className="text-xs text-red-600 max-w-xs truncate">
																{model.error}
															</div>
														)}
													</div>
												</div>
											))}
										</div>
									</div>
								</div>
							)}

							{!platform.health && (
								<Alert>
									<AlertTriangle className="h-4 w-4" />
									<AlertDescription>
										No health data available. Run a health check to get current
										status.
									</AlertDescription>
								</Alert>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
