import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditFilters as AuditFiltersType } from "@/services/auditService";
import { Audit } from "@/types";

interface AuditFiltersProps {
	filters: AuditFiltersType;
	onFiltersChange: (filters: AuditFiltersType) => void;
	onReset: () => void;
}

export function AuditFilters({
	filters,
	onFiltersChange,
	onReset,
}: AuditFiltersProps) {
	const [localFilters, setLocalFilters] = useState<AuditFiltersType>(filters);

	const handleFilterChange = (key: keyof AuditFiltersType, value: string) => {
		const newFilters = { ...localFilters, [key]: value || undefined };
		setLocalFilters(newFilters);
	};

	const handleApplyFilters = () => {
		onFiltersChange(localFilters);
	};

	const handleReset = () => {
		const resetFilters = {};
		setLocalFilters(resetFilters);
		onReset();
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Filter Audits</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<div className="space-y-2">
						<Label htmlFor="status">Status</Label>
						<Select
							id="status"
							value={localFilters.status || ""}
							onChange={(e) => handleFilterChange("status", e.target.value)}
						>
							<option value="">All Statuses</option>
							<option value="pending">Pending</option>
							<option value="analyzing">Analyzing</option>
							<option value="completed">Completed</option>
							<option value="failed">Failed</option>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="contractName">Contract Name</Label>
						<Input
							id="contractName"
							placeholder="Search by contract name..."
							value={localFilters.contractName || ""}
							onChange={(e) =>
								handleFilterChange("contractName", e.target.value)
							}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="dateFrom">From Date</Label>
						<Input
							id="dateFrom"
							type="date"
							value={localFilters.dateFrom || ""}
							onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="dateTo">To Date</Label>
						<Input
							id="dateTo"
							type="date"
							value={localFilters.dateTo || ""}
							onChange={(e) => handleFilterChange("dateTo", e.target.value)}
						/>
					</div>
				</div>

				<div className="flex gap-2">
					<Button onClick={handleApplyFilters}>Apply Filters</Button>
					<Button variant="outline" onClick={handleReset}>
						Reset
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
