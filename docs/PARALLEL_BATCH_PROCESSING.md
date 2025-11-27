# Parallel Batch Processing with Git Worktrees

## Overview

This document outlines the implementation plan for adding parallel batch processing to Maestro's Auto Runner feature. When tasks are independent, they can be executed simultaneously using git worktrees, dramatically reducing total execution time.

## Current State

The current batch processor (`useBatchProcessor.ts`) executes tasks **serially**:
1. Reads unchecked tasks from scratchpad
2. Spawns Claude agent for task 1, waits for completion
3. Spawns Claude agent for task 2, waits for completion
4. ... and so on

**Limitation**: If you have 5 independent tasks that each take 2 minutes, total time is ~10 minutes.

**With Parallel**: Same 5 tasks could complete in ~2-3 minutes (limited by concurrent worker count).

## Architecture

### Git Worktrees

Git worktrees allow multiple working directories to share the same `.git` repository:

```
/Users/project/              <- Main worktree (main branch)
/Users/project/.worktrees/
  ├── task-1-abc123/         <- Worktree 1 (feature branch)
  ├── task-2-def456/         <- Worktree 2 (feature branch)
  └── task-3-ghi789/         <- Worktree 3 (feature branch)
```

Each worktree:
- Has its own working directory with full file tree
- Can be on a different branch
- Shares git history with the main repo
- Changes can be merged back to main

### Component Changes

```
┌─────────────────────────────────────────────────────────────────┐
│                     BatchRunnerModal.tsx                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Prompt Customization                                    │    │
│  │  [textarea for custom prompt...]                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Execution Mode                                          │    │
│  │                                                          │    │
│  │  ○ Serial (default)     ○ Parallel                       │    │
│  │    Tasks run one          Tasks run simultaneously       │    │
│  │    after another          using git worktrees            │    │
│  │                                                          │    │
│  │  [If Parallel selected:]                                 │    │
│  │  Max Concurrent Workers: [3 ▼]                           │    │
│  │  ⚠️ Requires git repository                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  [Cancel]                                    [Start Batch Run]   │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Git Worktree IPC Handlers

Add to `src/main/index.ts`:

```typescript
// Git Worktree API
ipcMain.handle('git:worktree:create', async (_event, cwd: string, name: string, branch?: string) => {
  // Create worktree directory
  const worktreeDir = path.join(cwd, '.maestro-worktrees', name);

  // Create branch name if not provided
  const branchName = branch || `maestro-parallel-${name}`;

  // git worktree add -b <branch> <path>
  const result = await execFileNoThrow('git', [
    'worktree', 'add', '-b', branchName, worktreeDir
  ], cwd);

  if (result.exitCode !== 0) {
    return { success: false, error: result.stderr };
  }

  return { success: true, path: worktreeDir, branch: branchName };
});

ipcMain.handle('git:worktree:remove', async (_event, cwd: string, worktreePath: string) => {
  // git worktree remove <path> --force
  const result = await execFileNoThrow('git', [
    'worktree', 'remove', worktreePath, '--force'
  ], cwd);

  return { success: result.exitCode === 0, error: result.stderr };
});

ipcMain.handle('git:worktree:list', async (_event, cwd: string) => {
  const result = await execFileNoThrow('git', ['worktree', 'list', '--porcelain'], cwd);
  // Parse output into structured data
  return parseWorktreeList(result.stdout);
});

ipcMain.handle('git:merge:branch', async (_event, cwd: string, branchName: string) => {
  // Merge a worktree branch back to current branch
  const result = await execFileNoThrow('git', ['merge', branchName, '--no-edit'], cwd);
  return { success: result.exitCode === 0, error: result.stderr };
});

ipcMain.handle('git:branch:delete', async (_event, cwd: string, branchName: string) => {
  const result = await execFileNoThrow('git', ['branch', '-D', branchName], cwd);
  return { success: result.exitCode === 0 };
});
```

### Phase 2: Preload API

Add to `src/main/preload.ts`:

```typescript
git: {
  // ... existing methods ...

  // Worktree operations
  worktree: {
    create: (cwd: string, name: string, branch?: string) =>
      ipcRenderer.invoke('git:worktree:create', cwd, name, branch),
    remove: (cwd: string, worktreePath: string) =>
      ipcRenderer.invoke('git:worktree:remove', cwd, worktreePath),
    list: (cwd: string) =>
      ipcRenderer.invoke('git:worktree:list', cwd),
  },
  merge: {
    branch: (cwd: string, branchName: string) =>
      ipcRenderer.invoke('git:merge:branch', cwd, branchName),
  },
  branch: {
    delete: (cwd: string, branchName: string) =>
      ipcRenderer.invoke('git:branch:delete', cwd, branchName),
  },
},
```

### Phase 3: Parallel Batch Processor

Create `src/renderer/hooks/useParallelBatchProcessor.ts`:

```typescript
interface ParallelBatchConfig {
  maxConcurrent: number;  // Default: 3
  mode: 'serial' | 'parallel';
}

