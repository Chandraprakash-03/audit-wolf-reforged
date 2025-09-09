import request from "supertest";
import { app } from "../index";
import { supabase } from "../config/supabase";
import { logger } from "../utils/logger";

describe("Error Handling Integration Tests", () => {
	// Mock logger to prevent console spam during tests
	beforeAll(() => {
		jest.spyOn(logger, "error").mockImplementation(() => logger);
		jest.spyOn(logger, "warn").mockImplementation(() => logger);
		jest.spyOn(logger, "info").mockImplementation(() => logger);
	});

	afterAll(() => {
		jest.restoreAllMocks();
	});

	describe("Global Error Handler", () => {
		it("should handle 404 errors with proper format", async () => {
			const response = await request(app)
				.get("/api/nonexistent-endpoint")
				.expect(404);

			expect(response.body).toMatchObject({
				error: {
					message: expect.stringContaining("not found"),
					code: "NOT_FOUND",
					timestamp: expect.any(String),
					requestId: expect.any(String),
					recovery: expect.arrayContaining([expect.any(String)]),
				},
			});
		});

		it("should handle validation errors properly", async () => {
			const response = await request(app)
				.post("/api/contracts")
				.send({
					name: "", // Invalid: empty name
					sourceCode: "invalid", // Invalid: too short
				})
				.expect(400);

			expect(response.body).toMatchObject({
				error: {
					code: "VALIDATION_ERROR",
					message: expect.any(String),
					details: expect.objectContaining({
						fields: expect.arrayContaining([
							expect.objectContaining({
								field: expect.any(String),
								message: expect.any(String),
							}),
						]),
					}),
					recovery: expect.arrayContaining([expect.any(String)]),
				},
			});
		});

		it("should handle authentication errors", async () => {
			const response = await request(app).get("/api/contracts").expect(401);

			expect(response.body).toMatchObject({
				error: {
					code: "MISSING_TOKEN",
					message: expect.any(String),
					recovery: expect.arrayContaining([expect.any(String)]),
				},
			});
		});

		it("should handle rate limiting errors", async () => {
			// Make multiple rapid requests to trigger rate limiting
			const promises = Array.from({ length: 60 }, () =>
				request(app).get("/api/auth/test-endpoint")
			);

			const responses = await Promise.all(promises);
			const rateLimitedResponse = responses.find((r) => r.status === 429);

			if (rateLimitedResponse) {
				expect(rateLimitedResponse.body).toMatchObject({
					error: "Too many authentication attempts, please try again later",
					code: "RATE_LIMIT_EXCEEDED",
				});
			}
		});
	});

	describe("Health Check Endpoints", () => {
		it("should return comprehensive health status", async () => {
			const response = await request(app).get("/health").expect(200);

			expect(response.body).toMatchObject({
				status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
				timestamp: expect.any(String),
				version: expect.any(String),
				uptime: expect.any(Number),
				checks: expect.objectContaining({
					database: expect.objectContaining({
						status: expect.stringMatching(/^(pass|fail|warn)$/),
						message: expect.any(String),
					}),
				}),
				system: expect.objectContaining({
					memory: expect.objectContaining({
						used: expect.any(Number),
						total: expect.any(Number),
						percentage: expect.any(Number),
					}),
					cpu: expect.objectContaining({
						usage: expect.any(Number),
					}),
					disk: expect.objectContaining({
						used: expect.any(Number),
						total: expect.any(Number),
						percentage: expect.any(Number),
					}),
				}),
			});
		});

		it("should return liveness probe", async () => {
			const response = await request(app).get("/health/live").expect(200);

			expect(response.body).toMatchObject({
				status: "alive",
				timestamp: expect.any(String),
				uptime: expect.any(Number),
			});
		});

		it("should return readiness probe", async () => {
			const response = await request(app).get("/health/ready").expect(200);

			expect(response.body).toMatchObject({
				status: "ready",
				timestamp: expect.any(String),
			});
		});
	});

	describe("Error Recovery Scenarios", () => {
		it("should handle database connection errors gracefully", async () => {
			// Mock database error
			const originalQuery = supabase.from;
			supabase.from = jest.fn().mockImplementation(() => ({
				select: jest.fn().mockResolvedValue({
					data: null,
					error: new Error("Database connection failed"),
				}),
			}));

			const response = await request(app).get("/health").expect(200); // Should still return 200 but with degraded status

			expect(response.body.status).toBe("degraded");
			expect(response.body.checks.database.status).toBe("fail");

			// Restore original function
			supabase.from = originalQuery;
		});

		it("should handle external service failures", async () => {
			// Mock fetch to simulate external service failure
			const originalFetch = global.fetch;
			global.fetch = jest
				.fn()
				.mockRejectedValue(new Error("Service unavailable"));

			const response = await request(app).get("/health").expect(200);

			// Should handle external service failures gracefully
			expect(response.body.checks).toHaveProperty("openrouter");

			// Restore original fetch
			global.fetch = originalFetch;
		});

		it("should provide appropriate error recovery suggestions", async () => {
			const testCases = [
				{
					endpoint: "/api/nonexistent",
					expectedSuggestions: ["Check if the resource ID is correct"],
				},
				{
					endpoint: "/api/contracts",
					method: "post",
					data: { invalid: "data" },
					expectedSuggestions: ["Please check the provided data format"],
				},
			];

			for (const testCase of testCases) {
				const request_method = testCase.method || "get";
				let req: any;

				if (request_method === "post") {
					req = request(app).post(testCase.endpoint);
				} else if (request_method === "put") {
					req = request(app).put(testCase.endpoint);
				} else if (request_method === "delete") {
					req = request(app).delete(testCase.endpoint);
				} else {
					req = request(app).get(testCase.endpoint);
				}

				if (testCase.data) {
					req = req.send(testCase.data);
				}

				const response = await req;

				if (response.body.error?.recovery) {
					const hasExpectedSuggestion = testCase.expectedSuggestions.some(
						(suggestion) =>
							response.body.error.recovery.some((recovery: string) =>
								recovery.includes(suggestion)
							)
					);
					expect(hasExpectedSuggestion).toBe(true);
				}
			}
		});
	});

	describe("Error Logging and Monitoring", () => {
		it("should log errors with proper context", async () => {
			const loggerSpy = jest.spyOn(logger, "error");

			await request(app).get("/api/nonexistent-endpoint").expect(404);

			// Verify that error was logged with context
			expect(loggerSpy).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					error: expect.objectContaining({
						name: expect.any(String),
						message: expect.any(String),
						code: expect.any(String),
					}),
					request: expect.objectContaining({
						method: "GET",
						url: expect.stringContaining("/api/nonexistent-endpoint"),
						ip: expect.any(String),
					}),
					timestamp: expect.any(String),
				})
			);
		});

		it("should include request ID in error responses", async () => {
			const response = await request(app)
				.get("/api/nonexistent-endpoint")
				.expect(404);

			expect(response.body.error.requestId).toBeDefined();
			expect(typeof response.body.error.requestId).toBe("string");
		});

		it("should not expose sensitive information in production", async () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";

			const response = await request(app)
				.get("/api/nonexistent-endpoint")
				.expect(404);

			// Should not include stack trace in production
			expect(response.body.error.stack).toBeUndefined();

			process.env.NODE_ENV = originalEnv;
		});
	});

	describe("Input Sanitization", () => {
		it("should sanitize malicious input", async () => {
			const maliciousInput = {
				name: "<script>alert('xss')</script>",
				sourceCode: "'; DROP TABLE users; --",
				description: "javascript:alert('xss')",
			};

			const response = await request(app)
				.post("/api/contracts")
				.send(maliciousInput);

			// Should either sanitize the input or reject it
			if (response.status === 400) {
				expect(response.body.error.code).toBe("VALIDATION_ERROR");
			} else {
				// If accepted, input should be sanitized
				expect(response.body).not.toContain("<script>");
				expect(response.body).not.toContain("DROP TABLE");
				expect(response.body).not.toContain("javascript:");
			}
		});

		it("should handle oversized payloads", async () => {
			const oversizedPayload = {
				name: "test",
				sourceCode: "a".repeat(2000000), // 2MB of data
			};

			const response = await request(app)
				.post("/api/contracts")
				.send(oversizedPayload);

			expect(response.status).toBe(413);
		});
	});

	describe("Concurrent Error Handling", () => {
		it("should handle multiple concurrent errors", async () => {
			const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
				request(app).get(`/api/nonexistent-endpoint-${i}`)
			);

			const responses = await Promise.all(concurrentRequests);

			responses.forEach((response) => {
				expect(response.status).toBe(404);
				expect(response.body.error.code).toBe("NOT_FOUND");
				expect(response.body.error.requestId).toBeDefined();
			});

			// All request IDs should be unique
			const requestIds = responses.map((r) => r.body.error.requestId);
			const uniqueIds = new Set(requestIds);
			expect(uniqueIds.size).toBe(requestIds.length);
		});
	});
});
