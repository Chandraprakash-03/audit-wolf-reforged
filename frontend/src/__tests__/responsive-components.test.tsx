import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Container } from "@/components/ui/container";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { Breadcrumb } from "@/components/ui/breadcrumb";

describe("Container", () => {
	it("should render with default size", () => {
		render(
			<Container data-testid="container">
				<div>Content</div>
			</Container>
		);

		const container = screen.getByTestId("container");
		expect(container).toHaveClass("max-w-6xl");
	});

	it("should render with custom size", () => {
		render(
			<Container size="sm" data-testid="container">
				<div>Content</div>
			</Container>
		);

		const container = screen.getByTestId("container");
		expect(container).toHaveClass("max-w-2xl");
	});

	it("should apply custom className", () => {
		render(
			<Container className="custom-class" data-testid="container">
				<div>Content</div>
			</Container>
		);

		const container = screen.getByTestId("container");
		expect(container).toHaveClass("custom-class");
	});
});

describe("ResponsiveGrid", () => {
	it("should render with default grid classes", () => {
		render(
			<ResponsiveGrid data-testid="grid">
				<div>Item 1</div>
				<div>Item 2</div>
			</ResponsiveGrid>
		);

		const grid = screen.getByTestId("grid");
		expect(grid).toHaveClass("grid");
		expect(grid).toHaveClass("grid-cols-1");
		expect(grid).toHaveClass("md:grid-cols-2");
		expect(grid).toHaveClass("lg:grid-cols-3");
	});

	it("should render with custom column configuration", () => {
		render(
			<ResponsiveGrid cols={{ default: 2, lg: 4 }} data-testid="grid">
				<div>Item 1</div>
				<div>Item 2</div>
			</ResponsiveGrid>
		);

		const grid = screen.getByTestId("grid");
		expect(grid).toHaveClass("grid-cols-2");
		expect(grid).toHaveClass("lg:grid-cols-4");
	});

	it("should apply gap classes", () => {
		render(
			<ResponsiveGrid gap="lg" data-testid="grid">
				<div>Item 1</div>
			</ResponsiveGrid>
		);

		const grid = screen.getByTestId("grid");
		expect(grid).toHaveClass("gap-6");
	});
});

describe("Breadcrumb", () => {
	const mockItems = [
		{ label: "Dashboard", href: "/dashboard" },
		{ label: "Audits", href: "/audits" },
		{ label: "Current Audit" },
	];

	it("should render breadcrumb items", () => {
		render(<Breadcrumb items={mockItems} />);

		expect(screen.getByText("Home")).toBeInTheDocument();
		expect(screen.getByText("Dashboard")).toBeInTheDocument();
		expect(screen.getByText("Audits")).toBeInTheDocument();
		expect(screen.getByText("Current Audit")).toBeInTheDocument();
	});

	it("should render without home when showHome is false", () => {
		render(<Breadcrumb items={mockItems} showHome={false} />);

		expect(screen.queryByText("Home")).not.toBeInTheDocument();
		expect(screen.getByText("Dashboard")).toBeInTheDocument();
	});

	it("should render links for items with href", () => {
		render(<Breadcrumb items={mockItems} />);

		const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
		expect(dashboardLink).toHaveAttribute("href", "/dashboard");
	});

	it("should mark last item as current page", () => {
		render(<Breadcrumb items={mockItems} />);

		const currentItem = screen.getByText("Current Audit");
		expect(currentItem).toHaveAttribute("aria-current", "page");
	});
});
