# Solana Analysis Guide

This guide covers smart contract analysis for Solana programs written in Rust using the Anchor framework.

## Overview

Solana's unique architecture requires specialized analysis approaches:

- **Account Model**: Programs are stateless, data stored in accounts
- **Program Derived Addresses (PDAs)**: Deterministic address generation
- **Compute Units**: Resource consumption measurement
- **Anchor Framework**: Popular development framework with built-in security features

## Contract Upload Requirements

### File Formats

- **Primary**: `.rs` (Rust source files)
- **Configuration**: `Anchor.toml`, `Cargo.toml`
- **IDL**: `.json` (Interface Definition Language files)
- **Tests**: `.ts`, `.js` (TypeScript/JavaScript test files)

### Project Structure

```
my-solana-program/
├── Anchor.toml
├── Cargo.toml
├── programs/
│   └── my-program/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── instructions/
│           │   ├── mod.rs
│           │   ├── initialize.rs
│           │   └── update.rs
│           └── state/
│               ├── mod.rs
│               └── user_account.rs
├── tests/
│   └── my-program.ts
└── target/
    └── idl/
        └── my_program.json
```

### Supported Frameworks

- ✅ **Anchor** (Recommended) - Full support with specialized analysis
- ✅ **Native Solana** - Core Solana program development
- ⚠️ **Seahorse** - Python-based framework (Beta support)

## Solana-Specific Analysis Features

### Account Model Security

- **Account Ownership**: Validates proper account ownership checks
- **Account Initialization**: Ensures accounts are properly initialized
- **Account Closing**: Checks for secure account closure patterns
- **Rent Exemption**: Validates minimum balance requirements

### Program Derived Addresses (PDAs)

- **Seed Security**: Analyzes PDA seed predictability and collision risks
- **Bump Seed Validation**: Ensures canonical bump seeds are used
- **Authority Checks**: Validates PDA authority and signing patterns
- **Cross-Program Invocation**: Analyzes CPI security with PDAs

### Compute Unit Analysis

- **Resource Consumption**: Estimates compute unit usage
- **Optimization Opportunities**: Identifies inefficient operations
- **Stack Usage**: Analyzes stack depth and potential overflows
- **Instruction Limits**: Validates against Solana's instruction limits

### Anchor Framework Security

- **Constraint Validation**: Analyzes Anchor constraint usage
- **Account Validation**: Checks account type safety
- **Signer Verification**: Validates signer requirements
- **Space Allocation**: Analyzes account space calculations

## Common Vulnerability Categories

### 1. Account Security Issues

```rust
// ❌ Vulnerable: Missing owner check
#[derive(Accounts)]
pub struct UpdateData<'info> {
    #[account(mut)]
    pub data_account: Account<'info, DataAccount>,
    pub user: Signer<'info>,
}

// ✅ Secure: Proper owner validation
#[derive(Accounts)]
pub struct UpdateData<'info> {
    #[account(
        mut,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub data_account: Account<'info, DataAccount>,
    pub owner: Signer<'info>,
}
```

### 2. PDA Security Issues

```rust
// ❌ Vulnerable: Predictable PDA seeds
let (pda, _bump) = Pubkey::find_program_address(
    &[user.key().as_ref()], // Predictable
    program_id
);

// ✅ Secure: Unpredictable PDA seeds
let (pda, _bump) = Pubkey::find_program_address(
    &[
        b"user_data",
        user.key().as_ref(),
        &nonce.to_le_bytes() // Additional entropy
    ],
    program_id
);
```

### 3. Compute Unit Issues

```rust
// ❌ Vulnerable: Unbounded loop
for i in 0..user_input {
    // Expensive operation
    perform_calculation();
}

// ✅ Secure: Bounded operations
const MAX_ITERATIONS: usize = 100;
let iterations = std::cmp::min(user_input, MAX_ITERATIONS);
for i in 0..iterations {
    perform_calculation();
}
```

### 4. Integer Overflow/Underflow

```rust
// ❌ Vulnerable: Unchecked arithmetic
pub fn transfer(ctx: Context<Transfer>, amount: u64) -> Result<()> {
    ctx.accounts.from.balance -= amount; // Can underflow
    ctx.accounts.to.balance += amount;   // Can overflow
    Ok(())
}

// ✅ Secure: Checked arithmetic
pub fn transfer(ctx: Context<Transfer>, amount: u64) -> Result<()> {
    ctx.accounts.from.balance = ctx.accounts.from.balance
        .checked_sub(amount)
        .ok_or(ErrorCode::InsufficientFunds)?;

    ctx.accounts.to.balance = ctx.accounts.to.balance
        .checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;

    Ok(())
}
```

## Analysis Configuration

### Basic Configuration

```toml
# Anchor.toml
[features]
seeds = false
skip-lint = false
resolution = true

[programs.localnet]
my_program = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "localnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
```

### Advanced Analysis Settings

```json
{
	"platform": "solana",
	"framework": "anchor",
	"analysisDepth": "comprehensive",
	"enabledChecks": [
		"account-security",
		"pda-validation",
		"compute-units",
		"integer-overflow",
		"anchor-constraints"
	],
	"customRules": [
		{
			"name": "require-canonical-bump",
			"severity": "medium",
			"description": "Ensure canonical bump seeds are used"
		}
	],
	"computeUnitLimit": 200000,
	"stackDepthLimit": 64
}
```

## Best Practices

### Account Management

1. **Always Validate Account Ownership**

   ```rust
   #[account(
       mut,
       has_one = authority @ ErrorCode::Unauthorized
   )]
   pub data_account: Account<'info, DataAccount>,
   ```

