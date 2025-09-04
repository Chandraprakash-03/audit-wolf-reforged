# Cross-Chain Analysis Guide

This comprehensive guide covers analyzing bridge contracts, cross-chain protocols, and interoperability solutions using Audit Wolf's multi-blockchain platform.

## Overview

Cross-chain analysis focuses on security assessment of contracts that operate across multiple blockchain networks. This includes:

- **Bridge Contract Security**: Lock-and-mint, burn-and-mint mechanisms
- **State Consistency**: Ensuring consistent state across chains
- **Message Passing**: Cross-chain communication protocols
- **Interoperability Risks**: Multi-chain protocol vulnerabilities

## Supported Cross-Chain Patterns

### 1. Token Bridges

#### Lock-and-Mint Pattern

```solidity
// Ethereum side (Lock)
contract TokenBridge {
    mapping(bytes32 => bool) public processedTransactions;

    function lockTokens(
        address token,
        uint256 amount,
        bytes32 destinationChain,
        address recipient
    ) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        bytes32 txHash = keccak256(abi.encodePacked(
            token, amount, destinationChain, recipient, block.timestamp
        ));

        emit TokensLocked(txHash, token, amount, destinationChain, recipient);
    }
}
```

```rust
// Solana side (Mint)
use anchor_lang::prelude::*;

#[program]
pub mod solana_bridge {
    pub fn mint_tokens(
        ctx: Context<MintTokens>,
        ethereum_tx_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.processed_tx.is_processed, BridgeError::AlreadyProcessed);

        // Verify Ethereum transaction proof
        verify_ethereum_proof(&ethereum_tx_hash, &ctx.accounts.proof)?;

        // Mint tokens
        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
            ),
            amount,
        )?;

        ctx.accounts.processed_tx.is_processed = true;
        Ok(())
    }
}
```

#### Burn-and-Mint Pattern

```solidity
// Source chain (Burn)
function burnTokens(
    address token,
    uint256 amount,
    bytes32 destinationChain,
    address recipient
) external {
    IBurnableToken(token).burnFrom(msg.sender, amount);

    emit TokensBurned(
        keccak256(abi.encodePacked(token, amount, destinationChain, recipient)),
        token,
        amount,
        destinationChain,
        recipient
    );
}
```

### 2. Cross-Chain Governance

```move
// Aptos governance module
module bridge_addr::cross_chain_governance {
    struct Proposal has key, store {
        id: u64,
        target_chain: vector<u8>,
        payload: vector<u8>,
        votes: u64,
        executed: bool,
    }

    public entry fun execute_cross_chain_proposal(
        executor: &signer,
        proposal_id: u64,
        proof: vector<u8>
    ) acquires Proposal {
        let proposal = borrow_global_mut<Proposal>(signer::address_of(executor));
        assert!(!proposal.executed, ALREADY_EXECUTED);
        assert!(verify_cross_chain_proof(proof), INVALID_PROOF);

        // Execute on target chain
        execute_on_target_chain(proposal.target_chain, proposal.payload);
        proposal.executed = true;
    }
}
```

### 3. Cross-Chain DeFi Protocols

```haskell
-- Cardano liquidity bridge validator
{-# LANGUAGE DataKinds #-}

module CrossChainLiquidity where

import Plutus.V2.Ledger.Api

data BridgeAction = Deposit | Withdraw | Sync
data BridgeDatum = BridgeDatum
    { sourceChain :: BuiltinByteString
    , targetChain :: BuiltinByteString
    , amount :: Integer
    , recipient :: PubKeyHash
    , nonce :: Integer
    }

bridgeValidator :: BridgeDatum -> BridgeAction -> ScriptContext -> Bool
bridgeValidator datum action ctx = case action of
    Deposit -> validateDeposit datum ctx
    Withdraw -> validateWithdraw datum ctx
    Sync -> validateSync datum ctx

validateWithdraw :: BridgeDatum -> ScriptContext -> Bool
validateWithdraw datum ctx =
    validSignature && validAmount && validNonce
  where
    txInfo = scriptContextTxInfo ctx
    validSignature = recipient datum `elem` txInfoSignatories txInfo
    validAmount = amount datum > 0
    validNonce = nonce datum > 0
```

