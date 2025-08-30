import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

// Mock localStorage
const localStorageMock = {
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
	clear: jest.fn(),
};
Object.defineProperty(window, "localStorage", {
	value: localStorageMock,
});

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: jest.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: jest.fn(),
		removeListener: jest.fn(),
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		dispatchEvent: jest.fn(),
	})),
});

// Test component that uses the theme
function TestComponent() {
	const { theme, setTheme, actualTheme } = useTheme();

	return (
		<div>
			<span data-testid="current-theme">{theme}</span>
			<span data-testid="actual-theme">{actualTheme}</span>
			<button onClick={() => setTheme("light")} data-testid="light-button">
				Light
			</button>
			<button onClick={() => setTheme("dark")} data-testid="dark-button">
				Dark
			</button>
			<button onClick={() => setTheme("system")} data-testid="system-button">
				System
			</button>
		</div>
	);
}

describe("ThemeProvider", () => {
	beforeEach(() => {
		localStorageMock.getItem.mockClear();
		localStorageMock.setItem.mockClear();
		document.documentElement.className = "";
	});

	it("should render with default system theme", () => {
		render(
			<ThemeProvider>
				<TestComponent />
			</ThemeProvider>
		);

		expect(screen.getByTestId("current-theme")).toHaveTextContent("system");
	});

	it("should load theme from localStorage", () => {
		localStorageMock.getItem.mockReturnValue("dark");

		render(
			<ThemeProvider>
				<TestComponent />
			</ThemeProvider>
		);

		expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
	});

	it("should save theme to localStorage when changed", async () => {
		render(
			<ThemeProvider>
				<TestComponent />
			</ThemeProvider>
		);

		fireEvent.click(screen.getByTestId("light-button"));

		await waitFor(() => {
			expect(localStorageMock.setItem).toHaveBeenCalledWith("theme", "light");
		});
	});

	it("should apply theme class to document element", async () => {
		render(
			<ThemeProvider>
				<TestComponent />
			</ThemeProvider>
		);

		fireEvent.click(screen.getByTestId("dark-button"));

		await waitFor(() => {
			expect(document.documentElement.classList.contains("dark")).toBe(true);
		});
	});

	it("should cycle through themes correctly", async () => {
		render(
			<ThemeProvider>
				<TestComponent />
			</ThemeProvider>
		);

		// Start with system
		expect(screen.getByTestId("current-theme")).toHaveTextContent("system");

		// Change to light
		fireEvent.click(screen.getByTestId("light-button"));
		await waitFor(() => {
			expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
		});

		// Change to dark
		fireEvent.click(screen.getByTestId("dark-button"));
		await waitFor(() => {
			expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
		});

		// Back to system
		fireEvent.click(screen.getByTestId("system-button"));
		await waitFor(() => {
			expect(screen.getByTestId("current-theme")).toHaveTextContent("system");
		});
	});

	it("should throw error when used outside provider", () => {
		// Suppress console.error for this test
		const consoleSpy = jest
			.spyOn(console, "error")
			.mockImplementation(() => {});

		expect(() => {
			render(<TestComponent />);
		}).toThrow("useTheme must be used within a ThemeProvider");

		consoleSpy.mockRestore();
	});
});
