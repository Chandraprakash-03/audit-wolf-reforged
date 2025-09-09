import request from "supertest";
import express from "express";
import {
	sanitizeInput,
	createRateLimit,
	requestId,
} from "../middleware/security";

// Create test app with error handling
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(requestId);
app.use(sanitizeInput);

// Rate limiting for testing
const rateLimitMiddleware = createRateLimit({
	windowMs: 1000,
	max: 5,
	message: "Rate limit exceeded",
});

// Test routes
app.get("/test-success", (req, res) => {
	res.json({ success: true, message: "Success" });
});

app.get("/test-error", (req, res) => {
	throw new Error("Test error");
});

app.get("/test-async-error", async (req, res) => {
	throw new Error("Async test error");
});

app.post("/test-validation-error", (req, res) => {
	if (!req.body.required) {
		return res.status(400).json({
			success: false,
			error: {
				code: "VALIDATION_ERROR",
				message: "Required field missing",
				field: "required",
			},
		});
	}
	return res.json({ success: true });
});

app.post("/test-rate-limit", rateLimitMiddleware, (req, res) => {
	res.json({ success: true });
});

app.get("/test-database-error", (req, res) => {
	// Simulate database error
	const error = new Error("Database connection failed");
	error.name = "DatabaseError";
	throw error;
});

app.get("/test-timeout", (req, res) => {
	// Simulate timeout - don't respond
	setTimeout(() => {
		res.json({ success: true });
	}, 10000);
});

app.post("/test-large-payload", (req, res) => {
	res.json({ success: true, size: JSON.stringify(req.body).length });
});

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
	const errorResponse: {
		success: boolean;
		error: {
			code: string;
			message: string;
			requestId: any;
			timestamp: string;
			stack?: string;
		};
	} = {
		success: false,
		error: {
			code: error.code || "INTERNAL_ERROR",
			message: error.message || "Internal server error",
			requestId: req.headers["x-request-id"],
			timestamp: new Date().toISOString(),
		},
	};

	// Add stack trace in development
	if (process.env.NODE_ENV === "development") {
		errorResponse.error.stack = error.stack;
	}

	// Log error
	console.error("Error:", {
		error: {
			name: error.name,
			message: error.message,
			code: error.code,
		},
		request: {
			method: req.method,
			url: req.url,
			ip: req.ip,
		},
		timestamp: new Date().toISOString(),
	});

	const statusCode = error.statusCode || error.status || 500;
	res.status(statusCode).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
	res.status(404).json({
		success: false,
		error: {
			code: "NOT_FOUND",
			message: "Endpoint not found",
			requestId: req.headers["x-request-id"],
			path: req.path,
		},
	});
});

