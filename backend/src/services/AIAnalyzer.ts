import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { config as appConfig } from "../config";
import {
	AIAnalysisResult,
	AIVulnerability,
	SecurityRecommendation,
	QualityMetrics,
	CodeLocation,
} from "../types/database";
import {
	platformContextEngine,
	PlatformAIAnalysisOptions,
} from "./PlatformContextEngine";
import { ContractInput, PlatformVulnerability } from "../types/blockchain";

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

// Zod schemas for structured output validation
const CodeLocationSchema = z.object({
	file: z.string().default("contract.sol"),
	line: z.number().int().min(1).default(1),
	column: z.number().int().min(1).default(1),
	length: z.number().int().min(1).optional(),
});

const VulnerabilitySchema = z.object({
	type: z.enum([
		"reentrancy",
		"overflow",
		"access_control",
		"gas_optimization",
		"best_practice",
		"security",
	]),
	severity: z.enum(["critical", "high", "medium", "low", "informational"]),
	description: z.string().min(1),
	location: CodeLocationSchema,
	confidence: z.number().min(0).max(1),
});

const RecommendationSchema = z.object({
	category: z.string().min(1),
	priority: z.enum(["high", "medium", "low"]),
	description: z.string().min(1),
	implementation_guide: z.string().min(1),
});

const QualityMetricsSchema = z.object({
	code_quality_score: z.number().min(0).max(100),
	maintainability_index: z.number().min(0).max(100),
	test_coverage_estimate: z.number().min(0).max(100),
});

const AIAnalysisSchema = z.object({
	vulnerabilities: z.array(VulnerabilitySchema),
	recommendations: z.array(RecommendationSchema),
	qualityMetrics: QualityMetricsSchema,
	confidence: z.number().min(0).max(1),
});

export class AIAnalyzer {
	private models: ChatOpenAI[];
	private config: AIAnalyzerConfig;
	private outputParser: JsonOutputParser;

