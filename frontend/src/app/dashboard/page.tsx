"use client";

import { useAuth } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/features/auth/AuthGuard";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
	const { user, signOut } = useAuth();

	const handleSignOut = async () => {
		try {
			await signOut();
		} catch (error) {
			console.error("Sign out error:", error);
		}
	};

	return (
		// <AuthGuard>
		<div className="min-h-screen bg-gray-50">
			<header className="bg-white shadow">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center py-6">
						<div>
							<h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
							<p className="text-gray-600">
								Welcome back, {user?.name || user?.email}
							</p>
						</div>
						<Button onClick={handleSignOut} variant="outline">
							Sign Out
						</Button>
					</div>
				</div>
			</header>

			<main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
				<div className="px-4 py-6 sm:px-0">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						<Card>
							<CardHeader>
								<CardTitle>Recent Audits</CardTitle>
								<CardDescription>
									Your latest smart contract audits
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-gray-500">
									No audits yet. Upload your first contract to get started!
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Security Score</CardTitle>
								<CardDescription>Overall security rating</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold text-green-600">N/A</div>
								<p className="text-sm text-gray-500">
									Complete an audit to see your score
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Quick Actions</CardTitle>
								<CardDescription>Get started with Audit Wolf</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2">
								<Button className="w-full" disabled>
									Upload Contract
								</Button>
								<Button variant="outline" className="w-full" disabled>
									View Reports
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</main>
		</div>
		// </AuthGuard>
	);
}
