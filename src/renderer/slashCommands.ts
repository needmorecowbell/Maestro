export interface SlashCommand {
  command: string;
  description: string;
  execute: (context: SlashCommandContext) => void;
}

export interface SlashCommandContext {
  activeSessionId: string;
  sessions: any[];
  setSessions: (sessions: any[] | ((prev: any[]) => any[])) => void;
  currentMode: 'ai' | 'terminal';
  // Optional properties for file tree navigation
  setRightPanelOpen?: (open: boolean) => void;
  setActiveRightTab?: (tab: string) => void;
  fileTreeRef?: React.RefObject<HTMLDivElement>;
}

export const slashCommands: SlashCommand[] = [
  {
    command: '/clear',
    description: 'Clear the output history',
    execute: (context: SlashCommandContext) => {
      const { activeSessionId, sessions, setSessions, currentMode } = context;

      // Use fallback to first session if activeSessionId is empty
      const actualActiveId = activeSessionId || (sessions.length > 0 ? sessions[0].id : '');
      if (!actualActiveId) return;

      const targetLogKey = currentMode === 'ai' ? 'aiLogs' : 'shellLogs';

      setSessions(prev => prev.map(s => {
        if (s.id !== actualActiveId) return s;
        return {
          ...s,
          [targetLogKey]: []
        };
      }));
    }
  },
  {
    command: '/jump',
    description: 'Jump to CWD in file tree',
    execute: (context: SlashCommandContext) => {
      const { activeSessionId, sessions, setSessions, setRightPanelOpen, setActiveRightTab } = context;

      // Use fallback to first session if activeSessionId is empty
      const actualActiveId = activeSessionId || (sessions.length > 0 ? sessions[0].id : '');

      // Find active session
      const activeSession = sessions.find(s => s.id === actualActiveId);
      if (!activeSession) return;

      // Get the current working directory (use shellCwd for terminal mode, cwd otherwise)
      const targetDir = activeSession.shellCwd || activeSession.cwd;

      // Open right panel and switch to files tab
      if (setRightPanelOpen) setRightPanelOpen(true);
      if (setActiveRightTab) setActiveRightTab('files');

      // Expand all parent folders in the path
      setSessions(prev => prev.map(s => {
        if (s.id !== actualActiveId) return s;

        // Build list of parent paths to expand
        const pathParts = targetDir.replace(s.cwd, '').split('/').filter(Boolean);
        const expandPaths: string[] = [s.cwd];

        let currentPath = s.cwd;
        for (const part of pathParts) {
          currentPath = currentPath + '/' + part;
          expandPaths.push(currentPath);
        }

        // Add all parent paths to expanded list
        const newExpanded = new Set([...s.fileExplorerExpanded, ...expandPaths]);

        return {
          ...s,
          fileExplorerExpanded: Array.from(newExpanded)
        };
      }));

      // Scroll to the target directory in the file tree
      // This will be handled by the file tree component when it detects the expansion
    }
  }
];
