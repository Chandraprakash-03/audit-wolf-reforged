import crypto from "crypto";

/**
 * Service for encrypting and decrypting sensitive data at rest
 */
export class EncryptionService {
	private readonly algorithm = "aes-256-gcm";
	private readonly keyLength = 32; // 256 bits
	private readonly ivLength = 16; // 128 bits
	private readonly tagLength = 16; // 128 bits
	private readonly saltLength = 32; // 256 bits

	private encryptionKey: Buffer;

	constructor() {
		const key = process.env.ENCRYPTION_KEY;
		if (!key) {
			throw new Error("ENCRYPTION_KEY environment variable is required");
		}

		// Derive a consistent key from the environment variable
		this.encryptionKey = crypto.scryptSync(
			key,
			"audit-wolf-salt",
			this.keyLength
		);
	}

	/**
	 * Encrypt sensitive data
	 */
	encrypt(data: string): EncryptedData {
		try {
			const iv = crypto.randomBytes(this.ivLength);
			const cipher = crypto.createCipheriv(
				this.algorithm,
				this.encryptionKey,
				iv
			);
			cipher.setAAD(Buffer.from("audit-wolf-aad"));

			let encrypted = cipher.update(data, "utf8", "hex");
			encrypted += cipher.final("hex");

			const tag = cipher.getAuthTag();

			return {
				encrypted,
				iv: iv.toString("hex"),
				tag: tag.toString("hex"),
				algorithm: this.algorithm,
			};
		} catch (error) {
			console.error("Encryption error:", error);
			throw new Error("Failed to encrypt data");
		}
	}

	/**
	 * Decrypt sensitive data
	 */
	decrypt(encryptedData: EncryptedData): string {
		try {
			const { encrypted, iv, tag, algorithm } = encryptedData;

			if (algorithm !== this.algorithm) {
				throw new Error("Unsupported encryption algorithm");
			}

			const decipher = crypto.createDecipheriv(
				algorithm,
				this.encryptionKey,
				Buffer.from(iv, "hex")
			);
			decipher.setAAD(Buffer.from("audit-wolf-aad"));
			decipher.setAuthTag(Buffer.from(tag, "hex"));

			let decrypted = decipher.update(encrypted, "hex", "utf8");
			decrypted += decipher.final("utf8");

			return decrypted;
		} catch (error) {
			console.error("Decryption error:", error);
			throw new Error("Failed to decrypt data");
		}
	}

	/**
	 * Hash sensitive data for indexing (one-way)
	 */
	hash(data: string): string {
		const salt = crypto.randomBytes(this.saltLength);
		const hash = crypto.scryptSync(data, salt, 64);
		return salt.toString("hex") + ":" + hash.toString("hex");
	}

	/**
	 * Verify hashed data
	 */
	verifyHash(data: string, hashedData: string): boolean {
		try {
			const [saltHex, hashHex] = hashedData.split(":");
			const salt = Buffer.from(saltHex, "hex");
			const hash = Buffer.from(hashHex, "hex");

			const derivedHash = crypto.scryptSync(data, salt, 64);
			return crypto.timingSafeEqual(hash, derivedHash);
		} catch (error) {
			console.error("Hash verification error:", error);
			return false;
		}
	}

	/**
	 * Generate a secure random token
	 */
	generateToken(length: number = 32): string {
		return crypto.randomBytes(length).toString("hex");
	}

	/**
	 * Generate a secure file hash
	 */
	generateFileHash(content: string): string {
		return crypto.createHash("sha256").update(content).digest("hex");
	}

	/**
	 * Encrypt contract source code
	 */
	encryptContract(sourceCode: string): EncryptedContract {
		const encrypted = this.encrypt(sourceCode);
		const hash = this.generateFileHash(sourceCode);

		return {
			...encrypted,
			hash,
			encryptedAt: new Date().toISOString(),
		};
	}

	/**
	 * Decrypt contract source code
	 */
	decryptContract(encryptedContract: EncryptedContract): string {
		return this.decrypt(encryptedContract);
	}

	/**
	 * Securely delete sensitive data from memory
	 * Note: Strings in JavaScript are immutable, so we can't actually overwrite them
	 * This method is kept for API compatibility but doesn't perform actual memory overwriting for strings
	 */
	secureDelete(data: any): void {
		if (typeof data === "string") {
			// Strings are immutable in JavaScript, so we can't actually overwrite them
			// The garbage collector will eventually clean up the memory
			// This is a limitation of JavaScript's memory management
			return;
		} else if (Buffer.isBuffer(data)) {
			data.fill(0);
		} else if (typeof data === "object" && data !== null) {
			for (const key in data) {
				if (data.hasOwnProperty(key)) {
					this.secureDelete(data[key]);
					delete data[key];
				}
			}
		}
	}
}

/**
 * Encrypted data structure
 */
export interface EncryptedData {
	encrypted: string;
	iv: string;
	tag: string;
	algorithm: string;
}

/**
 * Encrypted contract structure
 */
export interface EncryptedContract extends EncryptedData {
	hash: string;
	encryptedAt: string;
}

/**
 * Singleton instance
 */
export const encryptionService = new EncryptionService();
