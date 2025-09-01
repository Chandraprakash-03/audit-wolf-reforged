const { AIAnalyzer } = require('./dist/services/AIAnalyzer');

// Simple test contract
const testContract = `
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 private storedData;
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    function set(uint256 x) public {
        storedData = x;
    }
    
    function get() public view returns (uint256) {
        return storedData;
    }
    
    function withdraw() public {
        require(msg.sender == owner, "Not owner");
        payable(owner).transfer(address(this).balance);
    }
}
`;

async function testStructuredOutput() {
    console.log('Testing structured output with AI Analyzer...');

    try {
        const analyzer = new AIAnalyzer({
            models: ["deepseek/deepseek-chat-v3.1:free"], // Test with one model first
            timeout: 60000
        });

        const result = await analyzer.analyzeContract(
            testContract,
            "SimpleStorage",
            {
                includeRecommendations: true,
                includeQualityMetrics: true
            }
        );

        console.log('Analysis Result:');
        console.log(JSON.stringify(result, null, 2));

        if (result.success && result.result) {
            console.log('\n✅ Structured output working!');
            console.log(`Found ${result.result.vulnerabilities.length} vulnerabilities`);
            console.log(`Found ${result.result.recommendations.length} recommendations`);
            console.log(`Confidence: ${result.result.confidence}`);
        } else {
            console.log('\n❌ Analysis failed:', result.error);
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testStructuredOutput();