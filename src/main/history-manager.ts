/**
 * History Manager for per-session history storage
 *
 * Migrates from a single global `maestro-history.json` file to per-session
 * history files stored in a dedicated `history/` subdirectory.
 *
 * Benefits:
 * - Higher limits: 5,000 entries per session (up from 1,000 global)
 * - Context passing: History files can be passed directly to AI agents
 * - Better isolation: Sessions don't pollute each other's history
 * - Simpler queries: No filtering needed when reading a session's history
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { logger } from './utils/logger';
import { HistoryEntry } from '../shared/types';

const LOG_CONTEXT = '[HistoryManager]';
const HISTORY_VERSION = 1;
const MAX_ENTRIES_PER_SESSION = 5000;

/**
 * Per-session history file format
 */
interface HistoryFileData {
  version: number;
  sessionId: string;
  projectPath: string;
  entries: HistoryEntry[];
}

/**
 * Migration marker file format
 */
interface MigrationMarker {
  migratedAt: number;
  version: number;
  legacyEntryCount: number;
  sessionsMigrated: number;
}

/**
 * HistoryManager handles per-session history storage with automatic migration
 * from the legacy single-file format.
 */
export class HistoryManager {
  private historyDir: string;
  private legacyFilePath: string;
  private migrationMarkerPath: string;
  private configDir: string;
  private watcher: fs.FSWatcher | null = null;

  constructor() {
    this.configDir = app.getPath('userData');
    this.historyDir = path.join(this.configDir, 'history');
    this.legacyFilePath = path.join(this.configDir, 'maestro-history.json');
    this.migrationMarkerPath = path.join(this.configDir, 'history-migrated.json');
  }

