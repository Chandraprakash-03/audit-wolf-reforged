import { supabase } from "./database";

export interface QueryPerformanceMetrics {
	queryTime: number;
	rowsReturned: number;
	indexesUsed: string[];
	queryPlan?: any;
}

export class DatabaseOptimizationService {
	private static instance: DatabaseOptimizationService;
	private queryMetrics: Map<string, QueryPerformanceMetrics[]> = new Map();

	private constructor() {}

	public static getInstance(): DatabaseOptimizationService {
		if (!DatabaseOptimizationService.instance) {
			DatabaseOptimizationService.instance = new DatabaseOptimizationService();
		}
		return DatabaseOptimizationService.instance;
	}

	/**
	 * Create database indexes for performance optimization
	 */
	async createOptimizedIndexes(): Promise<void> {
		try {
			console.log("Creating optimized database indexes...");

			// Index for user audits lookup (most common query)
			await this.createIndexIfNotExists(
				"idx_audits_user_id_created_at",
				"audits",
				["user_id", "created_at DESC"]
			);

			// Index for audit status filtering
			await this.createIndexIfNotExists(
				"idx_audits_status_created_at",
				"audits",
				["status", "created_at DESC"]
			);

			// Index for contract file hash lookup (for duplicate detection)
			await this.createIndexIfNotExists(
				"idx_contracts_file_hash",
				"contracts",
				["file_hash"]
			);

			// Index for vulnerability severity filtering
			await this.createIndexIfNotExists(
				"idx_vulnerabilities_audit_severity",
				"vulnerabilities",
				["audit_id", "severity"]
			);

			// Composite index for user audit history with status
			await this.createIndexIfNotExists(
				"idx_audits_user_status_date",
				"audits",
				["user_id", "status", "created_at DESC"]
			);

			// Index for contract name search
			await this.createIndexIfNotExists(
				"idx_contracts_user_name",
				"contracts",
				["user_id", "name"]
			);

			// Index for audit completion time analysis
			await this.createIndexIfNotExists("idx_audits_completed_at", "audits", [
				"completed_at DESC",
			]);

			// Partial index for active audits only
			await this.createPartialIndexIfNotExists(
				"idx_audits_active",
				"audits",
				["user_id", "created_at DESC"],
				"status IN ('pending', 'analyzing')"
			);

			console.log("Database indexes created successfully");
		} catch (error) {
			console.error("Error creating database indexes:", error);
			throw error;
		}
	}

	/**
	 * Optimized query for user audit history with pagination
	 */
	async getUserAuditsOptimized(
		userId: string,
		limit: number = 20,
		offset: number = 0,
		status?: string
	): Promise<{ data: any[]; count: number; metrics: QueryPerformanceMetrics }> {
		const startTime = Date.now();

		try {
			let query = supabase
				.from("audits")
				.select(
					`
          id,
          status,
          created_at,
          completed_at,
          contracts (
            id,
            name,
            file_hash
          ),
          vulnerabilities (
            severity
          )
        `,
					{ count: "exact" }
				)
				.eq("user_id", userId)
				.order("created_at", { ascending: false })
				.range(offset, offset + limit - 1);

			if (status) {
				query = query.eq("status", status);
			}

			const { data, error, count } = await query;

			if (error) throw error;

			const queryTime = Date.now() - startTime;
			const metrics: QueryPerformanceMetrics = {
				queryTime,
				rowsReturned: data?.length || 0,
				indexesUsed: ["idx_audits_user_id_created_at"],
			};

			this.recordQueryMetrics("getUserAuditsOptimized", metrics);

			return { data: data || [], count: count || 0, metrics };
		} catch (error) {
			console.error("Error in optimized user audits query:", error);
			throw error;
		}
	}

	/**
	 * Optimized query for audit details with related data
	 */
	async getAuditDetailsOptimized(
		auditId: string,
		userId: string
	): Promise<{ data: any; metrics: QueryPerformanceMetrics }> {
		const startTime = Date.now();

		try {
			const { data, error } = await supabase
				.from("audits")
				.select(
					`
          *,
          contracts (
            id,
            name,
            source_code,
            compiler_version,
            file_hash
          ),
          vulnerabilities (
            id,
            type,
            severity,
            title,
            description,
            location,
            recommendation,
            confidence,
            source
          )
        `
				)
				.eq("id", auditId)
				.eq("user_id", userId)
				.single();

			if (error) throw error;

			const queryTime = Date.now() - startTime;
			const metrics: QueryPerformanceMetrics = {
				queryTime,
				rowsReturned: data ? 1 : 0,
				indexesUsed: ["primary_key", "idx_audits_user_id_created_at"],
			};

			this.recordQueryMetrics("getAuditDetailsOptimized", metrics);

			return { data, metrics };
		} catch (error) {
			console.error("Error in optimized audit details query:", error);
			throw error;
		}
	}

	/**
	 * Optimized search for contracts by name or hash
	 */
	async searchContractsOptimized(
		userId: string,
		searchTerm: string,
		limit: number = 10
	): Promise<{ data: any[]; metrics: QueryPerformanceMetrics }> {
		const startTime = Date.now();

		try {
			const { data, error } = await supabase
				.from("contracts")
				.select(
					`
          id,
          name,
          file_hash,
          created_at,
          audits (
            id,
            status,
            created_at
          )
        `
				)
				.eq("user_id", userId)
				.or(`name.ilike.%${searchTerm}%,file_hash.ilike.%${searchTerm}%`)
				.order("created_at", { ascending: false })
				.limit(limit);

			if (error) throw error;

			const queryTime = Date.now() - startTime;
			const metrics: QueryPerformanceMetrics = {
				queryTime,
				rowsReturned: data?.length || 0,
				indexesUsed: ["idx_contracts_user_name", "idx_contracts_file_hash"],
			};

			this.recordQueryMetrics("searchContractsOptimized", metrics);

			return { data: data || [], metrics };
		} catch (error) {
			console.error("Error in optimized contract search:", error);
			throw error;
		}
	}

