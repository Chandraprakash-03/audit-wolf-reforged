# Cardano Smart Contract Analysis Guide

This guide covers analyzing Plutus smart contracts and Cardano-specific security patterns using Audit Wolf's multi-blockchain platform.

## Overview

Cardano uses the Plutus smart contract platform, which is based on Haskell and provides formal verification capabilities. Our analysis covers:

- **Plutus Script Validation**: Static analysis of Plutus Core scripts
- **UTXO Model Security**: Validation of extended UTXO (eUTXO) handling
- **Datum and Redeemer Analysis**: Security assessment of script parameters
- **Resource Optimization**: Script size and execution cost analysis

## Supported Contract Types

### Plutus Validators

```haskell
{-# LANGUAGE DataKinds #-}
{-# LANGUAGE TemplateHaskell #-}

module MyValidator where

import Plutus.V2.Ledger.Api
import Plutus.V2.Ledger.Contexts

-- Example validator
myValidator :: BuiltinData -> BuiltinData -> BuiltinData -> ()
myValidator datum redeemer context =
    if validCondition then () else traceError "Validation failed"
  where
    validCondition = -- validation logic
```

### Native Scripts

```json
{
	"type": "all",
	"scripts": [
		{
			"type": "sig",
			"keyHash": "e09d36c79dec9bd1b3d9e152247701cd0bb860b5ebfd1de8abb6735a"
		},
		{
			"type": "after",
			"slot": 3000
		}
	]
}
```

## Upload Process

### Step 1: Prepare Your Contracts

1. **Plutus Scripts**: Upload `.hs` files containing your validators
2. **Native Scripts**: Upload `.json` files with script definitions
3. **Project Structure**: Include all dependencies and imports
4. **Cabal Files**: Include `cabal.project` and `.cabal` files for dependencies

### Step 2: Platform Selection

1. Select "Cardano" from the blockchain platform dropdown
2. Choose analysis options:
   - **Plutus Static Analysis**: Haskell type checking and validation
   - **UTXO Model Validation**: eUTXO handling security checks
   - **Script Efficiency Analysis**: Resource usage optimization
   - **Formal Verification**: Mathematical proof validation (when available)

### Step 3: Upload Configuration

```yaml
# cardano-config.yaml
platform: cardano
language: plutus
compiler_version: "8.10.7"
plutus_version: "1.0.0"
dependencies:
  - plutus-core
  - plutus-ledger-api
  - plutus-tx
analysis_options:
  - utxo_validation
  - datum_analysis
  - script_efficiency
  - formal_verification
```

## Analysis Features

### UTXO Model Security

Our analysis validates proper eUTXO handling:

#### ✅ Secure UTXO Handling

```haskell
-- Proper UTXO consumption validation
validateUTXOConsumption :: TxInfo -> Bool
validateUTXOConsumption txInfo =
    let inputs = txInfoInputs txInfo
        outputs = txInfoOutputs txInfo
    in validateInputs inputs && validateOutputs outputs
```

#### ❌ Insecure UTXO Handling

```haskell
-- Missing UTXO validation
unsafeValidator :: BuiltinData -> BuiltinData -> BuiltinData -> ()
unsafeValidator _ _ _ = () -- Always validates without checks
```

### Datum and Redeemer Analysis

#### Secure Datum Validation

```haskell
data MyDatum = MyDatum
    { owner :: PubKeyHash
    , amount :: Integer
    , deadline :: POSIXTime
    } deriving (Show, Eq)

validateDatum :: MyDatum -> TxInfo -> Bool
validateDatum datum txInfo =
    validOwner && validAmount && validDeadline
  where
    validOwner = owner datum `elem` map pubKeyHash (txInfoSignatories txInfo)
    validAmount = amount datum > 0
    validDeadline = deadline datum > txInfoValidRange txInfo
```

#### Common Datum Issues

- **Missing Validation**: Not validating datum fields
- **Type Confusion**: Incorrect datum deserialization
- **State Inconsistency**: Datum not matching actual UTXO state

### Script Efficiency Analysis

#### Resource Optimization

```haskell
-- Efficient script structure
efficientValidator :: MyDatum -> MyRedeemer -> ScriptContext -> Bool
efficientValidator datum redeemer ctx =
    case redeemer of
        Spend -> validateSpend datum ctx
        Mint -> validateMint datum ctx
        _ -> False
  where
    validateSpend = -- optimized validation logic
    validateMint = -- optimized minting logic
```

#### Performance Metrics

- **Script Size**: Plutus Core script size in bytes
- **Execution Units**: CPU and memory usage estimation
- **Optimization Suggestions**: Code improvements for efficiency

## Cardano-Specific Security Checks

### 1. Double Satisfaction Attacks

```haskell
-- Vulnerable to double satisfaction
vulnerableValidator :: BuiltinData -> BuiltinData -> BuiltinData -> ()
vulnerableValidator _ _ _ =
    if someCondition
    then ()
    else traceError "Failed"
  where
    someCondition = True -- Always true, vulnerable
```

**Detection**: Our analysis identifies validators that don't properly validate script context.

### 2. Script Context Validation

```haskell
-- Proper script context validation
secureValidator :: MyDatum -> MyRedeemer -> ScriptContext -> Bool
secureValidator datum redeemer (ScriptContext txInfo purpose) =
    case purpose of
        Spending outRef -> validateSpending outRef txInfo datum redeemer
        Minting cs -> validateMinting cs txInfo datum redeemer
        _ -> False
```

### 3. Time Range Validation

