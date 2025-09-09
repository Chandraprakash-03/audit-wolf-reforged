"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
	ContractUploadState,
	BlockchainPlatform,
	ContractInput,
	MultiChainContractUploadState,
} from "@/types";
import {
	validateFileForPlatform,
	validateCodeForPlatform,
	detectPlatformFromCode,
} from "@/utils/platformValidation";
import {
	Upload,
	FileText,
	AlertCircle,
	CheckCircle,
	Zap,
	Info,
} from "lucide-react";
import { BlockchainPlatformSelector } from "./BlockchainPlatformSelector";
import { CodeEditor } from "./CodeEditor";
import { DependencyManager } from "./DependencyManager";
import {
	getActivePlatforms,
	getPlatformById,
} from "@/data/blockchainPlatforms";

interface ContractUploaderProps {
	onContractSubmit: (contract: {
		name: string;
		sourceCode: string;
		compilerVersion?: string;
		platforms?: string[];
		crossChainAnalysis?: boolean;
		dependencies?: ContractInput[];
	}) => void;
	isLoading?: boolean;
}

export const ContractUploader: React.FC<ContractUploaderProps> = ({
	onContractSubmit,
	isLoading = false,
}) => {
	const [multiChainState, setMultiChainState] =
		useState<MultiChainContractUploadState>({
			contracts: [
				{
					file: null,
					code: "",
					isValid: false,
					errors: [],
					warnings: [],
				},
			],
			selectedPlatforms: [],
			crossChainAnalysis: false,
			dependencies: [],
		});

	const [contractName, setContractName] = useState("");
	const [compilerVersion, setCompilerVersion] = useState("0.8.0");
	const [inputMode, setInputMode] = useState<"upload" | "paste">("upload");
	const [enableMultiChain, setEnableMultiChain] = useState(false);
	const [currentStep, setCurrentStep] = useState<
		"platform" | "contract" | "dependencies"
	>("platform");

	const availablePlatforms = getActivePlatforms();

	const validateContract = useCallback(
		(code: string, platformId?: string) => {
			const platform = platformId ? getPlatformById(platformId) : null;

			if (!platform && multiChainState.selectedPlatforms.length > 0) {
				// Use first selected platform for validation
				const firstPlatform = getPlatformById(
					multiChainState.selectedPlatforms[0]
				);
				if (firstPlatform) {
					const validation = validateCodeForPlatform(code, firstPlatform);
					updateContractState(0, {
						code,
						isValid: validation.isValid,
						errors: validation.errors,
						warnings: validation.warnings || [],
						detectedLanguage: validation.detectedLanguage,
						suggestedPlatforms: validation.suggestedPlatforms,
					});
					return;
				}
			}

			if (platform) {
				const validation = validateCodeForPlatform(code, platform);
				updateContractState(0, {
					code,
					isValid: validation.isValid,
					errors: validation.errors,
					warnings: validation.warnings || [],
					detectedLanguage: validation.detectedLanguage,
					suggestedPlatforms: validation.suggestedPlatforms,
				});
			} else {
				// Auto-detect platform if none selected
				const detection = detectPlatformFromCode(
					code,
					undefined,
					availablePlatforms
				);
				updateContractState(0, {
					code,
					isValid: detection.isValid,
					errors: detection.errors,
					warnings: detection.warnings,
					detectedLanguage: detection.detectedLanguage,
					suggestedPlatforms: detection.suggestedPlatforms,
				});
			}
		},
		[multiChainState.selectedPlatforms, availablePlatforms]
	);

	const updateContractState = (
		index: number,
		updates: Partial<ContractUploadState>
	) => {
		setMultiChainState((prev) => ({
			...prev,
			contracts: prev.contracts.map((contract, i) =>
				i === index ? { ...contract, ...updates } : contract
			),
		}));
	};

	const handleFileUpload = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;

			const platform =
				multiChainState.selectedPlatforms.length > 0
					? getPlatformById(multiChainState.selectedPlatforms[0])
					: null;

			if (platform) {
				const fileValidation = validateFileForPlatform(file, platform);
				if (!fileValidation.isValid) {
					updateContractState(0, {
						file: null,
						code: "",
						isValid: false,
						errors: fileValidation.errors,
						warnings: fileValidation.warnings || [],
					});
					return;
				}
			}

			const reader = new FileReader();
			reader.onload = (e) => {
				const content = e.target?.result as string;
				validateContract(content, platform?.id);
				updateContractState(0, { file });

				// Auto-set contract name from filename if not already set
				if (!contractName) {
					const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, "");
					setContractName(nameWithoutExtension);
				}
			};
			reader.readAsText(file);
		},
		[contractName, validateContract, multiChainState.selectedPlatforms]
	);

	const handleCodeChange = useCallback(
		(code: string) => {
			const platformId =
				multiChainState.selectedPlatforms.length > 0
					? multiChainState.selectedPlatforms[0]
					: undefined;
			validateContract(code, platformId);
		},
		[validateContract, multiChainState.selectedPlatforms]
	);

	const handlePlatformToggle = useCallback(
		(platformId: string) => {
			setMultiChainState((prev) => {
				if (enableMultiChain) {
					// Multi-select mode
					const newSelected = prev.selectedPlatforms.includes(platformId)
						? prev.selectedPlatforms.filter((id) => id !== platformId)
						: [...prev.selectedPlatforms, platformId];
					return {
						...prev,
						selectedPlatforms: newSelected,
						crossChainAnalysis: newSelected.length > 1,
					};
				} else {
					// Single-select mode
					return {
						...prev,
						selectedPlatforms: [platformId],
						crossChainAnalysis: false,
					};
				}
			});
		},
		[enableMultiChain]
	);

	const handleSubmit = useCallback(() => {
		const contract = multiChainState.contracts[0];
		if (
			!contract.code.trim() ||
			!contractName.trim() ||
			multiChainState.selectedPlatforms.length === 0
		)
			return;

		onContractSubmit({
			name: contractName.trim(),
			sourceCode: contract.code,
			compilerVersion,
			platforms: multiChainState.selectedPlatforms,
			crossChainAnalysis: multiChainState.crossChainAnalysis,
			dependencies: multiChainState.dependencies,
		});
	}, [multiChainState, contractName, compilerVersion, onContractSubmit]);

	const canSubmit =
		multiChainState.contracts[0]?.code.trim() &&
		contractName.trim() &&
		multiChainState.selectedPlatforms.length > 0 &&
		!isLoading;

	const currentContract = multiChainState.contracts[0];
	const selectedPlatform =
		multiChainState.selectedPlatforms.length > 0
			? getPlatformById(multiChainState.selectedPlatforms[0])
			: null;

	return (
		<div className="w-full max-w-6xl mx-auto space-y-6">
			{/* Header */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Upload Smart Contract
						</CardTitle>
						<div className="flex items-center gap-2">
							<Label htmlFor="multiChainToggle" className="text-sm">
								Multi-chain Analysis
							</Label>
							<Switch
								id="multiChainToggle"
								checked={enableMultiChain}
								onCheckedChange={setEnableMultiChain}
								disabled={isLoading}
							/>
							{enableMultiChain && <Zap className="h-4 w-4 text-blue-500" />}
						</div>
					</div>
				</CardHeader>
			</Card>

			{/* Step Navigation */}
			<div className="flex items-center gap-4 mb-6">
				{["platform", "contract", "dependencies"].map((step, index) => (
					<div key={step} className="flex items-center gap-2">
						<div
							className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
								currentStep === step
									? "bg-blue-500 text-white"
									: index <
									  ["platform", "contract", "dependencies"].indexOf(
											currentStep
									  )
									? "bg-green-500 text-white"
									: "bg-gray-200 text-gray-600"
							}`}
						>
							{index + 1}
						</div>
						<span className="text-sm font-medium capitalize">{step}</span>
						{index < 2 && <div className="w-8 h-0.5 bg-gray-200" />}
					</div>
				))}
			</div>

			{/* Step 1: Platform Selection */}
			{currentStep === "platform" && (
				<Card>
					<CardContent className="p-6">
						<BlockchainPlatformSelector
							platforms={availablePlatforms}
							selectedPlatforms={multiChainState.selectedPlatforms}
							onPlatformToggle={handlePlatformToggle}
							multiSelect={enableMultiChain}
							disabled={isLoading}
						/>

						{/* Platform Detection */}
						{currentContract.suggestedPlatforms &&
							currentContract.suggestedPlatforms.length > 0 && (
								<div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
									<div className="flex items-start gap-2">
										<Info className="h-4 w-4 text-blue-500 mt-0.5" />
										<div className="text-sm text-blue-700">
											<p className="font-medium">Platform Suggestions</p>
											<p className="text-xs mt-1">
												Based on your code, we suggest:{" "}
												{currentContract.suggestedPlatforms.join(", ")}
											</p>
										</div>
									</div>
								</div>
							)}

						<div className="flex justify-end mt-6">
							<Button
								onClick={() => setCurrentStep("contract")}
								disabled={multiChainState.selectedPlatforms.length === 0}
							>
								Continue to Contract
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Step 2: Contract Upload */}
			{currentStep === "contract" && (
				<div className="space-y-6">
					{/* Contract Details */}
					<Card>
						<CardContent className="p-6 space-y-4">
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-lg font-medium">Contract Details</h3>
								<div className="flex items-center gap-2">
									{multiChainState.selectedPlatforms.map((platformId) => {
										const platform = getPlatformById(platformId);
										return platform ? (
											<Badge key={platformId} variant="outline">
												{platform.displayName}
											</Badge>
										) : null;
									})}
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="contractName">Contract Name *</Label>
									<Input
										id="contractName"
										value={contractName}
										onChange={(e) => setContractName(e.target.value)}
										placeholder="Enter contract name"
										disabled={isLoading}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="compilerVersion">Compiler Version</Label>
									<Input
										id="compilerVersion"
										value={compilerVersion}
										onChange={(e) => setCompilerVersion(e.target.value)}
										placeholder={
											selectedPlatform?.id === "ethereum" ? "0.8.0" : "latest"
										}
										disabled={isLoading}
									/>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Input Mode Toggle */}
					<Card>
						<CardContent className="p-6">
							<div className="flex gap-2 mb-4">
								<Button
									variant={inputMode === "upload" ? "default" : "outline"}
									onClick={() => setInputMode("upload")}
									className="flex items-center gap-2"
								>
									<Upload className="h-4 w-4" />
									Upload File
								</Button>
								<Button
									variant={inputMode === "paste" ? "default" : "outline"}
									onClick={() => setInputMode("paste")}
									className="flex items-center gap-2"
								>
									<FileText className="h-4 w-4" />
									Write Code
								</Button>
							</div>

							{/* File Upload Mode */}
							{inputMode === "upload" && selectedPlatform && (
								<div className="space-y-2">
									<Label htmlFor="fileUpload">
										{selectedPlatform.displayName} File (
										{selectedPlatform.fileExtensions.join(", ")})
									</Label>
									<div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
										<Input
											id="fileUpload"
											type="file"
											accept={selectedPlatform.fileExtensions.join(",")}
											onChange={handleFileUpload}
											className="hidden"
											disabled={isLoading}
										/>
										<Label
											htmlFor="fileUpload"
											className="cursor-pointer flex flex-col items-center gap-2"
										>
											<Upload className="h-8 w-8 text-gray-400" />
											<span className="text-sm text-gray-600">
												{currentContract.file
													? currentContract.file.name
													: "Click to upload or drag and drop"}
											</span>
											<span className="text-xs text-gray-400">
												{selectedPlatform.fileExtensions.join(", ")} files only,
												max 10MB
											</span>
										</Label>
									</div>
								</div>
							)}

							{/* Code Editor Mode */}
							{inputMode === "paste" && selectedPlatform && (
								<div className="space-y-2">
									<Label>Smart Contract Code</Label>
									<CodeEditor
										code={currentContract.code}
										onChange={handleCodeChange}
										platform={selectedPlatform}
										filename={
											contractName
												? `${contractName}${selectedPlatform.fileExtensions[0]}`
												: undefined
										}
										disabled={isLoading}
									/>
								</div>
							)}

							{/* Validation Status */}
							{currentContract.code && (
								<div className="mt-4 space-y-2">
									<div className="flex items-center gap-2">
										{currentContract.isValid ? (
											<>
												<CheckCircle className="h-5 w-5 text-green-500" />
												<span className="text-green-700 font-medium">
													Contract is valid
												</span>
												{currentContract.detectedLanguage && (
													<Badge variant="secondary" className="text-xs">
														{currentContract.detectedLanguage}
													</Badge>
												)}
											</>
										) : currentContract.errors.length === 0 &&
										  currentContract.warnings &&
										  currentContract.warnings.length > 0 ? (
											<>
												<Info className="h-5 w-5 text-blue-500" />
												<span className="text-blue-700 font-medium">
													Contract ready with suggestions
												</span>
												{currentContract.detectedLanguage && (
													<Badge variant="secondary" className="text-xs">
														{currentContract.detectedLanguage}
													</Badge>
												)}
											</>
										) : (
											<>
												<AlertCircle className="h-5 w-5 text-red-500" />
												<span className="text-red-700 font-medium">
													Validation issues found
												</span>
											</>
										)}
									</div>

									{currentContract.errors.length > 0 && (
										<div className="bg-red-50 border border-red-200 rounded-md p-3">
											<h4 className="text-sm font-medium text-red-800 mb-2">
												Errors:
											</h4>
											<ul className="text-sm text-red-700 space-y-1">
												{currentContract.errors.map((error, index) => (
													<li key={index} className="flex items-start gap-2">
														<span className="text-red-500">•</span>
														{error}
													</li>
												))}
											</ul>
										</div>
									)}

									{currentContract.warnings &&
										currentContract.warnings.length > 0 && (
											<div className="bg-amber-50 border border-amber-200 rounded-md p-3">
												<h4 className="text-sm font-medium text-amber-800 mb-2">
													Warnings:
												</h4>
												<ul className="text-sm text-amber-700 space-y-1">
													{currentContract.warnings.map((warning, index) => (
														<li key={index} className="flex items-start gap-2">
															<span className="text-amber-500">•</span>
															{warning}
														</li>
													))}
												</ul>
											</div>
										)}
								</div>
							)}

							<div className="flex justify-between mt-6">
								<Button
									variant="outline"
									onClick={() => setCurrentStep("platform")}
								>
									Back to Platforms
								</Button>
								<Button
									onClick={() => setCurrentStep("dependencies")}
									disabled={
										!contractName.trim() || !currentContract.code.trim()
									}
								>
									Continue to Dependencies
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Step 3: Dependencies */}
			{currentStep === "dependencies" && selectedPlatform && (
				<div className="space-y-6">
					<DependencyManager
						platform={selectedPlatform}
						dependencies={multiChainState.dependencies}
						onDependenciesChange={(deps) =>
							setMultiChainState((prev) => ({ ...prev, dependencies: deps }))
						}
						disabled={isLoading}
					/>

					<div className="flex justify-between">
						<Button
							variant="outline"
							onClick={() => setCurrentStep("contract")}
						>
							Back to Contract
						</Button>
						<Button
							onClick={handleSubmit}
							disabled={!canSubmit}
							className="min-w-[120px]"
						>
							{isLoading ? "Starting Analysis..." : "Start Audit"}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
};
