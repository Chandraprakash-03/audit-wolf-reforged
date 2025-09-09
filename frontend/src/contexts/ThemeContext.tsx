"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	actualTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setTheme] = useState<Theme>("system");
	const [actualTheme, setActualTheme] = useState<"light" | "dark">("light");

	useEffect(() => {
		// Load theme from localStorage on mount
		const savedTheme = localStorage.getItem("theme") as Theme;
		if (savedTheme) {
			setTheme(savedTheme);
		}
	}, []);

	useEffect(() => {
		// Save theme to localStorage
		localStorage.setItem("theme", theme);

		// Determine actual theme
		let resolvedTheme: "light" | "dark";

		if (theme === "system") {
			resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light";
		} else {
			resolvedTheme = theme;
		}

		setActualTheme(resolvedTheme);

		// Apply theme to document
		const root = document.documentElement;
		root.classList.remove("light", "dark");
		root.classList.add(resolvedTheme);
	}, [theme]);

	useEffect(() => {
		// Listen for system theme changes
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

		const handleChange = () => {
			if (theme === "system") {
				const newTheme = mediaQuery.matches ? "dark" : "light";
				setActualTheme(newTheme);

				const root = document.documentElement;
				root.classList.remove("light", "dark");
				root.classList.add(newTheme);
			}
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [theme]);

	return (
		<ThemeContext.Provider value={{ theme, setTheme, actualTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (context === undefined) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
