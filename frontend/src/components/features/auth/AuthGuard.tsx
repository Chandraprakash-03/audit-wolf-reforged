"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface AuthGuardProps {
	children: React.ReactNode;
	requireAuth?: boolean;
	redirectTo?: string;
	fallback?: React.ReactNode;
}

export function AuthGuard({
	children,
	requireAuth = false,
	redirectTo = "/auth/login",
	fallback = (
		<div className="flex items-center justify-center min-h-screen">
			Loading...
		</div>
	),
}: AuthGuardProps) {
	const { user, loading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading) {
			if (requireAuth && !user) {
				// Get the current path to use as redirect parameter
				const currentPath = window.location.pathname;
				const loginUrl =
					currentPath === "/auth/login"
						? redirectTo
						: `${redirectTo}?redirectTo=${encodeURIComponent(currentPath)}`;
				router.push(loginUrl);
			} else if (!requireAuth && user) {
				// Check if there's a redirectTo parameter in the URL
				const urlParams = new URLSearchParams(window.location.search);
				const redirectPath = urlParams.get("redirectTo") || "/dashboard";
				router.push(redirectPath);
			}
		}
	}, [user, loading, requireAuth, redirectTo, router]);

	// Show loading state while checking authentication
	if (loading) {
		return <>{fallback}</>;
	}

	// If auth is required but user is not authenticated, show loading
	if (requireAuth && !user) {
		return <>{fallback}</>;
	}

	// If auth is not required but user is authenticated, show loading while redirecting
	if (!requireAuth && user) {
		return <>{fallback}</>;
	}

	return <>{children}</>;
}

// Higher-order component for protecting pages
export function withAuth<P extends object>(
	Component: React.ComponentType<P>,
	options?: {
		requireAuth?: boolean;
		redirectTo?: string;
		fallback?: React.ReactNode;
	}
) {
	return function AuthenticatedComponent(props: P) {
		return (
			<AuthGuard {...options}>
				<Component {...props} />
			</AuthGuard>
		);
	};
}
