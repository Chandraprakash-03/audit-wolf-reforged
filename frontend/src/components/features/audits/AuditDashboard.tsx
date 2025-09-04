import React, { useState, useEffect } from "react";
import { Contract, PaginatedResponse, Audit, MultiChainAudit } from "@/types";
import { AuditFilters } from "./AuditFilters";
import { AuditTable } from "./AuditTable";
import { ReportViewer } from "./ReportViewer";
import { PlatformStatistics } from "./PlatformStatistics";
import { ComparativeAnalysis } from "./ComparativeAnalysis";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	auditService,
	AuditFilters as AuditFiltersType,
} from "@/services/auditService";
import { contractService } from "@/services/contractService";

export function AuditDashboard() {
	const [audits, setAudits] = useState<(Audit & { contract?: Contract })[]>([]);
	const [multiChainAudits, setMultiChainAudits] = useState<MultiChainAudit[]>(
		[]
	);
	const [contracts, setContracts] = useState<Contract[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState("history");

	// Debug: Log component state
	console.log("AuditDashboard state:", {
		audits: audits.length,
		loading,
		error,
	});
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
	const [selectedAudit, setSelectedAudit] = useState<
		Audit | MultiChainAudit | null
	>(null);

	useEffect(() => {
		loadData();
	}, [filters]);

	const loadData = async () => {
		setLoading(true);
		setError(null);

		try {
			// Load audits, multi-chain audits, and contracts in parallel
			const [auditsResponse, multiChainResponse, contractsResponse] =
				await Promise.all([
					auditService.getUserAudits(filters),
					auditService.getMultiChainAudits(filters),
					contractService.getUserContracts(),
				]);

			// Handle regular audits
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
				const errorMessage =
					typeof auditsResponse.error === "string"
						? auditsResponse.error
						: auditsResponse.error?.message || "Failed to load audits";
				setError(errorMessage);
			}

			// Handle multi-chain audits
			if (multiChainResponse.success && multiChainResponse.data) {
				setMultiChainAudits(multiChainResponse.data.data || []);
			}
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Error loading data";
			setError(errorMessage);
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

	const handleViewReport = (audit: Audit | MultiChainAudit) => {
		setSelectedAudit(audit);
	};

	const handleCloseReport = () => {
		setSelectedAudit(null);
	};

	const getAuditStats = () => {
		const allAudits = [...audits, ...multiChainAudits];
		const stats = {
			total: allAudits.length,
			completed: allAudits.filter((a) => a.status === "completed").length,
			analyzing: allAudits.filter((a) => a.status === "analyzing").length,
			failed: allAudits.filter((a) => a.status === "failed").length,
			singleChain: audits.length,
			multiChain: multiChainAudits.length,
			crossChain: multiChainAudits.filter((a) => a.cross_chain_analysis).length,
		};
		return stats;
	};

	const stats = getAuditStats();

	if (loading && audits.length === 0 && multiChainAudits.length === 0) {
		return (
			<div className="space-y-6">
				<div className="text-center py-8">
					<p>Loading audit history...</p>
				</div>
			</div>
		);
	}

	// Safety check to prevent rendering error objects
	const safeRender = (content: any) => {
		if (
			typeof content === "object" &&
			content !== null &&
			!React.isValidElement(content)
		) {
			console.warn("Attempted to render object as React child:", content);
			return JSON.stringify(content);
		}
		return content;
	};

	return (
		<div className="space-y-6">
			{/* Enhanced Stats Overview */}
			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold">{stats.total}</div>
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
						<div className="text-2xl font-bold text-blue-600">
							{stats.singleChain}
						</div>
						<div className="text-sm text-gray-600">Single Chain</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold text-purple-600">
							{stats.multiChain}
						</div>
						<div className="text-sm text-gray-600">Multi Chain</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold text-indigo-600">
							{stats.crossChain}
						</div>
						<div className="text-sm text-gray-600">Cross Chain</div>
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

			{/* Main Content Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList>
					<TabsTrigger value="history">Audit History</TabsTrigger>
					{/*<TabsTrigger value="analytics">Platform Analytics</TabsTrigger>*/}
					{/*<TabsTrigger value="comparison">Comparative Analysis</TabsTrigger>*/}
				</TabsList>

				<TabsContent value="history" className="space-y-4">
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
								multiChainAudits={multiChainAudits}
								onViewReport={handleViewReport}
								onRefresh={loadData}
								showPlatformInfo={true}
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
				</TabsContent>

				<TabsContent value="analytics">
					<PlatformStatistics />
				</TabsContent>

				<TabsContent value="comparison">
					<ComparativeAnalysis />
				</TabsContent>
			</Tabs>

			{/* Report Viewer Modal */}
			{selectedAudit && (
				<ReportViewer audit={selectedAudit} onClose={handleCloseReport} />
			)}
		</div>
	);
}
