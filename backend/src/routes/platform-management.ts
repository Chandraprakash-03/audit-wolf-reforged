import express from "express";
import { authenticateToken } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import { blockchainRegistry } from "../services/BlockchainRegistry";
import { PlatformConfigurationService } from "../services/PlatformConfigurationService";
import { HealthCheckService } from "../services/HealthCheckService";
import { logger } from "../utils/logger";
import { BlockchainPlatform, PlatformConfiguration } from "../types/blockchain";

const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(authenticateToken);
router.use(adminMiddleware);

/**
 * Get all blockchain platforms with their status
 */
router.get("/platforms", async (req, res) => {
	try {
		const platforms = blockchainRegistry.getAllPlatforms();
		const platformsWithStatus = await Promise.all(
			platforms.map(async (platform) => {
				const config =
					await PlatformConfigurationService.loadPlatformConfiguration(
						platform.id
					);
				const healthStatus = await HealthCheckService.checkPlatformHealth(
					platform.id
				);

				return {
					...platform,
					configuration: config,
					health: healthStatus,
				};
			})
		);

		res.json({
			success: true,
			platforms: platformsWithStatus,
			total: platformsWithStatus.length,
			active: platformsWithStatus.filter((p) => p.isActive).length,
		});
	} catch (error) {
		logger.error("Error getting platforms:", error);
		res.status(500).json({
			success: false,
			error: "Failed to get platforms",
		});
	}
});

/**
 * Get specific platform details
 */
router.get("/platforms/:platformId", async (req, res) => {
	try {
		const { platformId } = req.params;
		const platform = blockchainRegistry.getPlatform(platformId);

		if (!platform) {
			return res.status(404).json({
				success: false,
				error: "Platform not found",
			});
		}

		const config = await PlatformConfigurationService.loadPlatformConfiguration(
			platformId
		);
		const healthStatus = await HealthCheckService.checkPlatformHealth(
			platformId
		);

		res.json({
			success: true,
			platform: {
				...platform,
				configuration: config,
				health: healthStatus,
			},
		});
	} catch (error) {
		logger.error(`Error getting platform ${req.params.platformId}:`, error);
		res.status(500).json({
			success: false,
			error: "Failed to get platform details",
		});
	}
	return () => {};
});

/**
 * Update platform configuration
 */
router.put("/platforms/:platformId/config", async (req, res) => {
	try {
		const { platformId } = req.params;
		const config: PlatformConfiguration = req.body;

		const platform = blockchainRegistry.getPlatform(platformId);
		if (!platform) {
			return res.status(404).json({
				success: false,
				error: "Platform not found",
			});
		}

		const success =
			await PlatformConfigurationService.savePlatformConfiguration(
				platformId,
				config
			);

		if (success) {
			res.json({
				success: true,
				message: "Platform configuration updated successfully",
			});
		} else {
			res.status(500).json({
				success: false,
				error: "Failed to update platform configuration",
			});
		}
	} catch (error) {
		logger.error(
			`Error updating platform configuration for ${req.params.platformId}:`,
			error
		);
		res.status(500).json({
			success: false,
			error: "Failed to update platform configuration",
		});
	}
	return () => {};
});

/**
 * Reset platform configuration to default
 */
router.post("/platforms/:platformId/config/reset", async (req, res) => {
	try {
		const { platformId } = req.params;

		const platform = blockchainRegistry.getPlatform(platformId);
		if (!platform) {
			return res.status(404).json({
				success: false,
				error: "Platform not found",
			});
		}

		const success =
			await PlatformConfigurationService.resetPlatformConfiguration(platformId);

		if (success) {
			res.json({
				success: true,
				message: "Platform configuration reset to default",
			});
		} else {
			res.status(500).json({
				success: false,
				error: "Failed to reset platform configuration",
			});
		}
	} catch (error) {
		logger.error(
			`Error resetting platform configuration for ${req.params.platformId}:`,
			error
		);
		res.status(500).json({
			success: false,
			error: "Failed to reset platform configuration",
		});
	}
	return () => {};
});

/**
 * Activate/deactivate platform
 */
router.patch("/platforms/:platformId/status", async (req, res) => {
	try {
		const { platformId } = req.params;
		const { isActive } = req.body;

		if (typeof isActive !== "boolean") {
			return res.status(400).json({
				success: false,
				error: "isActive must be a boolean",
			});
		}

		const success = isActive
			? blockchainRegistry.activatePlatform(platformId)
			: blockchainRegistry.deactivatePlatform(platformId);

		if (success) {
			res.json({
				success: true,
				message: `Platform ${
					isActive ? "activated" : "deactivated"
				} successfully`,
			});
		} else {
			res.status(404).json({
				success: false,
				error: "Platform not found",
			});
		}
	} catch (error) {
		logger.error(
			`Error updating platform status for ${req.params.platformId}:`,
			error
		);
		res.status(500).json({
			success: false,
			error: "Failed to update platform status",
		});
	}
	return () => {};
});

