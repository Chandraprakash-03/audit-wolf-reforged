# Audit Wolf API Testing Suite

This document provides comprehensive information about the API testing suite for the Audit Wolf smart contract auditing platform.

## Overview

The testing suite includes:

- **OpenAPI/Swagger Documentation** - Complete API specification
- **Unit Tests** - Individual component testing
- **Integration Tests** - End-to-end API workflow testing
- **Load Tests** - Performance and scalability validation
- **End-to-End Tests** - Full user journey testing with Playwright
- **Continuous Integration** - Automated testing pipeline

## API Documentation

### Swagger UI

The API documentation is automatically generated and served at:

- **Development**: http://localhost:3001/api-docs
- **Raw JSON**: http://localhost:3001/api-docs.json
- **Raw YAML**: http://localhost:3001/api-docs.yaml

### Generating Documentation

```bash
npm run docs:generate
```

## Test Types

### 1. Unit Tests

Tests individual functions and components in isolation.

```bash
# Run all unit tests
npm test

# Run with coverage
npm run test -- --coverage

# Run specific test file
npm run test -- src/test/auth.test.ts

# Watch mode
npm run test:watch
```

**Coverage Requirements:**

- Minimum 80% code coverage
- All critical paths must be tested
- Mock external dependencies

### 2. Integration Tests

Tests complete API workflows and interactions between components.

```bash
# Run integration tests
npm run test:integration

# Run specific integration test
npm run test -- src/test/integration/api-integration.test.ts
```

**Test Scenarios:**

- Complete audit workflow (registration → contract upload → analysis → report generation)
- Authentication flows
- Error handling
- Rate limiting
- Data validation

### 3. Load Tests

Performance and scalability testing using Artillery.

```bash
# Run load tests
npm run test:load

# Run with detailed report
npm run test:load-report
```

**Load Test Scenarios:**

- Authentication under load
- Contract upload performance
- Analysis queue handling
- Report generation scalability
- Concurrent user simulation

**Performance Targets:**

- Response time < 2s for 95% of requests
- Support 100 concurrent users
- Handle 1000 requests/minute
- Memory usage < 512MB under load

### 4. End-to-End Tests

Full user journey testing using Playwright (run from frontend directory).

```bash
cd ../frontend

# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e-ui

# Debug mode
npm run test:e2e-debug

# View reports
npm run test:e2e-report
```

**E2E Test Coverage:**

- Complete audit workflow
- Mobile responsiveness
- Theme switching
- Error handling
- Cross-browser compatibility

## Test Data Management

### Fixtures

Test data is managed through fixtures in `src/test/fixtures/`:

- `contracts.ts` - Sample contracts with known vulnerabilities
- `seed-database.ts` - Database seeding utilities

### Database Seeding

```bash
# Seed test data
npm run seed:test-data
```

**Available Test Contracts:**

- `SIMPLE_TOKEN` - Basic ERC20-like token
- `VULNERABLE_BANK` - Contract with reentrancy vulnerability
- `INSECURE_OWNERSHIP` - Contract with access control issues
- `GAS_INEFFICIENT` - Contract with gas optimization opportunities
- `COMPLEX_VULNERABLE` - Multi-vulnerability contract

## Running All Tests

### Comprehensive Test Runner

```bash
# Run all test types
npm run test:all

# Run only unit tests
npm run test:all-unit

# Run only integration tests
npm run test:all-integration

# Run only load tests
npm run test:all-load
```

### Manual Test Execution

```bash
# 1. Setup environment
cp .env.example .env
npm run migrate
npm run seed:test-data

# 2. Run tests in sequence
npm test                    # Unit tests
npm run test:integration    # Integration tests
npm run test:load          # Load tests

# 3. Generate documentation
npm run docs:generate
```

## Continuous Integration

### GitHub Actions Pipeline

The CI/CD pipeline (`.github/workflows/ci-cd.yml`) includes:

1. **Code Quality** - Linting and type checking
2. **Security Scanning** - Vulnerability detection
3. **Unit Tests** - With coverage reporting
4. **Integration Tests** - API workflow validation
5. **E2E Tests** - Full user journey testing
6. **Load Tests** - Performance validation (nightly)
7. **Build & Deploy** - Production deployment

### Pipeline Triggers