interface WorkerState {
  id: string;
  worktreePath: string;
  branchName: string;
  taskIndex: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'merging';
  claudeSessionId?: string;
  error?: string;
}

export function useParallelBatchProcessor({
  sessions,
  onUpdateSession,
  onSpawnAgent,
  onAddHistoryEntry,
  config
}: ParallelBatchProcessorProps) {

  const [workers, setWorkers] = useState<Map<string, WorkerState>>(new Map());

  const startParallelBatch = useCallback(async (
    sessionId: string,
    tasks: string[],  // Array of task descriptions
    prompt: string
  ) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || !session.isGitRepo) {
      console.error('Parallel batch requires git repository');
      return;
    }

    // Limit concurrent workers
    const workerCount = Math.min(tasks.length, config.maxConcurrent);
    const taskQueue = [...tasks];
    const activeWorkers: Promise<void>[] = [];
    const completedBranches: string[] = [];

    // Worker function - processes tasks from queue
    const runWorker = async (workerId: number) => {
      while (taskQueue.length > 0) {
        const taskIndex = tasks.length - taskQueue.length;
        const task = taskQueue.shift()!;

        // Create worktree for this task
        const worktreeName = `task-${taskIndex}-${Date.now()}`;
        const worktree = await window.maestro.git.worktree.create(
          session.cwd,
          worktreeName
        );

        if (!worktree.success) {
          console.error(`Failed to create worktree: ${worktree.error}`);
          continue;
        }

        // Update worker state
        setWorkers(prev => {
          const updated = new Map(prev);
          updated.set(worktreeName, {
            id: worktreeName,
            worktreePath: worktree.path,
            branchName: worktree.branch,
            taskIndex,
            status: 'running'
          });
          return updated;
        });

        try {
          // Spawn agent in worktree directory
          const result = await spawnAgentInWorktree(
            sessionId,
            worktree.path,
            task,
            prompt
          );

          // Mark completed
          setWorkers(prev => {
            const updated = new Map(prev);
            const worker = updated.get(worktreeName);
            if (worker) {
              worker.status = 'completed';
              worker.claudeSessionId = result.claudeSessionId;
            }
            return updated;
          });

          completedBranches.push(worktree.branch);

        } catch (error) {
          setWorkers(prev => {
            const updated = new Map(prev);
            const worker = updated.get(worktreeName);
            if (worker) {
              worker.status = 'failed';
              worker.error = String(error);
            }
            return updated;
          });
        }
      }
    };

    // Start workers
    for (let i = 0; i < workerCount; i++) {
      activeWorkers.push(runWorker(i));
    }

    // Wait for all workers to complete
    await Promise.all(activeWorkers);

    // Merge phase - merge all completed branches back to main
    for (const branch of completedBranches) {
      const mergeResult = await window.maestro.git.merge.branch(session.cwd, branch);
      if (!mergeResult.success) {
        console.error(`Merge conflict on branch ${branch}: ${mergeResult.error}`);
        // Could prompt user to resolve manually
      }
    }

    // Cleanup - remove worktrees and branches
    const worktreeList = await window.maestro.git.worktree.list(session.cwd);
    for (const wt of worktreeList) {
      if (wt.path.includes('.maestro-worktrees')) {
        await window.maestro.git.worktree.remove(session.cwd, wt.path);
        await window.maestro.git.branch.delete(session.cwd, wt.branch);
      }
    }

  }, [sessions, config.maxConcurrent]);

  return {
    workers,
    startParallelBatch,
    // ... other methods
  };
}
```

### Phase 4: UI Components

#### BatchRunnerModal Updates

```typescript
// Add to BatchRunnerModal.tsx state
const [executionMode, setExecutionMode] = useState<'serial' | 'parallel'>('serial');
const [maxConcurrent, setMaxConcurrent] = useState(3);

