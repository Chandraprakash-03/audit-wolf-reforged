// Import will be done dynamically to handle ES module
/// <reference path="../types/senderwolf.d.ts" />

export interface EmailAttachment {
	filename: string;
	content: Buffer;
	contentType: string;
}

export interface EmailOptions {
	to: string;
	subject: string;
	html?: string;
	text?: string;
	attachments?: EmailAttachment[];
}

export class EmailService {
	private fromEmail: string;
	private fromName: string;
	private smtpConfig: {
		host: string;
		port: number;
		secure: boolean;
		auth: {
			user: string;
			pass: string;
		};
	};
	private isConfigured: boolean = false;

	constructor() {
		// Load SMTP configuration from environment variables
		this.fromEmail =
			process.env.SENDERWOLF_FROM_EMAIL || "noreply@auditwolf.com";
		this.fromName = process.env.SENDERWOLF_FROM_NAME || "Audit Wolf";

		this.smtpConfig = {
			host: process.env.SMTP_HOST || "smtp.gmail.com",
			port: parseInt(process.env.SMTP_PORT || "465"),
			secure: process.env.SMTP_SECURE !== "false", // Default to true
			auth: {
				user: process.env.SMTP_USER || this.fromEmail,
				pass:
					process.env.SMTP_PASS || process.env.SENDERWOLF_APP_PASSWORD || "",
			},
		};

		// Check if email is properly configured
		if (
			!this.smtpConfig.auth.pass ||
			this.smtpConfig.auth.pass === "your_senderwolf_api_key"
		) {
			console.warn(
				"Warning: No SMTP password configured. Email functionality will be disabled."
			);
			this.isConfigured = false;
		} else {
			this.isConfigured = true;
		}
	}

	/**
	 * Send an email with optional attachments
	 */
	async sendEmail(options: EmailOptions): Promise<boolean> {
		if (!this.isConfigured) {
			console.warn("Email service not configured. Skipping email send.");
			return false;
		}

		try {
			// Convert attachments to senderwolf format
			const attachments =
				options.attachments?.map((attachment) => ({
					filename: attachment.filename,
					content: attachment.content,
					contentType: attachment.contentType,
				})) || [];

			const emailInput = {
				smtp: this.smtpConfig,
				mail: {
					to: options.to,
					subject: options.subject,
					html: options.html,
					text: options.text,
					attachments,
					fromName: this.fromName,
					fromEmail: this.fromEmail,
				},
			};

			// Dynamic import for ES module
			const { sendEmail } = await import("senderwolf");
			const result = await sendEmail(emailInput);

			if (result.success) {
				console.log("Email sent successfully:", {
					to: options.to,
					subject: options.subject,
					messageId: result.messageId,
				});
				return true;
			} else {
				console.error("Failed to send email:", result.error);
				return false;
			}
		} catch (error) {
			console.error("Failed to send email:", {
				to: options.to,
				subject: options.subject,
				error: error instanceof Error ? error.message : "Unknown error",
			});
			return false;
		}
	}

	/**
	 * Send audit completion notification with PDF report attachment
	 */
	async sendAuditCompletionEmail(
		userEmail: string,
		contractName: string,
		auditId: string,
		pdfBuffer: Buffer,
		vulnerabilityCount: number,
		gasOptimizations: number
	): Promise<boolean> {
		const subject = `Audit Complete: ${contractName}`;

		const html = this.generateAuditCompletionHTML({
			contractName,
			auditId,
			vulnerabilityCount,
			gasOptimizations,
		});

		const attachments: EmailAttachment[] = [
			{
				filename: `${contractName}_audit_report.pdf`,
				content: pdfBuffer,
				contentType: "application/pdf",
			},
		];

		return this.sendEmail({
			to: userEmail,
			subject,
			html,
			attachments,
		});
	}

	/**
	 * Send audit failure notification
	 */
	async sendAuditFailureEmail(
		userEmail: string,
		contractName: string,
		auditId: string,
		errorMessage: string
	): Promise<boolean> {
		const subject = `Audit Failed: ${contractName}`;

		const html = this.generateAuditFailureHTML({
			contractName,
			auditId,
			errorMessage,
		});

		return this.sendEmail({
			to: userEmail,
			subject,
			html,
		});
	}

