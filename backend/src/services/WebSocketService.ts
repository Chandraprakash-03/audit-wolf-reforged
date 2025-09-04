import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { AuditProgress } from "../types/audit";

export interface AuthenticatedSocket {
	id: string;
	userId: string;
	join: (room: string) => void;
	leave: (room: string) => void;
	emit: (event: string, data: any) => void;
}

export class WebSocketService {
	private io: SocketIOServer;
	private authenticatedSockets: Map<string, AuthenticatedSocket> = new Map();

	constructor(server: HTTPServer) {
		this.io = new SocketIOServer(server, {
			cors: {
				origin: process.env.FRONTEND_URL || "http://localhost:3000",
				methods: ["GET", "POST"],
				credentials: true,
			},
			transports: ["websocket", "polling"],
		});

		this.setupMiddleware();
		this.setupEventHandlers();
	}

	/**
	 * Sets up authentication middleware for WebSocket connections
	 */
	private setupMiddleware(): void {
		this.io.use(async (socket, next) => {
			try {
				const token =
					socket.handshake.auth.token ||
					socket.handshake.headers.authorization?.replace("Bearer ", "");

				if (!token) {
					return next(new Error("Authentication token required"));
				}

				// Verify JWT token
				const decoded = jwt.verify(
					token,
					process.env.JWT_SECRET || "your-secret-key"
				) as any;

				if (!decoded.userId) {
					return next(new Error("Invalid token"));
				}

				// Attach user info to socket
				(socket as any).userId = decoded.userId;
				next();
			} catch (error) {
				console.error("WebSocket authentication error:", error);
				next(new Error("Authentication failed"));
			}
		});
	}

	/**
	 * Sets up WebSocket event handlers
	 */
	private setupEventHandlers(): void {
		this.io.on("connection", (socket) => {
			const userId = (socket as any).userId;
			console.log(`User ${userId} connected via WebSocket`);

			// Store authenticated socket
			this.authenticatedSockets.set(socket.id, {
				id: socket.id,
				userId,
				join: (room: string) => socket.join(room),
				leave: (room: string) => socket.leave(room),
				emit: (event: string, data: any) => socket.emit(event, data),
			});

			// Join user-specific room
			socket.join(`user:${userId}`);

			// Handle audit subscription
			socket.on("subscribe:audit", (auditId: string) => {
				console.log(`User ${userId} subscribed to audit ${auditId}`);
				socket.join(`audit:${auditId}`);

				// Send acknowledgment
				socket.emit("subscribed:audit", { auditId });
			});

			// Handle audit unsubscription
			socket.on("unsubscribe:audit", (auditId: string) => {
				console.log(`User ${userId} unsubscribed from audit ${auditId}`);
				socket.leave(`audit:${auditId}`);

				// Send acknowledgment
				socket.emit("unsubscribed:audit", { auditId });
			});

			// Handle ping for connection health
			socket.on("ping", () => {
				socket.emit("pong", { timestamp: Date.now() });
			});

			// Handle disconnection
			socket.on("disconnect", (reason) => {
				console.log(`User ${userId} disconnected: ${reason}`);
				this.authenticatedSockets.delete(socket.id);
			});

			// Send welcome message
			socket.emit("connected", {
				message: "Connected to Audit Wolf WebSocket server",
				userId,
				timestamp: Date.now(),
			});
		});

		// Handle connection errors
		this.io.on("connect_error", (error) => {
			console.error("WebSocket connection error:", error);
		});
	}

	/**
	 * Notifies a user about audit progress updates
	 */
	notifyAuditProgress(userId: string, progress: AuditProgress): void {
		try {
			// Send to user-specific room
			this.io.to(`user:${userId}`).emit("audit:progress", progress);

			// Also send to audit-specific room (in case user is subscribed)
			this.io.to(`audit:${progress.auditId}`).emit("audit:progress", progress);

			console.log(
				`Sent progress update for audit ${progress.auditId} to user ${userId}`
			);
		} catch (error) {
			console.error("Error sending audit progress notification:", error);
		}
	}

