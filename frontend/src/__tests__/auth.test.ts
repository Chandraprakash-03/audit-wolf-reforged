/**
 * @jest-environment jsdom
 */

// Mock Supabase before importing any modules that use it
jest.mock("@/lib/supabase", () => ({
	supabase: {
		auth: {
			signUp: jest.fn(),
			signInWithPassword: jest.fn(),
			signOut: jest.fn(),
			getSession: jest.fn(),
			getUser: jest.fn(),
			resetPasswordForEmail: jest.fn(),
			updateUser: jest.fn(),
			onAuthStateChange: jest.fn(() => ({
				data: { subscription: { unsubscribe: jest.fn() } },
			})),
		},
	},
}));

import { AuthService } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { describe } from "node:test";

describe("AuthService", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("signUp", () => {
		it("should successfully sign up a user", async () => {
			const mockUser = { id: "123", email: "test@example.com" };
			const mockSession = { access_token: "token123" };

			(supabase.auth.signUp as jest.Mock).mockResolvedValue({
				data: { user: mockUser, session: mockSession },
				error: null,
			});

			const result = await AuthService.signUp(
				"test@example.com",
				"password123",
				"Test User"
			);

			expect(supabase.auth.signUp).toHaveBeenCalledWith({
				email: "test@example.com",
				password: "password123",
				options: {
					data: {
						name: "Test User",
					},
				},
			});

			expect(result).toEqual({
				user: mockUser,
				session: mockSession,
			});
		});

		it("should throw error when sign up fails", async () => {
			(supabase.auth.signUp as jest.Mock).mockResolvedValue({
				data: { user: null, session: null },
				error: { message: "Email already registered" },
			});

			await expect(
				AuthService.signUp("test@example.com", "password123")
			).rejects.toThrow("Email already registered");
		});
	});

	describe("signIn", () => {
		it("should successfully sign in a user", async () => {
			const mockUser = { id: "123", email: "test@example.com" };
			const mockSession = { access_token: "token123" };

			(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
				data: { user: mockUser, session: mockSession },
				error: null,
			});

			const result = await AuthService.signIn(
				"test@example.com",
				"password123"
			);

			expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
				email: "test@example.com",
				password: "password123",
			});

			expect(result).toEqual({
				user: mockUser,
				session: mockSession,
			});
		});

		it("should throw error when credentials are invalid", async () => {
			(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
				data: { user: null, session: null },
				error: { message: "Invalid login credentials" },
			});

			await expect(
				AuthService.signIn("test@example.com", "wrongpassword")
			).rejects.toThrow("Invalid login credentials");
		});
	});

	describe("signOut", () => {
		it("should successfully sign out", async () => {
			(supabase.auth.signOut as jest.Mock).mockResolvedValue({
				error: null,
			});

			await expect(AuthService.signOut()).resolves.not.toThrow();
			expect(supabase.auth.signOut).toHaveBeenCalled();
		});

		it("should throw error when sign out fails", async () => {
			(supabase.auth.signOut as jest.Mock).mockResolvedValue({
				error: { message: "Sign out failed" },
			});

			await expect(AuthService.signOut()).rejects.toThrow("Sign out failed");
		});
	});

	describe("getSession", () => {
		it("should return session when available", async () => {
			const mockSession = { access_token: "token123", user: { id: "123" } };

			(supabase.auth.getSession as jest.Mock).mockResolvedValue({
				data: { session: mockSession },
				error: null,
			});

			const result = await AuthService.getSession();
			expect(result).toEqual(mockSession);
		});

		it("should return null when no session", async () => {
			(supabase.auth.getSession as jest.Mock).mockResolvedValue({
				data: { session: null },
				error: null,
			});

			const result = await AuthService.getSession();
			expect(result).toBeNull();
		});

		it("should return null when error occurs", async () => {
			(supabase.auth.getSession as jest.Mock).mockResolvedValue({
				data: { session: null },
				error: { message: "Session error" },
			});

			const result = await AuthService.getSession();
			expect(result).toBeNull();
		});
	});

	describe("resetPassword", () => {
		it("should successfully send reset password email", async () => {
			(supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
				error: null,
			});

			// Mock window.location.origin
			Object.defineProperty(window, "location", {
				value: { origin: "http://localhost:3000" },
				writable: true,
			});

			await expect(
				AuthService.resetPassword("test@example.com")
			).resolves.not.toThrow();

			expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
				"test@example.com",
				{
					redirectTo: "http://localhost:3000/auth/reset-password",
				}
			);
		});
	});
});
