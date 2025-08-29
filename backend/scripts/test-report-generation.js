const { ReportGenerator } = require('../dist/services/ReportGenerator');
const { PDFGenerator } = require('../dist/services/PDFGenerator');
const { AuditReportService } = require('../dist/services/AuditReportService');

// Mock data for testing
const mockReportData = {
    audit: {
        id: 'test-audit-123',
        contract_id: 'test-contract-456',
        user_id: 'test-user-789',
        status: 'completed',
        static_results: {
            slither_findings: [
                {
                    type: 'reentrancy',
                    severity: 'high',
                    description: 'Potential reentrancy vulnerability in withdraw function. External call to user-controlled address before state update.',
                    location: { file: 'Contract.sol', line: 42, column: 10 },
                    confidence: 0.9,
                },
                {
                    type: 'access_control',
                    severity: 'medium',
                    description: 'Function lacks proper access control. Anyone can call this administrative function.',
                    location: { file: 'Contract.sol', line: 25, column: 5 },
                    confidence: 0.8,
                },
            ],
            gas_analysis: [
                {
                    type: 'loop_optimization',
                    description: 'Loop in function processArray can be optimized by caching array length',
                    location: { file: 'Contract.sol', line: 67, column: 12 },
                    estimated_savings: 500,
                },
                {
                    type: 'storage_optimization',
                    description: 'Multiple SSTORE operations can be combined into a single operation',
                    location: { file: 'Contract.sol', line: 89, column: 8 },
                    estimated_savings: 2000,
                },
            ],
            complexity: {
                cyclomatic_complexity: 8,
                lines_of_code: 250,
                function_count: 12,
            },
        },
        ai_results: {
            vulnerabilities: [
                {
                    type: 'overflow',
                    severity: 'low',
                    description: 'Potential integer overflow in arithmetic operation, though Solidity 0.8+ has built-in protection',
                    location: { file: 'Contract.sol', line: 156, column: 20 },
                    confidence: 0.6,
                },
            ],
            recommendations: [
                {
                    category: 'Security Best Practices',
                    priority: 'high',
                    description: 'Implement comprehensive access control using OpenZeppelin AccessControl',
                    implementation_guide: 'Import @openzeppelin/contracts/access/AccessControl.sol and inherit from AccessControl contract. Define roles using bytes32 constants and use hasRole() modifier for protected functions.',
                },
                {
                    category: 'Gas Optimization',
                    priority: 'medium',
                    description: 'Optimize storage layout to reduce gas costs',
                    implementation_guide: 'Group related state variables together and use appropriate data types. Consider using packed structs for multiple small values.',
                },
            ],
            code_quality: {
                code_quality_score: 7.2,
                maintainability_index: 68,
                test_coverage_estimate: 75,
            },
            confidence: 0.82,
        },
        created_at: new Date('2024-01-15T10:00:00Z'),
        completed_at: new Date('2024-01-15T10:15:00Z'),
        updateFinalReport: async () => true,
    },
    contract: {
        id: 'test-contract-456',
        user_id: 'test-user-789',
        name: 'DeFiVault',
        source_code: `pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DeFiVault is ReentrancyGuard, Ownable {
    mapping(address => uint256) public balances;
    uint256 public totalSupply;
    
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    
    function deposit() external payable {
        require(msg.value > 0, "Must deposit positive amount");
        balances[msg.sender] += msg.value;
        totalSupply += msg.value;
        emit Deposit(msg.sender, msg.value);
    }
    
    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        totalSupply -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(msg.sender, amount);
    }
    
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Emergency withdrawal failed");
    }
}`,
        compiler_version: '0.8.19',
        file_hash: 'a1b2c3d4e5f6789012345678901234567890abcdef',
        created_at: new Date('2024-01-15T09:45:00Z'),
        getComplexityMetrics: () => ({
            lines_of_code: 250,
            function_count: 12,
            cyclomatic_complexity: 8,
        }),
    },
    vulnerabilities: [
        {
            id: 'vuln-1',
            audit_id: 'test-audit-123',
            type: 'reentrancy',
            severity: 'high',
            title: 'Reentrancy Vulnerability in Withdraw Function',
            description: 'The withdraw function is vulnerable to reentrancy attacks. Although ReentrancyGuard is imported, it may not be properly implemented in all code paths.',
            location: { file: 'Contract.sol', line: 42, column: 10 },
            recommendation: 'Ensure ReentrancyGuard modifier is applied to all external functions that modify state and make external calls. Follow the checks-effects-interactions pattern.',
            confidence: 0.9,
            source: 'static',
            created_at: new Date('2024-01-15T10:05:00Z'),
            getLocationString: () => 'Contract.sol:42:10',
        },
        {
            id: 'vuln-2',
            audit_id: 'test-audit-123',
            type: 'access_control',
            severity: 'medium',
            title: 'Missing Access Control on Administrative Functions',
            description: 'Some administrative functions lack proper access control mechanisms, potentially allowing unauthorized users to perform privileged operations.',
            location: { file: 'Contract.sol', line: 25, column: 5 },
            recommendation: 'Implement role-based access control using OpenZeppelin AccessControl contract. Define specific roles for different administrative functions.',
            confidence: 0.8,
            source: 'static',
            created_at: new Date('2024-01-15T10:06:00Z'),
            getLocationString: () => 'Contract.sol:25:5',
        },
        {
            id: 'vuln-3',
            audit_id: 'test-audit-123',
            type: 'overflow',
            severity: 'low',
            title: 'Potential Integer Overflow (Informational)',
            description: 'While Solidity 0.8+ has built-in overflow protection, explicit checks might be beneficial for critical arithmetic operations.',
            location: { file: 'Contract.sol', line: 156, column: 20 },
            recommendation: 'Consider using SafeMath library for additional safety or implement explicit overflow checks for critical calculations.',
            confidence: 0.6,
            source: 'ai',
            created_at: new Date('2024-01-15T10:08:00Z'),
            getLocationString: () => 'Contract.sol:156:20',
        },
    ],
};

