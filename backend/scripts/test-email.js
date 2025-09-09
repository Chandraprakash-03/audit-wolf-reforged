async function testEmailService() {
    console.log('Testing Senderwolf email service...');

    // Check if configuration is available
    const smtpUser = process.env.SMTP_USER || process.env.SENDERWOLF_FROM_EMAIL;
    const smtpPass = process.env.SMTP_PASS || process.env.SENDERWOLF_APP_PASSWORD;

    if (!smtpUser || !smtpPass) {
        console.log('❌ Email configuration missing');
        console.log('\n📝 Configuration checklist:');
        console.log('- Set SMTP_USER or SENDERWOLF_FROM_EMAIL');
        console.log('- Set SMTP_PASS or SENDERWOLF_APP_PASSWORD');
        console.log('- For Gmail, use an App Password instead of your regular password');
        console.log('- Ensure SMTP_HOST and SMTP_PORT are correct');
        console.log('\nExample .env configuration:');
        console.log('SMTP_HOST=smtp.gmail.com');
        console.log('SMTP_PORT=465');
        console.log('SMTP_USER=your-email@gmail.com');
        console.log('SMTP_PASS=your-app-password');
        return;
    }

    try {
        // Dynamic import for ES module
        const { sendEmail } = await import('senderwolf');

        // Test basic email sending
        const result = await sendEmail({
            smtp: {
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT || '465'),
                secure: process.env.SMTP_SECURE !== 'false',
                auth: {
                    user: smtpUser,
                    pass: smtpPass,
                },
            },
            mail: {
                to: process.env.SENDERWOLF_FROM_EMAIL || smtpUser,
                subject: 'Audit Wolf Email Service Test',
                html: `
          <h2>Email Service Test</h2>
          <p>This is a test email from the Audit Wolf email service.</p>
          <p>If you receive this email, the service is working correctly!</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        `,
                fromName: 'Audit Wolf Test',
                fromEmail: process.env.SENDERWOLF_FROM_EMAIL || smtpUser,
            },
        });

        if (result.success) {
            console.log('✅ Email sent successfully!');
            console.log('Message ID:', result.messageId);
        } else {
            console.log('❌ Email failed to send');
            console.log('Error:', result.error);
        }
    } catch (error) {
        console.error('❌ Email service test failed:', error.message);
        console.log('\n📝 Configuration checklist:');
        console.log('- Set SMTP_USER or SENDERWOLF_FROM_EMAIL');
        console.log('- Set SMTP_PASS or SENDERWOLF_APP_PASSWORD');
        console.log('- For Gmail, use an App Password instead of your regular password');
        console.log('- Ensure SMTP_HOST and SMTP_PORT are correct');
    }
}

// Run the test
testEmailService();