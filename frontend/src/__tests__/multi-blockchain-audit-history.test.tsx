import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AuditDashboard } from "@/components/features/audits/AuditDashboard";
import { auditService } from "@/services/auditService";
import { contractService } from "@/services/contractService";

// Mock the services
jest.mock("@/services/auditService");
jest.mock("@/services/contractService");

const mockAuditService = auditService as jest.Mocked<typeof auditService>;
const mockContractService = contractService as jest.Mocked<
	typeof contractService
>;

describe("Multi-Blockchain Audit History", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should display multi-blockchain audit statistics", async () => {
		// Mock regular audits
		mockAuditService.getUserAudits.mockResolvedValue({
			success: true,
			data: {
				data: [
					{
						id: "1",
						contract_id: "contract-1",
						user_id: "user-1",
						status: "completed",
						created_at: new Date(),
					},
				],
				total: 1,
				page: 1,
				limit: 10,
				hasMore: false,
			},
		});

		// Mock multi-chain audits
		mockAuditService.getMultiChainAudits.mockResolvedValue({
			success: true,
			data: {
				data: [
					{
						id: "2",
						user_id: "user-1",
						audit_name: "Multi-Chain Test",
						platforms: ["ethereum", "solana"],
						contracts: {},
						cross_chain_analysis: true,
						status: "completed",
						created_at: new Date(),
					},
				],
				total: 1,
				page: 1,
				limit: 10,
				hasMore: false,
			},
		});

		// Mock contracts
		mockContractService.getUserContracts.mockResolvedValue({
			success: true,
			data: [
				{
					id: "contract-1",
					user_id: "user-1",
					name: "Test Contract",
					source_code: "contract Test {}",
					compiler_version: "0.8.0",
					file_hash: "hash",
					created_at: new Date(),
				},
			],
		});

		render(<AuditDashboard />);

		// Wait for data to load
		await waitFor(() => {
			expect(screen.getByText("Total Audits")).toBeInTheDocument();
		});

		// Check that multi-chain statistics are displayed
		expect(screen.getByText("Multi Chain")).toBeInTheDocument();
		expect(screen.getByText("Cross Chain")).toBeInTheDocument();
		expect(screen.getByText("Single Chain")).toBeInTheDocument();
	});

	it("should display platform filtering options", async () => {
		mockAuditService.getUserAudits.mockResolvedValue({
			success: true,
			data: { data: [], total: 0, page: 1, limit: 10, hasMore: false },
		});

		mockAuditService.getMultiChainAudits.mockResolvedValue({
			success: true,
			data: { data: [], total: 0, page: 1, limit: 10, hasMore: false },
		});

		mockContractService.getUserContracts.mockResolvedValue({
			success: true,
			data: [],
		});

		render(<AuditDashboard />);

		await waitFor(() => {
			expect(screen.getByText("Filter Audits")).toBeInTheDocument();
		});

		// Check that blockchain platform filter is available
		expect(screen.getByText("Blockchain Platform")).toBeInTheDocument();
		expect(screen.getByText("Language")).toBeInTheDocument();
		expect(screen.getByText("Audit Type")).toBeInTheDocument();
	});

	it("should display platform analytics tab", async () => {
		mockAuditService.getUserAudits.mockResolvedValue({
			success: true,
			data: { data: [], total: 0, page: 1, limit: 10, hasMore: false },
		});

		mockAuditService.getMultiChainAudits.mockResolvedValue({
			success: true,
			data: { data: [], total: 0, page: 1, limit: 10, hasMore: false },
		});

		mockContractService.getUserContracts.mockResolvedValue({
			success: true,
			data: [],
		});

		render(<AuditDashboard />);

		await waitFor(() => {
			expect(screen.getByText("Platform Analytics")).toBeInTheDocument();
		});

		expect(screen.getByText("Comparative Analysis")).toBeInTheDocument();
	});
});
