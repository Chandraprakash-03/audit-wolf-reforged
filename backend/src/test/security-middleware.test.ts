import request from "supertest";
import express, { Request, Response } from "express";
import {
	sanitizeInput,
	createRateLimit,
	createSpeedLimit,
	validateContractInput,
	validateProfileUpdate,
	validateUUID,
	validatePagination,
	handleValidationErrors,
	securityHeaders,
	requestId,
	corsOptions,
} from "../middleware/security";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Test routes for middleware
app.use(sanitizeInput);
app.use(securityHeaders);
app.use(requestId);

// Rate limiting test route
const rateLimitMiddleware = createRateLimit({
	windowMs: 1000, // 1 second
	max: 3, // 3 requests per second
	message: "Rate limit exceeded",
});
app.post(
	"/test-rate-limit",
	rateLimitMiddleware,
	(req: Request, res: Response) => {
		res.json({ success: true });
	}
);

// Speed limiting test route
const speedLimitMiddleware = createSpeedLimit({
	windowMs: 1000,
	delayAfter: 2,
	delayMs: 100,
});
app.post(
	"/test-speed-limit",
	speedLimitMiddleware,
	(req: Request, res: Response) => {
		res.json({ success: true });
	}
);

// Validation test routes
app.post(
	"/test-contract-validation",
	validateContractInput,
	handleValidationErrors,
	(req: Request, res: Response) => {
		res.json({ success: true, data: req.body });
	}
);

app.put(
	"/test-profile-validation",
	validateProfileUpdate,
	handleValidationErrors,
	(req: Request, res: Response) => {
		res.json({ success: true, data: req.body });
	}
);

app.get(
	"/test-uuid/:id",
	validateUUID("id"),
	handleValidationErrors,
	(req: Request, res: Response) => {
		res.json({ success: true, id: req.params.id });
	}
);

app.get(
	"/test-pagination",
	validatePagination,
	handleValidationErrors,
	(req: Request, res: Response) => {
		res.json({ success: true, query: req.query });
	}
);

// Test route for sanitization
app.post("/test-sanitization", (req: Request, res: Response) => {
	res.json({ success: true, sanitized: req.body });
});

