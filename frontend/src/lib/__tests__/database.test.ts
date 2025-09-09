import { DatabaseService } from "../database";

// Mock Supabase client for testing
jest.mock("../supabase", () => ({
	supabase: {
		auth: {
			getUser: jest.fn(),
		},
		from: jest.fn(() => ({
			select: jest.fn(() => ({
				eq: jest.fn(() => ({
					single: jest.fn(),
					order: jest.fn(() => ({
						limit: jest.fn(),
					})),
				})),
				limit: jest.fn(),
			})),
			insert: jest.fn(() => ({
				select: jest.fn(() => ({
					single: jest.fn(),
				})),
			})),
			update: jest.fn(() => ({
				eq: jest.fn(() => ({
					select: jest.fn(() => ({
						single: jest.fn(),
					})),
				})),
			})),
		})),
		channel: jest.fn(() => ({
			on: jest.fn(() => ({
				subscribe: jest.fn(),
			})),
		})),
	},
}));

describe("Frontend Database Service", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("User Operations", () => {
		it("should handle getCurrentUser when not authenticated", async () => {
			const { supabase } = require("../supabase");
			supabase.auth.getUser.mockResolvedValue({
				data: { user: null },
				error: null,
			});

			const result = await DatabaseService.getCurrentUser();
			expect(result).toBeNull();
		});

		it("should handle updateUserProfile gracefully", async () => {
			const { supabase } = require("../supabase");
			supabase.auth.getUser.mockResolvedValue({
				data: { user: null },
				error: null,
			});

			const result = await DatabaseService.updateUserProfile({
				name: "Updated Name",
			});
			expect(result).toBeNull();
		});
	});

	describe("Contract Operations", () => {
		it("should handle getUserContracts when not authenticated", async () => {
			const { supabase } = require("../supabase");
			supabase.auth.getUser.mockResolvedValue({
				data: { user: null },
				error: null,
			});

			const result = await DatabaseService.getUserContracts();
			expect(result).toEqual([]);
		});

		it("should handle createContract when not authenticated", async () => {
			const { supabase } = require("../supabase");
			supabase.auth.getUser.mockResolvedValue({
				data: { user: null },
				error: null,
			});

			const contractData = {
				name: "Test Contract",
				source_code: "pragma solidity ^0.8.0;",
				compiler_version: "0.8.19",
				file_hash: "test-hash",
			};

			await expect(
				DatabaseService.createContract(contractData)
			).rejects.toThrow("User not authenticated");
		});
	});

	describe("Audit Operations", () => {
		it("should handle getUserAudits when not authenticated", async () => {
			const { supabase } = require("../supabase");
			supabase.auth.getUser.mockResolvedValue({
				data: { user: null },
				error: null,
			});

			const result = await DatabaseService.getUserAudits();
			expect(result).toEqual([]);
		});

		it("should handle createAudit when not authenticated", async () => {
			const { supabase } = require("../supabase");
			supabase.auth.getUser.mockResolvedValue({
				data: { user: null },
				error: null,
			});

			await expect(
				DatabaseService.createAudit("test-contract-id")
			).rejects.toThrow("User not authenticated");
		});
	});

	describe("Real-time Subscriptions", () => {
		it("should create audit update subscription", () => {
			const mockCallback = jest.fn();
			const subscription = DatabaseService.subscribeToAuditUpdates(
				"test-audit-id",
				mockCallback
			);

			expect(subscription).toBeDefined();
		});

		it("should create user audits subscription", () => {
			const mockCallback = jest.fn();
			const subscription = DatabaseService.subscribeToUserAudits(
				"test-user-id",
				mockCallback
			);

			expect(subscription).toBeDefined();
		});
	});
});

// Test utilities for frontend development
export const mockAuthUser = {
	id: "test-user-id",
	email: "test@example.com",
	created_at: new Date().toISOString(),
};

export const mockContract = {
	id: "test-contract-id",
	user_id: "test-user-id",
	name: "Test Contract",
	source_code: "pragma solidity ^0.8.0; contract Test {}",
	compiler_version: "0.8.19",
	file_hash: "test-hash-123",
	created_at: new Date(),
};

export const mockAudit = {
	id: "test-audit-id",
	contract_id: "test-contract-id",
	user_id: "test-user-id",
	status: "completed" as const,
	created_at: new Date(),
	completed_at: new Date(),
};
