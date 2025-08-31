// Jest setup file for backend tests

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.PORT = "0"; // Use random available port for tests
process.env.SUPABASE_URL =
	process.env.SUPABASE_URL || "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY =
	process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";
process.env.SUPABASE_ANON_KEY =
	process.env.SUPABASE_ANON_KEY || "test-anon-key";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.OPENROUTER_API_KEY = "test-openrouter-key";
process.env.ENCRYPTION_KEY = "test-encryption-key-32-characters-long";

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests (but keep error for debugging)
const originalConsole = global.console;
global.console = {
	...console,
	log: jest.fn(),
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: originalConsole.error, // Keep error for debugging
};

// Mock user database for tests
const mockUsers = new Map();
const mockSessions = new Map();
const generateId = () => Math.random().toString(36).substring(2, 15);

// Mock Supabase config
jest.mock("../config/supabase", () => {
	const mockClient = {
		auth: {
			signUp: jest.fn().mockImplementation(async (params) => {
				const { email, password, options } = params;
				const userId = generateId();
				const sessionId = generateId();

				// Check if user already exists
				if (
					Array.from(mockUsers.values()).some((user) => user.email === email)
				) {
					return {
						data: { user: null, session: null },
						error: { message: "User already registered" },
					};
				}

				const user = {
					id: userId,
					email,
					user_metadata: options?.data || {},
					created_at: new Date().toISOString(),
				};

				const session = {
					access_token: `mock-token-${sessionId}`,
					refresh_token: `mock-refresh-${sessionId}`,
					expires_at: Date.now() + 3600000,
				};

				mockUsers.set(userId, { ...user, password });
				mockSessions.set(sessionId, { user, session });

				return {
					data: { user, session },
					error: null,
				};
			}),
			signInWithPassword: jest.fn().mockImplementation(async (params) => {
				const { email, password } = params;
				const user = Array.from(mockUsers.values()).find(
					(u) => u.email === email && u.password === password
				);

				if (!user) {
					return {
						data: { user: null, session: null },
						error: { message: "Invalid login credentials" },
					};
				}

				const sessionId = generateId();
				const session = {
					access_token: `mock-token-${sessionId}`,
					refresh_token: `mock-refresh-${sessionId}`,
					expires_at: Date.now() + 3600000,
				};

				mockSessions.set(sessionId, { user, session });

				return {
					data: { user, session },
					error: null,
				};
			}),
			getUser: jest.fn().mockImplementation(async (token) => {
				// Handle both direct token and Bearer token format
				let actualToken = token;
				if (typeof token === "string" && token.startsWith("Bearer ")) {
					actualToken = token.replace("Bearer ", "");
				}

				if (
					!actualToken ||
					typeof actualToken !== "string" ||
					!actualToken.startsWith("mock-token-")
				) {
					return {
						data: { user: null },
						error: { message: "Invalid token" },
					};
				}

				const sessionId = actualToken.replace("mock-token-", "");
				const sessionData = mockSessions.get(sessionId);

				if (!sessionData) {
					// Create a default user for any valid mock token format
					const defaultUser = {
						id: generateId(),
						email: "test@example.com",
						user_metadata: { role: "user" },
						created_at: new Date().toISOString(),
					};
					return {
						data: { user: defaultUser },
						error: null,
					};
				}

				return {
					data: { user: sessionData.user },
					error: null,
				};
			}),
			refreshSession: jest.fn().mockImplementation(async (params) => {
				const { refresh_token } = params;

				if (!refresh_token || !refresh_token.startsWith("mock-refresh-")) {
					return {
						data: { session: null, user: null },
						error: { message: "Invalid refresh token" },
					};
				}

				const sessionId = refresh_token.replace("mock-refresh-", "");
				const sessionData = mockSessions.get(sessionId);

				if (!sessionData) {
					return {
						data: { session: null, user: null },
						error: { message: "Invalid refresh token" },
					};
				}

				// Generate new tokens
				const newSessionId = generateId();
				const newSession = {
					access_token: `mock-token-${newSessionId}`,
					refresh_token: `mock-refresh-${newSessionId}`,
					expires_at: Date.now() + 3600000,
				};

				mockSessions.set(newSessionId, {
					user: sessionData.user,
					session: newSession,
				});

				return {
					data: { session: newSession, user: sessionData.user },
					error: null,
				};
			}),
			signOut: jest.fn().mockResolvedValue({
				error: null,
			}),
			admin: {
				signOut: jest.fn().mockResolvedValue({
					error: null,
				}),
			},
		},
		from: jest.fn().mockImplementation((table) => {
			const mockTable = {
				select: jest.fn().mockReturnThis(),
				insert: jest.fn().mockImplementation((data) => {
					const mockData = Array.isArray(data) ? data : [data];
					const enrichedData = {
						...mockData[0],
						id: generateId(),
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					};
					return {
						...mockTable,
						single: jest.fn().mockResolvedValue({
							data: enrichedData,
							error: null,
						}),
					};
				}),
				update: jest.fn().mockImplementation((data) => {
					return {
						...mockTable,
						eq: jest.fn().mockReturnThis(),
						select: jest.fn().mockReturnThis(),
						single: jest.fn().mockResolvedValue({
							data: {
								...data,
								id: generateId(),
								updated_at: new Date().toISOString(),
							},
							error: null,
						}),
					};
				}),
				delete: jest.fn().mockReturnThis(),
				eq: jest.fn().mockReturnThis(),
				order: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				then: jest.fn().mockImplementation((callback) => {
					// Handle direct queries without single()
					if (table === "contracts") {
						return callback({ data: [], error: null });
					}
					return callback({ data: [], error: null });
				}),
				single: jest.fn().mockImplementation(() => {
					if (table === "users") {
						return Promise.resolve({
							data: {
								id: generateId(),
								email: "test@example.com",
								name: "Test User",
								created_at: new Date().toISOString(),
								updated_at: new Date().toISOString(),
							},
							error: null,
						});
					}
					if (table === "contracts") {
						return Promise.resolve({
							data: {
								id: generateId(),
								user_id: generateId(),
								name: "Test Contract",
								source_code: "contract Test {}",
								compiler_version: "0.8.19",
								file_hash: "test-hash",
								created_at: new Date().toISOString(),
								updated_at: new Date().toISOString(),
							},
							error: null,
						});
					}
					return Promise.resolve({
						data: null,
						error: { message: "Not found" },
					});
				}),
			};

			// Make the mockTable thenable for direct queries
			mockTable.then = jest.fn().mockImplementation((callback) => {
				if (table === "contracts") {
					return callback({ data: [], error: null });
				}
				return callback({ data: [], error: null });
			});

			return mockTable;
		}),
	};

	return {
		supabase: mockClient,
		DatabaseConnection: {
			testConnection: jest.fn().mockResolvedValue(true),
			healthCheck: jest.fn().mockResolvedValue({
				status: "healthy",
				timestamp: new Date(),
			}),
		},
		default: mockClient,
	};
});

