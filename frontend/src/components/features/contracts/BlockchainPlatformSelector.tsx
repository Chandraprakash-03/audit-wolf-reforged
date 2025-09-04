"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ExternalLink, Info } from "lucide-react";
import { BlockchainPlatform } from "@/types";

interface BlockchainPlatformSelectorProps {
	platforms: BlockchainPlatform[];
	selectedPlatforms: string[];
	onPlatformToggle: (platformId: string) => void;
	multiSelect?: boolean;
	disabled?: boolean;
}

export const BlockchainPlatformSelector: React.FC<
	BlockchainPlatformSelectorProps
> = ({
	platforms,
	selectedPlatforms,
	onPlatformToggle,
	multiSelect = false,
	disabled = false,
}) => {
	const handlePlatformClick = (platformId: string) => {
		if (disabled) return;

		if (!multiSelect) {
			// Single select mode - clear others and select this one
			onPlatformToggle(platformId);
		} else {
			// Multi select mode - toggle this platform
			onPlatformToggle(platformId);
		}
	};

	const isSelected = (platformId: string) =>
		selectedPlatforms.includes(platformId);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<Label className="text-base font-medium">
					Select Blockchain Platform{multiSelect ? "s" : ""}
				</Label>
				{multiSelect && (
					<Badge variant="outline" className="text-xs">
						Multi-chain analysis
					</Badge>
				)}
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{platforms.map((platform) => (
					<Card
						key={platform.id}
						className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
							isSelected(platform.id)
								? "ring-2 ring-blue-500 bg-blue-50"
								: "hover:bg-gray-50"
						} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
						onClick={() => handlePlatformClick(platform.id)}
					>
						<CardContent className="p-4">
							<div className="flex items-start justify-between mb-3">
								<div className="flex items-center gap-2">
									<h3 className="font-semibold text-sm">
										{platform.displayName}
									</h3>
									{isSelected(platform.id) && (
										<Check className="h-4 w-4 text-blue-500" />
									)}
								</div>
								{platform.website && (
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0"
										onClick={(e) => {
											e.stopPropagation();
											window.open(platform.website, "_blank");
										}}
									>
										<ExternalLink className="h-3 w-3" />
									</Button>
								)}
							</div>

							<p className="text-xs text-gray-600 mb-3 line-clamp-2">
								{platform.description}
							</p>

							<div className="space-y-2">
								<div>
									<Label className="text-xs text-gray-500">Languages</Label>
									<div className="flex flex-wrap gap-1 mt-1">
										{platform.supportedLanguages.map((lang) => (
											<Badge
												key={lang}
												variant="secondary"
												className="text-xs px-2 py-0"
											>
												{lang}
											</Badge>
										))}
									</div>
								</div>

								<div>
									<Label className="text-xs text-gray-500">File Types</Label>
									<div className="flex flex-wrap gap-1 mt-1">
										{platform.fileExtensions.map((ext) => (
											<Badge
												key={ext}
												variant="outline"
												className="text-xs px-2 py-0"
											>
												{ext}
											</Badge>
										))}
									</div>
								</div>

								{!platform.isActive && (
									<div className="flex items-center gap-1 text-amber-600">
										<Info className="h-3 w-3" />
										<span className="text-xs">Coming Soon</span>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{selectedPlatforms.length === 0 && (
				<div className="text-center py-4">
					<p className="text-sm text-gray-500">
						Select a blockchain platform to continue
					</p>
				</div>
			)}

			{multiSelect && selectedPlatforms.length > 1 && (
				<div className="bg-blue-50 border border-blue-200 rounded-md p-3">
					<div className="flex items-start gap-2">
						<Info className="h-4 w-4 text-blue-500 mt-0.5" />
						<div className="text-sm text-blue-700">
							<p className="font-medium">Cross-chain Analysis Enabled</p>
							<p className="text-xs mt-1">
								Your contracts will be analyzed for interoperability and
								cross-chain security issues.
							</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
