/**
 * Test fixtures for Solana/Rust contracts
 */

export const SOLANA_TEST_CONTRACTS = {
	// Valid Anchor program with proper security patterns
	SECURE_ANCHOR_PROGRAM: {
		name: "SecureAnchorProgram",
		code: `
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_program {
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

    pub fn secure_pda_operation(ctx: Context<SecurePDA>, seed: String) -> Result<()> {
        let (expected_pda, bump) = Pubkey::find_program_address(
            &[
                b"secure_seed",
                seed.as_bytes(),
                ctx.accounts.authority.key().as_ref(),
            ],
            &ctx.program_id
        );
        
        require_keys_eq!(ctx.accounts.pda_account.key(), expected_pda);
        
        let pda_account = &mut ctx.accounts.pda_account;
        pda_account.bump = bump;
        pda_account.authority = ctx.accounts.authority.key();
        
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

#[derive(Accounts)]
pub struct SecurePDA<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 1,
        seeds = [b"secure_seed", seed.as_bytes(), authority.key().as_ref()],
        bump
    )]
    pub pda_account: Account<'info, PDAAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct MyAccount {
    pub authority: Pubkey,
    pub data: u64,
}

#[account]
pub struct PDAAccount {
    pub authority: Pubkey,
    pub bump: u8,
}
		`,
		platform: "solana",
		language: "rust",
		expectedVulnerabilities: 0,
		expectedWarnings: 0,
	},

	// Vulnerable Anchor program with multiple security issues
	VULNERABLE_ANCHOR_PROGRAM: {
		name: "VulnerableAnchorProgram",
		code: `
use anchor_lang::prelude::*;

#[program]
pub mod vulnerable_program {
    use super::*;
    
    // Missing access control
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let account = &mut ctx.accounts.data_account;
        account.authority = ctx.accounts.user.key();
        Ok(())
    }
    
    // Insecure PDA derivation
    pub fn vulnerable_pda(ctx: Context<VulnerablePDA>, user: Pubkey) -> Result<()> {
        let (pda, _bump) = Pubkey::find_program_address(
            &[user.as_ref()], // Predictable seed - vulnerability
            &ctx.program_id
        );
        Ok(())
    }
    
    // Missing signer validation
    pub fn unsafe_transfer(ctx: Context<UnsafeTransfer>, amount: u64) -> Result<()> {
        // No validation that user is authorized to transfer
        let from_account = &mut ctx.accounts.from_account;
        let to_account = &mut ctx.accounts.to_account;
        
        from_account.balance -= amount; // Potential underflow
        to_account.balance += amount;   // Potential overflow
        
        Ok(())
    }
    
    // Missing account ownership validation
    pub fn unsafe_account_access(ctx: Context<UnsafeAccess>) -> Result<()> {
        // Directly accessing account data without validation
        let account_info = &ctx.accounts.target_account;
        let mut data = account_info.try_borrow_mut_data()?;
        data[0] = 255; // Unsafe write
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

#[derive(Accounts)]
pub struct UnsafeTransfer<'info> {
    #[account(mut)]
    pub from_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to_account: Account<'info, TokenAccount>,
    // Missing signer constraint
    pub user: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct UnsafeAccess<'info> {
    /// CHECK: This account is not validated - security issue
    pub target_account: AccountInfo<'info>,
}

#[account]
pub struct DataAccount {
    pub authority: Pubkey,
}

#[account]
pub struct TokenAccount {
    pub owner: Pubkey,
    pub balance: u64,
}
		`,
		platform: "solana",
		language: "rust",
		expectedVulnerabilities: 5,
		expectedSeverity: "high",
		expectedTypes: [
			"insecure-pda-derivation",
			"missing-access-control",
			"missing-signer-validation",
			"integer-overflow",
			"unsafe-account-access",
		],
	},

	// Native Solana program with security best practices
	SECURE_NATIVE_PROGRAM: {
		name: "SecureNativeProgram",
		code: `
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
    let authority = next_account_info(accounts_iter)?;

    // Validate account ownership
    if account.owner != program_id {
        msg!("Account not owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Validate signer
    if !authority.is_signer {
        msg!("Authority must be signer");
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate account is writable
    if !account.is_writable {
        msg!("Account must be writable");
        return Err(ProgramError::InvalidAccountData);
    }

    // Check rent exemption
    let rent = Rent::get()?;
    if !rent.is_exempt(account.lamports(), account.data_len()) {
        msg!("Account not rent exempt");
        return Err(ProgramError::AccountNotRentExempt);
    }

    // Safe data manipulation
    let mut data = account.try_borrow_mut_data()?;
    if data.len() < 8 {
        msg!("Account data too small");
        return Err(ProgramError::AccountDataTooSmall);
    }

    // Parse instruction safely
    if instruction_data.is_empty() {
        msg!("Empty instruction data");
        return Err(ProgramError::InvalidInstructionData);
    }

    match instruction_data[0] {
        0 => {
            // Initialize
            data[0..8].copy_from_slice(&[1, 0, 0, 0, 0, 0, 0, 0]);
            msg!("Account initialized");
        }
        1 => {
            // Update
            if data[0] == 0 {
                msg!("Account not initialized");
                return Err(ProgramError::UninitializedAccount);
            }
            data[0..8].copy_from_slice(&[2, 0, 0, 0, 0, 0, 0, 0]);
            msg!("Account updated");
        }
        _ => {
            msg!("Invalid instruction");
            return Err(ProgramError::InvalidInstructionData);
        }
    }

    Ok(())
}
		`,
		platform: "solana",
		language: "rust",
		expectedVulnerabilities: 0,
		expectedWarnings: 0,
	},

	// Vulnerable native Solana program
	VULNERABLE_NATIVE_PROGRAM: {
		name: "VulnerableNativeProgram",
		code: `
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
    let accounts_iter = &mut accounts.iter();
    let account = next_account_info(accounts_iter)?;

    // Missing ownership validation - vulnerability
    // Missing signer validation - vulnerability
    // Missing writability check - vulnerability

    // Unsafe data access
    let mut data = account.try_borrow_mut_data()?;
    
    // Buffer overflow potential - vulnerability
    if !instruction_data.is_empty() {
        let value = instruction_data[0];
        // Writing beyond bounds without checking
        data[value as usize] = 255; // Potential out-of-bounds write
    }

    // Unchecked arithmetic - vulnerability
    let current_value = data[0];
    data[0] = current_value + 1; // Potential overflow

    // Missing rent exemption check - vulnerability
    // Missing proper error handling

    msg!("Unsafe operation completed");
    Ok(())
}
		`,
		platform: "solana",
		language: "rust",
		expectedVulnerabilities: 6,
		expectedSeverity: "critical",
		expectedTypes: [
			"missing-owner-validation",
			"missing-signer-validation",
			"missing-writability-check",
			"buffer-overflow",
			"integer-overflow",
			"missing-rent-check",
		],
	},

	// Complex Solana program for performance testing
	LARGE_SOLANA_PROGRAM: {
		name: "LargeSolanaProgram",
		code: `
use anchor_lang::prelude::*;

declare_id!("LargeProgram11111111111111111111111111111111");

#[program]
pub mod large_program {
    use super::*;

    ${Array.from(
			{ length: 20 },
			(_, i) => `
    pub fn function_${i}(ctx: Context<Operation${i}>, data: u64) -> Result<()> {
        let account = &mut ctx.accounts.account;
        account.data_${i} = data;
        account.counter += 1;
        
        // Simulate complex computation
        let mut result = data;
        for j in 0..100 {
            result = result.wrapping_mul(j + 1).wrapping_add(${i});
        }
        
        account.computed_value = result;
        Ok(())
    }
    `
		).join("\n")}

    pub fn batch_operation(ctx: Context<BatchOperation>, operations: Vec<u64>) -> Result<()> {
        let account = &mut ctx.accounts.account;
        
        for (i, op) in operations.iter().enumerate() {
            if i >= 50 { break; } // Limit operations
            account.batch_data[i] = *op;
        }
        
        account.batch_count = operations.len() as u64;
        Ok(())
    }
}

${Array.from(
	{ length: 20 },
	(_, i) => `
#[derive(Accounts)]
pub struct Operation${i}<'info> {
    #[account(mut, has_one = authority)]
    pub account: Account<'info, LargeAccount>,
    pub authority: Signer<'info>,
}
`
).join("\n")}

#[derive(Accounts)]
pub struct BatchOperation<'info> {
    #[account(mut, has_one = authority)]
    pub account: Account<'info, LargeAccount>,
    pub authority: Signer<'info>,
}

#[account]
pub struct LargeAccount {
    pub authority: Pubkey,
    pub counter: u64,
    pub computed_value: u64,
    pub batch_count: u64,
    ${Array.from({ length: 20 }, (_, i) => `pub data_${i}: u64,`).join(
			"\n    "
		)}
    pub batch_data: [u64; 50],
}
		`,
		platform: "solana",
		language: "rust",
		expectedVulnerabilities: 0,
		isLarge: true,
	},

	// Invalid Rust code for error testing
	INVALID_RUST_CODE: {
		name: "InvalidRustCode",
		code: `
this is not valid rust code
missing use statements and proper syntax
unmatched braces { { {
invalid function definitions
		`,
		platform: "solana",
		language: "rust",
		shouldFail: true,
		expectedErrors: ["syntax error", "unmatched braces"],
	},
};

