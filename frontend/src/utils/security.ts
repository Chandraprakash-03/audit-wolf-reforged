import DOMPurify from "isomorphic-dompurify";

/**
 * Client-side input sanitization utilities
 */
export class SecurityUtils {
	/**
	 * Sanitize user input to prevent XSS attacks
	 */
	static sanitizeInput(input: string): string {
		if (typeof input !== "string") {
			return "";
		}

		// Remove HTML tags and dangerous content
		let sanitized = DOMPurify.sanitize(input, {
			ALLOWED_TAGS: [],
			ALLOWED_ATTR: [],
		});

		// Additional sanitization for common attack patterns
		sanitized = sanitized
			.replace(/javascript:/gi, "")
			.replace(/data:/gi, "")
			.replace(/vbscript:/gi, "")
			.replace(/on\w+\s*=/gi, "");

		// If the result is empty after sanitization, return empty string
		if (!sanitized || sanitized.trim().length === 0) {
			return "";
		}

		return sanitized.trim();
	}

	/**
	 * Validate contract name
	 */
	static validateContractName(name: string): ValidationResult {
		if (!name || typeof name !== "string") {
			return {
				isValid: false,
				error: "Contract name is required",
			};
		}

		const sanitized = this.sanitizeInput(name);

		if (sanitized.length < 1 || sanitized.length > 100) {
			return {
				isValid: false,
				error: "Contract name must be between 1 and 100 characters",
			};
		}

		if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(sanitized)) {
			return {
				isValid: false,
				error: "Contract name contains invalid characters",
			};
		}

