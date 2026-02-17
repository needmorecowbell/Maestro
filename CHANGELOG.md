# Changelog

All notable changes to Maestro will be documented in this file.

## [Unreleased]

### New Features

#### Global Environment Variables Now Apply to Agents

Environment variables configured in **Settings → General → Shell Configuration → Global Environment Variables** are now available to all AI agent processes, not just terminal sessions. This enables automation workflows where API keys, authentication tokens, and other configuration can be set once globally and used across all agents.

**Example use cases:**

- Set `ANTHROPIC_API_KEY` globally → all Claude agents access it
- Set proxy variables globally (e.g., `HTTP_PROXY`, `HTTPS_PROXY`) → all agents respect proxy settings
- Set custom tool paths globally → all agents can find tools and utilities
- Set debugging flags globally → all agents inherit consistent logging configuration

**Environment Variable Precedence (highest to lowest priority):**

1. **Session-level custom variables** - Specific overrides for individual agent sessions
2. **Global environment variables** (new) - Set once in Settings, applies to all agents and terminals
3. **Agent-specific configuration** - Per-agent default settings
4. **Process environment** - System and parent process environment variables

**How to use:**

1. Open **Settings** (Cmd+, / Ctrl+,)
2. Go to **General** tab
3. Expand **Shell Configuration**
4. Scroll to **Global Environment Variables**
5. Add your variables in `KEY=VALUE` format (one per line)
6. Variables apply immediately to new agent sessions and terminals

**Important notes:**

- Variables with special characters should be quoted
- Path expansion (`~/` syntax) is supported for home directory references
- Agent-specific environment variables can override global values
- Exported settings include global environment variables for easy migration between machines

### Changed

- Updated Settings UI text from "Shell Environment Variables" to "Global Environment Variables" for clarity
- Enhanced Settings help text to explicitly mention both agents and terminals
- Agent configuration panel now shows "overrides global environment variables" to clarify precedence

---

For more information on environment variable management, see [ENV_VAR_ARCHITECTURE.md](ENV_VAR_ARCHITECTURE.md).
