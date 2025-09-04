import { SolanaAnalyzer } from "../services/analyzers/SolanaAnalyzer";
import { ContractInput } from "../types/blockchain";

describe("SolanaAnalyzer", () => {
	let analyzer: SolanaAnalyzer;

	beforeEach(() => {
		analyzer = new SolanaAnalyzer();
	});

	describe("Platform Detection", () => {
		it("should identify Anchor programs correctly", () => {
			const anchorCode = `
use anchor_lang::prelude::*;

#[program]
pub mod my_program {
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
    pub authority: Pubkey,
}
			`;

			expect(analyzer["isAnchorProgram"](anchorCode)).toBe(true);
		});

		it("should identify native Solana programs correctly", () => {
			const nativeCode = `
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Hello, Solana!");
    Ok(())
}
			`;

			expect(analyzer["isSolanaRustProgram"](nativeCode)).toBe(true);
		});
	});

	describe("Contract Validation", () => {
		it("should validate Anchor contracts successfully", async () => {
			const contract: ContractInput = {
				code: `
use anchor_lang::prelude::*;

#[program]
pub mod test_program {
    use super::*;
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let account = &mut ctx.accounts.data_account;
        account.authority = ctx.accounts.user.key();
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
    pub authority: Pubkey,
}
				`,
				filename: "test_program.rs",
				platform: "solana",
			};

			const result = await analyzer.validateContract(contract);
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("should detect validation issues in malformed contracts", async () => {
			const contract: ContractInput = {
				code: `
// Missing imports and structure
pub fn broken_function() {
    // Unmatched brace
				`,
				filename: "broken.rs",
				platform: "solana",
			};

			const result = await analyzer.validateContract(contract);
			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});
	});

	describe("Security Checks", () => {
		it("should detect insecure PDA derivation", async () => {
			const contract: ContractInput = {
				code: `let (pda, _bump) = Pubkey::find_program_address(&[user.key().as_ref()], &ctx.program_id);`,
				filename: "vulnerable.rs",
				platform: "solana",
			};

			const pdaVulns = analyzer["checkPDAValidation"](contract);
			expect(pdaVulns.length).toBeGreaterThan(0);
			expect(pdaVulns[0].type).toBe("insecure-pda-derivation");
		});

		it("should detect missing account owner validation", async () => {
			const contract: ContractInput = {
				code: `
use solana_program::account_info::AccountInfo;
let account: &AccountInfo = &accounts[0];
// Missing validation check
				`,
				filename: "missing_validation.rs",
				platform: "solana",
			};

			const accountVulns = analyzer["checkAccountModel"](contract);
			expect(accountVulns.length).toBeGreaterThan(0);
			expect(accountVulns[0].type).toBe("missing-owner-validation");
		});
	});

	describe("Anchor Pattern Checks", () => {
		it("should detect missing Anchor constraints", () => {
			const contract: ContractInput = {
				code: `
#[derive(Accounts)]
pub struct MissingConstraints<'info> {
    #[account(init, payer = user, space = 8 + 32)]
    pub data_account: Account<'info, DataAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
}
				`,
				filename: "missing_constraints.rs",
				platform: "solana",
			};

			const anchorVulns = analyzer["checkAnchorPatterns"](contract);
			const constraintVulns = anchorVulns.filter(
				(v) => v.type === "anchor-missing-constraints"
			);
			expect(constraintVulns.length).toBeGreaterThan(0);
		});

		it("should detect missing signer validation", () => {
			const contract: ContractInput = {
				code: `
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    // Missing signer validation
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    pub data_account: Account<'info, DataAccount>,
}
				`,
				filename: "missing_signer.rs",
				platform: "solana",
			};

			const anchorVulns = analyzer["checkAnchorPatterns"](contract);
			const signerVulns = anchorVulns.filter(
				(v) => v.type === "anchor-missing-signer"
			);
			expect(signerVulns.length).toBeGreaterThan(0);
		});
	});

	describe("AI Analysis Integration", () => {
		it("should create Solana-specific analysis prompts", () => {
			const anchorCode = `
use anchor_lang::prelude::*;

#[program]
pub mod test_program {
    use super::*;
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}
			`;

			const prompt = analyzer["createSolanaAnalysisPrompt"](
				anchorCode,
				"test.rs"
			);

			expect(prompt).toContain("Anchor");
			expect(prompt).toContain("PDA");
			expect(prompt).toContain("Account Model Security");
			expect(prompt).toContain("Solana-specific");
		});

		it("should create native Solana program prompts", () => {
			const nativeCode = `
use solana_program::entrypoint;

entrypoint!(process_instruction);
			`;

			const prompt = analyzer["createSolanaAnalysisPrompt"](
				nativeCode,
				"native.rs"
			);

			expect(prompt).toContain("native Solana program");
			expect(prompt).toContain("Account validation");
			expect(prompt).toContain("Cross-program invocation");
		});
	});

	describe("Health Checks", () => {
		it("should check for required tools", async () => {
			// This test may fail in CI environments without Rust installed
			const health = await analyzer.checkHealth();

			// We expect either success or specific error messages
			if (!health.installed) {
				expect(health.error).toBeDefined();
				expect(health.error).toMatch(/Rust|Cargo/);
			} else {
				expect(health.version).toBeDefined();
			}
		});
	});

	describe("Vulnerability Recommendations", () => {
		it("should provide Solana-specific recommendations", () => {
			const pdaRecommendation = analyzer["getSolanaRecommendation"](
				"pda-security",
				"PDA derivation issue"
			);
			expect(pdaRecommendation).toContain("PDA");
			expect(pdaRecommendation).toContain("canonical bump");

			const accountRecommendation = analyzer["getSolanaRecommendation"](
				"account-validation",
				"Account validation issue"
			);
			expect(accountRecommendation).toContain("account ownership");
			expect(accountRecommendation).toContain("signer");
		});

		it("should fall back to generic recommendations", () => {
			const genericRecommendation = analyzer["getSolanaRecommendation"](
				"unknown-type",
				"Some unknown issue"
			);
			expect(genericRecommendation).toContain("Solana security best practices");
		});
	});
});

// Test data for integration tests
export const TEST_SOLANA_CONTRACTS = {
	ANCHOR_PROGRAM: `
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod my_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, data: u64) -> Result<()> {
        let my_account = &mut ctx.accounts.my_account;
        my_account.data = data;
        my_account.authority = ctx.accounts.user.key();
        Ok(())
    }

    pub fn update(ctx: Context<Update>, data: u64) -> Result<()> {
        let my_account = &mut ctx.accounts.my_account;
        my_account.data = data;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 40)]
    pub my_account: Account<'info, MyAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut, has_one = authority)]
    pub my_account: Account<'info, MyAccount>,
    pub authority: Signer<'info>,
}

#[account]
pub struct MyAccount {
    pub authority: Pubkey,
    pub data: u64,
}
	`,

	VULNERABLE_PDA: `
use anchor_lang::prelude::*;

#[program]
pub mod vulnerable_program {
    use super::*;
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        // Missing access control
        let account = &mut ctx.accounts.data_account;
        account.authority = ctx.accounts.user.key();
        Ok(())
    }
    
    pub fn vulnerable_pda(ctx: Context<VulnerablePDA>, user: Pubkey) -> Result<()> {
        // Insecure PDA derivation
        let (pda, _bump) = Pubkey::find_program_address(
            &[user.key().as_ref()], // Predictable seed
            &ctx.program_id
        );
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

#[derive(Accounts)]
pub struct VulnerablePDA<'info> {
    pub user: Signer<'info>,
}

#[account]
pub struct DataAccount {
    pub authority: Pubkey,
}
	`,

	NATIVE_PROGRAM: `
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    sysvar::Sysvar,
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let account = next_account_info(accounts_iter)?;

    // Check if account is owned by the program
    if account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    // Check if account is signer
    if !account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    msg!("Hello, Solana!");
    Ok(())
}
	`,
};