// Add toggle UI
<div className="flex flex-col gap-3 mt-4">
  <label className="text-sm font-medium" style={{ color: theme.colors.textMain }}>
    Execution Mode
  </label>

  <div className="flex gap-4">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name="executionMode"
        value="serial"
        checked={executionMode === 'serial'}
        onChange={() => setExecutionMode('serial')}
      />
      <span style={{ color: theme.colors.textMain }}>Serial</span>
      <span className="text-xs" style={{ color: theme.colors.textDim }}>
        (one at a time)
      </span>
    </label>

    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name="executionMode"
        value="parallel"
        checked={executionMode === 'parallel'}
        onChange={() => setExecutionMode('parallel')}
        disabled={!activeSession?.isGitRepo}
      />
      <span style={{ color: activeSession?.isGitRepo ? theme.colors.textMain : theme.colors.textDim }}>
        Parallel
      </span>
      <span className="text-xs" style={{ color: theme.colors.textDim }}>
        (using git worktrees)
      </span>
    </label>
  </div>

  {executionMode === 'parallel' && (
    <div className="flex items-center gap-3 mt-2">
      <label className="text-sm" style={{ color: theme.colors.textDim }}>
        Max Concurrent:
      </label>
      <select
        value={maxConcurrent}
        onChange={(e) => setMaxConcurrent(Number(e.target.value))}
        className="px-2 py-1 rounded"
        style={{ backgroundColor: theme.colors.bgActivity, color: theme.colors.textMain }}
      >
        {[2, 3, 4, 5, 6].map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  )}

  {executionMode === 'parallel' && !activeSession?.isGitRepo && (
    <div className="flex items-center gap-2 text-xs" style={{ color: theme.colors.warning }}>
      <AlertTriangle className="w-4 h-4" />
      Parallel mode requires a git repository
    </div>
  )}
</div>
```

#### Parallel Progress Visualization

```typescript
// New component: ParallelBatchProgress.tsx
export function ParallelBatchProgress({ workers, theme }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from(workers.values()).map(worker => (
        <div
          key={worker.id}
          className="p-2 rounded text-xs"
          style={{
            backgroundColor: theme.colors.bgActivity,
            borderLeft: `3px solid ${getStatusColor(worker.status, theme)}`
          }}
        >
          <div className="font-medium">Task {worker.taskIndex + 1}</div>
          <div className="flex items-center gap-1 mt-1">
            {worker.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
            {worker.status === 'completed' && <Check className="w-3 h-3" />}
            {worker.status === 'failed' && <X className="w-3 h-3" />}
            <span style={{ color: theme.colors.textDim }}>{worker.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Merge Strategy Options

### Option A: Sequential Merge (Simpler)
After all tasks complete, merge branches one by one:
```
main ← task-1-branch ← task-2-branch ← task-3-branch
```
- Pros: Simpler conflict resolution
- Cons: Later merges may conflict with earlier changes

### Option B: Rebase Then Merge (Cleaner History)
Rebase each branch on main, then fast-forward merge:
```
git checkout task-1-branch && git rebase main
git checkout main && git merge task-1-branch --ff-only
```
- Pros: Linear history
- Cons: More complex, rebase can fail

### Option C: Octopus Merge (Single Commit)
Merge all branches at once:
```
git merge task-1 task-2 task-3 --no-edit
```
- Pros: Single merge commit
- Cons: Fails if any conflicts exist

**Recommendation**: Start with Option A (Sequential Merge) as it's most straightforward and handles conflicts gracefully.

## Conflict Handling

When merge conflicts occur:

1. **Detection**: Check merge exit code
2. **Notification**: Alert user with conflicting files list
3. **Options**:
   - Open conflicting files in editor
   - Skip this merge (keep changes in branch for manual resolution)
   - Abort and rollback

```typescript
const mergeResult = await window.maestro.git.merge.branch(cwd, branch);
if (!mergeResult.success && mergeResult.error?.includes('CONFLICT')) {
  // Get conflicting files
  const conflictFiles = await window.maestro.git.status(cwd);

  // Show notification
  onConflictDetected({
    branch,
    files: conflictFiles.filter(f => f.status === 'conflicted'),
    options: ['resolve', 'skip', 'abort']
  });
}
```

## Resource Considerations

### CPU/Memory
- Each worktree is a full working directory (disk space)
- Each Claude agent process consumes memory
- Recommend max 3-4 concurrent for typical machines

### API Rate Limits
- Multiple concurrent Claude sessions may hit rate limits
- Add exponential backoff/retry logic
- Consider sequential fallback if rate limited

### Disk Space
- Worktrees duplicate working files (not git objects)
- For 1GB repo, each worktree adds ~1GB
- Auto-cleanup on completion is essential

## File Structure After Implementation

```
src/
├── main/
│   └── index.ts                    # + git worktree IPC handlers
├── renderer/
│   ├── hooks/
│   │   ├── useBatchProcessor.ts    # Existing serial processor
│   │   └── useParallelBatchProcessor.ts  # New parallel processor
│   └── components/
│       ├── BatchRunnerModal.tsx    # + execution mode toggle
│       └── ParallelBatchProgress.tsx     # New progress visualization
```

## Testing Plan

1. **Unit Tests**
   - Worktree creation/removal
   - Branch merge logic
   - Task queue management

2. **Integration Tests**
   - Serial → Parallel mode switch
   - Multiple tasks completing in parallel
   - Conflict detection and handling

3. **Manual Tests**
   - Run 5 independent tasks in parallel
   - Run tasks with file conflicts
   - Test with non-git repository (should disable parallel)
   - Test cleanup after completion/failure

## Migration Path

1. **Phase 1**: Add worktree IPC handlers (no UI changes)
2. **Phase 2**: Add parallel processor hook (hidden behind feature flag)
3. **Phase 3**: Add UI toggle (default to serial)
4. **Phase 4**: Polish and enable by default for git repos

## Future Enhancements

1. **Smart Conflict Prevention**: Analyze task descriptions to detect potential file conflicts before starting
2. **Partial Parallelism**: Group related tasks for serial execution, parallelize independent groups
3. **Resource Monitoring**: Auto-adjust concurrency based on system load
4. **Persistent Worktrees**: Option to keep worktrees for debugging failed tasks
5. **Branch Naming**: User-configurable branch naming patterns
