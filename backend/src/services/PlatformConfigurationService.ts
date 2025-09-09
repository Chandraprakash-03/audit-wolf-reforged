import {
	PlatformConfiguration,
	StaticAnalyzerConfig,
	AIModelConfig,
	ValidationRuleConfig,
	BlockchainPlatform,
	DetectionPattern,
} from "../types/blockchain";
import { blockchainRegistry } from "./BlockchainRegistry";
import { logger } from "../utils/logger";
import * as fs from "fs-extra";
import * as path from "path";

/**
 * Service for managing platform-specific configurations
 */
export class PlatformConfigurationService {
	private static readonly CONFIG_DIR = path.join(
		process.cwd(),
		"config",
		"platforms"
	);
	private static readonly DEFAULT_CONFIG_FILE = "default.json";

	/**
	 * Load configuration for a platform
	 */
	public static async loadPlatformConfiguration(
		platformId: string
	): Promise<PlatformConfiguration | null> {
		try {
			const configPath = path.join(this.CONFIG_DIR, `${platformId}.json`);

			if (await fs.pathExists(configPath)) {
				const config = await fs.readJson(configPath);
				logger.info(`Loaded configuration for platform: ${platformId}`);
				return this.validateConfiguration(config);
			}

			// Try to load default configuration
			const defaultConfigPath = path.join(
				this.CONFIG_DIR,
				this.DEFAULT_CONFIG_FILE
			);
			if (await fs.pathExists(defaultConfigPath)) {
				const defaultConfig = await fs.readJson(defaultConfigPath);
				logger.info(`Loaded default configuration for platform: ${platformId}`);
				return this.validateConfiguration(defaultConfig);
			}

			// Return built-in default configuration
			return this.getBuiltInDefaultConfiguration();
		} catch (error) {
			logger.error(
				`Failed to load configuration for platform ${platformId}:`,
				error
			);
			return null;
		}
	}

	/**
	 * Save configuration for a platform
	 */
	public static async savePlatformConfiguration(
		platformId: string,
		config: PlatformConfiguration
	): Promise<boolean> {
		try {
			await fs.ensureDir(this.CONFIG_DIR);

			const configPath = path.join(this.CONFIG_DIR, `${platformId}.json`);
			const validatedConfig = this.validateConfiguration(config);

			await fs.writeJson(configPath, validatedConfig, { spaces: 2 });

			// Update registry with new configuration
			blockchainRegistry.updatePlatformConfiguration(
				platformId,
				validatedConfig
			);

			logger.info(`Saved configuration for platform: ${platformId}`);
			return true;
		} catch (error) {
			logger.error(
				`Failed to save configuration for platform ${platformId}:`,
				error
			);
			return false;
		}
	}

	/**
	 * Get default configuration for a platform type
	 */
	public static getDefaultConfiguration(
		platformId: string
	): PlatformConfiguration {
		const platform = blockchainRegistry.getPlatform(platformId);

		if (!platform) {
			return this.getBuiltInDefaultConfiguration();
		}

		return this.generateDefaultConfigurationForPlatform(platform);
	}

	/**
	 * Update analyzer configuration for a platform
	 */
	public static async updateAnalyzerConfiguration(
		platformId: string,
		analyzerId: string,
		config: StaticAnalyzerConfig
	): Promise<boolean> {
		try {
			const platformConfig =
				(await this.loadPlatformConfiguration(platformId)) ||
				this.getDefaultConfiguration(platformId);

			platformConfig.analyzers[analyzerId] = config;

			return await this.savePlatformConfiguration(platformId, platformConfig);
		} catch (error) {
			logger.error(
				`Failed to update analyzer configuration for ${platformId}:`,
				error
			);
			return false;
		}
	}

	/**
	 * Update AI model configuration for a platform
	 */
	public static async updateAIModelConfiguration(
		platformId: string,
		modelId: string,
		config: AIModelConfig
	): Promise<boolean> {
		try {
			const platformConfig =
				(await this.loadPlatformConfiguration(platformId)) ||
				this.getDefaultConfiguration(platformId);

			platformConfig.aiModels[modelId] = config;

			return await this.savePlatformConfiguration(platformId, platformConfig);
		} catch (error) {
			logger.error(
				`Failed to update AI model configuration for ${platformId}:`,
				error
			);
			return false;
		}
	}

