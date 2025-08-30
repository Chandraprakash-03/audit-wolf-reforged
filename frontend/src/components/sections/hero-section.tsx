"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { AuditWolfLogo } from "@/components/ui/audit-wolf-logo";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface HeroSectionProps {
	user: any;
}

export function HeroSection({ user }: HeroSectionProps) {
	return (
		<section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
			{/* Enhanced background gradient */}
			<div className="absolute inset-0 bg-gradient-to-br from-background via-muted/10 to-muted/30" />

			{/* Subtle color orbs for glass effect visibility */}
			<div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
			<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />

			{/* Grid pattern overlay */}
			<div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.08]">
				<div
					className="w-full h-full"
					style={{
						backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
						backgroundSize: "24px 24px",
					}}
				/>
			</div>

			<Container className="relative">
				<div className="text-center max-w-4xl mx-auto">
					{/* Badge */}
					<ScrollReveal>
						<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-sm text-muted-foreground mb-8 hover:border-border transition-colors">
							<div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
							<span>AI-Powered Smart Contract Security</span>
						</div>
					</ScrollReveal>

					{/* Main heading */}
					<ScrollReveal delay={100}>
						<div className="flex items-center justify-center gap-4 mb-6">
							<AuditWolfLogo size={48} className="opacity-90" />
							<h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground">
								Audit Wolf
							</h1>
						</div>
					</ScrollReveal>

					<ScrollReveal delay={200}>
						<h2 className="text-xl md:text-2xl lg:text-3xl text-muted-foreground font-medium mb-6 leading-relaxed">
							Secure your smart contracts with{" "}
							<span className="text-foreground font-semibold">
								enterprise-grade
							</span>{" "}
							AI analysis
						</h2>
					</ScrollReveal>

					{/* Description */}
					<ScrollReveal delay={300}>
						<p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
							Professional security auditing platform that combines advanced
							static analysis with AI to identify vulnerabilities and optimize
							your smart contracts.
						</p>
					</ScrollReveal>

					{/* CTA Buttons */}
					<ScrollReveal delay={400}>
						<div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
							{user ? (
								<>
									<Button
										size="lg"
										asChild
										className="h-12 px-8 text-base font-medium bg-foreground text-background hover:bg-foreground/90 transition-all duration-200"
									>
										<Link href="/dashboard" className="flex items-center gap-2">
											<span>Go to Dashboard</span>
											<ArrowRight className="h-4 w-4" />
										</Link>
									</Button>
									<Button
										size="lg"
										variant="outline"
										asChild
										className="h-12 px-8 text-base font-medium border-border hover:bg-muted/50 transition-all duration-200"
									>
										<Link href="/upload">Upload Contract</Link>
									</Button>
								</>
							) : (
								<>
									<Button
										size="lg"
										asChild
										className="h-12 px-8 text-base font-medium bg-foreground text-background hover:bg-foreground/90 transition-all duration-200"
									>
										<Link
											href="/auth/register"
											className="flex items-center gap-2"
										>
											<span>Start Free Audit</span>
											<ArrowRight className="h-4 w-4" />
										</Link>
									</Button>
									<Button
										size="lg"
										variant="outline"
										asChild
										className="h-12 px-8 text-base font-medium border-border hover:bg-muted/50 transition-all duration-200"
									>
										<Link href="/auth/login">Sign In</Link>
									</Button>
								</>
							)}
						</div>
					</ScrollReveal>

					{/* Trust indicators */}
					<ScrollReveal delay={500}>
						<div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-muted-foreground">
							<div className="flex items-center gap-2">
								<Sparkles className="h-4 w-4" />
								<span>Enterprise Ready</span>
							</div>
							<div className="flex items-center gap-2">
								<Zap className="h-4 w-4" />
								<span>Lightning Fast</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-4 h-4 rounded-full bg-gradient-to-r from-green-400 to-blue-500" />
								<span>99.9% Uptime</span>
							</div>
						</div>
					</ScrollReveal>
				</div>
			</Container>
		</section>
	);
}
