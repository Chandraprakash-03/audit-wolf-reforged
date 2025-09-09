import "@testing-library/jest-dom";

declare global {
	namespace jest {
		interface Matchers<R> {
			toHaveClass(className: string): R;
			toBeInTheDocument(): R;
			toHaveAttribute(attr: string, value?: string): R;
			toHaveTextContent(text: string | RegExp): R;
			toBeVisible(): R;
			toBeDisabled(): R;
			toBeEnabled(): R;
			toHaveValue(value: string | number): R;
			toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R;
			toBeChecked(): R;
			toHaveFocus(): R;
			toHaveFormValues(expectedValues: Record<string, any>): R;
			toHaveStyle(css: string | Record<string, any>): R;
			toHaveAccessibleDescription(
				expectedAccessibleDescription?: string | RegExp
			): R;
			toHaveAccessibleName(expectedAccessibleName?: string | RegExp): R;
			toHaveErrorMessage(expectedErrorMessage?: string | RegExp): R;
		}
	}
}
