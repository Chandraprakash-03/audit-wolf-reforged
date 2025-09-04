"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

interface RegisterFormProps {
	onToggleMode?: () => void;
	redirectTo?: string;
}

export function RegisterForm({
	onToggleMode,
	redirectTo = "/dashboard",
}: RegisterFormProps) {
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		confirmPassword: "",
	});
	const [errors, setErrors] = useState<{
		name?: string;
		email?: string;
		password?: string;
		confirmPassword?: string;
		general?: string;
	}>({});
	const [isLoading, setIsLoading] = useState(false);

	const { signUp } = useAuth();
	const router = useRouter();

	const validateForm = () => {
		const newErrors: {
			name?: string;
			email?: string;
			password?: string;
			confirmPassword?: string;
		} = {};

		// Name validation
		if (!formData.name.trim()) {
			newErrors.name = "Name is required";
		} else if (formData.name.trim().length < 2) {
			newErrors.name = "Name must be at least 2 characters";
		}

		// Email validation
		if (!formData.email) {
			newErrors.email = "Email is required";
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
			newErrors.email = "Please enter a valid email address";
		}

		// Password validation
		if (!formData.password) {
			newErrors.password = "Password is required";
		} else if (formData.password.length < 8) {
			newErrors.password = "Password must be at least 8 characters";
		} else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
			newErrors.password =
				"Password must contain at least one uppercase letter, one lowercase letter, and one number";
		}

		// Confirm password validation
		if (!formData.confirmPassword) {
			newErrors.confirmPassword = "Please confirm your password";
		} else if (formData.password !== formData.confirmPassword) {
			newErrors.confirmPassword = "Passwords do not match";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleInputChange =
		(field: keyof typeof formData) =>
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setFormData((prev) => ({
				...prev,
				[field]: e.target.value,
			}));

			// Clear field-specific error when user starts typing
			if (errors[field]) {
				setErrors((prev) => ({
					...prev,
					[field]: undefined,
				}));
			}
		};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) {
			return;
		}

		setIsLoading(true);
		setErrors({});

		try {
			await signUp(formData.email, formData.password, formData.name);
			// Redirect to verify email page with the intended redirect destination
			const verifyUrl = new URL("/auth/verify-email", window.location.origin);
			if (redirectTo !== "/dashboard") {
				verifyUrl.searchParams.set("redirectTo", redirectTo);
			}
			router.push(verifyUrl.toString());
		} catch (error) {
			console.error("Registration error:", error);
			setErrors({
				general:
					error instanceof Error
						? error.message
						: "An error occurred during registration",
			});
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Card className="w-full max-w-md mx-auto">
			<CardHeader className="space-y-1">
				<CardTitle className="text-2xl font-bold text-center">
					Create Account
				</CardTitle>
				<CardDescription className="text-center">
					Sign up to start auditing your smart contracts
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
						<Label htmlFor="name">Full Name</Label>
						<Input
							id="name"
							type="text"
							placeholder="Enter your full name"
							value={formData.name}
							onChange={handleInputChange("name")}
							className={errors.name ? "border-destructive" : ""}
							disabled={isLoading}
						/>
						{errors.name && (
							<p className="text-sm text-destructive">{errors.name}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							placeholder="Enter your email"
							value={formData.email}
							onChange={handleInputChange("email")}
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
							placeholder="Create a strong password"
							value={formData.password}
							onChange={handleInputChange("password")}
							className={errors.password ? "border-destructive" : ""}
							disabled={isLoading}
						/>
						{errors.password && (
							<p className="text-sm text-destructive">{errors.password}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="confirmPassword">Confirm Password</Label>
						<Input
							id="confirmPassword"
							type="password"
							placeholder="Confirm your password"
							value={formData.confirmPassword}
							onChange={handleInputChange("confirmPassword")}
							className={errors.confirmPassword ? "border-destructive" : ""}
							disabled={isLoading}
						/>
						{errors.confirmPassword && (
							<p className="text-sm text-destructive">
								{errors.confirmPassword}
							</p>
						)}
					</div>

					<Button type="submit" className="w-full" disabled={isLoading}>
						{isLoading ? "Creating Account..." : "Create Account"}
					</Button>
				</form>

				{onToggleMode && (
					<div className="mt-6 text-center">
						<div className="text-sm text-muted-foreground">
							Already have an account?{" "}
							<button
								type="button"
								onClick={onToggleMode}
								className="text-primary hover:text-primary/80 underline"
							>
								Sign in
							</button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
