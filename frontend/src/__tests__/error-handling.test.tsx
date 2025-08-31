import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ToastProvider } from "@/components/ui/toast";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import * as Sentry from "@sentry/nextjs";

// Mock Sentry
jest.mock("@sentry/nextjs", () => ({
	withScope: jest.fn((callback) =>
		callback({
			setTag: jest.fn(),
			setLevel: jest.fn(),
			setContext: jest.fn(),
		})
	),
	captureException: jest.fn(),
}));

// Mock component that throws an error
const ThrowError = ({ shouldThrow = false, errorMessage = "Test error" }) => {
	if (shouldThrow) {
		throw new Error(errorMessage);
	}
	return <div>No error</div>;
};

// Test component for useErrorHandler hook
const ErrorHandlerTest = ({ onError }: { onError?: (error: any) => void }) => {
	const { handleError, withErrorHandling } = useErrorHandler();

	const triggerError = () => {
		const error = new Error("Test error");
		handleError(error, { onError });
	};

	const triggerAsyncError = async () => {
		await withErrorHandling(
			async () => {
				throw new Error("Async test error");
			},
			{
				loadingMessage: "Processing...",
				successMessage: "Success!",
				onError,
			}
		);
	};

	return (
		<div>
			<button onClick={triggerError}>Trigger Error</button>
			<button onClick={triggerAsyncError}>Trigger Async Error</button>
		</div>
	);
};

