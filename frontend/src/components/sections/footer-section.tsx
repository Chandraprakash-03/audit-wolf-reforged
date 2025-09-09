"use client";

import { AuditWolfLogo } from "@/components/ui/audit-wolf-logo";
import { Container } from "@/components/ui/container";

export function FooterSection() {
	return (
		<footer className="border-t border-border/50 bg-background">
			<Container className="py-12">
				<div className="flex flex-col md:flex-row items-center justify-between gap-6">
					{/* Logo and brand */}
					<div className="flex items-center gap-3">
						<AuditWolfLogo size={24} />
						<div>
							<div className="font-semibold text-foreground">Audit Wolf</div>
							<div className="text-sm text-muted-foreground">
								Smart Contract Security
							</div>
						</div>
					</div>

					{/* Copyright */}
					<div className="text-center md:text-right">
						<p className="text-sm text-muted-foreground">
							© 2025 Audit Wolf. All rights reserved.
						</p>
					</div>
				</div>
			</Container>
		</footer>
	);
}
