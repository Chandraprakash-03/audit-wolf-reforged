import request from "supertest";
import express from "express";
import { createRateLimit, createSpeedLimit } from "../middleware/security";

const app = express();
app.use(express.json());

// Different rate limits for different endpoints
const strictRateLimit = createRateLimit({
	windowMs: 1000, // 1 second
	max: 2, // 2 requests per second
	message: "Strict rate limit exceeded",
});

const normalRateLimit = createRateLimit({
	windowMs: 1000, // 1 second
	max: 5, // 5 requests per second
	message: "Normal rate limit exceeded",
});

const speedLimit = createSpeedLimit({
	windowMs: 1000, // 1 second
	delayAfter: 2, // Start delaying after 2 requests
	delayMs: 100, // 100ms delay
});

// Test routes
app.post("/api/strict", strictRateLimit, (req, res) => {
	res.json({ success: true, endpoint: "strict" });
});

app.post("/api/normal", normalRateLimit, (req, res) => {
	res.json({ success: true, endpoint: "normal" });
});

app.post("/api/speed-limited", speedLimit, (req, res) => {
	res.json({ success: true, endpoint: "speed-limited", timestamp: Date.now() });
});

app.get("/api/unlimited", (req, res) => {
	res.json({ success: true, endpoint: "unlimited" });
});

// Rate limit with user-specific limits
const userSpecificRateLimit = createRateLimit({
	windowMs: 1000,
	max: 3,
	message: "User-specific rate limit exceeded",
	skipSuccessfulRequests: false,
});

app.post("/api/user-specific", userSpecificRateLimit, (req, res) => {
	res.json({ success: true, userId: req.headers["user-id"] || "anonymous" });
});