describe("Security Middleware Tests", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("Input Sanitization", () => {
		it("should sanitize XSS attempts in request body", async () => {
			const maliciousInput = {
				name: "<script>alert('xss')</script>Test Name",
				description: "Normal text with <img src=x onerror=alert(1)> injection",
			};

			const response = await request(app)
				.post("/test-sanitization")
				.send(maliciousInput)
				.expect(200);

			expect(response.body.sanitized.name).not.toContain("<script>");
			expect(response.body.sanitized.name).not.toContain("alert");
			expect(response.body.sanitized.description).not.toContain("<img");
			expect(response.body.sanitized.description).not.toContain("onerror");
		});

		it("should sanitize SQL injection patterns", async () => {
			const maliciousInput = {
				query: "'; DROP TABLE users; --",
				filter: "1' OR '1'='1",
				sort: "name'; DELETE FROM contracts; --",
			};

			const response = await request(app)
				.post("/test-sanitization")
				.send(maliciousInput)
				.expect(200);

			expect(response.body.sanitized.query).not.toContain("DROP TABLE");
			expect(response.body.sanitized.query).not.toContain("--");
			expect(response.body.sanitized.filter).not.toContain("OR");
			expect(response.body.sanitized.sort).not.toContain("DELETE");
		});

		it("should limit string length to prevent DoS", async () => {
			const longString = "A".repeat(20000);
			const input = { longField: longString };

			const response = await request(app)
				.post("/test-sanitization")
				.send(input)
				.expect(200);

			expect(response.body.sanitized.longField.length).toBeLessThanOrEqual(
				10000
			);
		});

		it("should limit array size to prevent DoS", async () => {
			const largeArray = Array(2000).fill("item");
			const input = { items: largeArray };

			const response = await request(app)
				.post("/test-sanitization")
				.send(input)
				.expect(200);

			expect(response.body.sanitized.items.length).toBeLessThanOrEqual(1000);
		});

		it("should limit object keys to prevent DoS", async () => {
			const largeObject: any = {};
			for (let i = 0; i < 200; i++) {
				largeObject[`key${i}`] = `value${i}`;
			}
			const input = { data: largeObject };

			const response = await request(app)
				.post("/test-sanitization")
				.send(input)
				.expect(200);

			expect(
				Object.keys(response.body.sanitized.data).length
			).toBeLessThanOrEqual(100);
		});

		it("should handle invalid numbers", async () => {
			const input = {
				validNumber: 42,
				invalidNumber: Number.MAX_SAFE_INTEGER + 1,
				infiniteNumber: Infinity,
				nanValue: NaN,
			};

			const response = await request(app)
				.post("/test-sanitization")
				.send(input)
				.expect(200);

			expect(response.body.sanitized.validNumber).toBe(42);
			expect(response.body.sanitized.invalidNumber).toBe(0);
			expect(response.body.sanitized.infiniteNumber).toBe(0);
			expect(response.body.sanitized.nanValue).toBe(0);
		});

		it("should handle sanitization errors gracefully", async () => {
			// Send invalid JSON to trigger sanitization error
			const response = await request(app)
				.post("/test-sanitization")
				.set("Content-Type", "application/json")
				.send('{"invalid": json}')
				.expect(400);

			expect(response.body.error).toBe("Invalid input data");
			expect(response.body.code).toBe("SANITIZATION_ERROR");
		});
	});

	describe("Rate Limiting", () => {
		it("should allow requests within rate limit", async () => {
			const response1 = await request(app)
				.post("/test-rate-limit")
				.send({})
				.expect(200);

			const response2 = await request(app)
				.post("/test-rate-limit")
				.send({})
				.expect(200);

			expect(response1.body.success).toBe(true);
			expect(response2.body.success).toBe(true);
		});

		it("should block requests exceeding rate limit", async () => {
			// Make requests up to the limit
			await request(app).post("/test-rate-limit").send({}).expect(200);
			await request(app).post("/test-rate-limit").send({}).expect(200);
			await request(app).post("/test-rate-limit").send({}).expect(200);

			// This should be rate limited
			const response = await request(app)
				.post("/test-rate-limit")
				.send({})
				.expect(429);

			expect(response.body.error).toBe("Rate limit exceeded");
			expect(response.body.code).toBe("RATE_LIMIT_EXCEEDED");
		});

		it("should include rate limit headers", async () => {
			const response = await request(app)
				.post("/test-rate-limit")
				.send({})
				.expect(200);

			expect(response.headers["x-ratelimit-limit"]).toBeDefined();
			expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
		});

		it("should reset rate limit after window expires", async () => {
			// Exhaust rate limit
			await request(app).post("/test-rate-limit").send({}).expect(200);
			await request(app).post("/test-rate-limit").send({}).expect(200);
			await request(app).post("/test-rate-limit").send({}).expect(200);
			await request(app).post("/test-rate-limit").send({}).expect(429);

			// Wait for window to reset
			await new Promise((resolve) => setTimeout(resolve, 1100));

			// Should work again
			const response = await request(app)
				.post("/test-rate-limit")
				.send({})
				.expect(200);

			expect(response.body.success).toBe(true);
		}, 2000);
	});

	describe("Speed Limiting", () => {
		it("should not delay initial requests", async () => {
			const startTime = Date.now();
			await request(app).post("/test-speed-limit").send({}).expect(200);
			const duration = Date.now() - startTime;

			expect(duration).toBeLessThan(50); // Should be fast
		});

		it("should delay requests after threshold", async () => {
			// Make requests up to delay threshold
			await request(app).post("/test-speed-limit").send({}).expect(200);
			await request(app).post("/test-speed-limit").send({}).expect(200);

			// This should be delayed
			const startTime = Date.now();
			await request(app).post("/test-speed-limit").send({}).expect(200);
			const duration = Date.now() - startTime;

			expect(duration).toBeGreaterThan(90); // Should be delayed by ~100ms
		}, 2000);
	});

	describe("Input Validation", () => {
		describe("Contract Validation", () => {
			it("should accept valid contract input", async () => {
				const validContract = {
					name: "TestContract",
					sourceCode: `
            pragma solidity ^0.8.0;
            contract TestContract {
              uint256 public value;
            }
          `,
					compilerVersion: "0.8.19",
				};

				const response = await request(app)
					.post("/test-contract-validation")
					.send(validContract)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.name).toBe("TestContract");
			});

			it("should reject contract with invalid name", async () => {
				const invalidContract = {
					name: "", // Empty name
					sourceCode: "contract Test {}",
				};

				const response = await request(app)
					.post("/test-contract-validation")
					.send(invalidContract)
					.expect(400);

				expect(response.body.error).toBe("Validation failed");
				expect(response.body.code).toBe("VALIDATION_ERROR");
			});

			it("should reject contract with invalid characters in name", async () => {
				const invalidContract = {
					name: "Test<script>alert(1)</script>",
					sourceCode: "contract Test {}",
				};

				const response = await request(app)
					.post("/test-contract-validation")
					.send(invalidContract)
					.expect(400);

				expect(response.body.error).toBe("Validation failed");
			});

			it("should reject contract without Solidity keywords", async () => {
				const invalidContract = {
					name: "TestContract",
					sourceCode: "function test() { return 42; }", // No contract/library/interface
				};

				const response = await request(app)
					.post("/test-contract-validation")
					.send(invalidContract)
					.expect(400);

				expect(response.body.error).toBe("Validation failed");
			});

			it("should reject contract with dangerous patterns", async () => {
				const dangerousContract = {
					name: "TestContract",
					sourceCode: `
            contract Test {
              function dangerous() {
                eval("malicious code");
              }
            }
          `,
				};

				const response = await request(app)
					.post("/test-contract-validation")
					.send(dangerousContract)
					.expect(400);

				expect(response.body.error).toBe("Validation failed");
			});

			it("should reject contract with invalid compiler version", async () => {
				const invalidContract = {
					name: "TestContract",
					sourceCode: "contract Test {}",
					compilerVersion: "invalid-version",
				};

				const response = await request(app)
					.post("/test-contract-validation")
					.send(invalidContract)
					.expect(400);

				expect(response.body.error).toBe("Validation failed");
			});
		});

		describe("Profile Validation", () => {
			it("should accept valid profile update", async () => {
				const validProfile = {
					name: "John Doe",
					email: "john@example.com",
				};

				const response = await request(app)
					.put("/test-profile-validation")
					.send(validProfile)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.name).toBe("John Doe");
			});

			it("should reject profile with invalid name", async () => {
				const invalidProfile = {
					name: "A", // Too short
				};

				const response = await request(app)
					.put("/test-profile-validation")
					.send(invalidProfile)
					.expect(400);

				expect(response.body.error).toBe("Validation failed");
			});

			it("should reject profile with invalid email", async () => {
				const invalidProfile = {
					email: "invalid-email",
				};

				const response = await request(app)
					.put("/test-profile-validation")
					.send(invalidProfile)
					.expect(400);

				expect(response.body.error).toBe("Validation failed");
			});

			it("should reject profile with invalid characters in name", async () => {
				const invalidProfile = {
					name: "John123", // Contains numbers
				};

				const response = await request(app)
					.put("/test-profile-validation")
					.send(invalidProfile)
					.expect(400);

				expect(response.body.error).toBe("Validation failed");
			});
		});

		describe("UUID Validation", () => {
			it("should accept valid UUID", async () => {
				const validUUID = "123e4567-e89b-12d3-a456-426614174000";

				const response = await request(app)
					.get(`/test-uuid/${validUUID}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.id).toBe(validUUID);
			});

			it("should reject invalid UUID", async () => {
				const invalidUUID = "invalid-uuid";

				const response = await request(app)
					.get(`/test-uuid/${invalidUUID}`)
					.expect(400);

				expect(response.body.error).toBe("Validation failed");
			});
		});

		describe("Pagination Validation", () => {
			it("should accept valid pagination parameters", async () => {
				const response = await request(app)
					.get("/test-pagination")
					.query({
						page: "1",
						limit: "10",
						sortBy: "created_at",
						sortOrder: "desc",
					})
					.expect(200);

				expect(response.body.success).toBe(true);
			});

			it("should reject invalid page number", async () => {
				const response = await request(app)
					.get("/test-pagination")
					.query({ page: "0" })
					.expect(400);

				expect(response.body.error).toBe("Validation failed");
			});

			it("should reject invalid limit", async () => {
				const response = await request(app)
					.get("/test-pagination")
					.query({ limit: "200" })
					.expect(400);

				expect(response.body.error).toBe("Validation failed");
			});

			it("should reject invalid sort field", async () => {
				const response = await request(app)
					.get("/test-pagination")
					.query({ sortBy: "invalid_field" })
					.expect(400);

				expect(response.body.error).toBe("Validation failed");
			});

			it("should reject invalid sort order", async () => {
				const response = await request(app)
					.get("/test-pagination")
					.query({ sortOrder: "invalid" })
					.expect(400);

				expect(response.body.error).toBe("Validation failed");
			});
		});
	});

	describe("Security Headers", () => {
		it("should set security headers", async () => {
			const response = await request(app)
				.post("/test-sanitization")
				.send({})
				.expect(200);

			expect(response.headers["content-security-policy"]).toBeDefined();
			expect(response.headers["x-content-type-options"]).toBe("nosniff");
			expect(response.headers["x-frame-options"]).toBe("DENY");
			expect(response.headers["x-xss-protection"]).toBe("1; mode=block");
			expect(response.headers["referrer-policy"]).toBe(
				"strict-origin-when-cross-origin"
			);
			expect(response.headers["permissions-policy"]).toBeDefined();
		});

		it("should set request ID header", async () => {
			const response = await request(app)
				.post("/test-sanitization")
				.send({})
				.expect(200);

			expect(response.headers["x-request-id"]).toBeDefined();
			expect(typeof response.headers["x-request-id"]).toBe("string");
		});
	});

	describe("CORS Configuration", () => {
		it("should allow requests from allowed origins", () => {
			const allowedOrigin = "http://localhost:3000";
			const callback = jest.fn();

			corsOptions.origin(allowedOrigin, callback);

			expect(callback).toHaveBeenCalledWith(null, true);
		});

		it("should allow requests with no origin", () => {
			const callback = jest.fn();

			corsOptions.origin(undefined, callback);

			expect(callback).toHaveBeenCalledWith(null, true);
		});

		it("should reject requests from disallowed origins", () => {
			const disallowedOrigin = "http://malicious-site.com";
			const callback = jest.fn();

			corsOptions.origin(disallowedOrigin, callback);

			expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
		});
	});
});
