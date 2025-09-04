/**
 * Multi-blockchain platform support types
 */

export interface CodeLocation {
	file: string;
	line: number;
	column: number;
	length?: number;
}

export interface ValidationRule {
	id: string;
	name: string;
	description: string;
	pattern?: string;
	validator: (code: string, filename?: string) => ValidationResult;
}

export interface ValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
}

export interface StaticAnalyzer {
	name: string;
	command: string;
	args: string[];
	outputParser: (
		output: string,
		stderr: string,
		exitCode: number | null
	) => AnalysisResult;
	supportedLanguages: string[];
	installationCheck: () => Promise<InstallationCheckResult>;
	timeout: number;
	version?: string;
}

export interface InstallationCheckResult {
	installed: boolean;
	version?: string;
	error?: string;
}

export interface AIModel {
	provider: string;
	modelId: string;
	specialization: string[];
	costPerToken: number;
	maxTokens: number;
	contextPrompts: string[];
}

export interface BlockchainPlatform {
	id: string;
	name: string;
	displayName: string;
	description: string;
	supportedLanguages: string[];
	fileExtensions: string[];
	staticAnalyzers: StaticAnalyzer[];
	aiModels: AIModel[];
	validationRules: ValidationRule[];
	detectionPatterns: DetectionPattern[];
	isActive: boolean;
	version: string;
	documentation?: string;
	website?: string;
}

export interface DetectionPattern {
	type: "syntax" | "import" | "pragma" | "keyword" | "filename";
	pattern: string | RegExp;
	weight: number; // 0-1, higher means more confident
	description: string;
}

export interface PlatformDetectionResult {
	platform: BlockchainPlatform;
	confidence: number;
	matchedPatterns: DetectionPattern[];
}

export interface AnalysisResult {
	success: boolean;
	vulnerabilities: PlatformVulnerability[];
	errors: string[];
	warnings: string[];
	executionTime: number;
	platformSpecific?: Record<string, any>;
}

export interface PlatformVulnerability {
	id?: string;
	type: string;
	severity: "critical" | "high" | "medium" | "low" | "informational";
	title: string;
	description: string;
	location: CodeLocation;
	recommendation: string;
	confidence: number;
	source: "static" | "ai" | "combined";
	platform: string;
	platformSpecificData?: Record<string, any>;
	rawOutput?: any;
}

export interface ContractInput {
	code: string;
	filename: string;
	platform: string;
	language?: string;
	dependencies?: ContractInput[];
}

export interface MultiChainAnalysisRequest {
	contracts: ContractInput[];
	platforms: string[];
	analysisOptions: AnalysisOptions;
	crossChainAnalysis: boolean;
}

export interface AnalysisOptions {
	includeStaticAnalysis: boolean;
	includeAIAnalysis: boolean;
	severityThreshold: "critical" | "high" | "medium" | "low" | "informational";
	enabledDetectors?: string[];
	disabledDetectors?: string[];
	timeout?: number;
	maxFileSize?: number;
}

export interface MultiChainAnalysisResult {
	success: boolean;
	results: Map<string, AnalysisResult>;
	crossChainResults?: CrossChainAnalysisResult;
	summary: AnalysisSummary;
	executionTime: number;
}

export interface CrossChainAnalysisResult {
	bridgeSecurityAssessment?: BridgeSecurityResult;
	stateConsistencyAnalysis?: StateConsistencyResult;
	interoperabilityRisks: InteroperabilityRisk[];
	crossChainRecommendations: CrossChainRecommendation[];
}

export interface BridgeSecurityResult {
	lockingMechanisms: SecurityAssessment;
	messagePassing: SecurityAssessment;
	validatorSets: SecurityAssessment;
	overallSecurityScore: number;
}

export interface StateConsistencyResult {
	potentialInconsistencies: ConsistencyIssue[];
	recommendations: string[];
}

export interface SecurityAssessment {
	score: number;
	issues: string[];
	recommendations: string[];
}

export interface ConsistencyIssue {
	description: string;
	risk: number;
	affectedPlatforms: string[];
}

export interface InteroperabilityRisk {
	type: string;
	severity: "critical" | "high" | "medium" | "low";
	description: string;
	affectedPlatforms: string[];
	mitigation: string;
}

export interface CrossChainRecommendation {
	category: string;
	description: string;
	priority: "high" | "medium" | "low";
	platforms: string[];
}

export interface AnalysisSummary {
	totalVulnerabilities: number;
	severityBreakdown: Record<string, number>;
	platformBreakdown: Record<string, number>;
	executionTime: number;
	analysisTypes: string[];
}

// Platform-specific analyzer interfaces
export interface BlockchainAnalyzer {
	platform: string;
	analyze(contracts: ContractInput[]): Promise<AnalysisResult>;
	validateContract(contract: ContractInput): Promise<ValidationResult>;
	checkHealth(): Promise<InstallationCheckResult>;
}

// Configuration interfaces
export interface PlatformConfiguration {
	analyzers: Record<string, StaticAnalyzerConfig>;
	aiModels: Record<string, AIModelConfig>;
	validationRules: ValidationRuleConfig[];
	detectionPatterns: DetectionPattern[];
}

export interface StaticAnalyzerConfig {
	enabled: boolean;
	timeout: number;
	enabledDetectors?: string[];
	disabledDetectors?: string[];
	customArgs?: string[];
}

export interface AIModelConfig {
	enabled: boolean;
	provider: string;
	modelId: string;
	maxTokens: number;
	temperature: number;
	contextPrompts: string[];
}

export interface ValidationRuleConfig {
	id: string;
	enabled: boolean;
	severity: "error" | "warning";
	customPattern?: string;
}
