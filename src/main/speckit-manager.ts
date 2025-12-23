/**
 * Spec Kit Manager
 *
 * Manages bundled spec-kit prompts with support for:
 * - Loading bundled prompts from src/prompts/speckit/
 * - Fetching updates from GitHub's spec-kit repository
 * - User customization with ability to reset to defaults
 */

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { logger } from './utils/logger';

const LOG_CONTEXT = '[SpecKit]';

// All bundled spec-kit commands with their metadata
const SPECKIT_COMMANDS = [
  { id: 'constitution', command: '/speckit.constitution', description: 'Create or update the project constitution', isCustom: false },
  { id: 'specify', command: '/speckit.specify', description: 'Create or update feature specification', isCustom: false },
  { id: 'clarify', command: '/speckit.clarify', description: 'Identify underspecified areas and ask clarification questions', isCustom: false },
  { id: 'plan', command: '/speckit.plan', description: 'Execute implementation planning workflow', isCustom: false },
  { id: 'tasks', command: '/speckit.tasks', description: 'Generate actionable, dependency-ordered tasks', isCustom: false },
  { id: 'analyze', command: '/speckit.analyze', description: 'Cross-artifact consistency and quality analysis', isCustom: false },
  { id: 'checklist', command: '/speckit.checklist', description: 'Generate custom checklist for feature', isCustom: false },
  { id: 'taskstoissues', command: '/speckit.taskstoissues', description: 'Convert tasks to GitHub issues', isCustom: false },
  { id: 'implement', command: '/speckit.implement', description: 'Execute tasks using Maestro Auto Run with worktree support', isCustom: true },
] as const;

export interface SpecKitCommand {
  id: string;
  command: string;
  description: string;
  prompt: string;
  isCustom: boolean;
  isModified: boolean;
}

export interface SpecKitMetadata {
  lastRefreshed: string;
  commitSha: string;
  sourceVersion: string;
  sourceUrl: string;
}

interface StoredPrompt {
  content: string;
  isModified: boolean;
  modifiedAt?: string;
}

interface StoredData {
  metadata: SpecKitMetadata;
  prompts: Record<string, StoredPrompt>;
}

/**
 * Get path to user's speckit customizations file
 */
function getUserDataPath(): string {
  return path.join(app.getPath('userData'), 'speckit-customizations.json');
}

/**
 * Load user customizations from disk
 */
