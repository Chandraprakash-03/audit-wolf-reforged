#!/usr/bin/env node

/**
 * Comprehensive test runner for Audit Wolf API
 * Runs all types of tests in sequence with proper setup and teardown
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
    unit: {
        name: 'Unit Tests',
        command: 'npm',
        args: ['run', 'test', '--', '--coverage', '--watchAll=false'],
        timeout: 300000, // 5 minutes
        required: true
    },
    integration: {
        name: 'Integration Tests',
        command: 'npm',
        args: ['run', 'test:integration'],
        timeout: 600000, // 10 minutes
        required: true
    },
    load: {
        name: 'Load Tests',
        command: 'npm',
        args: ['run', 'test:load-report'],
        timeout: 900000, // 15 minutes
        required: false
    },
    docs: {
        name: 'API Documentation Generation',
        command: 'npm',
        args: ['run', 'docs:generate'],
        timeout: 60000, // 1 minute
        required: false
    }
};

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

class TestRunner {
    constructor() {
        this.results = {};
        this.startTime = Date.now();
    }

    log(message, color = colors.reset) {
        console.log(`${color}${message}${colors.reset}`);
    }

    logSection(title) {
        const separator = '='.repeat(60);
        this.log(`\n${separator}`, colors.cyan);
        this.log(`${title}`, colors.cyan + colors.bright);
        this.log(`${separator}`, colors.cyan);
    }

    async runCommand(name, command, args, timeout = 300000) {
        return new Promise((resolve, reject) => {
            this.log(`\n🚀 Starting ${name}...`, colors.blue);

            const process = spawn(command, args, {
                stdio: 'inherit',
                shell: true,
                cwd: path.resolve(__dirname, '..')
            });

            const timer = setTimeout(() => {
                process.kill('SIGTERM');
                reject(new Error(`${name} timed out after ${timeout / 1000} seconds`));
            }, timeout);

            process.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0) {
                    this.log(`✅ ${name} completed successfully`, colors.green);
                    resolve({ success: true, code });
                } else {
                    this.log(`❌ ${name} failed with exit code ${code}`, colors.red);
                    resolve({ success: false, code });
                }
            });

            process.on('error', (error) => {
                clearTimeout(timer);
                this.log(`❌ ${name} failed with error: ${error.message}`, colors.red);
                reject(error);
            });
        });
    }

    async setupTestEnvironment() {
        this.logSection('Setting up test environment');

        try {
            // Check if .env file exists
            const envPath = path.resolve(__dirname, '..', '.env');
            if (!fs.existsSync(envPath)) {
                this.log('📝 Creating .env file from .env.example...', colors.yellow);
                const exampleEnv = fs.readFileSync(path.resolve(__dirname, '..', '.env.example'), 'utf8');
                fs.writeFileSync(envPath, exampleEnv);
            }

            // Run database migrations
            this.log('🗄️ Running database migrations...', colors.blue);
            await this.runCommand('Database Migration', 'npm', ['run', 'migrate'], 60000);

            // Seed test data
            this.log('🌱 Seeding test data...', colors.blue);
            await this.runCommand('Test Data Seeding', 'npm', ['run', 'seed:test-data'], 120000);

            this.log('✅ Test environment setup completed', colors.green);
        } catch (error) {
            this.log(`❌ Test environment setup failed: ${error.message}`, colors.red);
            throw error;
        }
    }

    async runAllTests() {
        this.logSection('Running Audit Wolf API Test Suite');

        try {
            // Setup test environment
            await this.setupTestEnvironment();

            // Run each test suite
            for (const [key, config] of Object.entries(TEST_CONFIG)) {
                try {
                    const result = await this.runCommand(
                        config.name,
                        config.command,
                        config.args,
                        config.timeout
                    );

                    this.results[key] = result;

                    // If this is a required test and it failed, stop execution
                    if (config.required && !result.success) {
                        this.log(`❌ Required test ${config.name} failed. Stopping execution.`, colors.red);
                        break;
                    }
                } catch (error) {
                    this.results[key] = { success: false, error: error.message };

                    if (config.required) {
                        this.log(`❌ Required test ${config.name} failed. Stopping execution.`, colors.red);
                        break;
                    }
                }
            }

            // Generate summary report
            this.generateSummaryReport();

        } catch (error) {
            this.log(`❌ Test execution failed: ${error.message}`, colors.red);
            process.exit(1);
        }
    }

    generateSummaryReport() {
        this.logSection('Test Results Summary');

        const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(2);
        let passed = 0;
        let failed = 0;
        let skipped = 0;

        for (const [key, result] of Object.entries(this.results)) {
            const config = TEST_CONFIG[key];
            const status = result.success ? '✅ PASSED' : '❌ FAILED';
            const color = result.success ? colors.green : colors.red;

            this.log(`${status} ${config.name}`, color);

            if (result.success) {
                passed++;
            } else {
                failed++;
            }
        }

        // Count skipped tests
        skipped = Object.keys(TEST_CONFIG).length - Object.keys(this.results).length;

        this.log(`\n📊 Summary:`, colors.bright);
        this.log(`   Total Tests: ${Object.keys(TEST_CONFIG).length}`);
        this.log(`   Passed: ${passed}`, colors.green);
        this.log(`   Failed: ${failed}`, colors.red);
        this.log(`   Skipped: ${skipped}`, colors.yellow);
        this.log(`   Total Time: ${totalTime}s`);

        // Generate detailed report file
        this.generateDetailedReport(totalTime);

        // Exit with appropriate code
        if (failed > 0) {
            this.log(`\n❌ Test suite failed with ${failed} failures`, colors.red);
            process.exit(1);
        } else {
            this.log(`\n✅ All tests passed successfully!`, colors.green);
            process.exit(0);
        }
    }

    generateDetailedReport(totalTime) {
        const report = {
            timestamp: new Date().toISOString(),
            totalTime: `${totalTime}s`,
            summary: {
                total: Object.keys(TEST_CONFIG).length,
                passed: Object.values(this.results).filter(r => r.success).length,
                failed: Object.values(this.results).filter(r => !r.success).length,
                skipped: Object.keys(TEST_CONFIG).length - Object.keys(this.results).length
            },
            results: {}
        };

        for (const [key, result] of Object.entries(this.results)) {
            const config = TEST_CONFIG[key];
            report.results[key] = {
                name: config.name,
                success: result.success,
                required: config.required,
                exitCode: result.code,
                error: result.error || null
            };
        }

        const reportPath = path.resolve(__dirname, '..', 'test-results.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        this.log(`\n📄 Detailed report saved to: ${reportPath}`, colors.blue);
    }
}

// Handle command line arguments
const args = process.argv.slice(2);
const options = {
    skipSetup: args.includes('--skip-setup'),
    onlyUnit: args.includes('--unit-only'),
    onlyIntegration: args.includes('--integration-only'),
    onlyLoad: args.includes('--load-only'),
    verbose: args.includes('--verbose')
};

// Modify test configuration based on options
if (options.onlyUnit) {
    Object.keys(TEST_CONFIG).forEach(key => {
        if (key !== 'unit') delete TEST_CONFIG[key];
    });
} else if (options.onlyIntegration) {
    Object.keys(TEST_CONFIG).forEach(key => {
        if (key !== 'integration') delete TEST_CONFIG[key];
    });
} else if (options.onlyLoad) {
    Object.keys(TEST_CONFIG).forEach(key => {
        if (key !== 'load') delete TEST_CONFIG[key];
    });
}

// Run the test suite
const runner = new TestRunner();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Test execution interrupted by user');
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Test execution terminated');
    process.exit(1);
});

// Start test execution
runner.runAllTests().catch((error) => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
});