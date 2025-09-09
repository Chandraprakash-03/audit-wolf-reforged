import { MoveAnalyzer } from "./MoveAnalyzer";
import { ContractInput, PlatformVulnerability } from "../../types/blockchain";
import { executePwsh } from "../../utils/shellUtils";

/**
 * Aptos-specific analyzer using Move language
 */
export class AptosAnalyzer extends MoveAnalyzer {
	constructor(options: { timeout?: number; maxFileSize?: number } = {}) {
		super("aptos", options);
	}

	/**
	 * Get Aptos Move version
	 */
	protected async getMoveVersion(): Promise<string> {
		try {
			const result = await executePwsh("aptos --version", { timeout: 5000 });
			return result.stdout.trim() || "unknown";
		} catch (error) {
			// Fallback to generic Move version check
			try {
				const result = await executePwsh("move --version", { timeout: 5000 });
				return result.stdout.trim() || "unknown";
			} catch (fallbackError) {
				return "not-installed";
			}
		}
	}

	/**
	 * Run Aptos-specific security checks
	 */
	protected async runMoveSecurityChecks(contract: ContractInput): Promise<{
		vulnerabilities: PlatformVulnerability[];
		warnings: string[];
	}> {
		const baseResult = await super.runMoveSecurityChecks(contract);
		const vulnerabilities = [...baseResult.vulnerabilities];
		const warnings = [...baseResult.warnings];

		// Aptos-specific checks
		if (contract.code.includes("aptos_framework::")) {
			// Check for proper Aptos framework usage
			if (!contract.code.includes("use aptos_framework::")) {
				warnings.push(
					"Consider using explicit imports for Aptos framework modules"
				);
			}
		}

		// Check for resource account patterns
		if (
			contract.code.includes("resource_account") &&
			!contract.code.includes("signer::address_of")
		) {
			warnings.push("Resource account usage should validate signer addresses");
		}

		// Check for coin operations
		if (
			contract.code.includes("coin::") &&
			!contract.code.includes("coin::is_account_registered")
		) {
			warnings.push("Coin operations should check if account is registered");
		}

		// Check for event emission
		if (
			contract.code.includes("event::") &&
			!contract.code.includes("event::emit")
		) {
			warnings.push(
				"Event modules should emit events for important state changes"
			);
		}

		return { vulnerabilities, warnings };
	}

	/**
	 * Validate Aptos-specific Move syntax
	 */
	protected async validateMoveSyntax(contract: ContractInput): Promise<{
		vulnerabilities: PlatformVulnerability[];
		errors: string[];
		warnings: string[];
	}> {
		const baseResult = await super.validateMoveSyntax(contract);
		const vulnerabilities = [...baseResult.vulnerabilities];
		const errors = [...baseResult.errors];
		const warnings = [...baseResult.warnings];

		// Aptos-specific syntax validation
		if (
			contract.code.includes("module ") &&
			!contract.code.match(/module\s+0x[a-fA-F0-9]+::\w+/)
		) {
			warnings.push("Aptos modules should use proper address format (0x...)");
		}

		// Check for proper entry function declarations
		if (
			contract.code.includes("public entry fun") &&
			!contract.code.includes("&signer")
		) {
			warnings.push("Entry functions typically require a signer parameter");
		}

		return { vulnerabilities, errors, warnings };
	}
}
