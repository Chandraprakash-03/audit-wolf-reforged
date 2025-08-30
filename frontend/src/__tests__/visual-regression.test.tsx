import { render } from "@testing-library/react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navigation } from "@/components/ui/navigation";
import { Modal } from "@/components/ui/modal";

// Mock Next.js router
jest.mock("next/navigation", () => ({
	usePathname: () => "/",
	useRouter: () => ({
		push: jest.fn(),
		replace: jest.fn(),
		back: jest.fn(),
	}),
}));

// Mock auth hook
jest.mock("@/hooks/useAuth", () => ({
	useAuth: () => ({
		user: null,
		loading: false,
		signOut: jest.fn(),
	}),
}));

describe("Visual Regression Tests", () => {
	const renderWithTheme = (
		component: React.ReactElement,
		theme: "light" | "dark" = "light"
	) => {
		// Set theme on document for testing
		document.documentElement.className = theme;

		return render(<ThemeProvider>{component}</ThemeProvider>);
	};

	describe("Button Component", () => {
		it("should render primary button correctly", () => {
			const { container } = renderWithTheme(<Button>Primary Button</Button>);
			expect(container.firstChild).toMatchSnapshot();
		});

		it("should render secondary button correctly", () => {
			const { container } = renderWithTheme(
				<Button variant="secondary">Secondary Button</Button>
			);
			expect(container.firstChild).toMatchSnapshot();
		});

		it("should render outline button correctly", () => {
			const { container } = renderWithTheme(
				<Button variant="outline">Outline Button</Button>
			);
			expect(container.firstChild).toMatchSnapshot();
		});

		it("should render disabled button correctly", () => {
			const { container } = renderWithTheme(
				<Button disabled>Disabled Button</Button>
			);
			expect(container.firstChild).toMatchSnapshot();
		});
	});

	describe("Card Component", () => {
		it("should render card with header and content", () => {
			const { container } = renderWithTheme(
				<Card>
					<CardHeader>
						<CardTitle>Card Title</CardTitle>
					</CardHeader>
					<CardContent>
						<p>Card content goes here</p>
					</CardContent>
				</Card>
			);
			expect(container.firstChild).toMatchSnapshot();
		});
	});

	describe("Navigation Component", () => {
		it("should render navigation in light theme", () => {
			const { container } = renderWithTheme(<Navigation />, "light");
			expect(container.firstChild).toMatchSnapshot();
		});

		it("should render navigation in dark theme", () => {
			const { container } = renderWithTheme(<Navigation />, "dark");
			expect(container.firstChild).toMatchSnapshot();
		});
	});

	describe("Modal Component", () => {
		it("should render modal correctly", () => {
			const { container } = renderWithTheme(
				<Modal
					isOpen={true}
					onClose={() => {}}
					title="Test Modal"
					description="This is a test modal"
				>
					<div>Modal content</div>
				</Modal>
			);
			expect(container.firstChild).toMatchSnapshot();
		});
	});

	describe("Theme Variations", () => {
		const TestComponent = () => (
			<div className="p-4 space-y-4">
				<h1 className="text-2xl font-bold text-foreground">Heading</h1>
				<p className="text-muted-foreground">Muted text</p>
				<Button>Primary Button</Button>
				<Button variant="outline">Outline Button</Button>
				<Card>
					<CardContent className="p-4">
						<p>Card content</p>
					</CardContent>
				</Card>
			</div>
		);

		it("should render components in light theme", () => {
			const { container } = renderWithTheme(<TestComponent />, "light");
			expect(container.firstChild).toMatchSnapshot();
		});

		it("should render components in dark theme", () => {
			const { container } = renderWithTheme(<TestComponent />, "dark");
			expect(container.firstChild).toMatchSnapshot();
		});
	});

	describe("Responsive Breakpoints", () => {
		it("should render mobile layout", () => {
			// Mock mobile viewport
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 375,
			});

			const { container } = renderWithTheme(
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					<Card>
						<CardContent className="p-4">Item 1</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">Item 2</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">Item 3</CardContent>
					</Card>
				</div>
			);
			expect(container.firstChild).toMatchSnapshot();
		});

		it("should render desktop layout", () => {
			// Mock desktop viewport
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 1024,
			});

			const { container } = renderWithTheme(
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					<Card>
						<CardContent className="p-4">Item 1</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">Item 2</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">Item 3</CardContent>
					</Card>
				</div>
			);
			expect(container.firstChild).toMatchSnapshot();
		});
	});
});
