/**
 * Test fixtures for Move contracts (Aptos/Sui)
 */

export const MOVE_TEST_CONTRACTS = {
	// Secure Move module with proper patterns
	SECURE_MOVE_MODULE: {
		name: "SecureMoveModule",
		code: `
module 0x1::secure_token {
    use std::signer;
    use std::error;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::account;

    /// Error codes
    const ENOT_AUTHORIZED: u64 = 1;
    const EINSUFFICIENT_BALANCE: u64 = 2;
    const EINVALID_AMOUNT: u64 = 3;

    struct SecureToken has key {
        balance: u64,
        owner: address,
    }

    struct TokenCapability has key {
        mint_cap: coin::MintCapability<SecureToken>,
        burn_cap: coin::BurnCapability<SecureToken>,
    }

    /// Initialize the token with proper capabilities
    public fun initialize(account: &signer) {
        let account_addr = signer::address_of(account);
        
        // Ensure only authorized addresses can initialize
        assert!(account_addr == @0x1, error::permission_denied(ENOT_AUTHORIZED));
        
        let (burn_cap, freeze_cap, mint_cap) = coin::initialize<SecureToken>(
            account,
            b"Secure Token",
            b"SEC",
            8,
            true,
        );

        move_to(account, TokenCapability {
            mint_cap,
            burn_cap,
        });

        // Destroy freeze capability as we don't need it
        coin::destroy_freeze_cap(freeze_cap);
    }

    /// Mint tokens with proper authorization
    public fun mint(account: &signer, to: address, amount: u64): Coin<SecureToken> 
    acquires TokenCapability {
        let account_addr = signer::address_of(account);
        assert!(account_addr == @0x1, error::permission_denied(ENOT_AUTHORIZED));
        assert!(amount > 0, error::invalid_argument(EINVALID_AMOUNT));

        let cap = borrow_global<TokenCapability>(@0x1);
        coin::mint(amount, &cap.mint_cap)
    }

    /// Transfer tokens with balance validation
    public fun transfer(from: &signer, to: address, amount: u64) 
    acquires SecureToken {
        let from_addr = signer::address_of(from);
        assert!(amount > 0, error::invalid_argument(EINVALID_AMOUNT));
        
        // Check if sender has sufficient balance
        if (exists<SecureToken>(from_addr)) {
            let token = borrow_global<SecureToken>(from_addr);
            assert!(token.balance >= amount, error::invalid_state(EINSUFFICIENT_BALANCE));
        } else {
            abort error::not_found(EINSUFFICIENT_BALANCE)
        };

        // Perform the transfer
        let from_token = borrow_global_mut<SecureToken>(from_addr);
        from_token.balance = from_token.balance - amount;

        if (!exists<SecureToken>(to)) {
            move_to(&account::create_signer_with_capability(
                &account::create_test_signer_cap(to)
            ), SecureToken {
                balance: amount,
                owner: to,
            });
        } else {
            let to_token = borrow_global_mut<SecureToken>(to);
            to_token.balance = to_token.balance + amount;
        };
    }

    /// Get balance with proper access control
    public fun balance(addr: address): u64 acquires SecureToken {
        if (exists<SecureToken>(addr)) {
            borrow_global<SecureToken>(addr).balance
        } else {
            0
        }
    }

    #[test_only]
    public fun init_for_test(account: &signer) {
        initialize(account);
    }
}
		`,
		platform: "move",
		language: "move",
		expectedVulnerabilities: 0,
		expectedWarnings: 0,
	},

	// Vulnerable Move module with security issues
	VULNERABLE_MOVE_MODULE: {
		name: "VulnerableMoveModule",
		code: `
module 0x1::vulnerable_token {
    use std::signer;

    struct Token has key {
        balance: u64,
        owner: address,
    }

    /// Initialize without proper authorization - vulnerability
    public fun initialize(account: &signer, initial_balance: u64) {
        let addr = signer::address_of(account);
        // Missing authorization check
        move_to(account, Token {
            balance: initial_balance,
            owner: addr,
        });
    }

    /// Mint without access control - critical vulnerability
    public fun mint(account: &signer, amount: u64) acquires Token {
        let addr = signer::address_of(account);
        // Anyone can mint tokens!
        if (exists<Token>(addr)) {
            let token = borrow_global_mut<Token>(addr);
            token.balance = token.balance + amount; // Potential overflow
        } else {
            move_to(account, Token {
                balance: amount,
                owner: addr,
            });
        };
    }

    /// Transfer without balance check - critical vulnerability
    public fun transfer(from: &signer, to: address, amount: u64) 
    acquires Token {
        let from_addr = signer::address_of(from);
        
        // Missing balance validation
        let from_token = borrow_global_mut<Token>(from_addr);
        from_token.balance = from_token.balance - amount; // Potential underflow
        
        if (!exists<Token>(to)) {
            // Creating account without proper capability - vulnerability
            let to_signer = &account::create_signer_with_capability(
                &account::create_test_signer_cap(to)
            );
            move_to(to_signer, Token {
                balance: amount,
                owner: to,
            });
        } else {
            let to_token = borrow_global_mut<Token>(to);
            to_token.balance = to_token.balance + amount; // Potential overflow
        };
    }

    /// Burn without authorization - vulnerability
    public fun burn(account: &signer, amount: u64) acquires Token {
        let addr = signer::address_of(account);
        // Missing ownership check - anyone can burn anyone's tokens
        let token = borrow_global_mut<Token>(addr);
        token.balance = token.balance - amount; // Potential underflow
    }

    /// Unsafe balance access
    public fun balance(addr: address): u64 acquires Token {
        // Missing existence check - will abort if account doesn't exist
        borrow_global<Token>(addr).balance
    }

    /// Admin function without proper access control
    public fun admin_set_balance(target: address, new_balance: u64) 
    acquires Token {
        // No admin verification - anyone can call this
        let token = borrow_global_mut<Token>(target);
        token.balance = new_balance;
    }
}
		`,
		platform: "move",
		language: "move",
		expectedVulnerabilities: 7,
		expectedSeverity: "critical",
		expectedTypes: [
			"missing-authorization",
			"integer-overflow",
			"integer-underflow",
			"missing-balance-check",
			"unsafe-account-creation",
			"missing-existence-check",
			"missing-admin-control",
		],
	},

	// Sui-specific Move module
	SUI_MOVE_MODULE: {
		name: "SuiMoveModule",
		code: `
module 0x1::sui_nft {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};

    struct NFT has key, store {
        id: UID,
        name: String,
        description: String,
        creator: address,
    }

    struct MintCap has key {
        id: UID,
    }

    /// Initialize with proper capability pattern
    fun init(ctx: &mut TxContext) {
        let mint_cap = MintCap {
            id: object::new(ctx),
        };
        transfer::transfer(mint_cap, tx_context::sender(ctx));
    }

    /// Mint NFT with capability check
    public fun mint_nft(
        _mint_cap: &MintCap,
        name: vector<u8>,
        description: vector<u8>,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let nft = NFT {
            id: object::new(ctx),
            name: string::utf8(name),
            description: string::utf8(description),
            creator: tx_context::sender(ctx),
        };
        transfer::transfer(nft, recipient);
    }

    /// Transfer NFT
    public fun transfer_nft(nft: NFT, recipient: address) {
        transfer::transfer(nft, recipient);
    }

    /// Burn NFT
    public fun burn_nft(nft: NFT) {
        let NFT { id, name: _, description: _, creator: _ } = nft;
        object::delete(id);
    }

    /// Get NFT info
    public fun get_nft_info(nft: &NFT): (String, String, address) {
        (nft.name, nft.description, nft.creator)
    }
}
		`,
		platform: "move",
		language: "move",
		expectedVulnerabilities: 0,
		expectedWarnings: 0,
	},

	// Vulnerable Sui module
	VULNERABLE_SUI_MODULE: {
		name: "VulnerableSuiModule",
		code: `
module 0x1::vulnerable_sui {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    struct Asset has key, store {
        id: UID,
        value: u64,
        owner: address,
    }

    /// Create asset without proper validation - vulnerability
    public fun create_asset(value: u64, ctx: &mut TxContext): Asset {
        // Missing value validation
        Asset {
            id: object::new(ctx),
            value,
            owner: tx_context::sender(ctx),
        }
    }

    /// Transfer without ownership check - critical vulnerability
    public fun unsafe_transfer(asset: Asset, recipient: address) {
        // No ownership validation - anyone can transfer anyone's assets
        transfer::transfer(asset, recipient);
    }

    /// Modify asset value without authorization - vulnerability
    public fun modify_value(asset: &mut Asset, new_value: u64) {
        // Missing ownership check
        asset.value = new_value;
    }

    /// Merge assets without validation - vulnerability
    public fun merge_assets(asset1: Asset, asset2: &mut Asset) {
        let Asset { id, value, owner: _ } = asset1;
        object::delete(id);
        
        // Potential overflow
        asset2.value = asset2.value + value;
    }

    /// Split asset without proper checks - vulnerability
    public fun split_asset(asset: &mut Asset, amount: u64, ctx: &mut TxContext): Asset {
        // Missing balance check - potential underflow
        asset.value = asset.value - amount;
        
        Asset {
            id: object::new(ctx),
            value: amount,
            owner: asset.owner,
        }
    }
}
		`,
		platform: "move",
		language: "move",
		expectedVulnerabilities: 5,
		expectedSeverity: "critical",
		expectedTypes: [
			"missing-value-validation",
			"missing-ownership-check",
			"integer-overflow",
			"integer-underflow",
			"unsafe-asset-manipulation",
		],
	},

	// Complex Move module for performance testing
	LARGE_MOVE_MODULE: {
		name: "LargeMoveModule",
		code: `
module 0x1::large_defi {
    use std::signer;
    use std::vector;
    use aptos_framework::coin::{Self, Coin};

    struct LiquidityPool<phantom X, phantom Y> has key {
        reserve_x: u64,
        reserve_y: u64,
        total_supply: u64,
        fee_rate: u64,
    }

    struct LPToken<phantom X, phantom Y> has key {
        amount: u64,
    }

    ${Array.from(
			{ length: 15 },
			(_, i) => `
    struct Token${i} has key {}
    
    public fun create_pool_${i}<X, Y>(
        account: &signer,
        initial_x: u64,
        initial_y: u64,
    ) {
        let addr = signer::address_of(account);
        let pool = LiquidityPool<X, Y> {
            reserve_x: initial_x,
            reserve_y: initial_y,
            total_supply: initial_x * initial_y / 1000,
            fee_rate: ${i + 1},
        };
        move_to(account, pool);
    }
    
    public fun swap_${i}<X, Y>(
        account: &signer,
        amount_in: u64,
        min_amount_out: u64,
    ) acquires LiquidityPool {
        let addr = signer::address_of(account);
        let pool = borrow_global_mut<LiquidityPool<X, Y>>(addr);
        
        // Complex AMM calculation
        let amount_out = (amount_in * pool.reserve_y * 997) / 
                        (pool.reserve_x * 1000 + amount_in * 997);
        
        assert!(amount_out >= min_amount_out, ${i + 100});
        
        pool.reserve_x = pool.reserve_x + amount_in;
        pool.reserve_y = pool.reserve_y - amount_out;
    }
    `
		).join("\n")}

    public fun batch_operations<X, Y>(
        account: &signer,
        operations: vector<u64>,
    ) acquires LiquidityPool {
        let i = 0;
        let len = vector::length(&operations);
        
        while (i < len && i < 100) { // Limit operations
            let op = *vector::borrow(&operations, i);
            if (op > 0) {
                swap_0<X, Y>(account, op, 1);
            };
            i = i + 1;
        };
    }
}
		`,
		platform: "move",
		language: "move",
		expectedVulnerabilities: 0,
		isLarge: true,
	},

	// Invalid Move code for error testing
	INVALID_MOVE_CODE: {
		name: "InvalidMoveCode",
		code: `
module invalid_module {
    this is not valid move syntax
    missing proper structure
    unmatched braces { { {
    invalid function definitions
    missing use statements
		`,
		platform: "move",
		language: "move",
		shouldFail: true,
		expectedErrors: ["syntax error", "invalid module structure"],
	},
};

