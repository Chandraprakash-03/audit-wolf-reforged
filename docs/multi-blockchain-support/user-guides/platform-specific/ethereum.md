# Ethereum & EVM Chains Analysis Guide

This guide covers smart contract analysis for Ethereum and EVM-compatible chains including BSC, Polygon, Avalanche, Arbitrum, and Optimism.

## Supported Platforms

| Platform  | Network ID | Special Considerations                    |
| --------- | ---------- | ----------------------------------------- |
| Ethereum  | ethereum   | Gas optimization, MEV protection          |
| BSC       | bsc        | BEP token standards, centralization risks |
| Polygon   | polygon    | Layer 2 patterns, bridge security         |
| Avalanche | avalanche  | Subnet architecture, cross-chain          |
| Arbitrum  | arbitrum   | Rollup-specific patterns                  |
| Optimism  | optimism   | Optimistic rollup considerations          |

## Contract Upload Requirements

### File Formats

- **Primary**: `.sol` (Solidity source files)
- **Metadata**: `.json` (ABI and metadata files)
- **Configuration**: `hardhat.config.js`, `truffle-config.js`, `foundry.toml`

### Supported Solidity Versions

- ✅ 0.8.x (Recommended)
- ✅ 0.7.x (Supported)
- ⚠️ 0.6.x (Legacy support)
- ❌ <0.6.0 (Not recommended)

### Project Structure Examples

#### Hardhat Project

```
contracts/
├── MyToken.sol
├── MyNFT.sol
├── interfaces/
│   └── IERC20Extended.sol
└── libraries/
    └── SafeMath.sol
hardhat.config.js
package.json
```

#### Foundry Project

```
src/
├── MyContract.sol
├── interfaces/
└── libraries/
test/
├── MyContract.t.sol
foundry.toml
```

## Platform-Specific Analysis Features

### Ethereum Mainnet

- **Gas Optimization**: Detailed gas usage analysis and optimization suggestions
- **MEV Protection**: Front-running and sandwich attack vulnerability detection
- **EIP Compliance**: Checks for ERC standards compliance (ERC-20, ERC-721, ERC-1155)
- **Upgrade Patterns**: Proxy contract security analysis

### BSC (Binance Smart Chain)

- **BEP Standards**: BEP-20, BEP-721, BEP-1155 compliance checking
- **Centralization Risks**: Analysis of validator centralization impacts
- **Cross-Chain Bridges**: Security assessment for BSC bridge interactions
- **Gas Token Analysis**: BNB-specific gas optimization

### Polygon

- **Layer 2 Patterns**: Polygon-specific scaling solution analysis
- **Checkpoint Security**: Validation of checkpoint mechanism interactions
- **Bridge Security**: Polygon PoS bridge vulnerability assessment
- **MATIC Token**: Native token handling best practices

### Arbitrum

- **Rollup Patterns**: Optimistic rollup specific security considerations
- **L1/L2 Communication**: Cross-layer message passing security
- **Sequencer Risks**: Centralized sequencer dependency analysis
- **Gas Estimation**: Arbitrum-specific gas calculation accuracy

### Optimism

- **Optimistic Rollup**: Fraud proof mechanism considerations
- **Withdrawal Delays**: Security implications of withdrawal periods
- **L1/L2 Messaging**: Cross-layer communication security
- **Bedrock Upgrade**: Post-Bedrock security improvements

## Common Vulnerability Categories

### EVM-Specific Vulnerabilities

1. **Reentrancy Attacks**

   - Classic reentrancy
   - Cross-function reentrancy
   - Read-only reentrancy

2. **Integer Overflow/Underflow**

   - Arithmetic operations without SafeMath (pre-0.8.0)
   - Unchecked blocks misuse

3. **Access Control Issues**

   - Missing access modifiers
   - Incorrect role-based access control
   - Front-running of privileged functions

4. **Gas-Related Issues**
   - Gas limit DoS attacks
   - Expensive operations in loops
   - Inefficient storage patterns

### Platform-Specific Risks

#### BSC-Specific

- **Validator Centralization**: Risks from limited validator set
- **Fast Finality**: Security trade-offs of faster block times
- **Bridge Exploits**: Historical BSC bridge vulnerabilities

#### Layer 2 Specific (Polygon, Arbitrum, Optimism)

- **Bridge Security**: Cross-layer asset transfer risks
- **Sequencer Downtime**: Centralized sequencer failure scenarios
- **Data Availability**: Ensuring transaction data accessibility
- **Exit Mechanisms**: Secure withdrawal from L2 to L1

