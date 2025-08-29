# Audit Queue System

This document describes the audit orchestration and job queue system implemented for Task 7.

## Overview

The audit queue system provides:

- Background job processing with Bull Queue and Redis
- Real-time progress updates via WebSocket
- Retry logic and error handling
- Job prioritization and status tracking
- Scalable audit workflow orchestration

## Components

### 1. Queue Configuration (`config/queue.ts`)

- Redis connection setup
- Bull Queue configuration with retry logic
- Job types and data interfaces
- Priority levels (LOW, NORMAL, HIGH, CRITICAL)

### 2. Audit Orchestrator (`services/AuditOrchestrator.ts`)

- Main orchestration service
- Job processors for static, AI, and full analysis
- Progress tracking and WebSocket notifications
- Error handling and retry mechanisms

### 3. WebSocket Service (`services/WebSocketService.ts`)

- Real-time communication with frontend
- User authentication for WebSocket connections
- Progress notifications and system broadcasts
- Room-based subscriptions for audit updates

### 4. Queue Routes (`routes/queue.ts`)

- REST API endpoints for queue management
- Queue statistics and monitoring
- Audit progress tracking
- Job cancellation functionality

## Usage

### Starting an Audit

```typescript
const auditOrchestrator = new AuditOrchestrator(wsService);

const result = await auditOrchestrator.startAudit({
	contractId: "contract-123",
	userId: "user-123",
	analysisType: "full", // 'static', 'ai', or 'full'
	priority: JobPriority.HIGH,
	options: {
		includeRecommendations: true,
		severityThreshold: "medium",
	},
});
```

### Tracking Progress

```typescript
// Get current progress
const progress = await auditOrchestrator.getAuditProgress(auditId, userId);

// WebSocket real-time updates
wsService.notifyAuditProgress(userId, {
	auditId: "audit-123",
	status: "processing",
	progress: 50,
	currentStep: "Running AI analysis",
});
```

### Queue Management

```typescript
// Get queue statistics
const stats = await auditOrchestrator.getQueueStats();
// Returns: { waiting: 5, active: 2, completed: 100, failed: 3, delayed: 0 }

// Cancel an audit
const result = await auditOrchestrator.cancelAudit(auditId, userId);
```

## API Endpoints

### Queue Statistics

```
GET /api/queue/stats
```

Returns current queue statistics including waiting, active, completed, and failed jobs.

### Audit Progress

```
GET /api/queue/audit/:auditId/progress
```

Returns real-time progress information for a specific audit.

### Cancel Audit

```
POST /api/queue/audit/:auditId/cancel
```

Cancels an ongoing audit and removes it from the queue.

## WebSocket Events

### Client Events

- `subscribe:audit` - Subscribe to audit updates
- `unsubscribe:audit` - Unsubscribe from audit updates
- `ping` - Connection health check

### Server Events

- `audit:progress` - Progress updates
- `audit:completed` - Audit completion notification
- `audit:failed` - Audit failure notification
- `system:notification` - System-wide announcements

## Environment Variables

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# WebSocket Configuration
FRONTEND_URL=http://localhost:3000

# JWT Secret for WebSocket authentication
JWT_SECRET=your_jwt_secret
```

## Job Processing

### Job Types

1. **Static Analysis** (`static_analysis`)

   - Runs Slither analysis
   - Processes AST and gas optimization
   - Stores vulnerabilities in database

2. **AI Analysis** (`ai_analysis`)

   - Runs ensemble AI analysis
   - Multiple model orchestration
   - Confidence scoring and validation

3. **Full Analysis** (`full_analysis`)
   - Combines static and AI analysis
   - Comprehensive vulnerability detection
   - Integrated reporting

### Job Priorities

- `LOW` (1) - Background processing
- `NORMAL` (5) - Default priority
- `HIGH` (10) - Expedited processing
- `CRITICAL` (15) - Immediate processing

### Retry Logic

- 3 retry attempts for failed jobs
- Exponential backoff starting at 2 seconds
- Failed jobs are kept for debugging (last 50)
- Completed jobs are kept for history (last 10)

## Error Handling

The system includes comprehensive error handling:

- Database connection failures
- Analysis tool timeouts
- Queue system errors
- WebSocket connection issues
- User authentication failures

All errors are logged and appropriate notifications are sent to users via WebSocket.

## Testing

The system includes comprehensive test coverage:

- Unit tests for AuditOrchestrator
- Integration tests for complete workflows
- Mock implementations for external dependencies
- Error scenario testing

Run tests with:

```bash
npm test -- --testPathPattern="audit-orchestrator|audit-workflow"
```

## Monitoring

Monitor the queue system using:

- Queue statistics API endpoint
- WebSocket connection counts
- Job completion rates and failure analysis
- Real-time progress tracking

The system provides detailed logging for debugging and monitoring purposes.
