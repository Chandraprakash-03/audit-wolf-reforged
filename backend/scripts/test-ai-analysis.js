const { AIAnalyzer } = require('../dist/services/AIAnalyzer');

// Sample vulnerable contract for testing
const vulnerableContract = `
pragma solidity ^0.8.0;

contract VulnerableBank {
    mapping(address => uint256) public balances;
    
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }
    
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // Vulnerable to reentrancy - state change after external call
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        balances[msg.sender] -= amount;
    }
    
    function getBalance() public view returns (uint256) {
        return balances[msg.sender];
    }
}
`;

async function testAIAnalysis() {
    console.log('🤖 Testing AI Analysis Pipeline...\n');

    try {
        // Check AI configuration
        console.log('1. Checking AI configuration...');
        const configCheck = await AIAnalyzer.checkConfiguration();
        console.log(`   ✅ AI Configured: ${configCheck.configured}`);
        console.log(`   📋 Available Models: ${configCheck.availableModels.length}`);
        if (configCheck.errors.length > 0) {
            console.log(`   ⚠️  Errors: ${configCheck.errors.join(', ')}`);
        }
        console.log();

        if (!configCheck.configured) {
            console.log('❌ AI not properly configured. Please check your OPENROUTER_API_KEY.');
            return;
        }

        // Create AI analyzer
        console.log('2. Creating AI analyzer...');
        const aiAnalyzer = new AIAnalyzer({
            timeout: 60000, // 1 minute for demo
            maxTokens: 2000,
            temperature: 0.1,
            models: ['openai/gpt-4o-mini'], // Use just one model for demo
            ensembleThreshold: 0.5,
        });
        console.log('   ✅ AI Analyzer created');
        console.log();

        // Analyze the vulnerable contract
        console.log('3. Analyzing vulnerable contract...');
        console.log('   📄 Contract: VulnerableBank (contains reentrancy vulnerability)');

        const startTime = Date.now();
        const result = await aiAnalyzer.analyzeContract(
            vulnerableContract,
            'VulnerableBank',
            {
                includeRecommendations: true,
                includeQualityMetrics: true,
                focusAreas: ['reentrancy', 'access control', 'best practices'],
                severityThreshold: 'low'
            }
        );
        const duration = Date.now() - startTime;

        console.log(`   ⏱️  Analysis completed in ${duration}ms`);
        console.log();

        if (result.success && result.result) {
            const analysis = result.result;

            // Display results
            console.log('📊 ANALYSIS RESULTS');
            console.log('===================');
            console.log(`Overall Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
            console.log();

            // Vulnerabilities
            console.log(`🔍 VULNERABILITIES FOUND: ${analysis.vulnerabilities.length}`);
            analysis.vulnerabilities.forEach((vuln, index) => {
                console.log(`\n${index + 1}. ${vuln.type.toUpperCase()} (${vuln.severity.toUpperCase()})`);
                console.log(`   📍 Location: Line ${vuln.location.line}, Column ${vuln.location.column}`);
                console.log(`   📝 Description: ${vuln.description}`);
                console.log(`   🎯 Confidence: ${(vuln.confidence * 100).toFixed(1)}%`);
            });

            // Recommendations
            if (analysis.recommendations.length > 0) {
                console.log(`\n💡 SECURITY RECOMMENDATIONS: ${analysis.recommendations.length}`);
                analysis.recommendations.forEach((rec, index) => {
                    console.log(`\n${index + 1}. ${rec.category} (${rec.priority.toUpperCase()} priority)`);
                    console.log(`   📝 ${rec.description}`);
                    console.log(`   🔧 Implementation: ${rec.implementation_guide}`);
                });
            }

            // Quality metrics
            console.log('\n📈 CODE QUALITY METRICS');
            console.log(`   Code Quality Score: ${analysis.code_quality.code_quality_score}/100`);
            console.log(`   Maintainability Index: ${analysis.code_quality.maintainability_index}/100`);
            console.log(`   Test Coverage Estimate: ${analysis.code_quality.test_coverage_estimate}%`);

        } else {
            console.log('❌ Analysis failed:');
            console.log(`   Error: ${result.error}`);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testAIAnalysis().then(() => {
    console.log('\n✅ AI Analysis test completed!');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});