"use client";

import { useState, useEffect } from "react";
import { PlatformOverview } from "./PlatformOverview";
import { PlatformHealthMonitor } from "./PlatformHealthMonitor";
import { PlatformConfiguration } from "./PlatformConfiguration";
import { PlatformCapabilities } from "./PlatformCapabilities";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";

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
	configuration?: any;
}

export function PlatformManagementDashboard() {
	const [platforms, setPlatforms] = useState<Platform[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [refreshing, setRefreshing] = useState(false);

	const fetchPlatforms = async () => {
		try {
			const token = localStorage.getItem("token");
			const response = await fetch("/api/admin/platform-management/platforms", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch platforms: ${response.statusText}`);
			}

			const data = await response.json();
			if (data.success) {
				setPlatforms(data.platforms);
			} else {
				throw new Error(data.error || "Failed to fetch platforms");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error occurred");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	const refreshPlatforms = async () => {
		setRefreshing(true);
		await fetchPlatforms();
	};

	const runHealthCheck = async () => {
		try {
			setRefreshing(true);
			const token = localStorage.getItem("token");
			const response = await fetch(
				"/api/admin/platform-management/platforms/health/check-all",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);

			if (!response.ok) {
				throw new Error(`Health check failed: ${response.statusText}`);
			}

			// Refresh platforms after health check
			await fetchPlatforms();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Health check failed");
		}
	};

	useEffect(() => {
		fetchPlatforms();
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
				<span className="ml-2 text-gray-600">Loading platforms...</span>
			</div>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>
					{error}
					<button
						onClick={refreshPlatforms}
						className="ml-2 text-sm underline hover:no-underline"
					>
						Try again
					</button>
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold text-gray-900">
						Platform Management
					</h2>
					<p className="text-gray-600 mt-1">
						Monitor and configure blockchain platform analyzers
					</p>
				</div>
				<div className="flex space-x-2">
					<button
						onClick={runHealthCheck}
						disabled={refreshing}
						className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
					>
						<RefreshCw
							className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
						/>
						{refreshing ? "Checking..." : "Run Health Check"}
					</button>
					<button
						onClick={refreshPlatforms}
						disabled={refreshing}
						className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
					>
						<RefreshCw
							className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
						/>
						Refresh
					</button>
				</div>
			</div>

			<Tabs defaultValue="overview" className="space-y-6">
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="health">Health Monitor</TabsTrigger>
					<TabsTrigger value="configuration">Configuration</TabsTrigger>
					<TabsTrigger value="capabilities">Capabilities</TabsTrigger>
				</TabsList>

				<TabsContent value="overview">
					<PlatformOverview
						platforms={platforms}
						onRefresh={refreshPlatforms}
					/>
				</TabsContent>

				<TabsContent value="health">
					<PlatformHealthMonitor
						platforms={platforms}
						onRefresh={runHealthCheck}
					/>
				</TabsContent>

				<TabsContent value="configuration">
					<PlatformConfiguration
						platforms={platforms}
						onUpdate={refreshPlatforms}
					/>
				</TabsContent>

				<TabsContent value="capabilities">
					<PlatformCapabilities platforms={platforms} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
