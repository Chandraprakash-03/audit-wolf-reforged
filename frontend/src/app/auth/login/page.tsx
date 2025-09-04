"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/features/auth/LoginForm";
import { RegisterForm } from "@/components/features/auth/RegisterForm";

export default function LoginPage() {
	const [isLogin, setIsLogin] = useState(true);
	const searchParams = useSearchParams();
	const redirectTo = searchParams.get("redirectTo") || "/dashboard";

	return (
		<div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full space-y-8">
				{isLogin ? (
					<LoginForm
						onToggleMode={() => setIsLogin(false)}
						redirectTo={redirectTo}
					/>
				) : (
					<RegisterForm
						onToggleMode={() => setIsLogin(true)}
						redirectTo={redirectTo}
					/>
				)}
			</div>
		</div>
	);
}
