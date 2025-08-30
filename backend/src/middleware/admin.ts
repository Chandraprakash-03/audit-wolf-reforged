import { Request, Response, NextFunction } from "express";

interface AuthenticatedRequest extends Request {
	user?: {
		id: string;
		email: string;
		role?: string;
		subscription_tier?: string;
	};
}

/**
 * Middleware to check if user has admin privileges
 */
export const adminMiddleware = (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
): void => {
	try {
		// Check if user is authenticated
		if (!req.user) {
			res.status(401).json({ error: "Authentication required" });
			return;
		}

		// Check if user has admin role
		const isAdmin =
			req.user.role === "admin" ||
			req.user.subscription_tier === "enterprise" ||
			process.env.ADMIN_EMAILS?.split(",").includes(req.user.email);

		if (!isAdmin) {
			res.status(403).json({
				error: "Admin privileges required",
				message: "You do not have permission to access this resource",
			});
			return;
		}

		next();
	} catch (error) {
		console.error("Error in admin middleware:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};
