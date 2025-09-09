import request from "supertest";
import { app } from "../index";

describe("Multi-Blockchain API Endpoints - Simple Tests", () => {
	let authToken: string;

	beforeAll(async () => {
		// Create test user and get auth token
		const registerResponse = await request(app)
			.post("/api/auth/register")
			.send({
				email: "multichain-simple@test.com",
				password: "testpassword123",
				name: "Multi Chain Simple Tester",
			});

		if (registerResponse.body.success) {
			authToken = registerResponse.body.data.token;
		}
	});

	describe("GET /api/multi-blockchain/platforms", () => {
		it("should return list of blockchain platforms", async () => {
			if (!authToken) {
				console.log("Skipping test - no auth token");
				return;
			}

			const response = await request(app)
				.get("/api/multi-blockchain/platforms")
				.set("Authorization", `Bearer ${authToken}`);

			console.log("Response status:", response.status);
			console.log("Response body:", JSON.stringify(response.body, null, 2));

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(Array.isArray(response.body.data)).toBe(true);
		});

		it("should require authentication", async () => {
			const response = await request(app).get(
				"/api/multi-blockchain/platforms"
			);

			expect(response.status).toBe(401);
		});
	});

	describe("POST /api/multi-blockchain/platforms/detect", () => {
		it("should detect Solidity/Ethereum platform", async () => {
			if (!authToken) {
				console.log("Skipping test - no auth token");
				return;
			}

			const solidityCode = `
        pragma solidity ^0.8.0;
        
        contract TestContract {
          function test() public pure returns (uint256) {
            return 42;
          }
        }
      `;

			const response = await request(app)
				.post("/api/multi-blockchain/platforms/detect")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					code: solidityCode,
					filename: "TestContract.sol",
				});

			console.log(
				"Detection response:",
				JSON.stringify(response.body, null, 2)
			);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(Array.isArray(response.body.data)).toBe(true);
		});

		it("should validate input parameters", async () => {
			if (!authToken) {
				console.log("Skipping test - no auth token");
				return;
			}

			const response = await request(app)
				.post("/api/multi-blockchain/platforms/detect")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					code: "", // Empty code should fail validation
				});

			expect(response.status).toBe(400);
			expect(response.body.success).toBe(false);
		});
	});
});
