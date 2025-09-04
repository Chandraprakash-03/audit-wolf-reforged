// Test script to verify non-Solidity contracts can be created via API
const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';

// Test contracts for different platforms
const testContracts = [
    {
        name: "Solana Counter",
        sourceCode: `use anchor_lang::prelude::*;

#[program]
pub mod counter {
    use super::*;
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        Ok(())
    }
}

#[account]
pub struct Counter {
    pub count: u64,
}`,
        platform: "solana",
        language: "rust"
    },
    {
        name: "Aptos Counter",
        sourceCode: `module 0x1::counter {
    use std::signer;

    struct Counter has key {
        value: u64,
    }

    public entry fun initialize(account: &signer) {
        let counter = Counter { value: 0 };
        move_to(account, counter);
    }

    public fun get_value(addr: address): u64 acquires Counter {
        borrow_global<Counter>(addr).value
    }
}`,
        platform: "aptos",
        language: "move"
    },
    {
        name: "Sui Counter",
        sourceCode: `module counter::counter {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;

    struct Counter has key {
        id: UID,
        value: u64,
    }

    public entry fun create_counter(ctx: &mut TxContext) {
        let counter = Counter {
            id: object::new(ctx),
            value: 0,
        };
        sui::transfer::share_object(counter);
    }
}`,
        platform: "sui",
        language: "move"
    },
    {
        name: "Cardano Validator",
        sourceCode: `{-# LANGUAGE DataKinds #-}
module Counter where

import Plutus.V2.Ledger.Api
import PlutusTx

data CounterDatum = CounterDatum
    { count :: Integer
    } deriving Show

{-# INLINABLE counterValidator #-}
counterValidator :: CounterDatum -> () -> ScriptContext -> Bool
counterValidator datum _ ctx = True

validator :: Validator
validator = mkValidatorScript $(PlutusTx.compile [|| counterValidator ||])`,
        platform: "cardano",
        language: "haskell"
    }
];

async function testContractValidation() {
    console.log('Testing non-Solidity contract validation...\n');

    for (const contract of testContracts) {
        console.log(`Testing ${contract.platform} (${contract.language}):`);

        try {
            const response = await fetch(`${API_BASE_URL}/api/contracts/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Note: This test assumes no authentication for simplicity
                    // In real usage, you'd need a valid JWT token
                },
                body: JSON.stringify({
                    sourceCode: contract.sourceCode,
                    platform: contract.platform,
                    language: contract.language
                })
            });

            const result = await response.json();

            if (response.ok) {
                console.log(`✅ Validation passed`);
                console.log(`   Valid: ${result.data?.isValid}`);
                if (result.data?.errors?.length > 0) {
                    console.log(`   Errors: ${result.data.errors.join(', ')}`);
                }
            } else {
                console.log(`❌ Validation failed: ${result.error}`);
                if (result.details) {
                    console.log(`   Details: ${result.details.join(', ')}`);
                }
            }
        } catch (error) {
            console.log(`❌ Request failed: ${error.message}`);
        }

        console.log('');
    }
}

// Test if server is running
async function testServerConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
            console.log('✅ Server is running\n');
            return true;
        }
    } catch (error) {
        console.log('❌ Server is not running. Please start the backend server first.\n');
        return false;
    }
    return false;
}

async function main() {
    console.log('Testing Non-Solidity Contract API Support\n');

    const serverRunning = await testServerConnection();
    if (!serverRunning) {
        console.log('Please run: npm start (in the backend directory)');
        return;
    }

    await testContractValidation();

    console.log('Test completed!');
    console.log('If validation passed for non-Solidity contracts, the fix is working.');
}

main().catch(console.error);