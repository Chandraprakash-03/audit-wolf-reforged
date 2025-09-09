/**
 * API utility functions for making requests to the backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Get the authorization header with the current token
 */
function getAuthHeaders(): Record<string, string> {
	const token = localStorage.getItem("token");
	return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Make an authenticated API request
 */
export async function apiRequest(
	endpoint: string,
	options: RequestInit = {}
): Promise<Response> {
	const url = `${API_BASE_URL}${endpoint}`;

	const defaultHeaders = {
		"Content-Type": "application/json",
		...getAuthHeaders(),
	};

	const config: RequestInit = {
		...options,
		headers: {
			...defaultHeaders,
			...options.headers,
		},
	};

	return fetch(url, config);
}

/**
 * Make a GET request
 */
export async function apiGet(endpoint: string): Promise<Response> {
	return apiRequest(endpoint, { method: "GET" });
}

/**
 * Make a POST request
 */
export async function apiPost(
	endpoint: string,
	data?: any,
	options: RequestInit = {}
): Promise<Response> {
	return apiRequest(endpoint, {
		method: "POST",
		body: data ? JSON.stringify(data) : undefined,
		...options,
	});
}

/**
 * Make a PUT request
 */
export async function apiPut(
	endpoint: string,
	data?: any,
	options: RequestInit = {}
): Promise<Response> {
	return apiRequest(endpoint, {
		method: "PUT",
		body: data ? JSON.stringify(data) : undefined,
		...options,
	});
}

/**
 * Make a DELETE request
 */
export async function apiDelete(endpoint: string): Promise<Response> {
	return apiRequest(endpoint, { method: "DELETE" });
}

/**
 * Handle API response and extract JSON data
 */
export async function handleApiResponse<T = any>(
	response: Response
): Promise<T> {
	if (!response.ok) {
		const errorData = await response
			.json()
			.catch(() => ({ error: "Unknown error" }));
		throw new Error(
			errorData.error || `HTTP ${response.status}: ${response.statusText}`
		);
	}

	return response.json();
}

/**
 * Make an API request and handle the response
 */
export async function apiCall<T = any>(
	endpoint: string,
	options: RequestInit = {}
): Promise<T> {
	const response = await apiRequest(endpoint, options);
	return handleApiResponse<T>(response);
}
