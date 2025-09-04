"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	CheckCircle,
	XCircle,
	AlertTriangle,
	ExternalLink,
	FileText,
	Activity,
	Settings,
} from "lucide-react";

interface Platform {
	id: string;
	name: string;
	displayName: string;
	description: string;
	supportedLanguages: string[];
	fileExtensions: string[];
	isActive: boolean;
	version: string;
	website?: string;
	documentation?: string;
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

interface PlatformOverviewProps {
	platforms: Platform[];
	onRefresh: () => void;
}

export function PlatformOverview({
	platforms,
	onRefresh,
}: PlatformOverviewProps) {
	const [updatingPlatform, setUpdatingPlatform] = useState<string | null>(null);

	const getHealthIcon = (status: string) => {
		switch (status) {
			case "healthy":
				return <CheckCircle className="h-5 w-5 text-green-500" />;
			case "degraded":
				return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
			case "unhealthy":
				return <XCircle className="h-5 w-5 text-red-500" />;
			default:
				return <Activity className="h-5 w-5 text-gray-400" />;
		}
	};

	const getHealthBadgeVariant = (status: string) => {
		switch (status) {
			case "healthy":
				return "default";
			case "degraded":
				return "secondary";
			case "unhealthy":
				return "destructive";
			default:
				return "outline";
		}
	};

	const togglePlatformStatus = async (
		platformId: string,
		isActive: boolean
	) => {
		setUpdatingPlatform(platformId);
		try {
			const token = localStorage.getItem("token");
			const response = await fetch(
				`/api/admin/platform-management/platforms/${platformId}/status`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ isActive }),
				}
			);

			if (!response.ok) {
				throw new Error(
					`Failed to update platform status: ${response.statusText}`
				);
			}

