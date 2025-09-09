import { DatabaseService } from "../services/database";
import { MultiChainAudit as MultiChainAuditType } from "../types/database";

export class MultiChainAuditModel {
	public id: string;
	public user_id: string;
	public audit_name: string;
	public platforms: string[];
	public contracts: Record<string, any>;
	public cross_chain_analysis: boolean;
	public status: "pending" | "analyzing" | "completed" | "failed";
	public results?: Record<string, any>;
	public cross_chain_results?: Record<string, any>;
	public created_at: Date;
	public completed_at?: Date;

	constructor(data: MultiChainAuditType) {
		this.id = data.id;
		this.user_id = data.user_id;
		this.audit_name = data.audit_name;
		this.platforms = data.platforms;
		this.contracts = data.contracts;
		this.cross_chain_analysis = data.cross_chain_analysis;
		this.status = data.status;
		this.results = data.results;
		this.cross_chain_results = data.cross_chain_results;
		this.created_at = data.created_at;
		this.completed_at = data.completed_at;
	}

	static async create(auditData: {
		user_id: string;
		audit_name: string;
		platforms: string[];
		contracts: Record<string, any>;
		cross_chain_analysis?: boolean;
		status?: "pending" | "analyzing" | "completed" | "failed";
	}): Promise<MultiChainAuditModel | null> {
		const audit = await DatabaseService.createMultiChainAudit({
			user_id: auditData.user_id,
			audit_name: auditData.audit_name,
			platforms: auditData.platforms,
			contracts: auditData.contracts,
			cross_chain_analysis: auditData.cross_chain_analysis || false,
			status: auditData.status || "pending",
		});

		return audit ? new MultiChainAuditModel(audit) : null;
	}

	static async findById(id: string): Promise<MultiChainAuditModel | null> {
		const audit = await DatabaseService.getMultiChainAuditById(id);
		return audit ? new MultiChainAuditModel(audit) : null;
	}

	static async findByUserId(userId: string): Promise<MultiChainAuditModel[]> {
		const audits = await DatabaseService.getMultiChainAuditsByUserId(userId);
		return audits.map(
			(audit: MultiChainAuditType) => new MultiChainAuditModel(audit)
		);
	}

	static async findByPlatform(
		platform: string
	): Promise<MultiChainAuditModel[]> {
		const audits = await DatabaseService.getMultiChainAuditsByPlatform(
			platform
		);
		return audits.map(
			(audit: MultiChainAuditType) => new MultiChainAuditModel(audit)
		);
	}

	async updateStatus(
		status: "pending" | "analyzing" | "completed" | "failed"
	): Promise<boolean> {
		const updates: any = { status };

		if (status === "completed") {
			updates.completed_at = new Date();
		}

		const updated = await DatabaseService.updateMultiChainAudit(
			this.id,
			updates
		);
		if (updated) {
			this.status = status;
			if (updates.completed_at) {
				this.completed_at = updates.completed_at;
			}
			return true;
		}
		return false;
	}

	async updateResults(results: Record<string, any>): Promise<boolean> {
		const updated = await DatabaseService.updateMultiChainAudit(this.id, {
			results,
		});
		if (updated) {
			this.results = results;
			return true;
		}
		return false;
	}

	async updateCrossChainResults(
		crossChainResults: Record<string, any>
	): Promise<boolean> {
		const updated = await DatabaseService.updateMultiChainAudit(this.id, {
			cross_chain_results: crossChainResults,
		});
		if (updated) {
			this.cross_chain_results = crossChainResults;
			return true;
		}
		return false;
	}

	isCompleted(): boolean {
		return this.status === "completed";
	}

	isFailed(): boolean {
		return this.status === "failed";
	}

	isInProgress(): boolean {
		return this.status === "analyzing";
	}

	isPending(): boolean {
		return this.status === "pending";
	}

	getDuration(): number | null {
		if (!this.completed_at) {
			return null;
		}
		return this.completed_at.getTime() - this.created_at.getTime();
	}

	getPlatformCount(): number {
		return this.platforms.length;
	}

	getContractCount(): number {
		if (!this.contracts || typeof this.contracts !== "object") {
			return 0;
		}
		return Object.keys(this.contracts).length;
	}

	hasPlatform(platform: string): boolean {
		return this.platforms.includes(platform);
	}

	getResultsForPlatform(platform: string): any {
		if (!this.results || !this.hasPlatform(platform)) {
			return null;
		}
		return this.results[platform];
	}

	getTotalVulnerabilityCount(): number {
		if (!this.results) {
			return 0;
		}

		let total = 0;
		Object.values(this.results).forEach((platformResult: any) => {
			if (platformResult && platformResult.vulnerabilities) {
				total += platformResult.vulnerabilities.length;
			}
		});

		return total;
	}

	getVulnerabilityCountByPlatform(): Record<string, number> {
		const counts: Record<string, number> = {};

		if (!this.results) {
			return counts;
		}

		this.platforms.forEach((platform) => {
			const platformResult = this.results![platform];
			counts[platform] =
				platformResult && platformResult.vulnerabilities
					? platformResult.vulnerabilities.length
					: 0;
		});

		return counts;
	}

	getHighestSeverityAcrossPlatforms():
		| "critical"
		| "high"
		| "medium"
		| "low"
		| "informational"
		| null {
		if (!this.results) {
			return null;
		}

		const severityOrder = [
			"critical",
			"high",
			"medium",
			"low",
			"informational",
		];

		for (const severity of severityOrder) {
			for (const platformResult of Object.values(this.results)) {
				if (platformResult && platformResult.vulnerabilities) {
					const hasThisSeverity = platformResult.vulnerabilities.some(
						(vuln: any) => vuln.severity === severity
					);
					if (hasThisSeverity) {
						return severity as any;
					}
				}
			}
		}

		return null;
	}

	toJSON() {
		return {
			id: this.id,
			user_id: this.user_id,
			audit_name: this.audit_name,
			platforms: this.platforms,
			contracts: this.contracts,
			cross_chain_analysis: this.cross_chain_analysis,
			status: this.status,
			results: this.results,
			cross_chain_results: this.cross_chain_results,
			created_at: this.created_at,
			completed_at: this.completed_at,
		};
	}
}
