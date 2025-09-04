"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ContractUploader } from "@/components/features/contracts";
import { contractService } from "@/services/contractService";
import { useAuth } from "@/hooks/useAuth";
import { Navigation } from "@/components/ui/navigation";
import { ContractInput } from "@/types";
// import { AuthGuard } from "@/components/features/auth";

export default function UploadPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	// const { user } = useAuth();

	const handleContractSubmit = async (contract: {
		name: string;
		sourceCode: string;
		compilerVersion?: string;
		platforms?: string[];
		crossChainAnalysis?: boolean;
		dependencies?: ContractInput[];
	}) => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await contractService.createContract({
				name: contract.name,
				sourceCode: contract.sourceCode,
				compilerVersion: contract.compilerVersion,
				platforms: contract.platforms,
				crossChainAnalysis: contract.crossChainAnalysis,
				dependencies: contract.dependencies,
			});

			if (response.success && response.data) {
				// Redirect to audit page or dashboard
				router.push(`/dashboard?contract=${response.data.id}`);
			} else {
				const errorMessage =
					typeof response.error === "string"
						? response.error
						: response.error?.message || "Failed to upload contract";
				setError(errorMessage);
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
		<div className="min-h-screen bg-background">
			<Navigation />
			<div className="container mx-auto px-4 py-8">
				<div className="mb-8 text-center">
					<h1 className="text-3xl font-bold text-foreground mb-2">
						Upload Smart Contract
					</h1>
					<p className="text-muted-foreground">
						Upload your smart contract from any supported blockchain platform to
						start a comprehensive security audit
					</p>
				</div>

				{error && (
					<div className="mb-6 max-w-4xl mx-auto">
						<div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
							<div className="flex">
								<div className="flex-shrink-0">
									<svg
										className="h-5 w-5 text-destructive"
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
									<h3 className="text-sm font-medium text-destructive">
										Upload Failed
									</h3>
									<div className="mt-2 text-sm text-destructive/80">
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
					<div className="bg-primary/10 border border-primary/20 rounded-md p-4">
						<div className="flex">
							<div className="flex-shrink-0">
								<svg
									className="h-5 w-5 text-primary"
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
								<h3 className="text-sm font-medium text-primary">
									What happens next?
								</h3>
								<div className="mt-2 text-sm text-primary/80">
									<ul className="list-disc list-inside space-y-1">
										<li>
											Your contract will be validated for platform-specific
											syntax and security patterns
										</li>
										<li>
											Static analysis will be performed using
											blockchain-specific tools
										</li>
										<li>
											AI-powered security analysis will identify vulnerabilities
											and best practices
										</li>
										<li>
											Cross-chain analysis will be performed if multiple
											platforms are selected
										</li>
										<li>
											A comprehensive audit report will be generated with
											platform-specific recommendations
										</li>
										<li>
											You&apos;ll receive an email notification when complete
										</li>
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
