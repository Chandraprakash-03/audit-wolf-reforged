"use client";

import { useAuth } from "@/hooks/useAuth";
import { Navigation } from "@/components/ui/navigation";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroSection } from "@/components/sections/hero-section";
import { FeaturesSection } from "@/components/sections/features-section";
import { BenefitsSection } from "@/components/sections/benefits-section";
import { CTASection } from "@/components/sections/cta-section";
import { FooterSection } from "@/components/sections/footer-section";

export default function Home() {
	const { user, loading } = useAuth();

	if (loading) {
		return (
			<div className="min-h-screen bg-background">
				<Navigation />
				<Container className="py-16">
					<div className="text-center space-y-8">
						<div className="space-y-4">
							<Skeleton className="h-16 w-3/4 mx-auto" />
							<Skeleton className="h-6 w-2/3 mx-auto" />
						</div>
						<div className="flex justify-center space-x-4">
							<Skeleton className="h-12 w-32" />
							<Skeleton className="h-12 w-32" />
						</div>
					</div>
				</Container>
			</div>
		);
	}

	return (
		<main className="bg-background">
			<Navigation />
			<HeroSection user={user} />
			<FeaturesSection />
			<BenefitsSection />
			<CTASection user={user} />
			<FooterSection />
		</main>
	);
}
