# Multi-Blockchain Testing Documentation

This document describes the comprehensive testing suite for multi-blockchain support in Audit Wolf.

## Overview

The multi-blockchain testing suite validates the platform's ability to analyze smart contracts across different blockchain ecosystems including Ethereum, Solana, Cardano, and Move-based platforms (Aptos/Sui).

## Test Structure

### 1. Test Contracts (`src/test/fixtures/`)

#### Solana Test Contracts (`solana-contracts.ts`)

- **SECURE_ANCHOR_PROGRAM**: Well-written Anchor program with proper security patterns
- **VULNERABLE_ANCHOR_PROGRAM**: Anchor program with multiple security vulnerabilities
- **SECURE_NATIVE_PROGRAM**: Native Solana program following best practices
- **VULNERABLE_NATIVE_PROGRAM**: Native program with critical security issues
- **LARGE_SOLANA_PROGRAM**: Large program for performance testing
- **INVALID_RUST_CODE**: Invalid code for error handling tests

#### Cardano Test Contracts (`cardano-contracts.ts`)

- **VALID_PLUTUS_VALIDATOR**: Secure Plutus validator implementation
- **VULNERABLE_PLUTUS_VALIDATOR**: Validator with security vulnerabilities
- **PLUTUS_SCRIPT_WITH_DATUM**: Complex validator with datum handling
- **UNSAFE_DATUM_HANDLING**: Validator with unsafe datum operations
- **EUTXO_NON_COMPLIANT**: Validator not following eUTXO model properly

#### Move Test Contracts (`move-contracts.ts`)

- **SECURE_MOVE_MODULE**: Well-implemented Move module with proper patterns
- **VULNERABLE_MOVE_MODULE**: Module with critical security vulnerabilities
- **SUI_MOVE_MODULE**: Sui-specific Move implementation
- **VULNERABLE_SUI_MODULE**: Sui module with security issues
- **LARGE_MOVE_MODULE**: Complex DeFi module for performance testing

### 2. Test Suites

#### Unit Tests (`multi-blockchain-comprehensive.test.ts`)

Tests individual platform analyzers and their specific security checks:

**Solana Analyzer Tests:**

- Platform detection (Anchor vs Native programs)
- Contract validation and syntax checking
- Security vulnerability detection:
  - Insecure PDA derivation
  - Missing account owner validation
  - Missing signer validation
  - Integer overflow/underflow
  - Unsafe account access
- Anchor-specific pattern validation
- AI analysis integration
- Health checks and tool availability

**Cardano Analyzer Tests:**

- Plutus script detection and validation
- Haskell program analysis
- Security vulnerability detection:
  - Missing ScriptContext usage
  - Unsafe datum handling
  - Missing value validation
  - UTXO model violations
  - eUTXO compliance issues
- HLint integration
- Partial function detection

**Cross-Chain Analysis Tests:**

- Bridge contract security assessment
- State consistency analysis across platforms
- Interoperability risk identification
- Cross-chain recommendation generation

#### Integration Tests (`integration/multi-blockchain-integration.test.ts`)

Tests complete workflows from API to database:

**Multi-Platform Contract Upload:**

- Platform-specific contract validation
- Multi-platform upload handling
- Invalid platform rejection

**Analysis Workflows:**

- Single-platform analysis execution
- Multi-platform parallel analysis
- Cross-chain bridge analysis
- Analysis status tracking and completion

**Report Generation:**

- Multi-platform PDF report generation
- JSON report with cross-platform data
- Platform-specific report sections

**Database Integration:**

- Multi-platform audit data storage
- Contract metadata persistence
- Vulnerability tracking across platforms
- Foreign key relationships and constraints

#### Performance Tests (`performance/multi-blockchain-performance.test.ts`)

Tests scalability and resource utilization:

**Single Platform Performance:**

- Batch contract analysis efficiency
- Large contract handling
- Memory usage optimization

**Multi-Platform Parallel Processing:**

- Concurrent platform analysis
- Scalability with increasing platform count
- Resource allocation and management

**Cross-Chain Analysis Performance:**

- Bridge analysis efficiency
- Complex multi-platform scenarios
- State consistency analysis performance

**Stress Testing:**

- Concurrent request handling
- Load testing with multiple iterations
- Memory leak detection
- Timeout and error recovery

## Running Tests

### Individual Test Suites

```bash
# Run all multi-blockchain tests
npm run test:multi-blockchain

# Run specific test suites
npm run test:multi-blockchain-unit
npm run test:multi-blockchain-integration
npm run test:multi-blockchain-performance

# Run platform-specific tests
npm run test:solana
npm run test:cardano
npm run test:cross-chain
```

### Test Configuration

#### Timeouts

- Unit tests: 5 minutes
- Integration tests: 10 minutes
- Performance tests: 15 minutes

#### Environment Requirements

