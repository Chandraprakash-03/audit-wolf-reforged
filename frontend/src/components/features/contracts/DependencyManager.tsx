"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
	Plus,
	Trash2,
	FileText,
	AlertCircle,
	CheckCircle,
	Upload,
} from "lucide-react";
import { ContractInput, BlockchainPlatform } from "@/types";
import { validateCodeForPlatform } from "@/utils/platformValidation";

interface DependencyManagerProps {
	platform: BlockchainPlatform;
	dependencies: ContractInput[];
	onDependenciesChange: (dependencies: ContractInput[]) => void;
	disabled?: boolean;
}

export const DependencyManager: React.FC<DependencyManagerProps> = ({
	platform,
	dependencies,
	onDependenciesChange,
	disabled = false,
}) => {
	const [newDependency, setNewDependency] = useState<Partial<ContractInput>>({
		filename: "",
		code: "",
		platform: platform.id,
	});
	const [isAddingDependency, setIsAddingDependency] = useState(false);

	const handleAddDependency = () => {
		if (!newDependency.filename || !newDependency.code) return;

		const dependency: ContractInput = {
			filename: newDependency.filename,
			code: newDependency.code,
			platform: platform.id,
			language: platform.supportedLanguages[0],
		};

		onDependenciesChange([...dependencies, dependency]);
		setNewDependency({
			filename: "",
			code: "",
			platform: platform.id,
		});
		setIsAddingDependency(false);
	};

	const handleRemoveDependency = (index: number) => {
		const updated = dependencies.filter((_, i) => i !== index);
		onDependenciesChange(updated);
	};

	const handleFileUpload = (
		event: React.ChangeEvent<HTMLInputElement>,
		index?: number
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;

			if (index !== undefined) {
				// Update existing dependency
				const updated = [...dependencies];
				updated[index] = {
					...updated[index],
					code: content,
					filename: file.name,
				};
				onDependenciesChange(updated);
			} else {
				// Set new dependency
				setNewDependency({
					filename: file.name,
					code: content,
					platform: platform.id,
				});
			}
		};
		reader.readAsText(file);
	};

	const validateDependency = (dependency: ContractInput) => {
		return validateCodeForPlatform(
			dependency.code,
			platform,
			dependency.filename
		);
	};

	const getDependencyStatus = (dependency: ContractInput) => {
		const validation = validateDependency(dependency);
		return {
			isValid: validation.isValid,
			errorCount: validation.errors.length,
			warningCount: validation.warnings.length,
		};
	};

	const getFileExtension = () => {
		return platform.fileExtensions[0] || ".txt";
	};

	const getPlaceholderCode = () => {
		switch (platform.id) {
			case "ethereum":
			case "bsc":
			case "polygon":
				return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library MyLibrary {
    function helper() internal pure returns (uint256) {
        return 42;
    }
}`;
			case "solana":
				return `use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct MyAccounts<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
}`;
			case "cardano":
				return `{-# LANGUAGE DataKinds #-}
module MyModule where

import Plutus.V2.Ledger.Api

myValidator :: BuiltinData -> BuiltinData -> BuiltinData -> ()
myValidator _ _ _ = ()`;
			case "aptos":
			case "sui":
				return `module my_addr::my_module {
    struct MyResource has key {
        value: u64,
    }
}`;
			default:
				return "// Add your dependency code here";
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<FileText className="h-5 w-5" />
					Dependencies
					<Badge variant="outline" className="ml-auto">
						{dependencies.length}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{dependencies.length === 0 && !isAddingDependency && (
					<div className="text-center py-6 text-gray-500">
						<FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p className="text-sm">No dependencies added</p>
						<p className="text-xs mt-1">
							Add libraries, interfaces, or other contracts your main contract
							depends on
						</p>
					</div>
				)}

				{/* Existing Dependencies */}
				{dependencies.map((dependency, index) => {
					const status = getDependencyStatus(dependency);
					return (
						<Card key={index} className="border-l-4 border-l-blue-200">
							<CardContent className="p-4">
								<div className="flex items-start justify-between mb-2">
									<div className="flex items-center gap-2">
										<span className="font-medium text-sm">
											{dependency.filename}
										</span>
										{status.isValid ? (
											<CheckCircle className="h-4 w-4 text-green-500" />
										) : (
											<AlertCircle className="h-4 w-4 text-red-500" />
										)}
									</div>
									<div className="flex items-center gap-2">
										<input
											type="file"
											accept={platform.fileExtensions.join(",")}
											onChange={(e) => handleFileUpload(e, index)}
											className="hidden"
											id={`dep-file-${index}`}
											disabled={disabled}
										/>
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												document.getElementById(`dep-file-${index}`)?.click()
											}
											disabled={disabled}
										>
											<Upload className="h-3 w-3" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleRemoveDependency(index)}
											disabled={disabled}
										>
											<Trash2 className="h-3 w-3 text-red-500" />
										</Button>
									</div>
								</div>

								{!status.isValid && (
									<div className="text-xs text-red-600 mb-2">
										{status.errorCount} error(s), {status.warningCount}{" "}
										warning(s)
									</div>
								)}

								<div className="text-xs text-gray-500">
									{dependency.code.split("\n").length} lines •{" "}
									{dependency.language || platform.supportedLanguages[0]}
								</div>
							</CardContent>
						</Card>
					);
				})}

				{/* Add New Dependency */}
				{isAddingDependency && (
					<Card className="border-dashed border-2">
						<CardContent className="p-4 space-y-4">
							<div className="flex items-center justify-between">
								<Label className="text-sm font-medium">Add Dependency</Label>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setIsAddingDependency(false)}
								>
									Cancel
								</Button>
							</div>

							<div className="space-y-3">
								<div>
									<Label htmlFor="dep-filename" className="text-xs">
										Filename
									</Label>
									<Input
										id="dep-filename"
										value={newDependency.filename}
										onChange={(e) =>
											setNewDependency({
												...newDependency,
												filename: e.target.value,
											})
										}
										placeholder={`MyLibrary${getFileExtension()}`}
										className="text-sm"
									/>
								</div>

								<div className="flex gap-2">
									<div className="flex-1">
										<Label htmlFor="dep-code" className="text-xs">
											Code
										</Label>
										<Textarea
											id="dep-code"
											value={newDependency.code}
											onChange={(e) =>
												setNewDependency({
													...newDependency,
													code: e.target.value,
												})
											}
											placeholder={getPlaceholderCode()}
											className="min-h-[120px] font-mono text-xs"
										/>
									</div>
									<div className="flex flex-col gap-2">
										<Label className="text-xs">Upload</Label>
										<input
											type="file"
											accept={platform.fileExtensions.join(",")}
											onChange={(e) => handleFileUpload(e)}
											className="hidden"
											id="new-dep-file"
										/>
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												document.getElementById("new-dep-file")?.click()
											}
											className="h-8 w-8 p-0"
										>
											<Upload className="h-3 w-3" />
										</Button>
									</div>
								</div>

								<div className="flex justify-end gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => setIsAddingDependency(false)}
									>
										Cancel
									</Button>
									<Button
										size="sm"
										onClick={handleAddDependency}
										disabled={!newDependency.filename || !newDependency.code}
									>
										Add Dependency
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Add Dependency Button */}
				{!isAddingDependency && (
					<Button
						variant="outline"
						onClick={() => setIsAddingDependency(true)}
						className="w-full"
						disabled={disabled}
					>
						<Plus className="h-4 w-4 mr-2" />
						Add Dependency
					</Button>
				)}

				{/* Platform Info */}
				<div className="bg-gray-50 rounded-md p-3">
					<div className="text-xs text-gray-600">
						<p className="font-medium mb-1">
							{platform.displayName} Dependencies
						</p>
						<p>
							Supported files: {platform.fileExtensions.join(", ")} • Languages:{" "}
							{platform.supportedLanguages.join(", ")}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};
