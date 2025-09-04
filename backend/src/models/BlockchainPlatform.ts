import { DatabaseService } from "../services/database";
import { BlockchainPlatform as BlockchainPlatformType } from "../types/database";

export class BlockchainPlatformModel {
	public id: string;
	public name: string;
	public supported_languages: string[];
	public file_extensions: string[];
	public static_analyzers: Record<string, any>;
	public ai_models: Record<string, any>;
	public validation_rules: Record<string, any>;
	public is_active: boolean;
	public created_at: Date;
	public updated_at: Date;

	constructor(data: BlockchainPlatformType) {
		this.id = data.id;
		this.name = data.name;
		this.supported_languages = data.supported_languages;
		this.file_extensions = data.file_extensions;
		this.static_analyzers = data.static_analyzers;
		this.ai_models = data.ai_models;
		this.validation_rules = data.validation_rules;
		this.is_active = data.is_active;
		this.created_at = data.created_at;
		this.updated_at = data.updated_at;
	}

	static async findAll(): Promise<BlockchainPlatformModel[]> {
		const platforms = await DatabaseService.getAllBlockchainPlatforms();
		return platforms.map((platform) => new BlockchainPlatformModel(platform));
	}

	static async findActive(): Promise<BlockchainPlatformModel[]> {
		const platforms = await DatabaseService.getActiveBlockchainPlatforms();
		return platforms.map((platform) => new BlockchainPlatformModel(platform));
	}

	static async findById(id: string): Promise<BlockchainPlatformModel | null> {
		const platform = await DatabaseService.getBlockchainPlatformById(id);
		return platform ? new BlockchainPlatformModel(platform) : null;
	}

	static async create(platformData: {
		id: string;
		name: string;
		supported_languages: string[];
		file_extensions: string[];
		static_analyzers: Record<string, any>;
		ai_models: Record<string, any>;
		validation_rules: Record<string, any>;
		is_active?: boolean;
	}): Promise<BlockchainPlatformModel | null> {
		const platform = await DatabaseService.createBlockchainPlatform({
			...platformData,
			is_active: platformData.is_active ?? true,
		});

		return platform ? new BlockchainPlatformModel(platform) : null;
	}

	async update(
		updates: Partial<{
			name: string;
			supported_languages: string[];
			file_extensions: string[];
			static_analyzers: Record<string, any>;
			ai_models: Record<string, any>;
			validation_rules: Record<string, any>;
			is_active: boolean;
		}>
	): Promise<boolean> {
		const updated = await DatabaseService.updateBlockchainPlatform(
			this.id,
			updates
		);
		if (updated) {
			Object.assign(this, updates);
			return true;
		}
		return false;
	}

	supportsLanguage(language: string): boolean {
		return this.supported_languages.includes(language.toLowerCase());
	}

	supportsFileExtension(extension: string): boolean {
		return this.file_extensions.includes(extension.toLowerCase());
	}

	getStaticAnalyzers(): string[] {
		return Object.keys(this.static_analyzers);
	}

	getAIModels(): string[] {
		const models: string[] = [];
		Object.values(this.ai_models).forEach((provider: any) => {
			if (provider.models && Array.isArray(provider.models)) {
				models.push(...provider.models);
			}
		});
		return models;
	}

	validateContract(contractData: {
		source_code: string;
		filename?: string;
		language: string;
	}): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Check language support
		if (!this.supportsLanguage(contractData.language)) {
			errors.push(
				`Language ${contractData.language} is not supported by ${this.name}`
			);
		}

		// Check file extension if filename provided
		if (contractData.filename) {
			const extension = contractData.filename.substring(
				contractData.filename.lastIndexOf(".")
			);
			if (!this.supportsFileExtension(extension)) {
				errors.push(
					`File extension ${extension} is not supported by ${this.name}`
				);
			}
		}

		// Apply platform-specific validation rules
		if (this.validation_rules.file_size_limit) {
			const sizeInBytes = Buffer.byteLength(contractData.source_code, "utf8");
			if (sizeInBytes > this.validation_rules.file_size_limit) {
				errors.push(
					`Contract size exceeds limit of ${this.validation_rules.file_size_limit} bytes`
				);
			}
		}

		// Platform-specific validations
		if (
			this.id === "ethereum" ||
			this.id === "binance-smart-chain" ||
			this.id === "polygon"
		) {
			if (
				this.validation_rules.required_pragma &&
				!contractData.source_code.includes("pragma solidity")
			) {
				errors.push("Missing pragma solidity directive");
			}
		}

		if (this.id === "solana" && this.validation_rules.anchor_required) {
			if (!contractData.source_code.includes("use anchor_lang::prelude::*")) {
				errors.push("Anchor framework import is required for Solana contracts");
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	toJSON() {
		return {
			id: this.id,
			name: this.name,
			supported_languages: this.supported_languages,
			file_extensions: this.file_extensions,
			static_analyzers: this.static_analyzers,
			ai_models: this.ai_models,
			validation_rules: this.validation_rules,
			is_active: this.is_active,
			created_at: this.created_at,
			updated_at: this.updated_at,
		};
	}
}