/**
 * Get platform health status
 */
router.get("/platforms/:platformId/health", async (req, res) => {
	try {
		const { platformId } = req.params;
		const platform = blockchainRegistry.getPlatform(platformId);

		if (!platform) {
			return res.status(404).json({
				success: false,
				error: "Platform not found",
			});
		}

		const healthStatus = await HealthCheckService.checkPlatformHealth(
			platformId
		);

		res.json({
			success: true,
			health: healthStatus,
		});
	} catch (error) {
		logger.error(
			`Error checking platform health for ${req.params.platformId}:`,
			error
		);
		res.status(500).json({
			success: false,
			error: "Failed to check platform health",
		});
	}
	return () => {};
});

/**
 * Run health check for all platforms
 */
router.post("/platforms/health/check-all", async (req, res) => {
	try {
		const platforms = blockchainRegistry.getAllPlatforms();
		const healthResults = await Promise.all(
			platforms.map(async (platform) => ({
				platformId: platform.id,
				health: await HealthCheckService.checkPlatformHealth(platform.id),
			}))
		);

		res.json({
			success: true,
			results: healthResults,
		});
	} catch (error) {
		logger.error("Error running health check for all platforms:", error);
		res.status(500).json({
			success: false,
			error: "Failed to run health check for all platforms",
		});
	}
});

/**
 * Get platform capabilities and roadmap
 */
router.get("/platforms/capabilities", async (req, res) => {
	try {
		const platforms = blockchainRegistry.getAllPlatforms();
		const capabilities = platforms.map((platform) => ({
			id: platform.id,
			name: platform.name,
			displayName: platform.displayName,
			description: platform.description,
			supportedLanguages: platform.supportedLanguages,
			fileExtensions: platform.fileExtensions,
			staticAnalyzers: platform.staticAnalyzers.map((analyzer) => ({
				name: analyzer.name,
				supportedLanguages: analyzer.supportedLanguages,
			})),
			aiModels: platform.aiModels.map((model) => ({
				provider: model.provider,
				modelId: model.modelId,
				specialization: model.specialization,
			})),
			isActive: platform.isActive,
			version: platform.version,
			website: platform.website,
			documentation: platform.documentation,
		}));

		// Roadmap information
		const roadmap = {
			upcoming: [
				{
					platform: "cosmos",
					expectedRelease: "Q2 2024",
					features: ["CosmWasm support", "IBC analysis"],
				},
				{
					platform: "near",
					expectedRelease: "Q3 2024",
					features: ["Rust contracts", "Cross-contract calls"],
				},
			],
			inDevelopment: [
				{
					platform: "tezos",
					features: ["Michelson support", "FA2 token analysis"],
				},
			],
		};

		res.json({
			success: true,
			capabilities,
			roadmap,
		});
	} catch (error) {
		logger.error("Error getting platform capabilities:", error);
		res.status(500).json({
			success: false,
			error: "Failed to get platform capabilities",
		});
	}
});

/**
 * Get configuration summary for all platforms
 */
router.get("/config/summary", async (req, res) => {
	try {
		const summary =
			await PlatformConfigurationService.getConfigurationSummary();
		res.json({
			success: true,
			summary,
		});
	} catch (error) {
		logger.error("Error getting configuration summary:", error);
		res.status(500).json({
			success: false,
			error: "Failed to get configuration summary",
		});
	}
});

/**
 * Export platform configuration
 */
router.get("/platforms/:platformId/config/export", async (req, res) => {
	try {
		const { platformId } = req.params;
		const config = await PlatformConfigurationService.loadPlatformConfiguration(
			platformId
		);

		if (!config) {
			return res.status(404).json({
				success: false,
				error: "Platform configuration not found",
			});
		}

		res.setHeader("Content-Type", "application/json");
		res.setHeader(
			"Content-Disposition",
			`attachment; filename="${platformId}-config.json"`
		);
		res.json(config);
	} catch (error) {
		logger.error(
			`Error exporting configuration for ${req.params.platformId}:`,
			error
		);
		res.status(500).json({
			success: false,
			error: "Failed to export configuration",
		});
	}
	return () => {};
});

/**
 * Import platform configuration
 */
router.post("/platforms/:platformId/config/import", async (req, res) => {
	try {
		const { platformId } = req.params;
		const config: PlatformConfiguration = req.body;

		const success =
			await PlatformConfigurationService.savePlatformConfiguration(
				platformId,
				config
			);

		if (success) {
			res.json({
				success: true,
				message: "Configuration imported successfully",
			});
		} else {
			res.status(500).json({
				success: false,
				error: "Failed to import configuration",
			});
		}
	} catch (error) {
		logger.error(
			`Error importing configuration for ${req.params.platformId}:`,
			error
		);
		res.status(500).json({
			success: false,
			error: "Failed to import configuration",
		});
	}
});

export default router;
