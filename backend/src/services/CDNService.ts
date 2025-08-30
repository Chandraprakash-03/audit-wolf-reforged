import { Request, Response, NextFunction } from "express";
import * as path from "path";
import * as fs from "fs";
import { createHash } from "crypto";

export interface CDNConfig {
	enabled: boolean;
	baseUrl: string;
	cacheTTL: number;
	staticPaths: string[];
	compressionEnabled: boolean;
	versioningEnabled: boolean;
}

export interface AssetInfo {
	path: string;
	hash: string;
	size: number;
	mimeType: string;
	lastModified: Date;
	compressed?: boolean;
}

export class CDNService {
	private static instance: CDNService;
	private config: CDNConfig;
	private assetCache: Map<string, AssetInfo> = new Map();
	private versionMap: Map<string, string> = new Map();

	private constructor() {
		this.config = {
			enabled: process.env.CDN_ENABLED === "true",
			baseUrl: process.env.CDN_BASE_URL || "",
			cacheTTL: parseInt(process.env.CDN_CACHE_TTL || "86400"), // 24 hours
			staticPaths: ["/static", "/assets", "/images", "/css", "/js"],
			compressionEnabled: process.env.CDN_COMPRESSION === "true",
			versioningEnabled: process.env.CDN_VERSIONING === "true",
		};

		if (this.config.enabled) {
			this.initializeAssetCache();
		}
	}

	public static getInstance(): CDNService {
		if (!CDNService.instance) {
			CDNService.instance = new CDNService();
		}
		return CDNService.instance;
	}

	/**
	 * Middleware to handle static asset serving with CDN optimization
	 */
	staticAssetMiddleware() {
		return (req: Request, res: Response, next: NextFunction): void => {
			// Check if this is a static asset request
			const isStaticAsset = this.config.staticPaths.some((staticPath) =>
				req.path.startsWith(staticPath)
			);

			if (!isStaticAsset) {
				return next();
			}

			// If CDN is enabled, redirect to CDN
			if (this.config.enabled && this.config.baseUrl) {
				const cdnUrl = this.getCDNUrl(req.path);
				return res.redirect(301, cdnUrl);
			}

			// Serve locally with optimization
			this.serveOptimizedAsset(req, res, next);
		};
	}

	/**
	 * Get CDN URL for an asset
	 */
	getCDNUrl(assetPath: string): string {
		if (!this.config.enabled || !this.config.baseUrl) {
			return assetPath;
		}

		let url = `${this.config.baseUrl}${assetPath}`;

		// Add version parameter if versioning is enabled
		if (this.config.versioningEnabled) {
			const version = this.getAssetVersion(assetPath);
			if (version) {
				url += `?v=${version}`;
			}
		}

		return url;
	}

	/**
	 * Generate asset manifest for frontend
	 */
	generateAssetManifest(): { [key: string]: string } {
		const manifest: { [key: string]: string } = {};

		for (const [assetPath, assetInfo] of this.assetCache.entries()) {
			const cdnUrl = this.getCDNUrl(assetPath);
			manifest[assetPath] = cdnUrl;
		}

		return manifest;
	}

	/**
	 * Preload critical assets
	 */
	getCriticalAssetPreloads(): string[] {
		const criticalAssets = ["/css/main.css", "/js/main.js", "/images/logo.svg"];

		return criticalAssets
			.filter((asset) => this.assetCache.has(asset))
			.map((asset) => this.getCDNUrl(asset));
	}

	/**
	 * Get asset information
	 */
	getAssetInfo(assetPath: string): AssetInfo | null {
		return this.assetCache.get(assetPath) || null;
	}

	/**
	 * Invalidate asset cache
	 */
	invalidateAsset(assetPath: string): void {
		this.assetCache.delete(assetPath);
		this.versionMap.delete(assetPath);
	}

	/**
	 * Refresh asset cache
	 */
	refreshAssetCache(): void {
		this.assetCache.clear();
		this.versionMap.clear();
		this.initializeAssetCache();
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): {
		totalAssets: number;
		totalSize: number;
		compressionRatio: number;
		hitRate: number;
	} {
		let totalSize = 0;
		let compressedSize = 0;
		let compressedCount = 0;

		for (const assetInfo of this.assetCache.values()) {
			totalSize += assetInfo.size;
			if (assetInfo.compressed) {
				compressedSize += assetInfo.size;
				compressedCount++;
			}
		}

		const compressionRatio =
			compressedCount > 0
				? ((totalSize - compressedSize) / totalSize) * 100
				: 0;

		return {
			totalAssets: this.assetCache.size,
			totalSize,
			compressionRatio: Math.round(compressionRatio * 100) / 100,
			hitRate: 0, // Would need to track actual hits/misses
		};
	}

