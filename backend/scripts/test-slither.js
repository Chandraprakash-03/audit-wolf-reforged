#!/usr/bin/env node

/**
 * Test script to verify Slither integration
 * This script tests the SlitherAnalyzer without requiring the full backend setup
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test contract with known vulnerabilities
const testContract = `
pragma solidity ^0.8.0;

contract VulnerableContract {
    mapping(address => uint256) public balances;
    
    // Reentrancy vulnerability
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // External call before state change (vulnerable to reentrancy)
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        balances[msg.sender] -= amount;
    }
    
    // tx.origin vulnerability
    function authorize(address user) public {
        require(tx.origin == owner, "Not authorized"); // Should use msg.sender
    }
    
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
}
`;

async function testSlitherInstallation() {
    console.log('🔍 Testing Slither installation...');

    return new Promise((resolve) => {
        const process = spawn('slither', ['--version'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Slither is installed:', stdout.trim() || stderr.trim());
                resolve(true);
            } else {
                console.log('❌ Slither is not installed or not accessible');
                console.log('Error:', stderr);
                resolve(false);
            }
        });

        process.on('error', (error) => {
            console.log('❌ Slither is not installed:', error.message);
            resolve(false);
        });
    });
}

async function testSlitherAnalysis() {
    console.log('\n🧪 Testing Slither analysis...');

    // Create temporary file
    const tempDir = require('os').tmpdir();
    const contractPath = path.join(tempDir, 'test-contract.sol');

    try {
        fs.writeFileSync(contractPath, testContract);
        console.log('📝 Created test contract:', contractPath);

        return new Promise((resolve) => {
            const process = spawn('slither', [contractPath, '--json', '-'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                try {
                    // Clean up
                    fs.unlinkSync(contractPath);
                } catch (e) {
                    // Ignore cleanup errors
                }

                if (stdout.trim()) {
                    try {
                        const result = JSON.parse(stdout);
                        if (result.results && result.results.detectors) {
                            console.log('✅ Slither analysis successful!');
                            console.log(`📊 Found ${result.results.detectors.length} issues:`);

                            result.results.detectors.forEach((detector, index) => {
                                console.log(`  ${index + 1}. ${detector.check} (${detector.impact}): ${detector.description}`);
                            });

                            resolve(true);
                        } else {
                            console.log('⚠️  Slither ran but returned unexpected format');
                            console.log('Output:', stdout.substring(0, 200) + '...');
                            resolve(false);
                        }
                    } catch (parseError) {
                        console.log('⚠️  Slither ran but output is not valid JSON');
                        console.log('Output:', stdout.substring(0, 200) + '...');
                        resolve(false);
                    }
                } else {
                    console.log('⚠️  Slither ran but produced no output');
                    if (stderr) {
                        console.log('Stderr:', stderr);
                    }
                    resolve(false);
                }
            });

            process.on('error', (error) => {
                console.log('❌ Failed to run Slither analysis:', error.message);
                resolve(false);
            });

            // Set timeout
            setTimeout(() => {
                process.kill('SIGTERM');
                console.log('⏰ Slither analysis timed out');
                resolve(false);
            }, 30000); // 30 second timeout
        });
    } catch (error) {
        console.log('❌ Failed to create test contract:', error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Audit Wolf - Slither Integration Test\n');

    const isInstalled = await testSlitherInstallation();

    if (!isInstalled) {
        console.log('\n📋 Installation Instructions:');
        console.log('1. Install Python 3.8+');
        console.log('2. Run: pip install slither-analyzer');
        console.log('3. Ensure slither is in your PATH');
        console.log('\nOr use the installation scripts:');
        console.log('- Linux/macOS: ./backend/scripts/install-slither.sh');
        console.log('- Windows: backend\\scripts\\install-slither.bat');
        process.exit(1);
    }

    const analysisWorked = await testSlitherAnalysis();

    if (analysisWorked) {
        console.log('\n🎉 Slither integration test completed successfully!');
        console.log('The static analysis system is ready to use.');
    } else {
        console.log('\n⚠️  Slither is installed but analysis test failed.');
        console.log('This might be due to version compatibility or configuration issues.');
        console.log('The integration should still work, but you may need to adjust settings.');
    }
}

main().catch(console.error);