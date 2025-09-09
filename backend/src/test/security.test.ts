import request from "supertest";
import express from "express";
import { EncryptionService } from "../services/EncryptionService";
import { DataDeletionService } from "../services/DataDeletionService";
import {
	sanitizeInput,
	createRateLimit,
	securityHeaders,
	validateContractInput,
	handleValidationErrors,
} from "../middleware/security";

// Mock environment variables for testing
process.env.ENCRYPTION_KEY = "test-encryption-key-for-testing-only";

describe("Security Middleware Tests", () => {
	let app: express.Application;

	beforeEach(() => {
		app = express();
		app.use(express.json());
	});

	describe("Input Sanitization", () => {
		beforeEach(() => {
			app.use(sanitizeInput);
			app.post("/test", (req: any, res: any) => {
				res.json({ body: req.body, query: req.query, params: req.params });
			});
		});

		test("should sanitize XSS attempts in request body", async () => {
			const maliciousInput = {
				name: "<script>alert('xss')</script>",
				description: "javascript:alert('xss')",
			};

			const response = await request(app)
				.post("/test")
				.send(maliciousInput)
				.expect(200);

			expect(response.body.body.name).not.toContain("<script>");
			expect(response.body.body.description).not.toContain("javascript:");
		});

		test("should sanitize SQL injection attempts", async () => {
			const maliciousInput = {
				query: "'; DROP TABLE users; --",
				filter: "1' OR '1'='1",
			};

			const response = await request(app)
				.post("/test")
				.send(maliciousInput)
				.expect(200);

			expect(response.body.body.query).not.toContain("DROP TABLE");
			expect(response.body.body.filter).not.toContain("OR");
		});

		test("should limit string length to prevent DoS", async () => {
			const longString = "a".repeat(20000);
			const input = { data: longString };

			const response = await request(app).post("/test").send(input).expect(200);

			expect(response.body.body.data.length).toBeLessThanOrEqual(10000);
		});

		test("should limit array size to prevent DoS", async () => {
			const largeArray = new Array(2000).fill("test");
			const input = { items: largeArray };

			const response = await request(app).post("/test").send(input).expect(200);

			expect(response.body.body.items.length).toBeLessThanOrEqual(1000);
		});

		test("should limit object keys to prevent DoS", async () => {
			const largeObject: any = {};
			for (let i = 0; i < 200; i++) {
				largeObject[`key${i}`] = `value${i}`;
			}

			const response = await request(app)
				.post("/test")
				.send(largeObject)
				.expect(200);

			expect(Object.keys(response.body.body).length).toBeLessThanOrEqual(100);
		});
	});

	describe("Rate Limiting", () => {
		test("should apply rate limiting", async () => {
			const rateLimit = createRateLimit({
				windowMs: 1000,
				max: 2,
				message: "Rate limit exceeded",
			});

			app.use(rateLimit);
			app.get("/test", (req, res) => {
				res.json({ success: true });
			});

			// First two requests should succeed
			await request(app).get("/test").expect(200);
			await request(app).get("/test").expect(200);

			// Third request should be rate limited
			const response = await request(app).get("/test").expect(429);
			expect(response.body.error).toContain("Rate limit exceeded");
		});
	});

	describe("Security Headers", () => {
		beforeEach(() => {
			app.use(securityHeaders);
			app.get("/test", (req, res) => {
				res.json({ success: true });
			});
		});

		test("should set security headers", async () => {
			const response = await request(app).get("/test").expect(200);

			expect(response.headers["x-content-type-options"]).toBe("nosniff");
			expect(response.headers["x-frame-options"]).toBe("DENY");
			expect(response.headers["x-xss-protection"]).toBe("1; mode=block");
			expect(response.headers["referrer-policy"]).toBe(
				"strict-origin-when-cross-origin"
			);
			expect(response.headers["content-security-policy"]).toContain(
				"default-src 'self'"
			);
		});
	});

	describe("Contract Input Validation", () => {
		beforeEach(() => {
			app.use(validateContractInput);
			app.use(handleValidationErrors);
			app.post("/test", (req, res) => {
				res.json({ success: true });
			});
		});

		test("should validate contract name", async () => {
			const invalidInput = {
				name: "", // Empty name
				sourceCode: "contract Test {}",
			};

			const response = await request(app)
				.post("/test")
				.send(invalidInput)
				.expect(400);

			expect(response.body.error).toBe("Validation failed");
			expect(response.body.details).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						field: "name",
						message: expect.stringContaining("between 1 and 100 characters"),
					}),
				])
			);
		});

		test("should validate source code", async () => {
			const invalidInput = {
				name: "TestContract",
				sourceCode: "invalid code", // No contract keyword
			};

			const response = await request(app)
				.post("/test")
				.send(invalidInput)
				.expect(400);

			expect(response.body.error).toBe("Validation failed");
			expect(response.body.details).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						field: "sourceCode",
						message: expect.stringContaining("valid Solidity contract"),
					}),
				])
			);
		});

		test("should detect dangerous patterns in source code", async () => {
			const dangerousInput = {
				name: "TestContract",
				sourceCode:
					"contract Test { function hack() { eval('malicious code'); } }",
			};

			const response = await request(app)
				.post("/test")
				.send(dangerousInput)
				.expect(400);

			expect(response.body.error).toBe("Validation failed");
			expect(response.body.details).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						field: "sourceCode",
						message: expect.stringContaining("dangerous patterns"),
					}),
				])
			);
		});

		test("should validate compiler version format", async () => {
			const invalidInput = {
				name: "TestContract",
				sourceCode: "contract Test {}",
				compilerVersion: "invalid-version",
			};

			const response = await request(app)
				.post("/test")
				.send(invalidInput)
				.expect(400);

			expect(response.body.error).toBe("Validation failed");
			expect(response.body.details).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						field: "compilerVersion",
						message: expect.stringContaining("Invalid compiler version format"),
					}),
				])
			);
		});
	});
});

