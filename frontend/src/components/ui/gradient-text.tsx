"use client";

import { cn } from "@/lib/utils";

interface GradientTextProps {
	children: React.ReactNode;
	className?: string;
	gradient?: "primary" | "accent" | "rainbow" | "cyber";
}

export function GradientText({
	children,
	className,
	gradient = "primary",
}: GradientTextProps) {
	const gradients = {
		primary: "bg-gradient-to-r from-primary via-primary/80 to-primary/60",
		accent: "bg-gradient-to-r from-accent via-accent/80 to-accent/60",
		rainbow: "bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500",
		cyber: "bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600",
	};

	return (
		<span
			className={cn(
				"bg-clip-text text-transparent animate-pulse",
				gradients[gradient],
				className
			)}
		>
			{children}
		</span>
	);
}
