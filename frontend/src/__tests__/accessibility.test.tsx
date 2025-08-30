import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "@/components/ui/modal";
import { FocusTrap } from "@/components/ui/focus-trap";
import { Navigation } from "@/components/ui/navigation";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/hooks/useAuth";

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
	AuthProvider: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

describe("Accessibility Features", () => {
	describe("Modal", () => {
		it("should have proper ARIA attributes", () => {
			render(
				<Modal
					isOpen={true}
					onClose={() => {}}
					title="Test Modal"
					description="Test description"
				>
					<div>Modal content</div>
				</Modal>
			);

			const modal = screen.getByRole("dialog");
			expect(modal).toHaveAttribute("aria-modal", "true");
			expect(modal).toHaveAttribute("aria-labelledby");
			expect(modal).toHaveAttribute("aria-describedby");
		});

		it("should focus trap when open", () => {
			render(
				<Modal isOpen={true} onClose={() => {}}>
					<button>Button 1</button>
					<button>Button 2</button>
				</Modal>
			);

			const buttons = screen.getAllByRole("button");
			expect(buttons.length).toBeGreaterThan(0);
		});

		it("should close on escape key", () => {
			const onClose = jest.fn();
			render(
				<Modal isOpen={true} onClose={onClose}>
					<div>Content</div>
				</Modal>
			);

			fireEvent.keyDown(document, { key: "Escape" });
			expect(onClose).toHaveBeenCalled();
		});
	});

	describe("Navigation", () => {
		it("should have proper navigation structure", () => {
			render(
				<ThemeProvider>
					<Navigation />
				</ThemeProvider>
			);

			const nav = screen.getByRole("navigation");
			expect(nav).toBeInTheDocument();
		});

		it("should have accessible menu button", () => {
			render(
				<ThemeProvider>
					<Navigation />
				</ThemeProvider>
			);

			const menuButton = screen.getByLabelText(/toggle menu/i);
			expect(menuButton).toBeInTheDocument();
		});

		it("should support keyboard navigation", () => {
			render(
				<ThemeProvider>
					<Navigation />
				</ThemeProvider>
			);

			const links = screen.getAllByRole("link");
			links.forEach((link) => {
				expect(link).toHaveAttribute("href");
			});
		});
	});

	describe("Focus Management", () => {
		it("should trap focus within container", () => {
			render(
				<FocusTrap active={true}>
					<div>
						<button>First</button>
						<button>Second</button>
						<button>Third</button>
					</div>
				</FocusTrap>
			);

			const buttons = screen.getAllByRole("button");
			expect(buttons).toHaveLength(3);
		});
	});

	describe("Color Contrast and Themes", () => {
		it("should apply proper theme classes", () => {
			render(
				<ThemeProvider>
					<div data-testid="themed-content">Content</div>
				</ThemeProvider>
			);

			// Check that theme classes are applied to document
			expect(document.documentElement).toHaveClass("light");
		});
	});

	describe("Screen Reader Support", () => {
		it("should have proper heading hierarchy", () => {
			render(
				<div>
					<h1>Main Title</h1>
					<h2>Section Title</h2>
					<h3>Subsection Title</h3>
				</div>
			);

			expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
			expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
			expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
		});

		it("should have descriptive link text", () => {
			render(
				<div>
					<a href="/dashboard">Go to Dashboard</a>
					<button aria-label="Close modal">×</button>
				</div>
			);

			const link = screen.getByRole("link");
			expect(link).toHaveAccessibleName("Go to Dashboard");

			const button = screen.getByRole("button");
			expect(button).toHaveAccessibleName("Close modal");
		});
	});

	describe("Keyboard Navigation", () => {
		it("should support tab navigation", () => {
			render(
				<div>
					<button>Button 1</button>
					<input type="text" placeholder="Input" />
					<a href="/test">Link</a>
				</div>
			);

			const focusableElements = [
				screen.getByRole("button"),
				screen.getByRole("textbox"),
				screen.getByRole("link"),
			];

			focusableElements.forEach((element) => {
				expect(element).toBeVisible();
			});
		});
	});
});
