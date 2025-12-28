# Maestro

[![Made with Maestro](docs/assets/made-with-maestro.svg)](https://github.com/pedramamini/Maestro)
[![Discord](https://img.shields.io/badge/Discord-Join%20Us-5865F2?logo=discord&logoColor=white)](https://discord.gg/SrBsykvG)
[![User Docs](https://img.shields.io/badge/Docs-Usage%20%26%20Documentation-blue?logo=readthedocs&logoColor=white)](https://docs.runmaestro.ai/)

> Maestro hones fractured attention into focused intent.

Maestro is a cross-platform desktop app for orchestrating your fleet of AI coding agents. Built for power users who live on the keyboard and rarely touch the mouse.

![Maestro Main Screen](docs/screenshots/main-screen.png)

Run multiple agents in parallel with a Linear/Superhuman-level responsive interface. Currently supporting **Claude Code**, **OpenAI Codex**, and **OpenCode** with plans for additional agentic coding tools based on user demand.

## Power Features

### Auto Run & Playbooks
Batch-process markdown checklists through AI agents. Create task documents with checkboxes, and Maestro works through them automatically—spawning fresh AI sessions for each task with clean context. Save configurations as playbooks for repeatable workflows, run in loops, and track everything in history.

![Auto Run](docs/screenshots/autorun-1.png)

[Learn more about Auto Run](https://docs.runmaestro.ai/autorun-playbooks)

### Git Worktrees
Run AI agents in parallel on isolated branches. Create worktree sub-agents from the git branch menu, each operating in their own directory. Work interactively in the main repo while sub-agents process tasks independently—then create PRs with one click.

![Git Worktrees](docs/screenshots/git-worktree-list.png)

[Learn more about Git Worktrees](https://docs.runmaestro.ai/git-worktrees)

### Group Chat
Coordinate multiple AI agents in a single conversation. A moderator AI orchestrates discussions, routing questions to the right agents and synthesizing their responses for cross-project questions and architecture discussions.

![Group Chat](docs/screenshots/group-chat.png)

[Learn more about Group Chat](https://docs.runmaestro.ai/group-chat)

### Remote Access
Built-in web server with QR code access. Monitor and control all your agents from your phone. Supports local network access and remote tunneling via Cloudflare for access from anywhere—no account required.

![Mobile Interface](docs/screenshots/mobile-chat.png)

[Learn more about Remote Access](https://docs.runmaestro.ai/remote-access)

### Command Line Interface
Full CLI (`maestro-cli`) for headless operation. List agents/groups, run playbooks from cron jobs or CI/CD pipelines, with human-readable or JSONL output for scripting.

[Learn more about the CLI](https://docs.runmaestro.ai/cli)

## Core Features

| Feature | Description |
|---------|-------------|
| **Multi-Agent Management** | Run unlimited agents in parallel with isolated workspaces and conversation histories |
| **Dual-Mode Sessions** | Switch between AI Terminal and Command Terminal with `Cmd+J` |
| **Keyboard-First Design** | Full keyboard control with customizable shortcuts and [mastery tracking](https://docs.runmaestro.ai/achievements) |
| **Session Discovery** | Automatically discovers existing sessions from all supported providers |
| **Git Integration** | Branch display, diff viewer, commit logs, and git-aware file completion |
| **File Explorer** | Browse files with syntax highlighting, markdown preview, and `@` mentions |
| **Message Queueing** | Queue messages while AI is busy; they're sent when the agent is ready |
| **Output Filtering** | Search and filter with include/exclude modes and regex support |
| **Slash Commands** | Extensible command system with autocomplete, [template variables](https://docs.runmaestro.ai/slash-commands) and spec-kit support.|
| **Audio Notifications** | Text-to-speech announcements when agents complete tasks |
| **Cost Tracking** | Real-time token usage and cost monitoring |
| **12 Beautiful Themes** | Dracula, Monokai, Nord, Tokyo Night, GitHub Light, and more |
| **Achievements** | [11 conductor-themed ranks](https://docs.runmaestro.ai/achievements) based on cumulative Auto Run time |

## Quick Start

### Installation

Download the latest release for your platform from the [Releases page](https://github.com/pedramamini/Maestro/releases).

Or build from source:

```bash
git clone https://github.com/pedramamini/Maestro.git
cd Maestro
npm install
npm run dev
```

### Essential Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Quick Actions | `Cmd+K` | `Ctrl+K` |
| New Agent | `Cmd+N` | `Ctrl+N` |
| Switch AI/Terminal | `Cmd+J` | `Ctrl+J` |
| Previous/Next Agent | `Cmd+[` / `Cmd+]` | `Ctrl+[` / `Ctrl+]` |
| Toggle Sidebar | `Cmd+B` | `Ctrl+B` |
| New Tab | `Cmd+T` | `Ctrl+T` |
| All Shortcuts | `Cmd+/` | `Ctrl+/` |

[Full keyboard shortcut reference](https://docs.runmaestro.ai/keyboard-shortcuts)

## Screenshots

![Command Palette](docs/screenshots/cmd-k-1.png)
*Quick Actions palette for rapid navigation*

![Git Diff Viewer](docs/screenshots/git-diff.png)
*Side-by-side diff viewer with syntax highlighting*

![Themes](docs/screenshots/themes.png)
*12 beautiful themes to match your style*

[See more...](docs/screenshots/)

## Documentation

Full documentation and usage guide available at **[docs.runmaestro.ai](https://docs.runmaestro.ai)**

- [Installation](https://docs.runmaestro.ai/installation)
- [Getting Started](https://docs.runmaestro.ai/getting-started)
- [Features Overview](https://docs.runmaestro.ai/features)
- [Auto Run + Playbooks](https://docs.runmaestro.ai/autorun-playbooks)
- [Git Worktrees](https://docs.runmaestro.ai/git-worktrees)
- [Keyboard Shortcuts](https://docs.runmaestro.ai/keyboard-shortcuts)
- [Context Management](https://docs.runmaestro.ai/context-management)
- [Troubleshooting](https://docs.runmaestro.ai/troubleshooting)

## Community

- **Discord**: [Join Us](https://discord.gg/SrBsykvG)
- **GitHub Issues**: [Report bugs & request features](https://github.com/pedramamini/Maestro/issues)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, architecture details, and contribution guidelines.

## License

[AGPL-3.0 License](LICENSE)
