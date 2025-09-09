"use client";

import { ReactNode } from "react";
import { Navigation } from "./navigation";
import { Container } from "./container";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
	children: ReactNode;
	title?: string;
	description?: string;
	className?: string;
	containerSize?: "sm" | "md" | "lg" | "xl" | "full";
	showNavigation?: boolean;
}

export function PageLayout({
	children,
	title,
	description,
	className,
	containerSize = "lg",
	showNavigation = true,
}: PageLayoutProps) {
	return (
		<div className="min-h-screen bg-background">
			{showNavigation && <Navigation />}

			<main className={cn("flex-1", className)}>
				<Container size={containerSize} className="py-6 md:py-8">
					{(title || description) && (
						<div className="mb-6 md:mb-8">
							{title && (
								<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">
									{title}
								</h1>
							)}
							{description && (
								<p className="text-muted-foreground text-sm md:text-base max-w-2xl">
									{description}
								</p>
							)}
						</div>
					)}

					<div className="animate-in fade-in-50 duration-300">{children}</div>
				</Container>
			</main>
		</div>
	);
}