2. **Use Proper Account Constraints**

   ```rust
   #[account(
       init,
       payer = user,
       space = 8 + DataAccount::INIT_SPACE,
       seeds = [b"data", user.key().as_ref()],
       bump
   )]
   pub data_account: Account<'info, DataAccount>,
   ```

3. **Implement Secure Account Closing**
   ```rust
   #[account(
       mut,
       close = authority,
       has_one = authority
   )]
   pub data_account: Account<'info, DataAccount>,
   ```

### PDA Security

1. **Use Canonical Bump Seeds**

   ```rust
   #[derive(Accounts)]
   pub struct Initialize<'info> {
       #[account(
           init,
           payer = user,
           space = 8 + DataAccount::INIT_SPACE,
           seeds = [b"data", user.key().as_ref()],
           bump
       )]
       pub data_account: Account<'info, DataAccount>,
   }
   ```

2. **Validate PDA Derivation**
   ```rust
   pub fn validate_pda(
       program_id: &Pubkey,
       seeds: &[&[u8]],
       expected_pda: &Pubkey
   ) -> Result<u8> {
       let (pda, bump) = Pubkey::find_program_address(seeds, program_id);
       require_eq!(pda, *expected_pda, ErrorCode::InvalidPDA);
       Ok(bump)
   }
   ```

### Compute Unit Optimization

1. **Minimize Account Allocations**

   ```rust
   // Use stack allocation when possible
   let mut buffer = [0u8; 32];

   // Avoid heap allocations in hot paths
   // let mut vec = Vec::new(); // Expensive
   ```

2. **Optimize Loops and Iterations**
   ```rust
   // Batch operations when possible
   const BATCH_SIZE: usize = 10;
   for chunk in data.chunks(BATCH_SIZE) {
       process_batch(chunk)?;
   }
   ```

### Error Handling

```rust
#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Invalid PDA")]
    InvalidPDA,
    #[msg("Compute budget exceeded")]
    ComputeBudgetExceeded,
}
```

## Testing Best Practices

### Unit Testing

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MyProgram } from "../target/types/my_program";

describe("my-program", () => {
	const provider = anchor.AnchorProvider.env();
	anchor.setProvider(provider);

	const program = anchor.workspace.MyProgram as Program<MyProgram>;

	it("Initializes user data", async () => {
		const user = anchor.web3.Keypair.generate();

		// Airdrop SOL for testing
		await provider.connection.confirmTransaction(
			await provider.connection.requestAirdrop(
				user.publicKey,
				2 * anchor.web3.LAMPORTS_PER_SOL
			)
		);

		const [userDataPda] = anchor.web3.PublicKey.findProgramAddressSync(
			[Buffer.from("user_data"), user.publicKey.toBuffer()],
			program.programId
		);

		await program.methods
			.initialize()
			.accounts({
				userData: userDataPda,
				user: user.publicKey,
				systemProgram: anchor.web3.SystemProgram.programId,
			})
			.signers([user])
			.rpc();

		const userData = await program.account.userData.fetch(userDataPda);
		assert.equal(userData.authority.toString(), user.publicKey.toString());
	});
});
```

### Security Testing

```typescript
it("Should reject unauthorized access", async () => {
	const attacker = anchor.web3.Keypair.generate();

	try {
		await program.methods
			.updateData(new anchor.BN(100))
			.accounts({
				userData: userDataPda,
				authority: attacker.publicKey, // Wrong authority
			})
			.signers([attacker])
			.rpc();

		assert.fail("Should have thrown unauthorized error");
	} catch (error) {
		assert.include(error.message, "Unauthorized");
	}
});
```

## Performance Optimization

### Compute Unit Optimization

1. **Use Efficient Data Structures**

   ```rust
   // Use fixed-size arrays instead of Vec when possible
   pub struct DataAccount {
       pub data: [u8; 32], // Fixed size
       pub counter: u64,
   }
   ```

2. **Minimize Cross-Program Invocations**
   ```rust
   // Batch multiple operations in single instruction
   pub fn batch_update(
       ctx: Context<BatchUpdate>,
       updates: Vec<UpdateData>
   ) -> Result<()> {
       for update in updates.iter().take(MAX_BATCH_SIZE) {
           process_update(ctx.accounts, update)?;
       }
       Ok(())
   }
   ```

### Memory Optimization

1. **Efficient Account Space Calculation**

   ```rust
   #[account]
   pub struct DataAccount {
       pub authority: Pubkey,    // 32 bytes
       pub data: [u8; 64],      // 64 bytes
       pub timestamp: i64,       // 8 bytes
   }

   impl DataAccount {
       pub const INIT_SPACE: usize = 32 + 64 + 8; // 104 bytes
   }
   ```

## Troubleshooting

### Common Issues

1. **Account Not Found**

   - Verify account initialization
   - Check PDA derivation
   - Ensure proper seeds and bump

2. **Insufficient Compute Units**

   - Optimize loops and operations
   - Increase compute unit limit
   - Split complex operations

3. **PDA Derivation Errors**

   - Validate seed construction
   - Check bump seed usage
   - Verify program ID

4. **Anchor Build Failures**
   - Check Rust version compatibility
   - Verify Anchor version
   - Review dependency conflicts

### Debugging Tips

```rust
// Use msg! for debugging
msg!("Debug: account balance = {}", account.balance);

// Log account keys
msg!("Account key: {}", ctx.accounts.data_account.key());

// Validate assumptions
require!(
    ctx.accounts.user.is_signer,
    ErrorCode::MissingSignature
);
```

## Next Steps

- Explore [Cross-Chain Analysis](../cross-chain-analysis.md) for Solana bridges
- Review [Security Best Practices](../../best-practices/security.md)
- Check [Troubleshooting Guide](../../troubleshooting/platform-specific.md)
- Learn about [Performance Optimization](../../troubleshooting/performance.md)
