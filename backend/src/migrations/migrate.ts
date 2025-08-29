import dotenv from "dotenv";
import { supabase } from "../config/supabase";

// Load environment variables
dotenv.config();

interface MigrationResult {
	success: boolean;
	message: string;
	error?: any;
}

export class DatabaseMigrator {
	static async createTablesDirectly(): Promise<MigrationResult> {
		try {
			console.log("Verifying database connection and table existence...");
			console.log(
				"Note: Tables should be created via Supabase Dashboard SQL Editor for production use."
			);

			// Test connection by trying to query users table
			const { data, error } = await supabase
				.from("users")
				.select("count")
				.limit(1);

			if (error && error.code === "PGRST116") {
				// Table doesn't exist - this is expected for first run
				console.log(
					"📋 Tables need to be created. Please run the SQL migration in Supabase Dashboard."
				);
				console.log(
					"📋 SQL file location: backend/src/migrations/001_initial_schema.sql"
				);
				console.log(
					"📋 Copy the SQL content and run it in Supabase Dashboard > SQL Editor"
				);
				return {
					success: false,
					message:
						"Tables do not exist yet. Please create them using the Supabase Dashboard SQL Editor.",
					error: "Tables not found",
				};
			} else if (error) {
				console.error("Database connection error:", error);
				return {
					success: false,
					message: "Database connection failed",
					error,
				};
			} else {
				console.log("✅ Database connection successful and tables exist");
				return {
					success: true,
					message: "Database tables verified successfully",
				};
			}
		} catch (error) {
			return {
				success: false,
				message: "Failed to verify database connection",
				error,
			};
		}
	}

	static async verifyTables(): Promise<MigrationResult> {
		try {
			console.log("Verifying database tables...");

			const tables = ["users", "contracts", "audits", "vulnerabilities"];
			const results = [];

			for (const table of tables) {
				const { data, error } = await supabase.from(table).select("*").limit(1);

				if (error) {
					console.error(
						`❌ Table ${table} verification failed:`,
						error.message
					);
					results.push({ table, exists: false, error: error.message });
				} else {
					console.log(`✅ Table ${table} exists and is accessible`);
					results.push({ table, exists: true });
				}
			}

			const allTablesExist = results.every((r) => r.exists);

			return {
				success: allTablesExist,
				message: allTablesExist
					? "All database tables verified successfully"
					: "Some database tables are missing or inaccessible",
			};
		} catch (error) {
			return {
				success: false,
				message: "Failed to verify database tables",
				error,
			};
		}
	}
}

// CLI runner for migrations
if (require.main === module) {
	async function runMigrations() {
		console.log("🚀 Starting database migration process...");

		// Try to verify tables exist
		const verifyResult = await DatabaseMigrator.verifyTables();

		if (verifyResult.success) {
			console.log("🎉 Database tables verified successfully!");
			process.exit(0);
		} else {
			console.log(
				"📋 Please create the database tables using the Supabase Dashboard:"
			);
			console.log("1. Go to your Supabase project dashboard");
			console.log("2. Navigate to SQL Editor");
			console.log(
				"3. Copy and run the SQL from: backend/src/migrations/001_initial_schema.sql"
			);
			console.log("4. Run this migration script again to verify");
			process.exit(1);
		}
	}

	runMigrations().catch((error) => {
		console.error("❌ Migration process failed:", error);
		process.exit(1);
	});
}
