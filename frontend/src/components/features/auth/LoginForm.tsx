"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; // Add this import
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface LoginFormProps {
	onToggleMode?: () => void;
	redirectTo?: string;
}

export function LoginForm({
	onToggleMode,
	redirectTo = "/dashboard",
}: LoginFormProps) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [errors, setErrors] = useState<{
		email?: string;
		password?: string;
		general?: string;
	}>({});
	const [isLoading, setIsLoading] = useState(false);

	const { signIn } = useAuth();
	const router = useRouter(); // Add this

	const validateForm = () => {
		const newErrors: { email?: string; password?: string } = {};

		// Email validation
		if (!email) {
			newErrors.email = "Email is required";
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			newErrors.email = "Please enter a valid email address";
		}

		// Password validation
		if (!password) {
			newErrors.password = "Password is required";
		} else if (password.length < 6) {
			newErrors.password = "Password must be at least 6 characters";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) {
			return;
		}

		setIsLoading(true);
		setErrors({});

		try {
			console.log("Attempting to sign in with:", email);
			await signIn(email, password);
			console.log("Sign in successful, redirecting...");
			router.push(redirectTo); // Use client-side navigation here
		} catch (error) {
			console.error("Login error:", error);
			setErrors({
				general:
					error instanceof Error
						? error.message
						: "An error occurred during login",
			});
			setIsLoading(false);
		}
	};

	return (
		<Card className="w-full max-w-md mx-auto">
			<CardHeader className="space-y-1">
				<CardTitle className="text-2xl font-bold text-center">
					Sign In
				</CardTitle>
				<CardDescription className="text-center">
					Enter your credentials to access your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					{errors.general && (
						<div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
							{errors.general}
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							placeholder="Enter your email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className={errors.email ? "border-destructive" : ""}
							disabled={isLoading}
						/>
						{errors.email && (
							<p className="text-sm text-destructive">{errors.email}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="password">Password</Label>
						<Input
							id="password"
							type="password"
							placeholder="Enter your password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className={errors.password ? "border-destructive" : ""}
							disabled={isLoading}
						/>
						{errors.password && (
							<p className="text-sm text-destructive">{errors.password}</p>
						)}
					</div>

					<Button type="submit" className="w-full" disabled={isLoading}>
						{isLoading ? "Signing In..." : "Sign In"}
					</Button>
				</form>

				<div className="mt-6 text-center space-y-2">
					<button
						type="button"
						className="text-sm text-primary hover:text-primary/80 underline"
						onClick={() => {
							// TODO: Implement forgot password modal
							console.log("Forgot password clicked");
						}}
					>
						Forgot your password?
					</button>

					{onToggleMode && (
						<div className="text-sm text-muted-foreground">
							Don't have an account?{" "}
							<button
								type="button"
								onClick={onToggleMode}
								className="text-primary hover:text-primary/80 underline"
							>
								Sign up
							</button>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