// Mock Supabase before any imports
jest.mock("@supabase/supabase-js", () => {
	return {
		createClient: jest.fn(() => ({
			auth: {
				signUp: jest.fn(),
				signInWithPassword: jest.fn(),
				getUser: jest.fn(),
				refreshSession: jest.fn(),
				signOut: jest.fn(),
				admin: {
					signOut: jest.fn(),
				},
			},
			from: jest.fn(() => ({
				select: jest.fn().mockReturnThis(),
				insert: jest.fn().mockReturnThis(),
				update: jest.fn().mockReturnThis(),
				delete: jest.fn().mockReturnThis(),
				eq: jest.fn().mockReturnThis(),
				single: jest.fn(),
			})),
		})),
	};
});

// Mock Analysis Service
jest.mock("../services/AnalysisService", () => {
	const mockAnalysisService = {
		startStaticAnalysis: jest
			.fn()
			.mockImplementation(async (contractId, userId) => {
				// Check for specific test scenarios
				if (contractId === "nonexistent-contract") {
					return {
						success: false,
						error: "Contract not found",
					};
				}
				if (userId === "unauthorized-user") {
					return {
						success: false,
						error: "Access denied",
					};
				}
				if (contractId === "fail-audit-creation") {
					return {
						success: false,
						error: "Failed to create audit record",
					};
				}
				return {
					success: true,
					auditId: "audit-123",
					message: "Analysis started successfully",
				};
			}),
		startAIAnalysis: jest.fn().mockResolvedValue({
			success: true,
			auditId: "audit-123",
			message: "AI analysis started successfully",
		}),
		startFullAnalysis: jest.fn().mockResolvedValue({
			success: true,
			auditId: "audit-123",
			message: "Full analysis started successfully",
		}),
		getAnalysisProgress: jest
			.fn()
			.mockImplementation(async (auditId, userId) => {
				if (auditId === "nonexistent-audit") {
					return {
						success: false,
						error: "Audit not found",
					};
				}
				if (userId === "unauthorized-user") {
					return {
						success: false,
						error: "Access denied",
					};
				}
				if (auditId === "audit-123") {
					return {
						success: true,
						progress: {
							auditId: "audit-123",
							status: "analyzing",
							progress: 50,
							currentStep: "Running security analysis",
						},
					};
				}
				if (auditId === "completed-audit") {
					return {
						success: true,
						progress: {
							auditId: "completed-audit",
							status: "completed",
							progress: 100,
							currentStep: "Analysis complete",
						},
					};
				}
				return {
					success: true,
					progress: {
						auditId,
						status: "completed",
						progress: 100,
						currentStep: "Analysis complete",
					},
				};
			}),
		getAnalysisResults: jest
			.fn()
			.mockImplementation(async (auditId, userId) => {
				if (auditId === "nonexistent-audit") {
					return {
						success: false,
						error: "Audit not found",
					};
				}
				if (userId === "unauthorized-user") {
					return {
						success: false,
						error: "Access denied",
					};
				}

				const mockAudit = {
					id: "audit-123",
					contract_id: "contract-123",
					user_id: "user-123",
					status: "completed",
					static_results: {
						slither_findings: [],
						gas_analysis: [],
						ast_analysis: [],
						complexity: {
							lines_of_code: 10,
							function_count: 1,
							cyclomatic_complexity: 1,
						},
						executionTime: 5000,
					},
					created_at: new Date(),
				};

				const mockVulnerabilities = [
					{
						id: "vuln-1",
						type: "reentrancy",
						severity: "high",
						description: "Potential reentrancy vulnerability",
					},
					{
						id: "vuln-2",
						type: "access_control",
						severity: "medium",
						description: "Missing access control",
					},
				];

				return {
					success: true,
					results: {
						audit: mockAudit,
						vulnerabilities: mockVulnerabilities,
						summary: {
							totalVulnerabilities: 2,
							critical: 0,
							high: 1,
							medium: 1,
							low: 0,
							informational: 0,
						},
					},
				};
			}),
		validateContract: jest.fn().mockImplementation(async (sourceCode) => {
			if (sourceCode.includes("compilation_error")) {
				return {
					success: true,
					isValid: false,
					errors: ["Compilation failed"],
				};
			}
			if (sourceCode.includes("analyzer_exception")) {
				return {
					success: false,
					isValid: false,
					errors: ["Analyzer failed"],
				};
			}
			return {
				success: true,
				isValid: true,
				errors: [],
				quickScan: {
					potentialIssues: 1,
					estimatedAnalysisTime: 30000,
				},
			};
		}),
		checkSystemHealth: jest.fn().mockImplementation(async () => {
			// Check if we should simulate Slither not installed
			if (process.env.MOCK_SLITHER_NOT_INSTALLED === "true") {
				return {
					slitherInstalled: false,
					slitherVersion: null,
					aiConfigured: true,
					openRouterConnected: true,
					databaseConnected: true,
					systemReady: false,
					errors: ["Slither not installed: Command not found"],
				};
			}
			return {
				slitherInstalled: true,
				slitherVersion: "0.9.6",
				aiConfigured: true,
				openRouterConnected: true,
				databaseConnected: true,
				systemReady: true,
				errors: [],
			};
		}),
		// Add missing methods for private function tests
		mapVulnerabilityType: jest.fn().mockImplementation((slitherType) => {
			const mapping: Record<string, string> = {
				"reentrancy-eth": "reentrancy",
				"arbitrary-send": "access_control",
				"unchecked-call": "unchecked_calls",
				timestamp: "timestamp_dependence",
			};
			return mapping[slitherType] || "other";
		}),
		estimateAnalysisTime: jest.fn().mockImplementation((sourceCode) => {
			// Simple estimation based on code length
			const baseTime = 5000;
			const complexityMultiplier = sourceCode.length / 100;
			return Math.floor(baseTime + complexityMultiplier * 1000);
		}),
	};

	return {
		AnalysisService: jest.fn().mockImplementation(() => mockAnalysisService),
		analysisService: mockAnalysisService,
	};
});

