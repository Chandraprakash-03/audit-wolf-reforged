import IPFSService, { IPFSUploadResult, IPFSMetadata } from "./IPFSService";
import BlockchainService, {
	AuditRecord,
	BlockchainConfig,
} from "./BlockchainService";
import { supabase } from "../config/supabase";
import fs from "fs-extra";
import path from "path";

export interface StorageOptions {
	useIPFS: boolean;
	useBlockchain: boolean;
	fallbackToDatabase: boolean;
}

export interface StorageResult {
	ipfsHash?: string;
	ipfsUrl?: string;
	blockchainTxHash?: string;
	blockNumber?: number;
	databaseId?: string;
	success: boolean;
	errors: string[];
}

export interface AuditStorageData {
	auditId: string;
	contractAddress?: string;
	auditorAddress?: string;
	reportPath: string;
	auditData: any;
	metadata: {
		name: string;
		description: string;
		timestamp: number;
	};
}

export interface StorageStats {
	ipfsAvailable: boolean;
	blockchainAvailable: boolean;
	totalAudits: number;
	ipfsStored: number;
	blockchainStored: number;
	walletAddress?: string;
	walletBalance?: string;
}

export interface VerificationResult {
	isValid: boolean;
	onChain: boolean;
	ipfsAccessible: boolean;
	details: Record<string, any>;
}

export interface MigrationResult {
	migrated: number;
	failed: number;
	errors: string[];
}

export class DecentralizedStorageService {
	private ipfsService: IPFSService;
	private blockchainService: BlockchainService | null = null;

	constructor() {
		this.ipfsService = new IPFSService();

		// Initialize blockchain service if configured
		const blockchainConfig: BlockchainConfig = {
			rpcUrl: process.env.ETHEREUM_RPC_URL || process.env.POLYGON_RPC_URL || "",
			privateKey: process.env.PRIVATE_KEY || "",
			contractAddress: process.env.AUDIT_REGISTRY_CONTRACT_ADDRESS,
			gasLimit: parseInt(process.env.GAS_LIMIT || "500000"),
			gasPrice: process.env.GAS_PRICE,
		};

		if (blockchainConfig.rpcUrl && blockchainConfig.privateKey) {
			this.blockchainService = new BlockchainService(blockchainConfig);
		}
	}

