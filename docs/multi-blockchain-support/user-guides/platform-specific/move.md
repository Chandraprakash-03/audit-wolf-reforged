# Move-based Blockchain Analysis Guide

This guide covers analyzing Move smart contracts for Aptos and Sui blockchains using Audit Wolf's multi-blockchain platform.

## Overview

Move is a resource-oriented programming language designed for safe and flexible asset management. Our analysis supports:

- **Aptos Move**: Aptos blockchain implementation
- **Sui Move**: Sui blockchain with object-centric model
- **Resource Safety**: Linear type system validation
- **Formal Verification**: Move Prover integration

## Supported Platforms

### Aptos Move

```move
module my_addr::my_module {
    use std::signer;
    use aptos_framework::coin;

    struct MyResource has key {
        value: u64,
    }

    public entry fun create_resource(account: &signer, value: u64) {
        let resource = MyResource { value };
        move_to(account, resource);
    }
}
```

### Sui Move

```move
module my_package::my_module {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;

    struct MyObject has key, store {
        id: UID,
        value: u64,
    }

    public entry fun create_object(value: u64, ctx: &mut TxContext): MyObject {
        MyObject {
            id: object::new(ctx),
            value,
        }
    }
}
```

## Upload Process

### Step 1: Prepare Your Move Project

1. **Project Structure**:

   ```
   my_project/
   ├── Move.toml
   ├── sources/
   │   ├── my_module.move
   │   └── lib.move
   └── tests/
       └── my_module_tests.move
   ```

2. **Move.toml Configuration**:

   ```toml
   [package]
   name = "MyProject"
   version = "1.0.0"

   [dependencies]
   AptosFramework = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-framework", rev = "main" }

   [addresses]
   my_addr = "0x1"
   ```

### Step 2: Platform Selection

1. Select "Aptos" or "Sui" from the blockchain platform dropdown
2. Choose analysis options:
   - **Move Prover**: Formal verification analysis
   - **Resource Safety**: Linear type system validation
   - **Gas Analysis**: Transaction cost optimization
   - **Security Patterns**: Move-specific vulnerability detection

### Step 3: Upload Configuration

```yaml
# move-config.yaml
platform: aptos # or sui
language: move
compiler_version: "1.0"
framework_version: "main"
analysis_options:
  - move_prover
  - resource_safety
  - gas_analysis
  - security_patterns
prover_options:
  - arithmetic_overflow
  - resource_safety
  - functional_correctness
```

## Analysis Features

### Resource Safety Analysis

Move's linear type system ensures resources cannot be duplicated or lost:

#### ✅ Safe Resource Handling

```move
module my_addr::safe_resource {
    struct Coin has key, store {
        value: u64,
    }

    public fun transfer(from: &signer, to: address, amount: u64)
    acquires Coin {
        let from_addr = signer::address_of(from);
        let coin = borrow_global_mut<Coin>(from_addr);
        assert!(coin.value >= amount, 1);

        coin.value = coin.value - amount;

        if (exists<Coin>(to)) {
            let to_coin = borrow_global_mut<Coin>(to);
            to_coin.value = to_coin.value + amount;
        } else {
            move_to(&create_signer(to), Coin { value: amount });
        }
    }
}
```

#### ❌ Unsafe Resource Patterns

```move
// Resource leak - coin is created but not stored
public fun create_and_lose(): Coin {
    Coin { value: 100 } // This will cause a compilation error
}

// Double spending attempt
public fun double_spend(coin: Coin): (Coin, Coin) {
    (coin, coin) // Compilation error - cannot duplicate resource
}
```

### Formal Verification with Move Prover

#### Specification Examples

```move
module my_addr::verified_module {
    spec module {
        pragma verify = true;
    }

    struct Counter has key {
        value: u64,
    }

    public fun increment(account: &signer) acquires Counter {
        let addr = signer::address_of(account);
        let counter = borrow_global_mut<Counter>(addr);
        counter.value = counter.value + 1;
    }

    spec increment {
        let addr = signer::address_of(account);
        requires exists<Counter>(addr);
        ensures global<Counter>(addr).value == old(global<Counter>(addr).value) + 1;
    }
}
```

### Platform-Specific Features

#### Aptos-Specific Analysis

1. **Account Model Validation**

   ```move
   // Proper account resource management
   public entry fun initialize_account(account: &signer) {
       if (!exists<MyResource>(signer::address_of(account))) {
           move_to(account, MyResource { value: 0 });
       }
   }
   ```

