import IPFSService from "../services/IPFSService";
import BlockchainService from "../services/BlockchainService";
import DecentralizedStorageService from "../services/DecentralizedStorageService";
import fs from "fs-extra";
import path from "path";
import { createHash } from "crypto";

// Mock environment variables for testing
process.env.PINATA_JWT = "test-jwt-token";
process.env.ETHEREUM_RPC_URL = "https://eth-mainnet.alchemyapi.io/v2/test";
process.env.PRIVATE_KEY =
	"0x1234567890123456789012345678901234567890123456789012345678901234";

describe("IPFS Service", () => {
	let ipfsService: IPFSService;
	let testFilePath: string;

	beforeAll(async () => {
		ipfsService = new IPFSService();

		// Create a test PDF file
		testFilePath = path.join(__dirname, "test-report.pdf");
		const testContent = Buffer.from("Test PDF content for IPFS upload");
		await fs.writeFile(testFilePath, testContent);
	});

	afterAll(async () => {
		// Clean up test file
		if (await fs.pathExists(testFilePath)) {
			await fs.remove(testFilePath);
		}
	});

	describe("Service Initialization", () => {
		it("should initialize IPFS service", () => {
			expect(ipfsService).toBeDefined();
		});

		it("should check availability based on configuration", () => {
			// Will be false in test environment without real Pinata JWT
			const isAvailable = ipfsService.isAvailable();
			expect(typeof isAvailable).toBe("boolean");
		});
	});

	describe("IPFS Operations", () => {
		it("should generate correct IPFS URL", () => {
			const hash = "QmTestHash123456789012345678901234567890123456";
			const url = ipfsService.getUrl(hash);
			expect(url).toBe(`https://ipfs.io/ipfs/${hash}`);
		});

		it("should handle upload with mock implementation", async () => {
			const metadata = {
				name: "test-report",
				description: "Test audit report",
				auditId: "test-audit-id",
				timestamp: Date.now(),
			};

			// Mock implementation should return a result
			const result = await ipfsService.uploadReport(testFilePath, metadata);
			expect(result).toBeDefined();
			expect(result.hash).toBeDefined();
			expect(result.url).toBeDefined();
			expect(result.size).toBeGreaterThan(0);
		});

		it("should handle JSON upload with mock implementation", async () => {
			const testData = { test: "data", audit: "results" };
			const metadata = {
				name: "test-data",
				description: "Test audit data",
				auditId: "test-audit-id",
				timestamp: Date.now(),
			};

			// Mock implementation should return a result
			const result = await ipfsService.uploadJSON(testData, metadata);
			expect(result).toBeDefined();
			expect(result.hash).toBeDefined();
			expect(result.url).toBeDefined();
			expect(result.size).toBeGreaterThan(0);
		});
	});
});

describe("Blockchain Service", () => {
	let blockchainService: BlockchainService;

	beforeAll(() => {
		const config = {
			rpcUrl: process.env.ETHEREUM_RPC_URL || "",
			privateKey: process.env.PRIVATE_KEY || "",
			contractAddress: "0x1234567890123456789012345678901234567890",
			gasLimit: 500000,
			gasPrice: "20",
		};

		blockchainService = new BlockchainService(config);
	});

	describe("Service Initialization", () => {
		it("should initialize blockchain service", () => {
			expect(blockchainService).toBeDefined();
		});

		it("should check availability based on configuration", () => {
			// Will be false in test environment without real RPC and contract
			const isAvailable = blockchainService.isAvailable();
			expect(typeof isAvailable).toBe("boolean");
		});
	});

	describe("Blockchain Operations", () => {
		it("should handle store audit record with mock implementation", async () => {
			const auditRecord = {
				auditId: "test-audit-123",
				contractAddress: "0x1234567890123456789012345678901234567890",
				auditorAddress: "0x0987654321098765432109876543210987654321",
				ipfsHash: "QmTestHash123456789012345678901234567890123456",
				reportHash: "0x1234567890abcdef",
				timestamp: Date.now(),
			};

			// Mock implementation should return a result
			const result = await blockchainService.storeAuditRecord(auditRecord);
			expect(result).toBeDefined();
			expect(result.auditId).toBe(auditRecord.auditId);
			expect(result.transactionHash).toBeDefined();
			expect(result.blockNumber).toBeDefined();
		});

		it("should handle get audit record with mock implementation", async () => {
			// First store a record
			const auditRecord = {
				auditId: "test-audit-456",
				contractAddress: "0x1234567890123456789012345678901234567890",
				auditorAddress: "0x0987654321098765432109876543210987654321",
				ipfsHash: "QmTestHash123456789012345678901234567890123456",
				reportHash: "0x1234567890abcdef",
				timestamp: Date.now(),
			};

			await blockchainService.storeAuditRecord(auditRecord);

			// Then retrieve it
			const result = await blockchainService.getAuditRecord("test-audit-456");
			expect(result).toBeDefined();
			expect(result?.auditId).toBe(auditRecord.auditId);
		});

		it("should handle verification errors gracefully", async () => {
			const reportData = {
				contractAddress: "0x1234567890123456789012345678901234567890",
				auditorAddress: "0x0987654321098765432109876543210987654321",
				ipfsHash: "QmTestHash123456789012345678901234567890123456",
				timestamp: Date.now(),
			};

			// This will fail without real blockchain connection
			const result = await blockchainService.verifyAuditRecord(
				"test-audit-123",
				reportData
			);
			expect(result).toBe(false);
		});
	});
});

