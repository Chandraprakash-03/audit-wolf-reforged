import { DatabaseService } from "../services/database";
import { CrossChainAnalysis as CrossChainAnalysisType } from "../types/database";

export class CrossChainAnalysisModel {
	public id: string;
	public multi_chain_audit_id: string;
	public bridge_security_assessment?: Record<string, any>;
	public state_consistency_analysis?: Record<string, any>;
	public interoperability_risks?: Record<string, any>;
	public recommendations?: Record<string, any>;
	public created_at: Date;

	constructor(data: CrossChainAnalysisType) {
		this.id = data.id;
		this.multi_chain_audit_id = data.multi_chain_audit_id;
		this.bridge_security_assessment = data.bridge_security_assessment;
		this.state_consistency_analysis = data.state_consistency_analysis;
		this.interoperability_risks = data.interoperability_risks;
		this.recommendations = data.recommendations;
		this.created_at = data.created_at;
	}

	static async create(analysisData: {
		multi_chain_audit_id: string;
		bridge_security_assessment?: Record<string, any>;
		state_consistency_analysis?: Record<string, any>;
		interoperability_risks?: Record<string, any>;
		recommendations?: Record<string, any>;
	}): Promise<CrossChainAnalysisModel | null> {
		const analysis = await DatabaseService.createCrossChainAnalysis(
			analysisData
		);
		return analysis ? new CrossChainAnalysisModel(analysis) : null;
	}

	static async findById(id: string): Promise<CrossChainAnalysisModel | null> {
		const analysis = await DatabaseService.getCrossChainAnalysisById(id);
		return analysis ? new CrossChainAnalysisModel(analysis) : null;
	}

	static async findByMultiChainAuditId(
		multiChainAuditId: string
	): Promise<CrossChainAnalysisModel | null> {
		const analysis =
			await DatabaseService.getCrossChainAnalysisByMultiChainAuditId(
				multiChainAuditId
			);
		return analysis ? new CrossChainAnalysisModel(analysis) : null;
	}

	async updateBridgeSecurityAssessment(
		assessment: Record<string, any>
	): Promise<boolean> {
		const updated = await DatabaseService.updateCrossChainAnalysis(this.id, {
			bridge_security_assessment: assessment,
		});
		if (updated) {
			this.bridge_security_assessment = assessment;
			return true;
		}
		return false;
	}

	async updateStateConsistencyAnalysis(
		analysis: Record<string, any>
	): Promise<boolean> {
		const updated = await DatabaseService.updateCrossChainAnalysis(this.id, {
			state_consistency_analysis: analysis,
		});
		if (updated) {
			this.state_consistency_analysis = analysis;
			return true;
		}
		return false;
	}

	async updateInteroperabilityRisks(
		risks: Record<string, any>
	): Promise<boolean> {
		const updated = await DatabaseService.updateCrossChainAnalysis(this.id, {
			interoperability_risks: risks,
		});
		if (updated) {
			this.interoperability_risks = risks;
			return true;
		}
		return false;
	}

	async updateRecommendations(
		recommendations: Record<string, any>
	): Promise<boolean> {
		const updated = await DatabaseService.updateCrossChainAnalysis(this.id, {
			recommendations,
		});
		if (updated) {
			this.recommendations = recommendations;
			return true;
		}
		return false;
	}

	hasBridgeSecurityAssessment(): boolean {
		return (
			this.bridge_security_assessment !== undefined &&
			Object.keys(this.bridge_security_assessment).length > 0
		);
	}

	hasStateConsistencyAnalysis(): boolean {
		return (
			this.state_consistency_analysis !== undefined &&
			Object.keys(this.state_consistency_analysis).length > 0
		);
	}

	hasInteroperabilityRisks(): boolean {
		return (
			this.interoperability_risks !== undefined &&
			Object.keys(this.interoperability_risks).length > 0
		);
	}

	hasRecommendations(): boolean {
		return (
			this.recommendations !== undefined &&
			Object.keys(this.recommendations).length > 0
		);
	}

	getBridgeSecurityScore(): number | null {
		if (
			!this.bridge_security_assessment ||
			!this.bridge_security_assessment.overall_score
		) {
			return null;
		}
		return this.bridge_security_assessment.overall_score;
	}

	getHighestRiskLevel(): "critical" | "high" | "medium" | "low" | null {
		if (!this.interoperability_risks || !this.interoperability_risks.risks) {
			return null;
		}

		const risks = this.interoperability_risks.risks;
		if (!Array.isArray(risks)) {
			return null;
		}

		const severityOrder = ["critical", "high", "medium", "low"];

		for (const severity of severityOrder) {
			const hasThisSeverity = risks.some(
				(risk: any) => risk.severity === severity
			);
			if (hasThisSeverity) {
				return severity as any;
			}
		}

		return null;
	}

	getRiskCount(): number {
		if (!this.interoperability_risks || !this.interoperability_risks.risks) {
			return 0;
		}

		const risks = this.interoperability_risks.risks;
		return Array.isArray(risks) ? risks.length : 0;
	}

	getRiskCountBySeverity(): Record<string, number> {
		const counts = {
			critical: 0,
			high: 0,
			medium: 0,
			low: 0,
		};

		if (!this.interoperability_risks || !this.interoperability_risks.risks) {
			return counts;
		}

		const risks = this.interoperability_risks.risks;
		if (!Array.isArray(risks)) {
			return counts;
		}

		risks.forEach((risk: any) => {
			if (risk.severity && counts.hasOwnProperty(risk.severity)) {
				counts[risk.severity as keyof typeof counts]++;
			}
		});

		return counts;
	}

	getRecommendationCount(): number {
		if (!this.recommendations || !this.recommendations.items) {
			return 0;
		}

		const items = this.recommendations.items;
		return Array.isArray(items) ? items.length : 0;
	}

	getHighPriorityRecommendations(): any[] {
		if (!this.recommendations || !this.recommendations.items) {
			return [];
		}

		const items = this.recommendations.items;
		if (!Array.isArray(items)) {
			return [];
		}

		return items.filter((item: any) => item.priority === "high");
	}

	getStateInconsistencies(): any[] {
		if (
			!this.state_consistency_analysis ||
			!this.state_consistency_analysis.inconsistencies
		) {
			return [];
		}

		const inconsistencies = this.state_consistency_analysis.inconsistencies;
		return Array.isArray(inconsistencies) ? inconsistencies : [];
	}

	getStateInconsistencyCount(): number {
		return this.getStateInconsistencies().length;
	}

	isComplete(): boolean {
		return (
			this.hasBridgeSecurityAssessment() &&
			this.hasStateConsistencyAnalysis() &&
			this.hasInteroperabilityRisks() &&
			this.hasRecommendations()
		);
	}

	getSummary(): {
		bridge_security_score: number | null;
		highest_risk_level: string | null;
		total_risks: number;
		state_inconsistencies: number;
		recommendations: number;
		is_complete: boolean;
	} {
		return {
			bridge_security_score: this.getBridgeSecurityScore(),
			highest_risk_level: this.getHighestRiskLevel(),
			total_risks: this.getRiskCount(),
			state_inconsistencies: this.getStateInconsistencyCount(),
			recommendations: this.getRecommendationCount(),
			is_complete: this.isComplete(),
		};
	}

	toJSON() {
		return {
			id: this.id,
			multi_chain_audit_id: this.multi_chain_audit_id,
			bridge_security_assessment: this.bridge_security_assessment,
			state_consistency_analysis: this.state_consistency_analysis,
			interoperability_risks: this.interoperability_risks,
			recommendations: this.recommendations,
			created_at: this.created_at,
		};
	}
}
