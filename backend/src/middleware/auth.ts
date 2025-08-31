import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase";
import { DatabaseService } from "../services/database";

export interface AuthenticatedRequest extends Request {
	user?: {
		id: string;
		email: string;
		role?: string;
	};
}

/**
 * Middleware to verify JWT token and authenticate user
 */
export const authenticateToken = async (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		const authHeader = req.headers.authorization;
		const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

		if (!token) {
			return res.status(401).json({
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
		}

		// Verify the JWT token with Supabase
		const {
			data: { user },
			error,
		} = await supabase.auth.getUser(token);

		if (error || !user) {
			return res.status(401).json({
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
		}

		// Ensure user exists in our database
		let dbUser = await DatabaseService.getUserById(user.id);
		if (!dbUser) {
			// Create user in our database if they don't exist
			dbUser = await DatabaseService.createUser({
				id: user.id,
				email: user.email!,
				name: user.user_metadata?.name || user.email!.split("@")[0],
				subscription_tier: "free",
				api_credits: 10,
			});

			if (!dbUser) {
				console.error("Failed to create user in database:", user.id);
				return res.status(500).json({
					success: false,
					error: {
						code: "USER_CREATION_ERROR",
						message: "Failed to create user account",
						recovery: [
							"Please try logging in again",
							"Contact support if the issue persists",
						],
					},
				});
			}
		}

		// Add user info to request object
		req.user = {
			id: user.id,
			email: user.email!,
			role: user.user_metadata?.role || "user",
		};

		next();
	} catch (error) {
		console.error("Authentication error:", error);
		return res.status(500).json({
			success: false,
			error: {
				code: "AUTH_ERROR",
				message: "Authentication failed",
				recovery: ["Please try again", "Contact support if the issue persists"],
			},
		});
	}
	return () => {};
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (roles: string[]) => {
	return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
		if (!req.user) {
			return res.status(401).json({
				error: "Authentication required",
				code: "NOT_AUTHENTICATED",
			});
		}

		const userRole = req.user.role || "user";
		if (!roles.includes(userRole)) {
			return res.status(403).json({
				error: "Insufficient permissions",
				code: "INSUFFICIENT_PERMISSIONS",
				required: roles,
				current: userRole,
			});
		}

		return next();
	};
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = async (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		const authHeader = req.headers.authorization;
		const token = authHeader && authHeader.split(" ")[1];

		if (token) {
			const {
				data: { user },
				error,
			} = await supabase.auth.getUser(token);

			if (!error && user) {
				req.user = {
					id: user.id,
					email: user.email!,
					role: user.user_metadata?.role || "user",
				};
			}
		}

		next();
	} catch (error) {
		console.error("Optional auth error:", error);
		// Continue without authentication
		next();
	}
};
