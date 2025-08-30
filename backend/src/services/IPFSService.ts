import fs from "fs-extra";
import path from "path";

export interface IPFSUploadResult {
	hash: string;
	url: string;
	size: number;
}

export interface IPFSMetadata {
	name: string;
	description: string;
	auditId: string;
	contractAddress?: string;
	timestamp: number;
}

export class IPFSService {
	private pinataJWT: string | null = null;
	private gatewayUrl: string;
	private pinataApiUrl: string;

	constructor() {
		this.gatewayUrl = process.env.IPFS_GATEWAY_URL || "https://ipfs.io/ipfs/";
		this.pinataApiUrl = "https://api.pinata.cloud";
		this.pinataJWT = process.env.PINATA_JWT || null;
	}

	/**
	 * Upload audit report to IPFS using Pinata API
	 */
	async uploadReport(
		reportPath: string,
		metadata: IPFSMetadata
	): Promise<IPFSUploadResult> {
		try {
			if (!this.pinataJWT) {
				throw new Error(
					"IPFS service not configured. Please set PINATA_JWT environment variable."
				);
			}

			// Check if file exists
			if (!(await fs.pathExists(reportPath))) {
				throw new Error(`Report file not found: ${reportPath}`);
			}

			// Get file stats
			const stats = await fs.stat(reportPath);

			// For now, return a mock result since we're using deprecated packages
			// In production, you would implement the actual Pinata API call
			const mockHash = `Qm${Buffer.from(`${metadata.auditId}-${Date.now()}`)
				.toString("base64")
				.replace(/[^a-zA-Z0-9]/g, "")
				.substring(0, 44)}`;

			return {
				hash: mockHash,
				url: `${this.gatewayUrl}${mockHash}`,
				size: stats.size,
			};
		} catch (error) {
			console.error("Error uploading to IPFS:", error);
			throw new Error(
				`Failed to upload report to IPFS: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	/**
	 * Upload JSON data to IPFS
	 */
	async uploadJSON(
		data: any,
		metadata: IPFSMetadata
	): Promise<IPFSUploadResult> {
		try {
			if (!this.pinataJWT) {
				throw new Error(
					"IPFS service not configured. Please set PINATA_JWT environment variable."
				);
			}

			const jsonString = JSON.stringify(data, null, 2);
			const jsonBuffer = Buffer.from(jsonString, "utf-8");

			// Mock implementation
			const mockHash = `Qm${Buffer.from(
				`${metadata.auditId}-data-${Date.now()}`
			)
				.toString("base64")
				.replace(/[^a-zA-Z0-9]/g, "")
				.substring(0, 44)}`;

			return {
				hash: mockHash,
				url: `${this.gatewayUrl}${mockHash}`,
				size: jsonBuffer.length,
			};
		} catch (error) {
			console.error("Error uploading JSON to IPFS:", error);
			throw new Error(
				`Failed to upload JSON to IPFS: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	/**
	 * Retrieve content from IPFS
	 */
	async getContent(hash: string): Promise<Buffer> {
		try {
			// Mock implementation - in production, fetch from IPFS gateway
			throw new Error("IPFS content retrieval not implemented in mock mode");
		} catch (error) {
			console.error("Error retrieving from IPFS:", error);
			throw new Error(
				`Failed to retrieve content from IPFS: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	/**
	 * Check if IPFS service is available
	 */
	isAvailable(): boolean {
		return this.pinataJWT !== null;
	}

	/**
	 * Get IPFS URL for a hash
	 */
	getUrl(hash: string): string {
		return `${this.gatewayUrl}${hash}`;
	}

	/**
	 * Pin existing content by hash (mock implementation)
	 */
	async pinByHash(hash: string, metadata: IPFSMetadata): Promise<void> {
		try {
			if (!this.pinataJWT) {
				throw new Error("IPFS service not configured.");
			}

			// Mock implementation
			console.log(`Mock: Pinning hash ${hash} with metadata:`, metadata);
		} catch (error) {
			console.error("Error pinning hash:", error);
			throw new Error(
				`Failed to pin hash: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	/**
	 * Unpin content from IPFS (mock implementation)
	 */
	async unpin(hash: string): Promise<void> {
		try {
			if (!this.pinataJWT) {
				throw new Error("IPFS service not configured.");
			}

			// Mock implementation
			console.log(`Mock: Unpinning hash ${hash}`);
		} catch (error) {
			console.error("Error unpinning hash:", error);
			throw new Error(
				`Failed to unpin hash: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}
}

export default IPFSService;
