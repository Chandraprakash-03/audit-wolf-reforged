import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { config as appConfig } from "../config";
import {
	AIAnalysisResult,
	AIVulnerability,
	SecurityRecommendation,
	QualityMetrics,
	CodeLocation,
} from "../types/database";

export interface AIAnalyzerConfig {
	timeout?: number;
	maxTokens?: number;
	temperature?: number;
	models?: string[];
	ensembleThreshold?: number;
}

export interface AIAnalysisOptions {
	includeRecommendations?: boolean;
	includeQualityMetrics?: boolean;
	focusAreas?: string[];
	severityThreshold?: "low" | "medium" | "high" | "critical";
}

export interface ModelResponse {
	model: string;
	vulnerabilities: AIVulnerability[];
	recommendations: SecurityRecommendation[];
	qualityMetrics: QualityMetrics;
	confidence: number;
	executionTime: number;
}

export class AIAnalyzer {
	private models: ChatOpenAI[];
	private config: AIAnalyzerConfig;

	constructor(config: AIAnalyzerConfig = {}) {
		this.config = {
			timeout: config.timeout || 120000, // 2 minutes
			maxTokens: config.maxTokens || 4000,
			temperature: config.temperature || 0.1, // Low temperature for consistent analysis
			models: config.models || [
				"deepseek/deepseek-chat-v3.1:free",
				"moonshotai/kimi-k2:free",
				"openai/gpt-oss-120b:free",
				"z-ai/glm-4.5-air:free",
			],
			ensembleThreshold: config.ensembleThreshold || 0.6,
		};

		// Initialize models with OpenRouter
		this.models = this.config.models!.map(
			(modelName) =>
				new ChatOpenAI({
					modelName,
					openAIApiKey: appConfig.openRouter.apiKey,
					configuration: {
						baseURL: "https://openrouter.ai/api/v1",
						defaultHeaders: {
							"HTTP-Referer": "https://auditwolf.com",
							"X-Title": "Audit Wolf",
						},
					},
					maxTokens: this.config.maxTokens,
					temperature: this.config.temperature,
				})
		);
	}

	/**
	 * Analyzes a smart contract using multiple AI models
	 */
	async analyzeContract(
		sourceCode: string,
		contractName: string,
		options: AIAnalysisOptions = {}
	): Promise<{
		success: boolean;
		result?: AIAnalysisResult;
		error?: string;
		executionTime?: number;
		modelResponses?: ModelResponse[];
	}> {
		const startTime = Date.now();

		try {
			console.log(`Starting AI analysis for contract: ${contractName}`);

			// Run analysis with multiple models in parallel
			const modelPromises = this.models.map((model, index) =>
				this.analyzeWithModel(
					model,
					this.config.models![index],
					sourceCode,
					contractName,
					options
				)
			);

			const modelResponses = await Promise.allSettled(modelPromises);
			const successfulResponses: ModelResponse[] = [];

			// Collect successful responses
			modelResponses.forEach((response, index) => {
				if (response.status === "fulfilled") {
					successfulResponses.push(response.value);
				} else {
					console.error(
						`Model ${this.config.models![index]} failed:`,
						response.reason
					);
				}
			});

			if (successfulResponses.length === 0) {
				return {
					success: false,
					error: "All AI models failed to analyze the contract",
					executionTime: Date.now() - startTime,
				};
			}

			// Combine results using ensemble method
			const ensembleResult = this.combineModelResults(successfulResponses);

			const executionTime = Date.now() - startTime;
			console.log(
				`AI analysis completed in ${executionTime}ms with ${successfulResponses.length} models`
			);

			return {
				success: true,
				result: ensembleResult,
				executionTime,
				modelResponses: successfulResponses,
			};
		} catch (error) {
			console.error("AI analysis failed:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				executionTime: Date.now() - startTime,
			};
		}
	}

	/**
	 * Analyzes contract with a single AI model
	 */
	private async analyzeWithModel(
		model: ChatOpenAI,
		modelName: string,
		sourceCode: string,
		contractName: string,
		options: AIAnalysisOptions
	): Promise<ModelResponse> {
		const startTime = Date.now();

		try {
			// Create analysis prompt
			const prompt = this.createAnalysisPrompt(
				sourceCode,
				contractName,
				options
			);

			// Create analysis chain
			const chain = RunnableSequence.from([
				PromptTemplate.fromTemplate(prompt),
				model,
				new StringOutputParser(),
			]);

			// Execute analysis
			const response = await chain.invoke({
				sourceCode,
				contractName,
				focusAreas: options.focusAreas?.join(", ") || "all security aspects",
			});

			// Parse the response
			const parsedResult = this.parseModelResponse(response, modelName);

			return {
				model: modelName,
				...parsedResult,
				executionTime: Date.now() - startTime,
			};
		} catch (error) {
			console.error(`Model ${modelName} analysis failed:`, error);
			throw error;
		}
	}

