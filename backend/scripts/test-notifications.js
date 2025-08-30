const dotenv = require('dotenv');
dotenv.config();

async function testNotificationSystem() {
    console.log('🧪 Testing Audit Wolf Notification System...\n');

    try {
        // Use require for CommonJS module
        const EmailService = require('../dist/services/EmailService.js').default;

        const emailService = new EmailService();

        // Test 1: Check email service configuration
        console.log('1️⃣ Testing email service configuration...');
        const isConfigured = emailService.isEmailConfigured();
        console.log(`   Email service configured: ${isConfigured ? '✅' : '❌'}`);

        if (!isConfigured) {
            console.log('\n📝 Email configuration missing. Set these environment variables:');
            console.log('   - SMTP_HOST (e.g., smtp.gmail.com)');
            console.log('   - SMTP_PORT (e.g., 465)');
            console.log('   - SMTP_USER (your email address)');
            console.log('   - SMTP_PASS (your app password)');
            console.log('   - SENDERWOLF_FROM_EMAIL (sender email)');
            console.log('   - SENDERWOLF_FROM_NAME (sender name)');
            return;
        }

        // Test 2: Test connection
        console.log('\n2️⃣ Testing email connection...');
        const connectionTest = await emailService.testConnection();
        console.log(`   Connection test: ${connectionTest ? '✅' : '❌'}`);

        if (!connectionTest) {
            console.log('   ❌ Email connection failed. Check your SMTP credentials.');
            return;
        }

        // Test 3: Test welcome email template
        console.log('\n3️⃣ Testing welcome email template...');
        try {
            const welcomeResult = await emailService.sendWelcomeEmail(
                process.env.SENDERWOLF_FROM_EMAIL || process.env.SMTP_USER,
                'Test Developer'
            );
            console.log(`   Welcome email: ${welcomeResult ? '✅' : '❌'}`);
        } catch (error) {
            console.log(`   Welcome email: ❌ (${error.message})`);
        }

        // Test 4: Test audit started email template
        console.log('\n4️⃣ Testing audit started email template...');
        try {
            const startedResult = await emailService.sendAuditStartedEmail(
                process.env.SENDERWOLF_FROM_EMAIL || process.env.SMTP_USER,
                'TestContract.sol',
                'test-audit-123',
                '3-5 minutes'
            );
            console.log(`   Audit started email: ${startedResult ? '✅' : '❌'}`);
        } catch (error) {
            console.log(`   Audit started email: ❌ (${error.message})`);
        }

        // Test 5: Test audit completion email template
        console.log('\n5️⃣ Testing audit completion email template...');
        try {
            const mockPdfBuffer = Buffer.from('Mock PDF content for testing');
            const completionResult = await emailService.sendAuditCompletionEmail(
                process.env.SENDERWOLF_FROM_EMAIL || process.env.SMTP_USER,
                'TestContract.sol',
                'test-audit-123',
                mockPdfBuffer,
                3, // vulnerabilities
                2  // gas optimizations
            );
            console.log(`   Audit completion email: ${completionResult ? '✅' : '❌'}`);
        } catch (error) {
            console.log(`   Audit completion email: ❌ (${error.message})`);
        }

        // Test 6: Test audit failure email template
        console.log('\n6️⃣ Testing audit failure email template...');
        try {
            const failureResult = await emailService.sendAuditFailureEmail(
                process.env.SENDERWOLF_FROM_EMAIL || process.env.SMTP_USER,
                'TestContract.sol',
                'test-audit-123',
                'Contract compilation failed: Missing import statement'
            );
            console.log(`   Audit failure email: ${failureResult ? '✅' : '❌'}`);
        } catch (error) {
            console.log(`   Audit failure email: ❌ (${error.message})`);
        }

        console.log('\n🎉 Notification system testing complete!');
        console.log('\n📧 Check your email inbox for the test notifications.');
        console.log('   All email templates have been tested with sample data.');

    } catch (error) {
        console.error('\n❌ Notification system test failed:', error.message);
        console.log('\n🔧 Troubleshooting steps:');
        console.log('1. Make sure the backend is built: npm run build');
        console.log('2. Check your email configuration in .env file');
        console.log('3. Verify SMTP credentials are correct');
        console.log('4. For Gmail, use an App Password instead of regular password');
    }
}

// Run the test
testNotificationSystem();