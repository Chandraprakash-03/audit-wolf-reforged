"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
	ChevronDown,
	ChevronRight,
	AlertTriangle,
	Info,
	CheckCircle,
} from "lucide-react";

interface Vulnerability {
	id: string;
	type: string;
	severity: "critical" | "high" | "medium" | "low" | "informational";
	title: string;
	description: string;
	location: {
		line: number;
		column: number;
		function?: string;
	};
	recommendation: string;
	confidence: number;
	source: "static" | "ai" | "combined";
}

interface AuditReport {
	id: string;
	contractName: string;
	summary: {
		totalVulnerabilities: number;
		criticalCount: number;
		highCount: number;
		mediumCount: number;
		lowCount: number;
		infoCount: number;
	};
	vulnerabilities: Vulnerability[];
	gasOptimizations: any[];
	codeQuality: any;
	executiveSummary: string;
	generatedAt: string;
}

interface LazyReportViewerProps {
	auditId: string;
	onError?: (error: Error) => void;
}

const ITEMS_PER_PAGE = 10;
const SEVERITY_COLORS = {
	critical: "bg-red-100 text-red-800 border-red-200",
	high: "bg-orange-100 text-orange-800 border-orange-200",
	medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
	low: "bg-blue-100 text-blue-800 border-blue-200",
	informational: "bg-gray-100 text-gray-800 border-gray-200",
};

const SEVERITY_ICONS = {
	critical: AlertTriangle,
	high: AlertTriangle,
	medium: AlertTriangle,
	low: Info,
	informational: CheckCircle,
};

