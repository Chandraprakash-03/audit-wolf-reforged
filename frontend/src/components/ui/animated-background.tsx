"use client";

import { useEffect, useRef } from "react";

export function AnimatedBackground() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animationFrameId: number;
		const particles: Array<{
			x: number;
			y: number;
			vx: number;
			vy: number;
			size: number;
			opacity: number;
		}> = [];

		const resizeCanvas = () => {
			const rect = canvas.getBoundingClientRect();
			canvas.width = rect.width;
			canvas.height = rect.height;
		};

		const createParticles = () => {
			// Reduce particle count for better performance
			const particleCount = Math.min(
				50,
				Math.floor((canvas.width * canvas.height) / 20000)
			);
			particles.length = 0;

			for (let i = 0; i < particleCount; i++) {
				particles.push({
					x: Math.random() * canvas.width,
					y: Math.random() * canvas.height,
					vx: (Math.random() - 0.5) * 0.3,
					vy: (Math.random() - 0.5) * 0.3,
					size: Math.random() * 1.5 + 0.5,
					opacity: Math.random() * 0.3 + 0.1,
				});
			}
		};

		let lastTime = 0;
		const targetFPS = 30; // Reduce FPS for better performance
		const frameInterval = 1000 / targetFPS;

		const animate = (currentTime: number) => {
			if (currentTime - lastTime < frameInterval) {
				animationFrameId = requestAnimationFrame(animate);
				return;
			}
			lastTime = currentTime;

			ctx.clearRect(0, 0, canvas.width, canvas.height);

			// Update and draw particles
			particles.forEach((particle, index) => {
				particle.x += particle.vx;
				particle.y += particle.vy;

				// Wrap around edges
				if (particle.x < 0) particle.x = canvas.width;
				if (particle.x > canvas.width) particle.x = 0;
				if (particle.y < 0) particle.y = canvas.height;
				if (particle.y > canvas.height) particle.y = 0;

				// Draw particle
				ctx.beginPath();
				ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(82, 82, 82, ${particle.opacity})`;
				ctx.fill();

				// Reduce connection calculations for performance
				if (index % 2 === 0) {
					particles.slice(index + 1, index + 5).forEach((otherParticle) => {
						const dx = particle.x - otherParticle.x;
						const dy = particle.y - otherParticle.y;
						const distance = Math.sqrt(dx * dx + dy * dy);

						if (distance < 80) {
							ctx.beginPath();
							ctx.moveTo(particle.x, particle.y);
							ctx.lineTo(otherParticle.x, otherParticle.y);
							ctx.strokeStyle = `rgba(82, 82, 82, ${
								0.08 * (1 - distance / 80)
							})`;
							ctx.lineWidth = 0.3;
							ctx.stroke();
						}
					});
				}
			});

			animationFrameId = requestAnimationFrame(animate);
		};

		resizeCanvas();
		createParticles();
		animate(0);

		let resizeTimeout: NodeJS.Timeout;
		const handleResize = () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				resizeCanvas();
				createParticles();
			}, 250);
		};

		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
			cancelAnimationFrame(animationFrameId);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 pointer-events-none opacity-20 w-full h-full"
			style={{ zIndex: 1 }}
		/>
	);
}
