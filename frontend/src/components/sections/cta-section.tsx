"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface CTASectionProps {
	user: any;
}

export function CTASection({ user }: CTASectionProps) {
	if (user) return null;

	return (
		<section className="py-24 md:py-32">
			<Container>
				<ScrollReveal>
					<div className="max-w-3xl mx-auto text-center">
						<h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-foreground">
							Ready to secure your smart contracts?
						</h2>
						<p className="text-xl text-muted-foreground mb-12 leading-relaxed">
							Join thousands of developers who trust Audit Wolf for their smart
							contract security. Get started with your first audit in minutes.
						</p>

						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<Button
								size="lg"
								asChild
								className="h-12 px-8 text-base font-medium bg-foreground text-background hover:bg-foreground/90 transition-all duration-200"
							>
								<Link href="/auth/register" className="flex items-center gap-2">
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
						</div>

						{/* <p className="text-sm text-muted-foreground mt-8">
							No credit card required • Free tier available • Enterprise support
						</p> */}
					</div>
				</ScrollReveal>
			</Container>
		</section>
	);
}
