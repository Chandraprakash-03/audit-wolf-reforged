"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "./button";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();

	const cycleTheme = () => {
		const themes = ["light", "dark", "system"] as const;
		const currentIndex = themes.indexOf(theme);
		const nextIndex = (currentIndex + 1) % themes.length;
		setTheme(themes[nextIndex]);
	};

	const getIcon = () => {
		switch (theme) {
			case "light":
				return <Sun className="h-4 w-4" />;
			case "dark":
				return <Moon className="h-4 w-4" />;
			case "system":
				return <Monitor className="h-4 w-4" />;
		}
	};

	const getLabel = () => {
		switch (theme) {
			case "light":
				return "Light mode";
			case "dark":
				return "Dark mode";
			case "system":
				return "System theme";
		}
	};

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={cycleTheme}
			aria-label={`Switch to ${
				theme === "light" ? "dark" : theme === "dark" ? "system" : "light"
			} mode`}
			title={getLabel()}
			className="transition-all duration-200 hover:scale-105"
		>
			{getIcon()}
			<span className="sr-only">{getLabel()}</span>
		</Button>
	);
}
