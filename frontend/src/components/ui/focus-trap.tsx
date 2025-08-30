"use client";

import { useEffect, useRef, ReactNode } from "react";

interface FocusTrapProps {
	children: ReactNode;
	active?: boolean;
	restoreFocus?: boolean;
}

export function FocusTrap({
	children,
	active = true,
	restoreFocus = true,
}: FocusTrapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const previousActiveElement = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!active) return;

		// Store the currently focused element
		previousActiveElement.current = document.activeElement as HTMLElement;

		const container = containerRef.current;
		if (!container) return;

		// Get all focusable elements
		const getFocusableElements = () => {
			return container.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			) as NodeListOf<HTMLElement>;
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Tab") return;

			const focusableElements = getFocusableElements();
			const firstElement = focusableElements[0];
			const lastElement = focusableElements[focusableElements.length - 1];

			if (e.shiftKey) {
				// Shift + Tab
				if (document.activeElement === firstElement) {
					e.preventDefault();
					lastElement?.focus();
				}
			} else {
				// Tab
				if (document.activeElement === lastElement) {
					e.preventDefault();
					firstElement?.focus();
				}
			}
		};

		// Focus the first focusable element
		const focusableElements = getFocusableElements();
		if (focusableElements.length > 0) {
			focusableElements[0].focus();
		}

		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);

			// Restore focus to the previously focused element
			if (restoreFocus && previousActiveElement.current) {
				previousActiveElement.current.focus();
			}
		};
	}, [active, restoreFocus]);

	return (
		<div ref={containerRef} className="focus-trap">
			{children}
		</div>
	);
}
