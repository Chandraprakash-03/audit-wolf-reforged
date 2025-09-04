"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	ExternalLink,
	FileText,
	Code,
	Cpu,
	Brain,
	Calendar,
	Rocket,
	Clock,
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
}

interface Capabilities {
	capabilities: Array<{
		id: string;
		name: string;
		displayName: string;
		description: string;
		supportedLanguages: string[];
		fileExtensions: string[];
		staticAnalyzers: Array<{
			name: string;
			supportedLanguages: string[];
		}>;
		aiModels: Array<{
			provider: string;
			modelId: string;
			specialization: string[];
		}>;
		isActive: boolean;
		version: string;
		website?: string;
		documentation?: string;
	}>;
	roadmap: {
		upcoming: Array<{
			platform: string;
			expectedRelease: string;
			features: string[];
		}>;
		inDevelopment: Array<{
			platform: string;
			features: string[];
		}>;
	};
}

interface PlatformCapabilitiesProps {
	platforms: Platform[];
}

export function PlatformCapabilities({ platforms }: PlatformCapabilitiesProps) {
	const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchCapabilities = async () => {
			try {
				const token = localStorage.getItem("token");
				const response = await fetch(
					"/api/admin/platform-management/platforms/capabilities",
					{
						headers: {
							Authorization: `Bearer ${token}`,
						},
					}
				);

				if (!response.ok) {
					throw new Error(
						`Failed to fetch capabilities: ${response.statusText}`
					);
				}

				const data = await response.json();
				if (data.success) {
					setCapabilities(data);
				} else {
					throw new Error(data.error || "Failed to fetch capabilities");
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Unknown error occurred");
			} finally {
				setLoading(false);
			}
		};

		fetchCapabilities();
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
				<span className="ml-2 text-gray-600">Loading capabilities...</span>
			</div>
		);
	}

	if (error) {
		return (
			<div className="text-center py-12">
				<div className="text-red-600 mb-4">{error}</div>
				<button
					onClick={() => window.location.reload()}
					className="text-blue-600 hover:text-blue-800 underline"
				>
					Try again
				</button>
			</div>
		);
	}

	if (!capabilities) {
		return (
			<div className="text-center py-12">
				<p className="text-gray-500">No capabilities data available.</p>
			</div>
		);
	}

	const activePlatforms = capabilities.capabilities.filter(
		(p) => p.isActive
	).length;
	const totalLanguages = new Set(
		capabilities.capabilities.flatMap((p) => p.supportedLanguages)
	).size;
	const totalAnalyzers = capabilities.capabilities.reduce(
		(sum, p) => sum + p.staticAnalyzers.length,
		0
	);

	return (
		<div className="space-y-6">
			{/* Capabilities Overview */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="bg-white rounded-lg border p-6">
					<div className="flex items-center">
						<Rocket className="h-8 w-8 text-blue-600 mr-3" />
						<div>
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
						<Code className="h-8 w-8 text-green-600 mr-3" />
						<div>
							<p className="text-sm font-medium text-gray-500">Languages</p>
							<p className="text-2xl font-semibold text-gray-900">
								{totalLanguages}
							</p>
						</div>
					</div>
				</div>

				<div className="bg-white rounded-lg border p-6">
					<div className="flex items-center">
						<Cpu className="h-8 w-8 text-purple-600 mr-3" />
						<div>
							<p className="text-sm font-medium text-gray-500">Analyzers</p>
							<p className="text-2xl font-semibold text-gray-900">
								{totalAnalyzers}
							</p>
						</div>
					</div>
				</div>

				<div className="bg-white rounded-lg border p-6">
					<div className="flex items-center">
						<Brain className="h-8 w-8 text-orange-600 mr-3" />
						<div>
							<p className="text-sm font-medium text-gray-500">AI Models</p>
							<p className="text-2xl font-semibold text-gray-900">
								{capabilities.capabilities.reduce(
									(sum, p) => sum + p.aiModels.length,
									0
								)}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Platform Capabilities */}
			<div className="bg-white rounded-lg border">
				<div className="px-6 py-4 border-b">
					<h3 className="text-lg font-medium text-gray-900">
						Platform Capabilities
					</h3>
					<p className="text-sm text-gray-500 mt-1">
						Detailed capabilities for each supported blockchain platform
					</p>
				</div>

				<div className="divide-y divide-gray-200">
					{capabilities.capabilities.map((platform) => (
						<div key={platform.id} className="p-6">
							<div className="flex items-start justify-between mb-4">
								<div className="flex-1">
									<div className="flex items-center space-x-2 mb-2">
										<h4 className="text-lg font-medium text-gray-900">
											{platform.displayName}
										</h4>
										<Badge
											variant={platform.isActive ? "default" : "secondary"}
										>
											{platform.isActive ? "Active" : "Coming Soon"}
										</Badge>
										<Badge variant="outline">v{platform.version}</Badge>
									</div>
									<p className="text-sm text-gray-600 mb-3">
										{platform.description}
									</p>

									<div className="flex items-center space-x-4">
										{platform.website && (
											<a
												href={platform.website}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
											>
												<ExternalLink className="h-4 w-4 mr-1" />
												Website
											</a>
										)}
										{platform.documentation && (
											<a
												href={platform.documentation}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
											>
												<FileText className="h-4 w-4 mr-1" />
												Documentation
											</a>
										)}
									</div>
								</div>
							</div>

							<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
								{/* Supported Languages */}
								<div>
									<h5 className="text-sm font-medium text-gray-700 mb-2">
										Supported Languages
									</h5>
									<div className="flex flex-wrap gap-1">
										{platform.supportedLanguages.map((lang) => (
											<Badge key={lang} variant="outline" className="text-xs">
												{lang}
											</Badge>
										))}
									</div>
									<div className="mt-2 text-xs text-gray-500">
										Extensions: {platform.fileExtensions.join(", ")}
									</div>
								</div>

								{/* Static Analyzers */}
								<div>
									<h5 className="text-sm font-medium text-gray-700 mb-2">
										Static Analyzers ({platform.staticAnalyzers.length})
									</h5>
									<div className="space-y-1">
										{platform.staticAnalyzers.map((analyzer) => (
											<div key={analyzer.name} className="text-sm">
												<span className="font-medium text-gray-900">
													{analyzer.name}
												</span>
												<div className="text-xs text-gray-500">
													{analyzer.supportedLanguages.join(", ")}
												</div>
											</div>
										))}
									</div>
								</div>

								{/* AI Models */}
								<div>
									<h5 className="text-sm font-medium text-gray-700 mb-2">
										AI Models ({platform.aiModels.length})
									</h5>
									<div className="space-y-1">
										{platform.aiModels.map((model, index) => (
											<div key={index} className="text-sm">
												<span className="font-medium text-gray-900">
													{model.modelId}
												</span>
												<div className="text-xs text-gray-500">
													{model.provider} • {model.specialization.join(", ")}
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Roadmap */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Upcoming Releases */}
				<div className="bg-white rounded-lg border">
					<div className="px-6 py-4 border-b">
						<div className="flex items-center">
							<Calendar className="h-5 w-5 text-blue-600 mr-2" />
							<h3 className="text-lg font-medium text-gray-900">
								Upcoming Releases
							</h3>
						</div>
					</div>
					<div className="p-6">
						{capabilities.roadmap.upcoming.length > 0 ? (
							<div className="space-y-4">
								{capabilities.roadmap.upcoming.map((item, index) => (
									<div key={index} className="border-l-4 border-blue-500 pl-4">
										<div className="flex items-center justify-between">
											<h4 className="font-medium text-gray-900 capitalize">
												{item.platform}
											</h4>
											<Badge variant="outline">{item.expectedRelease}</Badge>
										</div>
										<ul className="mt-2 text-sm text-gray-600">
											{item.features.map((feature, featureIndex) => (
												<li key={featureIndex} className="flex items-center">
													<span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
													{feature}
												</li>
											))}
										</ul>
									</div>
								))}
							</div>
						) : (
							<p className="text-gray-500 text-sm">
								No upcoming releases scheduled.
							</p>
						)}
					</div>
				</div>

				{/* In Development */}
				<div className="bg-white rounded-lg border">
					<div className="px-6 py-4 border-b">
						<div className="flex items-center">
							<Clock className="h-5 w-5 text-orange-600 mr-2" />
							<h3 className="text-lg font-medium text-gray-900">
								In Development
							</h3>
						</div>
					</div>
					<div className="p-6">
						{capabilities.roadmap.inDevelopment.length > 0 ? (
							<div className="space-y-4">
								{capabilities.roadmap.inDevelopment.map((item, index) => (
									<div
										key={index}
										className="border-l-4 border-orange-500 pl-4"
									>
										<h4 className="font-medium text-gray-900 capitalize">
											{item.platform}
										</h4>
										<ul className="mt-2 text-sm text-gray-600">
											{item.features.map((feature, featureIndex) => (
												<li key={featureIndex} className="flex items-center">
													<span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
													{feature}
												</li>
											))}
										</ul>
									</div>
								))}
							</div>
						) : (
							<p className="text-gray-500 text-sm">
								No platforms currently in development.
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