	/**
	 * Generate HTML template for audit completion email
	 */
	private generateAuditCompletionHTML(data: {
		contractName: string;
		auditId: string;
		vulnerabilityCount: number;
		gasOptimizations: number;
	}): string {
		return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Audit Complete - ${data.contractName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }
        .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 8px 8px;
        }
        .stats {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat {
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
        }
        .cta-button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 0.9em;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ Audit Complete!</h1>
        <p>Your smart contract audit for <strong>${
					data.contractName
				}</strong> is ready</p>
    </div>
    
    <div class="content">
        <p>Great news! We've completed the security audit for your smart contract.</p>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-number">${data.vulnerabilityCount}</div>
                <div class="stat-label">Vulnerabilities Found</div>
            </div>
            <div class="stat">
                <div class="stat-number">${data.gasOptimizations}</div>
                <div class="stat-label">Gas Optimizations</div>
            </div>
        </div>
        
        <p><strong>What's included in your report:</strong></p>
        <ul>
            <li>Detailed vulnerability analysis with severity ratings</li>
            <li>Code location highlighting for each issue</li>
            <li>Remediation recommendations</li>
            <li>Gas optimization suggestions</li>
            <li>Executive summary and risk assessment</li>
        </ul>
        
        <p>Your comprehensive audit report is attached as a PDF. You can also view and download it anytime from your dashboard.</p>
        
        <a href="${
					process.env.FRONTEND_URL || "http://localhost:3000"
				}/dashboard" class="cta-button">View Dashboard</a>
        
        <div class="footer">
            <p><strong>Audit ID:</strong> ${data.auditId}</p>
            <p>If you have any questions about your audit results, please don't hesitate to contact our support team.</p>
            <p>Thank you for choosing Audit Wolf for your smart contract security needs!</p>
        </div>
    </div>
</body>
</html>
    `;
	}

	/**
	 * Generate HTML template for audit failure email
	 */
	private generateAuditFailureHTML(data: {
		contractName: string;
		auditId: string;
		errorMessage: string;
	}): string {
		return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Audit Failed - ${data.contractName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }
        .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 8px 8px;
        }
        .error-box {
            background: #fff5f5;
            border: 1px solid #fed7d7;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
        }
        .error-title {
            color: #c53030;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .error-message {
            color: #742a2a;
            font-family: monospace;
            font-size: 0.9em;
        }
        .cta-button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 0.9em;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚠️ Audit Failed</h1>
        <p>We encountered an issue while auditing <strong>${
					data.contractName
				}</strong></p>
    </div>
    
    <div class="content">
        <p>We're sorry, but we encountered an error while processing your smart contract audit.</p>
        
        <div class="error-box">
            <div class="error-title">Error Details:</div>
            <div class="error-message">${data.errorMessage}</div>
        </div>
        
        <p><strong>What happens next:</strong></p>
        <ul>
            <li>Our team has been automatically notified of this issue</li>
            <li>You can try uploading your contract again</li>
            <li>If the problem persists, please contact our support team</li>
        </ul>
        
        <p><strong>Common solutions:</strong></p>
        <ul>
            <li>Ensure your contract compiles without errors</li>
            <li>Check that all dependencies are properly imported</li>
            <li>Verify the contract size is under 10MB</li>
        </ul>
        
        <a href="${
					process.env.FRONTEND_URL || "http://localhost:3000"
				}/upload" class="cta-button">Try Again</a>
        
        <div class="footer">
            <p><strong>Audit ID:</strong> ${data.auditId}</p>
            <p>If you continue to experience issues, please contact our support team with the audit ID above.</p>
            <p>We apologize for the inconvenience and appreciate your patience.</p>
        </div>
    </div>
</body>
</html>
    `;
	}

	/**
	 * Test email connectivity
	 */
	async testConnection(): Promise<boolean> {
		if (!this.isConfigured) {
			console.warn("Email service not configured. Cannot test connection.");
			return false;
		}

		try {
			// Send a simple test email to verify configuration
			const result = await this.sendEmail({
				to: this.fromEmail, // Send to self for testing
				subject: "Audit Wolf Email Service Test",
				text: "This is a test email to verify the email service configuration.",
			});
			return result;
		} catch (error) {
			console.error("Email service test failed:", error);
			return false;
		}
	}

	/**
	 * Check if email service is properly configured
	 */
	isEmailConfigured(): boolean {
		return this.isConfigured;
	}

	/**
	 * Send welcome email to new users
	 */
	async sendWelcomeEmail(
		userEmail: string,
		userName?: string
	): Promise<boolean> {
		const subject =
			"Welcome to Audit Wolf - Your Smart Contract Security Partner";

		const html = this.generateWelcomeHTML({
			userName: userName || "Developer",
		});

		return this.sendEmail({
			to: userEmail,
			subject,
			html,
		});
	}

	/**
	 * Send audit started notification
	 */
	async sendAuditStartedEmail(
		userEmail: string,
		contractName: string,
		auditId: string,
		estimatedTime: string = "5-10 minutes"
	): Promise<boolean> {
		const subject = `Audit Started: ${contractName}`;

		const html = this.generateAuditStartedHTML({
			contractName,
			auditId,
			estimatedTime,
		});

		return this.sendEmail({
			to: userEmail,
			subject,
			html,
		});
	}

	/**
	 * Generate HTML template for welcome email
	 */
	private generateWelcomeHTML(data: { userName: string }): string {
		return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Audit Wolf</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }
        .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 8px 8px;
        }
        .feature-list {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .feature-item {
            display: flex;
            align-items: center;
            margin: 15px 0;
        }
        .feature-icon {
            font-size: 1.5em;
            margin-right: 15px;
            width: 30px;
        }
        .cta-button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 0.9em;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ Welcome to Audit Wolf!</h1>
        <p>Hello ${
					data.userName
				}, your smart contract security journey starts here</p>
    </div>
    
    <div class="content">
        <p>Thank you for joining Audit Wolf, the comprehensive smart contract auditing platform that combines cutting-edge AI analysis with proven static analysis tools.</p>
        
        <div class="feature-list">
            <h3>What you can do with Audit Wolf:</h3>
            <div class="feature-item">
                <span class="feature-icon">🔍</span>
                <span>Comprehensive security analysis using Slither and AI models</span>
            </div>
            <div class="feature-item">
                <span class="feature-icon">📊</span>
                <span>Detailed vulnerability reports with severity ratings</span>
            </div>
            <div class="feature-item">
                <span class="feature-icon">⚡</span>
                <span>Gas optimization recommendations</span>
            </div>
            <div class="feature-item">
                <span class="feature-icon">📄</span>
                <span>Professional PDF reports for stakeholders</span>
            </div>
            <div class="feature-item">
                <span class="feature-icon">🔄</span>
                <span>Real-time progress tracking and notifications</span>
            </div>
        </div>
        
        <p><strong>Getting Started:</strong></p>
        <ol>
            <li>Upload your Solidity smart contract</li>
            <li>Choose your analysis type (Static, AI, or Comprehensive)</li>
            <li>Receive detailed security analysis and recommendations</li>
            <li>Download professional audit reports</li>
        </ol>
        
        <a href="${
					process.env.FRONTEND_URL || "http://localhost:3000"
				}/upload" class="cta-button">Start Your First Audit</a>
        
        <div class="footer">
            <p>Need help getting started? Check out our documentation or contact our support team.</p>
            <p>Happy auditing!</p>
            <p>The Audit Wolf Team</p>
        </div>
    </div>