export const SOLANA_ANALYSIS_EXPECTATIONS = {
	SECURE_ANCHOR_PROGRAM: {
		shouldPass: true,
		expectedVulnerabilities: 0,
		expectedWarnings: [],
		expectedRecommendations: [
			"Consider adding rate limiting for public functions",
			"Implement comprehensive logging for audit trails",
		],
	},

	VULNERABLE_ANCHOR_PROGRAM: {
		shouldPass: true, // Analysis passes but finds vulnerabilities
		expectedVulnerabilities: 5,
		vulnerabilityTypes: [
			"insecure-pda-derivation",
			"missing-access-control",
			"missing-signer-validation",
			"integer-overflow",
			"unsafe-account-access",
		],
		expectedSeverity: "high",
	},

	SECURE_NATIVE_PROGRAM: {
		shouldPass: true,
		expectedVulnerabilities: 0,
		expectedWarnings: [],
		expectedRecommendations: [
			"Consider using Anchor framework for better security patterns",
			"Add comprehensive error messages for better debugging",
		],
	},

	VULNERABLE_NATIVE_PROGRAM: {
		shouldPass: true,
		expectedVulnerabilities: 6,
		vulnerabilityTypes: [
			"missing-owner-validation",
			"missing-signer-validation",
			"missing-writability-check",
			"buffer-overflow",
			"integer-overflow",
			"missing-rent-check",
		],
		expectedSeverity: "critical",
	},

	LARGE_SOLANA_PROGRAM: {
		shouldPass: true,
		expectedVulnerabilities: 0,
		isPerformanceTest: true,
		expectedExecutionTime: 5000, // 5 seconds max
	},

	INVALID_RUST_CODE: {
		shouldPass: false,
		expectedErrors: ["syntax error", "unmatched braces"],
		expectedVulnerabilities: 0,
	},
};
