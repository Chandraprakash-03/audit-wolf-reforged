"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Settings,
	Download,
	Upload,
	RotateCcw,
	Save,
	AlertTriangle,
	CheckCircle,
} from "lucide-react";

interface Platform {
	id: string;
	name: string;
	displayName: string;
	isActive: boolean;
	configuration?: {
		analyzers: Record<
			string,
			{
				enabled: boolean;
				timeout: number;
				enabledDetectors?: string[];
				disabledDetectors?: string[];
				customArgs?: string[];
			}
		>;
		aiModels: Record<
			string,
			{
				enabled: boolean;
				provider: string;
				modelId: string;
				maxTokens: number;
				temperature: number;
				contextPrompts: string[];
			}
		>;
		validationRules: Array<{
			id: string;
			enabled: boolean;
			severity: "error" | "warning";
			customPattern?: string;
		}>;
	};
}

interface PlatformConfigurationProps {
	platforms: Platform[];
	onUpdate: () => void;
}

export function PlatformConfiguration({
	platforms,
	onUpdate,
}: PlatformConfigurationProps) {
	const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const platform = selectedPlatform
		? platforms.find((p) => p.id === selectedPlatform)
		: null;

	const saveConfiguration = async (platformId: string, config: any) => {
		setSaving(true);
		setMessage(null);

		try {
			const token = localStorage.getItem("token");
			const response = await fetch(
				`/api/admin/platform-management/platforms/${platformId}/config`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify(config),
				}
			);

			if (!response.ok) {
				throw new Error(`Failed to save configuration: ${response.statusText}`);
			}

			setMessage({ type: "success", text: "Configuration saved successfully" });
			onUpdate();
		} catch (error) {
			setMessage({
				type: "error",
				text:
					error instanceof Error
						? error.message
						: "Failed to save configuration",
			});
		} finally {
			setSaving(false);
		}
	};

	const resetConfiguration = async (platformId: string) => {
		setSaving(true);
		setMessage(null);

		try {
			const token = localStorage.getItem("token");
			const response = await fetch(
				`/api/admin/platform-management/platforms/${platformId}/config/reset`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);

			if (!response.ok) {
				throw new Error(
					`Failed to reset configuration: ${response.statusText}`
				);
			}

			setMessage({ type: "success", text: "Configuration reset to defaults" });
			onUpdate();
		} catch (error) {
			setMessage({
				type: "error",
				text:
					error instanceof Error
						? error.message
						: "Failed to reset configuration",
			});
		} finally {
			setSaving(false);
		}
	};

	const exportConfiguration = async (platformId: string) => {
		try {
			const token = localStorage.getItem("token");
			const response = await fetch(
				`/api/admin/platform-management/platforms/${platformId}/config/export`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);

			if (!response.ok) {
				throw new Error(
					`Failed to export configuration: ${response.statusText}`
				);
			}

			const config = await response.json();
			const blob = new Blob([JSON.stringify(config, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${platformId}-config.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			setMessage({
				type: "success",
				text: "Configuration exported successfully",
			});
		} catch (error) {
			setMessage({
				type: "error",
				text:
					error instanceof Error
						? error.message
						: "Failed to export configuration",
			});
		}
	};

	return (
		<div className="space-y-6">
			{/* Platform Selection */}
			<div className="bg-white rounded-lg border p-6">
				<h3 className="text-lg font-medium text-gray-900 mb-4">
					Select Platform
				</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{platforms.map((p) => (
						<button
							key={p.id}
							onClick={() => setSelectedPlatform(p.id)}
							className={`p-4 border rounded-lg text-left transition-colors ${
								selectedPlatform === p.id
									? "border-blue-500 bg-blue-50"
									: "border-gray-200 hover:border-gray-300"
							}`}
						>
							<div className="flex items-center justify-between">
								<h4 className="font-medium text-gray-900">{p.displayName}</h4>
								<Badge variant={p.isActive ? "default" : "secondary"}>
									{p.isActive ? "Active" : "Inactive"}
								</Badge>
							</div>
							<p className="text-sm text-gray-500 mt-1">
								{p.configuration ? "Configured" : "Default settings"}
							</p>
						</button>
					))}
				</div>
			</div>

			{/* Configuration Panel */}
			{platform && (
				<div className="bg-white rounded-lg border">
					<div className="px-6 py-4 border-b">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="text-lg font-medium text-gray-900">
									{platform.displayName} Configuration
								</h3>
								<p className="text-sm text-gray-500 mt-1">
									Configure analyzers, AI models, and validation rules
								</p>
							</div>
							<div className="flex space-x-2">
								<button
									onClick={() => exportConfiguration(platform.id)}
									className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
								>
									<Download className="h-4 w-4 mr-2" />
									Export
								</button>
								<button
									onClick={() => resetConfiguration(platform.id)}
									disabled={saving}
									className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
								>
									<RotateCcw className="h-4 w-4 mr-2" />
									Reset
								</button>
								<button
									onClick={() =>
										saveConfiguration(platform.id, platform.configuration)
									}
									disabled={saving}
									className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
								>
									<Save className="h-4 w-4 mr-2" />
									{saving ? "Saving..." : "Save"}
								</button>
							</div>
						</div>
					</div>

					{message && (
						<div className="px-6 py-4 border-b">
							<Alert
								variant={message.type === "error" ? "destructive" : "default"}
							>
								{message.type === "success" ? (
									<CheckCircle className="h-4 w-4" />
								) : (
									<AlertTriangle className="h-4 w-4" />
								)}
								<AlertDescription>{message.text}</AlertDescription>
							</Alert>
						</div>
					)}

					<div className="p-6 space-y-8">
						{/* Static Analyzers Configuration */}
						{platform.configuration?.analyzers && (
							<div>
								<h4 className="text-lg font-medium text-gray-900 mb-4">
									Static Analyzers
								</h4>
								<div className="space-y-4">
									{Object.entries(platform.configuration.analyzers).map(
										([analyzerId, config]) => (
											<div key={analyzerId} className="border rounded-lg p-4">
												<div className="flex items-center justify-between mb-3">
													<h5 className="font-medium text-gray-900">
														{analyzerId}
													</h5>
													<Switch
														checked={config.enabled}
														onCheckedChange={(checked: any) => {
															// Update configuration logic would go here
															console.log(`Toggle ${analyzerId}: ${checked}`);
														}}
													/>
												</div>
												<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
													<div>
														<label className="block text-sm font-medium text-gray-700 mb-1">
															Timeout (ms)
														</label>
														<input
															type="number"
															value={config.timeout}
															onChange={(e) => {
																// Update timeout logic would go here
																console.log(
																	`Update timeout: ${e.target.value}`
																);
															}}
															className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
														/>
													</div>
													<div>
														<label className="block text-sm font-medium text-gray-700 mb-1">
															Custom Arguments
														</label>
														<input
															type="text"
															value={config.customArgs?.join(" ") || ""}
															onChange={(e) => {
																// Update custom args logic would go here
																console.log(`Update args: ${e.target.value}`);
															}}
															placeholder="--arg1 --arg2"
															className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
														/>
													</div>
												</div>
											</div>
										)
									)}
								</div>
							</div>
						)}

						{/* AI Models Configuration */}
						{platform.configuration?.aiModels && (
							<div>
								<h4 className="text-lg font-medium text-gray-900 mb-4">
									AI Models
								</h4>
								<div className="space-y-4">
									{Object.entries(platform.configuration.aiModels).map(
										([modelId, config]) => (
											<div key={modelId} className="border rounded-lg p-4">
												<div className="flex items-center justify-between mb-3">
													<h5 className="font-medium text-gray-900">
														{modelId}
													</h5>
													<Switch
														checked={config.enabled}
														onCheckedChange={(checked: any) => {
															// Update configuration logic would go here
															console.log(`Toggle ${modelId}: ${checked}`);
														}}
													/>
												</div>
												<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
													<div>
														<label className="block text-sm font-medium text-gray-700 mb-1">
															Provider
														</label>
														<input
															type="text"
															value={config.provider}
															onChange={(e) => {
																// Update provider logic would go here
																console.log(
																	`Update provider: ${e.target.value}`
																);
															}}
															className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
														/>
													</div>
													<div>
														<label className="block text-sm font-medium text-gray-700 mb-1">
															Max Tokens
														</label>
														<input
															type="number"
															value={config.maxTokens}
															onChange={(e) => {
																// Update max tokens logic would go here
																console.log(
																	`Update max tokens: ${e.target.value}`
																);
															}}
															className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
														/>
													</div>
													<div>
														<label className="block text-sm font-medium text-gray-700 mb-1">
															Temperature
														</label>
														<input
															type="number"
															step="0.1"
															min="0"
															max="2"
															value={config.temperature}
															onChange={(e) => {
																// Update temperature logic would go here
																console.log(
																	`Update temperature: ${e.target.value}`
																);
															}}
															className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
														/>
													</div>
												</div>
											</div>
										)
									)}
								</div>
							</div>
						)}

						{/* Validation Rules Configuration */}
						{platform.configuration?.validationRules && (
							<div>
								<h4 className="text-lg font-medium text-gray-900 mb-4">
									Validation Rules
								</h4>
								<div className="space-y-2">
									{platform.configuration.validationRules.map((rule) => (
										<div
											key={rule.id}
											className="flex items-center justify-between p-3 border rounded-lg"
										>
											<div className="flex items-center space-x-3">
												<Switch
													checked={rule.enabled}
													onCheckedChange={(checked: any) => {
														// Update rule logic would go here
														console.log(`Toggle rule ${rule.id}: ${checked}`);
													}}
												/>
												<span className="font-medium text-gray-900">
													{rule.id}
												</span>
												<Badge
													variant={
														rule.severity === "error"
															? "destructive"
															: "secondary"
													}
												>
													{rule.severity}
												</Badge>
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{!platform.configuration && (
							<Alert>
								<Settings className="h-4 w-4" />
								<AlertDescription>
									No configuration available for this platform. Default settings
									will be used.
								</AlertDescription>
							</Alert>
						)}
					</div>
				</div>
			)}

			{!selectedPlatform && (
				<div className="text-center py-12">
					<Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
					<h3 className="text-lg font-medium text-gray-900 mb-2">
						Select a Platform
					</h3>
					<p className="text-gray-500">
						Choose a blockchain platform above to view and edit its
						configuration.
					</p>
				</div>
			)}
		</div>
	);
}
