import { MoveAnalyzer } from "./MoveAnalyzer";
import { ContractInput, PlatformVulnerability } from "../../types/blockchain";
import { executePwsh } from "../../utils/shellUtils";

/**
 * Sui-specific analyzer using Move language
 */
export class SuiAnalyzer extends MoveAnalyzer {
	constructor(options: { timeout?: number; maxFileSize?: number } = {}) {
		super("sui", options);
	}

	/**
	 * Get Sui Move version
	 */
	protected async getMoveVersion(): Promise<string> {
		try {
			const result = await executePwsh("sui --version", { timeout: 5000 });
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
	 * Run Sui-specific security checks
	 */
	protected async runMoveSecurityChecks(contract: ContractInput): Promise<{
		vulnerabilities: PlatformVulnerability[];
		warnings: string[];
	}> {
		const baseResult = await super.runMoveSecurityChecks(contract);
		const vulnerabilities = [...baseResult.vulnerabilities];
		const warnings = [...baseResult.warnings];

		// Sui-specific checks
		if (contract.code.includes("sui::")) {
			// Check for proper Sui framework usage
			if (!contract.code.includes("use sui::")) {
				warnings.push(
					"Consider using explicit imports for Sui framework modules"
				);
			}
		}

		// Check for object ownership patterns
		if (
			contract.code.includes("object::") &&
			!contract.code.includes("object::uid")
		) {
			warnings.push("Objects should have proper UID management");
		}

		// Check for transfer patterns
		if (
			contract.code.includes("transfer::") &&
			!contract.code.includes("transfer::public_transfer")
		) {
			warnings.push(
				"Consider using appropriate transfer functions for object ownership"
			);
		}

		// Check for dynamic fields
		if (
			contract.code.includes("dynamic_field::") &&
			!contract.code.includes("dynamic_field::exists_")
		) {
			warnings.push(
				"Dynamic field operations should check existence before access"
			);
		}

		// Check for clock usage
		if (
			contract.code.includes("clock::") &&
			!contract.code.includes("clock::timestamp_ms")
		) {
			warnings.push("Clock operations should use proper timestamp functions");
		}

		return { vulnerabilities, warnings };
	}

	/**
	 * Validate Sui-specific Move syntax
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

		// Sui-specific syntax validation
		if (
			contract.code.includes("module ") &&
			!contract.code.match(/module\s+\w+::\w+/)
		) {
			warnings.push(
				"Sui modules should use proper naming format (package::module)"
			);
		}

		// Check for proper object struct definitions
		if (
			contract.code.includes("struct ") &&
			contract.code.includes("has key") &&
			!contract.code.includes("id: UID")
		) {
			warnings.push(
				"Sui objects with 'key' ability should have an 'id: UID' field"
			);
		}

		// Check for entry function patterns
		if (
			contract.code.includes("public entry fun") &&
			!contract.code.includes("&mut TxContext")
		) {
			warnings.push(
				"Entry functions should typically include TxContext parameter"
			);
		}

		return { vulnerabilities, errors, warnings };
	}
}
