import { BlockchainAnalyzer } from "../../types/blockchain";
import { EthereumAnalyzer } from "./EthereumAnalyzer";
import { SolanaAnalyzer } from "./SolanaAnalyzer";
import { CardanoAnalyzer } from "./CardanoAnalyzer";
import { AptosAnalyzer } from "./AptosAnalyzer";
import { SuiAnalyzer } from "./SuiAnalyzer";
import { CrossChainAnalyzer } from "./CrossChainAnalyzer";
import { blockchainRegistry } from "../BlockchainRegistry";
import { logger } from "../../utils/logger";

/**
 * Factory for creating blockchain-specific analyzers
 */
export class AnalyzerFactory {
	private static analyzers: Map<string, BlockchainAnalyzer> = new Map();

	/**
	 * Get analyzer for a specific blockchain platform
	 */
	public static getAnalyzer(platformId: string): BlockchainAnalyzer | null {
		// Check if analyzer is already cached
		if (this.analyzers.has(platformId)) {
			return this.analyzers.get(platformId)!;
		}

		// Create new analyzer based on platform
		const analyzer = this.createAnalyzer(platformId);

		if (analyzer) {
			this.analyzers.set(platformId, analyzer);
			logger.info(`Created analyzer for platform: ${platformId}`);
		}

		return analyzer;
	}

	/**
	 * Get cross-chain analyzer instance
	 */
	public static getCrossChainAnalyzer(): CrossChainAnalyzer {
		return new CrossChainAnalyzer();
	}

	/**
	 * Get list of available platform IDs
	 */
	public static getAvailablePlatforms(): string[] {
		return blockchainRegistry.getSupportedPlatforms().map((p) => p.id);
	}

	/**
	 * Create analyzer instance for a platform
	 */
	private static createAnalyzer(platformId: string): BlockchainAnalyzer | null {
		const platform = blockchainRegistry.getPlatform(platformId);

		if (!platform) {
			logger.error(`Unknown platform: ${platformId}`);
			return null;
		}

		if (!platform.isActive) {
			logger.error(`Platform is not active: ${platformId}`);
			return null;
		}

		switch (platformId) {
			case "ethereum":
			case "bsc":
			case "polygon":
				// All EVM-compatible chains use the Ethereum analyzer
				return new EthereumAnalyzer();

			case "solana":
				return new SolanaAnalyzer();

			case "cardano":
				return new CardanoAnalyzer();

			case "aptos":
				return new AptosAnalyzer();

			case "sui":
				return new SuiAnalyzer();

			default:
				logger.error(`No analyzer implementation for platform: ${platformId}`);
				return null;
		}
	}

	/**
	 * Get all available analyzers
	 */
	public static getAllAnalyzers(): Map<string, BlockchainAnalyzer> {
		const platforms = blockchainRegistry.getSupportedPlatforms();

		for (const platform of platforms) {
			if (!this.analyzers.has(platform.id)) {
				const analyzer = this.createAnalyzer(platform.id);
				if (analyzer) {
					this.analyzers.set(platform.id, analyzer);
				}
			}
		}

		return new Map(this.analyzers);
	}

	/**
	 * Check health of all analyzers
	 */
	public static async checkAllAnalyzersHealth(): Promise<
		Map<
			string,
			{
				platform: string;
				healthy: boolean;
				version?: string;
				error?: string;
			}
		>
	> {
		const healthResults = new Map<
			string,
			{
				platform: string;
				healthy: boolean;
				version?: string;
				error?: string;
			}
		>();

		const analyzers = this.getAllAnalyzers();

		for (const [platformId, analyzer] of analyzers) {
			try {
				const health = await analyzer.checkHealth();
				healthResults.set(platformId, {
					platform: platformId,
					healthy: health.installed,
					version: health.version,
					error: health.error,
				});
			} catch (error) {
				healthResults.set(platformId, {
					platform: platformId,
					healthy: false,
					error: error instanceof Error ? error.message : "Health check failed",
				});
			}
		}

		return healthResults;
	}

