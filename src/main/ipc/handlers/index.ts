/**
 * IPC Handler Registration Module
 *
 * This module consolidates all IPC handler registrations, extracted from the main index.ts
 * to improve code organization and maintainability.
 *
 * Each handler module exports a register function that sets up the relevant ipcMain.handle calls.
 */

import { BrowserWindow, App } from 'electron';
import { registerGitHandlers } from './git';
import { registerAutorunHandlers } from './autorun';

// Re-export individual handlers for selective registration
export { registerGitHandlers };
export { registerAutorunHandlers };

/**
 * Dependencies required for handler registration
 */
export interface HandlerDependencies {
  mainWindow: BrowserWindow | null;
  getMainWindow: () => BrowserWindow | null;
  app: App;
}

/**
 * Register all IPC handlers.
 * Call this once during app initialization.
 */
export function registerAllHandlers(deps: HandlerDependencies): void {
  registerGitHandlers();
  registerAutorunHandlers(deps);
  // Future handlers will be registered here:
  // registerPlaybooksHandlers();
  // registerHistoryHandlers();
  // registerAgentsHandlers();
  // registerProcessHandlers();
  // registerPersistenceHandlers();
  // registerSystemHandlers();
}