2. **Event Emission**

   ```move
   use aptos_framework::event;

   struct TransferEvent has drop, store {
       from: address,
       to: address,
       amount: u64,
   }

   public fun emit_transfer_event(from: address, to: address, amount: u64) {
       event::emit(TransferEvent { from, to, amount });
   }
   ```

#### Sui-Specific Analysis

1. **Object Model Validation**

   ```move
   use sui::object::{Self, UID};
   use sui::transfer;

   struct NFT has key, store {
       id: UID,
       name: vector<u8>,
   }

   public entry fun create_and_transfer(
       name: vector<u8>,
       recipient: address,
       ctx: &mut TxContext
   ) {
       let nft = NFT {
           id: object::new(ctx),
           name,
       };
       transfer::transfer(nft, recipient);
   }
   ```

2. **Dynamic Fields**

   ```move
   use sui::dynamic_field;

   public fun add_dynamic_field<T: store>(
       object: &mut MyObject,
       name: vector<u8>,
       value: T
   ) {
       dynamic_field::add(&mut object.id, name, value);
   }
   ```

## Move-Specific Security Checks

### 1. Resource Leaks

**Detection**: Resources created but not properly stored or consumed

```move
// Vulnerable - resource leak
public fun create_coin(): Coin {
    Coin { value: 100 } // Error: resource must be moved or destroyed
}

// Secure - proper resource handling
public fun create_and_store_coin(account: &signer) {
    let coin = Coin { value: 100 };
    move_to(account, coin);
}
```

### 2. Arithmetic Overflow

**Detection**: Unchecked arithmetic operations

```move
// Vulnerable to overflow
public fun unsafe_add(a: u64, b: u64): u64 {
    a + b // May overflow
}

// Safe arithmetic
public fun safe_add(a: u64, b: u64): u64 {
    assert!(a <= MAX_U64 - b, OVERFLOW_ERROR);
    a + b
}
```

### 3. Access Control Issues

**Detection**: Missing authorization checks

```move
// Vulnerable - missing access control
public fun withdraw(account: &signer, amount: u64) acquires Coin {
    let coin = borrow_global_mut<Coin>(signer::address_of(account));
    coin.value = coin.value - amount;
}

// Secure - proper authorization
public fun authorized_withdraw(
    account: &signer,
    owner: address,
    amount: u64
) acquires Coin {
    assert!(signer::address_of(account) == owner, UNAUTHORIZED);
    let coin = borrow_global_mut<Coin>(owner);
    assert!(coin.value >= amount, INSUFFICIENT_FUNDS);
    coin.value = coin.value - amount;
}
```

### 4. Reentrancy Protection

**Detection**: Potential reentrancy vulnerabilities

```move
// Vulnerable to reentrancy
public fun vulnerable_transfer(
    from: &signer,
    to: address,
    amount: u64
) acquires Coin {
    external_call(to); // External call before state change
    let coin = borrow_global_mut<Coin>(signer::address_of(from));
    coin.value = coin.value - amount;
}

// Reentrancy-safe pattern
public fun safe_transfer(
    from: &signer,
    to: address,
    amount: u64
) acquires Coin {
    let coin = borrow_global_mut<Coin>(signer::address_of(from));
    coin.value = coin.value - amount; // State change first
    external_call(to); // External call after state change
}
```

## Common Vulnerabilities

### Critical Issues

1. **Resource Safety Violations**

   - **Risk**: Resource duplication or loss
   - **Detection**: Compiler errors and static analysis
   - **Fix**: Follow Move's linear type system rules

2. **Arithmetic Overflow/Underflow**

   - **Risk**: Unexpected behavior or exploits
   - **Detection**: Move Prover arithmetic checks
   - **Fix**: Use checked arithmetic operations

3. **Access Control Bypass**
   - **Risk**: Unauthorized resource access
   - **Detection**: Missing capability or signer checks
   - **Fix**: Implement proper authorization patterns

### High Priority Issues

1. **Global Storage Misuse**

   - **Risk**: Resource conflicts or data corruption
   - **Detection**: Improper use of global storage operations
   - **Fix**: Follow proper resource lifecycle patterns

2. **Event Emission Issues**
   - **Risk**: Missing audit trail or incorrect event data
   - **Detection**: Missing or incorrect event emissions
   - **Fix**: Emit appropriate events for all state changes

## Best Practices

### Development Guidelines