</body>
</html>
    `;
	}

	/**
	 * Generate HTML template for audit started email
	 */
	private generateAuditStartedHTML(data: {
		contractName: string;
		auditId: string;
		estimatedTime: string;
	}): string {
		return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Audit Started - ${data.contractName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }
        .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 8px 8px;
        }
        .progress-info {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .cta-button {
            display: inline-block;
            background: #22c55e;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 0.9em;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Audit Started!</h1>
        <p>We're now analyzing <strong>${data.contractName}</strong></p>
    </div>
    
    <div class="content">
        <p>Great! Your smart contract audit has been queued and will begin processing shortly.</p>
        
        <div class="progress-info">
            <h3>What's happening now:</h3>
            <ul>
                <li>Your contract is being prepared for analysis</li>
                <li>Static analysis tools are being initialized</li>
                <li>AI models are being configured for your contract</li>
                <li>Security patterns are being loaded</li>
            </ul>
            
            <p><strong>Estimated completion time:</strong> ${
							data.estimatedTime
						}</p>
        </div>
        
        <p>You'll receive another email notification once your audit is complete, along with a detailed PDF report.</p>
        
        <p>You can also track the progress in real-time from your dashboard.</p>
        
        <a href="${
					process.env.FRONTEND_URL || "http://localhost:3000"
				}/dashboard" class="cta-button">Track Progress</a>
        
        <div class="footer">
            <p><strong>Audit ID:</strong> ${data.auditId}</p>
            <p>This audit will analyze your contract for security vulnerabilities, gas optimizations, and best practices.</p>
            <p>Thank you for choosing Audit Wolf!</p>
        </div>
    </div>
</body>
</html>
    `;
	}
}

export default EmailService;
