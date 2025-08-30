import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
	label: string;
	href?: string;
	icon?: ReactNode;
}

interface BreadcrumbProps {
	items: BreadcrumbItem[];
	className?: string;
	showHome?: boolean;
}

export function Breadcrumb({
	items,
	className,
	showHome = true,
}: BreadcrumbProps) {
	const allItems = showHome
		? [{ label: "Home", href: "/", icon: Home }, ...items]
		: items;

	return (
		<nav
			aria-label="Breadcrumb"
			className={cn("flex items-center space-x-1 text-sm", className)}
		>
			<ol className="flex items-center space-x-1">
				{allItems.map((item, index) => {
					const isLast = index === allItems.length - 1;
					const IconComponent = item.icon;

					return (
						<li key={index} className="flex items-center">
							{index > 0 && (
								<ChevronRight className="h-4 w-4 text-muted-foreground mx-1 flex-shrink-0" />
							)}

							{item.href && !isLast ? (
								<Link
									href={item.href}
									className="flex items-center space-x-1 text-muted-foreground hover:text-foreground transition-colors"
								>
									{IconComponent && typeof IconComponent === "function" && (
										<IconComponent className="h-4 w-4" />
									)}
									{IconComponent &&
										typeof IconComponent !== "function" &&
										IconComponent}
									<span className="truncate max-w-[150px] sm:max-w-none">
										{item.label}
									</span>
								</Link>
							) : (
								<span
									className={cn(
										"flex items-center space-x-1",
										isLast
											? "text-foreground font-medium"
											: "text-muted-foreground"
									)}
									aria-current={isLast ? "page" : undefined}
								>
									{IconComponent && typeof IconComponent === "function" && (
										<IconComponent className="h-4 w-4" />
									)}
									{IconComponent &&
										typeof IconComponent !== "function" &&
										IconComponent}
									<span className="truncate max-w-[150px] sm:max-w-none">
										{item.label}
									</span>
								</span>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
