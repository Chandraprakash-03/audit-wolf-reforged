"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ContractUploadState } from "@/types";
import { validateSolidityCode, validateFile } from "@/utils/contractValidation";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";

interface ContractUploaderProps {
	onContractSubmit: (contract: {
		name: string;
		sourceCode: string;
		compilerVersion?: string;
	}) => void;
	isLoading?: boolean;
}

export const ContractUploader: React.FC<ContractUploaderProps> = ({
	onContractSubmit,
	isLoading = false,
}) => {
	const [uploadState, setUploadState] = useState<ContractUploadState>({
		file: null,
		code: "",
		isValid: false,
		errors: [],
	});

	const [contractName, setContractName] = useState("");
	const [compilerVersion, setCompilerVersion] = useState("0.8.0");
	const [inputMode, setInputMode] = useState<"upload" | "paste">("upload");

	const validateContract = useCallback((code: string) => {
		const validation = validateSolidityCode(code);
		setUploadState((prev) => ({
			...prev,
			code,
			isValid: validation.isValid,
			errors: validation.errors,
		}));
	}, []);

	const handleFileUpload = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;

			const fileValidation = validateFile(file);
			if (!fileValidation.isValid) {
				setUploadState((prev) => ({
					...prev,
					file: null,
					code: "",
					isValid: false,
					errors: fileValidation.errors,
				}));
				return;
			}

			const reader = new FileReader();
			reader.onload = (e) => {
				const content = e.target?.result as string;
				validateContract(content);
				setUploadState((prev) => ({
					...prev,
					file,
				}));

				// Auto-set contract name from filename if not already set
				if (!contractName) {
					const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, "");
					setContractName(nameWithoutExtension);
				}
			};
			reader.readAsText(file);
		},
		[contractName, validateContract]
	);

	const handleCodePaste = useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>) => {
			const code = event.target.value;
			validateContract(code);
		},
		[validateContract]
	);

	const handleSubmit = useCallback(() => {
		if (!uploadState.isValid || !contractName.trim()) return;

		onContractSubmit({
			name: contractName.trim(),
			sourceCode: uploadState.code,
			compilerVersion,
		});
	}, [
		uploadState.isValid,
		uploadState.code,
		contractName,
		compilerVersion,
		onContractSubmit,
	]);

	const canSubmit = uploadState.isValid && contractName.trim() && !isLoading;

	return (
		<Card className="w-full max-w-4xl mx-auto">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<FileText className="h-5 w-5" />
					Upload Smart Contract
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Input Mode Toggle */}
				<div className="flex gap-2">
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
						Paste Code
					</Button>
				</div>

				{/* Contract Details */}
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
							placeholder="0.8.0"
							disabled={isLoading}
						/>
					</div>
				</div>

				{/* File Upload Mode */}
				{inputMode === "upload" && (
					<div className="space-y-2">
						<Label htmlFor="fileUpload">Solidity File (.sol)</Label>
						<div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
							<Input
								id="fileUpload"
								type="file"
								accept=".sol"
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
									{uploadState.file
										? uploadState.file.name
										: "Click to upload or drag and drop"}
								</span>
								<span className="text-xs text-gray-400">
									Solidity files only, max 10MB
								</span>
							</Label>
						</div>
					</div>
				)}

				{/* Code Paste Mode */}
				{inputMode === "paste" && (
					<div className="space-y-2">
						<Label htmlFor="codeInput">Solidity Source Code</Label>
						<Textarea
							id="codeInput"
							value={uploadState.code}
							onChange={handleCodePaste}
							placeholder="pragma solidity ^0.8.0;&#10;&#10;contract MyContract {&#10;    // Your contract code here&#10;}"
							className="min-h-[300px] font-mono text-sm"
							disabled={isLoading}
						/>
					</div>
				)}

				{/* Validation Status */}
				{uploadState.code && (
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							{uploadState.isValid ? (
								<>
									<CheckCircle className="h-5 w-5 text-green-500" />
									<span className="text-green-700 font-medium">
										Contract is valid
									</span>
								</>
							) : (
								<>
									<AlertCircle className="h-5 w-5 text-red-500" />
									<span className="text-red-700 font-medium">
										Validation errors found
									</span>
								</>
							)}
						</div>

						{uploadState.errors.length > 0 && (
							<div className="bg-red-50 border border-red-200 rounded-md p-3">
								<ul className="text-sm text-red-700 space-y-1">
									{uploadState.errors.map((error, index) => (
										<li key={index} className="flex items-start gap-2">
											<span className="text-red-500">•</span>
											{error}
										</li>
									))}
								</ul>
							</div>
						)}
					</div>
				)}

				{/* Submit Button */}
				<div className="flex justify-end">
					<Button
						onClick={handleSubmit}
						disabled={!canSubmit}
						className="min-w-[120px]"
					>
						{isLoading ? "Uploading..." : "Start Audit"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
};
