import { Router, Response } from "express";
import { ContractModel } from "../models/Contract";
import { AnalysisService } from "../services/AnalysisService";
import { AuditOrchestrator, JobPriority } from "../services/AuditOrchestrator";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import {
	validateContractInput,
	validateUUID,
	validatePagination,
	handleValidationErrors,
	createRateLimit,
} from "../middleware/security";
import { encryptionService } from "../services/EncryptionService";
import { validationResult } from "express-validator";

const router = Router();
const analysisService = new AnalysisService();

// Rate limiting for contract uploads (more restrictive)
const contractUploadLimit = createRateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 20, // Limit contract uploads to 20 per hour
	message: "Too many contract uploads, please try again later",
});

// Create a new contract
router.post(
	"/",
	contractUploadLimit,
	authenticateToken,
	validateContractInput,
	handleValidationErrors,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { name, sourceCode, compilerVersion, platform, language } =
				req.body;
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					error: "User not authenticated",
				});
			}

			// Encrypt sensitive contract data
			const encryptedContract = encryptionService.encryptContract(sourceCode);

			// Validate contract code based on platform
			const contractPlatform = platform || "ethereum";
			const contractLanguage = language || "solidity";

			const tempContract = new ContractModel({
				id: "temp",
				user_id: userId,
				name,
				source_code: sourceCode,
				compiler_version: compilerVersion || "0.8.0",
				file_hash: encryptedContract.hash,
				blockchain_platform: contractPlatform,
				language: contractLanguage,
				created_at: new Date(),
			});

			// Use platform-specific validation
			let validation;
			if (
				contractLanguage === "solidity" ||
				["ethereum", "bsc", "polygon"].includes(contractPlatform)
			) {
				validation = tempContract.validateSolidity();
			} else {
				// For non-Solidity platforms, use basic validation
				validation = { isValid: true, errors: [] };

				// Basic validation for non-empty code
				if (!sourceCode.trim()) {
					validation = {
						isValid: false,
						errors: ["Contract code cannot be empty"],
					};
				}
			}

			if (!validation.isValid) {
				// Securely delete decrypted source code from memory
				encryptionService.secureDelete(sourceCode);

				return res.status(400).json({
					success: false,
					error: `Invalid ${contractLanguage} code`,
					details: validation.errors,
				});
			}

			// Create the contract with encrypted source code
			const contract = await ContractModel.create({
				user_id: userId,
				name,
				source_code: JSON.stringify(encryptedContract), // Store encrypted data
				compiler_version: compilerVersion || "0.8.0",
				blockchain_platform: contractPlatform,
				language: contractLanguage,
			});

			// Securely delete decrypted source code from memory
			encryptionService.secureDelete(sourceCode);

			if (!contract) {
				return res.status(500).json({
					success: false,
					error: "Failed to create contract",
				});
			}

			// Optionally start analysis automatically (configurable type)
			let auditId: string | undefined;
			try {
				const auditOrchestrator = req.app.locals
					.auditOrchestrator as AuditOrchestrator;

				if (auditOrchestrator) {
					const defaultAnalysisType =
						(process.env.DEFAULT_ANALYSIS_TYPE as "static" | "ai" | "full") ||
						"full";
					const analysisResult = await auditOrchestrator.startAudit({
						contractId: contract.id,
						userId,
						analysisType: defaultAnalysisType,
						priority: JobPriority.NORMAL,
					});
					if (analysisResult.success) {
						auditId = analysisResult.auditId;
					}
				}
			} catch (analysisError) {
				console.warn("Failed to start automatic analysis:", analysisError);
				// Don't fail contract creation if analysis fails to start
			}

			res.status(201).json({
				success: true,
				data: {
					...contract.toJSON(),
					auditId, // Include audit ID if analysis was started
				},
			});
		} catch (error) {
			console.error("Error creating contract:", error);
			res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}
		return () => {};
	}
);

