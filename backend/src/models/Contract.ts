import { DatabaseService } from "../services/database";
import { Contract as ContractType } from "../types/database";
import crypto from "crypto";

export class ContractModel {
	public id: string;
	public user_id: string;
	public name: string;
	public source_code: string;
	public compiler_version: string;
	public file_hash: string;
	public created_at: Date;

	constructor(data: ContractType) {
		this.id = data.id;
		this.user_id = data.user_id;
		this.name = data.name;
		this.source_code = data.source_code;
		this.compiler_version = data.compiler_version;
		this.file_hash = data.file_hash;
		this.created_at = data.created_at;
	}

	static async create(contractData: {
		user_id: string;
		name: string;
		source_code: string;
		compiler_version?: string;
	}): Promise<ContractModel | null> {
		// Generate file hash from source code
		const file_hash = crypto
			.createHash("sha256")
			.update(contractData.source_code)
			.digest("hex");

		const contract = await DatabaseService.createContract({
			user_id: contractData.user_id,
			name: contractData.name,
			source_code: contractData.source_code,
			compiler_version: contractData.compiler_version || "0.8.0",
			file_hash,
		});

		return contract ? new ContractModel(contract) : null;
	}

	static async findById(id: string): Promise<ContractModel | null> {
		const contract = await DatabaseService.getContractById(id);
		return contract ? new ContractModel(contract) : null;
	}

	static async findByUserId(userId: string): Promise<ContractModel[]> {
		const contracts = await DatabaseService.getContractsByUserId(userId);
		return contracts.map((contract) => new ContractModel(contract));
	}

	static async findByHash(hash: string): Promise<ContractModel | null> {
		// This would need to be implemented in DatabaseService
		// For now, we'll return null
		return null;
	}

	validateSolidity(): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Basic Solidity validation
		if (!this.source_code.includes("pragma solidity")) {
			errors.push("Missing pragma solidity directive");
		}

		if (!this.source_code.includes("contract ")) {
			errors.push("No contract definition found");
		}

		// Check for balanced braces
		const openBraces = (this.source_code.match(/{/g) || []).length;
		const closeBraces = (this.source_code.match(/}/g) || []).length;
		if (openBraces !== closeBraces) {
			errors.push("Unbalanced braces in contract");
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	getLinesOfCode(): number {
		return this.source_code.split("\n").filter((line) => line.trim()).length;
	}

	getFunctionCount(): number {
		const functionMatches = this.source_code.match(/function\s+\w+/g);
		return functionMatches ? functionMatches.length : 0;
	}

	getComplexityMetrics() {
		return {
			lines_of_code: this.getLinesOfCode(),
			function_count: this.getFunctionCount(),
			cyclomatic_complexity: this.calculateCyclomaticComplexity(),
		};
	}

	private calculateCyclomaticComplexity(): number {
		// Simple cyclomatic complexity calculation
		// Count decision points: if, while, for, &&, ||, ?:
		const decisionPoints = [
			/\bif\s*\(/g,
			/\bwhile\s*\(/g,
			/\bfor\s*\(/g,
			/&&/g,
			/\|\|/g,
			/\?/g,
		];

		let complexity = 1; // Base complexity

		decisionPoints.forEach((pattern) => {
			const matches = this.source_code.match(pattern);
			if (matches) {
				complexity += matches.length;
			}
		});

		return complexity;
	}

	toJSON() {
		return {
			id: this.id,
			user_id: this.user_id,
			name: this.name,
			source_code: this.source_code,
			compiler_version: this.compiler_version,
			file_hash: this.file_hash,
			created_at: this.created_at,
		};
	}
}
