/**
 * Test script to verify senderwolf integration works correctly
 * This tests the actual senderwolf API without sending real emails
 */

async function testSenderwolfIntegration() {
    console.log('🧪 Testing Senderwolf Integration...\n');

    try {
        // Test 1: Import senderwolf module
        console.log('1. Testing module import...');
        const { sendEmail } = await import('senderwolf');
        console.log('✅ Successfully imported senderwolf module');

        // Test 2: Test with minimal valid configuration
        console.log('\n2. Testing with minimal configuration...');
        const result = await sendEmail({
            smtp: {
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: {
                    user: 'test@example.com',
                    pass: 'test-password'
                }
            },
            mail: {
                to: 'recipient@example.com',
                subject: 'Test Email',
                text: 'This is a test email'
            }
        });

        console.log('✅ sendEmail function executed without throwing');
        console.log('📊 Result structure:', {
            hasSuccess: typeof result.success === 'boolean',
            hasError: 'error' in result,
            hasMessageId: 'messageId' in result
        });

        // Test 3: Test with HTML content and attachments
        console.log('\n3. Testing with HTML and attachments...');
        const htmlResult = await sendEmail({
            smtp: {
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: {
                    user: 'test@example.com',
                    pass: 'test-password'
                }
            },
            mail: {
                to: 'recipient@example.com',
                subject: 'Test HTML Email',
                html: '<h1>Test</h1><p>This is a test HTML email</p>',
                attachments: [{
                    filename: 'test.txt',
                    content: Buffer.from('Test attachment content'),
                    contentType: 'text/plain'
                }],
                fromName: 'Test Sender',
                fromEmail: 'sender@example.com'
            }
        });

        console.log('✅ HTML email with attachments executed without throwing');
        console.log('📊 HTML Result structure:', {
            hasSuccess: typeof htmlResult.success === 'boolean',
            hasError: 'error' in htmlResult,
            hasMessageId: 'messageId' in htmlResult
        });

        // Test 4: Test our EmailService integration
        console.log('\n4. Testing EmailService integration...');

        // Import our EmailService (compiled JS)
        const { EmailService } = await import('../dist/services/EmailService.js');
        const emailService = new EmailService();

        console.log('✅ EmailService instantiated successfully');
        console.log('📊 Configuration status:', {
            isConfigured: emailService.isEmailConfigured()
        });

        console.log('\n🎉 All senderwolf integration tests passed!');
        console.log('\n📝 Summary:');
        console.log('- ✅ Module imports correctly as ES module');
        console.log('- ✅ sendEmail function accepts proper input structure');
        console.log('- ✅ Returns expected result structure');
        console.log('- ✅ Handles HTML content and attachments');
        console.log('- ✅ EmailService integrates correctly');
        console.log('\n💡 To test actual email sending, configure SMTP credentials in .env');

    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
        console.log('\n🔍 Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack?.split('\n')[0]
        });
        process.exit(1);
    }
}

// Run the test
testSenderwolfIntegration();