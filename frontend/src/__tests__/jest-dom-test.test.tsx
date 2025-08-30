import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

describe("Jest DOM Matchers Test", () => {
	it("should have toHaveClass matcher working", () => {
		render(
			<div className="test-class" data-testid="test-element">
				Test
			</div>
		);

		const element = screen.getByTestId("test-element");
		expect(element).toHaveClass("test-class");
	});

	it("should have toBeInTheDocument matcher working", () => {
		render(<div data-testid="test-element">Test</div>);

		const element = screen.getByTestId("test-element");
		expect(element).toBeInTheDocument();
	});

	it("should have toHaveTextContent matcher working", () => {
		render(<div data-testid="test-element">Hello World</div>);

		const element = screen.getByTestId("test-element");
		expect(element).toHaveTextContent("Hello World");
	});
});
