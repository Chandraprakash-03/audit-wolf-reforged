import { Skeleton } from "./skeleton";
import { Card, CardContent, CardHeader } from "./card";

export function AuditCardSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-3/4" />
				<Skeleton className="h-4 w-1/2" />
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-2/3" />
					<div className="flex justify-between items-center">
						<Skeleton className="h-6 w-20" />
						<Skeleton className="h-8 w-24" />
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export function DashboardSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header skeleton */}
			<div className="space-y-2">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-4 w-96" />
			</div>

			{/* Stats skeleton */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				{Array.from({ length: 3 }).map((_, i) => (
					<Card key={i}>
						<CardContent className="p-6">
							<div className="space-y-2">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-8 w-16" />
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{/* Audit cards skeleton */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{Array.from({ length: 6 }).map((_, i) => (
					<AuditCardSkeleton key={i} />
				))}
			</div>
		</div>
	);
}

export function ContractUploadSkeleton() {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-4 w-80" />
			</div>

			<Card>
				<CardContent className="p-6">
					<div className="space-y-4">
						<Skeleton className="h-32 w-full" />
						<div className="flex justify-between">
							<Skeleton className="h-10 w-24" />
							<Skeleton className="h-10 w-32" />
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export function ReportSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="space-y-2">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-4 w-48" />
			</div>

			{/* Summary cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Card key={i}>
						<CardContent className="p-4">
							<div className="space-y-2">
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-6 w-8" />
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{/* Vulnerabilities */}
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-32" />
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="glass rounded-lg p-4 space-y-2">
								<div className="flex justify-between items-start">
									<Skeleton className="h-5 w-48" />
									<Skeleton className="h-6 w-16" />
								</div>
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-3/4" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
