import { BlockchainPlatform } from "@/types";

export const BLOCKCHAIN_PLATFORMS: BlockchainPlatform[] = [
	{
		id: "ethereum",
		name: "ethereum",
		displayName: "Ethereum",
		description:
			"The original smart contract platform with the largest ecosystem and developer community.",
		supportedLanguages: ["solidity", "vyper"],
		fileExtensions: [".sol", ".vy"],
		staticAnalyzers: [
			{
				name: "slither",
				command: "slither",
				args: ["--json", "-"],
				outputParser: () => ({
					success: true,
					vulnerabilities: [],
					errors: [],
					warnings: [],
					executionTime: 0,
				}),
				supportedLanguages: ["solidity"],
				installationCheck: async () => ({ installed: true }),
				timeout: 30000,
			},
		],
		aiModels: [
			{
				provider: "openai",
				modelId: "gpt-4",
				specialization: ["solidity", "evm"],
				costPerToken: 0.00003,
				maxTokens: 8192,
				contextPrompts: ["ethereum-security", "solidity-best-practices"],
			},
		],
		validationRules: [],
		detectionPatterns: [
			{
				type: "pragma",
				pattern: /pragma\s+solidity/,
				weight: 0.9,
				description: "Solidity pragma directive",
			},
			{
				type: "keyword",
				pattern: /\bcontract\s+\w+/,
				weight: 0.8,
				description: "Contract definition",
			},
		],
		isActive: true,
		version: "1.0.0",
		website: "https://ethereum.org",
	},
	{
		id: "bsc",
		name: "bsc",
		displayName: "Binance Smart Chain",
		description:
			"EVM-compatible blockchain with lower fees and faster transactions than Ethereum.",
		supportedLanguages: ["solidity"],
		fileExtensions: [".sol"],
		staticAnalyzers: [
			{
				name: "slither",
				command: "slither",
				args: ["--json", "-"],
				outputParser: () => ({
					success: true,
					vulnerabilities: [],
					errors: [],
					warnings: [],
					executionTime: 0,
				}),
				supportedLanguages: ["solidity"],
				installationCheck: async () => ({ installed: true }),
				timeout: 30000,
			},
		],
		aiModels: [
			{
				provider: "openai",
				modelId: "gpt-4",
				specialization: ["solidity", "bsc", "bep-20"],
				costPerToken: 0.00003,
				maxTokens: 8192,
				contextPrompts: ["bsc-security", "bep-standards"],
			},
		],
		validationRules: [],
		detectionPatterns: [
			{
				type: "pragma",
				pattern: /pragma\s+solidity/,
				weight: 0.9,
				description: "Solidity pragma directive",
			},
		],
		isActive: true,
		version: "1.0.0",
		website: "https://www.bnbchain.org",
	},
	{
		id: "polygon",
		name: "polygon",
		displayName: "Polygon",
		description:
			"Layer 2 scaling solution for Ethereum with EVM compatibility and lower gas fees.",
		supportedLanguages: ["solidity"],
		fileExtensions: [".sol"],
		staticAnalyzers: [
			{
				name: "slither",
				command: "slither",
				args: ["--json", "-"],
				outputParser: () => ({
					success: true,
					vulnerabilities: [],
					errors: [],
					warnings: [],
					executionTime: 0,
				}),
				supportedLanguages: ["solidity"],
				installationCheck: async () => ({ installed: true }),
				timeout: 30000,
			},
		],
		aiModels: [
			{
				provider: "openai",
				modelId: "gpt-4",
				specialization: ["solidity", "polygon", "layer2"],
				costPerToken: 0.00003,
				maxTokens: 8192,
				contextPrompts: ["polygon-security", "layer2-patterns"],
			},
		],
		validationRules: [],
		detectionPatterns: [
			{
				type: "pragma",
				pattern: /pragma\s+solidity/,
				weight: 0.9,
				description: "Solidity pragma directive",
			},
		],
		isActive: true,
		version: "1.0.0",
		website: "https://polygon.technology",
	},
	{
		id: "solana",
		name: "solana",
		displayName: "Solana",
		description:
			"High-performance blockchain with Rust-based smart contracts and innovative account model.",
		supportedLanguages: ["rust", "anchor"],
		fileExtensions: [".rs", ".toml"],
		staticAnalyzers: [
			{
				name: "clippy",
				command: "cargo",
				args: ["clippy", "--", "-D", "warnings"],
				outputParser: () => ({
					success: true,
					vulnerabilities: [],
					errors: [],
					warnings: [],
					executionTime: 0,
				}),
				supportedLanguages: ["rust"],
				installationCheck: async () => ({ installed: true }),
				timeout: 60000,
			},
		],
		aiModels: [
			{
				provider: "openai",
				modelId: "gpt-4",
				specialization: ["rust", "solana", "anchor"],
				costPerToken: 0.00003,
				maxTokens: 8192,
				contextPrompts: ["solana-security", "anchor-patterns", "rust-security"],
			},
		],
		validationRules: [],
		detectionPatterns: [
			{
				type: "import",
				pattern: /use\s+anchor_lang/,
				weight: 0.9,
				description: "Anchor framework import",
			},
			{
				type: "keyword",
				pattern: /#\[program\]/,
				weight: 0.8,
				description: "Anchor program attribute",
			},
		],
		isActive: true,
		version: "1.0.0",
		website: "https://solana.com",
	},
	{
		id: "cardano",
		name: "cardano",
		displayName: "Cardano",
		description:
			"Research-driven blockchain with Haskell-based Plutus smart contracts and UTXO model.",
		supportedLanguages: ["haskell", "plutus"],
		fileExtensions: [".hs", ".plutus"],
		staticAnalyzers: [
			{
				name: "hlint",
				command: "hlint",
				args: ["--json"],
				outputParser: () => ({
					success: true,
					vulnerabilities: [],
					errors: [],
					warnings: [],
					executionTime: 0,
				}),
				supportedLanguages: ["haskell"],
				installationCheck: async () => ({ installed: true }),
				timeout: 45000,
			},
		],
		aiModels: [
			{
				provider: "openai",
				modelId: "gpt-4",
				specialization: ["haskell", "plutus", "cardano"],
				costPerToken: 0.00003,
				maxTokens: 8192,
				contextPrompts: ["cardano-security", "plutus-patterns", "utxo-model"],
			},
		],
		validationRules: [],
		detectionPatterns: [
			{
				type: "import",
				pattern: /import\s+Plutus/,
				weight: 0.9,
				description: "Plutus library import",
			},
			{
				type: "keyword",
				pattern: /validator\s*::/,
				weight: 0.8,
				description: "Validator function definition",
			},
		],
		isActive: true,
		version: "1.0.0",
		website: "https://cardano.org",
	},
	{
		id: "aptos",
		name: "aptos",
		displayName: "Aptos",
		description:
			"Move-based blockchain focused on safety, scalability, and user experience.",
		supportedLanguages: ["move"],
		fileExtensions: [".move"],
		staticAnalyzers: [
			{
				name: "move-prover",
				command: "move",
				args: ["prove"],
				outputParser: () => ({
					success: true,
					vulnerabilities: [],
					errors: [],
					warnings: [],
					executionTime: 0,
				}),
				supportedLanguages: ["move"],
				installationCheck: async () => ({ installed: true }),
				timeout: 90000,
			},
		],
		aiModels: [
			{
				provider: "openai",
				modelId: "gpt-4",
				specialization: ["move", "aptos", "resources"],
				costPerToken: 0.00003,
				maxTokens: 8192,
				contextPrompts: ["aptos-security", "move-patterns", "resource-safety"],
			},
		],
		validationRules: [],
		detectionPatterns: [
			{
				type: "keyword",
				pattern: /module\s+[\w:]+::\w+/,
				weight: 0.9,
				description: "Move module definition",
			},
			{
				type: "keyword",
				pattern: /\bresource\b/,
				weight: 0.8,
				description: "Resource type definition",
			},
		],
		isActive: true,
		version: "1.0.0",
		website: "https://aptos.dev",
	},
	{
		id: "sui",
		name: "sui",
		displayName: "Sui",
		description:
			"Object-centric Move blockchain with parallel execution and innovative consensus.",
		supportedLanguages: ["move"],
		fileExtensions: [".move"],
		staticAnalyzers: [
			{
				name: "sui-move-analyzer",
				command: "sui",
				args: ["move", "test"],
				outputParser: () => ({
					success: true,
					vulnerabilities: [],
					errors: [],
					warnings: [],
					executionTime: 0,
				}),
				supportedLanguages: ["move"],
				installationCheck: async () => ({ installed: true }),
				timeout: 90000,
			},
		],
		aiModels: [
			{
				provider: "openai",
				modelId: "gpt-4",
				specialization: ["move", "sui", "objects"],
				costPerToken: 0.00003,
				maxTokens: 8192,
				contextPrompts: ["sui-security", "object-model", "move-patterns"],
			},
		],
		validationRules: [],
		detectionPatterns: [
			{
				type: "import",
				pattern: /use\s+sui::/,
				weight: 0.9,
				description: "Sui framework import",
			},
			{
				type: "keyword",
				pattern: /module\s+[\w:]+::\w+/,
				weight: 0.8,
				description: "Move module definition",
			},
		],
		isActive: true,
		version: "1.0.0",
		website: "https://sui.io",
	},
	{
		id: "cosmos",
		name: "cosmos",
		displayName: "Cosmos",
		description:
			"Interoperable blockchain ecosystem with CosmWasm smart contracts.",
		supportedLanguages: ["rust", "cosmwasm"],
		fileExtensions: [".rs"],
		staticAnalyzers: [
			{
				name: "clippy",
				command: "cargo",
				args: ["clippy", "--", "-D", "warnings"],
				outputParser: () => ({
					success: true,
					vulnerabilities: [],
					errors: [],
					warnings: [],
					executionTime: 0,
				}),
				supportedLanguages: ["rust"],
				installationCheck: async () => ({ installed: true }),
				timeout: 60000,
			},
		],
		aiModels: [
			{
				provider: "openai",
				modelId: "gpt-4",
				specialization: ["rust", "cosmwasm", "cosmos"],
				costPerToken: 0.00003,
				maxTokens: 8192,
				contextPrompts: ["cosmwasm-security", "cosmos-patterns"],
			},
		],
		validationRules: [],
		detectionPatterns: [
			{
				type: "import",
				pattern: /use\s+cosmwasm/,
				weight: 0.9,
				description: "CosmWasm import",
			},
		],
		isActive: false, // Coming soon
		version: "1.0.0",
		website: "https://cosmos.network",
	},
];

export const getActivePlatforms = (): BlockchainPlatform[] => {
	return BLOCKCHAIN_PLATFORMS.filter((platform) => platform.isActive);
};

export const getPlatformById = (id: string): BlockchainPlatform | undefined => {
	return BLOCKCHAIN_PLATFORMS.find((platform) => platform.id === id);
};

export const getPlatformsByLanguage = (
	language: string
): BlockchainPlatform[] => {
	return BLOCKCHAIN_PLATFORMS.filter((platform) =>
		platform.supportedLanguages.includes(language)
	);
};
