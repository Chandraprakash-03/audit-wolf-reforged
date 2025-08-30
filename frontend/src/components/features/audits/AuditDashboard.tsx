import { useState, useEffect } from "react";
import { Contract, PaginatedResponse, Audit } from "@/types";
import { AuditFilters } from "./AuditFilters";
import { AuditTable } from "./AuditTable";
import { ReportViewer } from "./ReportViewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	auditService,
	AuditFilters as AuditFiltersType,
} from "@/services/auditService";
import { contractService } from "@/services/contractService";

export function AuditDashboard() {
	const [audits, setAudits] = useState<(Audit & { contract?: Contract })[]>([]);
	const [contracts, setContracts] = useState<Contract[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filters, setFilters] = useState<AuditFiltersType>({
		page: 1,
		limit: 10,
	});
	const [pagination, setPagination] = useState({
		total: 0,
		page: 1,
		limit: 10,
		hasMore: false,
	});
	const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);

	useEffect(() => {
		loadData();
	}, [filters]);

	const loadData = async () => {
		setLoading(true);
		setError(null);

		try {
			// Load audits and contracts in parallel
			const [auditsResponse, contractsResponse] = await Promise.all([
				auditService.getUserAudits(filters),
				contractService.getUserContracts(),
			]);

			if (auditsResponse.success && auditsResponse.data) {
				const auditData = auditsResponse.data;
				setPagination({
					total: auditData.total,
					page: auditData.page,
					limit: auditData.limit,
					hasMore: auditData.hasMore,
				});

				// Get contracts for reference
				let contractsData: Contract[] = [];
				if (contractsResponse.success && contractsResponse.data) {
					contractsData = contractsResponse.data;
					setContracts(contractsData);
				}

				// Merge audit data with contract information
				const auditsWithContracts = auditData.data.map((audit) => ({
					...audit,
					contract: contractsData.find((c) => c.id === audit.contract_id),
				}));

				setAudits(auditsWithContracts);
			} else {
				setError(auditsResponse.error || "Failed to load audits");
			}
		} catch (err) {
			setError("Error loading data");
			console.error("Error loading audit data:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleFiltersChange = (newFilters: AuditFiltersType) => {
		setFilters({ ...newFilters, page: 1 });
	};

	const handleResetFilters = () => {
		setFilters({ page: 1, limit: 10 });
	};

	const handlePageChange = (newPage: number) => {
		setFilters({ ...filters, page: newPage });
	};

	const handleViewReport = (audit: Audit) => {
		setSelectedAudit(audit);
	};

	const handleCloseReport = () => {
		setSelectedAudit(null);
	};

	const getAuditStats = () => {
		const stats = {
			total: audits.length,
			completed: audits.filter((a) => a.status === "completed").length,
			analyzing: audits.filter((a) => a.status === "analyzing").length,
			failed: audits.filter((a) => a.status === "failed").length,
		};
		return stats;
	};

	const stats = getAuditStats();

	if (loading && audits.length === 0) {
		return (
			<div className="space-y-6">
				<div className="text-center py-8">
					<p>Loading audit history...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Stats Overview */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold">{pagination.total}</div>
						<div className="text-sm text-gray-600">Total Audits</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold text-green-600">
							{stats.completed}
						</div>
						<div className="text-sm text-gray-600">Completed</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold text-yellow-600">
							{stats.analyzing}
						</div>
						<div className="text-sm text-gray-600">In Progress</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold text-red-600">
							{stats.failed}
						</div>
						<div className="text-sm text-gray-600">Failed</div>
					</CardContent>
				</Card>
			</div>

			{/* Filters */}
			<AuditFilters
				filters={filters}
				onFiltersChange={handleFiltersChange}
				onReset={handleResetFilters}
			/>

			{/* Error Display */}
			{error && (
				<Card>
					<CardContent className="p-4">
						<div className="text-red-600 mb-2">Error: {error}</div>
						<Button onClick={loadData} variant="outline">
							Retry
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Audit Table */}
			<Card>
				<CardHeader>
					<CardTitle className="flex justify-between items-center">
						Audit History
						<Button onClick={loadData} variant="outline" disabled={loading}>
							{loading ? "Refreshing..." : "Refresh"}
						</Button>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<AuditTable
						audits={audits}
						onViewReport={handleViewReport}
						onRefresh={loadData}
					/>
				</CardContent>
			</Card>

			{/* Pagination */}
			{pagination.total > pagination.limit && (
				<div className="flex justify-center items-center gap-4">
					<Button
						variant="outline"
						onClick={() => handlePageChange(pagination.page - 1)}
						disabled={pagination.page <= 1}
					>
						Previous
					</Button>
					<span className="text-sm text-gray-600">
						Page {pagination.page} of{" "}
						{Math.ceil(pagination.total / pagination.limit)}
					</span>
					<Button
						variant="outline"
						onClick={() => handlePageChange(pagination.page + 1)}
						disabled={!pagination.hasMore}
					>
						Next
					</Button>
				</div>
			)}

			{/* Report Viewer Modal */}
			{selectedAudit && (
				<ReportViewer audit={selectedAudit} onClose={handleCloseReport} />
			)}
		</div>
	);
}
