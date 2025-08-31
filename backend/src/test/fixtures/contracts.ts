/**
 * Test contract fixtures for comprehensive testing
 */

export const TEST_CONTRACTS = {
	// Simple valid contract
	SIMPLE_TOKEN: {
		name: "SimpleToken",
		sourceCode: `
      pragma solidity ^0.8.0;
      
      contract SimpleToken {
          string public name = "Simple Token";
          string public symbol = "SIM";
          uint256 public totalSupply = 1000000;
          
          mapping(address => uint256) public balances;
          
          constructor() {
              balances[msg.sender] = totalSupply;
          }
          
          function transfer(address to, uint256 amount) public returns (bool) {
              require(balances[msg.sender] >= amount, "Insufficient balance");
              balances[msg.sender] -= amount;
              balances[to] += amount;
              return true;
          }
      }
    `,
		compilerVersion: "0.8.19",
		expectedVulnerabilities: 0,
		expectedGasOptimizations: 2,
	},

	// Contract with reentrancy vulnerability
	VULNERABLE_BANK: {
		name: "VulnerableBank",
		sourceCode: `
      pragma solidity ^0.8.0;
      
      contract VulnerableBank {
          mapping(address => uint256) public balances;
          
          function deposit() public payable {
              balances[msg.sender] += msg.value;
          }
          
          function withdraw() public {
              uint256 balance = balances[msg.sender];
              require(balance > 0, "No balance to withdraw");
              
              // Vulnerable to reentrancy attack
              (bool success, ) = msg.sender.call{value: balance}("");
              require(success, "Transfer failed");
              
              balances[msg.sender] = 0;
          }
          
          function getBalance() public view returns (uint256) {
              return balances[msg.sender];
          }
      }
    `,
		compilerVersion: "0.8.19",
		expectedVulnerabilities: 1,
		expectedSeverity: "critical",
		expectedTypes: ["reentrancy"],
	},

	// Contract with access control issues
	INSECURE_OWNERSHIP: {
		name: "InsecureOwnership",
		sourceCode: `
      pragma solidity ^0.8.0;
      
      contract InsecureOwnership {
          address public owner;
          uint256 public totalSupply = 1000000;
          mapping(address => uint256) public balances;
          
          constructor() {
              owner = msg.sender;
              balances[msg.sender] = totalSupply;
          }
          
          // Missing access control - anyone can change owner!
          function changeOwner(address newOwner) public {
              owner = newOwner;
          }
          
          // Missing access control - anyone can mint tokens!
          function mint(address to, uint256 amount) public {
              balances[to] += amount;
              totalSupply += amount;
          }
          
          // Proper access control example
          function burn(uint256 amount) public {
              require(msg.sender == owner, "Only owner can burn");
              require(balances[owner] >= amount, "Insufficient balance");
              balances[owner] -= amount;
              totalSupply -= amount;
          }
      }
    `,
		compilerVersion: "0.8.19",
		expectedVulnerabilities: 2,
		expectedSeverity: "high",
		expectedTypes: ["access_control"],
	},

	// Contract with gas optimization opportunities
	GAS_INEFFICIENT: {
		name: "GasInefficient",
		sourceCode: `
      pragma solidity ^0.8.0;
      
      contract GasInefficient {
          uint256[] public data;
          mapping(address => bool) public authorized;
          
          // Inefficient loop - should use unchecked increment
          function inefficientLoop() public {
              for (uint256 i = 0; i < 100; i++) {
                  data.push(i);
              }
          }
          
          // Inefficient storage access - should cache array length
          function inefficientArrayAccess() public view returns (uint256 sum) {
              for (uint256 i = 0; i < data.length; i++) {
                  sum += data[i];
              }
          }
          
          // Inefficient string comparison
          function inefficientStringComparison(string memory input) public pure returns (bool) {
              return keccak256(bytes(input)) == keccak256(bytes("admin"));
          }
          
          // Multiple storage writes that could be batched
          function multipleStorageWrites(address user) public {
              authorized[user] = true;
              data.push(1);
              data.push(2);
              data.push(3);
          }
      }
    `,
		compilerVersion: "0.8.19",
		expectedVulnerabilities: 0,
		expectedGasOptimizations: 4,
	},

	// Complex contract with multiple issues
	COMPLEX_VULNERABLE: {
		name: "ComplexVulnerable",
		sourceCode: `
      pragma solidity ^0.8.0;
      
      contract ComplexVulnerable {
          address public owner;
          mapping(address => uint256) public balances;
          mapping(address => bool) public authorized;
          uint256[] public data;
          
          event Transfer(address indexed from, address indexed to, uint256 value);
          
          constructor() {
              owner = msg.sender;
              authorized[msg.sender] = true;
          }
          
          // Reentrancy vulnerability
          function withdraw() public {
              uint256 balance = balances[msg.sender];
              require(balance > 0, "No balance");
              
              (bool success, ) = msg.sender.call{value: balance}("");
              require(success, "Transfer failed");
              
              balances[msg.sender] = 0;
              emit Transfer(address(this), msg.sender, balance);
          }
          
          // Access control vulnerability
          function setAuthorized(address user, bool status) public {
              // Missing owner check
              authorized[user] = status;
          }
          
          // Integer overflow potential (though Solidity 0.8+ has built-in protection)
          function unsafeAdd(uint256 a, uint256 b) public pure returns (uint256) {
              // This would be vulnerable in older Solidity versions
              return a + b;
          }
          
          // Gas inefficient loop
          function processData() public {
              for (uint256 i = 0; i < data.length; i++) {
                  if (data[i] > 100) {
                      data[i] = data[i] * 2;
                  }
              }
          }
          
          // Unchecked external call
          function externalCall(address target, bytes calldata payload) public {
              // Missing access control and return value check
              target.call(payload);
          }
          
          // Timestamp dependence
          function timeBasedFunction() public view returns (bool) {
              return block.timestamp % 2 == 0;
          }
          
          receive() external payable {
              balances[msg.sender] += msg.value;
          }
      }
    `,
		compilerVersion: "0.8.19",
		expectedVulnerabilities: 5,
		expectedSeverity: "critical",
		expectedTypes: [
			"reentrancy",
			"access_control",
			"unchecked_call",
			"timestamp_dependence",
		],
	},

	// Invalid Solidity code for testing validation
	INVALID_SYNTAX: {
		name: "InvalidContract",
		sourceCode: `
      this is not valid solidity code
      missing pragma and contract declaration
      invalid syntax everywhere
    `,
		compilerVersion: "0.8.19",
		shouldFail: true,
		expectedErrors: ["syntax error", "missing pragma"],
	},

	// Empty contract
	EMPTY_CONTRACT: {
		name: "EmptyContract",
		sourceCode: `
      pragma solidity ^0.8.0;
      
      contract EmptyContract {
          // This contract does nothing
      }
    `,
		compilerVersion: "0.8.19",
		expectedVulnerabilities: 0,
		expectedGasOptimizations: 0,
	},

	// Large contract for performance testing
	LARGE_CONTRACT: {
		name: "LargeContract",
		sourceCode: `
      pragma solidity ^0.8.0;
      
      contract LargeContract {
          mapping(address => uint256) public balances;
          mapping(address => mapping(address => uint256)) public allowances;
          
          ${Array.from(
						{ length: 50 },
						(_, i) => `
          function function${i}() public pure returns (uint256) {
              return ${i} * 1000;
          }
          `
					).join("\n")}
          
          ${Array.from(
						{ length: 20 },
						(_, i) => `
          uint256 public variable${i} = ${i};
          `
					).join("\n")}
      }
    `,
		compilerVersion: "0.8.19",
		expectedVulnerabilities: 0,
		isLarge: true,
	},
};

