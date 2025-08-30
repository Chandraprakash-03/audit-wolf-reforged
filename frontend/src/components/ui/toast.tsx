"use client";

import {
	createContext,
	useContext,
	useState,
	useCallback,
	ReactNode,
} from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
	id: string;
	type: ToastType;
	title: string;
	description?: string;
	duration?: number;
	action?: {
		label: string;
		onClick: () => void;
	};
}

interface ToastContextType {
	toasts: Toast[];
	addToast: (toast: Omit<Toast, "id">) => void;
	removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const addToast = useCallback((toast: Omit<Toast, "id">) => {
		const id = Math.random().toString(36).substr(2, 9);
		const newToast = { ...toast, id };

		setToasts((prev) => [...prev, newToast]);

		// Auto remove after duration
		const duration = toast.duration ?? 5000;
		if (duration > 0) {
			setTimeout(() => {
				removeToast(id);
			}, duration);
		}
	}, []);

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id));
	}, []);

	return (
		<ToastContext.Provider value={{ toasts, addToast, removeToast }}>
			{children}
			<ToastContainer />
		</ToastContext.Provider>
	);
}

export function useToast() {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return context;
}

function ToastContainer() {
	const { toasts, removeToast } = useToast();

	if (toasts.length === 0) return null;

	return (
		<div className="fixed top-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full">
			{toasts.map((toast) => (
				<ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
			))}
		</div>
	);
}

function ToastItem({
	toast,
	onRemove,
}: {
	toast: Toast;
	onRemove: (id: string) => void;
}) {
	const icons = {
		success: CheckCircle,
		error: AlertCircle,
		warning: AlertTriangle,
		info: Info,
	};

	const styles = {
		success:
			"bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200",
		error:
			"bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200",
		warning:
			"bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200",
		info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200",
	};

	const Icon = icons[toast.type];

	return (
		<div
			className={cn(
				"relative flex items-start space-x-3 p-4 rounded-lg shadow-lg animate-in slide-in-from-right duration-300 glass",
				styles[toast.type]
			)}
			role="alert"
			aria-live="polite"
		>
			<Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />

			<div className="flex-1 min-w-0">
				<p className="font-medium text-sm">{toast.title}</p>
				{toast.description && (
					<p className="mt-1 text-sm opacity-90">{toast.description}</p>
				)}

				{toast.action && (
					<div className="mt-3">
						<Button
							size="sm"
							variant="outline"
							onClick={toast.action.onClick}
							className="text-xs"
						>
							{toast.action.label}
						</Button>
					</div>
				)}
			</div>

			<Button
				variant="ghost"
				size="sm"
				onClick={() => onRemove(toast.id)}
				className="flex-shrink-0 p-1 h-auto opacity-70 hover:opacity-100"
				aria-label="Close notification"
			>
				<X className="h-4 w-4" />
			</Button>
		</div>
	);
}