// Validate contract source code
router.post(
	"/validate",
	authenticateToken,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { sourceCode, platform, language } = req.body;

			if (!sourceCode || typeof sourceCode !== "string") {
				return res.status(400).json({
					success: false,
					error: "Source code is required",
				});
			}

			// Create temporary contract for validation
			const contractPlatform = platform || "ethereum";
			const contractLanguage = language || "solidity";

			const tempContract = new ContractModel({
				id: "temp",
				user_id: "temp",
				name: "temp",
				source_code: sourceCode,
				compiler_version: "0.8.0",
				file_hash: "temp",
				blockchain_platform: contractPlatform,
				language: contractLanguage,
				created_at: new Date(),
			});

			// Use platform-specific validation
			let validation;
			if (
				contractLanguage === "solidity" ||
				["ethereum", "bsc", "polygon"].includes(contractPlatform)
			) {
				validation = tempContract.validateSolidity();
			} else {
				// For non-Solidity platforms, use basic validation
				validation = { isValid: true, errors: [] };

				// Basic validation for non-empty code
				if (!sourceCode.trim()) {
					validation = {
						isValid: false,
						errors: ["Contract code cannot be empty"],
					};
				}
			}

			const metrics = tempContract.getComplexityMetrics();

			res.json({
				success: true,
				data: {
					isValid: validation.isValid,
					errors: validation.errors,
					metrics,
				},
			});
		} catch (error) {
			console.error("Error validating contract:", error);
			res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}
		return () => {};
	}
);

// Get user's contracts
router.get(
	"/",
	authenticateToken,
	validatePagination,
	handleValidationErrors,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					error: "User not authenticated",
				});
			}

			const contracts = await ContractModel.findByUserId(userId);

			res.json({
				success: true,
				data: contracts.map((contract) => contract.toJSON()),
			});
		} catch (error) {
			console.error("Error fetching contracts:", error);
			res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}
		return () => {};
	}
);

// Get specific contract
router.get(
	"/:id",
	authenticateToken,
	validateUUID("id"),
	handleValidationErrors,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					error: "Validation failed",
					details: errors.array(),
				});
			}

			const { id } = req.params;
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					error: "User not authenticated",
				});
			}

			const contract = await ContractModel.findById(id);

			if (!contract) {
				return res.status(404).json({
					success: false,
					error: "Contract not found",
				});
			}

			// Check if user owns the contract
			if (contract.user_id !== userId) {
				return res.status(403).json({
					success: false,
					error: "Access denied",
				});
			}

			res.json({
				success: true,
				data: contract.toJSON(),
			});
		} catch (error) {
			console.error("Error fetching contract:", error);
			res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}
		return () => {};
	}
);

// Update contract
router.patch(
	"/:id",
	authenticateToken,
	validateUUID("id"),
	handleValidationErrors,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					error: "Validation failed",
					details: errors.array(),
				});
			}

			const { id } = req.params;
			const userId = req.user?.id;
			const { name, sourceCode, compilerVersion } = req.body;

			if (!userId) {
				return res.status(401).json({
					success: false,
					error: "User not authenticated",
				});
			}

			const contract = await ContractModel.findById(id);

			if (!contract) {
				return res.status(404).json({
					success: false,
					error: "Contract not found",
				});
			}

			// Check if user owns the contract
			if (contract.user_id !== userId) {
				return res.status(403).json({
					success: false,
					error: "Access denied",
				});
			}

			// For now, we'll return the existing contract as updates aren't implemented in the model
			// In a real implementation, you'd add an update method to ContractModel
			res.json({
				success: true,
				data: contract.toJSON(),
				message: "Contract update functionality not yet implemented",
			});
		} catch (error) {
			console.error("Error updating contract:", error);
			res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}

		return () => {};
	}
);

// Delete contract
router.delete(
	"/:id",
	authenticateToken,
	validateUUID("id"),
	handleValidationErrors,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					error: "Validation failed",
					details: errors.array(),
				});
			}

			const { id } = req.params;
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					error: "User not authenticated",
				});
			}

			const contract = await ContractModel.findById(id);

			if (!contract) {
				return res.status(404).json({
					success: false,
					error: "Contract not found",
				});
			}

			// Check if user owns the contract
			if (contract.user_id !== userId) {
				return res.status(403).json({
					success: false,
					error: "Access denied",
				});
			}

			// For now, we'll return success as delete isn't implemented in the model
			// In a real implementation, you'd add a delete method to ContractModel
			res.json({
				success: true,
				message: "Contract delete functionality not yet implemented",
			});
		} catch (error) {
			console.error("Error deleting contract:", error);
			res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}

		return () => {};
	}
);

export default router;
