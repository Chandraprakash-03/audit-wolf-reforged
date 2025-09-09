"use client";

import React, {
	useState,
	useEffect,
	useContext,
	createContext,
	ReactNode,
} from "react";
import { AuthService, AuthState } from "@/lib/auth";

interface AuthContextType extends AuthState {
	signIn: (
		email: string,
		password: string
	) => Promise<{ user: any; session: any } | null>;
	signUp: (email: string, password: string, name?: string) => Promise<void>;
	signOut: () => Promise<void>;
	resetPassword: (email: string) => Promise<void>;
	updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<AuthState>({
		user: null,
		session: null,
		loading: true,
	});

	useEffect(() => {
		// Get initial session
		const getInitialSession = async () => {
			try {
				const session = await AuthService.getSession();
				const user = session?.user
					? {
							id: session.user.id,
							email: session.user.email!,
							name: session.user.user_metadata?.name || "",
							role: session.user.user_metadata?.role || "",
							created_at: session.user.created_at,
					  }
					: null;

				setState({
					user,
					session,
					loading: false,
				});
			} catch (error) {
				console.error("Error getting initial session:", error);
				setState((prev) => ({ ...prev, loading: false }));
			}
		};

		getInitialSession();

		// Listen for auth changes
		const {
			data: { subscription },
		} = AuthService.onAuthStateChange(async (event, session) => {
			console.log("Auth state changed:", event, session?.user?.email);

			const user = session?.user
				? {
						id: session.user.id,
						email: session.user.email!,
						name: session.user.user_metadata?.name || "",
						role: session.user.user_metadata?.role || "",
						created_at: session.user.created_at,
				  }
				: null;

			setState({
				user,
				session,
				loading: false,
			});

			// Handle redirects after successful authentication
			// if (event === "SIGNED_IN" && user) {
			// 	console.log("User signed in successfully:", user.email);

			// 	// Check if we're on an auth page and should redirect
			// 	const currentPath = window.location.pathname;
			// 	const isAuthPage = currentPath.startsWith("/auth/");

			// 	if (isAuthPage) {
			// 		// Get redirect URL from query params or default to dashboard
			// 		const urlParams = new URLSearchParams(window.location.search);
			// 		const redirectTo = urlParams.get("redirectTo") || "/dashboard";

			// 		// Use router.push for client-side navigation
			// 		window.location.href = redirectTo;
			// 	}
			// }
		});

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	const signIn = async (email: string, password: string) => {
		setState((prev) => ({ ...prev, loading: true }));
		try {
			const result = await AuthService.signIn(email, password);
			// State will be updated by the auth state change listener
			return result;
		} catch (error) {
			setState((prev) => ({ ...prev, loading: false }));
			throw error;
		}
	};

	const signUp = async (email: string, password: string, name?: string) => {
		setState((prev) => ({ ...prev, loading: true }));
		try {
			await AuthService.signUp(email, password, name);
			// State will be updated by the auth state change listener
		} catch (error) {
			setState((prev) => ({ ...prev, loading: false }));
			throw error;
		}
	};

	const signOut = async () => {
		setState((prev) => ({ ...prev, loading: true }));
		try {
			await AuthService.signOut();
			// State will be updated by the auth state change listener
		} catch (error) {
			setState((prev) => ({ ...prev, loading: false }));
			throw error;
		}
	};

	const resetPassword = async (email: string) => {
		await AuthService.resetPassword(email);
	};

	const updatePassword = async (newPassword: string) => {
		await AuthService.updatePassword(newPassword);
	};

	const value: AuthContextType = {
		...state,
		signIn,
		signUp,
		signOut,
		resetPassword,
		updatePassword,
	};

	return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
