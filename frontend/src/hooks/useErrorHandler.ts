"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import * as Sentry from "@sentry/nextjs";

interface ApiError {
	response?: {
		status: number;
		data?: {
			error?: {
				message?: string;
				code?: string;
				requestId?: string;
				details?: any;
			};
		};
	};
	message?: string;
	code?: string;
}

interface ErrorHandlerOptions {
	showToast?: boolean;
	logToSentry?: boolean;
	fallbackMessage?: string;
	onError?: (error: any) => void;
}

export function useErrorHandler() {
	const toast = useToast();

	const handleError = useCallback(
		(error: any, options: ErrorHandlerOptions = {}) => {
			const {
				showToast = true,
				logToSentry = true,
				fallbackMessage = "An unexpected error occurred",
				onError,
			} = options;

			// Extract error information
			const apiError = error as ApiError;
			const errorMessage =
				apiError.response?.data?.error?.message ||
				apiError.message ||
				fallbackMessage;

			const errorCode = apiError.response?.data?.error?.code || apiError.code;

			const requestId = apiError.response?.data?.error?.requestId;
			const statusCode = apiError.response?.status;

			// Log to Sentry if enabled
			if (logToSentry) {
				Sentry.withScope((scope) => {
					scope.setTag("errorHandler", true);
					scope.setLevel("error");

					if (errorCode) scope.setTag("errorCode", errorCode);
					if (statusCode) scope.setTag("statusCode", statusCode.toString());
					if (requestId) scope.setTag("requestId", requestId);

					scope.setContext("errorDetails", {
						message: errorMessage,
						code: errorCode,
						statusCode,
						requestId,
						originalError: error,
					});

					Sentry.captureException(error);
				});
			}

			// Show toast notification if enabled
			if (showToast) {
				handleErrorToast(error, errorMessage, errorCode, requestId);
			}

			// Call custom error handler
			onError?.(error);

			// Log to console in development
			if (process.env.NODE_ENV === "development") {
				console.error("Error handled:", {
					message: errorMessage,
					code: errorCode,
					statusCode,
					requestId,
					error,
				});
			}
		},
		[toast]
	);

	const handleErrorToast = useCallback(
		(error: any, message: string, code?: string, requestId?: string) => {
			const apiError = error as ApiError;
			const statusCode = apiError.response?.status;

			// Handle different types of errors with appropriate toast types and actions
			switch (code) {
				case "UNAUTHORIZED":
				case "TOKEN_EXPIRED":
					toast.authError(message);
					break;

				case "FORBIDDEN":
				case "INSUFFICIENT_PERMISSIONS":
					toast.permissionError(message);
					break;

				case "VALIDATION_ERROR":
					const validationDetails = apiError.response?.data?.error?.details;
					if (validationDetails?.fields) {
						toast.validationError(validationDetails.fields);
					} else {
						toast.error("Validation Error", message);
					}
					break;

				case "RATE_LIMIT_EXCEEDED":
					toast.error("Rate Limit Exceeded", message, {
						label: "Learn More",
						onClick: () => window.open("/docs/rate-limits", "_blank"),
					});
					break;

				case "QUOTA_EXCEEDED":
					toast.error("Quota Exceeded", message, {
						label: "Upgrade Plan",
						onClick: () => window.open("/pricing", "_blank"),
					});
					break;

				case "NOT_FOUND":
					toast.warning("Not Found", message);
					break;

				case "ANALYSIS_FAILED":
				case "SLITHER_ERROR":
				case "COMPILATION_ERROR":
					toast.error("Analysis Failed", message, {
						label: "View Docs",
						onClick: () => window.open("/docs/troubleshooting", "_blank"),
					});
					break;

				case "FILE_TOO_LARGE":
					toast.error("File Too Large", message);
					break;

				case "EXTERNAL_SERVICE_ERROR":
				case "SERVICE_UNAVAILABLE":
					toast.error("Service Unavailable", message, {
						label: "Status Page",
						onClick: () => window.open("/status", "_blank"),
					});
					break;

				default:
					// Handle by status code if no specific error code
					if (statusCode) {
						handleStatusCodeError(statusCode, message, requestId);
					} else {
						// Generic error
						toast.error(
							"Error",
							message + (requestId ? ` (ID: ${requestId})` : "")
						);
					}
					break;
			}
		},
		[toast]
	);

	const handleStatusCodeError = useCallback(
		(statusCode: number, message: string, requestId?: string) => {
			const messageWithId = message + (requestId ? ` (ID: ${requestId})` : "");

			if (statusCode >= 500) {
				// Server errors
				toast.error("Server Error", messageWithId, {
					label: "Report Issue",
					onClick: () => {
						const subject = encodeURIComponent(
							`Server Error Report - ${statusCode}`
						);
						const body = encodeURIComponent(
							`Error: ${message}\nRequest ID: ${requestId}\nStatus: ${statusCode}\nURL: ${
								window.location.href
							}\nTime: ${new Date().toISOString()}`
						);
						window.open(
							`mailto:support@audit-wolf.com?subject=${subject}&body=${body}`
						);
					},
				});
			} else if (statusCode >= 400) {
				// Client errors
				if (statusCode === 401) {
					toast.authError(message);
				} else if (statusCode === 403) {
					toast.permissionError(message);
				} else if (statusCode === 404) {
					toast.warning("Not Found", messageWithId);
				} else if (statusCode === 429) {
					toast.warning("Too Many Requests", messageWithId);
				} else {
					toast.error("Request Failed", messageWithId);
				}
			} else {
				// Other status codes
				toast.info("Notice", messageWithId);
			}
		},
		[toast]
	);

	// Network error handler
	const handleNetworkError = useCallback(
		(error: any) => {
			if (
				error.message?.includes("NetworkError") ||
				error.message?.includes("Failed to fetch") ||
				error.code === "NETWORK_ERROR"
			) {
				toast.networkError(error);

				if (process.env.NODE_ENV !== "development") {
					Sentry.captureException(error, {
						tags: { errorType: "network" },
					});
				}
			} else {
				handleError(error);
			}
		},
		[handleError, toast]
	);

	// Async operation wrapper with error handling
	const withErrorHandling = useCallback(
		async <T>(
			operation: () => Promise<T>,
			options: ErrorHandlerOptions & {
				loadingMessage?: string;
				successMessage?: string | ((result: T) => string);
			} = {}
		): Promise<T | null> => {
			const { loadingMessage, successMessage, ...errorOptions } = options;

			try {
				if (loadingMessage) {
					return await toast.promise(operation(), {
						loading: loadingMessage,
						success: successMessage || "Operation completed successfully",
						error: errorOptions.fallbackMessage || "Operation failed",
					});
				} else {
					const result = await operation();

					if (successMessage) {
						const message =
							typeof successMessage === "function"
								? successMessage(result)
								: successMessage;
						toast.success("Success", message);
					}

					return result;
				}
			} catch (error) {
				handleError(error, errorOptions);
				return null;
			}
		},
		[handleError, toast]
	);

	// Retry wrapper with exponential backoff
	const withRetry = useCallback(
		async <T>(
			operation: () => Promise<T>,
			options: {
				maxRetries?: number;
				baseDelay?: number;
				maxDelay?: number;
				shouldRetry?: (error: any, attempt: number) => boolean;
			} = {}
		): Promise<T> => {
			const {
				maxRetries = 3,
				baseDelay = 1000,
				maxDelay = 10000,
				shouldRetry = (error, attempt) => {
					// Retry on network errors and 5xx status codes
					const statusCode = error?.response?.status;
					return (
						attempt < maxRetries &&
						(error.code === "NETWORK_ERROR" ||
							error.message?.includes("NetworkError") ||
							error.message?.includes("Failed to fetch") ||
							(statusCode && statusCode >= 500))
					);
				},
			} = options;

			let lastError: any;

			for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
				try {
					return await operation();
				} catch (error) {
					lastError = error;

					if (attempt <= maxRetries && shouldRetry(error, attempt)) {
						const delay = Math.min(
							baseDelay * Math.pow(2, attempt - 1),
							maxDelay
						);

						toast.info(
							"Retrying...",
							`Attempt ${attempt} failed. Retrying in ${delay / 1000}s...`,
							delay + 1000
						);

						await new Promise((resolve) => setTimeout(resolve, delay));
						continue;
					}

					throw error;
				}
			}

			throw lastError;
		},
		[toast]
	);

	return {
		handleError,
		handleNetworkError,
		withErrorHandling,
		withRetry,
	};
}
