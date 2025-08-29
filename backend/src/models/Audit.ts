import { DatabaseService } from "../services/database";
import {
	Audit as AuditType,
	StaticAnalysisResult,
	AIAnalysisResult,
	AuditReport,
} from "../types/database";

export class AuditModel {
	public id: string;
	public contract_id: string;
	public user_id: string;
	public status: "pending" | "analyzing" | "completed" | "failed";
	public static_results?: StaticAnalysisResult;
	public ai_results?: AIAnalysisResult;
	public final_report?: AuditReport;
	public ipfs_hash?: string;
	public blockchain_tx?: string;
	public created_at: Date;
	public completed_at?: Date;

	constructor(data: AuditType) {
		this.id = data.id;
		this.contract_id = data.contract_id;
		this.user_id = data.user_id;
		this.status = data.status;
		this.static_results = data.static_results;
		this.ai_results = data.ai_results;
		this.final_report = data.final_report;
		this.ipfs_hash = data.ipfs_hash;
		this.blockchain_tx = data.blockchain_tx;
		this.created_at = data.created_at;
		this.completed_at = data.completed_at;
	}

	static async create(auditData: {
		contract_id: string;
		user_id: string;
		status?: "pending" | "analyzing" | "completed" | "failed";
	}): Promise<AuditModel | null> {
		const audit = await DatabaseService.createAudit({
			contract_id: auditData.contract_id,
			user_id: auditData.user_id,
			status: auditData.status || "pending",
		});

		return audit ? new AuditModel(audit) : null;
	}

	static async findById(id: string): Promise<AuditModel | null> {
		const audit = await DatabaseService.getAuditById(id);
		return audit ? new AuditModel(audit) : null;
	}

	static async findByUserId(userId: string): Promise<AuditModel[]> {
		const audits = await DatabaseService.getAuditsByUserId(userId);
		return audits.map((audit) => new AuditModel(audit));
	}

	async updateStatus(
		status: "pending" | "analyzing" | "completed" | "failed"
	): Promise<boolean> {
		const updates: any = { status };

		if (status === "completed") {
			updates.completed_at = new Date();
		}

		const updated = await DatabaseService.updateAudit(this.id, updates);
		if (updated) {
			this.status = status;
			if (updates.completed_at) {
				this.completed_at = updates.completed_at;
			}
			return true;
		}
		return false;
	}

	async updateStaticResults(results: StaticAnalysisResult): Promise<boolean> {
		const updated = await DatabaseService.updateAudit(this.id, {
			static_results: results,
		});
		if (updated) {
			this.static_results = results;
			return true;
		}
		return false;
	}

	async updateAIResults(results: AIAnalysisResult): Promise<boolean> {
		const updated = await DatabaseService.updateAudit(this.id, {
			ai_results: results,
		});
		if (updated) {
			this.ai_results = results;
			return true;
		}
		return false;
	}

	async updateFinalReport(report: AuditReport): Promise<boolean> {
		const updated = await DatabaseService.updateAudit(this.id, {
			final_report: report,
		});
		if (updated) {
			this.final_report = report;
			return true;
		}
		return false;
	}

	async updateIPFSHash(hash: string): Promise<boolean> {
		const updated = await DatabaseService.updateAudit(this.id, {
			ipfs_hash: hash,
		});
		if (updated) {
			this.ipfs_hash = hash;
			return true;
		}
		return false;
	}

	async updateBlockchainTx(tx: string): Promise<boolean> {
		const updated = await DatabaseService.updateAudit(this.id, {
			blockchain_tx: tx,
		});
		if (updated) {
			this.blockchain_tx = tx;
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

	getVulnerabilityCount(): {
		total: number;
		critical: number;
		high: number;
		medium: number;
		low: number;
		informational: number;
	} {
		if (!this.final_report) {
			return {
				total: 0,
				critical: 0,
				high: 0,
				medium: 0,
				low: 0,
				informational: 0,
			};
		}

		return {
			total: this.final_report.total_vulnerabilities,
			critical: this.final_report.critical_count,
			high: this.final_report.high_count,
			medium: this.final_report.medium_count,
			low: this.final_report.low_count,
			informational: this.final_report.informational_count,
		};
	}

	toJSON() {
		return {
			id: this.id,
			contract_id: this.contract_id,
			user_id: this.user_id,
			status: this.status,
			static_results: this.static_results,
			ai_results: this.ai_results,
			final_report: this.final_report,
			ipfs_hash: this.ipfs_hash,
			blockchain_tx: this.blockchain_tx,
			created_at: this.created_at,
			completed_at: this.completed_at,
		};
	}
}
