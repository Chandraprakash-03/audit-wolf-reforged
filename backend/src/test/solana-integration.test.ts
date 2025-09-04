import { AnalyzerFactory } from "../services/analyzers/AnalyzerFactory";
import { ContractInput } from "../types/blockchain";

describe("Solana Integration Tests", () => {
	describe("AnalyzerFactory Integration", () => {
		it("should create Solana analyzer from factory", () => {
			const analyzer = AnalyzerFactory.getAnalyzer("solana");
			expect(analyzer).toBeDefined();
			expect(analyzer?.platform).toBe("solana");
		});

		it("should analyze Solana contract end-to-end", async () => {
			const analyzer = AnalyzerFactory.getAnalyzer("solana");
			expect(analyzer).toBeDefined();

			// Test with a simple contract that should trigger static analysis vulnerabilities
			const contract: ContractInput = {
				code: `let (pda, _bump) = Pubkey::find_program_address(&[user.key().as_ref()], &ctx.program_id);`,
				filename: "test_program.rs",
				platform: "solana",
			};

			// Test static analysis directly first
			const staticResult = await (analyzer as any).runStaticAnalysis([
				contract,
			]);
			expect(staticResult.success).toBe(true);
			expect(staticResult.vulnerabilities.length).toBeGreaterThan(0);

			// Now test full analysis
			const result = await analyzer!.analyze([contract]);

			// Should succeed even if AI fails (static analysis should work)
			expect(result.success).toBe(true);
			expect(result.vulnerabilities.length).toBeGreaterThan(0);

			// Should detect the PDA vulnerability
			const pdaVulns = result.vulnerabilities.filter(
				(v) => v.type === "insecure-pda-derivation"
			);
			expect(pdaVulns.length).toBeGreaterThan(0);

			// Should have platform-specific data
			expect(result.platformSpecific).toBeDefined();
			expect(result.platformSpecific?.analysisTools).toContain(
				"solana-security-checks"
			);
		});

		it("should validate Solana contract", async () => {
			const analyzer = AnalyzerFactory.getAnalyzer("solana");
			expect(analyzer).toBeDefined();

			const validContract: ContractInput = {
				code: `
use anchor_lang::prelude::*;

#[program]
pub mod valid_program {
    use super::*;
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 32)]
    pub data_account: Account<'info, DataAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct DataAccount {
    pub data: u64,
}
				`,
				filename: "valid_program.rs",
				platform: "solana",
			};

			const validation = await analyzer!.validateContract(validContract);
			expect(validation.isValid).toBe(true);
			expect(validation.errors).toHaveLength(0);
		});

		it("should detect invalid Solana contract", async () => {
			const analyzer = AnalyzerFactory.getAnalyzer("solana");
			expect(analyzer).toBeDefined();

			const invalidContract: ContractInput = {
				code: `
// This is not a valid Solana program
function invalidFunction() {
    // Missing braces and invalid syntax
				`,
				filename: "invalid.rs",
				platform: "solana",
			};

			const validation = await analyzer!.validateContract(invalidContract);
			expect(validation.isValid).toBe(false);
			expect(validation.errors.length).toBeGreaterThan(0);
		});
	});

	describe("Health Checks", () => {
		it("should check analyzer health", async () => {
			const analyzer = AnalyzerFactory.getAnalyzer("solana");
			expect(analyzer).toBeDefined();

			const health = await analyzer!.checkHealth();
			expect(health).toBeDefined();

			// Health check should either succeed or fail with specific error
			if (health.installed) {
				expect(health.version).toBeDefined();
			} else {
				expect(health.error).toBeDefined();
				expect(health.error).toMatch(/Rust|Cargo/);
			}
		});
	});

	describe("Factory Statistics", () => {
		it("should include Solana in supported platforms", () => {
			const platforms = AnalyzerFactory.getSupportedPlatformsWithAnalyzers();
			const solanaPlatform = platforms.find((p) => p.platformId === "solana");

			expect(solanaPlatform).toBeDefined();
			expect(solanaPlatform?.hasAnalyzer).toBe(true);
			expect(solanaPlatform?.isActive).toBe(true);
		});

		it("should validate Solana analyzer", async () => {
			const validation = await AnalyzerFactory.validateAnalyzer("solana");

			expect(validation).toBeDefined();
			// Validation may fail if Rust tools are not installed, which is expected in CI
			if (!validation.valid) {
				expect(validation.issues.length).toBeGreaterThan(0);
				expect(
					validation.issues.some(
						(issue) =>
							issue.includes("Rust") ||
							issue.includes("Cargo") ||
							issue.includes("tools")
					)
				).toBe(true);
			} else {
				expect(validation.issues).toHaveLength(0);
			}
		});

		it("should include Solana in analyzer statistics", () => {
			const stats = AnalyzerFactory.getAnalyzerStatistics();

			expect(stats.implementedAnalyzers).toBeGreaterThanOrEqual(2); // ethereum + solana
			expect(stats.totalPlatforms).toBeGreaterThanOrEqual(3); // ethereum + solana + cardano
		});
	});
});