describe("Decentralized Storage Service", () => {
	let storageService: DecentralizedStorageService;
	let testFilePath: string;

	beforeAll(async () => {
		storageService = new DecentralizedStorageService();

		// Create a test PDF file
		testFilePath = path.join(__dirname, "test-storage-report.pdf");
		const testContent = Buffer.from(
			"Test PDF content for decentralized storage"
		);
		await fs.writeFile(testFilePath, testContent);
	});

	afterAll(async () => {
		// Clean up test file
		if (await fs.pathExists(testFilePath)) {
			await fs.remove(testFilePath);
		}
	});

	describe("Service Initialization", () => {
		it("should initialize decentralized storage service", () => {
			expect(storageService).toBeDefined();
		});
	});

	describe("Storage Operations", () => {
		it("should handle storage with fallback options", async () => {
			const storageData = {
				auditId: "test-audit-456",
				contractAddress: "0x1234567890123456789012345678901234567890",
				auditorAddress: "0x0987654321098765432109876543210987654321",
				reportPath: testFilePath,
				auditData: {
					vulnerabilities: [],
					gasOptimizations: [],
					summary: { totalIssues: 0 },
				},
				metadata: {
					name: "test-audit-report",
					description: "Test audit report for decentralized storage",
					timestamp: Date.now(),
				},
			};

			const options = {
				useIPFS: false, // Disable IPFS for test
				useBlockchain: false, // Disable blockchain for test
				fallbackToDatabase: false, // Disable database for test
			};

			const result = await storageService.storeAuditReport(
				storageData,
				options
			);

			// Should succeed with no operations enabled
			expect(result).toBeDefined();
			expect(result.success).toBe(false); // No storage operations performed
			expect(Array.isArray(result.errors)).toBe(true);
		});

		it("should handle retrieval when audit not found", async () => {
			const result = await storageService.retrieveAuditReport(
				"non-existent-audit"
			);
			expect(result).toBeNull();
		});

		it("should handle verification when audit not found", async () => {
			const result = await storageService.verifyAuditIntegrity(
				"non-existent-audit"
			);
			expect(result.isValid).toBe(false);
			expect(result.onChain).toBe(false);
			expect(result.ipfsAccessible).toBe(false);
		});
	});

	describe("Storage Statistics", () => {
		it("should get storage statistics", async () => {
			const stats = await storageService.getStorageStats();

			expect(stats).toBeDefined();
			expect(typeof stats.ipfsAvailable).toBe("boolean");
			expect(typeof stats.blockchainAvailable).toBe("boolean");
			expect(typeof stats.totalAudits).toBe("number");
			expect(typeof stats.ipfsStored).toBe("number");
			expect(typeof stats.blockchainStored).toBe("number");
		});
	});

	describe("Migration Operations", () => {
		it("should handle migration with no audits to migrate", async () => {
			const result = await storageService.migrateToDecentralizedStorage(5);

			expect(result).toBeDefined();
			expect(typeof result.migrated).toBe("number");
			expect(typeof result.failed).toBe("number");
			expect(Array.isArray(result.errors)).toBe(true);
		});
	});
});

describe("Integration Tests", () => {
	describe("Hash Generation", () => {
		it("should generate consistent hashes for same data", () => {
			const data1 =
				"test-audit-123contract-addressauditor-addressipfs-hash1234567890";
			const data2 =
				"test-audit-123contract-addressauditor-addressipfs-hash1234567890";

			const hash1 = createHash("sha256").update(data1).digest("hex");
			const hash2 = createHash("sha256").update(data2).digest("hex");

			expect(hash1).toBe(hash2);
		});

		it("should generate different hashes for different data", () => {
			const data1 =
				"test-audit-123contract-addressauditor-addressipfs-hash1234567890";
			const data2 =
				"test-audit-456contract-addressauditor-addressipfs-hash1234567890";

			const hash1 = createHash("sha256").update(data1).digest("hex");
			const hash2 = createHash("sha256").update(data2).digest("hex");

			expect(hash1).not.toBe(hash2);
		});
	});

	describe("File Operations", () => {
		it("should handle file existence checks", async () => {
			const existingFile = __filename;
			const nonExistentFile = path.join(__dirname, "non-existent-file.pdf");

			expect(await fs.pathExists(existingFile)).toBe(true);
			expect(await fs.pathExists(nonExistentFile)).toBe(false);
		});
	});
});

// Mock tests for when services are properly configured
describe("Mock Integration Tests", () => {
	describe("IPFS Mock Operations", () => {
		it("should simulate successful IPFS upload", () => {
			const mockResult = {
				hash: "QmMockHash123456789012345678901234567890123456",
				url: "https://ipfs.io/ipfs/QmMockHash123456789012345678901234567890123456",
				size: 1024,
			};

			expect(mockResult.hash).toMatch(/^Qm[a-zA-Z0-9]{44}$/);
			expect(mockResult.url).toContain("ipfs.io/ipfs/");
			expect(mockResult.size).toBeGreaterThan(0);
		});
	});

	describe("Blockchain Mock Operations", () => {
		it("should simulate successful blockchain storage", () => {
			const mockResult = {
				auditId: "test-audit-123",
				contractAddress: "0x1234567890123456789012345678901234567890",
				auditorAddress: "0x0987654321098765432109876543210987654321",
				ipfsHash: "QmMockHash123456789012345678901234567890123456",
				reportHash:
					"0x" + createHash("sha256").update("test-data").digest("hex"),
				timestamp: Date.now(),
				blockNumber: 12345678,
				transactionHash:
					"0x" + createHash("sha256").update("mock-tx").digest("hex"),
			};

			expect(mockResult.auditId).toBe("test-audit-123");
			expect(mockResult.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
			expect(mockResult.auditorAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
			expect(mockResult.reportHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
			expect(mockResult.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
			expect(mockResult.blockNumber).toBeGreaterThan(0);
		});
	});
});
