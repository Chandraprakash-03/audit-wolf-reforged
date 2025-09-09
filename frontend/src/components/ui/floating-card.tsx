"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FloatingCardProps {
	children: React.ReactNode;
	className?: string;
	intensity?: number;
}

export function FloatingCard({
	children,
	className,
	intensity = 1,
}: FloatingCardProps) {
	const cardRef = useRef<HTMLDivElement>(null);
	const [transform, setTransform] = useState("");

	useEffect(() => {
		const card = cardRef.current;
		if (!card) return;

		let animationFrameId: number;

		const handleMouseMove = (e: MouseEvent) => {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}

			animationFrameId = requestAnimationFrame(() => {
				const rect = card.getBoundingClientRect();
				const x = e.clientX - rect.left;
				const y = e.clientY - rect.top;
				const centerX = rect.width / 2;
				const centerY = rect.height / 2;

				const rotateX = ((y - centerY) / centerY) * -8 * intensity;
				const rotateY = ((x - centerX) / centerX) * 8 * intensity;

				setTransform(
					`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(8px)`
				);
			});
		};

		const handleMouseLeave = () => {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}
			setTransform(
				"perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)"
			);
		};

		card.addEventListener("mousemove", handleMouseMove, { passive: true });
		card.addEventListener("mouseleave", handleMouseLeave);

		return () => {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}
			card.removeEventListener("mousemove", handleMouseMove);
			card.removeEventListener("mouseleave", handleMouseLeave);
		};
	}, [intensity]);

	return (
		<div
			ref={cardRef}
			className={cn(
				"transition-transform duration-200 ease-out glass rounded-xl",
				className
			)}
			style={{ transform }}
		>
			{children}
		</div>
	);
}
