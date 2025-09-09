# Slither Static Analysis Integration

This document describes the Slither static analysis integration implemented for Audit Wolf.

## Overview

The Slither integration provides automated static analysis of Solidity smart contracts using the [Slither](https://github.com/crytic/slither) static analyzer. This implementation includes:

- **SlitherAnalyzer**: Core service for running Slither analysis
- **AnalysisService**: High-level service for managing analysis workflows
- **Analysis API Routes**: REST endpoints for triggering and monitoring analysis
- **Error Handling**: Comprehensive error handling and timeout management
- **AST Parsing**: Abstract Syntax Tree extraction for advanced analysis

## Features

### Static Analysis Capabilities

- **Vulnerability Detection**: Identifies common security vulnerabilities including:

  - Reentrancy attacks
  - Access control issues
  - Integer overflow/underflow
  - Gas optimization opportunities
  - Best practice violations

- **Configurable Detectors**: Support for enabling/disabling specific Slither detectors
- **Timeout Management**: Configurable timeouts to prevent hanging analysis
- **File Size Limits**: Protection against oversized contracts
- **Progress Tracking**: Real-time progress updates for long-running analysis

### Supported Vulnerability Types

The integration maps Slither detectors to standardized vulnerability categories:

| Slither Detector    | Mapped Type        | Description                    |
| ------------------- | ------------------ | ------------------------------ |
| `reentrancy-*`      | `reentrancy`       | Reentrancy vulnerabilities     |
| `arbitrary-send`    | `access_control`   | Unauthorized fund transfers    |
| `tx-origin`         | `access_control`   | tx.origin usage issues         |
| `unused-state`      | `gas_optimization` | Unused state variables         |
| `external-function` | `gas_optimization` | Functions that can be external |
| `pragma`            | `best_practice`    | Pragma version issues          |

## Installation

### Prerequisites

- Python 3.8 or higher
- pip package manager
- Solidity compiler (optional, for better analysis)

### Automatic Installation

Use the provided installation scripts:

**Linux/macOS:**

```bash
chmod +x backend/scripts/install-slither.sh
./backend/scripts/install-slither.sh
```

**Windows:**

```cmd
backend\scripts\install-slither.bat
```

### Manual Installation

```bash
# Install Slither
pip install slither-analyzer

# Install Solidity compiler manager (optional)
pip install solc-select

# Install and use a specific Solidity version
solc-select install 0.8.19
solc-select use 0.8.19
```

### Verification

Test the installation:

```bash
slither --version
```

## Usage

### Starting Static Analysis

```typescript
import { AnalysisService } from "./services/AnalysisService";

const analysisService = new AnalysisService();

// Start analysis for a contract
const result = await analysisService.startStaticAnalysis({
	contractId: "contract-uuid",
	userId: "user-uuid",
	analysisType: "static",
});

if (result.success) {
	console.log("Analysis started:", result.auditId);
}
```

### Monitoring Progress

```typescript
// Get analysis progress
const progress = await analysisService.getAnalysisProgress(auditId, userId);

console.log(`Progress: ${progress.progress?.progress}%`);
console.log(`Status: ${progress.progress?.currentStep}`);
```

### Getting Results

```typescript
// Get completed analysis results
const results = await analysisService.getAnalysisResults(auditId, userId);

if (results.success) {
	console.log(
		`Found ${results.results?.summary.totalVulnerabilities} vulnerabilities`
	);
	console.log(
		"Severity breakdown:",
		results.results?.summary.severityBreakdown
	);
}
```

### Contract Validation

```typescript
// Quick validation before full analysis
const validation = await analysisService.validateContract(sourceCode);

if (validation.isValid) {
	console.log(
		`Estimated analysis time: ${validation.quickScan?.estimatedAnalysisTime}s`
	);
} else {
	console.log("Validation errors:", validation.errors);
}
```

## API Endpoints

### POST /api/analysis/start

Start a new static analysis.

**Request:**

```json
{
	"contractId": "uuid",
	"analysisType": "static"
}
```

**Response:**

```json
{
	"success": true,
	"data": {
		"auditId": "uuid",
		"message": "Analysis started successfully"
	}
}
```

### GET /api/analysis/:auditId/progress

Get analysis progress.

**Response:**

```json
{
	"success": true,
	"data": {
		"auditId": "uuid",
		"status": "analyzing",
		"progress": 50,
		"currentStep": "Running security analysis"
	}
}
```

### GET /api/analysis/:auditId/results

Get analysis results.

**Response:**

```json
{
	"success": true,
	"data": {
		"audit": {
			/* audit object */
		},
		"vulnerabilities": [
			/* vulnerability objects */
		],
		"summary": {
			"totalVulnerabilities": 5,
			"severityBreakdown": {
				"critical": 1,
				"high": 2,
				"medium": 1,
				"low": 1
			},
			"executionTime": 15000
		}
	}
}
```

### POST /api/analysis/validate

Validate contract source code.

**Request:**

```json
{
	"sourceCode": "pragma solidity ^0.8.0; contract Test {}"
}
```

**Response:**

```json
{
	"success": true,
	"data": {
		"isValid": true,
		"errors": [],
		"warnings": [],
		"quickScan": {
			"potentialIssues": 2,
			"estimatedAnalysisTime": 30
		}
	}
}
```

### GET /api/analysis/health

Check system health and Slither installation.

**Response:**

```json
{
	"success": true,
	"data": {
		"slitherInstalled": true,
		"slitherVersion": "0.9.6",
		"systemReady": true,
		"errors": []
	}
}
```

## Configuration

### SlitherAnalyzer Configuration

```typescript
const analyzer = new SlitherAnalyzer({
	timeout: 120000, // 2 minutes timeout
	maxFileSize: 10485760, // 10MB max file size
	outputFormat: "json", // Output format
	enabledDetectors: [
		// Specific detectors to enable
		"reentrancy-eth",
		"arbitrary-send",
		"tx-origin",
	],
	disabledDetectors: [
		// Detectors to disable
		"naming-convention",
	],
});
```

### Environment Variables

```bash
# Optional: Custom Slither path
SLITHER_PATH=/custom/path/to/slither

# Optional: Analysis timeout (milliseconds)
ANALYSIS_TIMEOUT=120000

# Optional: Max contract size (bytes)
MAX_CONTRACT_SIZE=10485760
```

## Error Handling

The integration includes comprehensive error handling for:

- **Installation Issues**: Slither not found or incorrectly installed
- **Execution Timeouts**: Long-running analysis that exceeds timeout
- **Memory Limits**: Contracts that are too large to analyze
- **Compilation Errors**: Invalid Solidity code
- **System Errors**: File system or permission issues

### Common Error Scenarios

1. **Slither Not Installed**

   ```json
   {
   	"success": false,
   	"error": "Slither execution failed: Command not found"
   }
   ```

2. **Analysis Timeout**

   ```json
   {
   	"success": false,
   	"error": "Analysis timed out"
   }
   ```

3. **Contract Too Large**
   ```json
   {
   	"success": false,
   	"error": "Contract size exceeds maximum limit of 10485760 bytes"
   }
   ```

## Testing

### Unit Tests

Run the Slither analyzer tests:

```bash
npm test -- slither.test.ts
```

Run the analysis service tests:

```bash
npm test -- analysis.test.ts
```

### Integration Tests

Test with a real contract:

```bash
# Start the backend server
npm run dev

# Test analysis endpoint
curl -X POST http://localhost:3001/api/analysis/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"contractId": "contract-uuid", "analysisType": "static"}'
```

## Performance Considerations

### Analysis Time

Analysis time depends on contract complexity:

- **Simple contracts** (< 100 lines): 5-15 seconds
- **Medium contracts** (100-500 lines): 15-60 seconds
- **Complex contracts** (> 500 lines): 1-5 minutes

### Resource Usage

- **Memory**: ~100-500MB per analysis
- **CPU**: Single-threaded Slither execution
- **Disk**: Temporary files created and cleaned up
- **Network**: No external network calls required

### Optimization Tips

1. **Enable specific detectors** only for faster analysis
2. **Set appropriate timeouts** based on expected contract complexity
3. **Implement caching** for repeated analysis of same contracts
4. **Use background processing** for long-running analysis

## Troubleshooting

### Common Issues

1. **"Command not found" error**

   - Ensure Slither is installed: `pip install slither-analyzer`
   - Check PATH includes Python scripts directory

2. **"Permission denied" error**

   - Ensure write permissions for temporary directory
   - Check file system permissions

3. **"Analysis timeout" error**

   - Increase timeout configuration
   - Check contract complexity
   - Verify system resources

4. **"Invalid JSON output" error**
   - Update Slither to latest version
   - Check for Slither compatibility issues

### Debug Mode

Enable debug logging:

```bash
export DEBUG=slither:*
npm run dev
```

### System Health Check

Use the health endpoint to verify system status:

```bash
curl http://localhost:3001/api/analysis/health \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Future Enhancements

Planned improvements for the Slither integration:

1. **Parallel Analysis**: Support for analyzing multiple contracts simultaneously
2. **Custom Detectors**: Integration of custom security detectors
3. **Caching**: Result caching for improved performance
4. **Real-time Updates**: WebSocket-based progress updates
5. **Advanced Reporting**: Enhanced vulnerability reporting with code snippets
6. **Integration Testing**: Automated testing with various contract types

## References

- [Slither Documentation](https://github.com/crytic/slither)
- [Slither Detectors](https://github.com/crytic/slither/wiki/Detector-Documentation)
- [Solidity Security Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [Trail of Bits Security Tools](https://www.trailofbits.com/tools)
