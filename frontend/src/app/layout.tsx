import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/components/ui/toast";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Audit Wolf - Smart Contract Security Auditing",
	description:
		"Professional smart contract security auditing platform powered by AI and static analysis",
	viewport: "width=device-width, initial-scale=1",
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "white" },
		{ media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
	],
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script
					dangerouslySetInnerHTML={{
						__html: `
							(function() {
								try {
									const theme = localStorage.getItem('theme') || 'system';
									let resolvedTheme = theme;
									
									if (theme === 'system') {
										resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
									}
									
									document.documentElement.classList.add(resolvedTheme);
								} catch (e) {
									document.documentElement.classList.add('light');
								}
							})();
						`,
					}}
				/>
			</head>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
			>
				<ErrorBoundary>
					<ThemeProvider>
						<ToastProvider>
							<AuthProvider>{children}</AuthProvider>
						</ToastProvider>
					</ThemeProvider>
				</ErrorBoundary>
			</body>
		</html>
	);
}
