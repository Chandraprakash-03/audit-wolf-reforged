interface ValidationResult {
	isValid: boolean;
	errors: string[];
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const SUPPORTED_EXTENSIONS = [".sol"];

export function validateFile(file: File): ValidationResult {
	const errors: string[] = [];

	// Check file size
	if (file.size > MAX_FILE_SIZE) {
		errors.push(
			`File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`
		);
	}

	// Check file extension
	const extension = file.name
		.toLowerCase()
		.substring(file.name.lastIndexOf("."));
	if (!SUPPORTED_EXTENSIONS.includes(extension)) {
		errors.push(`Unsupported file type. Only .sol files are allowed`);
	}

	// Check if file is empty
	if (file.size === 0) {
		errors.push("File is empty");
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

export function validateSolidityCode(code: string): ValidationResult {
	const errors: string[] = [];

	// Check if code is empty
	if (!code.trim()) {
		errors.push("Contract code cannot be empty");
		return { isValid: false, errors };
	}

	// Check for pragma directive
	if (!code.includes("pragma solidity")) {
		errors.push("Missing pragma solidity directive");
	}

	// Check for contract definition
	const contractMatch = code.match(/contract\s+(\w+)/);
	if (!contractMatch) {
		errors.push("No contract definition found");
	}

	// Check for balanced braces
	const openBraces = (code.match(/{/g) || []).length;
	const closeBraces = (code.match(/}/g) || []).length;
	if (openBraces !== closeBraces) {
		errors.push("Unbalanced braces in contract");
	}

	// Check for balanced parentheses
	const openParens = (code.match(/\(/g) || []).length;
	const closeParens = (code.match(/\)/g) || []).length;
	if (openParens !== closeParens) {
		errors.push("Unbalanced parentheses in contract");
	}

	// Check for balanced square brackets
	const openBrackets = (code.match(/\[/g) || []).length;
	const closeBrackets = (code.match(/\]/g) || []).length;
	if (openBrackets !== closeBrackets) {
		errors.push("Unbalanced square brackets in contract");
	}

	// Check for basic syntax issues
	if (code.includes("function") && !code.match(/function\s+\w+\s*\(/)) {
		errors.push("Invalid function syntax detected");
	}

	// Check for common typos
	if (code.includes("contarct") || code.includes("fucntion")) {
		errors.push("Possible typos detected in keywords");
	}

	// Validate pragma version format
	const pragmaMatch = code.match(/pragma\s+solidity\s+([^;]+);/);
	if (pragmaMatch) {
		const version = pragmaMatch[1].trim();
		if (!version.match(/^[\^~>=<]*\d+\.\d+(\.\d+)?/)) {
			errors.push("Invalid pragma solidity version format");
		}
	}

	// Check for minimum code structure
	if (contractMatch && !code.includes("{")) {
		errors.push("Contract definition is incomplete");
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

export function extractContractInfo(code: string) {
	const contractMatch = code.match(/contract\s+(\w+)/);
	const pragmaMatch = code.match(/pragma\s+solidity\s+([^;]+);/);

	return {
		contractName: contractMatch ? contractMatch[1] : null,
		pragmaVersion: pragmaMatch ? pragmaMatch[1].trim() : null,
		linesOfCode: code.split("\n").filter((line) => line.trim()).length,
		functionCount: (code.match(/function\s+\w+/g) || []).length,
	};
}

export function sanitizeContractCode(code: string): string {
	// Remove any potentially dangerous content while preserving valid Solidity
	return code
		.replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments
		.replace(/\/\/.*$/gm, "") // Remove line comments
		.trim();
}
