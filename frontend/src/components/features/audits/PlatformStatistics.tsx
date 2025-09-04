import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auditService } from "@/services/auditService";
import { BLOCKCHAIN_PLATFORMS } from "@/data/blockchainPlatforms";

interface PlatformStats {
	platform: string;
	totalAudits: number;
	completedAudits: number;
	vulnerabilitiesFound: number;
	averageScore: number;
	lastAuditDate?: string;
}

interface PlatformStatisticsProps {
	className?: string;
}

export function PlatformStatistics({ className }: PlatformStatisticsProps) {
	const [stats, setStats] = useState<PlatformStats[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		loadPlatformStatistics();
	}, []);

	const loadPlatformStatistics = async () => {
		setLoading(true);
		setError(null);

		try {
			const response = await auditService.getPlatformStatistics();

			if (response.success && response.data) {
				setStats(response.data);
			} else {
				setError(response.error?.toString() || "Failed to load statistics");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error loading statistics");
		} finally {
			setLoading(false);
		}
	};

	const getPlatformDisplayName = (platformId: string) => {
		const platform = BLOCKCHAIN_PLATFORMS.find((p) => p.id === platformId);
		return platform?.displayName || platformId;
	};

	const getScoreColor = (score: number) => {
		if (score >= 90) return "text-green-600";
		if (score >= 70) return "text-yellow-600";
		return "text-red-600";
	};

	if (loading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Platform Statistics</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-4">Loading platform statistics...</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Platform Statistics</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-4 text-red-600">Error: {error}</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>Platform Statistics</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{stats.length === 0 ? (
						<div className="text-center py-4 text-gray-500">
							No platform statistics available
						</div>
					) : (
						stats.map((stat) => (
							<div
								key={stat.platform}
								className="flex items-center justify-between p-3 border rounded-lg"
							>
								<div className="flex items-center space-x-3">
									<Badge variant="outline">
										{getPlatformDisplayName(stat.platform)}
									</Badge>
									<div className="text-sm text-gray-600">
										{stat.totalAudits} audits ({stat.completedAudits} completed)
									</div>
								</div>
								<div className="flex items-center space-x-4 text-sm">
									<div>
										<span className="text-gray-500">Vulnerabilities:</span>{" "}
										<span className="font-medium">
											{stat.vulnerabilitiesFound}
										</span>
									</div>
									<div>
										<span className="text-gray-500">Avg Score:</span>{" "}
										<span
											className={`font-medium ${getScoreColor(
												stat.averageScore
											)}`}
										>
											{stat.averageScore.toFixed(1)}%
										</span>
									</div>
									{stat.lastAuditDate && (
										<div className="text-gray-500">
											Last: {new Date(stat.lastAuditDate).toLocaleDateString()}
										</div>
									)}
								</div>
							</div>
						))
					)}
				</div>
			</CardContent>
		</Card>
	);
}
