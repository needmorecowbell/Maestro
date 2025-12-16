// Slash commands are now purely prompt macros - no execute functions
// All commands are defined via Custom AI Commands in settings or fetched from Claude Code CLI
// This file is kept for backward compatibility but contains no built-in commands

export interface SlashCommand {
  command: string;
  description: string;
  terminalOnly?: boolean; // Only show this command in terminal mode
  aiOnly?: boolean; // Only show this command in AI mode
}

// Empty array - all slash commands are now custom AI commands
// Built-in special cases (/history, /clear, /jump) have been removed
// Users can recreate similar functionality via custom AI commands if needed
export const slashCommands: SlashCommand[] = [];
