"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiCall } from "@/utils/api";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
	Cloud,
	Link,
	Shield,
	CheckCircle,
	XCircle,
	AlertCircle,
	Download,
	Upload,
	Wallet,
	Database,
	RefreshCw,
} from "lucide-react";

interface StorageStats {
	ipfsAvailable: boolean;
	blockchainAvailable: boolean;
	totalAudits: number;
	ipfsStored: number;
	blockchainStored: number;
	walletAddress?: string;
	walletBalance?: string;
}

interface VerificationResult {
	isValid: boolean;
	onChain: boolean;
	ipfsAccessible: boolean;
	details: Record<string, unknown>;
}

interface DecentralizedStorageInfoProps {
	auditId?: string;
	showStats?: boolean;
	showVerification?: boolean;
	showMigration?: boolean;
}

export default function DecentralizedStorageInfo({
	auditId,
	showStats = true,
	showVerification = true,
	showMigration = false,
}: DecentralizedStorageInfoProps) {
	const [stats, setStats] = useState<StorageStats | null>(null);
	const [verification, setVerification] = useState<VerificationResult | null>(
		null
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [migrationProgress, setMigrationProgress] = useState<{
		migrated: number;
		failed: number;
		errors: string[];
	} | null>(null);

	const fetchStorageStats = async () => {
		try {
			setLoading(true);
			const data = await apiCall("/api/storage/stats");
			setStats(data.data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	};

	const verifyAuditIntegrity = async () => {
		if (!auditId) return;

		try {
			setLoading(true);
			const data = await apiCall(`/api/storage/verify/${auditId}`);
			setVerification(data.data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	};

	const migrateToDecentralizedStorage = async () => {
		try {
			setLoading(true);
			const data = await apiCall("/api/storage/migrate", {
				method: "POST",
				body: JSON.stringify({ batchSize: 10 }),
			});
			setMigrationProgress(data.data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	};

	const storeInDecentralizedStorage = async () => {
		if (!auditId) return;

		try {
			setLoading(true);
			await apiCall(`/api/storage/store/${auditId}`, {
				method: "POST",
				body: JSON.stringify({
					useIPFS: true,
					useBlockchain: true,
					fallbackToDatabase: true,
				}),
			});

			// Refresh stats and verification after storage
			await fetchStorageStats();
			if (auditId) {
				await verifyAuditIntegrity();
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (showStats) {
			fetchStorageStats();
		}
		if (showVerification && auditId) {
			verifyAuditIntegrity();
		}
	}, [
		auditId,
		showStats,
		showVerification,
		fetchStorageStats,
		verifyAuditIntegrity,
	]);

	const getStorageStatusIcon = (available: boolean) => {
		return available ? (
			<CheckCircle className="h-4 w-4 text-green-500" />
		) : (
			<XCircle className="h-4 w-4 text-red-500" />
		);
	};

	const getVerificationIcon = (verified: boolean) => {
		return verified ? (
			<Shield className="h-4 w-4 text-green-500" />
		) : (
			<AlertCircle className="h-4 w-4 text-yellow-500" />
		);
	};

	if (loading && !stats && !verification) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<RefreshCw className="h-5 w-5 animate-spin" />
						Loading Storage Information...
					</CardTitle>
				</CardHeader>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			{error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			<Tabs defaultValue="overview" className="w-full">
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="verification">Verification</TabsTrigger>
					<TabsTrigger value="actions">Actions</TabsTrigger>
					<TabsTrigger value="migration">Migration</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="space-y-4">
					{stats && (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Cloud className="h-5 w-5" />
										IPFS Storage
									</CardTitle>
									<CardDescription>
										Decentralized file storage via IPFS
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<span>Status</span>
											<div className="flex items-center gap-2">
												{getStorageStatusIcon(stats.ipfsAvailable)}
												<Badge
													variant={
														stats.ipfsAvailable ? "default" : "secondary"
													}
												>
													{stats.ipfsAvailable ? "Available" : "Not Configured"}
												</Badge>
											</div>
										</div>
										<div className="flex items-center justify-between">
											<span>Stored Reports</span>
											<span className="font-mono">{stats.ipfsStored}</span>
										</div>
										<Progress
											value={
												stats.totalAudits > 0
													? (stats.ipfsStored / stats.totalAudits) * 100
													: 0
											}
											className="h-2"
										/>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Link className="h-5 w-5" />
										Blockchain Storage
									</CardTitle>
									<CardDescription>
										On-chain audit record verification
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<span>Status</span>
											<div className="flex items-center gap-2">
												{getStorageStatusIcon(stats.blockchainAvailable)}
												<Badge
													variant={
														stats.blockchainAvailable ? "default" : "secondary"
													}
												>
													{stats.blockchainAvailable
														? "Available"
														: "Not Configured"}
												</Badge>
											</div>
										</div>
										<div className="flex items-center justify-between">
											<span>On-Chain Records</span>
											<span className="font-mono">
												{stats.blockchainStored}
											</span>
										</div>
										<Progress
											value={
												stats.totalAudits > 0
													? (stats.blockchainStored / stats.totalAudits) * 100
													: 0
											}
											className="h-2"
										/>
										{stats.walletAddress && (
											<div className="pt-2 space-y-1">
												<div className="flex items-center gap-2 text-sm text-muted-foreground">
													<Wallet className="h-3 w-3" />
													<span className="font-mono text-xs">
														{stats.walletAddress}
													</span>
												</div>
												<div className="text-sm">
													Balance: {stats.walletBalance} ETH
												</div>
											</div>
										)}
									</div>
								</CardContent>
							</Card>
						</div>
					)}
				</TabsContent>

				<TabsContent value="verification" className="space-y-4">
					{auditId && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Shield className="h-5 w-5" />
									Audit Integrity Verification
								</CardTitle>
								<CardDescription>
									Verify audit record integrity across storage systems
								</CardDescription>
							</CardHeader>
							<CardContent>
								{verification ? (
									<div className="space-y-4">
										<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
											<div className="flex items-center gap-2">
												{getVerificationIcon(verification.isValid)}
												<span>Overall Valid</span>
												<Badge
													variant={
														verification.isValid ? "default" : "destructive"
													}
												>
													{verification.isValid ? "Valid" : "Invalid"}
												</Badge>
											</div>
											<div className="flex items-center gap-2">
												{getVerificationIcon(verification.onChain)}
												<span>On-Chain</span>
												<Badge
													variant={
														verification.onChain ? "default" : "secondary"
													}
												>
													{verification.onChain ? "Yes" : "No"}
												</Badge>
											</div>
											<div className="flex items-center gap-2">
												{getVerificationIcon(verification.ipfsAccessible)}
												<span>IPFS Accessible</span>
												<Badge
													variant={
														verification.ipfsAccessible
															? "default"
															: "secondary"
													}
												>
													{verification.ipfsAccessible ? "Yes" : "No"}
												</Badge>
											</div>
										</div>

										<Button
											onClick={verifyAuditIntegrity}
											disabled={loading}
											variant="outline"
											size="sm"
										>
											<RefreshCw
												className={`h-4 w-4 mr-2 ${
													loading ? "animate-spin" : ""
												}`}
											/>
											Re-verify
										</Button>
									</div>
								) : (
									<Button onClick={verifyAuditIntegrity} disabled={loading}>
										<Shield className="h-4 w-4 mr-2" />
										Verify Integrity
									</Button>
								)}
							</CardContent>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="actions" className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{auditId && (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Upload className="h-5 w-5" />
										Store in Decentralized Storage
									</CardTitle>
									<CardDescription>
										Upload this audit to IPFS and blockchain
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Button
										onClick={storeInDecentralizedStorage}
										disabled={loading}
										className="w-full"
									>
										<Upload className="h-4 w-4 mr-2" />
										Store Now
									</Button>
								</CardContent>
							</Card>
						)}

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Download className="h-5 w-5" />
									Retrieve from Storage
								</CardTitle>
								<CardDescription>
									Download audit from decentralized storage
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Button
									onClick={() => {
										if (auditId) {
											window.open(`/api/storage/retrieve/${auditId}`, "_blank");
										}
									}}
									disabled={!auditId}
									variant="outline"
									className="w-full"
								>
									<Download className="h-4 w-4 mr-2" />
									Download Report
								</Button>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="migration" className="space-y-4">
					{showMigration && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Database className="h-5 w-5" />
									Migrate to Decentralized Storage
								</CardTitle>
								<CardDescription>
									Migrate existing audits to IPFS and blockchain storage
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{migrationProgress ? (
									<div className="space-y-2">
										<div className="flex justify-between text-sm">
											<span>Migrated: {migrationProgress.migrated}</span>
											<span>Failed: {migrationProgress.failed}</span>
										</div>
										{migrationProgress.errors.length > 0 && (
											<Alert>
												<AlertCircle className="h-4 w-4" />
												<AlertDescription>
													{migrationProgress.errors.length} errors occurred
													during migration
												</AlertDescription>
											</Alert>
										)}
									</div>
								) : (
									<Button
										onClick={migrateToDecentralizedStorage}
										disabled={loading}
										className="w-full"
									>
										<RefreshCw
											className={`h-4 w-4 mr-2 ${
												loading ? "animate-spin" : ""
											}`}
										/>
										Start Migration
									</Button>
								)}
							</CardContent>
						</Card>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}
