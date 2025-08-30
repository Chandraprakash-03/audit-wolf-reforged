"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Upload, BarChart3, User, LogOut } from "lucide-react";
import { Button } from "./button";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { AuditWolfLogo } from "./audit-wolf-logo";

interface NavigationProps {
	className?: string;
}

export function Navigation({ className }: NavigationProps) {
	const [isOpen, setIsOpen] = useState(false);
	const pathname = usePathname();
	const { user, signOut } = useAuth();

	const navigation = [
		{ name: "Dashboard", href: "/dashboard", icon: BarChart3 },
		{ name: "Upload Contract", href: "/upload", icon: Upload },
	];

	const isActive = (href: string) => pathname === href;

	const handleSignOut = async () => {
		await signOut();
		setIsOpen(false);
	};

	return (
		<nav className={cn("bg-background border-b border-border", className)}>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex justify-between h-16">
					{/* Logo and desktop navigation */}
					<div className="flex items-center">
						<Link
							href="/"
							className="flex items-center space-x-2 text-xl font-bold text-primary hover:text-primary/80 transition-colors"
						>
							<AuditWolfLogo size={24} />
							<span>Audit Wolf</span>
						</Link>

						{user && (
							<div className="hidden md:ml-8 md:flex md:space-x-1">
								{navigation.map((item) => {
									const Icon = item.icon;
									return (
										<Link
											key={item.name}
											href={item.href}
											className={cn(
												"flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
												isActive(item.href)
													? "bg-primary text-primary-foreground"
													: "text-muted-foreground hover:text-foreground hover:bg-accent"
											)}
										>
											<Icon className="h-4 w-4" />
											<span>{item.name}</span>
										</Link>
									);
								})}
							</div>
						)}
					</div>

					{/* Desktop user menu and theme toggle */}
					<div className="hidden md:flex md:items-center md:space-x-4">
						<ThemeToggle />

						{user ? (
							<div className="flex items-center space-x-4">
								<div className="flex items-center space-x-2 text-sm text-muted-foreground">
									<User className="h-4 w-4" />
									<span>{user.email}</span>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={handleSignOut}
									className="flex items-center space-x-2"
								>
									<LogOut className="h-4 w-4" />
									<span>Sign Out</span>
								</Button>
							</div>
						) : (
							<div className="flex items-center space-x-2">
								<Link href="/auth/login">
									<Button variant="ghost" size="sm">
										Sign In
									</Button>
								</Link>
								<Link href="/auth/register">
									<Button size="sm">Sign Up</Button>
								</Link>
							</div>
						)}
					</div>

					{/* Mobile menu button */}
					<div className="md:hidden flex items-center space-x-2">
						<ThemeToggle />
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setIsOpen(!isOpen)}
							aria-label="Toggle menu"
						>
							{isOpen ? (
								<X className="h-5 w-5" />
							) : (
								<Menu className="h-5 w-5" />
							)}
						</Button>
					</div>
				</div>
			</div>

			{/* Mobile menu */}
			{isOpen && (
				<div className="md:hidden border-t border-border bg-background/95 backdrop-blur-sm">
					<div className="px-2 pt-2 pb-3 space-y-1">
						{user ? (
							<>
								{navigation.map((item) => {
									const Icon = item.icon;
									return (
										<Link
											key={item.name}
											href={item.href}
											onClick={() => setIsOpen(false)}
											className={cn(
												"flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-all duration-200",
												isActive(item.href)
													? "bg-primary text-primary-foreground"
													: "text-muted-foreground hover:text-foreground hover:bg-accent"
											)}
										>
											<Icon className="h-5 w-5" />
											<span>{item.name}</span>
										</Link>
									);
								})}

								<div className="border-t border-border pt-3 mt-3">
									<div className="flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground">
										<User className="h-4 w-4" />
										<span>{user.email}</span>
									</div>
									<Button
										variant="ghost"
										onClick={handleSignOut}
										className="w-full justify-start space-x-2 px-3"
									>
										<LogOut className="h-4 w-4" />
										<span>Sign Out</span>
									</Button>
								</div>
							</>
						) : (
							<div className="space-y-2">
								<Link href="/auth/login" onClick={() => setIsOpen(false)}>
									<Button variant="ghost" className="w-full justify-start">
										Sign In
									</Button>
								</Link>
								<Link href="/auth/register" onClick={() => setIsOpen(false)}>
									<Button className="w-full">Sign Up</Button>
								</Link>
							</div>
						)}
					</div>
				</div>
			)}
		</nav>
	);
}