  /**
   * Initialize history manager - create directory and run migration if needed
   */
  async initialize(): Promise<void> {
    // Ensure history directory exists
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true });
      logger.debug('Created history directory', LOG_CONTEXT);
    }

    // Check if migration is needed
    if (this.needsMigration()) {
      await this.migrateFromLegacy();
    }
  }

  /**
   * Check if migration from legacy format is needed
   */
  private needsMigration(): boolean {
    // If marker exists, migration was already done
    if (fs.existsSync(this.migrationMarkerPath)) {
      return false;
    }

    // If legacy file exists with entries, need to migrate
    if (fs.existsSync(this.legacyFilePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.legacyFilePath, 'utf-8'));
        return data.entries && data.entries.length > 0;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Check if migration has been completed
   */
  hasMigrated(): boolean {
    return fs.existsSync(this.migrationMarkerPath);
  }

  /**
   * Migrate entries from legacy single-file format to per-session files
   */
  private async migrateFromLegacy(): Promise<void> {
    logger.info('Starting history migration from legacy format', LOG_CONTEXT);

    try {
      const legacyData = JSON.parse(fs.readFileSync(this.legacyFilePath, 'utf-8'));
      const entries: HistoryEntry[] = legacyData.entries || [];

      // Group entries by sessionId
      const entriesBySession = new Map<string, HistoryEntry[]>();
      const orphanedEntries: HistoryEntry[] = [];

      for (const entry of entries) {
        const sessionId = entry.sessionId;
        if (sessionId) {
          if (!entriesBySession.has(sessionId)) {
            entriesBySession.set(sessionId, []);
          }
          entriesBySession.get(sessionId)!.push(entry);
        } else {
          // Entries without sessionId go to orphaned
          orphanedEntries.push(entry);
        }
      }

      // Write per-session files
      let sessionsMigrated = 0;
      for (const [sessionId, sessionEntries] of entriesBySession) {
        const projectPath = sessionEntries[0]?.projectPath || '';
        const fileData: HistoryFileData = {
          version: HISTORY_VERSION,
          sessionId,
          projectPath,
          entries: sessionEntries.slice(0, MAX_ENTRIES_PER_SESSION),
        };
        const filePath = this.getSessionFilePath(sessionId);
        fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf-8');
        sessionsMigrated++;
        logger.debug(`Migrated ${sessionEntries.length} entries for session ${sessionId}`, LOG_CONTEXT);
      }

      // Handle orphaned entries (entries without sessionId)
      if (orphanedEntries.length > 0) {
        const orphanedFileData: HistoryFileData = {
          version: HISTORY_VERSION,
          sessionId: '_orphaned',
          projectPath: '',
          entries: orphanedEntries.slice(0, MAX_ENTRIES_PER_SESSION),
        };
        fs.writeFileSync(
          this.getSessionFilePath('_orphaned'),
          JSON.stringify(orphanedFileData, null, 2),
          'utf-8'
        );
        sessionsMigrated++;
        logger.info(`Migrated ${orphanedEntries.length} orphaned entries`, LOG_CONTEXT);
      }

      // Write migration marker
      const marker: MigrationMarker = {
        migratedAt: Date.now(),
        version: HISTORY_VERSION,
        legacyEntryCount: entries.length,
        sessionsMigrated,
      };
      fs.writeFileSync(this.migrationMarkerPath, JSON.stringify(marker, null, 2), 'utf-8');

      logger.info(
        `History migration complete: ${entries.length} entries -> ${sessionsMigrated} session files`,
        LOG_CONTEXT
      );
    } catch (error) {
      logger.error(`History migration failed: ${error}`, LOG_CONTEXT);
      throw error;
    }
  }

  /**
   * Get file path for a session's history
   */
  private getSessionFilePath(sessionId: string): string {
    // Sanitize sessionId for filesystem safety
    const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.historyDir, `${safeId}.json`);
  }

  /**
   * Read history for a specific session
   */
  getEntries(sessionId: string): HistoryEntry[] {
    const filePath = this.getSessionFilePath(sessionId);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const data: HistoryFileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data.entries || [];
    } catch (error) {
      logger.warn(`Failed to read history for session ${sessionId}: ${error}`, LOG_CONTEXT);
      return [];
    }
  }

  /**
   * Add an entry to a session's history
   */
  addEntry(sessionId: string, projectPath: string, entry: HistoryEntry): void {
    const filePath = this.getSessionFilePath(sessionId);
    let data: HistoryFileData;

    if (fs.existsSync(filePath)) {
      try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        data = { version: HISTORY_VERSION, sessionId, projectPath, entries: [] };
      }
    } else {
      data = { version: HISTORY_VERSION, sessionId, projectPath, entries: [] };
    }

    // Add to beginning (most recent first)
    data.entries.unshift(entry);

    // Trim to max entries
    if (data.entries.length > MAX_ENTRIES_PER_SESSION) {
      data.entries = data.entries.slice(0, MAX_ENTRIES_PER_SESSION);
    }

    // Update projectPath if it changed
    data.projectPath = projectPath;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    logger.debug(`Added history entry for session ${sessionId}`, LOG_CONTEXT);
  }

  /**
   * Delete a specific entry from a session's history
   */
  deleteEntry(sessionId: string, entryId: string): boolean {
    const filePath = this.getSessionFilePath(sessionId);
    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      const data: HistoryFileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const originalLength = data.entries.length;
      data.entries = data.entries.filter((e) => e.id !== entryId);

      if (data.entries.length === originalLength) {
        return false; // Entry not found
      }

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update a specific entry in a session's history
   */
  updateEntry(sessionId: string, entryId: string, updates: Partial<HistoryEntry>): boolean {
    const filePath = this.getSessionFilePath(sessionId);
    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      const data: HistoryFileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const index = data.entries.findIndex((e) => e.id === entryId);

      if (index === -1) {
        return false;
      }

      data.entries[index] = { ...data.entries[index], ...updates };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all history for a session
   */
  clearSession(sessionId: string): void {
    const filePath = this.getSessionFilePath(sessionId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Cleared history for session ${sessionId}`, LOG_CONTEXT);
    }
  }

  /**
   * List all sessions that have history files
   */
  listSessionsWithHistory(): string[] {
    if (!fs.existsSync(this.historyDir)) {
      return [];
    }
    return fs
      .readdirSync(this.historyDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  }

  /**
   * Get the file path for a session's history (for passing to AI as context)
   */
  getHistoryFilePath(sessionId: string): string | null {
    const filePath = this.getSessionFilePath(sessionId);
    return fs.existsSync(filePath) ? filePath : null;
  }

  /**
   * Get all entries across all sessions (for cross-session views)
   * Returns entries sorted by timestamp (most recent first)
   */
  getAllEntries(limit?: number): HistoryEntry[] {
    const sessions = this.listSessionsWithHistory();
    const allEntries: HistoryEntry[] = [];

    for (const sessionId of sessions) {
      const entries = this.getEntries(sessionId);
      allEntries.push(...entries);
    }

    // Sort by timestamp descending
    allEntries.sort((a, b) => b.timestamp - a.timestamp);

    return limit ? allEntries.slice(0, limit) : allEntries;
  }

  /**
   * Get entries filtered by project path
   */
  getEntriesByProjectPath(projectPath: string): HistoryEntry[] {
    const sessions = this.listSessionsWithHistory();
    const entries: HistoryEntry[] = [];

    for (const sessionId of sessions) {
      const sessionEntries = this.getEntries(sessionId);
      if (sessionEntries.length > 0 && sessionEntries[0].projectPath === projectPath) {
        entries.push(...sessionEntries);
      }
    }

    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clear all sessions for a specific project
   */
  clearByProjectPath(projectPath: string): void {
    const sessions = this.listSessionsWithHistory();
    for (const sessionId of sessions) {
      const entries = this.getEntries(sessionId);
      if (entries.length > 0 && entries[0].projectPath === projectPath) {
        this.clearSession(sessionId);
      }
    }
  }

  /**
   * Clear all history (all session files)
   */
  clearAll(): void {
    const sessions = this.listSessionsWithHistory();
    for (const sessionId of sessions) {
      this.clearSession(sessionId);
    }
    logger.info('Cleared all history', LOG_CONTEXT);
  }

  /**
   * Start watching the history directory for external changes.
   * Dispatches events with the affected sessionId so renderers can
   * decide whether to reload.
   */
  startWatching(onExternalChange: (sessionId: string) => void): void {
    if (this.watcher) return; // Already watching

    // Ensure directory exists before watching
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true });
    }

    this.watcher = fs.watch(this.historyDir, (_eventType, filename) => {
      if (filename?.endsWith('.json')) {
        const sessionId = filename.replace('.json', '');
        logger.debug(`History file changed: ${filename}`, LOG_CONTEXT);
        onExternalChange(sessionId);
      }
    });

    logger.info('Started watching history directory', LOG_CONTEXT);
  }

  /**
   * Stop watching the history directory.
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      logger.info('Stopped watching history directory', LOG_CONTEXT);
    }
  }

  /**
   * Get the history directory path (for debugging/testing)
   */
  getHistoryDir(): string {
    return this.historyDir;
  }

  /**
   * Get the legacy file path (for debugging/testing)
   */
  getLegacyFilePath(): string {
    return this.legacyFilePath;
  }
}

// Singleton instance
let historyManager: HistoryManager | null = null;

/**
 * Get the singleton HistoryManager instance
 */
export function getHistoryManager(): HistoryManager {
  if (!historyManager) {
    historyManager = new HistoryManager();
  }
  return historyManager;
}