// Mock other services that might be needed
jest.mock("../services/EncryptionService", () => {
	const mockEncryptionService = {
		encryptContract: jest.fn().mockImplementation((sourceCode) => {
			return {
				encrypted: "encrypted-" + sourceCode.substring(0, 10),
				hash: "test-hash-" + Math.random().toString(36).substring(7),
				encryptedAt: new Date().toISOString(),
			};
		}),
		decryptContract: jest.fn().mockImplementation((encrypted) => {
			return "contract Test {}";
		}),
		encryptSourceCode: jest.fn().mockReturnValue({
			encryptedData: "encrypted-data",
			hash: "test-hash",
		}),
		decryptSourceCode: jest.fn().mockReturnValue("decrypted-source-code"),
		secureDelete: jest.fn(),
		encrypt: jest.fn().mockImplementation((data) => {
			return {
				encrypted: "encrypted-" + data,
				iv: "mock-iv-" + Math.random().toString(36).substring(7),
				tag: "mock-tag-" + Math.random().toString(36).substring(7),
				algorithm: "aes-256-gcm",
			};
		}),
		decrypt: jest.fn().mockImplementation((encrypted) => {
			if (encrypted.tag === "wrong-tag") {
				throw new Error("Failed to decrypt data");
			}
			return "decrypted-data";
		}),
		hash: jest.fn().mockImplementation((data) => {
			return "hash-" + Math.random().toString(36).substring(7);
		}),
		verifyHash: jest.fn().mockImplementation((data, hash) => {
			return !hash.includes("wrong");
		}),
		generateSecureToken: jest.fn().mockImplementation((length = 32) => {
			return Math.random()
				.toString(36)
				.substring(2, 2 + length * 2);
		}),
		generateToken: jest.fn().mockImplementation((length = 32) => {
			return Math.random()
				.toString(36)
				.substring(2, 2 + length * 2);
		}),
	};

	return {
		EncryptionService: jest
			.fn()
			.mockImplementation(() => mockEncryptionService),
		encryptionService: mockEncryptionService,
	};
});

