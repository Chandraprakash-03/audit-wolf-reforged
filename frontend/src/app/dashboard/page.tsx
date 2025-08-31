"use client";

import { useAuth } from "@/hooks/useAuth";
// import { AuthGuard } from "@/components/features/auth/AuthGuard";
import { AuditDashboard } from "@/components/features/audits/AuditDashboard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AuthGuard } from "@/components/features/auth";

export default function DashboardPage() {
	const { user, signOut } = useAuth();

	// Debug: Check if user is an error object
	console.log("Dashboard user:", user, typeof user);

	const handleSignOut = async () => {
		try {
			await signOut();
		} catch (error) {
			console.error("Sign out error:", error);
		}
	};

	return (
		<AuthGuard requireAuth={true}>
			<div className="min-h-screen bg-gray-50">
				<header className="bg-white shadow">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="flex justify-between items-center py-6">
							<div>
								<h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
								<p className="text-gray-600">
									Welcome back,{" "}
									{typeof user === "object" && user !== null && "name" in user
										? user.name || user.email || "User"
										: "User"}
								</p>
							</div>
							<div className="flex gap-2">
								<Link href="/upload">
									<Button>Upload Contract</Button>
								</Link>
								<Button onClick={handleSignOut} variant="outline">
									Sign Out
								</Button>
							</div>
						</div>
					</div>
				</header>

				<main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
					<div className="px-4 py-6 sm:px-0">
						<AuditDashboard />
					</div>
				</main>
			</div>
		</AuthGuard>
	);
}
