# Structured Output Implementation for AI Analysis

## Overview

This implementation addresses the JSON parsing errors you were experiencing by implementing **structured output** using LangChain's `JsonOutputParser` combined with **Zod schema validation**. This ensures AI models return properly formatted JSON responses.

## Key Changes Made

### 1. Added Zod Schema Validation

```typescript
// Zod schemas for structured output validation
const CodeLocationSchema = z.object({
	file: z.string().default("contract.sol"),
	line: z.number().int().min(1).default(1),
	column: z.number().int().min(1).default(1),
	length: z.number().int().min(1).optional(),
});

const VulnerabilitySchema = z.object({
	type: z.enum([
		"reentrancy",
		"overflow",
		"access_control",
		"gas_optimization",
		"best_practice",
	]),
	severity: z.enum(["critical", "high", "medium", "low", "informational"]),
	description: z.string().min(1),
	location: CodeLocationSchema,
	confidence: z.number().min(0).max(1),
});

const AIAnalysisSchema = z.object({
	vulnerabilities: z.array(VulnerabilitySchema),
	recommendations: z.array(RecommendationSchema),
	qualityMetrics: QualityMetricsSchema,
	confidence: z.number().min(0).max(1),
});
```

### 2. Replaced String Parsing with JsonOutputParser

**Before:**

```typescript
// Old unreliable approach
const jsonMatch = response.match(/\{[\s\S]*\}/);
const parsed = JSON.parse(jsonMatch[0]);
```

**After:**

```typescript
// New structured approach
const chain = RunnableSequence.from([
    promptTemplate,
    model,
    this.outputParser, // JsonOutputParser handles JSON extraction
]);

const response = await chain.invoke({...});
const validated = AIAnalysisSchema.parse(response); // Zod validation
```

### 3. Enhanced Prompt Instructions

The prompt now includes explicit JSON format requirements:

```typescript
IMPORTANT: You MUST respond with valid JSON only. Do not include any text before or after the JSON object.

Required JSON structure:
{
  "vulnerabilities": [...],
  "recommendations": [...],
  "qualityMetrics": {...},
  "confidence": 0.88
}
```

### 4. Fallback Mechanism

Added a fallback parser for models that still don't follow structured output:

```typescript
private async fallbackAnalysis(model, sourceCode, contractName, options, modelName) {
    // Multiple JSON extraction strategies:
    // 1. Direct JSON object matching
    // 2. JSON within code blocks
    // 3. Zod validation as final step
}
```

## Benefits

### ✅ Eliminates JSON Parsing Errors

- **Before**: `SyntaxError: Expected property name or '}' in JSON at position 6`
- **After**: Structured validation ensures valid JSON or graceful fallback

### ✅ Type Safety

- Zod schemas provide runtime type checking
- TypeScript integration for compile-time safety
- Automatic data transformation and validation

### ✅ Better Error Handling

- Detailed error logging with response content
- Graceful fallbacks for failed models
- Multiple parsing strategies

### ✅ Consistent Data Structure

- Enforced schema ensures all responses match expected format
- Default values for missing fields
- Validation of enums and ranges

## Usage Example

```typescript
const analyzer = new AIAnalyzer({
	models: ["deepseek/deepseek-chat-v3.1:free"],
	timeout: 60000,
});

const result = await analyzer.analyzeContract(sourceCode, "MyContract", {
	includeRecommendations: true,
});

// result.success will be true with valid structured data
// or false with detailed error information
```

## Testing

Run the test script to verify the implementation:

```bash
cd backend
npm run build
node test-structured-output.js
```

## Error Resolution

The structured output approach resolves these common issues:

1. **"No JSON found in model response"** → JsonOutputParser extracts JSON reliably
2. **"SyntaxError: Expected property name"** → Zod validation catches malformed JSON
3. **Missing or invalid fields** → Schema defaults and validation ensure data integrity
4. **Inconsistent response formats** → Enforced structure across all models

## Next Steps

1. **Monitor Performance**: Check if structured output affects response times
2. **Model-Specific Tuning**: Some models may need adjusted prompts
3. **Schema Evolution**: Update Zod schemas as analysis requirements change
4. **Caching**: Consider caching validated responses to improve performance

This implementation provides a robust foundation for reliable AI analysis with consistent, validated JSON responses.
