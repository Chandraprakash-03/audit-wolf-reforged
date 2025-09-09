import { supabase } from "./supabase";
import type { User, Session } from "@supabase/supabase-js";

export interface AuthUser {
	id: string;
	email: string;
	name?: string;
	role?: string;
	created_at: string;
}

export interface AuthState {
	user: AuthUser | null;
	session: Session | null;
	loading: boolean;
}

export class AuthService {
	/**
	 * Sign up a new user with email and password
	 */
	static async signUp(email: string, password: string, name?: string) {
		try {
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
				options: {
					data: {
						name: name || "",
					},
					emailRedirectTo: `${window.location.origin}/auth/callback`,
				},
			});

			if (error) {
				throw new Error(error.message);
			}

			return { user: data.user, session: data.session };
		} catch (error) {
			console.error("Sign up error:", error);
			throw error;
		}
	}

	/**
	 * Sign in with email and password
	 */
	static async signIn(email: string, password: string) {
		try {
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) {
				throw new Error(error.message);
			}

			return { user: data.user, session: data.session };
		} catch (error) {
			console.error("Sign in error:", error);
			throw error;
		}
	}

	/**
	 * Sign out the current user
	 */
	static async signOut() {
		try {
			const { error } = await supabase.auth.signOut();
			if (error) {
				throw new Error(error.message);
			}
		} catch (error) {
			console.error("Sign out error:", error);
			throw error;
		}
	}

	/**
	 * Get the current user session
	 */
	static async getSession() {
		try {
			const {
				data: { session },
				error,
			} = await supabase.auth.getSession();
			if (error) {
				throw new Error(error.message);
			}
			return session;
		} catch (error) {
			console.error("Get session error:", error);
			return null;
		}
	}

	/**
	 * Get the current user
	 */
	static async getUser() {
		try {
			const {
				data: { user },
				error,
			} = await supabase.auth.getUser();
			if (error) {
				throw new Error(error.message);
			}
			return user;
		} catch (error) {
			console.error("Get user error:", error);
			return null;
		}
	}

	/**
	 * Reset password for a user
	 */
	static async resetPassword(email: string) {
		try {
			const { error } = await supabase.auth.resetPasswordForEmail(email, {
				redirectTo: `${window.location.origin}/auth/reset-password`,
			});

			if (error) {
				throw new Error(error.message);
			}
		} catch (error) {
			console.error("Reset password error:", error);
			throw error;
		}
	}

	/**
	 * Update user password
	 */
	static async updatePassword(newPassword: string) {
		try {
			const { error } = await supabase.auth.updateUser({
				password: newPassword,
			});

			if (error) {
				throw new Error(error.message);
			}
		} catch (error) {
			console.error("Update password error:", error);
			throw error;
		}
	}

	/**
	 * Listen to auth state changes
	 */
	static onAuthStateChange(
		callback: (event: string, session: Session | null) => void
	) {
		return supabase.auth.onAuthStateChange(callback);
	}
}