	/**
	 * Notifies a user about audit completion
	 */
	notifyAuditComplete(userId: string, auditId: string, results: any): void {
		try {
			const notification = {
				auditId,
				status: "completed",
				message: "Audit analysis completed successfully",
				results: {
					totalVulnerabilities: results.vulnerabilities?.length || 0,
					executionTime: results.executionTime || 0,
				},
				timestamp: Date.now(),
			};

			// Send to user-specific room
			this.io.to(`user:${userId}`).emit("audit:completed", notification);

			// Also send to audit-specific room
			this.io.to(`audit:${auditId}`).emit("audit:completed", notification);

			console.log(
				`Sent completion notification for audit ${auditId} to user ${userId}`
			);
		} catch (error) {
			console.error("Error sending audit completion notification:", error);
		}
	}

	/**
	 * Notifies a user about audit failure
	 */
	notifyAuditFailed(userId: string, auditId: string, error: string): void {
		try {
			const notification = {
				auditId,
				status: "failed",
				message: "Audit analysis failed",
				error,
				timestamp: Date.now(),
			};

			// Send to user-specific room
			this.io.to(`user:${userId}`).emit("audit:failed", notification);

			// Also send to audit-specific room
			this.io.to(`audit:${auditId}`).emit("audit:failed", notification);

			console.log(
				`Sent failure notification for audit ${auditId} to user ${userId}`
			);
		} catch (error) {
			console.error("Error sending audit failure notification:", error);
		}
	}

	/**
	 * Broadcasts system-wide notifications
	 */
	broadcastSystemNotification(
		message: string,
		type: "info" | "warning" | "error" = "info"
	): void {
		try {
			const notification = {
				type,
				message,
				timestamp: Date.now(),
			};

			this.io.emit("system:notification", notification);
			console.log(`Broadcasted system notification: ${message}`);
		} catch (error) {
			console.error("Error broadcasting system notification:", error);
		}
	}

	/**
	 * Gets the number of connected users
	 */
	getConnectedUsersCount(): number {
		return this.authenticatedSockets.size;
	}

	/**
	 * Gets connected users by user ID
	 */
	getConnectedUsers(): string[] {
		return Array.from(this.authenticatedSockets.values()).map(
			(socket) => socket.userId
		);
	}

	/**
	 * Checks if a user is connected
	 */
	isUserConnected(userId: string): boolean {
		return Array.from(this.authenticatedSockets.values()).some(
			(socket) => socket.userId === userId
		);
	}

	/**
	 * Sends a direct message to a specific user
	 */
	sendToUser(userId: string, event: string, data: any): void {
		try {
			this.io.to(`user:${userId}`).emit(event, data);
			console.log(`Sent ${event} to user ${userId}`);
		} catch (error) {
			console.error(`Error sending ${event} to user ${userId}:`, error);
		}
	}

	/**
	 * Sends a message to all users subscribed to an audit
	 */
	sendToAudit(auditId: string, event: string, data: any): void {
		try {
			this.io.to(`audit:${auditId}`).emit(event, data);
			console.log(`Sent ${event} to audit ${auditId} subscribers`);
		} catch (error) {
			console.error(`Error sending ${event} to audit ${auditId}:`, error);
		}
	}

	/**
	 * Gets statistics about WebSocket connections
	 */
	getStats(): {
		connectedSockets: number;
		uniqueUsers: number;
		rooms: string[];
	} {
		const rooms = Array.from(this.io.sockets.adapter.rooms.keys());
		const uniqueUsers = new Set(
			Array.from(this.authenticatedSockets.values()).map((s) => s.userId)
		).size;

		return {
			connectedSockets: this.authenticatedSockets.size,
			uniqueUsers,
			rooms: rooms.filter((room) => !room.startsWith("/")), // Filter out socket ID rooms
		};
	}

	/**
	 * Notifies a user about multi-chain analysis progress
	 */
	notifyMultiChainProgress(userId: string, progress: any): void {
		try {
			// Send to user-specific room
			this.io.to(`user:${userId}`).emit("multichain:progress", progress);

			// Also send to audit-specific room
			this.io
				.to(`multichain:${progress.multiChainAuditId}`)
				.emit("multichain:progress", progress);

			console.log(
				`Sent multi-chain progress update for audit ${progress.multiChainAuditId} to user ${userId}`
			);
		} catch (error) {
			console.error("Error sending multi-chain progress notification:", error);
		}
	}

	/**
	 * Gracefully closes all WebSocket connections
	 */
	async close(): Promise<void> {
		return new Promise((resolve) => {
			this.io.close(() => {
				console.log("WebSocket server closed");
				resolve();
			});
		});
	}
}
