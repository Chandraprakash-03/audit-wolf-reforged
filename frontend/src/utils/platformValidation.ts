import { BlockchainPlatform, ValidationResult } from "@/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

export interface PlatformValidationResult extends ValidationResult {
	detectedLanguage?: string;
	suggestedPlatforms?: string[];
}

export function validateFileForPlatform(
	file: File,
	platform: BlockchainPlatform
): PlatformValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check file size
	if (file.size > MAX_FILE_SIZE) {
		errors.push(
			`File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`
		);
	}

	// Check if file is empty
	if (file.size === 0) {
		errors.push("File is empty");
	}

	// Check file extension
	const extension = file.name
		.toLowerCase()
		.substring(file.name.lastIndexOf("."));

	if (!platform.fileExtensions.includes(extension)) {
		errors.push(
			`Unsupported file type for ${
				platform.displayName
			}. Expected: ${platform.fileExtensions.join(", ")}`
		);
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
}

export function validateCodeForPlatform(
	code: string,
	platform: BlockchainPlatform,
	filename?: string
): PlatformValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check if code is empty
	if (!code.trim()) {
		errors.push("Contract code cannot be empty");
		return { isValid: false, errors, warnings };
	}

	// Platform-specific validation
	switch (platform.id) {
		case "ethereum":
		case "bsc":
		case "polygon":
			return validateSolidityCode(code, platform);
		case "solana":
			return validateSolanaCode(code, platform);
		case "cardano":
			return validateCardanoCode(code, platform);
		case "aptos":
		case "sui":
			return validateMoveCode(code, platform);
		default:
			return validateGenericCode(code, platform);
	}
}

function validateSolidityCode(
	code: string,
	platform: BlockchainPlatform
): PlatformValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check for pragma directive (warning instead of error for flexibility)
	if (!code.includes("pragma solidity")) {
		warnings.push(
			"Consider adding pragma solidity directive for version specification"
		);
	}

	// Check for contract, interface, or library definition (more flexible)
	const contractMatch = code.match(/(contract|interface|library)\s+(\w+)/);
	if (!contractMatch) {
		// Only error if it doesn't look like Solidity at all
		if (
			!code.includes("function") &&
			!code.includes("mapping") &&
			!code.includes("uint")
		) {
			errors.push("No contract, interface, or library definition found");
		}
	}

	// Check for balanced braces (only if there are braces)
	const openBraces = (code.match(/{/g) || []).length;
	const closeBraces = (code.match(/}/g) || []).length;
	if (openBraces > 0 && openBraces !== closeBraces) {
		errors.push("Unbalanced braces in contract");
	}

	// Check for balanced parentheses (only if there are parentheses)
	const openParens = (code.match(/\(/g) || []).length;
	const closeParens = (code.match(/\)/g) || []).length;
	if (openParens > 0 && openParens !== closeParens) {
		errors.push("Unbalanced parentheses in contract");
	}

	// Platform-specific checks
	if (platform.id === "bsc") {
		// Check for BEP token standards
		if (code.includes("ERC20") || code.includes("ERC721")) {
			warnings.push(
				"Consider using BEP-20 or BEP-721 standards for BSC deployment"
			);
		}
	}

	// Validate pragma version format (only if pragma exists)
	const pragmaMatch = code.match(/pragma\s+solidity\s+([^;]+);/);
	if (pragmaMatch) {
		const version = pragmaMatch[1].trim();
		if (!version.match(/^[\^~>=<]*\d+\.\d+(\.\d+)?/)) {
			warnings.push("Pragma solidity version format may be invalid");
		}
	}

	// If code contains Solidity keywords, consider it valid even if structure is incomplete
	const solidityKeywords = [
		"function",
		"contract",
		"mapping",
		"uint",
		"address",
		"public",
		"private",
		"view",
		"pure",
	];
	const hasKeywords = solidityKeywords.some((keyword) =>
		code.includes(keyword)
	);

	if (hasKeywords && errors.length === 0) {
		return {
			isValid: true,
			errors,
			warnings,
			detectedLanguage: "solidity",
		};
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
		detectedLanguage: "solidity",
	};
}