export const LazyReportViewer: React.FC<LazyReportViewerProps> = ({
	auditId,
	onError,
}) => {
	const [report, setReport] = useState<AuditReport | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(["summary"])
	);
	const [currentPage, setCurrentPage] = useState(1);
	const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
	const [loadingMore, setLoadingMore] = useState(false);

	// Memoized filtered vulnerabilities
	const filteredVulnerabilities = useMemo(() => {
		if (!report?.vulnerabilities) return [];

		if (selectedSeverity === "all") {
			return report.vulnerabilities;
		}

		return report.vulnerabilities.filter(
			(vuln) => vuln.severity === selectedSeverity
		);
	}, [report?.vulnerabilities, selectedSeverity]);

	// Memoized paginated vulnerabilities
	const paginatedVulnerabilities = useMemo(() => {
		const startIndex = 0;
		const endIndex = currentPage * ITEMS_PER_PAGE;
		return filteredVulnerabilities.slice(startIndex, endIndex);
	}, [filteredVulnerabilities, currentPage]);

	const hasMoreItems = useMemo(() => {
		return paginatedVulnerabilities.length < filteredVulnerabilities.length;
	}, [paginatedVulnerabilities.length, filteredVulnerabilities.length]);

	// Load report data
	useEffect(() => {
		const loadReport = async () => {
			try {
				setLoading(true);
				setError(null);

				const response = await fetch(`/api/audits/${auditId}/report`, {
					headers: {
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
				});

				if (!response.ok) {
					throw new Error(`Failed to load report: ${response.statusText}`);
				}

				const reportData = await response.json();
				setReport(reportData);
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Failed to load report";
				setError(errorMessage);
				onError?.(err instanceof Error ? err : new Error(errorMessage));
			} finally {
				setLoading(false);
			}
		};

		if (auditId) {
			loadReport();
		}
	}, [auditId, onError]);

	// Load more vulnerabilities
	const loadMore = useCallback(async () => {
		if (loadingMore || !hasMoreItems) return;

		setLoadingMore(true);

		// Simulate loading delay for better UX
		await new Promise((resolve) => setTimeout(resolve, 300));

		setCurrentPage((prev) => prev + 1);
		setLoadingMore(false);
	}, [loadingMore, hasMoreItems]);

	// Toggle section expansion
	const toggleSection = useCallback((sectionId: string) => {
		setExpandedSections((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(sectionId)) {
				newSet.delete(sectionId);
			} else {
				newSet.add(sectionId);
			}
			return newSet;
		});
	}, []);

	// Handle severity filter change
	const handleSeverityFilter = useCallback((severity: string) => {
		setSelectedSeverity(severity);
		setCurrentPage(1); // Reset pagination
	}, []);

	if (loading) {
		return <ReportSkeleton />;
	}

	if (error) {
		return (
			<Card className="border-red-200">
				<CardContent className="p-6">
					<div className="text-center">
						<AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
						<h3 className="text-lg font-semibold text-red-800 mb-2">
							Error Loading Report
						</h3>
						<p className="text-red-600 mb-4">{error}</p>
						<Button
							onClick={() => window.location.reload()}
							variant="outline"
							className="border-red-300 text-red-700 hover:bg-red-50"
						>
							Retry
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!report) {
		return (
			<Card>
				<CardContent className="p-6">
					<div className="text-center text-gray-500">
						No report data available
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			{/* Executive Summary */}
			<Card>
				<CardHeader
					className="cursor-pointer"
					onClick={() => toggleSection("summary")}
				>
					<CardTitle className="flex items-center justify-between">
						<span>Executive Summary</span>
						{expandedSections.has("summary") ? (
							<ChevronDown className="h-5 w-5" />
						) : (
							<ChevronRight className="h-5 w-5" />
						)}
					</CardTitle>
				</CardHeader>
				{expandedSections.has("summary") && (
					<CardContent>
						<div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
							<div className="text-center">
								<div className="text-2xl font-bold text-red-600">
									{report.summary.criticalCount}
								</div>
								<div className="text-sm text-gray-600">Critical</div>
							</div>
							<div className="text-center">
								<div className="text-2xl font-bold text-orange-600">
									{report.summary.highCount}
								</div>
								<div className="text-sm text-gray-600">High</div>
							</div>
							<div className="text-center">
								<div className="text-2xl font-bold text-yellow-600">
									{report.summary.mediumCount}
								</div>
								<div className="text-sm text-gray-600">Medium</div>
							</div>
							<div className="text-center">
								<div className="text-2xl font-bold text-blue-600">
									{report.summary.lowCount}
								</div>
								<div className="text-sm text-gray-600">Low</div>
							</div>
							<div className="text-center">
								<div className="text-2xl font-bold text-gray-600">
									{report.summary.infoCount}
								</div>
								<div className="text-sm text-gray-600">Info</div>
							</div>
						</div>
						<p className="text-gray-700 leading-relaxed">
							{report.executiveSummary}
						</p>
					</CardContent>
				)}
			</Card>

			{/* Vulnerabilities Section */}
			<Card>
				<CardHeader
					className="cursor-pointer"
					onClick={() => toggleSection("vulnerabilities")}
				>
					<CardTitle className="flex items-center justify-between">
						<span>Vulnerabilities ({filteredVulnerabilities.length})</span>
						{expandedSections.has("vulnerabilities") ? (
							<ChevronDown className="h-5 w-5" />
						) : (
							<ChevronRight className="h-5 w-5" />
						)}
					</CardTitle>
				</CardHeader>
				{expandedSections.has("vulnerabilities") && (
					<CardContent>
						{/* Severity Filter */}
						<div className="flex flex-wrap gap-2 mb-6">
							<Button
								variant={selectedSeverity === "all" ? "default" : "outline"}
								size="sm"
								onClick={() => handleSeverityFilter("all")}
							>
								All ({report.vulnerabilities.length})
							</Button>
							{(
								["critical", "high", "medium", "low", "informational"] as const
							).map((severity) => {
								const count = report.vulnerabilities.filter(
									(v) => v.severity === severity
								).length;
								if (count === 0) return null;

								return (
									<Button
										key={severity}
										variant={
											selectedSeverity === severity ? "default" : "outline"
										}
										size="sm"
										onClick={() => handleSeverityFilter(severity)}
										className={
											selectedSeverity === severity
												? SEVERITY_COLORS[severity]
												: ""
										}
									>
										{severity.charAt(0).toUpperCase() + severity.slice(1)} (
										{count})
									</Button>
								);
							})}
						</div>

						{/* Vulnerabilities List */}
						<div className="space-y-4">
							{paginatedVulnerabilities.map((vulnerability) => (
								<VulnerabilityCard
									key={vulnerability.id}
									vulnerability={vulnerability}
								/>
							))}
						</div>

						{/* Load More Button */}
						{hasMoreItems && (
							<div className="text-center mt-6">
								<Button
									onClick={loadMore}
									disabled={loadingMore}
									variant="outline"
								>
									{loadingMore ? (
										<>
											<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
											Loading...
										</>
									) : (
										`Load More (${
											filteredVulnerabilities.length -
											paginatedVulnerabilities.length
										} remaining)`
									)}
								</Button>
							</div>
						)}

						{filteredVulnerabilities.length === 0 && (
							<div className="text-center py-8 text-gray-500">
								No vulnerabilities found for the selected severity level.
							</div>
						)}
					</CardContent>
				)}
			</Card>

			{/* Gas Optimizations Section */}
			{report.gasOptimizations && report.gasOptimizations.length > 0 && (
				<Card>
					<CardHeader
						className="cursor-pointer"
						onClick={() => toggleSection("gas")}
					>
						<CardTitle className="flex items-center justify-between">
							<span>Gas Optimizations ({report.gasOptimizations.length})</span>
							{expandedSections.has("gas") ? (
								<ChevronDown className="h-5 w-5" />
							) : (
								<ChevronRight className="h-5 w-5" />
							)}
						</CardTitle>
					</CardHeader>
					{expandedSections.has("gas") && (
						<CardContent>
							<div className="space-y-4">
								{report.gasOptimizations.map((optimization, index) => (
									<div key={index} className="border rounded-lg p-4">
										<h4 className="font-semibold mb-2">{optimization.title}</h4>
										<p className="text-gray-600 mb-2">
											{optimization.description}
										</p>
										{optimization.estimatedSavings && (
											<Badge variant="secondary">
												Estimated savings: {optimization.estimatedSavings} gas
											</Badge>
										)}
									</div>
								))}
							</div>
						</CardContent>
					)}
				</Card>
			)}
		</div>
	);
};

// Vulnerability Card Component
const VulnerabilityCard: React.FC<{ vulnerability: Vulnerability }> = ({
	vulnerability,
}) => {
	const [expanded, setExpanded] = useState(false);
	const SeverityIcon = SEVERITY_ICONS[vulnerability.severity];

	return (
		<div className="border rounded-lg overflow-hidden">
			<div
				className="p-4 cursor-pointer hover:bg-gray-50"
				onClick={() => setExpanded(!expanded)}
			>
				<div className="flex items-start justify-between">
					<div className="flex items-start space-x-3">
						<SeverityIcon
							className={`h-5 w-5 mt-0.5 ${
								vulnerability.severity === "critical" ||
								vulnerability.severity === "high"
									? "text-red-500"
									: vulnerability.severity === "medium"
									? "text-yellow-500"
									: "text-blue-500"
							}`}
						/>
						<div>
							<h4 className="font-semibold text-gray-900">
								{vulnerability.title}
							</h4>
							<div className="flex items-center space-x-2 mt-1">
								<Badge className={SEVERITY_COLORS[vulnerability.severity]}>
									{vulnerability.severity.toUpperCase()}
								</Badge>
								<Badge variant="outline">{vulnerability.type}</Badge>
								<Badge variant="outline">
									Line {vulnerability.location.line}
								</Badge>
								<Badge variant="outline">
									{Math.round(vulnerability.confidence * 100)}% confidence
								</Badge>
							</div>
						</div>
					</div>
					{expanded ? (
						<ChevronDown className="h-5 w-5 text-gray-400" />
					) : (
						<ChevronRight className="h-5 w-5 text-gray-400" />
					)}
				</div>
			</div>

			{expanded && (
				<div className="px-4 pb-4 border-t bg-gray-50">
					<div className="pt-4 space-y-4">
						<div>
							<h5 className="font-medium text-gray-900 mb-2">Description</h5>
							<p className="text-gray-700">{vulnerability.description}</p>
						</div>

						<div>
							<h5 className="font-medium text-gray-900 mb-2">Location</h5>
							<div className="text-sm text-gray-600">
								Line {vulnerability.location.line}, Column{" "}
								{vulnerability.location.column}
								{vulnerability.location.function && (
									<span>
										{" "}
										in function{" "}
										<code className="bg-gray-200 px-1 rounded">
											{vulnerability.location.function}
										</code>
									</span>
								)}
							</div>
						</div>

						<div>
							<h5 className="font-medium text-gray-900 mb-2">Recommendation</h5>
							<p className="text-gray-700">{vulnerability.recommendation}</p>
						</div>

						<div className="flex items-center justify-between text-sm text-gray-500">
							<span>Source: {vulnerability.source}</span>
							<span>
								Confidence: {Math.round(vulnerability.confidence * 100)}%
							</span>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

// Loading Skeleton Component
const ReportSkeleton: React.FC = () => (
	<div className="space-y-6">
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-48" />
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-5 gap-4 mb-6">
					{Array.from({ length: 5 }).map((_, i) => (
						<div key={i} className="text-center">
							<Skeleton className="h-8 w-12 mx-auto mb-2" />
							<Skeleton className="h-4 w-16 mx-auto" />
						</div>
					))}
				</div>
				<Skeleton className="h-20 w-full" />
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-40" />
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{Array.from({ length: 3 }).map((_, i) => (
						<div key={i} className="border rounded-lg p-4">
							<Skeleton className="h-5 w-3/4 mb-2" />
							<Skeleton className="h-4 w-full mb-2" />
							<Skeleton className="h-4 w-1/2" />
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	</div>
);

export default LazyReportViewer;