	/**
	 * Optimized vulnerability statistics query
	 */
	async getVulnerabilityStatsOptimized(
		userId: string,
		timeRange?: { start: Date; end: Date }
	): Promise<{ data: any; metrics: QueryPerformanceMetrics }> {
		const startTime = Date.now();

		try {
			let query = supabase
				.from("vulnerabilities")
				.select(
					`
          severity,
          type,
          audits!inner (
            user_id,
            created_at
          )
        `
				)
				.eq("audits.user_id", userId);

			if (timeRange) {
				query = query
					.gte("audits.created_at", timeRange.start.toISOString())
					.lte("audits.created_at", timeRange.end.toISOString());
			}

			const { data, error } = await query;

			if (error) throw error;

			// Aggregate the results
			const stats = data?.reduce(
				(acc: any, vuln: any) => {
					const severity = vuln.severity;
					const type = vuln.type;

					if (!acc.bySeverity[severity]) acc.bySeverity[severity] = 0;
					if (!acc.byType[type]) acc.byType[type] = 0;

					acc.bySeverity[severity]++;
					acc.byType[type]++;
					acc.total++;

					return acc;
				},
				{ bySeverity: {}, byType: {}, total: 0 }
			) || { bySeverity: {}, byType: {}, total: 0 };

			const queryTime = Date.now() - startTime;
			const metrics: QueryPerformanceMetrics = {
				queryTime,
				rowsReturned: data?.length || 0,
				indexesUsed: ["idx_vulnerabilities_audit_severity"],
			};

			this.recordQueryMetrics("getVulnerabilityStatsOptimized", metrics);

			return { data: stats, metrics };
		} catch (error) {
			console.error("Error in optimized vulnerability stats query:", error);
			throw error;
		}
	}

	/**
	 * Batch insert vulnerabilities for better performance
	 */
	async batchInsertVulnerabilities(
		vulnerabilities: any[]
	): Promise<QueryPerformanceMetrics> {
		const startTime = Date.now();

		try {
			const { error } = await supabase
				.from("vulnerabilities")
				.insert(vulnerabilities);

			if (error) throw error;

			const queryTime = Date.now() - startTime;
			const metrics: QueryPerformanceMetrics = {
				queryTime,
				rowsReturned: vulnerabilities.length,
				indexesUsed: ["primary_key"],
			};

			this.recordQueryMetrics("batchInsertVulnerabilities", metrics);

			return metrics;
		} catch (error) {
			console.error("Error in batch insert vulnerabilities:", error);
			throw error;
		}
	}

	/**
	 * Get query performance analytics
	 */
	getQueryAnalytics(): {
		[queryName: string]: {
			avgTime: number;
			totalCalls: number;
			avgRowsReturned: number;
		};
	} {
		const analytics: any = {};

		for (const [queryName, metrics] of this.queryMetrics.entries()) {
			const totalTime = metrics.reduce((sum, m) => sum + m.queryTime, 0);
			const totalRows = metrics.reduce((sum, m) => sum + m.rowsReturned, 0);

			analytics[queryName] = {
				avgTime: Math.round(totalTime / metrics.length),
				totalCalls: metrics.length,
				avgRowsReturned: Math.round(totalRows / metrics.length),
			};
		}

		return analytics;
	}

	/**
	 * Clear query metrics
	 */
	clearQueryMetrics(): void {
		this.queryMetrics.clear();
	}

	// Private helper methods
	private async createIndexIfNotExists(
		indexName: string,
		tableName: string,
		columns: string[]
	): Promise<void> {
		try {
			const columnList = columns.join(", ");
			const query = `
        CREATE INDEX IF NOT EXISTS ${indexName} 
        ON ${tableName} (${columnList})
      `;

			const { error } = await supabase.rpc("execute_sql", { sql: query });

			if (error) {
				console.warn(`Could not create index ${indexName}:`, error.message);
			} else {
				console.log(`Index ${indexName} created successfully`);
			}
		} catch (error) {
			console.warn(`Error creating index ${indexName}:`, error);
		}
	}

	private async createPartialIndexIfNotExists(
		indexName: string,
		tableName: string,
		columns: string[],
		condition: string
	): Promise<void> {
		try {
			const columnList = columns.join(", ");
			const query = `
        CREATE INDEX IF NOT EXISTS ${indexName} 
        ON ${tableName} (${columnList})
        WHERE ${condition}
      `;

			const { error } = await supabase.rpc("execute_sql", { sql: query });

			if (error) {
				console.warn(
					`Could not create partial index ${indexName}:`,
					error.message
				);
			} else {
				console.log(`Partial index ${indexName} created successfully`);
			}
		} catch (error) {
			console.warn(`Error creating partial index ${indexName}:`, error);
		}
	}

	private recordQueryMetrics(
		queryName: string,
		metrics: QueryPerformanceMetrics
	): void {
		if (!this.queryMetrics.has(queryName)) {
			this.queryMetrics.set(queryName, []);
		}

		const queryMetricsList = this.queryMetrics.get(queryName)!;
		queryMetricsList.push(metrics);

		// Keep only last 100 metrics per query to prevent memory leaks
		if (queryMetricsList.length > 100) {
			queryMetricsList.shift();
		}
	}
}

export const dbOptimizationService = DatabaseOptimizationService.getInstance();