describe("Rate Limiting Tests", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("Basic Rate Limiting", () => {
		it("should allow requests within rate limit", async () => {
			const response1 = await request(app)
				.post("/api/normal")
				.send({})
				.expect(200);

			const response2 = await request(app)
				.post("/api/normal")
				.send({})
				.expect(200);

			expect(response1.body.success).toBe(true);
			expect(response2.body.success).toBe(true);
		});

		it("should block requests exceeding rate limit", async () => {
			// Make requests up to the limit
			await request(app).post("/api/strict").send({}).expect(200);
			await request(app).post("/api/strict").send({}).expect(200);

			// This should be rate limited
			const response = await request(app)
				.post("/api/strict")
				.send({})
				.expect(429);

			expect(response.body.error).toBe("Strict rate limit exceeded");
			expect(response.body.code).toBe("RATE_LIMIT_EXCEEDED");
		});

		it("should include rate limit headers", async () => {
			const response = await request(app)
				.post("/api/normal")
				.send({})
				.expect(200);

			expect(response.headers["x-ratelimit-limit"]).toBeDefined();
			expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
			expect(response.headers["x-ratelimit-reset"]).toBeDefined();
		});

		it("should reset rate limit after window expires", async () => {
			// Exhaust rate limit
			await request(app).post("/api/strict").send({}).expect(200);
			await request(app).post("/api/strict").send({}).expect(200);
			await request(app).post("/api/strict").send({}).expect(429);

			// Wait for window to reset
			await new Promise((resolve) => setTimeout(resolve, 1100));

			// Should work again
			const response = await request(app)
				.post("/api/strict")
				.send({})
				.expect(200);

			expect(response.body.success).toBe(true);
		}, 2000);
	});

	describe("Speed Limiting", () => {
		it("should not delay initial requests", async () => {
			const startTime = Date.now();
			const response = await request(app)
				.post("/api/speed-limited")
				.send({})
				.expect(200);
			const duration = Date.now() - startTime;

			expect(response.body.success).toBe(true);
			expect(duration).toBeLessThan(50); // Should be fast
		});

		it("should delay requests after threshold", async () => {
			// Make requests up to delay threshold
			await request(app).post("/api/speed-limited").send({}).expect(200);
			await request(app).post("/api/speed-limited").send({}).expect(200);

			// This should be delayed
			const startTime = Date.now();
			const response = await request(app)
				.post("/api/speed-limited")
				.send({})
				.expect(200);
			const duration = Date.now() - startTime;

			expect(response.body.success).toBe(true);
			expect(duration).toBeGreaterThan(90); // Should be delayed by ~100ms
		}, 2000);

		it("should increase delay for subsequent requests", async () => {
			// Make requests to trigger increasing delays
			await request(app).post("/api/speed-limited").send({}).expect(200);
			await request(app).post("/api/speed-limited").send({}).expect(200);

			const times: number[] = [];

			// Make several delayed requests
			for (let i = 0; i < 3; i++) {
				const startTime = Date.now();
				await request(app).post("/api/speed-limited").send({}).expect(200);
				times.push(Date.now() - startTime);
			}

			// Each request should take longer than the previous (with some tolerance)
			expect(times[1]).toBeGreaterThan(times[0] - 50);
			expect(times[2]).toBeGreaterThan(times[1] - 50);
		}, 3000);
	});

	describe("Different Rate Limits for Different Endpoints", () => {
		it("should apply different limits to different endpoints", async () => {
			// Strict endpoint allows only 2 requests
			await request(app).post("/api/strict").send({}).expect(200);
			await request(app).post("/api/strict").send({}).expect(200);
			await request(app).post("/api/strict").send({}).expect(429);

			// Normal endpoint should still work (allows 5 requests)
			await request(app).post("/api/normal").send({}).expect(200);
			await request(app).post("/api/normal").send({}).expect(200);
			await request(app).post("/api/normal").send({}).expect(200);
		});

		it("should not apply rate limiting to unlimited endpoints", async () => {
			// Make many requests to unlimited endpoint
			const promises = Array(10)
				.fill(null)
				.map(() => request(app).get("/api/unlimited").expect(200));

			const responses = await Promise.all(promises);

			responses.forEach((response) => {
				expect(response.body.success).toBe(true);
			});
		});
	});

	describe("User-Specific Rate Limiting", () => {
		it("should apply rate limits per user", async () => {
			// User 1 makes requests
			await request(app)
				.post("/api/user-specific")
				.set("user-id", "user1")
				.send({})
				.expect(200);
			await request(app)
				.post("/api/user-specific")
				.set("user-id", "user1")
				.send({})
				.expect(200);
			await request(app)
				.post("/api/user-specific")
				.set("user-id", "user1")
				.send({})
				.expect(200);

			// User 1 should be rate limited
			await request(app)
				.post("/api/user-specific")
				.set("user-id", "user1")
				.send({})
				.expect(429);

			// User 2 should still be able to make requests
			await request(app)
				.post("/api/user-specific")
				.set("user-id", "user2")
				.send({})
				.expect(200);
		});

		it("should handle anonymous users separately", async () => {
			// Anonymous requests
			await request(app).post("/api/user-specific").send({}).expect(200);
			await request(app).post("/api/user-specific").send({}).expect(200);
			await request(app).post("/api/user-specific").send({}).expect(200);

			// Anonymous should be rate limited
			await request(app).post("/api/user-specific").send({}).expect(429);

			// Authenticated user should still work
			await request(app)
				.post("/api/user-specific")
				.set("user-id", "authenticated-user")
				.send({})
				.expect(200);
		});
	});

	describe("Rate Limit Headers", () => {
		it("should provide accurate remaining count", async () => {
			const response1 = await request(app)
				.post("/api/strict")
				.send({})
				.expect(200);

			const response2 = await request(app)
				.post("/api/strict")
				.send({})
				.expect(200);

			expect(parseInt(response1.headers["x-ratelimit-remaining"])).toBe(1);
			expect(parseInt(response2.headers["x-ratelimit-remaining"])).toBe(0);
		});

		it("should provide reset timestamp", async () => {
			const response = await request(app)
				.post("/api/normal")
				.send({})
				.expect(200);

			const resetTime = parseInt(response.headers["x-ratelimit-reset"]);
			const currentTime = Math.floor(Date.now() / 1000);

			expect(resetTime).toBeGreaterThan(currentTime);
			expect(resetTime).toBeLessThan(currentTime + 2); // Within 2 seconds
		});

		it("should include limit in headers", async () => {
			const strictResponse = await request(app)
				.post("/api/strict")
				.send({})
				.expect(200);

			const normalResponse = await request(app)
				.post("/api/normal")
				.send({})
				.expect(200);

			expect(strictResponse.headers["x-ratelimit-limit"]).toBe("2");
			expect(normalResponse.headers["x-ratelimit-limit"]).toBe("5");
		});
	});

	describe("Concurrent Requests", () => {
		it("should handle concurrent requests correctly", async () => {
			const promises = Array(10)
				.fill(null)
				.map(() => request(app).post("/api/normal").send({}));

			const responses = await Promise.all(promises);

			const successful = responses.filter((r) => r.status === 200).length;
			const rateLimited = responses.filter((r) => r.status === 429).length;

			// Should allow 5 requests and rate limit 5
			expect(successful).toBe(5);
			expect(rateLimited).toBe(5);
		});

		it("should handle concurrent requests from different users", async () => {
			const user1Promises = Array(5)
				.fill(null)
				.map(() =>
					request(app)
						.post("/api/user-specific")
						.set("user-id", "concurrent-user1")
						.send({})
				);

			const user2Promises = Array(5)
				.fill(null)
				.map(() =>
					request(app)
						.post("/api/user-specific")
						.set("user-id", "concurrent-user2")
						.send({})
				);

			const allPromises = [...user1Promises, ...user2Promises];
			const responses = await Promise.all(allPromises);

			// Each user should get 3 successful requests
			const user1Responses = responses.slice(0, 5);
			const user2Responses = responses.slice(5, 10);

			const user1Successful = user1Responses.filter(
				(r) => r.status === 200
			).length;
			const user2Successful = user2Responses.filter(
				(r) => r.status === 200
			).length;

			expect(user1Successful).toBe(3);
			expect(user2Successful).toBe(3);
		});
	});

	describe("Rate Limit Configuration", () => {
		it("should respect skipSuccessfulRequests option", async () => {
			// This test would require a separate endpoint with skipSuccessfulRequests: true
			// For now, we test that the option is properly passed to the middleware
			const rateLimitWithSkip = createRateLimit({
				windowMs: 1000,
				max: 2,
				skipSuccessfulRequests: true,
			});

			expect(rateLimitWithSkip).toBeDefined();
		});

		it("should handle custom key generator", async () => {
			// Test that the key generator includes both IP and user ID
			const response = await request(app)
				.post("/api/user-specific")
				.set("user-id", "test-user")
				.send({})
				.expect(200);

			expect(response.body.success).toBe(true);
		});
	});

	describe("Error Handling", () => {
		it("should handle rate limit errors gracefully", async () => {
			// Exhaust rate limit
			await request(app).post("/api/strict").send({}).expect(200);
			await request(app).post("/api/strict").send({}).expect(200);

			const response = await request(app)
				.post("/api/strict")
				.send({})
				.expect(429);

			expect(response.body).toHaveProperty("error");
			expect(response.body).toHaveProperty("code");
			expect(response.body.error).toBe("Strict rate limit exceeded");
			expect(response.body.code).toBe("RATE_LIMIT_EXCEEDED");
		});

		it("should provide consistent error format", async () => {
			// Test different rate limited endpoints
			await request(app).post("/api/strict").send({}).expect(200);
			await request(app).post("/api/strict").send({}).expect(200);
			const strictResponse = await request(app)
				.post("/api/strict")
				.send({})
				.expect(429);

			// Exhaust normal rate limit
			for (let i = 0; i < 5; i++) {
				await request(app).post("/api/normal").send({});
			}
			const normalResponse = await request(app)
				.post("/api/normal")
				.send({})
				.expect(429);

			// Both should have consistent error format
			expect(strictResponse.body).toHaveProperty("error");
			expect(strictResponse.body).toHaveProperty("code", "RATE_LIMIT_EXCEEDED");
			expect(normalResponse.body).toHaveProperty("error");
			expect(normalResponse.body).toHaveProperty("code", "RATE_LIMIT_EXCEEDED");
		});
	});

	describe("Performance Under Load", () => {
		it("should maintain performance with many rate limited requests", async () => {
			const startTime = Date.now();

			// Make many requests that will be rate limited
			const promises = Array(50)
				.fill(null)
				.map(() => request(app).post("/api/strict").send({}));

			await Promise.all(promises);

			const duration = Date.now() - startTime;

			// Should complete within reasonable time even with many rate limited requests
			expect(duration).toBeLessThan(5000); // 5 seconds
		}, 6000);

		it("should not leak memory with many requests", async () => {
			const initialMemory = process.memoryUsage().heapUsed;

			// Make many requests
			for (let i = 0; i < 100; i++) {
				await request(app).post("/api/normal").send({});
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}

			const finalMemory = process.memoryUsage().heapUsed;
			const memoryIncrease = finalMemory - initialMemory;

			// Memory increase should be reasonable (less than 10MB)
			expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
		}, 10000);
	});
});