	/**
	 * Creates the analysis prompt for AI models
	 */
	private createAnalysisPrompt(
		sourceCode: string,
		contractName: string,
		options: AIAnalysisOptions
	): string {
		return `You are an expert smart contract security auditor. Analyze the following Solidity contract for security vulnerabilities, gas optimizations, and code quality issues.

Contract Name: {contractName}
Focus Areas: {focusAreas}

Contract Source Code:
\`\`\`solidity
{sourceCode}
\`\`\`

Please provide a comprehensive analysis in the following JSON format:

{
  "vulnerabilities": [
    {
      "type": "reentrancy|overflow|access_control|gas_optimization|best_practice",
      "severity": "critical|high|medium|low|informational",
      "description": "Detailed description of the vulnerability",
      "location": {
        "file": "contract.sol",
        "line": 0,
        "column": 0,
        "length": 0
      },
      "confidence": 0.95
    }
  ],
  "recommendations": [
    {
      "category": "Security|Gas|Best Practices",
      "priority": "high|medium|low",
      "description": "Recommendation description",
      "implementation_guide": "Step-by-step implementation guide"
    }
  ],
  "qualityMetrics": {
    "code_quality_score": 85,
    "maintainability_index": 75,
    "test_coverage_estimate": 60
  },
  "confidence": 0.88
}

Focus on:
1. Reentrancy vulnerabilities
2. Integer overflow/underflow issues
3. Access control problems
4. Gas optimization opportunities
5. Best practice violations
6. Logic errors and edge cases

Provide specific line numbers and detailed explanations for each finding. Rate your overall confidence in the analysis (0-1).`;
	}