function validateSolanaCode(
	code: string,
	platform: BlockchainPlatform
): PlatformValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check for Rust syntax (more lenient)
	const rustKeywords = [
		"fn",
		"pub",
		"use",
		"mod",
		"struct",
		"impl",
		"let",
		"mut",
	];
	const hasRustKeywords = rustKeywords.some((keyword) =>
		code.includes(keyword)
	);

	if (!hasRustKeywords && !code.includes("use ") && !code.includes("mod ")) {
		warnings.push(
			"Consider adding Rust module or use statements for better structure"
		);
	}

	// Check for Anchor framework
	const isAnchor = code.includes("anchor_lang") || code.includes("#[program]");
	if (isAnchor) {
		if (!code.includes("#[program]")) {
			warnings.push("Anchor program should include #[program] attribute");
		}
		if (!code.includes("use anchor_lang::prelude::*;")) {
			warnings.push("Consider importing anchor_lang prelude");
		}
	}

	// Check for Solana program structure
	if (!isAnchor && !code.includes("solana_program") && hasRustKeywords) {
		warnings.push(
			"Consider using Anchor framework or solana_program for better structure"
		);
	}

	// Check for balanced braces (only if there are braces)
	const openBraces = (code.match(/{/g) || []).length;
	const closeBraces = (code.match(/}/g) || []).length;
	if (openBraces > 0 && openBraces !== closeBraces) {
		errors.push("Unbalanced braces in Rust code");
	}

	// If code contains Rust keywords, consider it valid
	if (hasRustKeywords || isAnchor) {
		return {
			isValid: errors.length === 0,
			errors,
			warnings,
			detectedLanguage: isAnchor ? "anchor" : "rust",
		};
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
		detectedLanguage: isAnchor ? "anchor" : "rust",
	};
}

function validateCardanoCode(
	code: string,
	platform: BlockchainPlatform
): PlatformValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check for Haskell/Plutus syntax (more lenient)
	const haskellKeywords = [
		"module",
		"where",
		"import",
		"data",
		"type",
		"let",
		"in",
		"case",
		"of",
	];
	const hasHaskellKeywords = haskellKeywords.some((keyword) =>
		code.includes(keyword)
	);

	if (
		!hasHaskellKeywords &&
		!code.includes("module ") &&
		!code.includes("{-#")
	) {
		warnings.push(
			"Consider adding Haskell module declaration for better structure"
		);
	}

	// Check for Plutus imports
	const hasPlutusImports =
		code.includes("Plutus.") || code.includes("PlutusTx");
	if (!hasPlutusImports && hasHaskellKeywords) {
		warnings.push("Consider importing Plutus libraries for validator scripts");
	}

	// Check for validator function
	if (hasPlutusImports && !code.includes("validator")) {
		warnings.push("Plutus scripts typically require a validator function");
	}

	// Check for balanced parentheses (important in Haskell, only if there are parentheses)
	const openParens = (code.match(/\(/g) || []).length;
	const closeParens = (code.match(/\)/g) || []).length;
	if (openParens > 0 && openParens !== closeParens) {
		errors.push("Unbalanced parentheses in Haskell code");
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
		detectedLanguage: hasPlutusImports ? "plutus" : "haskell",
	};
}

function validateMoveCode(
	code: string,
	platform: BlockchainPlatform
): PlatformValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check for Move module syntax (more lenient)
	const moveKeywords = [
		"module",
		"struct",
		"fun",
		"public",
		"resource",
		"use",
		"let",
		"mut",
	];
	const hasMoveKeywords = moveKeywords.some((keyword) =>
		code.includes(keyword)
	);

	if (!hasMoveKeywords && !code.includes("module ")) {
		warnings.push(
			"Consider adding Move module declaration for better structure"
		);
	}

	// Check for Move-specific keywords
	const hasAdvancedMoveKeywords =
		code.includes("resource") ||
		code.includes("struct") ||
		code.includes("public fun");
	if (!hasAdvancedMoveKeywords && hasMoveKeywords) {
		warnings.push("Consider using Move-specific constructs like resources");
	}

	// Platform-specific checks
	if (platform.id === "aptos") {
		if (!code.includes("aptos_framework") && hasMoveKeywords) {
			warnings.push("Consider importing Aptos framework modules");
		}
	} else if (platform.id === "sui") {
		if (!code.includes("sui::") && hasMoveKeywords) {
			warnings.push("Consider using Sui-specific modules");
		}
	}

	// Check for balanced braces (only if there are braces)
	const openBraces = (code.match(/{/g) || []).length;
	const closeBraces = (code.match(/}/g) || []).length;
	if (openBraces > 0 && openBraces !== closeBraces) {
		errors.push("Unbalanced braces in Move code");
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
		detectedLanguage: "move",
	};
}

function validateGenericCode(
	code: string,
	platform: BlockchainPlatform
): PlatformValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Basic syntax checks (only if there are braces/parentheses)
	const openBraces = (code.match(/{/g) || []).length;
	const closeBraces = (code.match(/}/g) || []).length;
	if (openBraces > 0 && openBraces !== closeBraces) {
		errors.push("Unbalanced braces in code");
	}

	const openParens = (code.match(/\(/g) || []).length;
	const closeParens = (code.match(/\)/g) || []).length;
	if (openParens > 0 && openParens !== closeParens) {
		errors.push("Unbalanced parentheses in code");
	}

	warnings.push(
		`Platform-specific validation not available for ${platform.displayName}`
	);

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
}