	/**
	 * Add or update validation rule for a platform
	 */
	public static async updateValidationRule(
		platformId: string,
		rule: ValidationRuleConfig
	): Promise<boolean> {
		try {
			const platformConfig =
				(await this.loadPlatformConfiguration(platformId)) ||
				this.getDefaultConfiguration(platformId);

			const existingRuleIndex = platformConfig.validationRules.findIndex(
				(r) => r.id === rule.id
			);

			if (existingRuleIndex >= 0) {
				platformConfig.validationRules[existingRuleIndex] = rule;
			} else {
				platformConfig.validationRules.push(rule);
			}

			return await this.savePlatformConfiguration(platformId, platformConfig);
		} catch (error) {
			logger.error(
				`Failed to update validation rule for ${platformId}:`,
				error
			);
			return false;
		}
	}

	/**
	 * Remove validation rule from a platform
	 */
	public static async removeValidationRule(
		platformId: string,
		ruleId: string
	): Promise<boolean> {
		try {
			const platformConfig =
				(await this.loadPlatformConfiguration(platformId)) ||
				this.getDefaultConfiguration(platformId);

			platformConfig.validationRules = platformConfig.validationRules.filter(
				(r) => r.id !== ruleId
			);

			return await this.savePlatformConfiguration(platformId, platformConfig);
		} catch (error) {
			logger.error(
				`Failed to remove validation rule for ${platformId}:`,
				error
			);
			return false;
		}
	}

	/**
	 * Get all configurations
	 */
	public static async getAllConfigurations(): Promise<
		Map<string, PlatformConfiguration>
	> {
		const configurations = new Map<string, PlatformConfiguration>();
		const platforms = blockchainRegistry.getAllPlatforms();

		for (const platform of platforms) {
			const config = await this.loadPlatformConfiguration(platform.id);
			if (config) {
				configurations.set(platform.id, config);
			}
		}

		return configurations;
	}

	/**
	 * Reset platform configuration to default
	 */
	public static async resetPlatformConfiguration(
		platformId: string
	): Promise<boolean> {
		try {
			const defaultConfig = this.getDefaultConfiguration(platformId);
			return await this.savePlatformConfiguration(platformId, defaultConfig);
		} catch (error) {
			logger.error(
				`Failed to reset configuration for platform ${platformId}:`,
				error
			);
			return false;
		}
	}

	/**
	 * Validate configuration object
	 */
	private static validateConfiguration(config: any): PlatformConfiguration {
		const validatedConfig: PlatformConfiguration = {
			analyzers: config.analyzers || {},
			aiModels: config.aiModels || {},
			validationRules: config.validationRules || [],
			detectionPatterns: config.detectionPatterns || [],
		};

		// Validate analyzers
		for (const [analyzerId, analyzerConfig] of Object.entries(
			validatedConfig.analyzers
		)) {
			if (typeof analyzerConfig !== "object") {
				logger.warn(
					`Invalid analyzer configuration for ${analyzerId}, using defaults`
				);
				validatedConfig.analyzers[analyzerId] = this.getDefaultAnalyzerConfig();
			}
		}

		// Validate AI models
		for (const [modelId, modelConfig] of Object.entries(
			validatedConfig.aiModels
		)) {
			if (typeof modelConfig !== "object") {
				logger.warn(
					`Invalid AI model configuration for ${modelId}, using defaults`
				);
				validatedConfig.aiModels[modelId] = this.getDefaultAIModelConfig();
			}
		}

		// Validate validation rules
		validatedConfig.validationRules = validatedConfig.validationRules.filter(
			(rule) => {
				return (
					rule.id &&
					typeof rule.id === "string" &&
					typeof rule.enabled === "boolean"
				);
			}
		);

		return validatedConfig;
	}