- Node.js 18+
- Jest testing framework
- Supabase test database
- Mock external tool dependencies

## Test Coverage

### Expected Coverage Targets

- **Unit Tests**: >90% code coverage
- **Integration Tests**: >80% API endpoint coverage
- **Performance Tests**: Key performance metrics validation

### Coverage Areas

1. **Platform Analyzers**: All analyzer methods and security checks
2. **Cross-Chain Logic**: Bridge analysis and interoperability detection
3. **API Endpoints**: Multi-blockchain specific routes
4. **Database Operations**: Multi-platform data persistence
5. **Error Handling**: Platform-specific error scenarios

## Vulnerability Detection Testing

### Solana Vulnerabilities Tested

- **Insecure PDA Derivation**: Predictable seeds in PDA generation
- **Missing Access Control**: Functions without proper authorization
- **Account Model Violations**: Improper account ownership validation
- **Integer Overflow/Underflow**: Arithmetic operations without checks
- **Missing Signer Validation**: Operations without signer verification
- **Unsafe Account Access**: Direct account data manipulation

### Cardano Vulnerabilities Tested

- **Missing ScriptContext**: Validators without proper context usage
- **Unsafe Datum Handling**: Direct BuiltinData usage without validation
- **UTXO Model Violations**: Improper UTXO consumption/creation
- **eUTXO Non-Compliance**: Not following extended UTXO model
- **Partial Function Usage**: Use of unsafe Haskell functions
- **Script Efficiency Issues**: Inefficient Plutus implementations

### Cross-Chain Vulnerabilities Tested

- **Bridge Security Issues**: Insecure cross-chain message passing
- **State Inconsistency**: Mismatched state across platforms
- **Interoperability Risks**: Platform compatibility issues
- **Governance Centralization**: Cross-chain governance vulnerabilities

## Performance Benchmarks

### Expected Performance Metrics

- **Single Contract Analysis**: <5 seconds
- **Batch Analysis (10 contracts)**: <30 seconds
- **Multi-Platform Analysis**: <45 seconds
- **Cross-Chain Analysis**: <30 seconds
- **Large Contract Analysis**: <10 seconds

### Resource Usage Limits

- **Memory Usage**: <500MB additional for large batches
- **Memory Leaks**: <100MB increase after multiple cycles
- **Concurrent Requests**: Handle 5+ simultaneous analyses
- **Timeout Handling**: Respect timeout limits efficiently

## Error Scenarios Tested

### Platform-Specific Errors

1. **Invalid Syntax**: Malformed contract code
2. **Missing Dependencies**: Required tools not installed
3. **Compilation Failures**: Code that fails to compile
4. **Analysis Timeouts**: Long-running analysis scenarios
5. **Tool Failures**: External analyzer tool errors

### System-Level Errors

1. **Database Connection Issues**: Network or authentication failures
2. **Memory Exhaustion**: Resource limitation scenarios
3. **Concurrent Access**: Race conditions and locks
4. **API Rate Limiting**: Request throttling scenarios

## Continuous Integration

### Test Execution in CI/CD

```yaml
# Example GitHub Actions workflow
- name: Run Multi-Blockchain Tests
  run: |
    npm run test:multi-blockchain-unit
    npm run test:multi-blockchain-integration
    npm run test:multi-blockchain-performance
```

### Test Reports

- **JSON Report**: `test-results/multi-blockchain-test-report.json`
- **Markdown Report**: `test-results/multi-blockchain-test-report.md`
- **Coverage Report**: Generated by Jest with detailed metrics

## Troubleshooting

### Common Issues

1. **Test Timeouts**

   - Increase timeout values in Jest configuration
   - Check system resources and performance
   - Verify external tool availability

2. **Database Connection Failures**

   - Verify Supabase configuration
   - Check network connectivity
   - Ensure test database is accessible

3. **Memory Issues**

   - Monitor memory usage during tests
   - Check for memory leaks in analyzers
   - Adjust Node.js memory limits if needed

4. **Platform Tool Dependencies**
   - Mock external tools for CI environments
   - Verify tool installation and versions
   - Handle tool unavailability gracefully

### Debug Mode

Enable verbose logging for detailed test execution:

```bash
DEBUG=audit-wolf:* npm run test:multi-blockchain
```

## Future Enhancements

### Planned Test Additions

1. **Additional Platforms**: Cosmos, Near, Tezos support
2. **Advanced Cross-Chain**: Complex bridge scenarios
3. **AI Model Testing**: Platform-specific AI analysis validation
4. **Security Regression**: Automated vulnerability regression testing
5. **Load Testing**: High-volume concurrent analysis testing

### Test Infrastructure Improvements

1. **Parallel Test Execution**: Faster test suite completion
2. **Test Data Management**: Automated test contract generation
3. **Visual Reports**: Dashboard for test results and trends
4. **Performance Monitoring**: Continuous performance regression detection
