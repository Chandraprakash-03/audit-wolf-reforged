import {
	useState,
	useEffect,
	JSXElementConstructor,
	Key,
	ReactElement,
	ReactNode,
	ReactPortal,
} from "react";
import { Vulnerability, Audit, AuditReport, MultiChainAudit } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auditService } from "@/services/auditService";
import DecentralizedStorageInfo from "../DecentralizedStorageInfo";
import { BLOCKCHAIN_PLATFORMS } from "@/data/blockchainPlatforms";

interface ReportViewerProps {
	audit: Audit | MultiChainAudit;
	onClose: () => void;
}

export function ReportViewer({ audit, onClose }: ReportViewerProps) {
	const [report, setReport] = useState<AuditReport | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		loadReport();
	}, [audit.id]);

	const isMultiChainAudit = (
		audit: Audit | MultiChainAudit
	): audit is MultiChainAudit => {
		return "platforms" in audit;
	};

	const loadReport = async () => {
		setLoading(true);
		setError(null);

		try {
			let response;

			if (isMultiChainAudit(audit)) {
				// For multi-chain audits, get the report from the multi-chain endpoint
				response = await auditService.getMultiChainAudit(audit.id);
			} else {
				// For regular audits, use the existing endpoint
				response = await auditService.getAuditReport(audit.id);
			}

			if (response.success && response.data) {
				if (isMultiChainAudit(audit)) {
					// For multi-chain audits, the report data is structured differently
					setReport(response.data as any);
				} else {
					setReport(response.data);
				}
			} else {
				const errorMessage =
					typeof response.error === "string"
						? response.error
						: response.error?.message || "Failed to load report";
				setError(errorMessage);
			}
		} catch (err) {
			setError("Error loading report");
			console.error("Error loading report:", err);
		} finally {
			setLoading(false);
		}
	};

	const getSeverityBadgeVariant = (severity: string) => {
		switch (severity.toLowerCase()) {
			case "critical":
				return "critical";
			case "high":
				return "destructive";
			case "medium":
				return "warning";
			case "low":
				return "secondary";
			case "informational":
				return "outline";
			default:
				return "outline";
		}
	};

	const formatDate = (date: Date | string) => {
		return (
			new Date(date).toLocaleDateString() +
			" " +
			new Date(date).toLocaleTimeString()
		);
	};

	const getVulnerabilityCounts = (report: AuditReport | any) => {
		const reportData = report as any;

		// Handle multi-chain audit results
		if (isMultiChainAudit(audit) && reportData.results) {
			const totalCounts = {
				critical: 0,
				high: 0,
				medium: 0,
				low: 0,
				informational: 0,
			};

			Object.values(reportData.results).forEach((platformResult: any) => {
				if (platformResult.vulnerabilities) {
					platformResult.vulnerabilities.forEach((vuln: any) => {
						if (vuln.severity in totalCounts) {
							totalCounts[vuln.severity as keyof typeof totalCounts]++;
						}
					});
				}
			});

			return totalCounts;
		}

		// Check if the report has count properties (frontend database type)
		if (typeof reportData.critical_count === "number") {
			return {
				critical: reportData.critical_count || 0,
				high: reportData.high_count || 0,
				medium: reportData.medium_count || 0,
				low: reportData.low_count || 0,
				informational: reportData.informational_count || 0,
			};
		}

		// Fallback: calculate from vulnerabilities array (backend type)
		if (Array.isArray(reportData.vulnerabilities)) {
			const vulnerabilities = reportData.vulnerabilities;
			return {
				critical: vulnerabilities.filter((v: any) => v.severity === "critical")
					.length,
				high: vulnerabilities.filter((v: any) => v.severity === "high").length,
				medium: vulnerabilities.filter((v: any) => v.severity === "medium")
					.length,
				low: vulnerabilities.filter((v: any) => v.severity === "low").length,
				informational: vulnerabilities.filter(
					(v: any) => v.severity === "informational"
				).length,
			};
		}

		return {
			critical: 0,
			high: 0,
			medium: 0,
			low: 0,
			informational: 0,
		};
	};

	const getPlatformDisplayName = (platformId: string) => {
		const platform = BLOCKCHAIN_PLATFORMS.find((p) => p.id === platformId);
		return platform?.displayName || platformId;
	};

	const getAllVulnerabilities = (report: any) => {
		if (isMultiChainAudit(audit) && report.results) {
			const allVulns: any[] = [];
			Object.entries(report.results).forEach(
				([platform, platformResult]: [string, any]) => {
					if (platformResult.vulnerabilities) {
						platformResult.vulnerabilities.forEach((vuln: any) => {
							allVulns.push({
								...vuln,
								platform,
								platformDisplayName: getPlatformDisplayName(platform),
							});
						});
					}
				}
			);
			return allVulns;
		}

		// For single-chain audits, extract security vulnerabilities from recommendations
		const vulnerabilities = report.vulnerabilities || [];

		// Debug logging
		console.log("Report recommendations:", report.recommendations);

		const securityVulnerabilities = (report.recommendations || [])
			.filter((rec: any) => {
				const isSecurityCategory =
					rec.category === "Security" || rec.category === "Access Control";
				console.log(
					`Recommendation category: ${rec.category}, isSecurityCategory: ${isSecurityCategory}`
				);
				return isSecurityCategory;
			})
			.map((rec: any, index: number) => ({
				id: `security-${index}`,
				title:
					rec.category === "Access Control"
						? "Access Control Issue"
						: "Security Vulnerability",
				description: rec.description,
				severity: rec.priority,
				location: { file: "contract.sol", line: 1, column: 1 },
				recommendation: rec.implementation_guide || rec.description,
				type: "security",
				source: "analysis",
			}));

		console.log("Security vulnerabilities extracted:", securityVulnerabilities);

		return [...vulnerabilities, ...securityVulnerabilities];
	};

	if (loading) {
		return (
			<div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
				<Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
					<CardContent className="p-8 text-center">
						<p>Loading report...</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (error) {
		return (
			<div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
				<Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
					<CardHeader>
						<CardTitle className="flex justify-between items-center">
							Error Loading Report
							<Button variant="outline" onClick={onClose}>
								Close
							</Button>
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-destructive">{error}</p>
						<Button onClick={loadReport} className="mt-4">
							Retry
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!report) {
		return null;
	}

	// Use report data or fallback to audit data
	const vulnerabilities = getAllVulnerabilities(report);

	// Debug logging
	console.log("Final vulnerabilities array:", vulnerabilities);
	const gasOptimizations = isMultiChainAudit(audit)
		? [] // Multi-chain gas optimizations would need special handling
		: report.gas_optimizations ||
		  (audit as Audit).final_report?.gas_optimizations ||
		  [];
	const recommendations = isMultiChainAudit(audit)
		? (report as any).cross_chain_results?.crossChainRecommendations || []
		: report.recommendations ||
		  (audit as Audit).final_report?.recommendations ||
		  [];

	// Get vulnerability counts using helper function
	const counts = getVulnerabilityCounts(report);

	return (
		<div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<Card className="w-full max-w-6xl max-h-[90vh] overflow-auto">
				<CardHeader>
					<CardTitle className="flex justify-between items-center">
						{isMultiChainAudit(audit)
							? "Multi-Chain Audit Report"
							: "Audit Report"}
						<div className="flex items-center gap-2">
							{isMultiChainAudit(audit) && (
								<div className="flex gap-1">
									{audit.platforms.slice(0, 3).map((platform) => (
										<Badge key={platform} variant="outline" className="text-xs">
											{getPlatformDisplayName(platform)}
										</Badge>
									))}
									{audit.platforms.length > 3 && (
										<Badge variant="outline" className="text-xs">
											+{audit.platforms.length - 3} more
										</Badge>
									)}
								</div>
							)}
							<Button variant="outline" onClick={onClose}>
								Close
							</Button>
						</div>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<Tabs defaultValue="report" className="w-full">
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="report">Report</TabsTrigger>
							<TabsTrigger value="storage">Storage</TabsTrigger>
						</TabsList>

						<TabsContent value="report" className="space-y-6 mt-6">
							{/* Executive Summary */}
							<div>
								<h3 className="text-lg font-semibold mb-2">
									Executive Summary
								</h3>
								<p className="text-muted-foreground">
									{isMultiChainAudit(audit)
										? `Multi-chain audit covering ${
												audit.platforms.length
										  } blockchain platforms: ${audit.platforms
												.map((p) => getPlatformDisplayName(p))
												.join(", ")}.`
										: report.executive_summary ||
										  "No executive summary available."}
								</p>
							</div>

							{/* Vulnerability Overview */}
							<div>
								<h3 className="text-lg font-semibold mb-4">
									Vulnerability Overview
								</h3>
								<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
									<Card>
										<CardContent className="p-4 text-center">
											<div className="text-2xl font-bold text-red-600">
												{counts.critical}
											</div>
											<div className="text-sm text-muted-foreground">
												Critical
											</div>
										</CardContent>
									</Card>
									<Card>
										<CardContent className="p-4 text-center">
											<div className="text-2xl font-bold text-orange-600">
												{counts.high}
											</div>
											<div className="text-sm text-muted-foreground">High</div>
										</CardContent>
									</Card>
									<Card>
										<CardContent className="p-4 text-center">
											<div className="text-2xl font-bold text-yellow-600">
												{counts.medium}
											</div>
											<div className="text-sm text-muted-foreground">
												Medium
											</div>
										</CardContent>
									</Card>
									<Card>
										<CardContent className="p-4 text-center">
											<div className="text-2xl font-bold text-blue-600">
												{counts.low}
											</div>
											<div className="text-sm text-muted-foreground">Low</div>
										</CardContent>
									</Card>
									<Card>
										<CardContent className="p-4 text-center">
											<div className="text-2xl font-bold text-gray-600">
												{counts.informational}
											</div>
											<div className="text-sm text-muted-foreground">Info</div>
										</CardContent>
									</Card>
								</div>
							</div>

							{/* Debug Information (remove in production)
							{process.env.NODE_ENV === "development" && (
								<div className="bg-muted p-4 rounded border">
									<h4 className="font-semibold mb-2">Debug Info:</h4>
									<p className="text-sm">
										Total vulnerabilities found: {vulnerabilities.length}
									</p>
									<p className="text-sm">
										Report keys: {Object.keys(report).join(", ")}
									</p>
									<p className="text-sm">
										Audit type:{" "}
										{isMultiChainAudit(audit) ? "Multi-chain" : "Single-chain"}
									</p>
								</div>
							)} */}

							{/* Vulnerabilities */}
							<div>
								<h3 className="text-lg font-semibold mb-4">
									Vulnerabilities{" "}
									{vulnerabilities.length > 0 &&
										`(${vulnerabilities.length} found)`}
								</h3>
								{vulnerabilities.length > 0 ? (
									<div className="space-y-4">
										{vulnerabilities.map(
											(
												vuln: {
													title:
														| string
														| number
														| bigint
														| boolean
														| ReactElement<
																unknown,
																string | JSXElementConstructor<any>
														  >
														| Iterable<ReactNode>
														| ReactPortal
														| Promise<
																| string
																| number
																| bigint
																| boolean
																| ReactPortal
																| ReactElement<
																		unknown,
																		string | JSXElementConstructor<any>
																  >
																| Iterable<ReactNode>
																| null
																| undefined
														  >
														| null
														| undefined;
													platformDisplayName:
														| string
														| number
														| bigint
														| boolean
														| ReactElement<
																unknown,
																string | JSXElementConstructor<any>
														  >
														| Iterable<ReactNode>
														| ReactPortal
														| Promise<
																| string
																| number
																| bigint
																| boolean
																| ReactPortal
																| ReactElement<
																		unknown,
																		string | JSXElementConstructor<any>
																  >
																| Iterable<ReactNode>
																| null
																| undefined
														  >
														| null
														| undefined;
													severity:
														| string
														| number
														| bigint
														| boolean
														| ReactElement<
																unknown,
																string | JSXElementConstructor<any>
														  >
														| Iterable<ReactNode>
														| Promise<
																| string
																| number
																| bigint
																| boolean
																| ReactPortal
																| ReactElement<
																		unknown,
																		string | JSXElementConstructor<any>
																  >
																| Iterable<ReactNode>
																| null
																| undefined
														  >
														| null
														| undefined;
													description:
														| string
														| number
														| bigint
														| boolean
														| ReactElement<
																unknown,
																string | JSXElementConstructor<any>
														  >
														| Iterable<ReactNode>
														| ReactPortal
														| Promise<
																| string
																| number
																| bigint
																| boolean
																| ReactPortal
																| ReactElement<
																		unknown,
																		string | JSXElementConstructor<any>
																  >
																| Iterable<ReactNode>
																| null
																| undefined
														  >
														| null
														| undefined;
													location: {
														file:
															| string
															| number
															| bigint
															| boolean
															| ReactElement<
																	unknown,
																	string | JSXElementConstructor<any>
															  >
															| Iterable<ReactNode>
															| ReactPortal
															| Promise<
																	| string
																	| number
																	| bigint
																	| boolean
																	| ReactPortal
																	| ReactElement<
																			unknown,
																			string | JSXElementConstructor<any>
																	  >
																	| Iterable<ReactNode>
																	| null
																	| undefined
															  >
															| null
															| undefined;
														line:
															| string
															| number
															| bigint
															| boolean
															| ReactElement<
																	unknown,
																	string | JSXElementConstructor<any>
															  >
															| Iterable<ReactNode>
															| ReactPortal
															| Promise<
																	| string
																	| number
																	| bigint
																	| boolean
																	| ReactPortal
																	| ReactElement<
																			unknown,
																			string | JSXElementConstructor<any>
																	  >
																	| Iterable<ReactNode>
																	| null
																	| undefined
															  >
															| null
															| undefined;
														column:
															| string
															| number
															| bigint
															| boolean
															| ReactElement<
																	unknown,
																	string | JSXElementConstructor<any>
															  >
															| Iterable<ReactNode>
															| ReactPortal
															| Promise<
																	| string
																	| number
																	| bigint
																	| boolean
																	| ReactPortal
																	| ReactElement<
																			unknown,
																			string | JSXElementConstructor<any>
																	  >
																	| Iterable<ReactNode>
																	| null
																	| undefined
															  >
															| null
															| undefined;
													};
													recommendation:
														| string
														| number
														| bigint
														| boolean
														| ReactElement<
																unknown,
																string | JSXElementConstructor<any>
														  >
														| Iterable<ReactNode>
														| ReactPortal
														| Promise<
																| string
																| number
																| bigint
																| boolean
																| ReactPortal
																| ReactElement<
																		unknown,
																		string | JSXElementConstructor<any>
																  >
																| Iterable<ReactNode>
																| null
																| undefined
														  >
														| null
														| undefined;
												},
												index: Key | null | undefined
											) => (
												<Card key={index}>
													<CardContent className="p-4">
														<div className="flex justify-between items-start mb-2">
															<div className="flex items-center gap-2">
																<h4 className="font-medium">{vuln.title}</h4>
																{vuln.platformDisplayName && (
																	<Badge variant="outline" className="text-xs">
																		{vuln.platformDisplayName}
																	</Badge>
																)}
															</div>
															<Badge
																variant={getSeverityBadgeVariant(
																	String(vuln.severity || "low")
																)}
															>
																{String(vuln.severity || "Unknown")}
															</Badge>
														</div>
														<p className="text-foreground mb-2">
															{vuln.description}
														</p>
														<div className="text-sm text-muted-foreground mb-2">
															Location: {vuln.location.file}:
															{vuln.location.line}:{vuln.location.column}
														</div>
														{vuln.recommendation && (
															<div className="bg-muted p-3 rounded border">
																<strong>Recommendation:</strong>{" "}
																{vuln.recommendation}
															</div>
														)}
													</CardContent>
												</Card>
											)
										)}
									</div>
								) : (
									<div className="text-center py-8 text-muted-foreground">
										No vulnerabilities found in this audit.
									</div>
								)}
							</div>

							{/* Gas Optimizations */}
							{gasOptimizations.length > 0 && (
								<div>
									<h3 className="text-lg font-semibold mb-4">
										Gas Optimizations
									</h3>
									<div className="space-y-4">
										{gasOptimizations.map((opt, index) => (
											<Card key={index}>
												<CardContent className="p-4">
													<div className="flex justify-between items-start mb-2">
														<h4 className="font-medium">{opt.type}</h4>
														<Badge variant="success">
															Save ~{opt.estimated_savings} gas
														</Badge>
													</div>
													<p className="text-foreground mb-2">
														{opt.description}
													</p>
													<div className="text-sm text-muted-foreground">
														Location: {opt.location.file}:{opt.location.line}:
														{opt.location.column}
													</div>
												</CardContent>
											</Card>
										))}
									</div>
								</div>
							)}

							{/* Recommendations */}
							{recommendations.length > 0 && (
								<div>
									<h3 className="text-lg font-semibold mb-4">
										General Recommendations
									</h3>
									<div className="space-y-2">
										{recommendations.map(
											(
												rec:
													| string
													| number
													| bigint
													| boolean
													| ReactElement<
															unknown,
															string | JSXElementConstructor<any>
													  >
													| Iterable<ReactNode>
													| ReactPortal
													| Promise<
															| string
															| number
															| bigint
															| boolean
															| ReactPortal
															| ReactElement<
																	unknown,
																	string | JSXElementConstructor<any>
															  >
															| Iterable<ReactNode>
															| null
															| undefined
													  >
													| null
													| undefined,
												index: Key | null | undefined
											) => (
												<div
													key={index}
													className="bg-muted p-3 rounded border"
												>
													{typeof rec === "string"
														? rec
														: (rec as any)?.description ||
														  "No description available"}
												</div>
											)
										)}
									</div>
								</div>
							)}

							{/* Report Metadata */}
							<div className="border-t pt-4 text-sm text-muted-foreground">
								<p>
									Report generated:{" "}
									{formatDate(report.generated_at || audit.created_at)}
								</p>
								{!isMultiChainAudit(audit) && (audit as Audit).ipfs_hash && (
									<p>
										IPFS Hash:{" "}
										<code className="bg-muted px-1 rounded">
											{(audit as Audit).ipfs_hash}
										</code>
									</p>
								)}
								{isMultiChainAudit(audit) && (
									<div className="mt-2">
										<p>Audit Type: Multi-Chain Analysis</p>
										<p>Platforms: {audit.platforms.join(", ")}</p>
										{audit.cross_chain_analysis && (
											<p>Cross-Chain Analysis: Enabled</p>
										)}
									</div>
								)}
							</div>
						</TabsContent>

						<TabsContent value="storage" className="mt-6">
							{!isMultiChainAudit(audit) ? (
								<DecentralizedStorageInfo
									auditId={audit.id}
									showStats={true}
									showVerification={true}
									showMigration={false}
								/>
							) : (
								<div className="text-center py-8 text-muted-foreground">
									Decentralized storage for multi-chain audits is coming soon.
								</div>
							)}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</div>
	);
}
