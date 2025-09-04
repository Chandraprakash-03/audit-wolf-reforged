"use client";

import { useSearchParams } from "next/navigation";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function VerifyEmailPage() {
	const searchParams = useSearchParams();
	const redirectTo = searchParams.get("redirectTo");

	// Create login URL with redirect parameter if it exists
	const loginUrl = redirectTo
		? `/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`
		: "/auth/login";
	return (
		<div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
			<Card className="w-full max-w-md mx-auto">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
					<CardDescription>
						We've sent you a verification link to complete your registration.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="text-center space-y-4">
						<div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
							<svg
								className="w-8 h-8 text-primary"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
								/>
							</svg>
						</div>

						<div className="space-y-2">
							<p className="text-sm text-muted-foreground">
								Please check your email and click the verification link to
								activate your account.
							</p>
							<p className="text-xs text-muted-foreground/80">
								Don't see the email? Check your spam folder or try again.
							</p>
						</div>

						<div className="space-y-2">
							<Button asChild className="w-full">
								<Link href={loginUrl}>Back to Login</Link>
							</Button>

							<Button variant="outline" asChild className="w-full">
								<Link href="/">Go to Homepage</Link>
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