## Cross-Chain Analysis Process

### Step 1: Project Setup

1. **Organize Contracts by Chain**:

   ```
   cross-chain-project/
   ├── ethereum/
   │   ├── contracts/
   │   │   ├── EthereumBridge.sol
   │   │   └── TokenLocker.sol
   │   └── config/
   ├── solana/
   │   ├── programs/
   │   │   └── solana-bridge/
   │   └── Anchor.toml
   ├── cardano/
   │   ├── validators/
   │   │   └── BridgeValidator.hs
   │   └── cabal.project
   └── cross-chain-config.yaml
   ```

2. **Cross-Chain Configuration**:

   ```yaml
   # cross-chain-config.yaml
   project_name: "Multi-Chain Bridge"
   chains:
     - name: "ethereum"
       platform: "ethereum"
       contracts: ["ethereum/contracts/"]
       role: "source"
     - name: "solana"
       platform: "solana"
       contracts: ["solana/programs/"]
       role: "destination"
     - name: "cardano"
       platform: "cardano"
       contracts: ["cardano/validators/"]
       role: "destination"

   bridge_config:
     type: "lock_and_mint"
     supported_tokens: ["USDC", "WETH", "WBTC"]
     validators: 7
     threshold: 5

   analysis_options:
     - bridge_security
     - state_consistency
     - message_passing
     - validator_security
     - economic_security
   ```

### Step 2: Upload and Configure

1. **Select Cross-Chain Analysis**: Enable cross-chain analysis option
2. **Upload All Contracts**: Upload contracts for each participating chain
3. **Configure Relationships**: Define how contracts interact across chains
4. **Set Analysis Scope**: Choose specific cross-chain patterns to analyze

### Step 3: Analysis Execution

The platform performs comprehensive cross-chain analysis:

1. **Individual Chain Analysis**: Analyze each contract on its native platform
2. **Cross-Chain Pattern Detection**: Identify bridge patterns and interactions
3. **State Consistency Validation**: Check for potential state inconsistencies
4. **Security Assessment**: Evaluate cross-chain specific vulnerabilities

## Cross-Chain Security Checks

### 1. Bridge Security Assessment

#### Validator Set Security

```typescript
interface ValidatorSetAnalysis {
	totalValidators: number;
	threshold: number;
	decentralization: number; // 0-1 score
	slashingMechanisms: string[];
	keyRotation: boolean;
	risks: ValidatorRisk[];
}

interface ValidatorRisk {
	type: "centralization" | "key_management" | "slashing" | "collusion";
	severity: "low" | "medium" | "high" | "critical";
	description: string;
	recommendation: string;
}
```

#### Message Verification

```solidity
// Secure message verification pattern
contract MessageVerifier {
    struct Message {
        bytes32 sourceChain;
        bytes32 targetChain;
        bytes payload;
        uint256 nonce;
        bytes32 hash;
    }

    mapping(bytes32 => bool) public processedMessages;

    function verifyMessage(
        Message memory message,
        bytes[] memory signatures
    ) public view returns (bool) {
        bytes32 messageHash = keccak256(abi.encode(message));
        require(messageHash == message.hash, "Invalid message hash");

        uint256 validSignatures = 0;
        for (uint i = 0; i < signatures.length; i++) {
            address signer = recoverSigner(messageHash, signatures[i]);
            if (isValidator(signer)) {
                validSignatures++;
            }
        }

        return validSignatures >= threshold;
    }
}
```

### 2. State Consistency Analysis

#### Atomic State Updates

```rust
// Solana atomic state update
#[program]
pub mod atomic_bridge {
    pub fn atomic_swap(
        ctx: Context<AtomicSwap>,
        source_tx_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;

        // Check if source transaction is confirmed
        require!(
            verify_source_transaction(&source_tx_hash, amount)?,
            BridgeError::InvalidSourceTx
        );

        // Perform atomic state update
        let bridge_state = &mut ctx.accounts.bridge_state;
        bridge_state.total_locked += amount;
        bridge_state.last_update = clock.unix_timestamp;

        // Mint tokens atomically
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                &[&[b"mint_authority", &[ctx.bumps.mint_authority]]],
            ),
            amount,
        )?;

        Ok(())
    }
}
```