describe("Encryption Service Tests", () => {
	let encryptionService: EncryptionService;

	beforeEach(() => {
		encryptionService = new EncryptionService();
	});

	describe("Data Encryption", () => {
		test("should encrypt and decrypt data correctly", () => {
			const originalData = "This is sensitive contract data";

			const encrypted = encryptionService.encrypt(originalData);
			expect(encrypted.encrypted).toBeDefined();
			expect(encrypted.iv).toBeDefined();
			expect(encrypted.tag).toBeDefined();
			expect(encrypted.algorithm).toBe("aes-256-gcm");

			const decrypted = encryptionService.decrypt(encrypted);
			expect(decrypted).toBe(originalData);
		});

		test("should produce different encrypted output for same input", () => {
			const data = "test data";

			const encrypted1 = encryptionService.encrypt(data);
			const encrypted2 = encryptionService.encrypt(data);

			expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
			expect(encrypted1.iv).not.toBe(encrypted2.iv);
		});

		test("should fail to decrypt with wrong tag", () => {
			const data = "test data";
			const encrypted = encryptionService.encrypt(data);

			// Tamper with the tag
			encrypted.tag = "0".repeat(32);

			expect(() => {
				encryptionService.decrypt(encrypted);
			}).toThrow("Failed to decrypt data");
		});
	});

	describe("Contract Encryption", () => {
		test("should encrypt contract with hash", () => {
			const sourceCode = "contract Test { function test() public {} }";

			const encrypted = encryptionService.encryptContract(sourceCode);

			expect(encrypted.encrypted).toBeDefined();
			expect(encrypted.hash).toBeDefined();
			expect(encrypted.encryptedAt).toBeDefined();
			expect(encrypted.hash).toHaveLength(64); // SHA-256 hex length
		});

		test("should decrypt contract correctly", () => {
			const sourceCode = "contract Test { function test() public {} }";

			const encrypted = encryptionService.encryptContract(sourceCode);
			const decrypted = encryptionService.decryptContract(encrypted);

			expect(decrypted).toBe(sourceCode);
		});
	});

	describe("Hashing", () => {
		test("should hash data consistently", () => {
			const data = "test data";

			const hash1 = encryptionService.hash(data);
			const hash2 = encryptionService.hash(data);

			// Hashes should be different due to random salt
			expect(hash1).not.toBe(hash2);

			// But both should verify correctly
			expect(encryptionService.verifyHash(data, hash1)).toBe(true);
			expect(encryptionService.verifyHash(data, hash2)).toBe(true);
		});

		test("should not verify wrong data", () => {
			const data = "test data";
			const wrongData = "wrong data";

			const hash = encryptionService.hash(data);

			expect(encryptionService.verifyHash(wrongData, hash)).toBe(false);
		});
	});

	describe("Token Generation", () => {
		test("should generate secure random tokens", () => {
			const token1 = encryptionService.generateToken();
			const token2 = encryptionService.generateToken();

			expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
			expect(token2).toHaveLength(64);
			expect(token1).not.toBe(token2);
		});

		test("should generate tokens of specified length", () => {
			const token = encryptionService.generateToken(16);
			expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
		});
	});
});

