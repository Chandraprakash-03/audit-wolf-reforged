"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Bug, Home, Mail } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Container } from "./container";
import * as Sentry from "@sentry/nextjs";

interface ErrorBoundaryState {
	hasError: boolean;
	error?: Error;
	errorId?: string;
	errorInfo?: any;
}

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
	onError?: (error: Error, errorInfo: any) => void;
	level?: "page" | "component" | "global";
	resetKeys?: Array<string | number>;
	resetOnPropsChange?: boolean;
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	private resetTimeoutId: number | null = null;

	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		// Generate unique error ID for tracking
		const errorId = `error_${Date.now()}_${Math.random()
			.toString(36)
			.substr(2, 9)}`;

		return {
			hasError: true,
			error,
			errorId,
		};
	}

	componentDidCatch(error: Error, errorInfo: any) {
		console.error("Error caught by boundary:", error, errorInfo);

		// Store error info in state
		this.setState({ errorInfo });

		// Report to Sentry with context
		Sentry.withScope((scope) => {
			scope.setTag("errorBoundary", true);
			scope.setTag("level", this.props.level || "component");
			scope.setContext("errorInfo", errorInfo);
			scope.setContext("props", {
				level: this.props.level,
				resetKeys: this.props.resetKeys,
			});

			if (this.state.errorId) {
				scope.setTag("errorId", this.state.errorId);
			}

			Sentry.captureException(error);
		});

		// Call custom error handler
		this.props.onError?.(error, errorInfo);

		// Auto-retry for component-level errors after 5 seconds
		if (this.props.level === "component") {
			this.resetTimeoutId = window.setTimeout(() => {
				this.handleReset();
			}, 5000);
		}
	}

	componentDidUpdate(prevProps: ErrorBoundaryProps) {
		const { resetKeys, resetOnPropsChange } = this.props;
		const { hasError } = this.state;

		// Reset error state if resetKeys changed
		if (hasError && resetKeys && prevProps.resetKeys) {
			const hasResetKeyChanged = resetKeys.some(
				(key, index) => key !== prevProps.resetKeys![index]
			);

			if (hasResetKeyChanged) {
				this.handleReset();
			}
		}

		// Reset on any prop change if enabled
		if (hasError && resetOnPropsChange && prevProps !== this.props) {
			this.handleReset();
		}
	}

	componentWillUnmount() {
		if (this.resetTimeoutId) {
			clearTimeout(this.resetTimeoutId);
		}
	}

	handleReset = () => {
		if (this.resetTimeoutId) {
			clearTimeout(this.resetTimeoutId);
			this.resetTimeoutId = null;
		}

		this.setState({
			hasError: false,
			error: undefined,
			errorId: undefined,
			errorInfo: undefined,
		});
	};

	handleReportBug = () => {
		const { error, errorId, errorInfo } = this.state;

		// Create bug report data
		const bugReport = {
			errorId,
			message: error?.message,
			stack: error?.stack,
			userAgent: navigator.userAgent,
			url: window.location.href,
			timestamp: new Date().toISOString(),
			componentStack: errorInfo?.componentStack,
		};

		// Copy to clipboard
		navigator.clipboard.writeText(JSON.stringify(bugReport, null, 2));

		// Open email client with pre-filled bug report
		const subject = encodeURIComponent(
			`Bug Report: ${error?.message || "Unknown Error"}`
		);
		const body = encodeURIComponent(
			`Error ID: ${errorId}\n\n` +
				`Please describe what you were doing when this error occurred:\n\n\n\n` +
				`Technical Details:\n${JSON.stringify(bugReport, null, 2)}`
		);

		window.open(
			`mailto:support@audit-wolf.com?subject=${subject}&body=${body}`
		);
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			const { error, errorId } = this.state;
			const isGlobalError = this.props.level === "global";
			const isPageError = this.props.level === "page";

			return (
				<div
					className={`${
						isGlobalError ? "min-h-screen" : "min-h-[400px]"
					} bg-background flex items-center justify-center p-4`}
				>
					<Container size="sm">
						<Card className="text-center">
							<CardHeader>
								<div className="flex justify-center mb-4">
									<div className="p-3 bg-destructive/10 rounded-full">
										<AlertTriangle className="h-8 w-8 text-destructive" />
									</div>
								</div>
								<CardTitle className="text-2xl text-foreground">
									{isGlobalError
										? "Application Error"
										: isPageError
										? "Page Error"
										: "Component Error"}
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<p className="text-muted-foreground">
									{isGlobalError
										? "We encountered a critical error. The application needs to be restarted."
										: isPageError
										? "This page encountered an error. Please try navigating to a different page or refresh."
										: "This component encountered an error. It will automatically retry in a few seconds."}
								</p>

								{errorId && (
									<div className="glass p-3 rounded-lg">
										<p className="text-sm text-muted-foreground">
											Error ID:{" "}
											<code className="font-mono text-xs">{errorId}</code>
										</p>
									</div>
								)}

								{process.env.NODE_ENV === "development" && error && (
									<details className="text-left glass p-4 rounded-lg">
										<summary className="cursor-pointer font-medium text-sm">
											Error Details (Development)
										</summary>
										<pre className="mt-2 text-xs overflow-auto max-h-40">
											{error.stack}
										</pre>
										{this.state.errorInfo?.componentStack && (
											<>
												<p className="mt-2 font-medium text-sm">
													Component Stack:
												</p>
												<pre className="mt-1 text-xs overflow-auto max-h-32">
													{this.state.errorInfo.componentStack}
												</pre>
											</>
										)}
									</details>
								)}

								<div className="flex flex-col sm:flex-row gap-3 justify-center">
									<Button
										onClick={this.handleReset}
										className="flex items-center space-x-2"
									>
										<RefreshCw className="h-4 w-4" />
										<span>Try Again</span>
									</Button>

									{isGlobalError && (
										<Button
											variant="outline"
											onClick={() => window.location.reload()}
										>
											Refresh Page
										</Button>
									)}

									{isPageError && (
										<Button
											variant="outline"
											onClick={() => (window.location.href = "/")}
											className="flex items-center space-x-2"
										>
											<Home className="h-4 w-4" />
											<span>Go Home</span>
										</Button>
									)}

									<Button
										variant="outline"
										onClick={this.handleReportBug}
										className="flex items-center space-x-2"
									>
										<Bug className="h-4 w-4" />
										<span>Report Bug</span>
									</Button>
								</div>

								{process.env.NODE_ENV === "production" && (
									<p className="text-xs text-muted-foreground">
										If this problem persists, please contact{" "}
										<a
											href="mailto:support@audit-wolf.com"
											className="underline hover:no-underline"
										>
											support@audit-wolf.com
										</a>{" "}
										with the error ID above.
									</p>
								)}
							</CardContent>
						</Card>
					</Container>
				</div>
			);
		}

		return this.props.children;
	}
}

// Hook version for functional components
export function useErrorBoundary() {
	return (error: Error) => {
		throw error;
	};
}
