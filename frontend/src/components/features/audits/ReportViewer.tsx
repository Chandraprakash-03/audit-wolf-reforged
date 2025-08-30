import { useState, useEffect } from "react";
import { Vulnerability, Audit, AuditReport } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auditService } from "@/services/auditService";
import DecentralizedStorageInfo from "../DecentralizedStorageInfo";

interface ReportViewerProps {
	audit: Audit;
	onClose: () => void;
}

export function ReportViewer({ audit, onClose }: ReportViewerProps) {
	const [report, setReport] = useState<AuditReport | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		loadReport();
	}, [audit.id]);

	const loadReport = async () => {
		setLoading(true);
		setError(null);

		try {
			const response = await auditService.getAuditReport(audit.id);

			if (response.success && response.data) {
				setReport(response.data);
			} else {
				setError(response.error || "Failed to load report");
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

	const getVulnerabilityCounts = (report: AuditReport) => {
		const reportData = report as any;

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

	if (loading) {
		return (
			<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
			<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
						<p className="text-red-600">{error}</p>
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
	const vulnerabilities = report.vulnerabilities || [];
	const gasOptimizations =
		report.gas_optimizations || audit.final_report?.gas_optimizations || [];
	const recommendations =
		report.recommendations || audit.final_report?.recommendations || [];

	// Get vulnerability counts using helper function
	const counts = getVulnerabilityCounts(report);

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
			<Card className="w-full max-w-6xl max-h-[90vh] overflow-auto">
				<CardHeader>
					<CardTitle className="flex justify-between items-center">
						Audit Report
						<Button variant="outline" onClick={onClose}>
							Close
						</Button>
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
								<p className="text-gray-700">
									{report.executive_summary ||
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
											<div className="text-sm text-gray-600">Critical</div>
										</CardContent>
									</Card>
									<Card>
										<CardContent className="p-4 text-center">
											<div className="text-2xl font-bold text-orange-600">
												{counts.high}
											</div>
											<div className="text-sm text-gray-600">High</div>
										</CardContent>
									</Card>
									<Card>
										<CardContent className="p-4 text-center">
											<div className="text-2xl font-bold text-yellow-600">
												{counts.medium}
											</div>
											<div className="text-sm text-gray-600">Medium</div>
										</CardContent>
									</Card>
									<Card>
										<CardContent className="p-4 text-center">
											<div className="text-2xl font-bold text-blue-600">
												{counts.low}
											</div>
											<div className="text-sm text-gray-600">Low</div>
										</CardContent>
									</Card>
									<Card>
										<CardContent className="p-4 text-center">
											<div className="text-2xl font-bold text-gray-600">
												{counts.informational}
											</div>
											<div className="text-sm text-gray-600">Info</div>
										</CardContent>
									</Card>
								</div>
							</div>

							{/* Vulnerabilities */}
							{vulnerabilities.length > 0 && (
								<div>
									<h3 className="text-lg font-semibold mb-4">
										Vulnerabilities
									</h3>
									<div className="space-y-4">
										{vulnerabilities.map((vuln, index) => (
											<Card key={index}>
												<CardContent className="p-4">
													<div className="flex justify-between items-start mb-2">
														<h4 className="font-medium">{vuln.title}</h4>
														<Badge
															variant={getSeverityBadgeVariant(vuln.severity)}
														>
															{vuln.severity}
														</Badge>
													</div>
													<p className="text-gray-700 mb-2">
														{vuln.description}
													</p>
													<div className="text-sm text-gray-600 mb-2">
														Location: {vuln.location.file}:{vuln.location.line}:
														{vuln.location.column}
													</div>
													{vuln.recommendation && (
														<div className="bg-blue-50 p-3 rounded">
															<strong>Recommendation:</strong>{" "}
															{vuln.recommendation}
														</div>
													)}
												</CardContent>
											</Card>
										))}
									</div>
								</div>
							)}

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
													<p className="text-gray-700 mb-2">
														{opt.description}
													</p>
													<div className="text-sm text-gray-600">
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
										{recommendations.map((rec, index) => (
											<div key={index} className="bg-gray-50 p-3 rounded">
												{typeof rec === "string"
													? rec
													: (rec as any)?.description ||
													  "No description available"}
											</div>
										))}
									</div>
								</div>
							)}

							{/* Report Metadata */}
							<div className="border-t pt-4 text-sm text-gray-600">
								<p>Report generated: {formatDate(report.generated_at)}</p>
								{audit.ipfs_hash && (
									<p>
										IPFS Hash:{" "}
										<code className="bg-gray-100 px-1 rounded">
											{audit.ipfs_hash}
										</code>
									</p>
								)}
							</div>
						</TabsContent>

						<TabsContent value="storage" className="mt-6">
							<DecentralizedStorageInfo
								auditId={audit.id}
								showStats={true}
								showVerification={true}
								showMigration={false}
							/>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</div>
	);
}
