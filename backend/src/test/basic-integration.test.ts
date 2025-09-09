import request from "supertest";
import { app } from "../index";

describe("Basic Integration Tests", () => {
	describe("Health Check", () => {
		it("should return health status", async () => {
			const response = await request(app).get("/health").expect(200);

			expect(response.body.status).toBeDefined();
		});

		it("should return liveness probe", async () => {
			const response = await request(app).get("/health/live").expect(200);

			expect(response.body.status).toBe("alive");
		});
	});

	describe("Authentication", () => {
		it("should register a new user", async () => {
			const testUser = {
				email: "test@example.com",
				password: "testpassword123",
				name: "Test User",
			};

			const response = await request(app)
				.post("/api/auth/register")
				.send(testUser)
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.user.email).toBe(testUser.email);
			expect(response.body.data.token).toBeDefined();
		});

		it("should login with valid credentials", async () => {
			// First register a user
			const testUser = {
				email: "login-test@example.com",
				password: "testpassword123",
				name: "Login Test User",
			};

			await request(app).post("/api/auth/register").send(testUser);

			// Then login
			const response = await request(app)
				.post("/api/auth/login")
				.send({
					email: testUser.email,
					password: testUser.password,
				})
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.user.email).toBe(testUser.email);
			expect(response.body.data.token).toBeDefined();
		});

		it("should reject invalid credentials", async () => {
			const response = await request(app)
				.post("/api/auth/login")
				.send({
					email: "nonexistent@example.com",
					password: "wrongpassword",
				})
				.expect(401);

			expect(response.body.success).toBe(false);
		});
	});
});