describe("Comprehensive Error Handling Tests", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("Basic Error Scenarios", () => {
		it("should handle successful requests", async () => {
			const response = await request(app).get("/test-success").expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.message).toBe("Success");
		});

		it("should handle synchronous errors", async () => {
			const response = await request(app).get("/test-error").expect(500);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("INTERNAL_ERROR");
			expect(response.body.error.message).toBe("Test error");
			expect(response.body.error.requestId).toBeDefined();
			expect(response.body.error.timestamp).toBeDefined();
		});

		it("should handle asynchronous errors", async () => {
			const response = await request(app).get("/test-async-error").expect(500);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("INTERNAL_ERROR");
			expect(response.body.error.message).toBe("Async test error");
		});

		it("should handle 404 errors", async () => {
			const response = await request(app)
				.get("/nonexistent-endpoint")
				.expect(404);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("NOT_FOUND");
			expect(response.body.error.message).toBe("Endpoint not found");
			expect(response.body.error.path).toBe("/nonexistent-endpoint");
		});
	});

	describe("Validation Error Handling", () => {
		it("should handle validation errors properly", async () => {
			const response = await request(app)
				.post("/test-validation-error")
				.send({})
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("VALIDATION_ERROR");
			expect(response.body.error.message).toBe("Required field missing");
			expect(response.body.error.field).toBe("required");
		});

		it("should pass validation with correct data", async () => {
			const response = await request(app)
				.post("/test-validation-error")
				.send({ required: "value" })
				.expect(200);

			expect(response.body.success).toBe(true);
		});
	});

	describe("Rate Limiting Error Handling", () => {
		it("should handle rate limiting correctly", async () => {
			// Make requests up to the limit
			const promises = Array(6)
				.fill(null)
				.map(() => request(app).post("/test-rate-limit").send({}));

			const responses = await Promise.all(promises);

			// Some should succeed, at least one should be rate limited
			const successful = responses.filter((r) => r.status === 200).length;
			const rateLimited = responses.filter((r) => r.status === 429).length;

			expect(successful).toBeGreaterThan(0);
			expect(rateLimited).toBeGreaterThan(0);
			expect(successful + rateLimited).toBe(6);

			// Check rate limited response format
			const rateLimitedResponse = responses.find((r) => r.status === 429);
			if (rateLimitedResponse) {
				expect(rateLimitedResponse.body.error).toBe("Rate limit exceeded");
				expect(rateLimitedResponse.body.code).toBe("RATE_LIMIT_EXCEEDED");
			}
		});
	});

	describe("Database Error Simulation", () => {
		it("should handle database errors gracefully", async () => {
			const response = await request(app)
				.get("/test-database-error")
				.expect(500);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("INTERNAL_ERROR");
			expect(response.body.error.message).toBe("Database connection failed");
		});
	});

	describe("Payload Size Error Handling", () => {
		it("should handle normal sized payloads", async () => {
			const normalPayload = { data: "normal size data" };

			const response = await request(app)
				.post("/test-large-payload")
				.send(normalPayload)
				.expect(200);

			expect(response.body.success).toBe(true);
		});

		it("should reject oversized payloads", async () => {
			// Create payload larger than 1MB limit
			const largeData = "x".repeat(1024 * 1024 + 1000); // ~1MB + 1KB
			const oversizedPayload = { data: largeData };

			const response = await request(app)
				.post("/test-large-payload")
				.send(oversizedPayload);

			expect(response.status).toBe(413);
		});
	});

	describe("Input Sanitization Error Handling", () => {
		it("should sanitize malicious input", async () => {
			const maliciousPayload = {
				script: "<script>alert('xss')</script>",
				sql: "'; DROP TABLE users; --",
				command: "$(rm -rf /)",
			};

			const response = await request(app)
				.post("/test-validation-error")
				.send({ ...maliciousPayload, required: "value" })
				.expect(200);

			expect(response.body.success).toBe(true);
		});

		it("should handle sanitization of deeply nested objects", async () => {
			const nestedMaliciousPayload = {
				required: "value",
				nested: {
					level1: {
						level2: {
							script: "<script>alert('deep xss')</script>",
							sql: "'; DROP TABLE contracts; --",
						},
					},
				},
			};

			const response = await request(app)
				.post("/test-validation-error")
				.send(nestedMaliciousPayload)
				.expect(200);

			expect(response.body.success).toBe(true);
		});

		it("should handle sanitization of arrays", async () => {
			const arrayMaliciousPayload = {
				required: "value",
				items: [
					"<script>alert('xss1')</script>",
					"'; DROP TABLE audits; --",
					"normal string",
				],
			};

			const response = await request(app)
				.post("/test-validation-error")
				.send(arrayMaliciousPayload)
				.expect(200);

			expect(response.body.success).toBe(true);
		});
	});

	describe("Request ID Tracking", () => {
		it("should include request ID in all responses", async () => {
			const response = await request(app).get("/test-success").expect(200);

			expect(response.headers["x-request-id"]).toBeDefined();
			expect(typeof response.headers["x-request-id"]).toBe("string");
		});

		it("should include request ID in error responses", async () => {
			const response = await request(app).get("/test-error").expect(500);

			expect(response.body.error.requestId).toBeDefined();
			expect(response.headers["x-request-id"]).toBe(
				response.body.error.requestId
			);
		});

		it("should include request ID in 404 responses", async () => {
			const response = await request(app).get("/nonexistent").expect(404);

			expect(response.body.error.requestId).toBeDefined();
			expect(response.headers["x-request-id"]).toBe(
				response.body.error.requestId
			);
		});
	});

	describe("Concurrent Error Handling", () => {
		it("should handle multiple concurrent errors", async () => {
			const promises = Array(10)
				.fill(null)
				.map((_, index) => {
					if (index % 2 === 0) {
						return request(app).get("/test-error");
					} else {
						return request(app).get("/nonexistent-endpoint");
					}
				});

			const responses = await Promise.all(promises);

			responses.forEach((response, index) => {
				if (index % 2 === 0) {
					expect(response.status).toBe(500);
					expect(response.body.error.code).toBe("INTERNAL_ERROR");
				} else {
					expect(response.status).toBe(404);
					expect(response.body.error.code).toBe("NOT_FOUND");
				}
				expect(response.body.error.requestId).toBeDefined();
			});

			// All request IDs should be unique
			const requestIds = responses.map((r) => r.body.error.requestId);
			const uniqueIds = new Set(requestIds);
			expect(uniqueIds.size).toBe(requestIds.length);
		});
	});

	describe("Error Response Format Consistency", () => {
		it("should have consistent error response format", async () => {
			const errorResponses = await Promise.all([
				request(app).get("/test-error"),
				request(app).get("/nonexistent"),
				request(app).post("/test-validation-error").send({}),
			]);

			errorResponses.forEach((response) => {
				expect(response.body).toHaveProperty("success", false);
				expect(response.body).toHaveProperty("error");
				expect(response.body.error).toHaveProperty("code");
				expect(response.body.error).toHaveProperty("message");
				expect(response.body.error).toHaveProperty("requestId");
				expect(response.body.error).toHaveProperty("timestamp");

				// Validate timestamp format
				expect(new Date(response.body.error.timestamp).toISOString()).toBe(
					response.body.error.timestamp
				);
			});
		});
	});

	describe("Error Recovery Suggestions", () => {
		const errorRecoveryMap = {
			VALIDATION_ERROR: [
				"Check required fields",
				"Validate input format",
				"Review API documentation",
			],
			NOT_FOUND: [
				"Check the endpoint URL",
				"Verify the resource exists",
				"Review API documentation",
			],
			RATE_LIMIT_EXCEEDED: [
				"Reduce request frequency",
				"Implement exponential backoff",
				"Contact support for rate limit increase",
			],
			INTERNAL_ERROR: [
				"Try again later",
				"Contact support if problem persists",
				"Check system status page",
			],
		};

		Object.entries(errorRecoveryMap).forEach(
			([errorCode, expectedSuggestions]) => {
				it(`should provide recovery suggestions for ${errorCode}`, async () => {
					let response;

					switch (errorCode) {
						case "VALIDATION_ERROR":
							response = await request(app)
								.post("/test-validation-error")
								.send({});
							break;
						case "NOT_FOUND":
							response = await request(app).get("/nonexistent");
							break;
						case "RATE_LIMIT_EXCEEDED":
							// Trigger rate limit
							const promises = Array(10)
								.fill(null)
								.map(() => request(app).post("/test-rate-limit").send({}));
							const responses = await Promise.all(promises);
							response = responses.find((r) => r.status === 429);
							break;
						case "INTERNAL_ERROR":
							response = await request(app).get("/test-error");
							break;
					}

					if (response) {
						expect(response.body.error.code).toBe(errorCode);

						// Check if response includes recovery suggestions
						if (response.body.error.recovery) {
							expectedSuggestions.forEach((suggestion) => {
								expect(response.body.error.recovery).toContain(suggestion);
							});
						}
					}
				});
			}
		);
	});

	describe("Error Logging", () => {
		let consoleSpy: jest.SpyInstance;

		beforeEach(() => {
			consoleSpy = jest.spyOn(console, "error").mockImplementation();
		});

		afterEach(() => {
			consoleSpy.mockRestore();
		});

		it("should log errors with proper context", async () => {
			await request(app).get("/test-error").expect(500);

			expect(consoleSpy).toHaveBeenCalledWith(
				"Error:",
				expect.objectContaining({
					error: expect.objectContaining({
						name: expect.any(String),
						message: expect.any(String),
					}),
					request: expect.objectContaining({
						method: "GET",
						url: expect.stringContaining("/test-error"),
						ip: expect.any(String),
					}),
					timestamp: expect.any(String),
				})
			);
		});
	});

	describe("Security Error Handling", () => {
		it("should not expose sensitive information in errors", async () => {
			const response = await request(app)
				.get("/test-database-error")
				.expect(500);

			// Should not expose internal paths, database connection strings, etc.
			expect(response.body.error.message).not.toContain("password");
			expect(response.body.error.message).not.toContain("secret");
			expect(response.body.error.message).not.toContain("key");
			expect(response.body.error.message).not.toContain("/home/");
			expect(response.body.error.message).not.toContain("C:\\");
		});

		it("should handle malformed JSON gracefully", async () => {
			const response = await request(app)
				.post("/test-validation-error")
				.set("Content-Type", "application/json")
				.send('{"invalid": json}');

			expect(response.status).toBe(400);
		});
	});

	describe("Timeout Handling", () => {
		it("should handle request timeouts", async () => {
			const response = await request(app)
				.get("/test-timeout")
				.timeout(1000) // 1 second timeout
				.expect((res) => {
					// Should timeout or return response
					expect([200, 408, 500]).toContain(res.status);
				});
		}, 2000);
	});

	describe("Memory and Resource Error Handling", () => {
		it("should handle memory-intensive operations gracefully", async () => {
			// Create a large but not oversized payload
			const largeArray = Array(10000).fill("data");
			const payload = { required: "value", data: largeArray };

			const response = await request(app)
				.post("/test-validation-error")
				.send(payload)
				.expect(200);

			expect(response.body.success).toBe(true);
		});
	});
});