	/**
	 * Store audit report using decentralized storage options
	 */
	async storeAuditReport(
		data: AuditStorageData,
		options: StorageOptions = {
			useIPFS: true,
			useBlockchain: true,
			fallbackToDatabase: true,
		}
	): Promise<StorageResult> {
		const result: StorageResult = {
			success: false,
			errors: [],
		};

		try {
			// 1. Upload report to IPFS (if enabled and available)
			if (options.useIPFS && this.ipfsService.isAvailable()) {
				try {
					const ipfsMetadata: IPFSMetadata = {
						name: data.metadata.name,
						description: data.metadata.description,
						auditId: data.auditId,
						contractAddress: data.contractAddress,
						timestamp: data.metadata.timestamp,
					};

					// Upload PDF report
					const reportUpload = await this.ipfsService.uploadReport(
						data.reportPath,
						ipfsMetadata
					);
					result.ipfsHash = reportUpload.hash;
					result.ipfsUrl = reportUpload.url;

					// Upload audit data as JSON
					const dataMetadata = {
						...ipfsMetadata,
						name: `${data.metadata.name}-data`,
					};
					await this.ipfsService.uploadJSON(data.auditData, dataMetadata);

					console.log(`Report uploaded to IPFS: ${reportUpload.hash}`);
				} catch (error) {
					const errorMsg = `IPFS upload failed: ${
						error instanceof Error ? error.message : "Unknown error"
					}`;
					result.errors.push(errorMsg);
					console.error(errorMsg);
				}
			}

			// 2. Store record on blockchain (if enabled and available)
			if (
				options.useBlockchain &&
				this.blockchainService?.isAvailable() &&
				result.ipfsHash
			) {
				try {
					const auditRecord: Omit<
						AuditRecord,
						"blockNumber" | "transactionHash"
					> = {
						auditId: data.auditId,
						contractAddress:
							data.contractAddress ||
							"0x0000000000000000000000000000000000000000",
						auditorAddress:
							data.auditorAddress ||
							this.blockchainService.getWalletAddress() ||
							"0x0000000000000000000000000000000000000000",
						ipfsHash: result.ipfsHash,
						reportHash: "", // Will be calculated in BlockchainService
						timestamp: data.metadata.timestamp,
					};

					const blockchainResult =
						await this.blockchainService.storeAuditRecord(auditRecord);
					result.blockchainTxHash = blockchainResult.transactionHash;
					result.blockNumber = blockchainResult.blockNumber;

					console.log(
						`Audit record stored on blockchain: ${blockchainResult.transactionHash}`
					);
				} catch (error) {
					const errorMsg = `Blockchain storage failed: ${
						error instanceof Error ? error.message : "Unknown error"
					}`;
					result.errors.push(errorMsg);
					console.error(errorMsg);
				}
			}

			// 3. Update database with decentralized storage info
			if (
				options.fallbackToDatabase ||
				result.ipfsHash ||
				result.blockchainTxHash
			) {
				try {
					const { data: updateData, error } = await supabase
						.from("audits")
						.update({
							ipfs_hash: result.ipfsHash,
							ipfs_url: result.ipfsUrl,
							blockchain_tx_hash: result.blockchainTxHash,
							blockchain_block_number: result.blockNumber,
							storage_type: this.getStorageType(result),
							updated_at: new Date().toISOString(),
						})
						.eq("id", data.auditId)
						.select()
						.single();

					if (error) {
						throw error;
					}

					result.databaseId = updateData.id;
					console.log(
						`Database updated with storage info for audit: ${data.auditId}`
					);
				} catch (error) {
					const errorMsg = `Database update failed: ${
						error instanceof Error ? error.message : "Unknown error"
					}`;
					result.errors.push(errorMsg);
					console.error(errorMsg);
				}
			}

			// Determine overall success
			result.success =
				result.ipfsHash !== undefined ||
				result.blockchainTxHash !== undefined ||
				result.databaseId !== undefined;

			return result;
		} catch (error) {
			result.errors.push(
				`Storage operation failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
			return result;
		}
	}

	/**
	 * Retrieve audit report from decentralized storage
	 */
	async retrieveAuditReport(auditId: string): Promise<{
		reportBuffer?: Buffer;
		auditData?: any;
		metadata?: any;
		source: "ipfs" | "database" | "blockchain";
	} | null> {
		try {
			// First, get audit info from database
			const { data: audit, error } = await supabase
				.from("audits")
				.select("*")
				.eq("id", auditId)
				.single();

			if (error || !audit) {
				console.error("Audit not found in database:", error);
				return null;
			}

			// Try to retrieve from IPFS first
			if (audit.ipfs_hash && this.ipfsService.isAvailable()) {
				try {
					const reportBuffer = await this.ipfsService.getContent(
						audit.ipfs_hash
					);
					return {
						reportBuffer,
						auditData: audit,
						metadata: {
							ipfsHash: audit.ipfs_hash,
							ipfsUrl: audit.ipfs_url,
							blockchainTxHash: audit.blockchain_tx_hash,
						},
						source: "ipfs",
					};
				} catch (error) {
					console.error("Failed to retrieve from IPFS:", error);
				}
			}

			// Fallback to database/local storage
			if (audit.report_path && (await fs.pathExists(audit.report_path))) {
				const reportBuffer = await fs.readFile(audit.report_path);
				return {
					reportBuffer,
					auditData: audit,
					metadata: audit,
					source: "database",
				};
			}

			return null;
		} catch (error) {
			console.error("Error retrieving audit report:", error);
			return null;
		}
	}

	/**
	 * Verify audit record integrity using blockchain
	 */
	async verifyAuditIntegrity(auditId: string): Promise<VerificationResult> {
		const result: VerificationResult = {
			isValid: false,
			onChain: false,
			ipfsAccessible: false,
			details: {},
		};

		try {
			// Get audit from database
			const { data: audit, error } = await supabase
				.from("audits")
				.select("*")
				.eq("id", auditId)
				.single();

			if (error || !audit) {
				return result;
			}

			// Check blockchain record
			if (this.blockchainService?.isAvailable() && audit.blockchain_tx_hash) {
				try {
					const blockchainRecord = await this.blockchainService.getAuditRecord(
						auditId
					);
					if (blockchainRecord) {
						result.onChain = true;
						result.details = { ...result.details, blockchainRecord };

						// Verify integrity
						const isVerified = await this.blockchainService.verifyAuditRecord(
							auditId,
							audit
						);
						result.isValid = isVerified;
					}
				} catch (error) {
					console.error("Blockchain verification failed:", error);
				}
			}

			// Check IPFS accessibility
			if (audit.ipfs_hash && this.ipfsService.isAvailable()) {
				try {
					await this.ipfsService.getContent(audit.ipfs_hash);
					result.ipfsAccessible = true;
				} catch (error) {
					console.error("IPFS accessibility check failed:", error);
				}
			}

			// If no blockchain verification, consider valid if IPFS is accessible or local file exists
			if (!result.onChain) {
				result.isValid =
					result.ipfsAccessible ||
					(audit.report_path && (await fs.pathExists(audit.report_path)));
			}

			return result;
		} catch (error) {
			console.error("Error verifying audit integrity:", error);
			return result;
		}
	}

	/**
	 * Get storage statistics
	 */
	async getStorageStats(): Promise<StorageStats> {
		try {
			const { count: totalAudits } = await supabase
				.from("audits")
				.select("*", { count: "exact", head: true });

			const { count: ipfsStored } = await supabase
				.from("audits")
				.select("*", { count: "exact", head: true })
				.not("ipfs_hash", "is", null);

			const { count: blockchainStored } = await supabase
				.from("audits")
				.select("*", { count: "exact", head: true })
				.not("blockchain_tx_hash", "is", null);

			const stats: StorageStats = {
				ipfsAvailable: this.ipfsService.isAvailable(),
				blockchainAvailable: this.blockchainService?.isAvailable() || false,
				totalAudits: totalAudits || 0,
				ipfsStored: ipfsStored || 0,
				blockchainStored: blockchainStored || 0,
			};

			if (this.blockchainService?.isAvailable()) {
				stats.walletAddress =
					this.blockchainService.getWalletAddress() || undefined;
				try {
					stats.walletBalance = await this.blockchainService.getBalance();
				} catch (error) {
					console.error("Error getting wallet balance:", error);
				}
			}

			return stats;
		} catch (error) {
			console.error("Error getting storage stats:", error);
			return {
				ipfsAvailable: false,
				blockchainAvailable: false,
				totalAudits: 0,
				ipfsStored: 0,
				blockchainStored: 0,
			};
		}
	}

	/**
	 * Migrate existing audits to decentralized storage
	 */
	async migrateToDecentralizedStorage(
		batchSize: number = 10
	): Promise<MigrationResult> {
		const result: MigrationResult = {
			migrated: 0,
			failed: 0,
			errors: [],
		};

		try {
			// Get audits that haven't been migrated yet
			const { data: audits, error } = await supabase
				.from("audits")
				.select("*")
				.is("ipfs_hash", null)
				.not("report_path", "is", null)
				.limit(batchSize);

			if (error) {
				throw error;
			}

			for (const audit of audits || []) {
				try {
					if (!audit.report_path || !(await fs.pathExists(audit.report_path))) {
						result.errors.push(`Report file not found for audit ${audit.id}`);
						result.failed++;
						continue;
					}

					const storageData: AuditStorageData = {
						auditId: audit.id,
						contractAddress: audit.contract_address,
						auditorAddress: audit.user_id, // Assuming user_id is the auditor
						reportPath: audit.report_path,
						auditData: audit,
						metadata: {
							name: `audit-${audit.id}`,
							description: `Audit report for ${
								audit.contract_name || "contract"
							}`,
							timestamp: new Date(audit.created_at).getTime(),
						},
					};

					const storageResult = await this.storeAuditReport(storageData, {
						useIPFS: true,
						useBlockchain: false, // Skip blockchain for migration to avoid gas costs
						fallbackToDatabase: true,
					});

					if (storageResult.success) {
						result.migrated++;
					} else {
						result.failed++;
						result.errors.push(
							`Migration failed for audit ${
								audit.id
							}: ${storageResult.errors.join(", ")}`
						);
					}
				} catch (error) {
					result.failed++;
					result.errors.push(
						`Error migrating audit ${audit.id}: ${
							error instanceof Error ? error.message : "Unknown error"
						}`
					);
				}
			}

			return result;
		} catch (error) {
			result.errors.push(
				`Migration operation failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
			return result;
		}
	}

	private getStorageType(result: StorageResult): string {
		const types = [];
		if (result.ipfsHash) types.push("ipfs");
		if (result.blockchainTxHash) types.push("blockchain");
		if (result.databaseId) types.push("database");
		return types.join(",") || "local";
	}
}

export default DecentralizedStorageService;