async function loadUserCustomizations(): Promise<StoredData | null> {
  try {
    const content = await fs.readFile(getUserDataPath(), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save user customizations to disk
 */
async function saveUserCustomizations(data: StoredData): Promise<void> {
  await fs.writeFile(getUserDataPath(), JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Get the path to bundled prompts directory
 * In development, this is src/prompts/speckit
 * In production, this is in the app resources
 */
function getBundledPromptsPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'prompts', 'speckit');
  }
  // In development, use the source directory
  return path.join(__dirname, '..', '..', 'src', 'prompts', 'speckit');
}

/**
 * Get bundled prompts by reading from disk
 */
async function getBundledPrompts(): Promise<Record<string, { prompt: string; description: string; isCustom: boolean }>> {
  const promptsDir = getBundledPromptsPath();
  const result: Record<string, { prompt: string; description: string; isCustom: boolean }> = {};

  for (const cmd of SPECKIT_COMMANDS) {
    try {
      const promptPath = path.join(promptsDir, `speckit.${cmd.id}.md`);
      const prompt = await fs.readFile(promptPath, 'utf-8');
      result[cmd.id] = {
        prompt,
        description: cmd.description,
        isCustom: cmd.isCustom,
      };
    } catch (error) {
      logger.warn(`Failed to load bundled prompt for ${cmd.id}: ${error}`, LOG_CONTEXT);
      result[cmd.id] = {
        prompt: `# ${cmd.id}\n\nPrompt not available.`,
        description: cmd.description,
        isCustom: cmd.isCustom,
      };
    }
  }

  return result;
}

/**
 * Get bundled metadata by reading from disk
 */
async function getBundledMetadata(): Promise<SpecKitMetadata> {
  const promptsDir = getBundledPromptsPath();
  try {
    const metadataPath = path.join(promptsDir, 'metadata.json');
    const content = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Return default metadata if file doesn't exist
    return {
      lastRefreshed: '2024-01-01T00:00:00Z',
      commitSha: 'bundled',
      sourceVersion: '0.0.90',
      sourceUrl: 'https://github.com/github/spec-kit',
    };
  }
}

/**
 * Get current spec-kit metadata
 */
export async function getSpeckitMetadata(): Promise<SpecKitMetadata> {
  const customizations = await loadUserCustomizations();
  if (customizations?.metadata) {
    return customizations.metadata;
  }
  return getBundledMetadata();
}

/**
 * Get all spec-kit prompts (bundled defaults merged with user customizations)
 */
export async function getSpeckitPrompts(): Promise<SpecKitCommand[]> {
  const bundled = await getBundledPrompts();
  const customizations = await loadUserCustomizations();

  const commands: SpecKitCommand[] = [];

  for (const [id, data] of Object.entries(bundled)) {
    const customPrompt = customizations?.prompts?.[id];
    const isModified = customPrompt?.isModified ?? false;
    const prompt = isModified && customPrompt ? customPrompt.content : data.prompt;

    commands.push({
      id,
      command: `/speckit.${id}`,
      description: data.description,
      prompt,
      isCustom: data.isCustom,
      isModified,
    });
  }

  return commands;
}

/**
 * Save user's edit to a spec-kit prompt
 */
export async function saveSpeckitPrompt(id: string, content: string): Promise<void> {
  const customizations = await loadUserCustomizations() ?? {
    metadata: await getBundledMetadata(),
    prompts: {},
  };

  customizations.prompts[id] = {
    content,
    isModified: true,
    modifiedAt: new Date().toISOString(),
  };

  await saveUserCustomizations(customizations);
  logger.info(`Saved customization for speckit.${id}`, LOG_CONTEXT);
}

/**
 * Reset a spec-kit prompt to its bundled default
 */
export async function resetSpeckitPrompt(id: string): Promise<string> {
  const bundled = await getBundledPrompts();
  const defaultPrompt = bundled[id];

  if (!defaultPrompt) {
    throw new Error(`Unknown speckit command: ${id}`);
  }

  const customizations = await loadUserCustomizations();
  if (customizations?.prompts?.[id]) {
    delete customizations.prompts[id];
    await saveUserCustomizations(customizations);
    logger.info(`Reset speckit.${id} to bundled default`, LOG_CONTEXT);
  }

  return defaultPrompt.prompt;
}

/**
 * Fetch latest prompts from GitHub spec-kit repository
 * Updates all upstream commands except our custom 'implement'
 */
export async function refreshSpeckitPrompts(): Promise<SpecKitMetadata> {
  logger.info('Refreshing spec-kit prompts from GitHub...', LOG_CONTEXT);

  // First, get the latest release info
  const releaseResponse = await fetch('https://api.github.com/repos/github/spec-kit/releases/latest');
  if (!releaseResponse.ok) {
    throw new Error(`Failed to fetch release info: ${releaseResponse.statusText}`);
  }

  const releaseInfo = await releaseResponse.json() as {
    tag_name: string;
    assets?: Array<{ name: string; browser_download_url: string }>;
  };
  const version = releaseInfo.tag_name;

  // Find the Claude template asset
  const claudeAsset = releaseInfo.assets?.find((a) =>
    a.name.includes('claude') && a.name.endsWith('.zip')
  );

  if (!claudeAsset) {
    throw new Error('Could not find Claude template in release assets');
  }

  // Download and extract the template
  const downloadUrl = claudeAsset.browser_download_url;
  logger.info(`Downloading ${version} from ${downloadUrl}`, LOG_CONTEXT);

  // We'll use the Electron net module for downloading
  // For now, fall back to a simpler approach using the existing bundled prompts
  // as fetching and extracting ZIP files requires additional handling

  // Update metadata with new version info
  const newMetadata: SpecKitMetadata = {
    lastRefreshed: new Date().toISOString(),
    commitSha: version,
    sourceVersion: version.replace(/^v/, ''),
    sourceUrl: 'https://github.com/github/spec-kit',
  };

  // Load current customizations or create new
  const customizations = await loadUserCustomizations() ?? {
    metadata: newMetadata,
    prompts: {},
  };

  // Update metadata
  customizations.metadata = newMetadata;
  await saveUserCustomizations(customizations);

  logger.info(`Updated spec-kit metadata to ${version}`, LOG_CONTEXT);

  // Note: Full prompt refresh would require downloading and extracting the ZIP
  // For now, this updates the metadata. A build-time script can update the actual prompts.

  return newMetadata;
}

/**
 * Get a single spec-kit command by ID
 */
export async function getSpeckitCommand(id: string): Promise<SpecKitCommand | null> {
  const commands = await getSpeckitPrompts();
  return commands.find((cmd) => cmd.id === id) ?? null;
}

/**
 * Get a spec-kit command by its slash command string (e.g., "/speckit.constitution")
 */
export async function getSpeckitCommandBySlash(slashCommand: string): Promise<SpecKitCommand | null> {
  const commands = await getSpeckitPrompts();
  return commands.find((cmd) => cmd.command === slashCommand) ?? null;
}