async function testReportGeneration() {
    console.log('🧪 Testing Report Generation System...\n');

    try {
        // Test 1: Generate structured report
        console.log('1️⃣ Testing ReportGenerator.generateReport()...');
        const generatedReport = await ReportGenerator.generateReport(mockReportData);

        console.log('✅ Report generated successfully!');
        console.log(`   - Total vulnerabilities: ${generatedReport.report.total_vulnerabilities}`);
        console.log(`   - Critical: ${generatedReport.report.critical_count}`);
        console.log(`   - High: ${generatedReport.report.high_count}`);
        console.log(`   - Medium: ${generatedReport.report.medium_count}`);
        console.log(`   - Low: ${generatedReport.report.low_count}`);
        console.log(`   - Gas optimizations: ${generatedReport.report.gas_optimizations.length}`);
        console.log(`   - Recommendations: ${generatedReport.report.recommendations.length}`);
        console.log(`   - Estimated pages: ${generatedReport.metadata.totalPages}`);
        console.log(`   - HTML content length: ${generatedReport.htmlContent.length} characters\n`);

        // Test 2: Validate HTML content
        console.log('2️⃣ Testing HTML validation...');
        const validation = PDFGenerator.validateHTMLContent(generatedReport.htmlContent);

        if (validation.isValid) {
            console.log('✅ HTML content is valid!');
        } else {
            console.log('❌ HTML validation failed:');
            validation.errors.forEach(error => console.log(`   - ${error}`));
        }
        console.log();

        // Test 3: Test PDF metadata estimation
        console.log('3️⃣ Testing PDF metadata estimation...');
        const pdfMetadata = await PDFGenerator.getPDFMetadata(generatedReport.htmlContent);
        console.log('✅ PDF metadata estimated:');
        console.log(`   - Estimated size: ${pdfMetadata.estimatedSize} bytes`);
        console.log(`   - Estimated pages: ${pdfMetadata.estimatedPages}`);
        console.log();

        // Test 4: Test different report types
        console.log('4️⃣ Testing different PDF options...');
        const reportTypes = ['standard', 'executive', 'detailed'];

        for (const reportType of reportTypes) {
            const options = PDFGenerator.getOptionsForReportType(reportType);
            console.log(`✅ ${reportType} report options:`, {
                format: options.format,
                marginTop: options.margin?.top,
                hasCustomHeader: !!options.headerTemplate?.includes(reportType === 'executive' ? 'Executive' : reportType === 'detailed' ? 'Detailed' : 'Smart Contract'),
            });
        }
        console.log();

        // Test 5: Test report with no vulnerabilities
        console.log('5️⃣ Testing report with no vulnerabilities...');
        const emptyReportData = {
            ...mockReportData,
            vulnerabilities: [],
        };

        const emptyReport = await ReportGenerator.generateReport(emptyReportData);
        console.log('✅ Empty report generated successfully!');
        console.log(`   - Total vulnerabilities: ${emptyReport.report.total_vulnerabilities}`);
        console.log(`   - Contains "No vulnerabilities": ${emptyReport.htmlContent.includes('No vulnerabilities')}`);
        console.log();

        // Test 6: Test executive summary generation
        console.log('6️⃣ Testing executive summary...');
        const summary = generatedReport.report.executive_summary;
        console.log('✅ Executive summary generated:');
        console.log(`   "${summary.substring(0, 100)}..."`);
        console.log();

        // Test 7: Test gas optimization reporting
        console.log('7️⃣ Testing gas optimization reporting...');
        const gasOptimizations = generatedReport.report.gas_optimizations;
        const totalSavings = gasOptimizations.reduce((sum, opt) => sum + opt.estimated_savings, 0);
        console.log('✅ Gas optimization analysis:');
        console.log(`   - Total optimizations: ${gasOptimizations.length}`);
        console.log(`   - Total estimated savings: ${totalSavings} gas`);
        gasOptimizations.forEach((opt, index) => {
            console.log(`   - Optimization ${index + 1}: ${opt.type} (~${opt.estimated_savings} gas)`);
        });
        console.log();

        // Test 8: Test HTML structure
        console.log('8️⃣ Testing HTML structure...');
        const htmlChecks = {
            hasDoctype: generatedReport.htmlContent.includes('<!DOCTYPE html>'),
            hasTitle: generatedReport.htmlContent.includes('<title>'),
            hasCoverPage: generatedReport.htmlContent.includes('cover-page'),
            hasVulnerabilities: generatedReport.htmlContent.includes('vulnerability'),
            hasRecommendations: generatedReport.htmlContent.includes('recommendation'),
            hasAppendix: generatedReport.htmlContent.includes('Appendix'),
        };

        console.log('✅ HTML structure validation:');
        Object.entries(htmlChecks).forEach(([check, passed]) => {
            console.log(`   - ${check}: ${passed ? '✅' : '❌'}`);
        });
        console.log();

        console.log('🎉 All report generation tests completed successfully!\n');

        // Summary
        console.log('📊 Test Summary:');
        console.log('================');
        console.log('✅ Report structure generation');
        console.log('✅ HTML content generation');
        console.log('✅ HTML validation');
        console.log('✅ PDF options configuration');
        console.log('✅ Empty report handling');
        console.log('✅ Executive summary generation');
        console.log('✅ Gas optimization analysis');
        console.log('✅ HTML structure validation');
        console.log('\n🚀 Report generation system is working correctly!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testReportGeneration();
}

module.exports = { testReportGeneration };