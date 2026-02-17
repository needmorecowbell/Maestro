# Maestro Environment Variable Management Architecture

## Overview

This document describes how Maestro manages global environment variables and how they flow through terminal sessions and agent sessions.

## 1. Storage & Configuration

### 1.1 Global Shell Environment Variables Storage

**Location**: `electron-store` (persistent storage)

- **Key**: `shellEnvVars`
- **Type**: `Record<string, string>`
- **Default**: `{}` (empty object)

**Related Settings**:

- `defaultShell`: Default shell (`bash`, `zsh`, `fish`, `powershell`, etc.)
- `customShellPath`: Custom path to shell executable
- `shellArgs`: Custom arguments to pass to shell

**Files**:

- Settings storage type: `src/main/stores/types.ts` (MaestroSettings interface)
- Settings defaults: `src/main/stores/defaults.ts`
- Settings store initialization: `src/main/stores/instances.ts`
- Persistence handlers: `src/main/ipc/handlers/persistence.ts`

### 1.2 Renderer-Side Store

**Location**: `src/renderer/stores/settingsStore.ts` (Zustand store)

- Loads from electron-store on app startup via `loadAllSettings()`
- Single batch load eliminates ~60 individual IPC calls
- Selector-based subscriptions for efficient re-renders
- Can be used outside React via `useSettingsStore.getState()`

**Key Fields**:

```typescript
shellEnvVars: Record<string, string>; // Global env vars
defaultShell: string; // Default shell
customShellPath: string; // Custom shell path
shellArgs: string; // Shell arguments
```

**Persistence Flow**:
`Renderer (Zustand) → IPC (settings:set) → Main (electron-store)`

### 1.3 Agent-Specific Environment Variables

**Location**: `src/main/stores/types.ts` (AgentConfigsData)

- **Structure**: `configs: Record<string, Record<string, any>>`
- **Key**: `agentId` → config object
- **Use**: Per-agent custom env vars, paths, args

## 2. Terminal Session Environment Variables

### 2.1 Terminal Spawning Flow

```
ProcessManager.spawn(config)
    ↓
PtySpawner.spawn(config)
    ↓
buildPtyTerminalEnv(shellEnvVars)
    ↓
pty.spawn() with environment
```

**File**: `src/main/process-manager/spawners/PtySpawner.ts`

### 2.2 Environment Building for Terminals

**File**: `src/main/process-manager/utils/envBuilder.ts`

**Function**: `buildPtyTerminalEnv(shellEnvVars?: Record<string, string>): NodeJS.ProcessEnv`

**Flow**:

1. **Windows**: Inherits full parent process environment + TERM
2. **Unix**: Creates minimal environment with HOME, USER, SHELL, TERM, LANG, and expanded PATH
3. Custom shell env vars applied on top

### 2.3 Terminal Configuration via Settings UI

**File**: `src/renderer/components/SettingsModal.tsx`

**Where to Find**: Settings → General → Shell Configuration

## 3. Agent Session Environment Variables

### 3.1 Agent Spawning Flow

```
ProcessManager.spawn(config)
    ↓
ChildProcessSpawner.spawn(config) OR PtySpawner.spawn(config)
    ↓
buildChildProcessEnv() OR buildPtyTerminalEnv()
    ↓
spawn(command, args, { env: ... })
```

### 3.2 Agent Environment Building

**File**: `src/main/process-manager/utils/envBuilder.ts`

**Function**: `buildChildProcessEnv(customEnvVars?: Record<string, string>, isResuming?: boolean, globalShellEnvVars?: Record<string, string>)`

**Key Features**:

1. Strips problematic variables (ELECTRON\_\*, CLAUDECODE, NODE_ENV)
2. Starts with clean process environment
3. Sets PATH to expanded path (includes Node version managers)
4. Applies global shell environment variables (from Settings)
5. Applies session-level custom environment variables (overrides global)

### 3.3 Environment Variable Precedence

**Highest to Lowest Priority**:

1. Session-level custom env vars (`sessionCustomEnvVars`)
2. Global shell env vars (`shellEnvVars` from Settings → General → Shell Configuration)
3. Agent-level config env vars (agent defaults)
4. Process environment (with problematic vars stripped)

## 4. Solution: Global Env Vars Now Applied to Agents

### 4.1 Implementation Summary

**Status**: ✓ FIXED

Global `shellEnvVars` (from Settings → General → Shell Configuration) are now:

- Applied to terminal sessions ✓
- Applied to agent sessions ✓

### 4.2 Data Flow (Fixed)

**Terminal Sessions**:

```
Settings.shellEnvVars
    ↓
ProcessConfig.shellEnvVars
    ↓
buildPtyTerminalEnv(shellEnvVars)
    ✓ Applied to PTY environment
```

