"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ContractUploader } from "@/components/features/contracts";
import { contractService } from "@/services/contractService";
import { useAuth } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/features/auth";

export default function UploadPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	const { user } = useAuth();

	const handleContractSubmit = async (contract: {
		name: string;
		sourceCode: string;
		compilerVersion?: string;
	}) => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await contractService.createContract({
				name: contract.name,
				sourceCode: contract.sourceCode,
				compilerVersion: contract.compilerVersion,
			});

			if (response.success && response.data) {
				// Redirect to audit page or dashboard
				router.push(`/dashboard?contract=${response.data.id}`);
			} else {
				setError(response.error || "Failed to upload contract");
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "An unexpected error occurred"
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		// <AuthGuard>
		<div className="min-h-screen bg-gray-50 py-8">
			<div className="container mx-auto px-4">
				<div className="mb-8 text-center">
					<h1 className="text-3xl font-bold text-gray-900 mb-2">
						Upload Smart Contract
					</h1>
					<p className="text-gray-600">
						Upload your Solidity contract to start a comprehensive security
						audit
					</p>
				</div>

				{error && (
					<div className="mb-6 max-w-4xl mx-auto">
						<div className="bg-red-50 border border-red-200 rounded-md p-4">
							<div className="flex">
								<div className="flex-shrink-0">
									<svg
										className="h-5 w-5 text-red-400"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fillRule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
											clipRule="evenodd"
										/>
									</svg>
								</div>
								<div className="ml-3">
									<h3 className="text-sm font-medium text-red-800">
										Upload Failed
									</h3>
									<div className="mt-2 text-sm text-red-700">
										<p>{error}</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				<ContractUploader
					onContractSubmit={handleContractSubmit}
					isLoading={isLoading}
				/>

				<div className="mt-8 max-w-4xl mx-auto">
					<div className="bg-blue-50 border border-blue-200 rounded-md p-4">
						<div className="flex">
							<div className="flex-shrink-0">
								<svg
									className="h-5 w-5 text-blue-400"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path
										fillRule="evenodd"
										d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
							<div className="ml-3">
								<h3 className="text-sm font-medium text-blue-800">
									What happens next?
								</h3>
								<div className="mt-2 text-sm text-blue-700">
									<ul className="list-disc list-inside space-y-1">
										<li>Your contract will be validated for syntax errors</li>
										<li>Static analysis will be performed using Slither</li>
										<li>
											AI-powered security analysis will identify vulnerabilities
										</li>
										<li>A comprehensive audit report will be generated</li>
										<li>You'll receive an email notification when complete</li>
									</ul>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		// </AuthGuard>
	);
}
