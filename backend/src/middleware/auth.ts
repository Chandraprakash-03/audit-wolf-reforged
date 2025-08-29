import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase";

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
				error: "Access token required",
				code: "MISSING_TOKEN",
			});
		}

		// Verify the JWT token with Supabase
		const {
			data: { user },
			error,
		} = await supabase.auth.getUser(token);

		if (error || !user) {
			return res.status(401).json({
				error: "Invalid or expired token",
				code: "INVALID_TOKEN",
			});
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
			error: "Authentication failed",
			code: "AUTH_ERROR",
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
