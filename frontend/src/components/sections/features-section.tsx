"use client";

import { Search, Bot, FileText, Zap, Shield, Database } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export function FeaturesSection() {
	const features = [
		{
			icon: Search,
			title: "Static Analysis",
			description:
				"Advanced Slither integration detects vulnerabilities and code quality issues with precision.",
		},
		{
			icon: Bot,
			title: "AI Analysis",
			description:
				"Multiple AI models work together to identify complex security patterns and logic flaws.",
		},
		{
			icon: FileText,
			title: "Detailed Reports",
			description:
				"Comprehensive audit reports with severity ratings and actionable remediation steps.",
		},
		{
			icon: Zap,
			title: "Gas Optimization",
			description:
				"Identify gas inefficiencies and get recommendations to reduce deployment costs.",
		},
		{
			icon: Shield,
			title: "Real-time Security",
			description:
				"Continuous monitoring with instant alerts for potential security vulnerabilities.",
		},
		{
			icon: Database,
			title: "Decentralized Storage",
			description:
				"Secure audit records stored on IPFS, verified on blockchain for tamper-proof transparency and trust.",
		},
	];

	return (
		<section className="relative py-24 md:py-32 overflow-hidden">
			{/* Background for glass effect visibility */}
			<div className="absolute inset-0 bg-gradient-to-b from-background to-muted/20" />
			<div className="absolute top-0 right-0 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
			<div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />

			<Container className="relative">
				{/* Section header */}
				<div className="text-center mb-20">
					<ScrollReveal>
						<h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground">
							Everything you need to secure your contracts
						</h2>
					</ScrollReveal>
					<ScrollReveal delay={100}>
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
							Comprehensive security analysis powered by cutting-edge technology
						</p>
					</ScrollReveal>
				</div>

				{/* Features grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
					{features.map((feature, index) => (
						<ScrollReveal key={index} delay={index * 100}>
							<div className="group p-6 rounded-xl glass hover:bg-background/80 transition-all duration-300">
								{/* Icon */}
								<div className="mb-4">
									<div className="w-12 h-12 rounded-lg glass flex items-center justify-center group-hover:bg-muted/30 transition-colors">
										<feature.icon className="h-6 w-6 text-foreground" />
									</div>
								</div>

								{/* Content */}
								<h3 className="text-lg font-semibold text-foreground mb-2">
									{feature.title}
								</h3>
								<p className="text-muted-foreground leading-relaxed">
									{feature.description}
								</p>
							</div>
						</ScrollReveal>
					))}
				</div>
			</Container>
		</section>
	);
}
