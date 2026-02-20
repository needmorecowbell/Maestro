---
title: Encores
description: Extend Maestro with custom encores — lightweight plugins that react to agent events, store data, and integrate with external services.
icon: puzzle-piece
---

Encores are Maestro's extension system. An encore is a self-contained JavaScript module that runs in the main process and reacts to agent lifecycle events, token usage, tool executions, and more. Encores are discovered at runtime from your user data directory — no app modifications required.

## Core Concepts

An encore consists of a directory containing:

| File | Required | Purpose |
|------|----------|---------|
| `manifest.json` | Yes | Metadata, permissions, settings schema |
| `index.js` | Yes | Main entry point (Node.js module) |
| `README.md` | No | Documentation shown in the Encore Manager UI |

Maestro scans the encores directory on startup. Each valid manifest is registered and shown in **Settings > Encores**. When a user toggles an encore on, Maestro calls its `activate()` function with a scoped API. When toggled off, `deactivate()` is called for cleanup.

### Lifecycle

```
discovered → (user enables) → active
                              ↓
                          (user disables or error)
                              ↓
                           disabled / error
```

All encores start **disabled**. Enabled/disabled state persists across restarts.

## Using Encores

### Where Encores Live

Encores are stored in your Maestro user data directory:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/maestro/encores/` |
| Linux | `~/.config/maestro/encores/` |
| Windows | `%APPDATA%\maestro\encores\` |

### Installing an Encore

1. Copy the encore folder into your encores directory
2. Open Maestro and go to **Settings > Encores**
3. Click **Refresh** if the encore doesn't appear
4. Toggle it on

### Managing Encores

Open **Settings > Encores** or press `Ctrl+Shift+X` to access the Encore Manager. From there you can:

- Browse discovered encores and read their documentation
- Toggle encores on and off
- Configure per-encore settings (webhook URLs, output paths, etc.)

### Bundled Encores

Maestro ships with two first-party encores:

**Agent Status Exporter** — Writes a `status.json` file with real-time metrics for all active agents (token usage, cost, tool executions, runtime). Updates on activity and every 10 seconds as a heartbeat. Useful for external dashboards or monitoring scripts.

**Notification Webhook** — Sends HTTP POST requests when agents complete tasks or encounter errors. Configure a webhook URL and Maestro will POST JSON payloads with session ID, agent type, exit code, and recent output.

## Building an Encore

### Project Structure

```
my-encore/
├── manifest.json
├── index.js
└── README.md       (optional)
```

### Manifest

The manifest declares your encore's identity, permissions, and configurable settings.

```json
{
  "id": "my-encore",
  "name": "My Encore",
  "version": "1.0.0",
  "description": "A short description of what this encore does.",
  "author": "Your Name",
  "main": "index.js",
  "permissions": ["process:read", "storage"],
  "settings": [
    {
      "key": "outputPath",
      "type": "string",
      "label": "Output Path",
      "default": ""
    },
    {
      "key": "enabled",
      "type": "boolean",
      "label": "Enable Feature",
      "default": true
    }
  ],
  "tags": ["monitoring", "automation"]
}
```

**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Lowercase alphanumeric and hyphens only (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`) |
| `name` | string | Display name |
| `version` | string | Semver version |
| `description` | string | Short description |
| `author` | string | Author name |
| `main` | string | Entry point file relative to encore directory |
| `permissions` | string[] | Array of permission strings (see below) |

**Optional fields:**

| Field | Type | Purpose |
|-------|------|---------|
| `authorLink` | string | URL to author's website |
| `minMaestroVersion` | string | Minimum Maestro version required |
| `renderer` | string | Renderer-process entry point (for split-architecture encores) |
| `settings` | array | Configurable settings rendered in the UI |
| `tags` | string[] | Searchable keywords |
| `ui` | object | UI surface registrations (right panel tabs, settings section) |

### Entry Point

Your `index.js` must export an `activate` function. An optional `deactivate` function is called on cleanup.

```javascript
let api = null;

async function activate(encoreApi) {
  api = encoreApi;

  // Subscribe to agent events
  api.process.onExit((sessionId, code) => {
    console.log(`Agent ${sessionId} exited with code ${code}`);
  });

  // Read a setting
  const outputPath = await api.settings.get('outputPath');

  // Write to scoped storage
  await api.storage.write('state.json', JSON.stringify({ started: Date.now() }));
}

async function deactivate() {
  // Clean up timers, subscriptions, etc.
  api = null;
}

module.exports = { activate, deactivate };
```

Event subscriptions registered through the API are automatically cleaned up when the encore is deactivated — you don't need to manually unsubscribe.

## Permissions

Encores declare the permissions they need in their manifest. The API object passed to `activate()` only includes namespaces for granted permissions.

| Permission | API Namespace | Description |
|-----------|---------------|-------------|
| `process:read` | `api.process` | Subscribe to agent output, usage stats, tool executions, exit events |
| `process:write` | `api.processControl` | Send input to agents, kill processes |
| `stats:read` | `api.stats` | Query aggregated usage statistics |
| `settings:read` | `api.settings` | Read encore-scoped settings |
| `settings:write` | `api.settings` | Read and write encore-scoped settings |
| `storage` | `api.storage` | Read/write files in the encore's data directory |
| `notifications` | `api.notifications` | Show desktop notifications, play sounds |
| `network` | — | Declares intent to make network requests |

