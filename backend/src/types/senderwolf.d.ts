declare module "senderwolf" {
	export interface EmailInput {
		smtp: {
			host?: string;
			port?: number;
			secure?: boolean;
			auth: {
				user: string;
				pass: string;
			};
		};
		mail: {
			to: string | string[];
			subject: string;
			html?: string;
			text?: string;
			attachments?: Array<{
				filename: string;
				content: Buffer;
				contentType: string;
			}>;
			fromName?: string;
			fromEmail?: string;
		};
	}

	export interface EmailResult {
		success: boolean;
		messageId?: string;
		error?: string;
	}

	export function sendEmail(input: EmailInput): Promise<EmailResult>;
}