		return {
			isValid: true,
			sanitizedValue: sanitized,
		};
	}

	/**
	 * Validate Solidity source code
	 */
	static validateSourceCode(sourceCode: string): ValidationResult {
		if (!sourceCode || typeof sourceCode !== "string") {
			return {
				isValid: false,
				error: "Source code is required",
			};
		}

		const sanitized = this.sanitizeInput(sourceCode);

		if (sanitized.length < 10) {
			return {
				isValid: false,
				error: "Source code is too short",
			};
		}

		if (sanitized.length > 1000000) {
			return {
				isValid: false,
				error: "Source code is too long (max 1MB)",
			};
		}

		// Check for basic Solidity structure
		if (
			!sanitized.includes("contract") &&
			!sanitized.includes("library") &&
			!sanitized.includes("interface")
		) {
			return {
				isValid: false,
				error:
					"Source code must contain a valid Solidity contract, library, or interface",
			};
		}

		// Check for dangerous patterns
		const dangerousPatterns = [
			/eval\s*\(/i,
			/exec\s*\(/i,
			/system\s*\(/i,
			/require\s*\(\s*['"`]child_process['"`]/i,
			/require\s*\(\s*['"`]fs['"`]/i,
			/import\s+['"`]child_process['"`]/i,
			/import\s+['"`]fs['"`]/i,
		];

		for (const pattern of dangerousPatterns) {
			if (pattern.test(sanitized)) {
				return {
					isValid: false,
					error: "Source code contains potentially dangerous patterns",
				};
			}
		}

		return {
			isValid: true,
			sanitizedValue: sanitized,
		};
	}

	/**
	 * Validate email address
	 */
	static validateEmail(email: string): ValidationResult {
		if (!email || typeof email !== "string") {
			return {
				isValid: false,
				error: "Email is required",
			};
		}

		const sanitized = this.sanitizeInput(email).toLowerCase();
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

		if (!emailRegex.test(sanitized)) {
			return {
				isValid: false,
				error: "Invalid email format",
			};
		}

		if (sanitized.length > 254) {
			return {
				isValid: false,
				error: "Email is too long",
			};
		}

		return {
			isValid: true,
			sanitizedValue: sanitized,
		};
	}

	/**
	 * Validate user name
	 */
	static validateName(name: string): ValidationResult {
		if (!name || typeof name !== "string") {
			return {
				isValid: false,
				error: "Name is required",
			};
		}

		const sanitized = this.sanitizeInput(name);

		if (sanitized.length < 2 || sanitized.length > 50) {
			return {
				isValid: false,
				error: "Name must be between 2 and 50 characters",
			};
		}

		if (!/^[a-zA-Z\s\-'\.]+$/.test(sanitized)) {
			return {
				isValid: false,
				error: "Name contains invalid characters",
			};
		}

		return {
			isValid: true,
			sanitizedValue: sanitized,
		};
	}

	/**
	 * Validate compiler version
	 */
	static validateCompilerVersion(version: string): ValidationResult {
		if (!version || typeof version !== "string") {
			return {
				isValid: true, // Optional field
				sanitizedValue: "",
			};
		}

		const sanitized = this.sanitizeInput(version);

		if (!/^\d+\.\d+(\.\d+)?$/.test(sanitized)) {
			return {
				isValid: false,
				error: "Invalid compiler version format (expected: x.y.z)",
			};
		}

		return {
			isValid: true,
			sanitizedValue: sanitized,
		};
	}

	/**
	 * Generate a secure random string for CSRF tokens
	 */
	static generateSecureToken(length: number = 32): string {
		const array = new Uint8Array(length);
		crypto.getRandomValues(array);
		return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
			""
		);
	}

	/**
	 * Validate file upload
	 */
	static validateFileUpload(file: File): ValidationResult {
		if (!file) {
			return {
				isValid: false,
				error: "No file selected",
			};
		}

		// Check file size (10MB limit)
		const maxSize = 10 * 1024 * 1024; // 10MB
		if (file.size > maxSize) {
			return {
				isValid: false,
				error: "File size exceeds 10MB limit",
			};
		}

		// Check file extension
		const allowedExtensions = [".sol", ".txt"];
		const fileExtension = file.name
			.toLowerCase()
			.substring(file.name.lastIndexOf("."));

		if (!allowedExtensions.includes(fileExtension)) {
			return {
				isValid: false,
				error: "Only .sol and .txt files are allowed",
			};
		}

		// Check filename
		const sanitizedName = this.sanitizeInput(file.name);
		if (sanitizedName !== file.name) {
			return {
				isValid: false,
				error: "Filename contains invalid characters",
			};
		}

		return {
			isValid: true,
			sanitizedValue: file.name,
		};
	}

	/**
	 * Rate limiting helper for client-side
	 */
	static createClientRateLimit(maxRequests: number, windowMs: number) {
		const requests: number[] = [];

		return {
			canMakeRequest(): boolean {
				const now = Date.now();

				// Remove old requests outside the window
				while (requests.length > 0 && requests[0] <= now - windowMs) {
					requests.shift();
				}

				// Check if we can make a new request
				if (requests.length >= maxRequests) {
					return false;
				}

				// Add current request
				requests.push(now);
				return true;
			},

			getTimeUntilReset(): number {
				if (requests.length === 0) {
					return 0;
				}

				const oldestRequest = requests[0];
				const timeUntilReset = windowMs - (Date.now() - oldestRequest);
				return Math.max(0, timeUntilReset);
			},
		};
	}

	/**
	 * Secure local storage wrapper
	 */
	static secureStorage = {
		setItem(key: string, value: string): void {
			try {
				// Add timestamp for expiration
				const item = {
					value,
					timestamp: Date.now(),
				};
				localStorage.setItem(key, JSON.stringify(item));
			} catch (error) {
				console.error("Failed to store item:", error);
			}
		},

		getItem(key: string, maxAge: number = 24 * 60 * 60 * 1000): string | null {
			try {
				const itemStr = localStorage.getItem(key);
				if (!itemStr) {
					return null;
				}

				const item = JSON.parse(itemStr);
				const age = Date.now() - item.timestamp;

				if (age > maxAge) {
					localStorage.removeItem(key);
					return null;
				}

				return item.value;
			} catch (error) {
				console.error("Failed to retrieve item:", error);
				localStorage.removeItem(key);
				return null;
			}
		},

		removeItem(key: string): void {
			localStorage.removeItem(key);
		},

		clear(): void {
			localStorage.clear();
		},
	};
}

/**
 * Validation result interface
 */
export interface ValidationResult {
	isValid: boolean;
	error?: string;
	sanitizedValue?: string;
}

/**
 * Security configuration
 */
export const SECURITY_CONFIG = {
	MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
	MAX_CONTRACT_SIZE: 1000000, // 1MB
	MAX_NAME_LENGTH: 100,
	MIN_NAME_LENGTH: 1,
	ALLOWED_FILE_EXTENSIONS: [".sol", ".txt"],
	RATE_LIMIT: {
		UPLOAD: { requests: 20, windowMs: 60 * 60 * 1000 }, // 20 uploads per hour
		API: { requests: 100, windowMs: 15 * 60 * 1000 }, // 100 API calls per 15 minutes
		AUTH: { requests: 10, windowMs: 15 * 60 * 1000 }, // 10 auth attempts per 15 minutes
	},
};
