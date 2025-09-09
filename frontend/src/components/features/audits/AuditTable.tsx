import { useState } from "react";
import { Contract, Audit, MultiChainAudit } from "@/types";
import { AuditStatusBadge } from "./AuditStatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { auditService } from "@/services/auditService";
import { BLOCKCHAIN_PLATFORMS } from "@/data/blockchainPlatforms";

interface AuditTableProps {
	audits: (Audit & { contract?: Contract })[];
	multiChainAudits?: MultiChainAudit[];
	onViewReport: (audit: Audit | MultiChainAudit) => void;
	onRefresh: () => void;
	showPlatformInfo?: boolean;
}

export function AuditTable({
	audits,
	multiChainAudits = [],
	onViewReport,
	onRefresh,
	showPlatformInfo = true,
}: AuditTableProps) {
	const [downloadingReports, setDownloadingReports] = useState<Set<string>>(
		new Set()
	);

	const formatDate = (date: Date | string) => {
		const d = new Date(date);
		return (
			d.toLocaleDateString() +
			" " +
			d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
		);
	};

	const handleDownloadReport = async (
		auditId: string,
		contractName: string
	) => {
		setDownloadingReports((prev) => new Set(prev).add(auditId));

		try {
			const response = await auditService.downloadReport(auditId, "pdf");

			if (response.success && response.data) {
				// Create download link
				const url = window.URL.createObjectURL(response.data);
				const link = document.createElement("a");
				link.href = url;
				link.download = `${contractName}-audit-report.pdf`;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				window.URL.revokeObjectURL(url);
			} else {
				console.error("Failed to download report:", response.error);
				alert("Failed to download report. Please try again.");
			}
		} catch (error) {
			console.error("Error downloading report:", error);
			alert("Error downloading report. Please try again.");
		} finally {
			setDownloadingReports((prev) => {
				const newSet = new Set(prev);
				newSet.delete(auditId);
				return newSet;
			});
		}
	};

	const getVulnerabilityCount = (audit: Audit | MultiChainAudit) => {
		// Handle MultiChainAudit
		if ("platforms" in audit) {
			const multiAudit = audit as MultiChainAudit;
			if (!multiAudit.results) return "N/A";

			// Aggregate vulnerabilities across all platforms
			const totalCounts = { critical: 0, high: 0, medium: 0, low: 0 };

			Object.values(multiAudit.results).forEach((platformResult: any) => {
				if (platformResult.vulnerabilities) {
					platformResult.vulnerabilities.forEach((vuln: any) => {
						if (vuln.severity in totalCounts) {
							totalCounts[vuln.severity as keyof typeof totalCounts]++;
						}
					});
				}
			});

			const total = Object.values(totalCounts).reduce(
				(sum, count) => sum + count,
				0
			);
			if (total === 0) return "None";

			const parts = [];
			if (totalCounts.critical > 0)
				parts.push(`${totalCounts.critical} Critical`);
			if (totalCounts.high > 0) parts.push(`${totalCounts.high} High`);
			if (totalCounts.medium > 0) parts.push(`${totalCounts.medium} Medium`);
			if (totalCounts.low > 0) parts.push(`${totalCounts.low} Low`);

			return parts.join(", ");
		}

		// Handle regular Audit
		const regularAudit = audit as Audit;
		if (!regularAudit.final_report) return "N/A";

		const report = regularAudit.final_report as any;

		// Check if the report has count properties (frontend database type)
		if (typeof report.critical_count === "number") {
			const critical_count = report.critical_count || 0;
			const high_count = report.high_count || 0;
			const medium_count = report.medium_count || 0;
			const low_count = report.low_count || 0;

			const total = critical_count + high_count + medium_count + low_count;

			if (total === 0) return "None";

			const parts = [];
			if (critical_count > 0) parts.push(`${critical_count} Critical`);
			if (high_count > 0) parts.push(`${high_count} High`);
			if (medium_count > 0) parts.push(`${medium_count} Medium`);
			if (low_count > 0) parts.push(`${low_count} Low`);

			return parts.join(", ");
		}

		// Fallback: calculate from vulnerabilities array (backend type)
		if (Array.isArray(report.vulnerabilities)) {
			const vulnerabilities = report.vulnerabilities;
			const counts = {
				critical: vulnerabilities.filter((v: any) => v.severity === "critical")
					.length,
				high: vulnerabilities.filter((v: any) => v.severity === "high").length,
				medium: vulnerabilities.filter((v: any) => v.severity === "medium")
					.length,
				low: vulnerabilities.filter((v: any) => v.severity === "low").length,
			};

			const total = counts.critical + counts.high + counts.medium + counts.low;
			if (total === 0) return "None";

			const parts = [];
			if (counts.critical > 0) parts.push(`${counts.critical} Critical`);
			if (counts.high > 0) parts.push(`${counts.high} High`);
			if (counts.medium > 0) parts.push(`${counts.medium} Medium`);
			if (counts.low > 0) parts.push(`${counts.low} Low`);

			return parts.join(", ");
		}

		return "N/A";
	};

	const getPlatformDisplayName = (platformId: string) => {
		const platform = BLOCKCHAIN_PLATFORMS.find((p) => p.id === platformId);
		return platform?.displayName || platformId;
	};

	const renderPlatformBadges = (platforms: string[]) => {
		return (
			<div className="flex flex-wrap gap-1">
				{platforms.slice(0, 3).map((platform) => (
					<Badge key={platform} variant="outline" className="text-xs">
						{getPlatformDisplayName(platform)}
					</Badge>
				))}
				{platforms.length > 3 && (
					<Badge variant="outline" className="text-xs">
						+{platforms.length - 3} more
					</Badge>
				)}
			</div>
		);
	};

	// Combine regular audits and multi-chain audits for display
	const allAudits = [
		...audits.map((audit) => ({ ...audit, type: "single" as const })),
		...multiChainAudits.map((audit) => ({ ...audit, type: "multi" as const })),
	].sort(
		(a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	);

	if (allAudits.length === 0) {
		return (
			<div className="text-center py-8">
				<p className="text-gray-500 mb-4">
					No audits found matching your criteria.
				</p>
				<Button onClick={onRefresh} variant="outline">
					Refresh
				</Button>
			</div>
		);
	}

	return (
		<div className="glass rounded-lg">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Type</TableHead>
						{showPlatformInfo && <TableHead>Platform(s)</TableHead>}
						<TableHead>Status</TableHead>
						<TableHead>Vulnerabilities</TableHead>
						<TableHead>Created</TableHead>
						<TableHead>Completed</TableHead>
						<TableHead>Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{allAudits.map((audit) => (
						<TableRow key={`${audit.type}-${audit.id}`}>
							<TableCell className="font-medium">
								{audit.type === "single"
									? (audit as any).contract?.name || "Unknown Contract"
									: (audit as MultiChainAudit).audit_name ||
									  "Multi-Chain Audit"}
							</TableCell>
							<TableCell>
								<Badge
									variant={audit.type === "multi" ? "default" : "secondary"}
								>
									{audit.type === "multi" ? "Multi-Chain" : "Single Chain"}
								</Badge>
							</TableCell>
							{showPlatformInfo && (
								<TableCell>
									{audit.type === "multi" ? (
										renderPlatformBadges((audit as MultiChainAudit).platforms)
									) : (
										<Badge variant="outline" className="text-xs">
											{getPlatformDisplayName(
												(audit as any).contract?.blockchain_platform ||
													"ethereum"
											)}
										</Badge>
									)}
								</TableCell>
							)}
							<TableCell>
								<AuditStatusBadge status={audit.status} />
							</TableCell>
							<TableCell>
								<span className="text-sm">{getVulnerabilityCount(audit)}</span>
							</TableCell>
							<TableCell className="text-sm text-gray-600">
								{formatDate(audit.created_at)}
							</TableCell>
							<TableCell className="text-sm text-gray-600">
								{audit.completed_at ? formatDate(audit.completed_at) : "-"}
							</TableCell>
							<TableCell>
								<div className="flex gap-2">
									{audit.status === "completed" && (
										<>
											<Button
												size="sm"
												variant="outline"
												onClick={() => onViewReport(audit)}
											>
												View Report
											</Button>
											{audit.type === "single" && (
												<Button
													size="sm"
													variant="outline"
													onClick={() =>
														handleDownloadReport(
															audit.id,
															(audit as any).contract?.name || "contract"
														)
													}
													disabled={downloadingReports.has(audit.id)}
												>
													{downloadingReports.has(audit.id)
														? "Downloading..."
														: "Download PDF"}
												</Button>
											)}
										</>
									)}
									{audit.status === "analyzing" && (
										<Button size="sm" variant="outline" disabled>
											In Progress...
										</Button>
									)}
									{audit.status === "failed" && (
										<Button size="sm" variant="outline" onClick={onRefresh}>
											Retry
										</Button>
									)}
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
