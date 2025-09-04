"use client";

import { useState } from "react";
import { LoginForm } from "@/components/features/auth/LoginForm";
import { RegisterForm } from "@/components/features/auth/RegisterForm";
import { AuthGuard } from "@/components/features/auth/AuthGuard";

export default function RegisterPage() {
	const [isLogin, setIsLogin] = useState(false);

	return (
		<AuthGuard requireAuth={false}>
			<div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
				<div className="max-w-md w-full space-y-8">
					{isLogin ? (
						<LoginForm onToggleMode={() => setIsLogin(false)} />
					) : (
						<RegisterForm onToggleMode={() => setIsLogin(true)} />
					)}
				</div>
			</div>
		</AuthGuard>
	);
}