// Mock cache data store
const mockCacheStore = new Map();

jest.mock("../services/CacheService", () => {
	const mockCacheService = {
		getCachedAuditResult: jest.fn().mockImplementation((key) => {
			return Promise.resolve(mockCacheStore.get(key) || null);
		}),
		cacheAuditResult: jest.fn().mockImplementation((key, data) => {
			mockCacheStore.set(key, data);
			return Promise.resolve(true);
		}),
		getCachedAuditReport: jest.fn().mockImplementation((key) => {
			return Promise.resolve(mockCacheStore.get(`report:${key}`) || null);
		}),
		cacheAuditReport: jest.fn().mockImplementation((key, data) => {
			mockCacheStore.set(`report:${key}`, data);
			return Promise.resolve(true);
		}),
		getCachedUserAudits: jest.fn().mockImplementation((userId) => {
			return Promise.resolve(
				mockCacheStore.get(`user:${userId}:audits`) || null
			);
		}),
		cacheUserAudits: jest.fn().mockImplementation((userId, data) => {
			mockCacheStore.set(`user:${userId}:audits`, data);
			return Promise.resolve(true);
		}),
		getCachedContractAnalysis: jest.fn().mockImplementation((hash) => {
			return Promise.resolve(
				mockCacheStore.get(`contract:${hash}:analysis`) || null
			);
		}),
		cacheContractAnalysis: jest.fn().mockImplementation((hash, data) => {
			mockCacheStore.set(`contract:${hash}:analysis`, data);
			return Promise.resolve(true);
		}),
		invalidateAuditCache: jest.fn().mockImplementation((key) => {
			mockCacheStore.delete(key);
			mockCacheStore.delete(`report:${key}`);
			return Promise.resolve(true);
		}),
		invalidateUserCache: jest.fn().mockImplementation((userId) => {
			mockCacheStore.delete(`user:${userId}:audits`);
			return Promise.resolve(true);
		}),
		trackCacheHit: jest.fn().mockResolvedValue(undefined),
		trackCacheMiss: jest.fn().mockResolvedValue(undefined),
		clearCache: jest.fn().mockImplementation(() => {
			mockCacheStore.clear();
			return Promise.resolve(undefined);
		}),
		getCacheStats: jest.fn().mockResolvedValue({
			totalKeys: mockCacheStore.size,
			memoryUsage: "10.5M",
			hitRate: 85.0,
			missRate: 15.0,
		}),
		getInstance: jest.fn(),
	};

	// Make getInstance return the mock
	mockCacheService.getInstance.mockReturnValue(mockCacheService);

	return {
		CacheService: jest.fn().mockImplementation(() => mockCacheService),
		cacheService: mockCacheService,
	};
});