describe("Data Deletion Service Tests", () => {
	let dataDeletionService: DataDeletionService;

	beforeEach(() => {
		dataDeletionService = new DataDeletionService();
	});

	// Note: These tests would require mocking Supabase calls
	// For now, we'll test the service structure and error handling

	describe("Service Structure", () => {
		test("should have required methods", () => {
			expect(typeof dataDeletionService.deleteUserData).toBe("function");
			expect(typeof dataDeletionService.softDeleteUserData).toBe("function");
		});
	});

	describe("Error Handling", () => {
		test("should handle invalid user ID gracefully", async () => {
			const result = await dataDeletionService.deleteUserData("invalid-uuid");

			expect(result.success).toBe(false);
			expect(result.userId).toBe("invalid-uuid");
			expect(result.steps).toBeDefined();
			expect(result.message).toContain("failed");
		});
	});
});

describe("Security Integration Tests", () => {
	let app: express.Application;

	beforeEach(() => {
		app = express();
		app.use(express.json());
		app.use(sanitizeInput);
		app.use(securityHeaders);
	});

	test("should handle multiple security measures together", async () => {
		app.post(
			"/secure-endpoint",
			validateContractInput,
			handleValidationErrors,
			(req: any, res: any) => {
				res.json({ success: true, data: req.body });
			}
		);

		const maliciousInput = {
			name: "<script>alert('xss')</script>TestContract",
			sourceCode: "contract Test { function test() public {} }",
			compilerVersion: "0.8.0",
		};

		const response = await request(app)
			.post("/secure-endpoint")
			.send(maliciousInput)
			.expect(200);

		// Check that XSS was sanitized
		expect(response.body.data.name).not.toContain("<script>");

		// Check that security headers were set
		expect(response.headers["x-content-type-options"]).toBe("nosniff");
		expect(response.headers["x-frame-options"]).toBe("DENY");
	});

	test("should reject requests with dangerous patterns", async () => {
		app.post(
			"/secure-endpoint",
			validateContractInput,
			handleValidationErrors,
			(req: any, res: { json: (arg0: { success: boolean }) => void }) => {
				res.json({ success: true });
			}
		);

		const dangerousInput = {
			name: "TestContract",
			sourceCode:
				"contract Test { function hack() { require('child_process'); } }",
		};

		const response = await request(app)
			.post("/secure-endpoint")
			.send(dangerousInput)
			.expect(400);

		expect(response.body.error).toBe("Validation failed");
		expect(response.body.details).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining("dangerous patterns"),
				}),
			])
		);
	});
});
