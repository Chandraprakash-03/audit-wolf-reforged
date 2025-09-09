import request from "supertest";
import { app } from "../../index";
import { supabase } from "../../config/supabase";
import { ContractModel } from "../../models/Contract";
import { AuditModel } from "../../models/Audit";

describe("API Integration Tests", () => {
	let authToken: string;
	let userId: string;
	let contractId: string;
	let auditId: string;

	// Test user credentials
	const testUser = {
		email: "test@auditwolf.com",
		password: "testpassword123",
		name: "Test User",
	};

	// Sample contract for testing
	const sampleContract = {
		name: "TestToken",
		sourceCode: `
      pragma solidity ^0.8.0;
      
      contract TestToken {
          mapping(address => uint256) public balances;
          
          function transfer(address to, uint256 amount) public {
              require(balances[msg.sender] >= amount, "Insufficient balance");
              balances[msg.sender] -= amount;
              balances[to] += amount;
          }
          
          function withdraw() public {
              uint256 balance = balances[msg.sender];
              require(balance > 0, "No balance to withdraw");
              // Vulnerable to reentrancy
              (bool success, ) = msg.sender.call{value: balance}("");
              require(success, "Transfer failed");
              balances[msg.sender] = 0;
          }
      }
    `,
		compilerVersion: "0.8.19",
	};

	beforeAll(async () => {
		// Clean up any existing test data
		await cleanupTestData();
	});

	afterAll(async () => {
		// Clean up test data
		await cleanupTestData();
	});

	async function cleanupTestData() {
		try {
			// Delete test user and related data
			const { data: users } = await supabase
				.from("users")
				.select("id")
				.eq("email", testUser.email);

			if (users && users.length > 0) {
				const testUserId = users[0].id;

				// Delete audits
				await supabase.from("audits").delete().eq("user_id", testUserId);

				// Delete contracts
				await supabase.from("contracts").delete().eq("user_id", testUserId);

				// Delete user
				await supabase.from("users").delete().eq("id", testUserId);
			}
		} catch (error) {
			console.warn("Cleanup warning:", error);
		}
	}

	describe("Authentication Flow", () => {
		it("should register a new user", async () => {
			const response = await request(app)
				.post("/api/auth/register")
				.send(testUser)
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.user.email).toBe(testUser.email);
			expect(response.body.data.token).toBeDefined();

			authToken = response.body.data.token;
			userId = response.body.data.user.id;
		});

		it("should login with valid credentials", async () => {
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
					email: testUser.email,
					password: "wrongpassword",
				})
				.expect(401);

			expect(response.body.success).toBe(false);
		});

		it("should reject requests without authentication", async () => {
			const response = await request(app).get("/api/contracts").expect(401);

			expect(response.body.success).toBe(false);
		});
	});

	describe("Contract Management Flow", () => {
		it("should create a new contract", async () => {
			const response = await request(app)
				.post("/api/contracts")
				.set("Authorization", `Bearer ${authToken}`)
				.send(sampleContract)
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.name).toBe(sampleContract.name);
			expect(response.body.data.id).toBeDefined();

			contractId = response.body.data.id;
		});

		it("should validate contract source code", async () => {
			const response = await request(app)
				.post("/api/contracts/validate")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ sourceCode: sampleContract.sourceCode })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.isValid).toBe(true);
			expect(response.body.data.metrics).toBeDefined();
		});

		it("should reject invalid Solidity code", async () => {
			const response = await request(app)
				.post("/api/contracts/validate")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ sourceCode: "invalid solidity code" })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.isValid).toBe(false);
			expect(response.body.data.errors.length).toBeGreaterThan(0);
		});

		it("should retrieve user contracts", async () => {
			const response = await request(app)
				.get("/api/contracts")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(Array.isArray(response.body.data)).toBe(true);
			expect(response.body.data.length).toBeGreaterThan(0);
		});

		it("should retrieve specific contract", async () => {
			const response = await request(app)
				.get(`/api/contracts/${contractId}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.id).toBe(contractId);
			expect(response.body.data.name).toBe(sampleContract.name);
		});

		it("should reject access to non-existent contract", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			const response = await request(app)
				.get(`/api/contracts/${fakeId}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(404);

			expect(response.body.success).toBe(false);
		});
	});

	describe("Analysis Workflow", () => {
		it("should start static analysis", async () => {
			const response = await request(app)
				.post("/api/analysis/start")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contractId,
					analysisType: "static",
					priority: 5,
				})
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.auditId).toBeDefined();
			expect(response.body.data.jobId).toBeDefined();

			auditId = response.body.data.auditId;
		});

		it("should get analysis progress", async () => {
			const response = await request(app)
				.get(`/api/analysis/${auditId}/progress`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.status).toBeDefined();
			expect(typeof response.body.data.progress).toBe("number");
		});

		it("should validate analysis system health", async () => {
			const response = await request(app)
				.get("/api/analysis/health")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toBeDefined();
		});

		it("should start full analysis (static + AI)", async () => {
			const response = await request(app)
				.post("/api/analysis/start")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contractId,
					analysisType: "full",
					priority: 10,
					options: {
						includeGasOptimization: true,
					},
				})
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.auditId).toBeDefined();
		});

		// Wait for analysis to complete (in real tests, you might mock this)
		it("should wait for analysis completion", async () => {
			let completed = false;
			let attempts = 0;
			const maxAttempts = 30; // 30 seconds timeout

			while (!completed && attempts < maxAttempts) {
				const response = await request(app)
					.get(`/api/analysis/${auditId}/progress`)
					.set("Authorization", `Bearer ${authToken}`);

				if (
					response.body.data.status === "completed" ||
					response.body.data.status === "failed"
				) {
					completed = true;
				} else {
					await new Promise((resolve) => setTimeout(resolve, 1000));
					attempts++;
				}
			}

			expect(completed).toBe(true);
		}, 35000); // 35 second timeout for this test

		it("should retrieve analysis results", async () => {
			const response = await request(app)
				.get(`/api/analysis/${auditId}/results`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.auditId).toBe(auditId);
			expect(response.body.data.vulnerabilities).toBeDefined();
		});
	});

	describe("Report Generation Flow", () => {
		it("should generate HTML report", async () => {
			const response = await request(app)
				.post("/api/reports/generate")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					auditId,
					format: "html",
					reportType: "standard",
				})
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.html.available).toBe(true);
			expect(response.body.data.html.downloadUrl).toBeDefined();
		});

		it("should generate PDF report", async () => {
			const response = await request(app)
				.post("/api/reports/generate")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					auditId,
					format: "pdf",
					reportType: "detailed",
					includeSourceCode: true,
				})
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.pdf.available).toBe(true);
			expect(response.body.data.pdf.downloadUrl).toBeDefined();
		});

		it("should get report information", async () => {
			const response = await request(app)
				.get(`/api/reports/${auditId}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.hasReport).toBe(true);
			expect(response.body.data.files.html.available).toBe(true);
			expect(response.body.data.files.pdf.available).toBe(true);
		});

		it("should download HTML report", async () => {
			const response = await request(app)
				.get(`/api/reports/${auditId}/download/html`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.headers["content-type"]).toContain("text/html");
		});

		it("should download PDF report", async () => {
			const response = await request(app)
				.get(`/api/reports/${auditId}/download/pdf`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.headers["content-type"]).toContain("application/pdf");
		});
	});

	describe("Error Handling", () => {
		it("should handle malformed JSON", async () => {
			const response = await request(app)
				.post("/api/contracts")
				.set("Authorization", `Bearer ${authToken}`)
				.set("Content-Type", "application/json")
				.send('{"invalid": json}')
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it("should handle invalid UUID parameters", async () => {
			const response = await request(app)
				.get("/api/contracts/invalid-uuid")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it("should handle rate limiting", async () => {
			// Make multiple rapid requests to trigger rate limiting
			const promises = Array(25)
				.fill(null)
				.map(() =>
					request(app)
						.post("/api/contracts/validate")
						.set("Authorization", `Bearer ${authToken}`)
						.send({ sourceCode: "pragma solidity ^0.8.0;" })
				);

			const responses = await Promise.all(promises);

			// At least one should be rate limited
			const rateLimited = responses.some((res) => res.status === 429);
			expect(rateLimited).toBe(true);
		});
	});

	describe("System Health", () => {
		it("should check system health", async () => {
			const response = await request(app).get("/health").expect(200);

			expect(response.body.status).toBeDefined();
			expect(response.body.checks).toBeDefined();
		});

		it("should check liveness probe", async () => {
			const response = await request(app).get("/health/live").expect(200);

			expect(response.body.status).toBe("alive");
		});

		it("should check readiness probe", async () => {
			const response = await request(app).get("/health/ready").expect(200);

			expect(response.body.status).toBe("ready");
		});
	});
});