export const MOVE_ANALYSIS_EXPECTATIONS = {
	SECURE_MOVE_MODULE: {
		shouldPass: true,
		expectedVulnerabilities: 0,
		expectedWarnings: [],
		expectedRecommendations: [
			"Consider implementing pausable functionality",
			"Add comprehensive event emissions",
		],
	},

	VULNERABLE_MOVE_MODULE: {
		shouldPass: true,
		expectedVulnerabilities: 7,
		vulnerabilityTypes: [
			"missing-authorization",
			"integer-overflow",
			"integer-underflow",
			"missing-balance-check",
			"unsafe-account-creation",
			"missing-existence-check",
			"missing-admin-control",
		],
		expectedSeverity: "critical",
	},

	SUI_MOVE_MODULE: {
		shouldPass: true,
		expectedVulnerabilities: 0,
		expectedWarnings: [],
		expectedRecommendations: [
			"Consider adding metadata validation",
			"Implement royalty mechanisms",
		],
	},

	VULNERABLE_SUI_MODULE: {
		shouldPass: true,
		expectedVulnerabilities: 5,
		vulnerabilityTypes: [
			"missing-value-validation",
			"missing-ownership-check",
			"integer-overflow",
			"integer-underflow",
			"unsafe-asset-manipulation",
		],
		expectedSeverity: "critical",
	},

	LARGE_MOVE_MODULE: {
		shouldPass: true,
		expectedVulnerabilities: 0,
		isPerformanceTest: true,
		expectedExecutionTime: 6000, // 6 seconds max
	},

	INVALID_MOVE_CODE: {
		shouldPass: false,
		expectedErrors: ["syntax error", "invalid module structure"],
		expectedVulnerabilities: 0,
	},
};
