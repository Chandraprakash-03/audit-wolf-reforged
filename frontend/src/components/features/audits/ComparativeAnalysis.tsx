import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { auditService, AuditFilters } from "@/services/auditService";
import { BLOCKCHAIN_PLATFORMS } from "@/data/blockchainPlatforms";

interface ComparisonData {
	platform: string;
	totalAudits: number;
	averageVulnerabilities: number;
	severityBreakdown: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
	averageCompletionTime: number; // in hours
	successRate: number; // percentage
}

interface ComparativeAnalysisProps {
	className?: string;
}

export function ComparativeAnalysis({ className }: ComparativeAnalysisProps) {
	const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
	const [dateRange, setDateRange] = useState({
		from: "",
		to: "",
	});

	const availablePlatforms = BLOCKCHAIN_PLATFORMS.filter((p) => p.isActive);

	const loadComparativeData = async () => {
		if (selectedPlatforms.length < 2) {
			setError("Please select at least 2 platforms to compare");
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const comparisons = await Promise.all(
				selectedPlatforms.map(async (platform) => {
					const filters: AuditFilters = {
						platform,
						dateFrom: dateRange.from || undefined,
						dateTo: dateRange.to || undefined,
					};

					const statsResponse = await auditService.getAuditStatistics(filters);

					if (statsResponse.success && statsResponse.data) {
						return {
							platform,
							...statsResponse.data,
						};
					}

					return null;
				})
			);

			const validComparisons = comparisons.filter(Boolean) as ComparisonData[];
			setComparisonData(validComparisons);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Error loading comparison data"
			);
		} finally {
			setLoading(false);
		}
	};

	const handlePlatformToggle = (platformId: string) => {
		setSelectedPlatforms((prev) =>
			prev.includes(platformId)
				? prev.filter((id) => id !== platformId)
				: [...prev, platformId]
		);
	};

	const getPlatformDisplayName = (platformId: string) => {
		const platform = BLOCKCHAIN_PLATFORMS.find((p) => p.id === platformId);
		return platform?.displayName || platformId;
	};

	const formatCompletionTime = (hours: number) => {
		if (hours < 1) return `${Math.round(hours * 60)}m`;
		if (hours < 24) return `${hours.toFixed(1)}h`;
		return `${Math.round(hours / 24)}d`;
	};

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>Comparative Analysis</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Platform Selection */}
				<div className="space-y-2">
					<Label>Select Platforms to Compare</Label>
					<div className="flex flex-wrap gap-2">
						{availablePlatforms.map((platform) => (
							<Badge
								key={platform.id}
								variant={
									selectedPlatforms.includes(platform.id)
										? "default"
										: "outline"
								}
								className="cursor-pointer"
								onClick={() => handlePlatformToggle(platform.id)}
							>
								{platform.displayName}
							</Badge>
						))}
					</div>
				</div>

				{/* Date Range */}
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="dateFrom">From Date</Label>
						<input
							id="dateFrom"
							type="date"
							className="w-full px-3 py-2 border rounded-md"
							value={dateRange.from}
							onChange={(e) =>
								setDateRange((prev) => ({ ...prev, from: e.target.value }))
							}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="dateTo">To Date</Label>
						<input
							id="dateTo"
							type="date"
							className="w-full px-3 py-2 border rounded-md"
							value={dateRange.to}
							onChange={(e) =>
								setDateRange((prev) => ({ ...prev, to: e.target.value }))
							}
						/>
					</div>
				</div>

				<Button
					onClick={loadComparativeData}
					disabled={loading || selectedPlatforms.length < 2}
					className="w-full"
				>
					{loading ? "Loading..." : "Compare Platforms"}
				</Button>

				{error && <div className="text-red-600 text-sm">{error}</div>}

				{/* Comparison Results */}
				{comparisonData.length > 0 && (
					<div className="space-y-4">
						<h4 className="font-medium">Comparison Results</h4>

						{/* Summary Table */}
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b">
										<th className="text-left p-2">Platform</th>
										<th className="text-right p-2">Total Audits</th>
										<th className="text-right p-2">Avg Vulnerabilities</th>
										<th className="text-right p-2">Success Rate</th>
										<th className="text-right p-2">Avg Time</th>
									</tr>
								</thead>
								<tbody>
									{comparisonData.map((data) => (
										<tr key={data.platform} className="border-b">
											<td className="p-2">
												<Badge variant="outline">
													{getPlatformDisplayName(data.platform)}
												</Badge>
											</td>
											<td className="text-right p-2">{data.totalAudits}</td>
											<td className="text-right p-2">
												{data.averageVulnerabilities.toFixed(1)}
											</td>
											<td className="text-right p-2">
												{data.successRate.toFixed(1)}%
											</td>
											<td className="text-right p-2">
												{formatCompletionTime(data.averageCompletionTime)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Severity Breakdown */}
						<div className="space-y-2">
							<h5 className="font-medium">Vulnerability Severity Breakdown</h5>
							{comparisonData.map((data) => (
								<div
									key={data.platform}
									className="flex items-center justify-between p-2 border rounded"
								>
									<Badge variant="outline">
										{getPlatformDisplayName(data.platform)}
									</Badge>
									<div className="flex space-x-4 text-sm">
										<span className="text-red-600">
											Critical: {data.severityBreakdown.critical}
										</span>
										<span className="text-orange-600">
											High: {data.severityBreakdown.high}
										</span>
										<span className="text-yellow-600">
											Medium: {data.severityBreakdown.medium}
										</span>
										<span className="text-blue-600">
											Low: {data.severityBreakdown.low}
										</span>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
