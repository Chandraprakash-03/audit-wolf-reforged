// Simple test to verify contract validation fixes
const { validateCodeForPlatform } = require('./src/utils/platformValidation');
const { getPlatformById } = require('./src/data/blockchainPlatforms');

// Test cases
const testCases = [
    {
        name: "Simple Solidity Contract",
        code: `contract MyContract {
      uint256 public value;
      function setValue(uint256 _value) public {
        value = _value;
      }
    }`,
        platform: "ethereum"
    },
    {
        name: "Incomplete Solidity Contract",
        code: `function test() public {
      // incomplete contract
    }`,
        platform: "ethereum"
    },
    {
        name: "Simple Rust Code",
        code: `pub fn initialize() {
      // some rust code
    }`,
        platform: "solana"
    }
];

console.log("Testing contract validation fixes...\n");

testCases.forEach(testCase => {
    const platform = getPlatformById(testCase.platform);
    if (platform) {
        const result = validateCodeForPlatform(testCase.code, platform);
        console.log(`Test: ${testCase.name}`);
        console.log(`Valid: ${result.isValid}`);
        console.log(`Errors: ${result.errors.length}`);
        console.log(`Warnings: ${result.warnings?.length || 0}`);
        console.log("---");
    }
});