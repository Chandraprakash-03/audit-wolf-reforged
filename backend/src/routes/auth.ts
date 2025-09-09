import { Router, Request, Response } from "express";
import { supabase } from "../config/supabase";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import {
	validateProfileUpdate,
	handleValidationErrors,
} from "../middleware/security";
import { dataDeletionService } from "../services/DataDeletionService";

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post("/register", async (req: Request, res: Response) => {
	try {
		const { email, password, name } = req.body;

		if (!email || !password) {
			return res.status(400).json({
				success: false,
				error: "Email and password are required",
				code: "MISSING_CREDENTIALS",
			});
		}

		// Register user with Supabase Auth
		const { data: authData, error: authError } = await supabase.auth.signUp({
			email: email.toLowerCase(),
			password,
			options: {
				data: {
					name: name || null,
				},
			},
		});

		if (authError) {
			return res.status(400).json({
				success: false,
				error: authError.message,
				code: "REGISTRATION_FAILED",
			});
		}

		if (!authData.user) {
			return res.status(400).json({
				success: false,
				error: "User registration failed",
				code: "USER_CREATION_FAILED",
			});
		}

		// Create user record in our database
		const { data: userData, error: dbError } = await supabase
			.from("users")
			.insert({
				id: authData.user.id,
				email: email.toLowerCase(),
				name: name || null,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
			.select()
			.single();

		if (dbError) {
			console.error("Error creating user record:", dbError);
			// Continue anyway, as the auth user was created successfully
		}

		res.status(201).json({
			success: true,
			data: {
				user: {
					id: authData.user.id,
					email: authData.user.email,
					name: name || null,
				},
				token: authData.session?.access_token,
				refresh_token: authData.session?.refresh_token,
			},
		});
	} catch (error) {
		console.error("Registration error:", error);
		res.status(500).json({
			success: false,
			error: "Registration failed",
			code: "REGISTRATION_ERROR",
		});
	}
	return () => {};
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post("/login", async (req: Request, res: Response) => {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			return res.status(400).json({
				success: false,
				error: "Email and password are required",
				code: "MISSING_CREDENTIALS",
			});
		}

		// Sign in with Supabase Auth
		const { data: authData, error: authError } =
			await supabase.auth.signInWithPassword({
				email: email.toLowerCase(),
				password,
			});

		if (authError) {
			return res.status(401).json({
				success: false,
				error: authError.message,
				code: "LOGIN_FAILED",
			});
		}

		if (!authData.user || !authData.session) {
			return res.status(401).json({
				success: false,
				error: "Invalid credentials",
				code: "INVALID_CREDENTIALS",
			});
		}

		// Get user data from our database
		const { data: userData } = await supabase
			.from("users")
			.select("*")
			.eq("id", authData.user.id)
			.single();

		res.status(200).json({
			success: true,
			data: {
				user: {
					id: authData.user.id,
					email: authData.user.email,
					name: userData?.name || null,
				},
				token: authData.session.access_token,
				refresh_token: authData.session.refresh_token,
			},
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({
			success: false,
			error: "Login failed",
			code: "LOGIN_ERROR",
		});
	}
	return () => {};
});

/**
 * POST /api/auth/verify
 * Verify JWT token and return user info
 */
router.post(
	"/verify",
	authenticateToken,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			if (!req.user) {
				return res.status(401).json({
					error: "User not authenticated",
					code: "NOT_AUTHENTICATED",
				});
			}

			// Get additional user data from database
			const { data: userData, error } = await supabase
				.from("users")
				.select("id, email, name, created_at, updated_at")
				.eq("id", req.user.id)
				.single();

			if (error) {
				console.error("Error fetching user data:", error);
				// Return basic user info if database fetch fails
				return res.json({
					user: {
						id: req.user.id,
						email: req.user.email,
						name: null,
						created_at: null,
						updated_at: null,
					},
				});
			}

			res.json({
				user: userData,
			});
		} catch (error) {
			console.error("Token verification error:", error);
			res.status(500).json({
				error: "Token verification failed",
				code: "VERIFICATION_ERROR",
			});
		}
		return () => {};
	}
);

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post("/refresh", async (req: Request, res: Response) => {
	try {
		const { refresh_token } = req.body;

		if (!refresh_token) {
			return res.status(400).json({
				error: "Refresh token required",
				code: "MISSING_REFRESH_TOKEN",
			});
		}

		const { data, error } = await supabase.auth.refreshSession({
			refresh_token,
		});

		if (error) {
			return res.status(401).json({
				error: error.message,
				code: "REFRESH_FAILED",
			});
		}

		res.json({
			access_token: data.session?.access_token,
			refresh_token: data.session?.refresh_token,
			expires_at: data.session?.expires_at,
			user: data.user,
		});
	} catch (error) {
		console.error("Token refresh error:", error);
		res.status(500).json({
			error: "Token refresh failed",
			code: "REFRESH_ERROR",
		});
	}
	return () => {};
});

/**
 * POST /api/auth/signout
 * Sign out user (invalidate token)
 */
router.post(
	"/signout",
	authenticateToken,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const authHeader = req.headers.authorization;
			const token = authHeader && authHeader.split(" ")[1];

			if (token) {
				// Sign out from Supabase (this invalidates the token)
				await supabase.auth.admin.signOut(token);
			}

			res.json({
				message: "Successfully signed out",
			});
		} catch (error) {
			console.error("Sign out error:", error);
			res.status(500).json({
				error: "Sign out failed",
				code: "SIGNOUT_ERROR",
			});
		}
	}
);

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get(
	"/me",
	authenticateToken,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			if (!req.user) {
				return res.status(401).json({
					error: "User not authenticated",
					code: "NOT_AUTHENTICATED",
				});
			}

			// Get user data from database
			const { data: userData, error } = await supabase
				.from("users")
				.select("*")
				.eq("id", req.user.id)
				.single();

			if (error) {
				console.error("Error fetching user profile:", error);
				return res.status(404).json({
					error: "User profile not found",
					code: "USER_NOT_FOUND",
				});
			}

			res.json({
				user: userData,
			});
		} catch (error) {
			console.error("Get profile error:", error);
			res.status(500).json({
				error: "Failed to fetch user profile",
				code: "PROFILE_ERROR",
			});
		}
		return () => {};
	}
);

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put(
	"/profile",
	authenticateToken,
	validateProfileUpdate,
	handleValidationErrors,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			if (!req.user) {
				return res.status(401).json({
					error: "User not authenticated",
					code: "NOT_AUTHENTICATED",
				});
			}

			const { name, email } = req.body;
			const updateData: any = {
				updated_at: new Date().toISOString(),
			};

			if (name) {
				updateData.name = name.trim();
			}

			if (email) {
				updateData.email = email.toLowerCase();
			}

			// Update user profile in database
			const { data: userData, error } = await supabase
				.from("users")
				.update(updateData)
				.eq("id", req.user.id)
				.select()
				.single();

			if (error) {
				console.error("Error updating user profile:", error);
				return res.status(500).json({
					error: "Failed to update profile",
					code: "UPDATE_ERROR",
				});
			}

			res.json({
				user: userData,
				message: "Profile updated successfully",
			});
		} catch (error) {
			console.error("Update profile error:", error);
			res.status(500).json({
				error: "Failed to update profile",
				code: "PROFILE_UPDATE_ERROR",
			});
		}
		return () => {};
	}
);

