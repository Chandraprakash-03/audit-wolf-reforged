import { DatabaseService } from "../services/database";
import {
	Contract as ContractType,
	ContractDependency,
	CrossChainConfig,
} from "../types/database";
import crypto from "crypto";

export class ContractModel {
	public id: string;
	public user_id: string;
	public name: string;
	public source_code: string;
	public compiler_version: string;
	public file_hash: string;
	public blockchain_platform: string;
	public language: string;
	public dependencies?: ContractDependency[];
	public cross_chain_config?: CrossChainConfig;
	public created_at: Date;

	constructor(data: ContractType) {
		this.id = data.id;
		this.user_id = data.user_id;
		this.name = data.name;
		this.source_code = data.source_code;
		this.compiler_version = data.compiler_version;
		this.file_hash = data.file_hash;
		this.blockchain_platform = data.blockchain_platform;
		this.language = data.language;
		this.dependencies = data.dependencies;
		this.cross_chain_config = data.cross_chain_config;
		this.created_at = data.created_at;
	}

	static async create(contractData: {
		user_id: string;
		name: string;
		source_code: string;
		compiler_version?: string;
		blockchain_platform?: string;
		language?: string;
		dependencies?: ContractDependency[];
		cross_chain_config?: CrossChainConfig;
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
			blockchain_platform: contractData.blockchain_platform || "ethereum",
			language: contractData.language || "solidity",
			dependencies: contractData.dependencies,
			cross_chain_config: contractData.cross_chain_config,
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

	validateRust(): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Basic Rust validation for Solana contracts
		if (
			!this.source_code.includes("use anchor_lang::prelude::*") &&
			!this.source_code.includes("use solana_program::")
		) {
			errors.push("Missing Solana/Anchor framework imports");
		}

		if (
			this.source_code.includes("use anchor_lang::prelude::*") &&
			!this.source_code.includes("#[program]")
		) {
			errors.push("Missing #[program] attribute for Anchor program");
		}

		// Check for balanced braces
		const openBraces = (this.source_code.match(/{/g) || []).length;
		const closeBraces = (this.source_code.match(/}/g) || []).length;
		if (openBraces !== closeBraces) {
			errors.push("Unbalanced braces in Rust code");
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	validateHaskell(): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Basic Haskell/Plutus validation
		if (!this.source_code.includes("module ")) {
			errors.push("Missing module declaration");
		}

		if (
			this.source_code.includes("Plutus") &&
			!this.source_code.includes("import Plutus")
		) {
			errors.push("Missing Plutus imports for Plutus script");
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	validateMove(): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Basic Move validation
		if (!this.source_code.includes("module ")) {
			errors.push("Missing module declaration");
		}

		if (
			!this.source_code.includes("public ") &&
			!this.source_code.includes("entry ")
		) {
			errors.push("No public or entry functions found");
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	validate(): { isValid: boolean; errors: string[] } {
		switch (this.language.toLowerCase()) {
			case "solidity":
				return this.validateSolidity();
			case "rust":
				return this.validateRust();
			case "haskell":
			case "plutus":
				return this.validateHaskell();
			case "move":
				return this.validateMove();
			default:
				return {
					isValid: false,
					errors: [`Unsupported language: ${this.language}`],
				};
		}
	}

	static async findByPlatform(platform: string): Promise<ContractModel[]> {
		const contracts = await DatabaseService.getContractsByPlatform(platform);
		return contracts.map((contract) => new ContractModel(contract));
	}

	static async findByLanguage(language: string): Promise<ContractModel[]> {
		const contracts = await DatabaseService.getContractsByLanguage(language);
		return contracts.map((contract) => new ContractModel(contract));
	}

	isMultiChain(): boolean {
		return (
			this.cross_chain_config !== undefined &&
			this.cross_chain_config.target_chains.length > 1
		);
	}

	getTargetChains(): string[] {
		return this.cross_chain_config?.target_chains || [this.blockchain_platform];
	}

	hasDependencies(): boolean {
		return this.dependencies !== undefined && this.dependencies.length > 0;
	}

	getDependencyCount(): number {
		return this.dependencies?.length || 0;
	}

	getDependenciesByType(
		type: "import" | "library" | "interface"
	): ContractDependency[] {
		return this.dependencies?.filter((dep) => dep.type === type) || [];
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
			blockchain_platform: this.blockchain_platform,
			language: this.language,
			dependencies: this.dependencies,
			cross_chain_config: this.cross_chain_config,
			created_at: this.created_at,
		};
	}
}