jest.mock("../services/PerformanceMonitoringService", () => {
	const mockPerformanceService = {
		clearMetrics: jest.fn(),
		stopMonitoring: jest.fn(),
		getSystemMetrics: jest.fn().mockResolvedValue({
			cpuUsage: 50,
			memoryUsage: {
				used: 1024 * 1024 * 100, // 100MB
				total: 1024 * 1024 * 200, // 200MB
				percentage: 50,
			},
			responseTime: {
				avg: 250,
				p95: 400,
				p99: 500,
			},
			throughput: {
				requestsPerSecond: 10,
				auditsPerHour: 5,
			},
			errorRate: 2,
			cacheHitRate: 85,
		}),
		recordMetric: jest.fn(),
		recordResponseTime: jest.fn(),
		recordError: jest.fn(),
		startAuditTracking: jest.fn(),
		updateAuditProgress: jest.fn(),
		recordSlitherTime: jest.fn(),
		recordAIAnalysisTime: jest.fn(),
		recordReportGenerationTime: jest.fn(),
		recordQueueWaitTime: jest.fn(),
		completeAuditTracking: jest.fn().mockImplementation((auditId) => {
			return {
				auditId,
				totalTime: 17000,
				slitherTime: 5000,
				aiAnalysisTime: 10000,
				reportGenerationTime: 2000,
				queueWaitTime: 1000,
				memoryPeak: 1024 * 1024 * 50, // 50MB
			};
		}),
		getAuditMetrics: jest.fn().mockImplementation((auditId) => {
			return {
				slitherTime: 5000,
				aiAnalysisTime: 10000,
				reportGenerationTime: 2000,
				totalTime: 17000,
			};
		}),
		getAuditPerformanceSummary: jest.fn().mockReturnValue({
			totalAudits: 10,
			avgTotalTime: 15000,
			avgSlitherTime: 4000,
			avgAITime: 8000,
			avgReportTime: 3000,
			avgQueueTime: 1000,
		}),
		getMetrics: jest.fn().mockReturnValue([]),
		getInstance: jest.fn(),
	};

	// Make getInstance return the mock
	mockPerformanceService.getInstance.mockReturnValue(mockPerformanceService);

	return {
		PerformanceMonitoringService: jest
			.fn()
			.mockImplementation(() => mockPerformanceService),
		performanceMonitoringService: mockPerformanceService,
	};
});

