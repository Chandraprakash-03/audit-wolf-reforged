import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
	let res = NextResponse.next({
		request: {
			headers: req.headers,
		},
	});

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				get(name: string) {
					return req.cookies.get(name)?.value;
				},
				set(name: string, value: string, options: any) {
					req.cookies.set({
						name,
						value,
						...options,
					});
					res = NextResponse.next({
						request: {
							headers: req.headers,
						},
					});
					res.cookies.set({
						name,
						value,
						...options,
					});
				},
				remove(name: string, options: any) {
					req.cookies.set({
						name,
						value: "",
						...options,
					});
					res = NextResponse.next({
						request: {
							headers: req.headers,
						},
					});
					res.cookies.set({
						name,
						value: "",
						...options,
					});
				},
			},
		}
	);

	// Refresh session if expired - required for Server Components
	const {
		data: { session },
	} = await supabase.auth.getSession();

	// Define protected routes
	const protectedRoutes = ["/dashboard", "/audit", "/profile", "/settings"];
	const authRoutes = ["/auth/login", "/auth/register"];
	const callbackRoute = "/auth/callback";

	const isProtectedRoute = protectedRoutes.some((route) =>
		req.nextUrl.pathname.startsWith(route)
	);
	const isAuthRoute = authRoutes.some((route) =>
		req.nextUrl.pathname.startsWith(route)
	);
	const isCallbackRoute = req.nextUrl.pathname.startsWith(callbackRoute);

	// Allow callback route to handle auth verification
	if (isCallbackRoute) {
		return res;
	}

	// Redirect to login if accessing protected route without session
	if (isProtectedRoute && !session) {
		const redirectUrl = new URL("/auth/login", req.url);
		redirectUrl.searchParams.set("redirectTo", req.nextUrl.pathname);
		return NextResponse.redirect(redirectUrl);
	}

	// Redirect to dashboard if accessing auth routes with active session
	// But only if it's not already a redirect from login or has redirectTo param
	if (isAuthRoute && session && !req.nextUrl.searchParams.has("redirectTo")) {
		return NextResponse.redirect(new URL("/dashboard", req.url));
	}

	return res;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		"/((?!api|_next/static|_next/image|favicon.ico).*)",
	],
};
