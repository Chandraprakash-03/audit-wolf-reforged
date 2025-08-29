"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/features/auth/LogoutButton";

export default function Home() {
	const { user, loading } = useAuth();

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
					<p>Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
			{/* Header */}
			<header className="bg-white shadow-sm">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center py-6">
						<div className="flex items-center">
							<h1 className="text-2xl font-bold text-gray-900">
								🐺 Audit Wolf
							</h1>
						</div>
						<div className="flex items-center space-x-4">
							{user ? (
								<>
									<span className="text-gray-700">
										Welcome, {user.name || user.email}
									</span>
									<Button asChild>
										<Link href="/dashboard">Dashboard</Link>
									</Button>
									<LogoutButton />
								</>
							) : (
								<>
									<Button variant="outline" asChild>
										<Link href="/auth/login">Sign In</Link>
									</Button>
									<Button asChild>
										<Link href="/auth/register">Get Started</Link>
									</Button>
								</>
							)}
						</div>
					</div>
				</div>
			</header>

			{/* Hero Section */}
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
				<div className="text-center">
					<h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
						Smart Contract
						<span className="text-blue-600"> Security Auditing</span>
					</h1>
					<p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
						Professional smart contract security auditing platform powered by AI
						and static analysis. Identify vulnerabilities, optimize gas usage,
						and ensure your contracts are secure.
					</p>

					{user ? (
						<div className="space-x-4">
							<Button size="lg" asChild>
								<Link href="/dashboard">Go to Dashboard</Link>
							</Button>
							<Button size="lg" variant="outline" disabled>
								Upload Contract
							</Button>
						</div>
					) : (
						<div className="space-x-4">
							<Button size="lg" asChild>
								<Link href="/auth/register">Start Free Audit</Link>
							</Button>
							<Button size="lg" variant="outline" asChild>
								<Link href="/auth/login">Sign In</Link>
							</Button>
						</div>
					)}
				</div>

				{/* Features */}
				<div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
					<div className="bg-white p-6 rounded-lg shadow-md">
						<div className="text-blue-600 text-2xl mb-4">🔍</div>
						<h3 className="text-xl font-semibold mb-2">Static Analysis</h3>
						<p className="text-gray-600">
							Advanced static analysis using Slither to detect common
							vulnerabilities and security issues.
						</p>
					</div>

					<div className="bg-white p-6 rounded-lg shadow-md">
						<div className="text-blue-600 text-2xl mb-4">🤖</div>
						<h3 className="text-xl font-semibold mb-2">AI-Powered Analysis</h3>
						<p className="text-gray-600">
							Multiple AI models analyze your contracts for complex security
							patterns and vulnerabilities.
						</p>
					</div>

					<div className="bg-white p-6 rounded-lg shadow-md">
						<div className="text-blue-600 text-2xl mb-4">📊</div>
						<h3 className="text-xl font-semibold mb-2">Detailed Reports</h3>
						<p className="text-gray-600">
							Comprehensive audit reports with severity ratings, remediation
							suggestions, and gas optimization tips.
						</p>
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className="bg-white border-t">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					<div className="text-center text-gray-600">
						<p>
							&copy; 2024 Audit Wolf. Professional smart contract security
							auditing.
						</p>
					</div>
				</div>
			</footer>
		</div>
	);
}