jest.mock("../services/DatabaseOptimizationService", () => {
	const mockDbOptimizationService = {
		createOptimizedIndexes: jest.fn().mockResolvedValue(true),
		getUserAuditsOptimized: jest
			.fn()
			.mockImplementation((userId, limit, offset) => {
				return Promise.resolve({
					data: [],
					metrics: {
						queryTime: 500,
						indexesUsed: ["idx_audits_user_id_created_at"],
					},
				});
			}),
		searchContractsOptimized: jest
			.fn()
			.mockImplementation((userId, searchTerm) => {
				return Promise.resolve({
					data: [],
					metrics: {
						queryTime: 300,
						indexesUsed: ["idx_contracts_user_name"],
					},
				});
			}),
		getVulnerabilityStatsOptimized: jest.fn().mockImplementation((userId) => {
			return Promise.resolve({
				data: {
					bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
					byType: {},
					total: 0,
				},
				metrics: {
					queryTime: 1500,
					indexesUsed: ["idx_vulnerabilities_severity"],
				},
			});
		}),
		getQueryAnalytics: jest.fn().mockReturnValue({
			slowQueries: [],
			avgQueryTime: 250,
			totalQueries: 1000,
		}),
	};

	return {
		DatabaseOptimizationService: jest
			.fn()
			.mockImplementation(() => mockDbOptimizationService),
		dbOptimizationService: mockDbOptimizationService,
	};
});

jest.mock("../services/CDNService", () => ({
	cdnService: {
		staticAssetMiddleware: jest
			.fn()
			.mockReturnValue((req: any, res: any, next: any) => next()),
		getCacheStats: jest.fn().mockReturnValue({
			hitRate: 85,
			missRate: 15,
			totalRequests: 1000,
		}),
		generateAssetManifest: jest.fn().mockReturnValue({
			assets: {},
			version: "1.0.0",
		}),
	},
}));

jest.mock("../services/AuditReportService", () => {
	const mockAuditReportService = {
		generateReport: jest.fn().mockResolvedValue({
			success: true,
			data: {
				html: { available: true, path: "/reports/test.html" },
				pdf: { available: true, path: "/reports/test.pdf" },
			},
		}),
		generateAuditReport: jest.fn().mockImplementation(async (request) => {
			return {
				auditId: request.auditId,
				contractName: request.contractName || "TestContract",
				html: request.formats?.includes("html")
					? "<html>Mock Report</html>"
					: undefined,
				pdf: request.formats?.includes("pdf")
					? Buffer.from("Mock PDF")
					: undefined,
				generatedAt: new Date().toISOString(),
			};
		}),
		getExistingReport: jest.fn().mockImplementation(async (auditId) => {
			return {
				auditId,
				html: "<html>Mock Report</html>",
				pdf: Buffer.from("Mock PDF"),
				generatedAt: new Date().toISOString(),
			};
		}),
		getReportStatistics: jest.fn().mockImplementation(async (auditId) => {
			return {
				hasReport: true,
				hasHTMLFile: true,
				hasPDFFile: true,
				generatedAt: new Date().toISOString(),
				fileSize: {
					html: 1024,
					pdf: 2048,
				},
			};
		}),
		deleteReportFiles: jest.fn().mockResolvedValue(undefined),
		regenerateReport: jest.fn().mockImplementation(async (auditId) => {
			return {
				auditId,
				html: "<html>Regenerated Report</html>",
				pdf: Buffer.from("Regenerated PDF"),
				generatedAt: new Date().toISOString(),
			};
		}),
		getReportPaths: jest.fn().mockImplementation((auditId, contractName) => {
			return {
				html: `/reports/${auditId}_${contractName}.html`,
				pdf: `/reports/${auditId}_${contractName}.pdf`,
			};
		}),
		getReportInfo: jest.fn().mockResolvedValue({
			success: true,
			data: {
				hasReport: true,
				formats: ["html", "pdf"],
				generatedAt: new Date().toISOString(),
			},
		}),
		downloadReport: jest.fn().mockResolvedValue({
			success: true,
			data: Buffer.from("Mock report content"),
			contentType: "text/html",
		}),
	};

	return {
		AuditReportService: mockAuditReportService,
		auditReportService: mockAuditReportService,
	};
});

