import request from "supertest";
import express from "express";
import contractRoutes from "../routes/contracts";

// Mock the ContractModel
jest.mock("../models/Contract", () => ({
	ContractModel: {
		create: jest.fn(),
		findById: jest.fn(),
		findByUserId: jest.fn(),
	},
}));

// Mock auth middleware
jest.mock("../middleware/auth", () => ({
	authenticateToken: (req: any, res: any, next: any) => {
		req.user = { id: "test-user-id" };
		next();
	},
}));

const app = express();
app.use(express.json());
app.use("/api/contracts", contractRoutes);

describe("Contract Routes", () => {
	const { ContractModel } = require("../models/Contract");

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("POST /api/contracts", () => {
		it("should create a contract with valid data", async () => {
			const mockContract = {
				toJSON: () => ({
					id: "test-contract-id",
					name: "TestContract",
				}),
			};

			ContractModel.create.mockResolvedValue(mockContract);

			const response = await request(app).post("/api/contracts").send({
				name: "TestContract",
				sourceCode: "pragma solidity ^0.8.0; contract TestContract {}",
				compilerVersion: "0.8.0",
			});

			expect(response.status).toBe(201);
			expect(response.body.success).toBe(true);
		});

		it("should reject contract with invalid name", async () => {
			const response = await request(app).post("/api/contracts").send({
				name: "",
				sourceCode: "pragma solidity ^0.8.0; contract TestContract {}",
			});

			expect(response.status).toBe(400);
			expect(response.body.success).toBe(false);
		});
	});

	describe("POST /api/contracts/validate", () => {
		it("should validate valid Solidity code", async () => {
			const response = await request(app).post("/api/contracts/validate").send({
				sourceCode: "pragma solidity ^0.8.0; contract TestContract {}",
			});

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data.isValid).toBe(true);
		});

		it("should reject invalid Solidity code", async () => {
			const response = await request(app).post("/api/contracts/validate").send({
				sourceCode: "invalid solidity code",
			});

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data.isValid).toBe(false);
		});
	});

	describe("GET /api/contracts", () => {
		it("should return user contracts", async () => {
			const mockContracts = [
				{ toJSON: () => ({ id: "contract-1", name: "Contract1" }) },
				{ toJSON: () => ({ id: "contract-2", name: "Contract2" }) },
			];

			ContractModel.findByUserId.mockResolvedValue(mockContracts);

			const response = await request(app).get("/api/contracts");

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveLength(2);
		});
	});
});