#### State Synchronization

```haskell
-- Cardano state synchronization validator
validateStateSync :: BridgeDatum -> SyncRedeemer -> ScriptContext -> Bool
validateStateSync datum redeemer ctx =
    validProof && consistentState && validTimestamp
  where
    txInfo = scriptContextTxInfo ctx
    validProof = verifyMerkleProof (syncProof redeemer) (stateRoot datum)
    consistentState = newStateRoot == expectedStateRoot
    validTimestamp = syncTimestamp redeemer > lastSyncTime datum

    newStateRoot = calculateStateRoot (syncData redeemer)
    expectedStateRoot = deriveExpectedRoot (stateRoot datum) (syncData redeemer)
```

### 3. Economic Security Analysis

#### Fee and Incentive Analysis

```typescript
interface EconomicSecurityAnalysis {
	bridgeFees: {
		fixed: number;
		percentage: number;
		gasEstimate: number;
	};
	validatorIncentives: {
		rewardPerValidation: number;
		slashingAmount: number;
		stakingRequirement: number;
	};
	attackCosts: {
		validatorCollusion: number;
		doubleSpending: number;
		frontRunning: number;
	};
	recommendations: EconomicRecommendation[];
}
```

## Common Cross-Chain Vulnerabilities

### Critical Issues

1. **Double Spending Attacks**

   ```solidity
   // Vulnerable - missing replay protection
   function processWithdrawal(
       bytes32 txHash,
       uint256 amount,
       address recipient
   ) external {
       // Missing: require(!processedTransactions[txHash], "Already processed");
       IERC20(token).transfer(recipient, amount);
   }

   // Secure - with replay protection
   function secureProcessWithdrawal(
       bytes32 txHash,
       uint256 amount,
       address recipient
   ) external {
       require(!processedTransactions[txHash], "Already processed");
       require(verifyProof(txHash, amount, recipient), "Invalid proof");

       processedTransactions[txHash] = true;
       IERC20(token).transfer(recipient, amount);
   }
   ```

2. **Validator Collusion**

   - **Risk**: Malicious validators can approve invalid transactions
   - **Detection**: Insufficient validator threshold or centralization
   - **Mitigation**: Increase validator count and implement slashing

3. **State Inconsistency**
   - **Risk**: Different states on different chains
   - **Detection**: Missing state synchronization mechanisms
   - **Mitigation**: Implement atomic state updates and consistency checks

### High Priority Issues

1. **Message Replay Attacks**

   ```rust
   // Vulnerable - no nonce checking
   pub fn process_message(ctx: Context<ProcessMessage>, message: Vec<u8>) -> Result<()> {
       // Process message without checking if already processed
       execute_message(message)?;
       Ok(())
   }

   // Secure - with nonce protection
   pub fn secure_process_message(
       ctx: Context<ProcessMessage>,
       message: Vec<u8>,
       nonce: u64
   ) -> Result<()> {
       require!(nonce > ctx.accounts.bridge_state.last_nonce, BridgeError::InvalidNonce);

       execute_message(message)?;
       ctx.accounts.bridge_state.last_nonce = nonce;
       Ok(())
   }
   ```

2. **Front-Running Attacks**
   - **Risk**: MEV attacks on bridge transactions
   - **Detection**: Predictable transaction ordering
   - **Mitigation**: Implement commit-reveal schemes or private mempools

## Best Practices

### Security Guidelines

1. **Implement Comprehensive Replay Protection**

   ```solidity
   mapping(bytes32 => bool) public processedTransactions;
   mapping(address => uint256) public nonces;

   modifier replayProtection(bytes32 txHash, uint256 nonce) {
       require(!processedTransactions[txHash], "Transaction already processed");
       require(nonce == nonces[msg.sender] + 1, "Invalid nonce");
       _;
       processedTransactions[txHash] = true;
       nonces[msg.sender] = nonce;
   }
   ```

