import dotenv from "dotenv";

dotenv.config();

export const config = {
	port: process.env.PORT || 3001,
	nodeEnv: process.env.NODE_ENV || "development",

	// Database
	supabase: {
		url: process.env.SUPABASE_URL || "",
		anonKey: process.env.SUPABASE_ANON_KEY || "",
		serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
	},

	// AI Services
	openRouter: {
		apiKey: process.env.OPENROUTER_API_KEY || "",
	},

	langchain: {
		apiKey: process.env.LANGCHAIN_API_KEY || "",
	},

	// Email Service
	senderwolf: {
		apiKey: process.env.SENDERWOLF_API_KEY || "",
		fromEmail: process.env.SENDERWOLF_FROM_EMAIL || "noreply@auditwolf.com",
	},

	// IPFS
	ipfs: {
		gatewayUrl: process.env.IPFS_GATEWAY_URL || "https://ipfs.io/ipfs/",
		apiUrl: process.env.IPFS_API_URL || "https://api.pinata.cloud",
	},

	// Blockchain
	blockchain: {
		ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || "",
		polygonRpcUrl: process.env.POLYGON_RPC_URL || "",
		privateKey: process.env.PRIVATE_KEY || "",
	},

	// Redis
	redis: {
		url: process.env.REDIS_URL || "redis://localhost:6379",
	},

	// Security
	jwt: {
		secret: process.env.JWT_SECRET || "your-secret-key",
	},

	encryption: {
		key: process.env.ENCRYPTION_KEY || "your-encryption-key",
	},
};
