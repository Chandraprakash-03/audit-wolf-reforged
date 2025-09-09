"use client";

import { useAuth } from "@/hooks/useAuth";

export function DebugAuth() {
	const { user, session, loading } = useAuth();

	if (process.env.NODE_ENV === "production") return null;

	return (
		<div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg text-xs z-50">
			<div>Auth Debug:</div>
			<div>Loading: {loading ? "Yes" : "No"}</div>
			<div>User: {user ? user.email : "None"}</div>
			<div>Session: {session ? "Exists" : "None"}</div>
		</div>
	);
}