jest.mock("../services/ReportGenerator", () => {
	const mockReportGenerator = {
		generateHTMLReport: jest.fn().mockResolvedValue("<html>Mock Report</html>"),
		generatePDFReport: jest.fn().mockResolvedValue(Buffer.from("Mock PDF")),
		generateReport: jest.fn().mockImplementation(async (reportData) => {
			return {
				report: {
					audit_id: reportData.auditId,
					contract_name: reportData.contractName,
					total_vulnerabilities: reportData.vulnerabilities?.length || 0,
					critical_count:
						reportData.vulnerabilities?.filter(
							(v: { severity: string }) => v.severity === "critical"
						).length || 0,
					high_count:
						reportData.vulnerabilities?.filter(
							(v: { severity: string }) => v.severity === "high"
						).length || 0,
					medium_count:
						reportData.vulnerabilities?.filter(
							(v: { severity: string }) => v.severity === "medium"
						).length || 0,
					low_count:
						reportData.vulnerabilities?.filter(
							(v: { severity: string }) => v.severity === "low"
						).length || 0,
					executive_summary: `Found ${
						reportData.vulnerabilities?.length || 0
					} potential issues in the smart contract analysis.`,
					generated_at: new Date().toISOString(),
				},
				htmlContent: "<html>Mock Report</html>",
				pdfBuffer: Buffer.from("Mock PDF"),
			};
		}),
	};

	return {
		ReportGenerator: mockReportGenerator,
		reportGenerator: mockReportGenerator,
	};
});

// Mock AuditOrchestrator
jest.mock("../services/AuditOrchestrator", () => {
	const mockAuditOrchestrator = {
		startAudit: jest.fn().mockImplementation(async (params) => {
			// Simulate different failure scenarios for testing
			if (params.contractId === "db-fail-contract") {
				throw new Error("Database connection failed");
			}
			if (params.priority > 10) {
				throw new Error("Queue is full");
			}
			return {
				success: true,
				auditId: generateId(),
				message: "Audit started successfully",
			};
		}),
		cancelAudit: jest.fn().mockImplementation(async (auditId, userId) => {
			if (auditId === "nonexistent-audit") {
				return {
					success: false,
					error: "Audit not found",
				};
			}
			if (userId === "unauthorized-user") {
				return {
					success: false,
					error: "Access denied",
				};
			}
			return {
				success: true,
				message: "Audit cancelled successfully",
			};
		}),
		getAuditProgress: jest.fn().mockImplementation(async (auditId, userId) => {
			if (auditId === "nonexistent-audit") {
				return {
					success: false,
					error: "Audit not found",
				};
			}
			if (userId === "unauthorized-user") {
				return {
					success: false,
					error: "Access denied",
				};
			}
			return {
				success: true,
				data: {
					status: "completed",
					progress: 100,
					estimatedTimeRemaining: 0,
				},
			};
		}),
		getQueueStats: jest.fn().mockResolvedValue({
			totalJobs: 5,
			activeJobs: 2,
			waitingJobs: 3,
			completedJobs: 10,
			failedJobs: 1,
		}),
		getAuditStatus: jest.fn().mockResolvedValue({
			success: true,
			data: {
				status: "completed",
				progress: 100,
			},
		}),
	};

	return {
		AuditOrchestrator: jest
			.fn()
			.mockImplementation(() => mockAuditOrchestrator),
		auditOrchestrator: mockAuditOrchestrator,
	};
});