```haskell
-- Secure time range handling
validateTimeRange :: POSIXTimeRange -> TxInfo -> Bool
validateTimeRange requiredRange txInfo =
    let txRange = txInfoValidRange txInfo
    in requiredRange `contains` txRange
```

### 4. Value Preservation

```haskell
-- Ensure value is properly preserved
validateValuePreservation :: [TxOut] -> [TxOut] -> Value -> Bool
validateValuePreservation inputs outputs expectedValue =
    let inputValue = foldMap txOutValue inputs
        outputValue = foldMap txOutValue outputs
    in inputValue == outputValue <> expectedValue
```

## Common Vulnerabilities

### Critical Issues

1. **Missing Script Context Validation**

   - **Risk**: Allows unauthorized script execution
   - **Detection**: Validators that don't check `ScriptContext`
   - **Fix**: Always validate script purpose and transaction info

2. **Improper UTXO Handling**

   - **Risk**: Double spending or value loss
   - **Detection**: Missing input/output validation
   - **Fix**: Implement comprehensive UTXO validation

3. **Datum Manipulation**
   - **Risk**: State corruption or unauthorized access
   - **Detection**: Insufficient datum validation
   - **Fix**: Validate all datum fields and state transitions

### High Priority Issues

1. **Time Range Vulnerabilities**

   - **Risk**: Transaction replay or timing attacks
   - **Detection**: Missing or improper time validation
   - **Fix**: Implement proper time range checks

2. **Value Calculation Errors**
   - **Risk**: Incorrect token amounts or loss of funds
   - **Detection**: Arithmetic errors in value calculations
   - **Fix**: Use safe arithmetic and validate all calculations

## Best Practices

### Development Guidelines

1. **Always Validate Script Context**

   ```haskell
   validator datum redeemer ctx@(ScriptContext txInfo purpose) =
       validatePurpose purpose && validateTransaction txInfo
   ```

2. **Implement Comprehensive Datum Validation**

   ```haskell
   validateDatum :: MyDatum -> Bool
   validateDatum datum =
       validField1 && validField2 && validField3
     where
       validField1 = -- validation logic
   ```

3. **Use Type-Safe Patterns**

   ```haskell
   data Action = Deposit | Withdraw | Transfer

   handleAction :: Action -> Datum -> Context -> Bool
   handleAction Deposit = validateDeposit
   handleAction Withdraw = validateWithdraw
   handleAction Transfer = validateTransfer
   ```

### Testing Recommendations

1. **Unit Tests**: Test individual validator functions
2. **Property Tests**: Use QuickCheck for property-based testing
3. **Integration Tests**: Test complete transaction scenarios
4. **Formal Verification**: Use mathematical proofs when possible

## Troubleshooting

### Common Upload Issues

**Issue**: Compilation errors during analysis

```
Error: Could not find module 'Plutus.V2.Ledger.Api'
```

**Solution**: Ensure all Plutus dependencies are included in your project

**Issue**: Type checking failures

```
Error: Couldn't match expected type 'BuiltinData' with actual type 'MyDatum'
```

**Solution**: Use proper serialization with `PlutusTx.toBuiltinData`

### Analysis Issues

**Issue**: "Script too large" warnings
**Solution**: Optimize script size by:

- Removing unused imports
- Simplifying validation logic
- Using more efficient data structures

**Issue**: High execution unit costs
**Solution**: Optimize performance by:

- Reducing computational complexity
- Using efficient algorithms
- Minimizing memory allocations

## Integration Examples

### CI/CD Integration

```yaml
# .github/workflows/cardano-audit.yml
name: Cardano Security Audit
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Audit Wolf Analysis
        run: |
          curl -X POST "https://api.audit-wolf.com/v1/audits" \
            -H "Authorization: Bearer ${{ secrets.AUDIT_WOLF_API_KEY }}" \
            -F "platform=cardano" \
            -F "files=@./src/MyValidator.hs"
```

### Local Development

```bash
# Install Cardano development tools
curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | sh
ghcup install ghc 8.10.7
ghcup install cabal 3.6.2.0

# Build your project
cabal build

# Run Audit Wolf analysis
audit-wolf analyze --platform cardano --files src/
```

## Advanced Features

### Custom Security Rules

```yaml
# cardano-rules.yaml
custom_rules:
  - name: "require_signature_validation"
    pattern: "txInfoSignatories"
    severity: "high"
    message: "Always validate required signatures"

  - name: "time_range_validation"
    pattern: "txInfoValidRange"
    severity: "medium"
    message: "Validate transaction time ranges"
```

### Formal Verification Integration

```haskell
-- Specification for formal verification
{-@ validateTransfer ::
    datum:MyDatum ->
    redeemer:TransferRedeemer ->
    ctx:ScriptContext ->
    {v:Bool | v => validTransfer datum redeemer ctx} @-}
validateTransfer :: MyDatum -> TransferRedeemer -> ScriptContext -> Bool
```

## Resources

- **Plutus Documentation**: [plutus.readthedocs.io](https://plutus.readthedocs.io)
- **Cardano Developer Portal**: [developers.cardano.org](https://developers.cardano.org)
- **Plutus Pioneer Program**: [github.com/input-output-hk/plutus-pioneer-program](https://github.com/input-output-hk/plutus-pioneer-program)
- **Audit Wolf Cardano Examples**: [github.com/audit-wolf/cardano-examples](https://github.com/audit-wolf/cardano-examples)

---

Need help with Cardano analysis? [Contact our Cardano specialists →](https://audit-wolf.com/support/cardano)
