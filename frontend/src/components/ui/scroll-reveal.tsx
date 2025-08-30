"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ScrollRevealProps {
	children: React.ReactNode;
	className?: string;
	delay?: number;
	direction?: "up" | "down" | "left" | "right" | "fade";
	distance?: number;
}

export function ScrollReveal({
	children,
	className,
	delay = 0,
	direction = "up",
	distance = 50,
}: ScrollRevealProps) {
	const [isVisible, setIsVisible] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					if (delay > 0) {
						setTimeout(() => setIsVisible(true), delay);
					} else {
						setIsVisible(true);
					}
					observer.disconnect(); // Stop observing once visible
				}
			},
			{
				threshold: 0.1,
				rootMargin: "0px 0px -50px 0px",
			}
		);

		if (ref.current) {
			observer.observe(ref.current);
		}

		return () => observer.disconnect();
	}, [delay]);

	const getTransform = () => {
		if (isVisible) return "translate3d(0, 0, 0)";

		switch (direction) {
			case "up":
				return `translate3d(0, ${distance}px, 0)`;
			case "down":
				return `translate3d(0, -${distance}px, 0)`;
			case "left":
				return `translate3d(${distance}px, 0, 0)`;
			case "right":
				return `translate3d(-${distance}px, 0, 0)`;
			default:
				return "translate3d(0, 0, 0)";
		}
	};

	return (
		<div
			ref={ref}
			className={cn("transition-all duration-500 ease-out", className)}
			style={{
				transform: getTransform(),
				opacity: isVisible ? 1 : 0,
			}}
		>
			{children}
		</div>
	);
}