export function detectPlatformFromCode(
	code: string,
	filename?: string,
	availablePlatforms: BlockchainPlatform[] = []
): PlatformValidationResult {
	const suggestions: string[] = [];
	let detectedLanguage: string | undefined;

	// Solidity detection
	if (code.includes("pragma solidity") || code.includes("contract ")) {
		detectedLanguage = "solidity";
		suggestions.push("ethereum", "bsc", "polygon");
	}

	// Rust/Anchor detection
	if (code.includes("anchor_lang") || code.includes("#[program]")) {
		detectedLanguage = "anchor";
		suggestions.push("solana");
	} else if (code.includes("use ") && code.includes("mod ")) {
		detectedLanguage = "rust";
		suggestions.push("solana");
	}

	// Haskell/Plutus detection
	if (code.includes("Plutus.") || code.includes("PlutusTx")) {
		detectedLanguage = "plutus";
		suggestions.push("cardano");
	} else if (code.includes("module ") && code.includes("{-#")) {
		detectedLanguage = "haskell";
		suggestions.push("cardano");
	}

	// Move detection
	if (code.includes("module ") && code.includes("resource")) {
		detectedLanguage = "move";
		suggestions.push("aptos", "sui");
	}

	// Filter suggestions based on available platforms
	const filteredSuggestions = suggestions.filter((platformId) =>
		availablePlatforms.some((p) => p.id === platformId && p.isActive)
	);

	return {
		isValid: true,
		errors: [],
		warnings: [],
		detectedLanguage,
		suggestedPlatforms: filteredSuggestions,
	};
}

export function extractContractInfo(
	code: string,
	platform: BlockchainPlatform
) {
	const info: Record<string, any> = {
		linesOfCode: code.split("\n").filter((line) => line.trim()).length,
	};

	switch (platform.id) {
		case "ethereum":
		case "bsc":
		case "polygon":
			return extractSolidityInfo(code, info);
		case "solana":
			return extractSolanaInfo(code, info);
		case "cardano":
			return extractCardanoInfo(code, info);
		case "aptos":
		case "sui":
			return extractMoveInfo(code, info);
		default:
			return info;
	}
}

function extractSolidityInfo(code: string, info: Record<string, any>) {
	const contractMatch = code.match(/contract\s+(\w+)/);
	const pragmaMatch = code.match(/pragma\s+solidity\s+([^;]+);/);

	return {
		...info,
		contractName: contractMatch ? contractMatch[1] : null,
		pragmaVersion: pragmaMatch ? pragmaMatch[1].trim() : null,
		functionCount: (code.match(/function\s+\w+/g) || []).length,
		modifierCount: (code.match(/modifier\s+\w+/g) || []).length,
		eventCount: (code.match(/event\s+\w+/g) || []).length,
	};
}

function extractSolanaInfo(code: string, info: Record<string, any>) {
	const isAnchor = code.includes("anchor_lang") || code.includes("#[program]");
	const programMatch = code.match(/pub\s+mod\s+(\w+)/);

	return {
		...info,
		framework: isAnchor ? "anchor" : "native",
		programName: programMatch ? programMatch[1] : null,
		instructionCount: (code.match(/pub\s+fn\s+\w+/g) || []).length,
		accountStructs: (code.match(/#\[derive\([^)]*Account[^)]*\)\]/g) || [])
			.length,
	};
}

function extractCardanoInfo(code: string, info: Record<string, any>) {
	const moduleMatch = code.match(/module\s+(\w+)/);
	const hasPlutus = code.includes("Plutus.") || code.includes("PlutusTx");

	return {
		...info,
		moduleName: moduleMatch ? moduleMatch[1] : null,
		isPlutusScript: hasPlutus,
		validatorCount: (code.match(/validator\s*::/g) || []).length,
		typeDefinitions: (code.match(/data\s+\w+/g) || []).length,
	};
}

function extractMoveInfo(code: string, info: Record<string, any>) {
	const moduleMatch = code.match(/module\s+[\w:]+::(\w+)/);

	return {
		...info,
		moduleName: moduleMatch ? moduleMatch[1] : null,
		resourceCount: (code.match(/struct\s+\w+\s+has\s+[^{]*resource/g) || [])
			.length,
		publicFunctions: (code.match(/public\s+fun\s+\w+/g) || []).length,
		entryFunctions: (code.match(/public\s+entry\s+fun\s+\w+/g) || []).length,
	};
}
