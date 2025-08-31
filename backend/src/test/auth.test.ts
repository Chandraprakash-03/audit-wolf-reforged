// Mock Supabase before importing any modules that use it
jest.mock("../config/supabase", () => ({
	supabase: {
		auth: {
			getUser: jest.fn(),
			admin: {
				signOut: jest.fn(),
			},
			refreshSession: jest.fn(),
		},
		from: jest.fn(() => ({
			select: jest.fn(() => ({
				eq: jest.fn(() => ({
					single: jest.fn(),
				})),
			})),
			update: jest.fn(() => ({
				eq: jest.fn(() => ({
					select: jest.fn(() => ({
						single: jest.fn(),
					})),
				})),
			})),
		})),
	},
}));

import request from "supertest";
import express from "express";
import authRoutes from "../routes/auth";
import { supabase } from "../config/supabase";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api/auth", authRoutes);

describe("Auth Routes", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("POST /api/auth/verify", () => {
		it("should verify valid token and return user info", async () => {
			const mockUser = {
				id: "123",
				email: "test@example.com",
				user_metadata: { role: "user" },
			};

			const mockUserData = {
				id: "123",
				email: "test@example.com",
				name: "Test User",
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			};

			(supabase.auth.getUser as jest.Mock).mockResolvedValue({
				data: { user: mockUser },
				error: null,
			});

			const mockFrom = {
				select: jest.fn(() => ({
					eq: jest.fn(() => ({
						single: jest.fn().mockResolvedValue({
							data: mockUserData,
							error: null,
						}),
					})),
				})),
			};

			(supabase.from as jest.Mock).mockReturnValue(mockFrom);

			const response = await request(app)
				.post("/api/auth/verify")
				.set("Authorization", "Bearer valid-token")
				.expect(200);

			expect(response.body).toEqual({
				user: mockUserData,
			});
		});

		it("should return 401 for invalid token", async () => {
			(supabase.auth.getUser as jest.Mock).mockResolvedValue({
				data: { user: null },
				error: { message: "Invalid token" },
			});

			const response = await request(app)
				.post("/api/auth/verify")
				.set("Authorization", "Bearer invalid-token")
				.expect(401);

			expect(response.body).toEqual({
				success: false,
				error: {
					code: "INVALID_TOKEN",
					message: "Invalid or expired token",
					recovery: [
						"Please log in again",
						"Check if your session has expired",
						"Verify your authentication credentials",
					],
				},
			});
		});

		it("should return 401 when no token provided", async () => {
			const response = await request(app).post("/api/auth/verify").expect(401);

			expect(response.body).toEqual({
				success: false,
				error: {
					code: "MISSING_TOKEN",
					message: "Access token required",
					recovery: [
						"Please log in to access this resource",
						"Check if your session has expired",
						"Verify your authentication credentials",
					],
				},
			});
		});
	});

	describe("POST /api/auth/refresh", () => {
		it("should refresh token successfully", async () => {
			const mockSession = {
				access_token: "new-access-token",
				refresh_token: "new-refresh-token",
				expires_at: 1234567890,
			};

			const mockUser = { id: "123", email: "test@example.com" };

			(supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
				data: { session: mockSession, user: mockUser },
				error: null,
			});

			const response = await request(app)
				.post("/api/auth/refresh")
				.set("Content-Type", "application/json")
				.send({ refresh_token: "valid-refresh-token" })
				.expect(200);

			expect(response.body).toEqual({
				access_token: "new-access-token",
				refresh_token: "new-refresh-token",
				expires_at: 1234567890,
				user: mockUser,
			});
		});

		it("should return 400 when refresh token is missing", async () => {
			const response = await request(app)
				.post("/api/auth/refresh")
				.set("Content-Type", "application/json")
				.send({})
				.expect(400);

			expect(response.body).toEqual({
				error: "Refresh token required",
				code: "MISSING_REFRESH_TOKEN",
			});
		});

		it("should return 401 for invalid refresh token", async () => {
			(supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
				data: { session: null, user: null },
				error: { message: "Invalid refresh token" },
			});

			const response = await request(app)
				.post("/api/auth/refresh")
				.set("Content-Type", "application/json")
				.send({ refresh_token: "invalid-refresh-token" })
				.expect(401);

			expect(response.body).toEqual({
				error: "Invalid refresh token",
				code: "REFRESH_FAILED",
			});
		});
	});

	describe("GET /api/auth/me", () => {
		it("should return user profile for authenticated user", async () => {
			const mockUser = {
				id: "123",
				email: "test@example.com",
				user_metadata: { role: "user" },
			};

			const mockUserData = {
				id: "123",
				email: "test@example.com",
				name: "Test User",
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			};

			(supabase.auth.getUser as jest.Mock).mockResolvedValue({
				data: { user: mockUser },
				error: null,
			});

			const mockFrom = {
				select: jest.fn(() => ({
					eq: jest.fn(() => ({
						single: jest.fn().mockResolvedValue({
							data: mockUserData,
							error: null,
						}),
					})),
				})),
			};

			(supabase.from as jest.Mock).mockReturnValue(mockFrom);

			const response = await request(app)
				.get("/api/auth/me")
				.set("Authorization", "Bearer valid-token")
				.expect(200);

			expect(response.body).toEqual({
				user: mockUserData,
			});
		});

		it("should return 401 when no token provided", async () => {
			const response = await request(app).get("/api/auth/me").expect(401);

			expect(response.body).toEqual({
				success: false,
				error: {
					code: "MISSING_TOKEN",
					message: "Access token required",
					recovery: [
						"Please log in to access this resource",
						"Check if your session has expired",
						"Verify your authentication credentials",
					],
				},
			});
		});

		it("should return 404 when user not found in database", async () => {
			const mockUser = {
				id: "123",
				email: "test@example.com",
				user_metadata: { role: "user" },
			};

			(supabase.auth.getUser as jest.Mock).mockResolvedValue({
				data: { user: mockUser },
				error: null,
			});

			const mockFrom = {
				select: jest.fn(() => ({
					eq: jest.fn(() => ({
						single: jest.fn().mockResolvedValue({
							data: null,
							error: { message: "User not found" },
						}),
					})),
				})),
			};

			(supabase.from as jest.Mock).mockReturnValue(mockFrom);

			const response = await request(app)
				.get("/api/auth/me")
				.set("Authorization", "Bearer valid-token")
				.expect(404);

			expect(response.body).toEqual({
				error: "User profile not found",
				code: "USER_NOT_FOUND",
			});
		});
	});

	describe("POST /api/auth/signout", () => {
		it("should sign out user successfully", async () => {
			const mockUser = {
				id: "123",
				email: "test@example.com",
				user_metadata: { role: "user" },
			};

			(supabase.auth.getUser as jest.Mock).mockResolvedValue({
				data: { user: mockUser },
				error: null,
			});

			(supabase.auth.admin.signOut as jest.Mock).mockResolvedValue({
				error: null,
			});

			const response = await request(app)
				.post("/api/auth/signout")
				.set("Authorization", "Bearer valid-token")
				.expect(200);

			expect(response.body).toEqual({
				message: "Successfully signed out",
			});

			expect(supabase.auth.admin.signOut).toHaveBeenCalledWith("valid-token");
		});

		it("should return 401 when no token provided", async () => {
			const response = await request(app).post("/api/auth/signout").expect(401);

			expect(response.body).toEqual({
				success: false,
				error: {
					code: "MISSING_TOKEN",
					message: "Access token required",
					recovery: [
						"Please log in to access this resource",
						"Check if your session has expired",
						"Verify your authentication credentials",
					],
				},
			});
		});
	});

	describe("PUT /api/auth/profile", () => {
		it("should update user profile successfully", async () => {
			const mockUser = {
				id: "123",
				email: "test@example.com",
				user_metadata: { role: "user" },
			};

			const mockUpdatedUser = {
				id: "123",
				email: "test@example.com",
				name: "Updated Name",
				updated_at: expect.any(String),
			};

			(supabase.auth.getUser as jest.Mock).mockResolvedValue({
				data: { user: mockUser },
				error: null,
			});

			const mockFrom = {
				update: jest.fn(() => ({
					eq: jest.fn(() => ({
						select: jest.fn(() => ({
							single: jest.fn().mockResolvedValue({
								data: mockUpdatedUser,
								error: null,
							}),
						})),
					})),
				})),
			};

			(supabase.from as jest.Mock).mockReturnValue(mockFrom);

			const response = await request(app)
				.put("/api/auth/profile")
				.set("Authorization", "Bearer valid-token")
				.set("Content-Type", "application/json")
				.send({ name: "Updated Name" })
				.expect(200);

			expect(response.body).toEqual({
				user: mockUpdatedUser,
				message: "Profile updated successfully",
			});
		});

		it("should return 400 for invalid name", async () => {
			const mockUser = {
				id: "123",
				email: "test@example.com",
				user_metadata: { role: "user" },
			};

			(supabase.auth.getUser as jest.Mock).mockResolvedValue({
				data: { user: mockUser },
				error: null,
			});

			const response = await request(app)
				.put("/api/auth/profile")
				.set("Authorization", "Bearer valid-token")
				.set("Content-Type", "application/json")
				.send({ name: "A" }) // Too short
				.expect(400);

			expect(response.body.error).toBe("Validation failed");
			expect(response.body.code).toBe("VALIDATION_ERROR");
			expect(response.body.details).toBeDefined();
		});

		it("should return 401 when no token provided", async () => {
			const response = await request(app)
				.put("/api/auth/profile")
				.set("Content-Type", "application/json")
				.send({ name: "Valid Name" })
				.expect(401);

			expect(response.body).toEqual({
				success: false,
				error: {
					code: "MISSING_TOKEN",
					message: "Access token required",
					recovery: [
						"Please log in to access this resource",
						"Check if your session has expired",
						"Verify your authentication credentials",
					],
				},
			});
		});

		it("should return 500 when database update fails", async () => {
			const mockUser = {
				id: "123",
				email: "test@example.com",
				user_metadata: { role: "user" },
			};

			(supabase.auth.getUser as jest.Mock).mockResolvedValue({
				data: { user: mockUser },
				error: null,
			});

			const mockFrom = {
				update: jest.fn(() => ({
					eq: jest.fn(() => ({
						select: jest.fn(() => ({
							single: jest.fn().mockResolvedValue({
								data: null,
								error: { message: "Database error" },
							}),
						})),
					})),
				})),
			};

			(supabase.from as jest.Mock).mockReturnValue(mockFrom);

			const response = await request(app)
				.put("/api/auth/profile")
				.set("Authorization", "Bearer valid-token")
				.set("Content-Type", "application/json")
				.send({ name: "Valid Name" })
				.expect(500);

			expect(response.body).toEqual({
				error: "Failed to update profile",
				code: "UPDATE_ERROR",
			});
		});
	});
});
