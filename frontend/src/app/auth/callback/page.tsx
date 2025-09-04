"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
	const router = useRouter();
	const searchParams = useSearchParams();

	useEffect(() => {
		const handleAuthCallback = async () => {
			try {
				// Check if there's a hash fragment with auth tokens
				const hashFragment = window.location.hash;

				if (hashFragment) {
					// Parse the hash fragment for auth tokens
					const { data, error } = await supabase.auth.getSession();

					if (error) {
						console.error("Auth callback error:", error);
						router.push("/auth/login?error=callback_error");
						return;
					}

					if (data.session) {
						// User is authenticated, redirect to dashboard or intended page
						const redirectTo = searchParams.get("redirectTo") || "/dashboard";
						console.log(
							"Email verification successful, redirecting to:",
							redirectTo
						);

						// Clear the hash and redirect
						window.history.replaceState(null, "", window.location.pathname);
						router.push(redirectTo);
						return;
					}
				}

				// If no hash or session, try to get current session
				const { data, error } = await supabase.auth.getSession();

				if (error) {
					console.error("Auth callback error:", error);
					router.push("/auth/login?error=callback_error");
					return;
				}

				if (data.session) {
					// User is authenticated, redirect to dashboard or intended page
					const redirectTo = searchParams.get("redirectTo") || "/dashboard";
					console.log(
						"User already authenticated, redirecting to:",
						redirectTo
					);
					router.push(redirectTo);
				} else {
					// No session found, redirect to login
					console.log("No session found, redirecting to login");
					router.push("/auth/login");
				}
			} catch (error) {
				console.error("Callback handling error:", error);
				router.push("/auth/login?error=callback_error");
			}
		};

		// Small delay to ensure the page is fully loaded
		const timer = setTimeout(handleAuthCallback, 100);
		return () => clearTimeout(timer);
	}, [router, searchParams]);

	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<div className="text-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
				<p className="mt-4 text-muted-foreground">Verifying your account...</p>
			</div>
		</div>
	);
}