	constructor(config: AIAnalyzerConfig = {}) {
		this.config = {
			timeout: config.timeout || 120000, // 2 minutes
			maxTokens: config.maxTokens || 4000,
			temperature: config.temperature || 0.1, // Low temperature for consistent analysis
			models: config.models || [
				// "deepseek/deepseek-chat-v3.1:free",
				"moonshotai/kimi-k2:free",
				"z-ai/glm-4.5-air:free",
				// "openai/gpt-oss-20b:free",
			],
			ensembleThreshold: config.ensembleThreshold || 0.6,
		};

		// Initialize structured output parser
		this.outputParser = new JsonOutputParser();

		// Initialize models with OpenRouter
		this.models = this.config.models!.map(
			(modelName) =>
				new ChatOpenAI({
					modelName,
					apiKey: appConfig.openRouter.apiKey,
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
	 * Analyzes a smart contract using multiple AI models with platform-specific context
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
	 * Analyzes a contract with platform-specific context and vulnerability mapping
	 */
	async analyzePlatformContract(
		contract: ContractInput,
		options: PlatformAIAnalysisOptions = { platform: contract.platform }
	): Promise<{
		success: boolean;
		result?: {
			vulnerabilities: PlatformVulnerability[];
			recommendations: SecurityRecommendation[];
			code_quality: QualityMetrics;
			confidence: number;
		};
		error?: string;
		executionTime?: number;
		modelResponses?: ModelResponse[];
	}> {
		const startTime = Date.now();

		try {
			console.log(
				`Starting platform-specific AI analysis for ${contract.platform} contract: ${contract.filename}`
			);

			// Get platform-specific context and create enhanced prompt
			const platformPrompt = platformContextEngine.createPlatformAnalysisPrompt(
				contract,
				options
			);

			// Run analysis with multiple models using the platform-specific prompt
			const modelPromises = this.models.map((model, index) =>
				this.analyzeWithPlatformModel(
					model,
					this.config.models![index],
					platformPrompt,
					contract,
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

			// Map vulnerabilities to platform-specific format
			const platformVulnerabilities = platformContextEngine.mapVulnerabilities(
				ensembleResult.vulnerabilities,
				contract.platform
			);

			// Get platform-specific recommendations
			const platformRecommendations =
				platformContextEngine.getPlatformRecommendations(
					platformVulnerabilities,
					contract.platform
				);

			// Combine with AI recommendations
			const allRecommendations = [
				...ensembleResult.recommendations,
				...platformRecommendations,
			];

			const executionTime = Date.now() - startTime;
			console.log(
				`Platform-specific AI analysis completed in ${executionTime}ms with ${successfulResponses.length} models`
			);

			return {
				success: true,
				result: {
					vulnerabilities: platformVulnerabilities,
					recommendations: allRecommendations,
					code_quality: ensembleResult.code_quality,
					confidence: ensembleResult.confidence,
				},
				executionTime,
				modelResponses: successfulResponses,
			};
		} catch (error) {
			console.error("Platform-specific AI analysis failed:", error);
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
			// Create analysis prompt template
			const promptTemplate = PromptTemplate.fromTemplate(
				this.createAnalysisPrompt(sourceCode, contractName, options)
			);

			// Create analysis chain with structured output
			const chain = RunnableSequence.from([
				promptTemplate,
				model,
				this.outputParser,
			]);

			// Execute analysis
			const response = await chain.invoke({
				sourceCode,
				contractName,
				focusAreas: options.focusAreas?.join(", ") || "all security aspects",
				format_instructions: this.outputParser.getFormatInstructions(),
			});

			// Validate and transform the response
			const parsedResult = this.validateModelResponse(response, modelName);

			return {
				model: modelName,
				...parsedResult,
				executionTime: Date.now() - startTime,
			};
		} catch (error) {
			console.error(`Model ${modelName} analysis failed:`, error);

			// Try fallback parsing for models that don't follow structured output
			try {
				const fallbackResult = await this.fallbackAnalysis(
					model,
					sourceCode,
					contractName,
					options,
					modelName
				);
				return {
					model: modelName,
					...fallbackResult,
					executionTime: Date.now() - startTime,
				};
			} catch (fallbackError) {
				console.error(
					`Fallback analysis also failed for ${modelName}:`,
					fallbackError
				);
				throw error;
			}
		}
	}

	/**
	 * Analyzes contract with a single AI model using platform-specific context
	 */
	private async analyzeWithPlatformModel(
		model: ChatOpenAI,
		modelName: string,
		platformPrompt: string,
		contract: ContractInput,
		options: PlatformAIAnalysisOptions
	): Promise<ModelResponse> {
		const startTime = Date.now();

		try {
			// Execute analysis with platform-specific prompt
			const response = await model.invoke(platformPrompt);
			const responseText =
				typeof response.content === "string"
					? response.content
					: String(response.content);

			// Parse and validate the response
			const parsedResult = this.parsePlatformResponse(responseText, modelName);

			return {
				model: modelName,
				...parsedResult,
				executionTime: Date.now() - startTime,
			};
		} catch (error) {
			console.error(`Platform model ${modelName} analysis failed:`, error);

			// Try fallback parsing for models that don't follow structured output
			try {
				const fallbackResult = await this.fallbackPlatformAnalysis(
					model,
					contract,
					options,
					modelName
				);
				return {
					model: modelName,
					...fallbackResult,
					executionTime: Date.now() - startTime,
				};
			} catch (fallbackError) {
				console.error(
					`Fallback platform analysis also failed for ${modelName}:`,
					fallbackError
				);
				throw error;
			}
		}
	}

	/**
	 * Parse platform-specific AI response
	 */
	private parsePlatformResponse(
		responseText: string,
		modelName: string
	): {
		vulnerabilities: AIVulnerability[];
		recommendations: SecurityRecommendation[];
		qualityMetrics: QualityMetrics;
		confidence: number;
	} {
		try {
			// Try to extract and parse JSON with multiple strategies
			let parsed: any;

			// Strategy 1: Look for complete JSON object
			let jsonMatch = responseText.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				try {
					parsed = JSON.parse(jsonMatch[0]);
				} catch (e) {
					// Strategy 2: Try to find JSON between code blocks
					const codeBlockMatch = responseText.match(
						/```(?:json)?\s*(\{[\s\S]*?\})\s*```/
					);
					if (codeBlockMatch) {
						parsed = JSON.parse(codeBlockMatch[1]);
					} else {
						throw new Error("Failed to parse JSON from response");
					}
				}
			} else {
				throw new Error("No JSON found in platform response");
			}

			// Validate with Zod schema
			const validated = AIAnalysisSchema.parse(parsed);

			return this.validateModelResponse(validated, modelName);
		} catch (error) {
			console.error(
				`Failed to parse platform response from ${modelName}:`,
				error
			);
			console.error("Response was:", responseText.substring(0, 500));

			// Return empty but valid structure as fallback
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
	 * Fallback platform analysis for models that don't support structured output
	 */
	private async fallbackPlatformAnalysis(
		model: ChatOpenAI,
		contract: ContractInput,
		options: PlatformAIAnalysisOptions,
		modelName: string
	): Promise<{
		vulnerabilities: AIVulnerability[];
		recommendations: SecurityRecommendation[];
		qualityMetrics: QualityMetrics;
		confidence: number;
	}> {
		console.log(`Attempting fallback platform analysis for ${modelName}`);

		// Create a simpler platform-aware prompt for fallback
		const fallbackPrompt = `You are an expert ${contract.platform} smart contract security auditor. Analyze this contract and respond with ONLY valid JSON:

Contract: ${contract.filename}
Platform: ${contract.platform}

\`\`\`
${contract.code}
\`\`\`

CRITICAL: Respond with ONLY valid JSON in this exact format (no additional text):

{
  "vulnerabilities": [
    {
      "type": "platform_specific_type",
      "severity": "high", 
      "description": "Description here",
      "location": {"file": "${contract.filename}", "line": 1, "column": 1},
      "confidence": 0.9
    }
  ],
  "recommendations": [
    {
      "category": "Security",
      "priority": "high",
      "description": "Recommendation here",
      "implementation_guide": "Guide here"
    }
  ],
  "qualityMetrics": {
    "code_quality_score": 80,
    "maintainability_index": 75,
    "test_coverage_estimate": 60
  },
  "confidence": 0.85
}`;

		const response = await model.invoke(fallbackPrompt);
		const responseText =
			typeof response.content === "string"
				? response.content
				: String(response.content);

		return this.parsePlatformResponse(responseText, modelName);
	}

	/**
	 * Creates the analysis prompt for AI models with structured output instructions
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

{format_instructions}

IMPORTANT: You MUST respond with valid JSON only. Do not include any text before or after the JSON object.

Focus on:
1. Reentrancy vulnerabilities
2. Integer overflow/underflow issues  
3. Access control problems
4. Gas optimization opportunities
5. Best practice violations
6. Logic errors and edge cases

Provide specific line numbers and detailed explanations for each finding. Rate your overall confidence in the analysis (0-1).

Required JSON structure:
{{
  "vulnerabilities": [
    {{
      "type": "reentrancy|overflow|access_control|gas_optimization|best_practice|security",
      "severity": "critical|high|medium|low|informational", 
      "description": "Detailed description of the vulnerability",
      "location": {{
        "file": "contract.sol",
        "line": 1,
        "column": 1,
        "length": 10
      }},
      "confidence": 0.95
    }}
  ],
  "recommendations": [
    {{
      "category": "Security",
      "priority": "high|medium|low",
      "description": "Recommendation description", 
      "implementation_guide": "Step-by-step implementation guide"
    }}
  ],
  "qualityMetrics": {{
    "code_quality_score": 85,
    "maintainability_index": 75,
    "test_coverage_estimate": 60
  }},
  "confidence": 0.88
}}`;
	}

	/**
	 * Validates the model response using Zod schema
	 */
	private validateModelResponse(
		response: any,
		modelName: string
	): {
		vulnerabilities: AIVulnerability[];
		recommendations: SecurityRecommendation[];
		qualityMetrics: QualityMetrics;
		confidence: number;
	} {
		try {
			// Validate the response with Zod schema
			const validated = AIAnalysisSchema.parse(response);

			// Transform to our internal types
			return {
				vulnerabilities: validated.vulnerabilities.map((v) => ({
					type: v.type,
					severity: v.severity,
					description: v.description,
					location: {
						file: v.location.file,
						line: v.location.line,
						column: v.location.column,
						length: v.location.length,
					},
					confidence: v.confidence,
				})),
				recommendations: validated.recommendations.map((r) => ({
					category: r.category,
					priority: r.priority,
					description: r.description,
					implementation_guide: r.implementation_guide,
				})),
				qualityMetrics: {
					code_quality_score: validated.qualityMetrics.code_quality_score,
					maintainability_index: validated.qualityMetrics.maintainability_index,
					test_coverage_estimate:
						validated.qualityMetrics.test_coverage_estimate,
				},
				confidence: validated.confidence,
			};
		} catch (error) {
			console.error(`Failed to validate response from ${modelName}:`, error);
			console.error("Response was:", JSON.stringify(response, null, 2));

			// Return empty but valid structure as fallback
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
	 * Fallback analysis for models that don't support structured output
	 */
	private async fallbackAnalysis(
		model: ChatOpenAI,
		sourceCode: string,
		contractName: string,
		options: AIAnalysisOptions,
		modelName: string
	): Promise<{
		vulnerabilities: AIVulnerability[];
		recommendations: SecurityRecommendation[];
		qualityMetrics: QualityMetrics;
		confidence: number;
	}> {
		console.log(`Attempting fallback analysis for ${modelName}`);

		// Use simple string output parser for fallback
		const fallbackPrompt = `You are an expert smart contract security auditor. Analyze the following Solidity contract.

Contract: ${contractName}

\`\`\`solidity
${sourceCode}
\`\`\`

CRITICAL: Respond with ONLY valid JSON in this exact format (no additional text):

{
  "vulnerabilities": [
    {
      "type": "reentrancy",
      "severity": "high", 
      "description": "Description here",
      "location": {"file": "contract.sol", "line": 1, "column": 1},
      "confidence": 0.9
    }
  ],
  "recommendations": [
    {
      "category": "Security",
      "priority": "high",
      "description": "Recommendation here",
      "implementation_guide": "Guide here"
    }
  ],
  "qualityMetrics": {
    "code_quality_score": 80,
    "maintainability_index": 75,
    "test_coverage_estimate": 60
  },
  "confidence": 0.85
}`;

		const response = await model.invoke(fallbackPrompt);
		const responseText =
			typeof response.content === "string"
				? response.content
				: String(response.content);

		// Try to extract and parse JSON with multiple strategies
		let parsed: any;

		// Strategy 1: Look for complete JSON object
		let jsonMatch = responseText.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			try {
				parsed = JSON.parse(jsonMatch[0]);
			} catch (e) {
				// Strategy 2: Try to find JSON between code blocks
				const codeBlockMatch = responseText.match(
					/```(?:json)?\s*(\{[\s\S]*?\})\s*```/
				);
				if (codeBlockMatch) {
					parsed = JSON.parse(codeBlockMatch[1]);
				} else {
					throw new Error("Failed to parse JSON from response");
				}
			}
		} else {
			throw new Error("No JSON found in fallback response");
		}

		// Validate with Zod schema
		const validated = AIAnalysisSchema.parse(parsed);

		return this.validateModelResponse(validated, modelName);
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
				// "deepseek/deepseek-chat-v3.1:free",
				"moonshotai/kimi-k2:free",
				"z-ai/glm-4.5-air:free",
				// "openai/gpt-oss-20b:free",
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
