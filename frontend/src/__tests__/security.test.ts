import { SecurityUtils, SECURITY_CONFIG } from "../utils/security";

describe("SecurityUtils", () => {
	describe("sanitizeInput", () => {
		test("should remove HTML tags", () => {
			const input = "<script>alert('xss')</script>Hello World";
			const result = SecurityUtils.sanitizeInput(input);
			expect(result).toBe("Hello World");
		});

		test("should remove dangerous protocols", () => {
			const input = "javascript:alert('xss')";
			const result = SecurityUtils.sanitizeInput(input);
			expect(result).toBe("");
		});

		test("should remove event handlers", () => {
			const input = "onclick=alert('xss')";
			const result = SecurityUtils.sanitizeInput(input);
			expect(result).toBe("");
		});

		test("should handle non-string input", () => {
			const result = SecurityUtils.sanitizeInput(123 as any);
			expect(result).toBe("");
		});
	});

	describe("validateContractName", () => {
		test("should validate correct contract name", () => {
			const result = SecurityUtils.validateContractName("MyContract");
			expect(result.isValid).toBe(true);
			expect(result.sanitizedValue).toBe("MyContract");
		});

		test("should reject empty name", () => {
			const result = SecurityUtils.validateContractName("");
			expect(result.isValid).toBe(false);
			expect(result.error).toContain("required");
		});

		test("should reject name that's too long", () => {
			const longName = "a".repeat(101);
			const result = SecurityUtils.validateContractName(longName);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain("between 1 and 100 characters");
		});

		test("should reject name with invalid characters", () => {
			const result = SecurityUtils.validateContractName("My<Contract>");
			expect(result.isValid).toBe(false);
			expect(result.error).toContain("invalid characters");
		});

		test("should sanitize XSS in name", () => {
			const result = SecurityUtils.validateContractName(
				"<script>alert('xss')</script>MyContract"
			);
			expect(result.isValid).toBe(true);
			expect(result.sanitizedValue).toBe("MyContract");
		});
	});

	describe("validateSourceCode", () => {
		test("should validate correct Solidity code", () => {
			const code = "contract MyContract { function test() public {} }";
			const result = SecurityUtils.validateSourceCode(code);
			expect(result.isValid).toBe(true);
			expect(result.sanitizedValue).toBe(code);
		});

		test("should reject empty source code", () => {
			const result = SecurityUtils.validateSourceCode("");
			expect(result.isValid).toBe(false);
			expect(result.error).toContain("required");
		});

		test("should reject code that's too short", () => {
			const result = SecurityUtils.validateSourceCode("short");
			expect(result.isValid).toBe(false);
			expect(result.error).toContain("too short");
		});

		test("should reject code that's too long", () => {
			const longCode = "a".repeat(1000001);
			const result = SecurityUtils.validateSourceCode(longCode);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain("too long");
		});

		test("should reject code without contract/library/interface", () => {
			const result = SecurityUtils.validateSourceCode("function test() {}");
			expect(result.isValid).toBe(false);
			expect(result.error).toContain("valid Solidity contract");
		});

		test("should detect dangerous patterns", () => {
			const dangerousCodes = [
				"contract Test { function hack() { eval('code'); } }",
				"contract Test { function hack() { exec('command'); } }",
				"contract Test { function hack() { require('child_process'); } }",
			];

			dangerousCodes.forEach((code) => {
				const result = SecurityUtils.validateSourceCode(code);
				expect(result.isValid).toBe(false);
				expect(result.error).toContain("dangerous patterns");
			});
		});

		test("should accept library and interface", () => {
			const library = "library MyLibrary { function test() internal {} }";
			const interface_ = "interface MyInterface { function test() external; }";

			expect(SecurityUtils.validateSourceCode(library).isValid).toBe(true);
			expect(SecurityUtils.validateSourceCode(interface_).isValid).toBe(true);
		});
	});

	describe("validateEmail", () => {
		test("should validate correct email", () => {
			const result = SecurityUtils.validateEmail("test@example.com");
			expect(result.isValid).toBe(true);
			expect(result.sanitizedValue).toBe("test@example.com");
		});

		test("should reject invalid email format", () => {
			const invalidEmails = [
				"invalid-email",
				"@example.com",
				"test@",
				"test..test@example.com",
			];

			invalidEmails.forEach((email) => {
				const result = SecurityUtils.validateEmail(email);
				expect(result.isValid).toBe(false);
				expect(result.error).toContain("Invalid email format");
			});
		});

		test("should reject email that's too long", () => {
			const longEmail = "a".repeat(250) + "@example.com";
			const result = SecurityUtils.validateEmail(longEmail);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain("too long");
		});

		test("should convert email to lowercase", () => {
			const result = SecurityUtils.validateEmail("TEST@EXAMPLE.COM");
			expect(result.sanitizedValue).toBe("test@example.com");
		});
	});

	describe("validateName", () => {
		test("should validate correct name", () => {
			const result = SecurityUtils.validateName("John Doe");
			expect(result.isValid).toBe(true);
			expect(result.sanitizedValue).toBe("John Doe");
		});

		test("should reject name that's too short", () => {
			const result = SecurityUtils.validateName("A");
			expect(result.isValid).toBe(false);
			expect(result.error).toContain("between 2 and 50 characters");
		});

		test("should reject name that's too long", () => {
			const longName = "a".repeat(51);
			const result = SecurityUtils.validateName(longName);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain("between 2 and 50 characters");
		});

		test("should reject name with invalid characters", () => {
			const result = SecurityUtils.validateName("John123");
			expect(result.isValid).toBe(false);
			expect(result.error).toContain("invalid characters");
		});

		test("should accept names with apostrophes and hyphens", () => {
			const names = ["O'Connor", "Mary-Jane", "José"];
			names.forEach((name) => {
				const result = SecurityUtils.validateName(name);
				expect(result.isValid).toBe(true);
			});
		});
	});

	describe("validateCompilerVersion", () => {
		test("should validate correct version format", () => {
			const versions = ["0.8.0", "0.8.19", "1.0.0"];
			versions.forEach((version) => {
				const result = SecurityUtils.validateCompilerVersion(version);
				expect(result.isValid).toBe(true);
				expect(result.sanitizedValue).toBe(version);
			});
		});

		test("should reject invalid version format", () => {
			const invalidVersions = ["0.8", "v0.8.0", "0.8.0-beta", "invalid"];
			invalidVersions.forEach((version) => {
				const result = SecurityUtils.validateCompilerVersion(version);
				expect(result.isValid).toBe(false);
				expect(result.error).toContain("Invalid compiler version format");
			});
		});

		test("should allow empty version (optional)", () => {
			const result = SecurityUtils.validateCompilerVersion("");
			expect(result.isValid).toBe(true);
			expect(result.sanitizedValue).toBe("");
		});
	});

	describe("validateFileUpload", () => {
		test("should validate correct file", () => {
			const file = new File(["contract Test {}"], "test.sol", {
				type: "text/plain",
			});
			const result = SecurityUtils.validateFileUpload(file);
			expect(result.isValid).toBe(true);
		});

		test("should reject file that's too large", () => {
			const largeContent = "a".repeat(11 * 1024 * 1024); // 11MB
			const file = new File([largeContent], "test.sol", { type: "text/plain" });
			const result = SecurityUtils.validateFileUpload(file);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain("exceeds 10MB limit");
		});

		test("should reject invalid file extensions", () => {
			const file = new File(["content"], "test.exe", {
				type: "application/exe",
			});
			const result = SecurityUtils.validateFileUpload(file);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain("Only .sol and .txt files are allowed");
		});

		test("should reject files with no extension", () => {
			const file = new File(["content"], "test", { type: "text/plain" });
			const result = SecurityUtils.validateFileUpload(file);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain("Only .sol and .txt files are allowed");
		});
	});

	describe("generateSecureToken", () => {
		test("should generate token of correct length", () => {
			const token = SecurityUtils.generateSecureToken(16);
			expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
		});

		test("should generate different tokens", () => {
			const token1 = SecurityUtils.generateSecureToken();
			const token2 = SecurityUtils.generateSecureToken();
			expect(token1).not.toBe(token2);
		});

		test("should generate hex string", () => {
			const token = SecurityUtils.generateSecureToken();
			expect(/^[0-9a-f]+$/.test(token)).toBe(true);
		});
	});

	describe("createClientRateLimit", () => {
		test("should allow requests within limit", () => {
			const rateLimit = SecurityUtils.createClientRateLimit(3, 1000);

			expect(rateLimit.canMakeRequest()).toBe(true);
			expect(rateLimit.canMakeRequest()).toBe(true);
			expect(rateLimit.canMakeRequest()).toBe(true);
		});

		test("should block requests over limit", () => {
			const rateLimit = SecurityUtils.createClientRateLimit(2, 1000);

			expect(rateLimit.canMakeRequest()).toBe(true);
			expect(rateLimit.canMakeRequest()).toBe(true);
			expect(rateLimit.canMakeRequest()).toBe(false);
		});

		test("should reset after window expires", async () => {
			const rateLimit = SecurityUtils.createClientRateLimit(1, 100);

			expect(rateLimit.canMakeRequest()).toBe(true);
			expect(rateLimit.canMakeRequest()).toBe(false);

			// Wait for window to expire
			await new Promise((resolve) => setTimeout(resolve, 150));

			expect(rateLimit.canMakeRequest()).toBe(true);
		});

		test("should calculate time until reset", () => {
			const rateLimit = SecurityUtils.createClientRateLimit(1, 1000);

			rateLimit.canMakeRequest(); // Use up the limit

			const timeUntilReset = rateLimit.getTimeUntilReset();
			expect(timeUntilReset).toBeGreaterThan(0);
			expect(timeUntilReset).toBeLessThanOrEqual(1000);
		});
	});

	describe("secureStorage", () => {
		beforeEach(() => {
			localStorage.clear();
		});

		test("should store and retrieve items", () => {
			SecurityUtils.secureStorage.setItem("test", "value");
			const retrieved = SecurityUtils.secureStorage.getItem("test");
			expect(retrieved).toBe("value");
		});

		test("should expire old items", () => {
			SecurityUtils.secureStorage.setItem("test", "value");

			// Mock old timestamp
			const item = JSON.parse(localStorage.getItem("test")!);
			item.timestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
			localStorage.setItem("test", JSON.stringify(item));

			const retrieved = SecurityUtils.secureStorage.getItem("test");
			expect(retrieved).toBeNull();
		});

		test("should handle corrupted data", () => {
			localStorage.setItem("test", "invalid-json");
			const retrieved = SecurityUtils.secureStorage.getItem("test");
			expect(retrieved).toBeNull();
		});

		test("should clear all items", () => {
			SecurityUtils.secureStorage.setItem("test1", "value1");
			SecurityUtils.secureStorage.setItem("test2", "value2");

			SecurityUtils.secureStorage.clear();

			expect(SecurityUtils.secureStorage.getItem("test1")).toBeNull();
			expect(SecurityUtils.secureStorage.getItem("test2")).toBeNull();
		});
	});
});

describe("SECURITY_CONFIG", () => {
	test("should have correct configuration values", () => {
		expect(SECURITY_CONFIG.MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
		expect(SECURITY_CONFIG.MAX_CONTRACT_SIZE).toBe(1000000);
		expect(SECURITY_CONFIG.ALLOWED_FILE_EXTENSIONS).toEqual([".sol", ".txt"]);
		expect(SECURITY_CONFIG.RATE_LIMIT.UPLOAD.requests).toBe(20);
		expect(SECURITY_CONFIG.RATE_LIMIT.API.requests).toBe(100);
		expect(SECURITY_CONFIG.RATE_LIMIT.AUTH.requests).toBe(10);
	});
});