2. **Use Multi-Signature Validation**

   ```rust
   pub fn validate_signatures(
       message_hash: [u8; 32],
       signatures: Vec<Signature>,
       validators: Vec<Pubkey>,
       threshold: u8,
   ) -> Result<bool> {
       let mut valid_signatures = 0;

       for (signature, validator) in signatures.iter().zip(validators.iter()) {
           if signature.verify(&message_hash, validator).is_ok() {
               valid_signatures += 1;
           }
       }

       Ok(valid_signatures >= threshold)
   }
   ```

3. **Implement Time-Based Security**
   ```haskell
   validateTimeBounds :: POSIXTime -> POSIXTime -> ScriptContext -> Bool
   validateTimeBounds minTime maxTime ctx =
       let txRange = txInfoValidRange (scriptContextTxInfo ctx)
       in minTime `before` txRange && txRange `before` maxTime
   ```

### Testing Strategies

1. **Cross-Chain Integration Tests**

   ```typescript
   describe("Cross-Chain Bridge", () => {
   	it("should handle complete bridge flow", async () => {
   		// Lock tokens on Ethereum
   		const lockTx = await ethereumBridge.lockTokens(
   			tokenAddress,
   			amount,
   			"solana",
   			recipientAddress
   		);

   		// Generate proof
   		const proof = await generateMerkleProof(lockTx.hash);

   		// Mint tokens on Solana
   		const mintTx = await solanaBridge.mintTokens(lockTx.hash, amount, proof);

   		expect(mintTx.success).toBe(true);
   	});
   });
   ```

2. **State Consistency Tests**
   ```typescript
   it("should maintain state consistency across chains", async () => {
   	const ethState = await ethereumBridge.getTotalLocked();
   	const solState = await solanaBridge.getTotalMinted();

   	expect(ethState).toEqual(solState);
   });
   ```

## Troubleshooting

### Common Issues

**Issue**: Cross-chain transaction not confirmed

```
Error: Transaction not found on destination chain
```

**Solutions**:

- Check validator signatures and threshold
- Verify message format and encoding
- Ensure sufficient confirmations on source chain

**Issue**: State inconsistency detected

```
Warning: State mismatch between chains detected
```

**Solutions**:

- Implement state synchronization mechanism
- Add consistency checks before processing
- Use atomic operations for state updates

**Issue**: High bridge fees

```
Warning: Bridge transaction costs exceed threshold
```

**Solutions**:

- Optimize gas usage in bridge contracts
- Implement fee estimation and optimization
- Consider layer 2 solutions for high-frequency bridges

## Advanced Features

### Custom Cross-Chain Rules

```yaml
# cross-chain-rules.yaml
custom_rules:
  - name: "require_replay_protection"
    pattern: "processedTransactions|nonces"
    chains: ["ethereum", "bsc", "polygon"]
    severity: "critical"
    message: "All bridge functions must implement replay protection"

  - name: "validator_threshold_check"
    pattern: "threshold.*validators"
    minimum_threshold: 0.67
    severity: "high"
    message: "Validator threshold should be at least 67%"

  - name: "state_consistency_check"
    pattern: "totalLocked|totalMinted"
    cross_chain: true
    severity: "medium"
    message: "State variables should be consistent across chains"
```

### Monitoring and Alerting

```typescript
interface CrossChainMonitoring {
	stateConsistency: {
		lastCheck: Date;
		status: "consistent" | "inconsistent" | "unknown";
		discrepancies: StateDiscrepancy[];
	};
	validatorHealth: {
		activeValidators: number;
		totalValidators: number;
		lastHeartbeat: Date;
	};
	bridgeMetrics: {
		totalVolume: number;
		transactionCount: number;
		averageFee: number;
		successRate: number;
	};
}
```

## Resources

- **Cross-Chain Security Best Practices**: [bridge-security.org](https://bridge-security.org)
- **Interoperability Standards**: [cosmos.network/ibc](https://cosmos.network/ibc)
- **Bridge Security Research**: [l2beat.com/bridges](https://l2beat.com/bridges)
- **Audit Wolf Cross-Chain Examples**: [github.com/audit-wolf/cross-chain-examples](https://github.com/audit-wolf/cross-chain-examples)

---

Need help with cross-chain analysis? [Contact our cross-chain specialists →](https://audit-wolf.com/support/cross-chain)
