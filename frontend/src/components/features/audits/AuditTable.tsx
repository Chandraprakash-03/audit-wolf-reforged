import { useState } from "react";
import { Contract, Audit } from "@/types";
import { AuditStatusBadge } from "./AuditStatusBadge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { auditService } from "@/services/auditService";

interface AuditTableProps {
	audits: (Audit & { contract?: Contract })[];
	onViewReport: (audit: Audit) => void;
	onRefresh: () => void;
}

export function AuditTable({
	audits,
	onViewReport,
	onRefresh,
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

	const getVulnerabilityCount = (audit: Audit) => {
		if (!audit.final_report) return "N/A";

		const report = audit.final_report as any;

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

	if (audits.length === 0) {
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
						<TableHead>Contract Name</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Vulnerabilities</TableHead>
						<TableHead>Created</TableHead>
						<TableHead>Completed</TableHead>
						<TableHead>Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{audits.map((audit) => (
						<TableRow key={audit.id}>
							<TableCell className="font-medium">
								{audit.contract?.name || "Unknown Contract"}
							</TableCell>
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
											<Button
												size="sm"
												variant="outline"
												onClick={() =>
													handleDownloadReport(
														audit.id,
														audit.contract?.name || "contract"
													)
												}
												disabled={downloadingReports.has(audit.id)}
											>
												{downloadingReports.has(audit.id)
													? "Downloading..."
													: "Download PDF"}
											</Button>
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
