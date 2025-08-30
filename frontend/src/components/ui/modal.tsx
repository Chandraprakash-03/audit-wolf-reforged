"use client";

import { useEffect, ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { FocusTrap } from "./focus-trap";
import { cn } from "@/lib/utils";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	description?: string;
	children: ReactNode;
	size?: "sm" | "md" | "lg" | "xl" | "full";
	className?: string;
	closeOnOverlayClick?: boolean;
	closeOnEscape?: boolean;
	showCloseButton?: boolean;
}

export function Modal({
	isOpen,
	onClose,
	title,
	description,
	children,
	size = "md",
	className,
	closeOnOverlayClick = true,
	closeOnEscape = true,
	showCloseButton = true,
}: ModalProps) {
	const sizeClasses = {
		sm: "max-w-md",
		md: "max-w-lg",
		lg: "max-w-2xl",
		xl: "max-w-4xl",
		full: "max-w-full mx-4",
	};

	useEffect(() => {
		if (!isOpen) return;

		// Prevent body scroll
		document.body.style.overflow = "hidden";

		// Handle escape key
		const handleEscape = (e: KeyboardEvent) => {
			if (closeOnEscape && e.key === "Escape") {
				onClose();
			}
		};

		document.addEventListener("keydown", handleEscape);

		return () => {
			document.body.style.overflow = "unset";
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isOpen, closeOnEscape, onClose]);

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? "modal-title" : undefined}
			aria-describedby={description ? "modal-description" : undefined}
		>
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-300"
				onClick={closeOnOverlayClick ? onClose : undefined}
				aria-hidden="true"
			/>

			{/* Modal content */}
			<FocusTrap active={isOpen}>
				<div
					className={cn(
						"relative glass rounded-lg shadow-lg w-full animate-in fade-in-0 zoom-in-95 duration-300",
						sizeClasses[size],
						className
					)}
				>
					{/* Header */}
					{(title || showCloseButton) && (
						<div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
							<div className="flex-1 min-w-0">
								{title && (
									<h2
										id="modal-title"
										className="text-lg md:text-xl font-semibold text-foreground truncate"
									>
										{title}
									</h2>
								)}
								{description && (
									<p
										id="modal-description"
										className="mt-1 text-sm text-muted-foreground"
									>
										{description}
									</p>
								)}
							</div>

							{showCloseButton && (
								<Button
									variant="ghost"
									size="sm"
									onClick={onClose}
									className="ml-4 flex-shrink-0"
									aria-label="Close modal"
								>
									<X className="h-4 w-4" />
								</Button>
							)}
						</div>
					)}

					{/* Content */}
					<div className="p-4 md:p-6">{children}</div>
				</div>
			</FocusTrap>
		</div>
	);
}
