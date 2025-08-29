import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	throw new Error(
		"Missing Supabase environment variables. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
	);
}

// Create Supabase client with service role key for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
	},
});

// Database connection utility functions
export class DatabaseConnection {
	static async testConnection(): Promise<boolean> {
		try {
			const { data, error } = await supabase
				.from("users")
				.select("count")
				.limit(1);
			if (error) {
				console.error("Database connection test failed:", error);
				return false;
			}
			console.log("Database connection successful");
			return true;
		} catch (error) {
			console.error("Database connection error:", error);
			return false;
		}
	}

	static async healthCheck(): Promise<{ status: string; timestamp: Date }> {
		try {
			const isConnected = await this.testConnection();
			return {
				status: isConnected ? "healthy" : "unhealthy",
				timestamp: new Date(),
			};
		} catch (error) {
			return {
				status: "error",
				timestamp: new Date(),
			};
		}
	}
}

export default supabase;