describe("Error Handling", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Mock console.error to prevent test output pollution
		jest.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("ErrorBoundary", () => {
		it("should render children when there is no error", () => {
			render(
				<ErrorBoundary>
					<ThrowError shouldThrow={false} />
				</ErrorBoundary>
			);

			expect(screen.getByText("No error")).toBeInTheDocument();
		});

		it("should render error UI when child component throws", () => {
			render(
				<ErrorBoundary level="component">
					<ThrowError shouldThrow={true} errorMessage="Component crashed" />
				</ErrorBoundary>
			);

			expect(screen.getByText("Component Error")).toBeInTheDocument();
			expect(
				screen.getByText(/This component encountered an error/)
			).toBeInTheDocument();
		});

		it("should render global error UI for global level errors", () => {
			render(
				<ErrorBoundary level="global">
					<ThrowError shouldThrow={true} />
				</ErrorBoundary>
			);

			expect(screen.getByText("Application Error")).toBeInTheDocument();
			expect(
				screen.getByText(/We encountered a critical error/)
			).toBeInTheDocument();
		});

		it("should render page error UI for page level errors", () => {
			render(
				<ErrorBoundary level="page">
					<ThrowError shouldThrow={true} />
				</ErrorBoundary>
			);

			expect(screen.getByText("Page Error")).toBeInTheDocument();
			expect(
				screen.getByText(/This page encountered an error/)
			).toBeInTheDocument();
		});

		it("should call onError callback when error occurs", () => {
			const onError = jest.fn();

			render(
				<ErrorBoundary onError={onError}>
					<ThrowError shouldThrow={true} errorMessage="Callback test" />
				</ErrorBoundary>
			);

			expect(onError).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Callback test",
				}),
				expect.any(Object)
			);
		});

		it("should reset error state when Try Again is clicked", () => {
			const { rerender } = render(
				<ErrorBoundary>
					<ThrowError shouldThrow={true} />
				</ErrorBoundary>
			);

			expect(screen.getByText("Component Error")).toBeInTheDocument();

			fireEvent.click(screen.getByText("Try Again"));

			rerender(
				<ErrorBoundary>
					<ThrowError shouldThrow={false} />
				</ErrorBoundary>
			);

			expect(screen.getByText("No error")).toBeInTheDocument();
		});

		it("should show error ID in production-like environment", () => {
			render(
				<ErrorBoundary>
					<ThrowError shouldThrow={true} />
				</ErrorBoundary>
			);

			expect(screen.getByText(/Error ID:/)).toBeInTheDocument();
		});

		it("should report errors to Sentry", () => {
			render(
				<ErrorBoundary>
					<ThrowError shouldThrow={true} errorMessage="Sentry test" />
				</ErrorBoundary>
			);

			expect(Sentry.withScope).toHaveBeenCalled();
			expect(Sentry.captureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Sentry test",
				})
			);
		});

		it("should show different actions based on error level", () => {
			const { rerender } = render(
				<ErrorBoundary level="global">
					<ThrowError shouldThrow={true} />
				</ErrorBoundary>
			);

			expect(screen.getByText("Refresh Page")).toBeInTheDocument();

			rerender(
				<ErrorBoundary level="page">
					<ThrowError shouldThrow={true} />
				</ErrorBoundary>
			);

			expect(screen.getByText("Go Home")).toBeInTheDocument();
		});
	});

	describe("useErrorHandler Hook", () => {
		it("should handle errors and call onError callback", () => {
			const onError = jest.fn();

			render(
				<ToastProvider>
					<ErrorHandlerTest onError={onError} />
				</ToastProvider>
			);

			fireEvent.click(screen.getByText("Trigger Error"));

			expect(onError).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Test error",
				})
			);
		});

		it("should handle async errors with loading states", async () => {
			const onError = jest.fn();

			render(
				<ToastProvider>
					<ErrorHandlerTest onError={onError} />
				</ToastProvider>
			);

			fireEvent.click(screen.getByText("Trigger Async Error"));

			await waitFor(() => {
				expect(onError).toHaveBeenCalledWith(
					expect.objectContaining({
						message: "Async test error",
					})
				);
			});
		});

		it("should report errors to Sentry by default", () => {
			render(
				<ToastProvider>
					<ErrorHandlerTest />
				</ToastProvider>
			);

			fireEvent.click(screen.getByText("Trigger Error"));

			expect(Sentry.withScope).toHaveBeenCalled();
			expect(Sentry.captureException).toHaveBeenCalled();
		});
	});

	describe("Error Recovery", () => {
		it("should reset error boundary on prop changes when resetOnPropsChange is true", () => {
			let shouldThrow = true;

			const { rerender } = render(
				<ErrorBoundary resetOnPropsChange={true}>
					<ThrowError shouldThrow={shouldThrow} />
				</ErrorBoundary>
			);

			expect(screen.getByText("Component Error")).toBeInTheDocument();

			shouldThrow = false;
			rerender(
				<ErrorBoundary resetOnPropsChange={true}>
					<ThrowError shouldThrow={shouldThrow} />
				</ErrorBoundary>
			);

			expect(screen.getByText("No error")).toBeInTheDocument();
		});

		it("should reset error boundary when resetKeys change", () => {
			const { rerender } = render(
				<ErrorBoundary resetKeys={["key1"]}>
					<ThrowError shouldThrow={true} />
				</ErrorBoundary>
			);

			expect(screen.getByText("Component Error")).toBeInTheDocument();

			rerender(
				<ErrorBoundary resetKeys={["key2"]}>
					<ThrowError shouldThrow={false} />
				</ErrorBoundary>
			);

			expect(screen.getByText("No error")).toBeInTheDocument();
		});
	});

	describe("Error Types and Status Codes", () => {
		const TestErrorHandler = ({ error }: { error: any }) => {
			const { handleError } = useErrorHandler();

			const triggerError = () => {
				handleError(error, { showToast: false }); // Disable toast for testing
			};

			return <button onClick={triggerError}>Trigger Specific Error</button>;
		};

		it("should handle validation errors", () => {
			const validationError = {
				response: {
					status: 400,
					data: {
						error: {
							code: "VALIDATION_ERROR",
							message: "Validation failed",
							details: {
								fields: [
									{ field: "name", message: "Name is required" },
									{ field: "email", message: "Invalid email format" },
								],
							},
						},
					},
				},
			};

			render(
				<ToastProvider>
					<TestErrorHandler error={validationError} />
				</ToastProvider>
			);

			fireEvent.click(screen.getByText("Trigger Specific Error"));

			expect(Sentry.withScope).toHaveBeenCalled();
		});

		it("should handle authentication errors", () => {
			const authError = {
				response: {
					status: 401,
					data: {
						error: {
							code: "UNAUTHORIZED",
							message: "Authentication required",
						},
					},
				},
			};

			render(
				<ToastProvider>
					<TestErrorHandler error={authError} />
				</ToastProvider>
			);

			fireEvent.click(screen.getByText("Trigger Specific Error"));

			expect(Sentry.withScope).toHaveBeenCalled();
		});

		it("should handle rate limit errors", () => {
			const rateLimitError = {
				response: {
					status: 429,
					data: {
						error: {
							code: "RATE_LIMIT_EXCEEDED",
							message: "Too many requests",
						},
					},
				},
			};

			render(
				<ToastProvider>
					<TestErrorHandler error={rateLimitError} />
				</ToastProvider>
			);

			fireEvent.click(screen.getByText("Trigger Specific Error"));

			expect(Sentry.withScope).toHaveBeenCalled();
		});

		it("should handle server errors", () => {
			const serverError = {
				response: {
					status: 500,
					data: {
						error: {
							code: "INTERNAL_ERROR",
							message: "Internal server error",
							requestId: "req_123456",
						},
					},
				},
			};

			render(
				<ToastProvider>
					<TestErrorHandler error={serverError} />
				</ToastProvider>
			);

			fireEvent.click(screen.getByText("Trigger Specific Error"));

			expect(Sentry.withScope).toHaveBeenCalled();
		});
	});

	describe("Development vs Production Behavior", () => {
		it("should show stack trace in development", () => {
			const originalEnv = process.env;
			Object.defineProperty(process, "env", {
				value: { ...originalEnv, NODE_ENV: "development" },
				writable: true,
			});

			render(
				<ErrorBoundary>
					<ThrowError shouldThrow={true} />
				</ErrorBoundary>
			);

			expect(
				screen.getByText("Error Details (Development)")
			).toBeInTheDocument();

			Object.defineProperty(process, "env", {
				value: originalEnv,
				writable: true,
			});
		});

		it("should hide stack trace in production", () => {
			const originalEnv = process.env;
			Object.defineProperty(process, "env", {
				value: { ...originalEnv, NODE_ENV: "production" },
				writable: true,
			});

			render(
				<ErrorBoundary>
					<ThrowError shouldThrow={true} />
				</ErrorBoundary>
			);

			expect(
				screen.queryByText("Error Details (Development)")
			).not.toBeInTheDocument();

			Object.defineProperty(process, "env", {
				value: originalEnv,
				writable: true,
			});
		});
	});
});
