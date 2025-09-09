"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PlatformManagementDashboard } from "@/components/features/admin/PlatformManagementDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navigation } from "@/components/ui/navigation";
import { PerformanceDashboard } from "@/components/PerformanceDashboard";

export default function AdminPage() {
	const { user, loading } = useAuth();
	const [isAdmin, setIsAdmin] = useState(false);

	useEffect(() => {
		// Check if user is admin (simplified check)
		if (user?.email?.includes("admin") || user?.role === "admin") {
			setIsAdmin(true);
		}
	}, [user]);

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-background">
				<div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
			</div>
		);
	}

	if (!user || !isAdmin) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-background">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-foreground mb-4">
						Access Denied
					</h1>
					<p className="text-muted-foreground">
						You don't have permission to access this page.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background">
			<Navigation />
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-foreground">
						Admin Dashboard
					</h1>
					<p className="text-muted-foreground mt-2">
						Manage blockchain platforms, monitor system health, and configure
						analysis tools.
					</p>
				</div>

				<Tabs defaultValue="platforms" className="space-y-6">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="platforms">Platform Management</TabsTrigger>
						<TabsTrigger value="performance">
							Performance Monitoring
						</TabsTrigger>
					</TabsList>

					<TabsContent value="platforms" className="space-y-6">
						<PlatformManagementDashboard />
					</TabsContent>

					<TabsContent value="performance" className="space-y-6">
						<PerformanceDashboard />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