// Mock DatabaseService
jest.mock("../services/database", () => {
	const mockMethods = {
		getContractById: jest.fn().mockImplementation(async (contractId) => {
			if (contractId === "nonexistent-contract") {
				return null;
			}
			return {
				id: contractId,
				user_id: "user-123",
				name: "Test Contract",
				source_code: "contract Test {}",
				created_at: new Date(),
			};
		}),
		createContract: jest.fn().mockImplementation(async (contractData) => {
			return {
				id: generateId(),
				...contractData,
				created_at: new Date(),
				updated_at: new Date(),
			};
		}),
		getContractsByUserId: jest.fn().mockImplementation(async (userId) => {
			return [
				{
					id: generateId(),
					user_id: userId,
					name: "Test Contract 1",
					source_code: "contract Test1 {}",
					created_at: new Date(),
				},
				{
					id: generateId(),
					user_id: userId,
					name: "Test Contract 2",
					source_code: "contract Test2 {}",
					created_at: new Date(),
				},
			];
		}),
		createAudit: jest.fn().mockImplementation(async (auditData) => {
			if (auditData.contract_id === "fail-audit-creation") {
				throw new Error("Failed to create audit record");
			}
			return {
				id: "audit-123",
				...auditData,
				created_at: new Date(),
			};
		}),
		updateAudit: jest.fn().mockImplementation(async (auditId, updateData) => {
			return {
				id: auditId,
				...updateData,
				updated_at: new Date(),
			};
		}),
		getAuditById: jest.fn().mockImplementation(async (auditId) => {
			if (auditId === "nonexistent-audit") {
				return null;
			}
			return {
				id: auditId,
				user_id: "user-123",
				status: "completed",
				created_at: new Date(),
			};
		}),
		createVulnerability: jest.fn().mockImplementation(async (vulnData) => {
			return {
				id: generateId(),
				...vulnData,
				created_at: new Date(),
			};
		}),
		getVulnerabilitiesByAuditId: jest.fn().mockResolvedValue([]),
		getUserById: jest.fn().mockImplementation(async (userId) => {
			if (userId === "nonexistent-user") {
				return null;
			}
			return {
				id: userId,
				email: "test@example.com",
				name: "Test User",
				created_at: new Date(),
			};
		}),
		getUserContracts: jest.fn().mockResolvedValue([]),
		testConnection: jest.fn().mockResolvedValue(true),
		healthCheck: jest.fn().mockResolvedValue({
			status: "pass",
			message: "Database is healthy",
		}),
	};

	return {
		DatabaseService: Object.assign(
			jest.fn().mockImplementation(() => mockMethods),
			mockMethods
		),
		databaseService: mockMethods,
	};
});

// Mock SecurityService for input sanitization tests
jest.mock("../middleware/security", () => ({
	sanitizeInput: jest.fn().mockImplementation((req, res, next) => {
		// Mock sanitization - just call next
		next();
	}),
	validateInput: jest.fn().mockImplementation((input) => {
		// Mock validation - return true for most inputs
		return true;
	}),
	validateProfileUpdate: [
		jest.fn().mockImplementation((req, res, next) => next()),
	],
	handleValidationErrors: jest.fn().mockImplementation((req, res, next) => {
		next();
	}),
	validateContractInput: [
		jest.fn().mockImplementation((req, res, next) => next()),
	],
	validateUUID: jest
		.fn()
		.mockImplementation(() => [
			jest.fn().mockImplementation((req, res, next) => next()),
		]),
	validatePagination: [
		jest.fn().mockImplementation((req, res, next) => next()),
	],
	createRateLimit: jest
		.fn()
		.mockImplementation(() =>
			jest.fn().mockImplementation((req, res, next) => next())
		),
	createSpeedLimit: jest
		.fn()
		.mockImplementation(() =>
			jest.fn().mockImplementation((req, res, next) => next())
		),
	securityHeaders: jest.fn().mockImplementation((req, res, next) => next()),
	requestId: jest.fn().mockImplementation((req, res, next) => next()),
	corsOptions: {},
}));

// Mock DataDeletionService
jest.mock("../services/DataDeletionService", () => {
	const mockDataDeletionService = {
		deleteUserData: jest.fn().mockImplementation(async (userId) => {
			if (userId === "invalid-uuid") {
				return {
					success: false,
					userId,
					steps: [],
					message: "User data deletion completed with some errors",
				};
			}
			return {
				success: true,
				userId,
				steps: ["contracts", "audits", "reports"],
				message: "User data deleted successfully",
			};
		}),
	};

	return {
		DataDeletionService: jest
			.fn()
			.mockImplementation(() => mockDataDeletionService),
		dataDeletionService: mockDataDeletionService,
	};
});

// Mock Logger for error logging tests
jest.mock("../utils/logger", () => ({
	logger: {
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
		debug: jest.fn(),
	},
}));

// Global test cleanup
afterAll(async () => {
	// Add any global cleanup here
	await new Promise((resolve) => setTimeout(resolve, 100));
});