## Analysis Configuration

### Basic Configuration

```json
{
	"platform": "ethereum",
	"solcVersion": "0.8.19",
	"optimizationRuns": 200,
	"evmVersion": "london"
}
```

### Advanced Configuration

```json
{
	"platform": "polygon",
	"analysisDepth": "comprehensive",
	"enabledChecks": [
		"reentrancy",
		"access-control",
		"gas-optimization",
		"bridge-security"
	],
	"customRules": [
		{
			"name": "polygon-bridge-validation",
			"severity": "high",
			"pattern": "rootChainManager"
		}
	],
	"compilerSettings": {
		"optimizer": {
			"enabled": true,
			"runs": 200
		},
		"viaIR": false
	}
}
```

## Best Practices by Platform

### Ethereum Mainnet

- **Gas Optimization**: Critical due to high gas costs
- **Security First**: Prioritize security over gas savings
- **Upgrade Patterns**: Use proven proxy patterns (OpenZeppelin)
- **Testing**: Comprehensive mainnet fork testing

### BSC

- **Validator Awareness**: Consider validator centralization in design
- **Bridge Security**: Extra caution with cross-chain functionality
- **Gas Efficiency**: Optimize for BNB gas costs
- **Compliance**: Consider regulatory implications

### Polygon

- **Checkpoint Delays**: Account for checkpoint finality times
- **Bridge Limits**: Understand deposit/withdrawal limits
- **Gas Token**: Optimize for MATIC gas payments
- **State Sync**: Proper state synchronization patterns

### Layer 2 Solutions

- **Exit Strategies**: Always implement secure L2 exit mechanisms
- **Data Availability**: Ensure critical data is available on L1
- **Sequencer Dependency**: Plan for sequencer downtime scenarios
- **Cost Analysis**: Compare L2 costs vs. security trade-offs

## Code Examples

### Secure ERC-20 Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SecureToken is ERC20, Ownable, ReentrancyGuard {
    uint256 public constant MAX_SUPPLY = 1000000 * 10**18;

    constructor() ERC20("SecureToken", "SECURE") {}

    function mint(address to, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        require(
            totalSupply() + amount <= MAX_SUPPLY,
            "Exceeds max supply"
        );
        _mint(to, amount);
    }
}
```

### Cross-Chain Bridge Security Pattern

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SecureBridge {
    mapping(bytes32 => bool) public processedTransactions;
    uint256 public constant MIN_CONFIRMATIONS = 12;

    modifier onlyProcessedOnce(bytes32 txHash) {
        require(!processedTransactions[txHash], "Already processed");
        processedTransactions[txHash] = true;
        _;
    }

    function processDeposit(
        bytes32 txHash,
        address recipient,
        uint256 amount,
        uint256 blockNumber
    ) external onlyProcessedOnce(txHash) {
        require(
            block.number >= blockNumber + MIN_CONFIRMATIONS,
            "Insufficient confirmations"
        );
        // Process deposit logic
    }
}
```

## Troubleshooting

### Common Upload Issues

1. **Compilation Errors**

   - Check Solidity version compatibility
   - Verify import paths
   - Ensure all dependencies are included

2. **Large Contract Size**

   - Enable optimizer in compiler settings
   - Consider contract splitting
   - Remove unused code and imports

3. **Network-Specific Issues**
   - Verify correct network configuration
   - Check for network-specific opcodes
   - Validate gas limit requirements

### Analysis Issues

1. **False Positives**

   - Review context-specific security patterns
   - Check for platform-specific safe patterns
   - Validate with manual code review

2. **Missing Vulnerabilities**
   - Ensure comprehensive analysis depth
   - Enable all relevant security checks
   - Consider custom rule configuration

## Performance Optimization

### Gas Optimization Tips

1. **Storage Optimization**

   - Pack structs efficiently
   - Use appropriate data types
   - Minimize storage operations

2. **Function Optimization**

   - Use `external` vs `public` appropriately
   - Implement efficient loops
   - Cache storage variables

3. **Deployment Optimization**
   - Enable compiler optimization
   - Remove unused code
   - Use libraries for common functions

## Next Steps

- Explore [Cross-Chain Analysis](../cross-chain-analysis.md) for bridge contracts
- Review [Security Best Practices](../../best-practices/security.md)
- Check [Troubleshooting Guide](../../troubleshooting/platform-specific.md) for issues
- Learn about [Comparative Analysis](../comparative-analysis.md) across platforms