	/**
	 * Get supported platforms with analyzer availability
	 */
	public static getSupportedPlatformsWithAnalyzers(): Array<{
		platformId: string;
		platformName: string;
		hasAnalyzer: boolean;
		isActive: boolean;
	}> {
		const platforms = blockchainRegistry.getAllPlatforms();

		return platforms.map((platform) => ({
			platformId: platform.id,
			platformName: platform.name,
			hasAnalyzer: this.hasAnalyzerImplementation(platform.id),
			isActive: platform.isActive,
		}));
	}

	/**
	 * Check if analyzer implementation exists for a platform
	 */
	private static hasAnalyzerImplementation(platformId: string): boolean {
		// List of platforms with implemented analyzers
		const implementedPlatforms = [
			"ethereum",
			"bsc",
			"polygon", // EVM-compatible chains
			"solana", // Rust/Anchor
			"cardano", // Haskell/Plutus
			"aptos",
			"sui", // Move-based (using fallback for now)
		];
		return implementedPlatforms.includes(platformId);
	}

	/**
	 * Clear analyzer cache
	 */
	public static clearCache(): void {
		this.analyzers.clear();
		logger.info("Analyzer cache cleared");
	}

	/**
	 * Remove analyzer from cache
	 */
	public static removeAnalyzer(platformId: string): boolean {
		const removed = this.analyzers.delete(platformId);
		if (removed) {
			logger.info(`Removed analyzer from cache: ${platformId}`);
		}
		return removed;
	}

	/**
	 * Get analyzer statistics
	 */
	public static getAnalyzerStatistics(): {
		totalPlatforms: number;
		implementedAnalyzers: number;
		cachedAnalyzers: number;
		activePlatforms: number;
	} {
		const platforms = blockchainRegistry.getAllPlatforms();
		const activePlatforms = platforms.filter((p) => p.isActive);
		const implementedCount = platforms.filter((p) =>
			this.hasAnalyzerImplementation(p.id)
		).length;

		return {
			totalPlatforms: platforms.length,
			implementedAnalyzers: implementedCount,
			cachedAnalyzers: this.analyzers.size,
			activePlatforms: activePlatforms.length,
		};
	}

	/**
	 * Validate analyzer for platform
	 */
	public static async validateAnalyzer(platformId: string): Promise<{
		valid: boolean;
		issues: string[];
		recommendations: string[];
	}> {
		const issues: string[] = [];
		const recommendations: string[] = [];

		try {
			const platform = blockchainRegistry.getPlatform(platformId);

			if (!platform) {
				issues.push(`Platform '${platformId}' not found in registry`);
				return { valid: false, issues, recommendations };
			}

			if (!platform.isActive) {
				issues.push(`Platform '${platformId}' is not active`);
				recommendations.push("Activate the platform in the registry");
			}

			if (!this.hasAnalyzerImplementation(platformId)) {
				issues.push(
					`No analyzer implementation available for platform '${platformId}'`
				);
				recommendations.push("Implement analyzer for this platform");
				return { valid: false, issues, recommendations };
			}

			const analyzer = this.getAnalyzer(platformId);

			if (!analyzer) {
				issues.push(`Failed to create analyzer for platform '${platformId}'`);
				return { valid: false, issues, recommendations };
			}

			const health = await analyzer.checkHealth();

			if (!health.installed) {
				issues.push(`Analyzer tools not properly installed: ${health.error}`);
				recommendations.push(
					"Install required analysis tools for this platform"
				);
			}

			if (platform.staticAnalyzers.length === 0) {
				recommendations.push(
					"Configure static analyzers for better analysis coverage"
				);
			}

			if (platform.validationRules.length === 0) {
				recommendations.push(
					"Add validation rules for improved contract validation"
				);
			}
		} catch (error) {
			issues.push(
				`Analyzer validation failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}

		return {
			valid: issues.length === 0,
			issues,
			recommendations,
		};
	}
}