export const TEST_USERS = {
	ADMIN: {
		email: "admin@auditwolf.com",
		password: "admin123",
		name: "Admin User",
		subscription_tier: "enterprise" as const,
		api_credits: 1000,
	},

	PRO_USER: {
		email: "pro@auditwolf.com",
		password: "pro123",
		name: "Pro User",
		subscription_tier: "pro" as const,
		api_credits: 100,
	},

	FREE_USER: {
		email: "free@auditwolf.com",
		password: "free123",
		name: "Free User",
		subscription_tier: "free" as const,
		api_credits: 10,
	},

	TEST_USER: {
		email: "test@auditwolf.com",
		password: "test123",
		name: "Test User",
		subscription_tier: "free" as const,
		api_credits: 5,
	},
};

export const EXPECTED_ANALYSIS_RESULTS = {
	[TEST_CONTRACTS.VULNERABLE_BANK.name]: {
		vulnerabilities: [
			{
				type: "reentrancy",
				severity: "critical",
				title: "Reentrancy Attack Vulnerability",
				location: { function: "withdraw", line: 11 },
			},
		],
		gasOptimizations: [
			{
				title: "Use unchecked arithmetic",
				location: { function: "withdraw", line: 15 },
			},
		],
	},

	[TEST_CONTRACTS.INSECURE_OWNERSHIP.name]: {
		vulnerabilities: [
			{
				type: "access_control",
				severity: "high",
				title: "Missing Access Control",
				location: { function: "changeOwner", line: 13 },
			},
			{
				type: "access_control",
				severity: "high",
				title: "Missing Access Control",
				location: { function: "mint", line: 18 },
			},
		],
	},
};