**Agent Sessions** (now fixed):

```
Settings.shellEnvVars
    ↓
ProcessConfig.shellEnvVars (passed from IPC handler)
    ↓
ChildProcessSpawner.spawn(config) extracts shellEnvVars
    ↓
buildChildProcessEnv(customEnvVars, isResuming, globalShellEnvVars)
    ✓ Global vars applied to child process
    ✓ Session vars override global vars
```

### 4.3 Code Changes

**Files Modified**:

1. **`src/main/process-manager/utils/envBuilder.ts`**
   - Added `globalShellEnvVars` parameter to `buildChildProcessEnv()`
   - Implements precedence: session vars override global vars
   - Added documentation

2. **`src/main/process-manager/spawners/ChildProcessSpawner.ts`**
   - Extracts `shellEnvVars` from ProcessConfig
   - Passes to `buildChildProcessEnv()` as third parameter

3. **`src/main/ipc/handlers/process.ts`**
   - Loads global shell env vars for ALL tool types (not just terminals)
   - Passes `globalShellEnvVars` to processManager.spawn()
   - Updated comments to clarify behavior

### 4.4 Data Path Walkthrough

1. User sets env var via Settings UI: `TEST_VAR=hello`
2. Renderer calls `settings:set` IPC handler
3. electron-store persists: `shellEnvVars: { TEST_VAR: 'hello' }`
4. Renderer request to spawn agent session
5. IPC handler reads: `const globalShellEnvVars = settingsStore.get('shellEnvVars', {})`
6. Passes to ProcessManager: `shellEnvVars: globalShellEnvVars`
7. ProcessConfig receives: `shellEnvVars: { TEST_VAR: 'hello' }`
8. ChildProcessSpawner extracts it from config
9. buildChildProcessEnv() applies it to environment
10. Agent process spawned with `TEST_VAR=hello` available

### 4.5 Backward Compatibility

- Existing code without global env vars continues to work
- No breaking changes to function signatures (new parameter is optional)
- Session-level overrides still take precedence (expected behavior)

## 5. File Locations Reference

### Settings & Persistence

- `src/main/stores/types.ts` - Store type definitions
- `src/main/stores/defaults.ts` - Default values
- `src/main/stores/instances.ts` - Store initialization
- `src/main/ipc/handlers/persistence.ts` - IPC persistence handlers
- `src/main/preload/settings.ts` - IPC bridge

### Settings Store (Renderer)

- `src/renderer/stores/settingsStore.ts` - Zustand store
- `src/renderer/components/SettingsModal.tsx` - Settings UI
- `src/renderer/hooks/settings/useSettings.ts` - Settings hook

### Terminal & Process Management

- `src/main/ipc/handlers/process.ts` - IPC handlers
- `src/main/process-manager/ProcessManager.ts` - Orchestration
- `src/main/process-manager/spawners/PtySpawner.ts` - Terminal spawning
- `src/main/process-manager/spawners/ChildProcessSpawner.ts` - Agent spawning
- `src/main/process-manager/utils/envBuilder.ts` - Environment construction
- `src/main/process-manager/runners/LocalCommandRunner.ts` - Command execution

### Agent Management

- `src/main/agents/session-storage.ts` - Session storage interface
- `src/main/agents/definitions.ts` - Agent definitions
- `src/main/agents/detector.ts` - Agent detection

## 6. Key Data Structures

### SettingsStoreState (renderer/stores/settingsStore.ts)

```typescript
interface SettingsStoreState {
	shellEnvVars: Record<string, string>; // Global environment variables
	defaultShell: string; // Default shell name/path
	customShellPath: string; // Custom shell executable path
	shellArgs: string; // Shell command-line arguments
}
```

### ProcessConfig (process-manager/types.ts)

```typescript
interface ProcessConfig {
  sessionId: string;
  toolType: 'terminal' | 'claude-code' | 'codex' | ...;
  shell?: string;
  shellArgs?: string;
  shellEnvVars?: Record<string, string>;  // Global env vars (terminals)
  sessionCustomEnvVars?: Record<string, string>;  // Session overrides
}
```

## 7. Summary

**Current State**:

1. Global configuration (`shellEnvVars`, `defaultShell`, `shellArgs`) stored and managed correctly
2. Terminal sessions receive and apply global env vars correctly
3. Agent sessions DO NOT receive global env vars (only session/agent-level configs)

**Gap**:

- Global environment variables not threaded to agent spawning functions
- Fix requires passing `shellEnvVars` through to `buildChildProcessEnv()`
- Would need merging global vars with session-level overrides in correct precedence order