			onRefresh();
		} catch (error) {
			console.error("Error updating platform status:", error);
			// You might want to show a toast notification here
		} finally {
			setUpdatingPlatform(null);
		}
	};

	const activePlatforms = platforms.filter((p) => p.isActive).length;
	const healthyPlatforms = platforms.filter(
		(p) => p.health?.status === "healthy"
	).length;
	const totalAnalyzers = platforms.reduce(
		(sum, p) => sum + (p.health?.analyzers.length || 0),
		0
	);

	return (
		<div className="space-y-6">
			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="bg-white rounded-lg border p-6">
					<div className="flex items-center">
						<div className="flex-shrink-0">
							<Settings className="h-8 w-8 text-blue-600" />
						</div>
						<div className="ml-4">
							<p className="text-sm font-medium text-gray-500">
								Total Platforms
							</p>
							<p className="text-2xl font-semibold text-gray-900">
								{platforms.length}
							</p>
						</div>
					</div>
				</div>

				<div className="bg-white rounded-lg border p-6">
					<div className="flex items-center">
						<div className="flex-shrink-0">
							<CheckCircle className="h-8 w-8 text-green-600" />
						</div>
						<div className="ml-4">
							<p className="text-sm font-medium text-gray-500">
								Active Platforms
							</p>
							<p className="text-2xl font-semibold text-gray-900">
								{activePlatforms}
							</p>
						</div>
					</div>
				</div>

				<div className="bg-white rounded-lg border p-6">
					<div className="flex items-center">
						<div className="flex-shrink-0">
							<Activity className="h-8 w-8 text-green-600" />
						</div>
						<div className="ml-4">
							<p className="text-sm font-medium text-gray-500">
								Healthy Platforms
							</p>
							<p className="text-2xl font-semibold text-gray-900">
								{healthyPlatforms}
							</p>
						</div>
					</div>
				</div>

				<div className="bg-white rounded-lg border p-6">
					<div className="flex items-center">
						<div className="flex-shrink-0">
							<Settings className="h-8 w-8 text-blue-600" />
						</div>
						<div className="ml-4">
							<p className="text-sm font-medium text-gray-500">
								Total Analyzers
							</p>
							<p className="text-2xl font-semibold text-gray-900">
								{totalAnalyzers}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Platform List */}
			<div className="bg-white rounded-lg border">
				<div className="px-6 py-4 border-b">
					<h3 className="text-lg font-medium text-gray-900">
						Blockchain Platforms
					</h3>
					<p className="text-sm text-gray-500 mt-1">
						Manage supported blockchain platforms and their configurations
					</p>
				</div>

				<div className="divide-y divide-gray-200">
					{platforms.map((platform) => (
						<div key={platform.id} className="p-6">
							<div className="flex items-center justify-between">
								<div className="flex items-center space-x-4">
									<div className="flex-shrink-0">
										{getHealthIcon(platform.health?.status || "unknown")}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center space-x-2">
											<h4 className="text-lg font-medium text-gray-900">
												{platform.displayName}
											</h4>
											<Badge
												variant={platform.isActive ? "default" : "secondary"}
											>
												{platform.isActive ? "Active" : "Inactive"}
											</Badge>
											{platform.health && (
												<Badge
													variant={getHealthBadgeVariant(
														platform.health.status
													)}
												>
													{platform.health.status}
												</Badge>
											)}
										</div>
										<p className="text-sm text-gray-500 mt-1">
											{platform.description}
										</p>
										<div className="flex items-center space-x-4 mt-2">
											<div className="flex items-center space-x-1">
												<span className="text-xs text-gray-500">
													Languages:
												</span>
												<div className="flex space-x-1">
													{platform.supportedLanguages.map((lang) => (
														<Badge
															key={lang}
															variant="outline"
															className="text-xs"
														>
															{lang}
														</Badge>
													))}
												</div>
											</div>
											<div className="flex items-center space-x-1">
												<span className="text-xs text-gray-500">
													Extensions:
												</span>
												<span className="text-xs text-gray-600">
													{platform.fileExtensions.join(", ")}
												</span>
											</div>
										</div>
									</div>
								</div>

								<div className="flex items-center space-x-4">
									<div className="flex items-center space-x-2">
										{platform.website && (
											<a
												href={platform.website}
												target="_blank"
												rel="noopener noreferrer"
												className="text-gray-400 hover:text-gray-600"
											>
												<ExternalLink className="h-4 w-4" />
											</a>
										)}
										{platform.documentation && (
											<a
												href={platform.documentation}
												target="_blank"
												rel="noopener noreferrer"
												className="text-gray-400 hover:text-gray-600"
											>
												<FileText className="h-4 w-4" />
											</a>
										)}
									</div>

									<div className="flex items-center space-x-2">
										<label
											htmlFor={`platform-${platform.id}`}
											className="text-sm text-gray-700"
										>
											{platform.isActive ? "Active" : "Inactive"}
										</label>
										<Switch
											id={`platform-${platform.id}`}
											checked={platform.isActive}
											onCheckedChange={(checked: boolean) =>
												togglePlatformStatus(platform.id, checked)
											}
											disabled={updatingPlatform === platform.id}
										/>
									</div>
								</div>
							</div>

							{platform.health && (
								<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<h5 className="text-sm font-medium text-gray-700 mb-2">
											Static Analyzers ({platform.health.analyzers.length})
										</h5>
										<div className="space-y-1">
											{platform.health.analyzers.map((analyzer) => (
												<div
													key={analyzer.name}
													className="flex items-center justify-between text-sm"
												>
													<span className="text-gray-600">{analyzer.name}</span>
													<div className="flex items-center space-x-2">
														{analyzer.version && (
															<span className="text-xs text-gray-500">
																{analyzer.version}
															</span>
														)}
														<Badge
															variant={
																analyzer.status === "healthy"
																	? "default"
																	: "destructive"
															}
															className="text-xs"
														>
															{analyzer.status}
														</Badge>
													</div>
												</div>
											))}
										</div>
									</div>

									<div>
										<h5 className="text-sm font-medium text-gray-700 mb-2">
											AI Models ({platform.health.aiModels.length})
										</h5>
										<div className="space-y-1">
											{platform.health.aiModels.map((model) => (
												<div
													key={model.modelId}
													className="flex items-center justify-between text-sm"
												>
													<span className="text-gray-600">{model.modelId}</span>
													<Badge
														variant={
															model.status === "healthy"
																? "default"
																: "destructive"
														}
														className="text-xs"
													>
														{model.status}
													</Badge>
												</div>
											))}
										</div>
									</div>
								</div>
							)}

							{platform.health?.lastChecked && (
								<div className="mt-3 text-xs text-gray-500">
									Last checked:{" "}
									{new Date(platform.health.lastChecked).toLocaleString()}
									{" • "}
									Response time: {platform.health.responseTime}ms
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
