"use client";

import { CheckCircle, Clock, Award, Users, Zap, Shield } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { AuditWolfLogo } from "@/components/ui/audit-wolf-logo";

export function BenefitsSection() {
	return (
		<section className="relative py-24 md:py-32 bg-muted/30 overflow-hidden">
			{/* Enhanced background for glass effect */}
			<div className="absolute top-1/3 left-1/3 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl" />
			<div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-orange-500/8 rounded-full blur-3xl" />

			<Container className="relative">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
					{/* Left content */}
					<div className="lg:col-span-5 space-y-8">
						<ScrollReveal>
							<div>
								<h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground">
									Why developers choose Audit Wolf
								</h2>
								<p className="text-xl text-muted-foreground">
									Built for teams that ship fast without compromising on
									security
								</p>
							</div>
						</ScrollReveal>

						<ScrollReveal delay={100}>
							<div className="space-y-4">
								{[
									"Enterprise-grade security analysis",
									"Lightning-fast audit results",
									"99.9% accuracy with minimal false positives",
									"24/7 automated monitoring",
									"Expert support team",
									"Always up-to-date security patterns",
								].map((benefit, index) => (
									<div key={index} className="flex items-center gap-3">
										<CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
										<span className="text-muted-foreground">{benefit}</span>
									</div>
								))}
							</div>
						</ScrollReveal>
					</div>

					{/* Right bento grid */}
					<div className="lg:col-span-7 grid grid-cols-2 gap-4">
						{/* Large card */}
						<ScrollReveal delay={200}>
							<div className="col-span-2 p-8 rounded-2xl glass">
								<div className="flex items-center gap-4 mb-6">
									<AuditWolfLogo size={40} />
									<div>
										<h3 className="text-lg font-semibold text-foreground">
											Audit Wolf Platform
										</h3>
										<p className="text-sm text-muted-foreground">
											Trusted by security teams
										</p>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-6">
									<div>
										<div className="text-2xl font-bold text-foreground mb-1">
											99.9%
										</div>
										<div className="text-sm text-muted-foreground">
											Accuracy Rate
										</div>
									</div>
									<div>
										<div className="text-2xl font-bold text-foreground mb-1">
											&lt;2min
										</div>
										<div className="text-sm text-muted-foreground">
											Average Analysis
										</div>
									</div>
								</div>
							</div>
						</ScrollReveal>

						{/* Small cards */}
						<ScrollReveal delay={300}>
							<div className="p-6 rounded-2xl glass">
								<Clock className="h-8 w-8 text-blue-600 mb-4" />
								<h4 className="font-semibold text-foreground mb-2">
									Real-time
								</h4>
								<p className="text-sm text-muted-foreground">
									Instant vulnerability detection
								</p>
							</div>
						</ScrollReveal>

						<ScrollReveal delay={400}>
							<div className="p-6 rounded-2xl glass">
								<Award className="h-8 w-8 text-purple-600 mb-4" />
								<h4 className="font-semibold text-foreground mb-2">
									Certified
								</h4>
								<p className="text-sm text-muted-foreground">
									Industry-leading accuracy
								</p>
							</div>
						</ScrollReveal>

						<ScrollReveal delay={500}>
							<div className="p-6 rounded-2xl glass">
								<Users className="h-8 w-8 text-green-600 mb-4" />
								<h4 className="font-semibold text-foreground mb-2">
									Team-first
								</h4>
								<p className="text-sm text-muted-foreground">
									Built for collaboration
								</p>
							</div>
						</ScrollReveal>

						<ScrollReveal delay={600}>
							<div className="p-6 rounded-2xl glass">
								<Zap className="h-8 w-8 text-yellow-600 mb-4" />
								<h4 className="font-semibold text-foreground mb-2">Fast</h4>
								<p className="text-sm text-muted-foreground">
									Results in minutes
								</p>
							</div>
						</ScrollReveal>
					</div>
				</div>
			</Container>
		</section>
	);
}