	/**
	 * Generate default configuration for a platform
	 */
	private static generateDefaultConfigurationForPlatform(
		platform: BlockchainPlatform
	): PlatformConfiguration {
		const config: PlatformConfiguration = {
			analyzers: {},
			aiModels: {},
			validationRules: [],
			detectionPatterns: platform.detectionPatterns,
		};

		// Add default analyzer configurations
		for (const analyzer of platform.staticAnalyzers) {
			config.analyzers[analyzer.name] = this.getDefaultAnalyzerConfig();
		}

		// Add default AI model configurations
		for (const model of platform.aiModels) {
			config.aiModels[model.modelId] = {
				enabled: true,
				provider: model.provider,
				modelId: model.modelId,
				maxTokens: model.maxTokens,
				temperature: 0.1,
				contextPrompts: model.contextPrompts,
			};
		}

		// Convert platform validation rules to configuration format
		for (const rule of platform.validationRules) {
			config.validationRules.push({
				id: rule.id,
				enabled: true,
				severity: "warning",
			});
		}

		return config;
	}

	/**
	 * Get built-in default configuration
	 */
	private static getBuiltInDefaultConfiguration(): PlatformConfiguration {
		return {
			analyzers: {
				default: this.getDefaultAnalyzerConfig(),
			},
			aiModels: {
				default: this.getDefaultAIModelConfig(),
			},
			validationRules: [
				{
					id: "syntax-check",
					enabled: true,
					severity: "error",
				},
				{
					id: "best-practices",
					enabled: true,
					severity: "warning",
				},
			],
			detectionPatterns: [],
		};
	}

	/**
	 * Get default analyzer configuration
	 */
	private static getDefaultAnalyzerConfig(): StaticAnalyzerConfig {
		return {
			enabled: true,
			timeout: 120000, // 2 minutes
			enabledDetectors: [],
			disabledDetectors: [],
			customArgs: [],
		};
	}

	/**
	 * Get default AI model configuration
	 */
	private static getDefaultAIModelConfig(): AIModelConfig {
		return {
			enabled: true,
			provider: "openrouter",
			modelId: "moonshotai/kimi-k2:free",
			maxTokens: 4000,
			temperature: 0.1,
			contextPrompts: [
				"You are a blockchain security expert analyzing smart contracts.",
				"Focus on identifying security vulnerabilities and best practices.",
			],
		};
	}

	/**
	 * Export configuration to file
	 */
	public static async exportConfiguration(
		platformId: string,
		filePath: string
	): Promise<boolean> {
		try {
			const config = await this.loadPlatformConfiguration(platformId);
			if (!config) {
				logger.error(`No configuration found for platform: ${platformId}`);
				return false;
			}

			await fs.writeJson(filePath, config, { spaces: 2 });
			logger.info(`Exported configuration for ${platformId} to ${filePath}`);
			return true;
		} catch (error) {
			logger.error(`Failed to export configuration for ${platformId}:`, error);
			return false;
		}
	}

	/**
	 * Import configuration from file
	 */
	public static async importConfiguration(
		platformId: string,
		filePath: string
	): Promise<boolean> {
		try {
			if (!(await fs.pathExists(filePath))) {
				logger.error(`Configuration file not found: ${filePath}`);
				return false;
			}

			const config = await fs.readJson(filePath);
			const validatedConfig = this.validateConfiguration(config);

			return await this.savePlatformConfiguration(platformId, validatedConfig);
		} catch (error) {
			logger.error(`Failed to import configuration for ${platformId}:`, error);
			return false;
		}
	}

	/**
	 * Get configuration summary for all platforms
	 */
	public static async getConfigurationSummary(): Promise<{
		platforms: number;
		totalAnalyzers: number;
		totalAIModels: number;
		totalValidationRules: number;
		platformSummaries: Array<{
			platformId: string;
			analyzers: number;
			aiModels: number;
			validationRules: number;
		}>;
	}> {
		const configurations = await this.getAllConfigurations();
		let totalAnalyzers = 0;
		let totalAIModels = 0;
		let totalValidationRules = 0;

		const platformSummaries = Array.from(configurations.entries()).map(
			([platformId, config]) => {
				const analyzers = Object.keys(config.analyzers).length;
				const aiModels = Object.keys(config.aiModels).length;
				const validationRules = config.validationRules.length;

				totalAnalyzers += analyzers;
				totalAIModels += aiModels;
				totalValidationRules += validationRules;

				return {
					platformId,
					analyzers,
					aiModels,
					validationRules,
				};
			}
		);

		return {
			platforms: configurations.size,
			totalAnalyzers,
			totalAIModels,
			totalValidationRules,
			platformSummaries,
		};
	}
}