	/**
	 * Parses the model response into structured data
	 */
	private parseModelResponse(
		response: string,
		modelName: string
	): {
		vulnerabilities: AIVulnerability[];
		recommendations: SecurityRecommendation[];
		qualityMetrics: QualityMetrics;
		confidence: number;
	} {
		try {
			// Extract JSON from response (handle cases where model adds extra text)
			const jsonMatch = response.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error("No JSON found in model response");
			}

			const parsed = JSON.parse(jsonMatch[0]);

			return {
				vulnerabilities: this.validateVulnerabilities(
					parsed.vulnerabilities || []
				),
				recommendations: this.validateRecommendations(
					parsed.recommendations || []
				),
				qualityMetrics: this.validateQualityMetrics(
					parsed.qualityMetrics || {}
				),
				confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
			};
		} catch (error) {
			console.error(`Failed to parse response from ${modelName}:`, error);
			// Return empty but valid structure
			return {
				vulnerabilities: [],
				recommendations: [],
				qualityMetrics: {
					code_quality_score: 50,
					maintainability_index: 50,
					test_coverage_estimate: 0,
				},
				confidence: 0.1,
			};
		}
	}

	/**
	 * Validates and sanitizes vulnerability data
	 */
	private validateVulnerabilities(vulnerabilities: any[]): AIVulnerability[] {
		const validTypes = [
			"reentrancy",
			"overflow",
			"access_control",
			"gas_optimization",
			"best_practice",
		];
		const validSeverities = [
			"critical",
			"high",
			"medium",
			"low",
			"informational",
		];

		return vulnerabilities
			.filter((v) => v && typeof v === "object")
			.map((v) => ({
				type: validTypes.includes(v.type) ? v.type : "best_practice",
				severity: validSeverities.includes(v.severity) ? v.severity : "low",
				description: String(v.description || "No description provided"),
				location: this.validateLocation(v.location),
				confidence: Math.max(0, Math.min(1, Number(v.confidence) || 0.5)),
			}));
	}

	/**
	 * Validates and sanitizes recommendation data
	 */
	private validateRecommendations(
		recommendations: any[]
	): SecurityRecommendation[] {
		const validPriorities = ["high", "medium", "low"];

		return recommendations
			.filter((r) => r && typeof r === "object")
			.map((r) => ({
				category: String(r.category || "General"),
				priority: validPriorities.includes(r.priority) ? r.priority : "medium",
				description: String(r.description || "No description provided"),
				implementation_guide: String(
					r.implementation_guide || "No implementation guide provided"
				),
			}));
	}

	/**
	 * Validates and sanitizes quality metrics
	 */
	private validateQualityMetrics(metrics: any): QualityMetrics {
		return {
			code_quality_score: Math.max(
				0,
				Math.min(100, Number(metrics.code_quality_score) || 50)
			),
			maintainability_index: Math.max(
				0,
				Math.min(100, Number(metrics.maintainability_index) || 50)
			),
			test_coverage_estimate: Math.max(
				0,
				Math.min(100, Number(metrics.test_coverage_estimate) || 0)
			),
		};
	}

	/**
	 * Validates and sanitizes location data
	 */
	private validateLocation(location: any): CodeLocation {
		return {
			file: String(location?.file || "contract.sol"),
			line: Math.max(1, Number(location?.line) || 1),
			column: Math.max(1, Number(location?.column) || 1),
			length: location?.length
				? Math.max(1, Number(location.length))
				: undefined,
		};
	}

	/**
	 * Combines results from multiple models using ensemble method
	 */
	private combineModelResults(responses: ModelResponse[]): AIAnalysisResult {
		if (responses.length === 1) {
			const response = responses[0];
			return {
				vulnerabilities: response.vulnerabilities,
				recommendations: response.recommendations,
				code_quality: response.qualityMetrics,
				confidence: response.confidence,
			};
		}

		// Combine vulnerabilities using consensus
		const allVulnerabilities = responses.flatMap((r) => r.vulnerabilities);
		const combinedVulnerabilities = this.consensusVulnerabilities(
			allVulnerabilities,
			responses.length
		);

		// Combine recommendations
		const allRecommendations = responses.flatMap((r) => r.recommendations);
		const combinedRecommendations =
			this.deduplicateRecommendations(allRecommendations);

		// Average quality metrics
		const avgQualityMetrics = this.averageQualityMetrics(
			responses.map((r) => r.qualityMetrics)
		);

		// Calculate ensemble confidence
		const avgConfidence =
			responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;

		return {
			vulnerabilities: combinedVulnerabilities,
			recommendations: combinedRecommendations,
			code_quality: avgQualityMetrics,
			confidence: avgConfidence,
		};
	}

	/**
	 * Creates consensus vulnerabilities from multiple model outputs
	 */
	private consensusVulnerabilities(
		vulnerabilities: AIVulnerability[],
		modelCount: number
	): AIVulnerability[] {
		// Group similar vulnerabilities
		const groups = new Map<string, AIVulnerability[]>();

		vulnerabilities.forEach((vuln) => {
			const key = `${vuln.type}-${vuln.location.line}-${vuln.severity}`;
			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key)!.push(vuln);
		});

		// Keep vulnerabilities that appear in multiple models or have high confidence
		const consensusVulns: AIVulnerability[] = [];

		groups.forEach((group) => {
			const threshold = Math.max(
				1,
				Math.floor(modelCount * this.config.ensembleThreshold!)
			);

			if (group.length >= threshold || group.some((v) => v.confidence > 0.8)) {
				// Use the vulnerability with highest confidence
				const bestVuln = group.reduce((best, current) =>
					current.confidence > best.confidence ? current : best
				);
				consensusVulns.push(bestVuln);
			}
		});

		return consensusVulns;
	}

	/**
	 * Removes duplicate recommendations
	 */
	private deduplicateRecommendations(
		recommendations: SecurityRecommendation[]
	): SecurityRecommendation[] {
		const seen = new Set<string>();
		return recommendations.filter((rec) => {
			const key = `${rec.category}-${rec.description}`;
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	}

	/**
	 * Averages quality metrics from multiple models
	 */
	private averageQualityMetrics(metrics: QualityMetrics[]): QualityMetrics {
		const count = metrics.length;
		return {
			code_quality_score:
				metrics.reduce((sum, m) => sum + m.code_quality_score, 0) / count,
			maintainability_index:
				metrics.reduce((sum, m) => sum + m.maintainability_index, 0) / count,
			test_coverage_estimate:
				metrics.reduce((sum, m) => sum + m.test_coverage_estimate, 0) / count,
		};
	}

	/**
	 * Checks if AI services are properly configured
	 */
	static async checkConfiguration(): Promise<{
		configured: boolean;
		availableModels: string[];
		errors: string[];
	}> {
		const errors: string[] = [];

		if (!appConfig.openRouter.apiKey) {
			errors.push("OpenRouter API key not configured");
		}

		// Test a simple API call
		let availableModels: string[] = [];
		try {
			const testModel = new ChatOpenAI({
				modelName: "openai/gpt-4o-mini",
				openAIApiKey: appConfig.openRouter.apiKey,
				configuration: {
					baseURL: "https://openrouter.ai/api/v1",
				},
				maxTokens: 10,
			});

			await testModel.invoke("test");
			availableModels = [
				"deepseek/deepseek-chat-v3.1:free",
				"moonshotai/kimi-k2:free",
				"openai/gpt-oss-120b:free",
				"z-ai/glm-4.5-air:free",
			];
		} catch (error) {
			errors.push(`API connection test failed: ${error}`);
		}

		return {
			configured: errors.length === 0,
			availableModels,
			errors,
		};
	}
}
