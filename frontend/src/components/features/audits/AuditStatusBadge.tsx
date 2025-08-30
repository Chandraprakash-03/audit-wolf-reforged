import { Badge } from "@/components/ui/badge";
import { Audit } from "@/types";

interface AuditStatusBadgeProps {
	status: Audit["status"];
}

export function AuditStatusBadge({ status }: AuditStatusBadgeProps) {
	const getStatusConfig = (status: Audit["status"]) => {
		switch (status) {
			case "completed":
				return { variant: "success" as const, label: "Completed" };
			case "analyzing":
				return { variant: "warning" as const, label: "Analyzing" };
			case "pending":
				return { variant: "secondary" as const, label: "Pending" };
			case "failed":
				return { variant: "destructive" as const, label: "Failed" };
			default:
				return { variant: "outline" as const, label: "Unknown" };
		}
	};

	const { variant, label } = getStatusConfig(status);

	return <Badge variant={variant}>{label}</Badge>;
}