/**
 * DELETE /api/auth/account
 * Permanently delete user account and all associated data
 */
router.delete(
	"/account",
	authenticateToken,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			if (!req.user) {
				return res.status(401).json({
					error: "User not authenticated",
					code: "NOT_AUTHENTICATED",
				});
			}

			const { confirmDeletion } = req.body;

			if (confirmDeletion !== "DELETE_MY_ACCOUNT") {
				return res.status(400).json({
					error: "Account deletion must be confirmed with 'DELETE_MY_ACCOUNT'",
					code: "DELETION_NOT_CONFIRMED",
				});
			}

			// Perform secure data deletion
			const deletionResult = await dataDeletionService.deleteUserData(
				req.user.id
			);

			if (!deletionResult.success) {
				return res.status(500).json({
					error: "Failed to delete user data",
					code: "DELETION_FAILED",
					details: deletionResult.steps.filter((step) => !step.success),
				});
			}

			res.json({
				message:
					"Account and all associated data have been permanently deleted",
				deletionResult,
			});
		} catch (error) {
			console.error("Account deletion error:", error);
			res.status(500).json({
				error: "Failed to delete account",
				code: "ACCOUNT_DELETION_ERROR",
			});
		}
		return () => {};
	}
);

/**
 * POST /api/auth/account/soft-delete
 * Soft delete user account (mark as deleted but keep for recovery)
 */
router.post(
	"/account/soft-delete",
	authenticateToken,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			if (!req.user) {
				return res.status(401).json({
					error: "User not authenticated",
					code: "NOT_AUTHENTICATED",
				});
			}

			// Perform soft deletion
			const deletionResult = await dataDeletionService.softDeleteUserData(
				req.user.id
			);

			if (!deletionResult.success) {
				return res.status(500).json({
					error: "Failed to soft delete user data",
					code: "SOFT_DELETION_FAILED",
					details: deletionResult.steps.filter((step) => !step.success),
				});
			}

			res.json({
				message:
					"Account has been deactivated. Contact support within 30 days to recover.",
				deletionResult,
			});
		} catch (error) {
			console.error("Soft deletion error:", error);
			res.status(500).json({
				error: "Failed to deactivate account",
				code: "SOFT_DELETION_ERROR",
			});
		}
		return () => {};
	}
);

export default router;
