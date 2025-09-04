"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface LogoutButtonProps {
	variant?: "default" | "outline" | "ghost";
	size?: "sm" | "default" | "lg";
	className?: string;
}

export function LogoutButton({
	variant = "outline",
	size = "default",
	className,
}: LogoutButtonProps) {
	const [isLoading, setIsLoading] = useState(false);
	const { signOut } = useAuth();

	const handleSignOut = async () => {
		setIsLoading(true);
		try {
			await signOut();
			window.location.href = "/";
		} catch (error) {
			console.error("Sign out error:", error);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Button
			onClick={handleSignOut}
			disabled={isLoading}
			variant={variant}
			size={size}
			className={className}
		>
			{isLoading ? "Signing Out..." : "Sign Out"}
		</Button>
	);
}