	// Private methods
	private serveOptimizedAsset(
		req: Request,
		res: Response,
		next: NextFunction
	): void {
		const assetPath = req.path;
		const assetInfo = this.assetCache.get(assetPath);

		if (!assetInfo) {
			return next();
		}

		// Set cache headers
		res.set({
			"Cache-Control": `public, max-age=${this.config.cacheTTL}`,
			ETag: `"${assetInfo.hash}"`,
			"Last-Modified": assetInfo.lastModified.toUTCString(),
			"Content-Type": assetInfo.mimeType,
		});

		// Check if client has cached version
		const clientETag = req.headers["if-none-match"];
		const clientLastModified = req.headers["if-modified-since"];

		if (
			clientETag === `"${assetInfo.hash}"` ||
			(clientLastModified &&
				new Date(clientLastModified) >= assetInfo.lastModified)
		) {
			res.status(304).end();
			return;
		}

		// Serve the file
		const fullPath = path.join(process.cwd(), "public", assetPath);

		if (fs.existsSync(fullPath)) {
			res.sendFile(fullPath);
		} else {
			next();
		}
	}

	private initializeAssetCache(): void {
		const publicDir = path.join(process.cwd(), "public");

		if (!fs.existsSync(publicDir)) {
			console.warn(
				"Public directory not found, skipping asset cache initialization"
			);
			return;
		}

		this.scanDirectory(publicDir, "");
	}

	private scanDirectory(dirPath: string, relativePath: string): void {
		try {
			const items = fs.readdirSync(dirPath);

			for (const item of items) {
				const itemPath = path.join(dirPath, item);
				const itemRelativePath = path
					.join(relativePath, item)
					.replace(/\\/g, "/");
				const stats = fs.statSync(itemPath);

				if (stats.isDirectory()) {
					this.scanDirectory(itemPath, itemRelativePath);
				} else if (stats.isFile()) {
					this.cacheAsset(itemPath, `/${itemRelativePath}`, stats);
				}
			}
		} catch (error) {
			console.error(`Error scanning directory ${dirPath}:`, error);
		}
	}

	private cacheAsset(
		filePath: string,
		assetPath: string,
		stats: fs.Stats
	): void {
		try {
			const content = fs.readFileSync(filePath);
			const hash = createHash("md5").update(content).digest("hex");
			const mimeType = this.getMimeType(path.extname(filePath));

			const assetInfo: AssetInfo = {
				path: assetPath,
				hash,
				size: stats.size,
				mimeType,
				lastModified: stats.mtime,
				compressed: this.shouldCompress(mimeType),
			};

			this.assetCache.set(assetPath, assetInfo);

			// Generate version for this asset
			if (this.config.versioningEnabled) {
				this.versionMap.set(assetPath, hash.substring(0, 8));
			}
		} catch (error) {
			console.error(`Error caching asset ${assetPath}:`, error);
		}
	}

	private getAssetVersion(assetPath: string): string | null {
		return this.versionMap.get(assetPath) || null;
	}

	private getMimeType(extension: string): string {
		const mimeTypes: { [key: string]: string } = {
			".html": "text/html",
			".css": "text/css",
			".js": "application/javascript",
			".json": "application/json",
			".png": "image/png",
			".jpg": "image/jpeg",
			".jpeg": "image/jpeg",
			".gif": "image/gif",
			".svg": "image/svg+xml",
			".ico": "image/x-icon",
			".woff": "font/woff",
			".woff2": "font/woff2",
			".ttf": "font/ttf",
			".eot": "application/vnd.ms-fontobject",
		};

		return mimeTypes[extension.toLowerCase()] || "application/octet-stream";
	}

	private shouldCompress(mimeType: string): boolean {
		if (!this.config.compressionEnabled) {
			return false;
		}

		const compressibleTypes = [
			"text/",
			"application/javascript",
			"application/json",
			"image/svg+xml",
		];

		return compressibleTypes.some((type) => mimeType.startsWith(type));
	}
}

export const cdnService = CDNService.getInstance();
