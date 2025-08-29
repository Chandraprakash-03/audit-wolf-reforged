# AI Analysis Service

The AI Analysis Service provides intelligent security analysis of smart contracts using multiple Large Language Models (LLMs) through OpenRouter.

## Features

### Multi-Model Ensemble Analysis

- Uses multiple AI models simultaneously for comprehensive analysis
- Combines results using consensus algorithms
- Supports OpenAI GPT-4, Anthropic Claude, and Google Gemini models
- Configurable ensemble threshold for vulnerability consensus

### Vulnerability Detection

- **Reentrancy vulnerabilities**: Detects potential reentrancy attacks
- **Access control issues**: Identifies improper permission handling
- **Integer overflow/underflow**: Finds arithmetic vulnerabilities
- **Gas optimization opportunities**: Suggests efficiency improvements
- **Best practice violations**: Highlights code quality issues

### Analysis Features

- **Confidence scoring**: Each finding includes a confidence level (0-1)
- **Code location mapping**: Precise line and column identification
- **Security recommendations**: Actionable remediation guidance
- **Quality metrics**: Code quality, maintainability, and test coverage estimates

## Configuration

### Environment Variables

```bash
# OpenRouter API key for AI model access
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here

# Optional: LangChain API key for advanced features
LANGCHAIN_API_KEY=lsv2_pt_your-langchain-key-here
```

### Model Configuration

```typescript
const aiAnalyzer = new AIAnalyzer({
	timeout: 180000, // 3 minutes
	maxTokens: 4000,
	temperature: 0.1, // Low temperature for consistent results
	models: [
		"openai/gpt-4o-mini",
		"anthropic/claude-3.5-sonnet",
		"google/gemini-pro-1.5",
	],
	ensembleThreshold: 0.6, // 60% consensus required
});
```

## Usage

### Basic AI Analysis

```typescript
const result = await aiAnalyzer.analyzeContract(sourceCode, "MyContract", {
	includeRecommendations: true,
	includeQualityMetrics: true,
	focusAreas: ["reentrancy", "access control"],
	severityThreshold: "medium",
});

if (result.success) {
	console.log(`Found ${result.result.vulnerabilities.length} vulnerabilities`);
	console.log(`Analysis confidence: ${result.result.confidence}`);
}
```

### Integration with Analysis Service

```typescript
// Start AI-only analysis
const aiResult = await analysisService.startAIAnalysis({
	contractId: "contract-uuid",
	userId: "user-uuid",
	analysisType: "ai",
});

// Start combined static + AI analysis
const fullResult = await analysisService.startFullAnalysis({
	contractId: "contract-uuid",
	userId: "user-uuid",
	analysisType: "full",
});
```

## API Endpoints

### Start AI Analysis

```http
POST /api/analysis/start
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "contractId": "uuid",
  "analysisType": "ai"
}
```

### Get Analysis Progress

```http
GET /api/analysis/{auditId}/progress
Authorization: Bearer <jwt-token>
```

### Get Analysis Results

```http
GET /api/analysis/{auditId}/results
Authorization: Bearer <jwt-token>
```

## Response Format

### AI Analysis Result

```typescript
interface AIAnalysisResult {
	vulnerabilities: AIVulnerability[];
	recommendations: SecurityRecommendation[];
	code_quality: QualityMetrics;
	confidence: number; // 0-1
}

interface AIVulnerability {
	type:
		| "reentrancy"
		| "overflow"
		| "access_control"
		| "gas_optimization"
		| "best_practice";
	severity: "critical" | "high" | "medium" | "low" | "informational";
	description: string;
	location: {
		file: string;
		line: number;
		column: number;
		length?: number;
	};
	confidence: number; // 0-1
}
```

## Error Handling

### Common Error Scenarios

- **API key not configured**: Check OPENROUTER_API_KEY environment variable
- **Model unavailable**: Fallback to available models automatically
- **Rate limiting**: Implements exponential backoff retry logic
- **Timeout**: Configurable timeout with graceful failure
- **Invalid contract**: Returns validation errors with suggestions

### Health Check

```typescript
const health = await AIAnalyzer.checkConfiguration();
console.log(`AI configured: ${health.configured}`);
console.log(`Available models: ${health.availableModels.join(", ")}`);
```

## Performance Considerations

### Optimization Strategies

- **Parallel model execution**: All models run simultaneously
- **Response caching**: Cache results for identical contracts
- **Token optimization**: Efficient prompts to minimize API costs
- **Timeout management**: Prevents hanging requests

### Cost Management

- Uses cost-effective models (GPT-4o-mini) as primary
- Configurable token limits to control API usage
- Ensemble approach reduces need for expensive models

## Security Features

### Input Validation

- Contract size limits (10MB max)
- Source code sanitization
- Malicious code detection

### Output Validation

- Confidence score validation (0-1 range)
- Severity level normalization
- Location coordinate validation
- Response format validation

## Testing

### Unit Tests

```bash
npm run test:ai
```

### Integration Tests

```bash
npm run test:ai-integration
```

### Mock Testing

All tests use mocked AI responses for deterministic results and fast execution.

## Monitoring and Logging

### Key Metrics

- Analysis success rate
- Average execution time
- Model availability
- Confidence score distribution
- Vulnerability detection rates

### Logging

- Request/response logging for debugging
- Performance metrics collection
- Error tracking and alerting
- Model usage statistics

## Future Enhancements

### Planned Features

- **Custom model fine-tuning**: Train models on audit-specific data
- **Real-time analysis**: Stream results as they're generated
- **Collaborative filtering**: Learn from user feedback
- **Advanced ensemble methods**: Weighted voting based on model performance
- **Specialized detectors**: Domain-specific vulnerability detection
