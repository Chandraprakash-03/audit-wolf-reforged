import { Router, Request, Response } from "express";
import { supabase } from "../config/supabase";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

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
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			if (!req.user) {
				return res.status(401).json({
					error: "User not authenticated",
					code: "NOT_AUTHENTICATED",
				});
			}

			const { name } = req.body;

			// Validate input
			if (!name || typeof name !== "string" || name.trim().length < 2) {
				return res.status(400).json({
					error: "Name must be at least 2 characters long",
					code: "INVALID_NAME",
				});
			}

			// Update user profile in database
			const { data: userData, error } = await supabase
				.from("users")
				.update({
					name: name.trim(),
					updated_at: new Date().toISOString(),
				})
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

export default router;
