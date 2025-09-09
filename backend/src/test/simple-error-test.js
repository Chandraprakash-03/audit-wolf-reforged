// Simple test to verify error handling implementation
const { createError, ErrorTypes } = require('../dist/middleware/errorHandler');

console.log('Testing error handling implementation...');

try {
    // Test error creation
    const validationError = createError('VALIDATION_ERROR', 'Test validation failed');
    console.log('✓ Validation error created:', validationError.message);

    const authError = createError('UNAUTHORIZED', 'Test auth failed');
    console.log('✓ Auth error created:', authError.message);

    // Test error types
    console.log('✓ Error types available:', Object.keys(ErrorTypes).length);

    console.log('✓ All error handling tests passed!');
} catch (error) {
    console.error('✗ Error handling test failed:', error.message);
    process.exit(1);
}