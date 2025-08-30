"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Container } from "./container";

interface ErrorBoundaryState {
	hasError: boolean;
	error?: Error;
}

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
	onError?: (error: Error, errorInfo: any) => void;
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: any) {
		console.error("Error caught by boundary:", error, errorInfo);
		this.props.onError?.(error, errorInfo);
	}

	handleReset = () => {
		this.setState({ hasError: false, error: undefined });
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div className="min-h-screen bg-background flex items-center justify-center p-4">
					<Container size="sm">
						<Card className="text-center">
							<CardHeader>
								<div className="flex justify-center mb-4">
									<div className="p-3 bg-destructive/10 rounded-full">
										<AlertTriangle className="h-8 w-8 text-destructive" />
									</div>
								</div>
								<CardTitle className="text-2xl text-foreground">
									Something went wrong
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<p className="text-muted-foreground">
									We encountered an unexpected error. Please try refreshing the
									page or contact support if the problem persists.
								</p>

								{process.env.NODE_ENV === "development" && this.state.error && (
									<details className="text-left glass p-4 rounded-lg">
										<summary className="cursor-pointer font-medium text-sm">
											Error Details (Development)
										</summary>
										<pre className="mt-2 text-xs overflow-auto">
											{this.state.error.stack}
										</pre>
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
									<Button
										variant="outline"
										onClick={() => window.location.reload()}
									>
										Refresh Page
									</Button>
								</div>
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