1. **Use Specifications for Critical Functions**

   ```move
   spec transfer {
       requires exists<Coin>(signer::address_of(from));
       requires global<Coin>(signer::address_of(from)).value >= amount;
       ensures global<Coin>(signer::address_of(from)).value ==
               old(global<Coin>(signer::address_of(from)).value) - amount;
   }
   ```

2. **Implement Proper Error Handling**

   ```move
   const INSUFFICIENT_FUNDS: u64 = 1;
   const UNAUTHORIZED: u64 = 2;

   public fun safe_operation(account: &signer) {
       assert!(authorized(account), UNAUTHORIZED);
       assert!(sufficient_funds(account), INSUFFICIENT_FUNDS);
       // Perform operation
   }
   ```

3. **Use Resource-Oriented Design**

   ```move
   struct Capability has key, store {
       power: u64,
   }

   public fun use_capability(cap: &Capability): bool {
       cap.power > 0
   }
   ```

### Testing Recommendations

1. **Unit Tests**: Test individual functions with various inputs
2. **Property Tests**: Use Move Prover for formal verification
3. **Integration Tests**: Test complete transaction flows
4. **Gas Analysis**: Optimize for transaction costs

## Troubleshooting

### Common Compilation Issues

**Issue**: Resource safety violations

```
error[E04001]: resource safety violation
```

**Solution**: Ensure all resources are properly consumed or stored

**Issue**: Borrowing conflicts

```
error[E04007]: cannot borrow global resource
```

**Solution**: Avoid simultaneous mutable and immutable borrows

### Move Prover Issues

**Issue**: Specification timeouts

```
timeout: specification verification exceeded time limit
```

**Solution**: Simplify specifications or increase timeout limits

**Issue**: Arithmetic overflow in specifications

```
error: arithmetic overflow in specification
```

**Solution**: Add appropriate preconditions to prevent overflow

## Integration Examples

### CI/CD Integration

```yaml
# .github/workflows/move-audit.yml
name: Move Security Audit
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install Move CLI
        run: |
          curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3
      - name: Run Move Prover
        run: |
          aptos move prove --package-dir .
      - name: Run Audit Wolf Analysis
        run: |
          curl -X POST "https://api.audit-wolf.com/v1/audits" \
            -H "Authorization: Bearer ${{ secrets.AUDIT_WOLF_API_KEY }}" \
            -F "platform=aptos" \
            -F "files=@./sources/"
```

### Local Development

```bash
# Install Aptos CLI
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3

# Initialize Move project
aptos move init --name my_project

# Compile and test
aptos move compile
aptos move test

# Run formal verification
aptos move prove

# Run Audit Wolf analysis
audit-wolf analyze --platform aptos --files sources/
```

## Advanced Features

### Custom Verification Rules

```move
spec module {
    // Global invariant
    invariant forall addr: address where exists<Coin>(addr):
        global<Coin>(addr).value <= MAX_COIN_VALUE;

    // Function specification
    spec transfer {
        pragma verify = true;
        pragma timeout = 60;

        requires exists<Coin>(from_addr);
        requires global<Coin>(from_addr).value >= amount;

        ensures global<Coin>(from_addr).value ==
                old(global<Coin>(from_addr).value) - amount;
    }
}
```

### Gas Optimization Patterns

```move
// Efficient batch operations
public fun batch_transfer(
    from: &signer,
    recipients: vector<address>,
    amounts: vector<u64>
) acquires Coin {
    let len = vector::length(&recipients);
    assert!(len == vector::length(&amounts), INVALID_INPUT);

    let i = 0;
    while (i < len) {
        let to = *vector::borrow(&recipients, i);
        let amount = *vector::borrow(&amounts, i);
        transfer_internal(from, to, amount);
        i = i + 1;
    }
}
```

## Resources

- **Move Language Documentation**: [move-language.github.io](https://move-language.github.io)
- **Aptos Developer Documentation**: [aptos.dev](https://aptos.dev)
- **Sui Developer Documentation**: [docs.sui.io](https://docs.sui.io)
- **Move Prover Guide**: [github.com/move-language/move/tree/main/language/move-prover](https://github.com/move-language/move/tree/main/language/move-prover)
- **Audit Wolf Move Examples**: [github.com/audit-wolf/move-examples](https://github.com/audit-wolf/move-examples)

---

Need help with Move analysis? [Contact our Move specialists →](https://audit-wolf.com/support/move)
