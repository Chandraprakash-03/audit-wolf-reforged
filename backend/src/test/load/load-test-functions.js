/**
 * Artillery load test helper functions
 */

const crypto = require('crypto');

/**
 * Generate random string for unique test data
 */
function randomString(context, events, done) {
    context.vars.randomString = crypto.randomBytes(8).toString('hex');
    return done();
}

/**
 * Generate random integer within range
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Setup user and audit for report testing
 */
async function setupUserAndAudit(context, events, done) {
    try {
        // This would typically make API calls to set up test data
        // For load testing, we'll use mock data
        context.vars.authToken = 'mock-token-' + crypto.randomBytes(16).toString('hex');
        context.vars.auditId = crypto.randomUUID();
        context.vars.userId = crypto.randomUUID();

        return done();
    } catch (error) {
        return done(error);
    }
}

/**
 * Validate response times and set custom metrics
 */
function validatePerformance(context, events, done) {
    const responseTime = context.vars.$responseTime;

    // Set custom metrics based on response time
    if (responseTime > 5000) {
        events.emit('counter', 'slow_responses', 1);
    } else if (responseTime > 2000) {
        events.emit('counter', 'medium_responses', 1);
    } else {
        events.emit('counter', 'fast_responses', 1);
    }

    // Track API endpoint performance
    const endpoint = context.vars.$url;
    events.emit('histogram', `response_time_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`, responseTime);

    return done();
}

/**
 * Generate realistic contract source code for testing
 */
function generateContractCode(context, events, done) {
    const contractTypes = [
        {
            name: 'SimpleToken',
            code: `
        pragma solidity ^0.8.0;
        contract SimpleToken {
            mapping(address => uint256) public balances;
            uint256 public totalSupply = 1000000;
            
            constructor() {
                balances[msg.sender] = totalSupply;
            }
            
            function transfer(address to, uint256 amount) public {
                require(balances[msg.sender] >= amount);
                balances[msg.sender] -= amount;
                balances[to] += amount;
            }
        }
      `
        },
        {
            name: 'VulnerableContract',
            code: `
        pragma solidity ^0.8.0;
        contract VulnerableContract {
            mapping(address => uint256) public balances;
            
            function withdraw() public {
                uint256 balance = balances[msg.sender];
                (bool success, ) = msg.sender.call{value: balance}("");
                require(success);
                balances[msg.sender] = 0;
            }
        }
      `
        },
        {
            name: 'ComplexContract',
            code: `
        pragma solidity ^0.8.0;
        contract ComplexContract {
            mapping(address => uint256) public balances;
            mapping(address => bool) public authorized;
            uint256[] public data;
            
            function complexFunction() public {
                for (uint i = 0; i < data.length; i++) {
                    if (data[i] > 100) {
                        data[i] = data[i] * 2;
                    }
                }
            }
        }
      `
        }
    ];

    const randomContract = contractTypes[Math.floor(Math.random() * contractTypes.length)];
    context.vars.contractName = randomContract.name + '_' + crypto.randomBytes(4).toString('hex');
    context.vars.contractCode = randomContract.code;

    return done();
}

/**
 * Simulate realistic user behavior with think time
 */
function simulateUserBehavior(context, events, done) {
    // Simulate user reading/thinking time between actions
    const thinkTime = randomInt(1000, 5000); // 1-5 seconds

    setTimeout(() => {
        return done();
    }, thinkTime);
}

/**
 * Track custom business metrics
 */
function trackBusinessMetrics(context, events, done) {
    const response = context.vars.$response;

    if (response && response.body) {
        try {
            const data = JSON.parse(response.body);

            // Track successful operations
            if (data.success) {
                events.emit('counter', 'successful_operations', 1);

                // Track specific operation types
                if (context.vars.$url.includes('/contracts')) {
                    events.emit('counter', 'contract_operations', 1);
                } else if (context.vars.$url.includes('/analysis')) {
                    events.emit('counter', 'analysis_operations', 1);
                } else if (context.vars.$url.includes('/reports')) {
                    events.emit('counter', 'report_operations', 1);
                }
            } else {
                events.emit('counter', 'failed_operations', 1);
            }

            // Track vulnerability detection metrics
            if (data.data && data.data.vulnerabilities) {
                events.emit('histogram', 'vulnerabilities_detected', data.data.vulnerabilities.length);
            }

        } catch (error) {
            // Ignore JSON parsing errors for non-JSON responses
        }
    }

    return done();
}

/**
 * Memory and resource usage tracking
 */
function trackResourceUsage(context, events, done) {
    const memUsage = process.memoryUsage();

    events.emit('histogram', 'memory_heap_used', memUsage.heapUsed);
    events.emit('histogram', 'memory_heap_total', memUsage.heapTotal);
    events.emit('histogram', 'memory_rss', memUsage.rss);

    return done();
}

/**
 * Error rate calculation and alerting
 */
function calculateErrorRate(context, events, done) {
    const statusCode = context.vars.$statusCode;

    if (statusCode >= 400) {
        events.emit('counter', 'http_errors', 1);

        if (statusCode >= 500) {
            events.emit('counter', 'server_errors', 1);
        } else {
            events.emit('counter', 'client_errors', 1);
        }
    } else {
        events.emit('counter', 'successful_requests', 1);
    }

    return done();
}

module.exports = {
    randomString,
    randomInt,
    setupUserAndAudit,
    validatePerformance,
    generateContractCode,
    simulateUserBehavior,
    trackBusinessMetrics,
    trackResourceUsage,
    calculateErrorRate
};