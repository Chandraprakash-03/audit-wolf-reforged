"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ParallaxSectionProps {
	children: React.ReactNode;
	className?: string;
	speed?: number;
	offset?: number;
}

export function ParallaxSection({
	children,
	className,
	speed = 0.5,
	offset = 0,
}: ParallaxSectionProps) {
	const [scrollY, setScrollY] = useState(0);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let ticking = false;

		const handleScroll = () => {
			if (!ticking) {
				requestAnimationFrame(() => {
					if (ref.current) {
						const scrolled = window.pageYOffset;
						const rate = scrolled * speed;
						setScrollY(rate);
					}
					ticking = false;
				});
				ticking = true;
			}
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, [speed]);

	return (
		<div
			ref={ref}
			className={cn("relative", className)}
			style={{
				transform: `translate3d(0, ${scrollY + offset}px, 0)`,
			}}
		>
			{children}
		</div>
	);
}
