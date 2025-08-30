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
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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