- **Push to main/develop** - Full pipeline
- **Pull Requests** - Quality checks and tests
- **Nightly Schedule** - Load tests and security scans

## Test Environment Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Python 3.8+ (for Slither)

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/auditwolf_test
REDIS_URL=redis://localhost:6379

# API Keys (for integration tests)
OPENROUTER_API_KEY=your_test_key
SENDERWOLF_API_KEY=your_test_key

# Test Configuration
NODE_ENV=test
LOG_LEVEL=error
```

### Docker Setup (Optional)

```bash
# Start test services
docker-compose -f docker-compose.test.yml up -d

# Run tests
npm run test:all

# Cleanup
docker-compose -f docker-compose.test.yml down
```

## Test Configuration

### Jest Configuration

Located in `jest.config.js`:

- TypeScript support
- Coverage thresholds
- Test environment setup
- Mock configurations

### Artillery Configuration

Located in `src/test/load/artillery-config.yml`:

- Load phases (warm-up, ramp-up, sustained, peak)
- Performance targets
- Custom metrics
- Error handling

### Playwright Configuration

Located in `../frontend/playwright.config.ts`:

- Browser configurations
- Test timeouts
- Retry strategies
- Reporting options

## Debugging Tests

### Unit Test Debugging

```bash
# Debug specific test
npm run test -- --testNamePattern="should create contract" --verbose

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Integration Test Debugging

```bash
# Enable debug logging
DEBUG=audit-wolf:* npm run test:integration

# Run single integration test
npm run test -- src/test/integration/api-integration.test.ts --verbose
```

### Load Test Debugging

```bash
# Run with detailed output
npx artillery run src/test/load/artillery-config.yml --output results.json
npx artillery report results.json --output report.html
```

## Performance Monitoring

### Metrics Collected

- Response times (p50, p95, p99)
- Throughput (requests/second)
- Error rates
- Memory usage
- CPU utilization
- Database query performance

### Performance Thresholds

- API response time: < 2s (95th percentile)
- Database queries: < 500ms
- Memory usage: < 512MB
- Error rate: < 1%

## Security Testing

### Automated Security Checks

- Dependency vulnerability scanning
- SAST (Static Application Security Testing)
- API security testing
- Input validation testing

### Manual Security Testing

- Authentication bypass attempts
- SQL injection testing
- XSS prevention validation
- Rate limiting verification

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check database status
pg_isready -h localhost -p 5432

# Reset test database
dropdb auditwolf_test
createdb auditwolf_test
npm run migrate
```

#### Redis Connection Errors

```bash
# Check Redis status
redis-cli ping

# Restart Redis
redis-server --daemonize yes
```

#### Test Timeouts

- Increase timeout in test configuration
- Check system resources
- Verify external service availability

#### Memory Issues

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run test:all
```

## Best Practices

### Writing Tests

1. **Arrange-Act-Assert** pattern
2. **Descriptive test names**
3. **Independent tests** (no shared state)
4. **Mock external dependencies**
5. **Test edge cases and error conditions**

### Test Data

1. **Use fixtures** for consistent test data
2. **Clean up** after each test
3. **Avoid hardcoded values**
4. **Test with realistic data sizes**

### Performance Testing

1. **Baseline measurements** before changes
2. **Gradual load increase**
3. **Monitor system resources**
4. **Test failure scenarios**

## Reporting

### Test Reports

- **Coverage Report**: `coverage/lcov-report/index.html`
- **Load Test Report**: `load-test-report.html`
- **E2E Test Report**: `playwright-report/index.html`
- **Integration Results**: `test-results.json`

### CI/CD Reports

- **GitHub Actions**: Workflow summaries
- **Codecov**: Coverage tracking
- **Artillery**: Performance metrics
- **Playwright**: Cross-browser results

## Contributing

### Adding New Tests

1. Follow existing test patterns
2. Update documentation
3. Ensure CI/CD compatibility
4. Add appropriate fixtures

### Modifying Test Configuration

1. Test changes locally
2. Update documentation
3. Verify CI/CD pipeline
4. Consider backward compatibility

## Support

For questions or issues with the testing suite:

1. Check this documentation
2. Review existing test examples
3. Check CI/CD logs
4. Create an issue with detailed information

---

**Last Updated**: January 2025
**Version**: 1.0.0
