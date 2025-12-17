# Task Runner Pattern - Infinite Worker Loop with SSE Logging

> **สร้างเมื่อ:** 2025-12-13
> **Reference Implementation:** Stage 01 (task-01-raw-to-group.py)
> **Use Case:** Background tasks ที่รันแบบ infinite loop พร้อม real-time logging

---

## 📋 สารบัญ

1. [ภาพรวม Architecture](#ภาพรวม-architecture)
2. [Backend Implementation](#backend-implementation)
3. [Frontend Implementation](#frontend-implementation)
4. [State Management](#state-management)
5. [SSE Connection Logic](#sse-connection-logic)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)
8. [Common Pitfalls](#common-pitfalls)

---

## 🎯 ภาพรวม Architecture

### Pattern นี้ใช้สำหรับ:
- ✅ Background tasks ที่รันแบบ infinite loop
- ✅ Real-time logging ผ่าน SSE (Server-Sent Events)
- ✅ Start/Stop control จาก UI
- ✅ State synchronization ระหว่าง Frontend ↔ Backend
- ✅ Auto-reconnect เมื่อ connection ขาด

### Components:
```
┌─────────────┐      SSE Logs       ┌──────────────┐
│  Frontend   │ ←─────────────────  │   Backend    │
│   (React)   │                     │   (NestJS)   │
│             │  POST /start        │              │
│  - State    │ ──────────────────→ │  - Service   │
│  - Refs     │  POST /stop         │  - isRunning │
│  - SSE      │ ──────────────────→ │  - Loop      │
│  - Logs     │  GET /status        │  - Logs      │
│             │ ←─────────────────→ │              │
└─────────────┘                     └──────────────┘
```

---

## 🔧 Backend Implementation

### 1. Service Structure

**File:** `backend/src/task-runner/task-runner.service.ts`

```typescript
@Injectable()
export class TaskRunnerService {
  private isRunning = false;
  private logSubject = new ReplaySubject<LogMessage>(100);
  private logHistory: LogMessage[] = [];
  private readonly MAX_LOGS = 500;

  // ===== State Management =====
  isTaskRunning(): boolean {
    return this.isRunning;
  }

  getLogObservable() {
    return this.logSubject.asObservable();
  }

  getLogHistory(): LogMessage[] {
    return this.logHistory;
  }

  clearLogs() {
    this.logHistory = [];
  }

  // ===== Logging =====
  private log(thread: number, message: string, type: LogMessage['type'] = 'info') {
    const logMessage: LogMessage = {
      timestamp: new Date().toISOString(),
      thread,
      message,
      type,
    };
    this.logSubject.next(logMessage);  // Broadcast via SSE
    this.logHistory.push(logMessage);   // Save to history

    // Keep only last MAX_LOGS entries
    if (this.logHistory.length > this.MAX_LOGS) {
      this.logHistory = this.logHistory.slice(-this.MAX_LOGS);
    }
  }

  // ===== Main Loop =====
  async startTask(): Promise<void> {
    if (this.isRunning) {
      this.log(0, 'Task is already running', 'warning');
      return;
    }

    this.isRunning = true;
    this.log(0, '=== ∞ Infinite Worker Loop Started ===', 'info');

    try {
      // Infinite loop - ทำงานจนกว่าจะถูก stop
      while (this.isRunning) {
        // Get work items
        const items = await this.getWorkItems();

        if (items.length === 0) {
          this.log(0, '⏳ No items to process. Waiting...', 'info');
          await this.sleep(5000); // รอ 5 วินาที
          continue;
        }

        this.log(0, `📦 Found ${items.length} item(s) to process`, 'info');

        // Process batch
        await this.processBatch(items);

        // รอสักครู่ก่อน loop รอบถัดไป
        if (this.isRunning) {
          await this.sleep(2000);
        }
      }

      this.log(0, '=== ∞ Infinite Worker Loop Stopped ===', 'warning');
    } catch (error) {
      this.log(0, `Worker loop error: ${error.message}`, 'error');
      this.isRunning = false;
    }
  }

  stopTask(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.log(0, 'Task stopped by user', 'warning');
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

---

### 2. Controller Structure

**File:** `backend/src/task-runner/task-runner.controller.ts`

```typescript
@Controller('task-runner')
export class TaskRunnerController {
  constructor(private readonly taskRunnerService: TaskRunnerService) {}

  @Get('status')
  getStatus() {
    return {
      isRunning: this.taskRunnerService.isTaskRunning(),
    };
  }

  @Get('logs-history')
  getLogsHistory() {
    return {
      logs: this.taskRunnerService.getLogHistory(),
      isRunning: this.taskRunnerService.isTaskRunning(),
    };
  }

  @Post('clear-logs')
  clearLogs() {
    this.taskRunnerService.clearLogs();
    return { message: 'Logs cleared' };
  }

  @Post('start')
  async startTask() {
    // ⚠️ IMPORTANT: Check if already running
    if (this.taskRunnerService.isTaskRunning()) {
      return {
        message: 'Task is already running',
        isRunning: true,
        error: 'ALREADY_RUNNING'  // ✅ Return error code
      };
    }

    // Don't await - let it run in background
    this.taskRunnerService.startTask();
    return { message: 'Task started', isRunning: false };
  }

  @Post('stop')
  stopTask() {
    this.taskRunnerService.stopTask();
    return { message: 'Task stopped' };
  }

  @Sse('logs')
  streamLogs(): Observable<MessageEvent> {
    return this.taskRunnerService.getLogObservable().pipe(
      map((log) => ({
        data: JSON.stringify(log),
      })),
    );
  }
}
```

---

## 🎨 Frontend Implementation

### 1. State + Refs Setup

**File:** `frontend/src/app/stages/01-raw/page.tsx`

```typescript
export default function Stage01Raw() {
  // ===== STATE =====
  const [taskRunning, setTaskRunning] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [backendConnected, setBackendConnected] = useState(true);

  // ===== REFS (for avoiding circular dependencies) =====
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ⭐ CRITICAL: Refs to hold latest state values
  const taskRunningRef = useRef(taskRunning);
  const reconnectAttemptsRef = useRef(reconnectAttempts);

  // ⭐ CRITICAL: Sync refs with state
  useEffect(() => {
    taskRunningRef.current = taskRunning;
  }, [taskRunning]);

  useEffect(() => {
    reconnectAttemptsRef.current = reconnectAttempts;
  }, [reconnectAttempts]);

  // Refs for callback functions
  const startTaskWithSSERef = useRef<(() => Promise<void>) | null>(null);
  const stopHealthCheckRef = useRef<(() => void) | null>(null);
}
```

---

### 2. SSE Connection Logic

```typescript
const connectSSE = useCallback(() => {
  if (eventSourceRef.current) {
    eventSourceRef.current.close();
  }

  const eventSource = new EventSource(`${API_URL}/task-runner/logs`);
  eventSourceRef.current = eventSource;

  eventSource.onmessage = async (event) => {
    try {
      const log: LogMessage = JSON.parse(event.data);
      await handleLogMessage(log);
      setReconnectAttempts(0); // Reset on success
    } catch (e) {
      console.error('Error parsing log:', e);
    }
  };

  eventSource.onerror = () => {
    console.error('SSE connection error');
    eventSource.close();

    // ⚠️ IMPORTANT: Use refs to avoid dependencies
    if (taskRunningRef.current && reconnectAttemptsRef.current < 5) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);

      setLogs((prev) => [...prev, {
        timestamp: new Date().toISOString(),
        thread: 0,
        message: `⚠️ Connection lost. Reconnecting in ${delay/1000}s...`,
        type: 'warning'
      }]);

      setReconnectAttempts((prev) => prev + 1);

      reconnectTimeoutRef.current = setTimeout(() => {
        connectSSE();
      }, delay);
    } else if (reconnectAttemptsRef.current >= 5) {
      setLogs((prev) => [...prev, {
        timestamp: new Date().toISOString(),
        thread: 0,
        message: '❌ Max reconnection attempts reached. Please refresh the page.',
        type: 'error'
      }]);
      setTaskRunning(false);
      stopHealthCheckRef.current?.();
    }
  };
}, [handleLogMessage]); // ✅ Only handleLogMessage dependency
```

---

### 3. Health Check (Timeout Detection)

```typescript
const startHealthCheck = useCallback(() => {
  if (healthCheckIntervalRef.current) {
    clearInterval(healthCheckIntervalRef.current);
  }

  healthCheckIntervalRef.current = setInterval(() => {
    const timeSinceLastActivity = Date.now() - lastActivityTimeRef.current;
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    // ⚠️ IMPORTANT: Use ref to avoid dependency
    if (timeSinceLastActivity > TIMEOUT_MS && taskRunningRef.current) {
      setLogs((prev) => [...prev, {
        timestamp: new Date().toISOString(),
        thread: 0,
        message: '⚠️ Task appears to be stuck (no activity for 5 minutes). Stopping...',
        type: 'error'
      }]);
      setTaskRunning(false);
      stopHealthCheckRef.current?.();

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    }
  }, 30000); // Check every 30s
}, []); // ✅ No dependencies
```

---

### 4. Start Task Handler

```typescript
const handleStartTask = useCallback(async () => {
  // ⚠️ IMPORTANT: Check ref, not state
  if (taskRunningRef.current) {
    console.log('Task already running (frontend state)');
    return;
  }

  if (files.length === 0) {
    setError('No files to process');
    return;
  }

  // ✅ CRITICAL: Check backend status before starting
  try {
    const statusRes = await fetch(`${API_URL}/task-runner/status`);
    const statusData = await statusRes.json();

    if (statusData.isRunning) {
      setLogs((prev) => [...prev, {
        timestamp: new Date().toISOString(),
        thread: 0,
        message: '⚠️ Task is already running on backend. Reconnecting...',
        type: 'warning'
      }]);

      // Sync frontend state with backend
      setTaskRunning(true);
      connectSSE();
      startHealthCheck();
      return;
    }
  } catch (err) {
    console.error('Error checking task status:', err);
  }

  setLogs((prev) => [...prev, {
    timestamp: new Date().toISOString(),
    thread: 0,
    message: '🔄 Starting Infinite Worker Loop... (triggered by user click)',
    type: 'info'
  }]);

  await startTaskWithSSE();
}, [files.length, startTaskWithSSE, connectSSE, startHealthCheck]);
```

---

### 5. Stop Task Handler

```typescript
const handleStopTask = async () => {
  try {
    // 1. Cancel any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // 2. Stop health check
    stopHealthCheck();

    // 3. Close SSE connection first
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // 4. Send stop request
    await fetch(`${API_URL}/task-runner/stop`, { method: 'POST' });

    // 5. ✅ CRITICAL: Wait and verify backend actually stopped
    await new Promise(resolve => setTimeout(resolve, 500));

    const statusRes = await fetch(`${API_URL}/task-runner/status`);
    const statusData = await statusRes.json();

    if (statusData.isRunning) {
      setLogs((prev) => [...prev, {
        timestamp: new Date().toISOString(),
        thread: 0,
        message: '⚠️ Backend task is still running. Waiting...',
        type: 'warning'
      }]);

      // Wait for backend to actually stop (max 5 seconds)
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const checkRes = await fetch(`${API_URL}/task-runner/status`);
        const checkData = await checkRes.json();

        if (!checkData.isRunning) {
          break;
        }
      }
    }

    setTaskRunning(false);
  } catch (err) {
    console.error('Error stopping task:', err);
    setTaskRunning(false);
  }
};
```

---

### 6. Initial Load (Restore State)

```typescript
const fetchLogsHistory = useCallback(async () => {
  try {
    const res = await fetch(`${API_URL}/task-runner/logs-history`);
    const data = await res.json();

    if (data.logs && data.logs.length > 0) {
      setLogs(data.logs);
    }

    // ✅ Restore running task after page refresh
    if (data.isRunning) {
      setLogs((prev) => [...prev, {
        timestamp: new Date().toISOString(),
        thread: 0,
        message: '🔄 Detected running task from previous session. Reconnecting...',
        type: 'info'
      }]);
      setTaskRunning(true);
      connectSSE();
      startHealthCheck();
    }
  } catch (err) {
    console.error('Error fetching logs history:', err);
  }
}, [connectSSE, startHealthCheck]);

useEffect(() => {
  fetchLogsHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // ⚠️ Run only once on mount
```

---

## 🔄 State Management

### ⚠️ CRITICAL: Refs vs State

**ปัญหา:**
```typescript
// ❌ BAD - Circular dependencies
const connectSSE = useCallback(() => {
  // ...
  if (taskRunning && reconnectAttempts < 5) { // Dependencies!
    // ...
  }
}, [taskRunning, reconnectAttempts]); // ← Re-creates on every state change
```

**วิธีแก้:**
```typescript
// ✅ GOOD - Use refs
const taskRunningRef = useRef(taskRunning);
const reconnectAttemptsRef = useRef(reconnectAttempts);

// Sync refs with state
useEffect(() => {
  taskRunningRef.current = taskRunning;
}, [taskRunning]);

const connectSSE = useCallback(() => {
  // ...
  if (taskRunningRef.current && reconnectAttemptsRef.current < 5) {
    // ✅ No dependencies
  }
}, [handleLogMessage]); // ← Minimal dependencies
```

---

### เมื่อไหร่ใช้ State vs Ref?

| Use Case | Use | Reason |
|---|---|---|
| แสดง UI (ปุ่ม, badge) | **State** | ต้อง trigger re-render |
| ใน callback/interval | **Ref** | หลีกเลี่ยง circular dependencies |
| ใน useEffect cleanup | **Ref** | ค่าล่าสุดเสมอ |
| เช็คเงื่อนไข async | **Ref** | ไม่ต้อง add dependencies |

---

## 📡 SSE Connection Logic

### Pattern Summary:

```typescript
// 1. Connect
const eventSource = new EventSource(`${API_URL}/task-runner/logs`);

// 2. Handle messages
eventSource.onmessage = (event) => {
  const log = JSON.parse(event.data);

  // Update state
  setLogs((prev) => [...prev, log]);

  // Reset activity timer
  lastActivityTimeRef.current = Date.now();
};

// 3. Handle errors
eventSource.onerror = () => {
  eventSource.close();

  // Retry with exponential backoff
  if (taskRunningRef.current && reconnectAttemptsRef.current < 5) {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
    setTimeout(() => connectSSE(), delay);
  }
};

// 4. Cleanup on unmount
useEffect(() => {
  return () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };
}, []);
```

---

### Exponential Backoff:

| Attempt | Delay | Formula |
|---|---|---|
| 1 | 1s | `1000 * 2^0` |
| 2 | 2s | `1000 * 2^1` |
| 3 | 4s | `1000 * 2^2` |
| 4 | 8s | `1000 * 2^3` |
| 5 | 10s | `min(1000 * 2^4, 10000)` |

---

## 🐛 Error Handling

### 1. Backend Duplicate Start Protection

```typescript
@Post('start')
async startTask() {
  if (this.taskRunnerService.isTaskRunning()) {
    return {
      message: 'Task is already running',
      isRunning: true,
      error: 'ALREADY_RUNNING'
    };
  }
  // ...
}
```

### 2. Frontend Handling

```typescript
const startTaskWithSSE = async () => {
  setTaskRunning(true);
  connectSSE();
  startHealthCheck();

  try {
    const response = await fetch(`${API_URL}/task-runner/start`, { method: 'POST' });
    const data = await response.json();

    // ✅ Handle ALREADY_RUNNING error
    if (data.error === 'ALREADY_RUNNING') {
      setLogs((prev) => [...prev, {
        timestamp: new Date().toISOString(),
        thread: 0,
        message: '⚠️ Task already running. Connected to existing task.',
        type: 'warning'
      }]);
    }
  } catch (err) {
    setTaskRunning(false);
    stopHealthCheck();
  }
};
```

---

### 3. Graceful Stop with Verification

```typescript
const handleStopTask = async () => {
  // 1. Cancel pending operations
  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current);
  }
  stopHealthCheck();

  // 2. Close SSE
  if (eventSourceRef.current) {
    eventSourceRef.current.close();
  }

  // 3. Send stop request
  await fetch(`${API_URL}/task-runner/stop`, { method: 'POST' });

  // 4. ✅ Verify backend stopped (max 5 seconds)
  await new Promise(resolve => setTimeout(resolve, 500));
  const statusData = await fetch(`${API_URL}/task-runner/status`).then(r => r.json());

  if (statusData.isRunning) {
    // Wait until it actually stops
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const checkData = await fetch(`${API_URL}/task-runner/status`).then(r => r.json());
      if (!checkData.isRunning) break;
    }
  }

  setTaskRunning(false);
};
```

---

### 4. Health Check (Timeout Detection)

```typescript
const startHealthCheck = useCallback(() => {
  healthCheckIntervalRef.current = setInterval(() => {
    const timeSinceLastActivity = Date.now() - lastActivityTimeRef.current;
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    // ⚠️ Use ref, not state
    if (timeSinceLastActivity > TIMEOUT_MS && taskRunningRef.current) {
      setLogs((prev) => [...prev, {
        message: '⚠️ Task stuck (no activity for 5 minutes). Stopping...',
        type: 'error'
      }]);
      setTaskRunning(false);
      stopHealthCheckRef.current?.();
      eventSourceRef.current?.close();
    }
  }, 30000); // Every 30s
}, []);
```

---

## 🎯 Best Practices

### 1. Logging Strategy

```typescript
// ✅ DO: Log with context
this.log(threadNum, `Processing file #${fileNumber}: ${fileName}`, 'info');
this.log(0, `✅ Batch complete: ${count} file(s) processed`, 'success');

// ❌ DON'T: Generic logs
this.log(0, 'Done', 'success');
```

### 2. State Updates

```typescript
// ✅ DO: Use functional setState
setLogs((prev) => [...prev, newLog]);
setTaskRunning((current) => !current);

// ❌ DON'T: Direct setState
setLogs([...logs, newLog]); // ← Can cause race conditions
```

### 3. Cleanup

```typescript
useEffect(() => {
  // Setup
  const eventSource = new EventSource(url);

  // ✅ ALWAYS cleanup
  return () => {
    eventSource.close();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };
}, []);
```

### 4. Dependencies

```typescript
// ✅ DO: Minimize dependencies
const myCallback = useCallback(() => {
  // Use refs instead of state
  if (stateRef.current) {
    doSomething();
  }
}, []); // No dependencies

// ❌ DON'T: Add unnecessary dependencies
const myCallback = useCallback(() => {
  if (state) { // ← Adds dependency
    doSomething();
  }
}, [state]); // ← Re-creates on every state change
```

---

## ⚠️ Common Pitfalls

### Pitfall #1: Circular Dependencies

**ปัญหา:**
```typescript
useEffect(() => {
  fetchData();
}, [fetchData]); // ← fetchData recreates

const fetchData = useCallback(() => {
  if (state) { /* ... */ }
}, [state]); // ← Recreates when state changes
```

**วิธีแก้:**
```typescript
useEffect(() => {
  fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Run once

// หรือ use ref
const fetchData = useCallback(() => {
  if (stateRef.current) { /* ... */ }
}, []); // No dependencies
```

---

### Pitfall #2: State Mismatch (Frontend ↔ Backend)

**ปัญหา:**
- Frontend คิดว่า task หยุด แต่ Backend ยังรัน
- กด Start ใหม่ → Backend reject

**วิธีแก้:**
```typescript
// ✅ Always check backend status before start
const statusData = await fetch('/task-runner/status').then(r => r.json());
if (statusData.isRunning) {
  // Reconnect instead of start new
  setTaskRunning(true);
  connectSSE();
  return;
}
```

---

### Pitfall #3: SSE Not Closed on Stop

**ปัญหา:**
- กด Stop แต่ SSE ยังเชื่อมต่อ
- ได้รับ logs ต่อไป

**วิธีแก้:**
```typescript
const handleStopTask = async () => {
  // ✅ Close SSE BEFORE sending stop request
  if (eventSourceRef.current) {
    eventSourceRef.current.close();
  }

  await fetch('/task-runner/stop', { method: 'POST' });
  setTaskRunning(false);
};
```

---

### Pitfall #4: Not Waiting for Backend to Stop

**ปัญหา:**
- Frontend set `taskRunning = false` ทันที
- แต่ Backend infinite loop ยังทำงาน
- กด Start ใหม่ → Error "already running"

**วิธีแก้:**
```typescript
// ✅ Wait for backend to actually stop
await fetch('/task-runner/stop', { method: 'POST' });

// Wait and verify
await new Promise(resolve => setTimeout(resolve, 500));
const statusData = await fetch('/task-runner/status').then(r => r.json());

if (statusData.isRunning) {
  // Poll until it stops (max 5 seconds)
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const checkData = await fetch('/task-runner/status').then(r => r.json());
    if (!checkData.isRunning) break;
  }
}

setTaskRunning(false);
```

---

## 📊 Flow Diagram

### Start Flow:

```
User clicks Start
    ↓
Check frontend ref (taskRunningRef.current)
    ↓ (if not running)
Check backend status (GET /task-runner/status)
    ↓ (if not running)
Set taskRunning = true
    ↓
Connect SSE (task-runner/logs)
    ↓
Start health check (interval 30s)
    ↓
POST /task-runner/start
    ↓
Backend starts infinite loop
    ↓
Logs stream via SSE → Frontend terminal
```

---

### Stop Flow:

```
User clicks Stop
    ↓
Cancel reconnect timeout
    ↓
Stop health check interval
    ↓
Close SSE connection
    ↓
POST /task-runner/stop
    ↓
Wait 500ms
    ↓
GET /task-runner/status
    ↓ (if still running)
Poll every 500ms (max 10 times)
    ↓
Wait until backend.isRunning = false
    ↓
Set taskRunning = false
    ↓
UI updates (show Start button)
```

---

### SSE Reconnect Flow:

```
SSE connection error
    ↓
Close connection
    ↓
Check taskRunningRef.current
    ↓ (if true)
Check reconnectAttemptsRef.current < 5
    ↓ (if true)
Calculate delay (exponential backoff)
    ↓
Show warning log
    ↓
Wait delay milliseconds
    ↓
Reconnect SSE
    ↓
Reset reconnectAttempts on success
```

---

## 🎯 Key Takeaways

### 1. **Always Use Refs for Callbacks/Intervals**
```typescript
// ✅ Refs stay stable
const myRef = useRef(value);

useEffect(() => {
  myRef.current = value;
}, [value]);

// Use in callback
const myCallback = useCallback(() => {
  if (myRef.current) { /* ... */ }
}, []); // No dependencies
```

---

### 2. **Sync Frontend ↔ Backend State**
```typescript
// On mount: restore state
const data = await fetch('/status').then(r => r.json());
if (data.isRunning) {
  setTaskRunning(true);
  connectSSE();
}

// Before start: check backend
const status = await fetch('/status').then(r => r.json());
if (status.isRunning) {
  // Reconnect instead
  return;
}

// After stop: verify backend stopped
await fetch('/stop');
await waitForBackendToStop();
setTaskRunning(false);
```

---

### 3. **Backend Must Reject Duplicate Start**
```typescript
@Post('start')
async startTask() {
  if (this.taskRunnerService.isTaskRunning()) {
    return { error: 'ALREADY_RUNNING', isRunning: true };
  }
  // ...
}
```

---

### 4. **Cleanup Everything**
```typescript
useEffect(() => {
  return () => {
    eventSourceRef.current?.close();
    clearInterval(healthCheckIntervalRef.current);
    clearTimeout(reconnectTimeoutRef.current);
  };
}, []);
```

---

## 📚 Reference Implementation

### Files:
- **Backend Service:** `backend/src/task-runner/task-runner.service.ts`
- **Backend Controller:** `backend/src/task-runner/task-runner.controller.ts`
- **Frontend Page:** `frontend/src/app/stages/01-raw/page.tsx`

### Key Features:
- ✅ Infinite Worker Loop
- ✅ Real-time SSE Logging
- ✅ Start/Stop Control
- ✅ State Synchronization
- ✅ Auto Reconnect (exponential backoff)
- ✅ Health Check (timeout detection)
- ✅ Graceful Shutdown
- ✅ Error Handling

---

## 🔄 Reusable Template

### Quick Start Checklist:

**Backend:**
- [ ] สร้าง Service ด้วย `isRunning` flag
- [ ] เพิ่ม `ReplaySubject<LogMessage>` สำหรับ SSE
- [ ] เพิ่ม `logHistory[]` สำหรับ GET history
- [ ] สร้าง `startTask()` ด้วย `while (isRunning)` loop
- [ ] เพิ่ม `stopTask()` ที่ set `isRunning = false`
- [ ] เพิ่ม `log()` method ที่ broadcast + save history
- [ ] Controller: เพิ่ม check `isTaskRunning()` ก่อน start

**Frontend:**
- [ ] สร้าง state: `taskRunning`, `logs`, `reconnectAttempts`
- [ ] สร้าง refs: `taskRunningRef`, `reconnectAttemptsRef`, `eventSourceRef`
- [ ] สร้าง `connectSSE()` ด้วย exponential backoff
- [ ] สร้าง `startHealthCheck()` ด้วย timeout detection
- [ ] `handleStartTask()` - เช็ค backend status ก่อน start
- [ ] `handleStopTask()` - รอให้ backend หยุดจริง
- [ ] `fetchLogsHistory()` - restore state on mount
- [ ] Cleanup SSE/intervals on unmount

---

**สร้างโดย:** OCR Flow Development Team
**Use Case:** Stage 01 - Raw to Group Processing
**Last Updated:** 2025-12-13