The `api.maestro` namespace is always available regardless of permissions.

## API Reference

### `api.maestro` — Metadata (always available)

```typescript
api.maestro.version    // Maestro app version (string)
api.maestro.platform   // 'win32' | 'darwin' | 'linux'
api.maestro.encoreId   // Your encore's ID from manifest
api.maestro.encoreDir  // Absolute path to your encore directory
api.maestro.dataDir    // Absolute path to your data directory
```

### `api.process` — Agent Events (`process:read`)

```javascript
// List currently running agents
const agents = await api.process.getActiveProcesses();
// Returns: [{ sessionId, toolType, pid, startTime, name }]

// Subscribe to agent output
const unsub = api.process.onData((sessionId, data) => { });

// Subscribe to token/cost updates
api.process.onUsage((sessionId, stats) => {
  // stats: { inputTokens, outputTokens, cacheReadTokens, contextWindow, totalCostUsd }
});

// Subscribe to tool executions
api.process.onToolExecution((sessionId, tool) => {
  // tool: { toolName, state, timestamp }
});

// Subscribe to agent exits
api.process.onExit((sessionId, exitCode) => { });

// Subscribe to thinking/reasoning chunks
api.process.onThinkingChunk((sessionId, text) => { });
```

All `on*` methods return an unsubscribe function.

### `api.processControl` — Agent Control (`process:write`)

```javascript
api.processControl.kill(sessionId);          // Kill agent process
api.processControl.write(sessionId, data);   // Send input to agent
```

### `api.stats` — Usage Statistics (`stats:read`)

```javascript
const stats = await api.stats.getAggregation('7d');  // '24h', '7d', '30d', 'all'
api.stats.onStatsUpdate(() => { /* stats changed */ });
```

### `api.settings` — Scoped Settings (`settings:read` / `settings:write`)

Settings are automatically namespaced to your encore. When you call `api.settings.get('webhookUrl')`, Maestro reads `encore:my-encore:webhookUrl` from the store.

```javascript
const value = await api.settings.get('key');
await api.settings.set('key', value);         // Requires settings:write
const all = await api.settings.getAll();       // { key: value, ... }
```

Settings declared in your manifest's `settings` array are automatically rendered in the Encore Manager UI with appropriate input controls.

### `api.storage` — File Storage (`storage`)

Files are stored in `userData/encores/<id>/data/`. Filenames are validated — path traversal (`..`), absolute paths, and null bytes are rejected.

```javascript
await api.storage.write('output.json', jsonString);
const content = await api.storage.read('output.json');  // string | null
const files = await api.storage.list();                  // string[]
await api.storage.delete('output.json');
```

### `api.notifications` — Desktop Notifications (`notifications`)

```javascript
await api.notifications.show('Title', 'Body text');
await api.notifications.playSound('default');
```

### `api.ipcBridge` — Renderer Communication

For encores with a renderer component, the IPC bridge enables communication between main-process and renderer-process code.

```javascript
// In main process (index.js): register a handler
api.ipcBridge.onMessage('getData', () => {
  return { agents: Array.from(agents.values()) };
});

// Send data to the renderer component
api.ipcBridge.sendToRenderer('update', { count: 42 });
```

## Settings Schema

The `settings` array in your manifest defines configurable options that Maestro renders automatically in the UI.

```json
"settings": [
  { "key": "webhookUrl", "type": "string", "label": "Webhook URL", "default": "" },
  { "key": "verbose", "type": "boolean", "label": "Verbose Logging", "default": false },
  { "key": "interval", "type": "number", "label": "Poll Interval (ms)", "default": 5000 },
  {
    "key": "format",
    "type": "select",
    "label": "Output Format",
    "default": "json",
    "options": [
      { "label": "JSON", "value": "json" },
      { "label": "CSV", "value": "csv" }
    ]
  }
]
```

Supported types: `string`, `boolean`, `number`, `select`.

## Example: Minimal Encore

A complete encore that logs agent exits to a file:

**manifest.json**
```json
{
  "id": "exit-logger",
  "name": "Exit Logger",
  "version": "1.0.0",
  "description": "Logs agent exit events to a file.",
  "author": "You",
  "main": "index.js",
  "permissions": ["process:read", "storage"],
  "tags": ["logging"]
}
```

**index.js**
```javascript
let api = null;

async function activate(encoreApi) {
  api = encoreApi;

  api.process.onExit(async (sessionId, code) => {
    const existing = await api.storage.read('exits.log') || '';
    const line = `${new Date().toISOString()} session=${sessionId} code=${code}\n`;
    await api.storage.write('exits.log', existing + line);
  });
}

async function deactivate() {
  api = null;
}

module.exports = { activate, deactivate };
```

Drop this folder into your encores directory, toggle it on in Settings, and every agent exit will be appended to `exits.log` in the encore's data directory.

## Limitations

- **No sandboxing (v1)** — Encores run in the same Node.js process as Maestro. The permission system scopes the API surface but does not prevent direct `require('fs')` calls. Only install encores you trust.
- **No hot-reload** — Code changes require an app restart. Toggling off and on re-runs `activate()` but Node.js caches `require()` results.
- **No marketplace** — Encores are installed manually by placing folders in the encores directory. There is no built-in install UI or package manager.
- **No renderer sandboxing** — Renderer components (if declared via `renderer` in manifest) run in an iframe but share the Electron context.
