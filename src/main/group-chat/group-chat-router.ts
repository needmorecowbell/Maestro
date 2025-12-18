/**
 * @file group-chat-router.ts
 * @description Message routing for Group Chat feature.
 *
 * Routes messages between:
 * - User -> Moderator
 * - Moderator -> Participants (via @mentions)
 * - Participants -> Moderator
 */

import { GroupChatParticipant, loadGroupChat } from './group-chat-storage';
import { appendToLog } from './group-chat-log';
import {
  IProcessManager,
  getModeratorSessionId,
  isModeratorActive,
} from './group-chat-moderator';
import {
  getParticipantSessionId,
  isParticipantActive,
} from './group-chat-agent';

/**
 * Extracts @mentions from text that match known participants.
 *
 * @param text - The text to search for mentions
 * @param participants - List of valid participants
 * @returns Array of participant names that were mentioned
 */
export function extractMentions(
  text: string,
  participants: GroupChatParticipant[]
): string[] {
  const participantNames = new Set(participants.map((p) => p.name));
  const mentions: string[] = [];

  // Match @Name patterns (alphanumeric and underscores)
  const mentionPattern = /@(\w+)/g;
  let match;

  while ((match = mentionPattern.exec(text)) !== null) {
    const name = match[1];
    if (participantNames.has(name) && !mentions.includes(name)) {
      mentions.push(name);
    }
  }

  return mentions;
}

/**
 * Routes a user message to the moderator.
 *
 * - Logs the message as coming from 'user'
 * - Sends to the moderator's session
 *
 * @param groupChatId - The ID of the group chat
 * @param message - The message from the user
 * @param processManager - The process manager (optional)
 * @param readOnly - Optional flag indicating read-only mode
 */
export async function routeUserMessage(
  groupChatId: string,
  message: string,
  processManager?: IProcessManager,
  readOnly?: boolean
): Promise<void> {
  const chat = await loadGroupChat(groupChatId);
  if (!chat) {
    throw new Error(`Group chat not found: ${groupChatId}`);
  }

  if (!isModeratorActive(groupChatId)) {
    throw new Error(`Moderator is not active for group chat: ${groupChatId}`);
  }

  // Log the message as coming from user
  await appendToLog(chat.logPath, 'user', message, readOnly);

  // Send to moderator (include read-only context if active)
  if (processManager) {
    const sessionId = getModeratorSessionId(groupChatId);
    if (sessionId) {
      const messageToSend = readOnly
        ? `[READ-ONLY MODE] ${message}`
        : message;
      processManager.write(sessionId, messageToSend + '\n');
    }
  }
}

/**
 * Routes a moderator response, forwarding to mentioned agents.
 *
 * - Logs the message as coming from 'moderator'
 * - Extracts @mentions and forwards to those participants
 *
 * @param groupChatId - The ID of the group chat
 * @param message - The message from the moderator
 * @param processManager - The process manager (optional)
 */
export async function routeModeratorResponse(
  groupChatId: string,
  message: string,
  processManager?: IProcessManager
): Promise<void> {
  const chat = await loadGroupChat(groupChatId);
  if (!chat) {
    throw new Error(`Group chat not found: ${groupChatId}`);
  }

  // Log the message as coming from moderator
  await appendToLog(chat.logPath, 'moderator', message);

  // Extract mentions and forward to those participants
  const mentions = extractMentions(message, chat.participants);

  if (processManager) {
    for (const participantName of mentions) {
      if (isParticipantActive(groupChatId, participantName)) {
        const sessionId = getParticipantSessionId(groupChatId, participantName);
        if (sessionId) {
          // Send the full message to the mentioned participant
          processManager.write(sessionId, message + '\n');
        }
      }
    }
  }
}

/**
 * Routes an agent's response back to the moderator.
 *
 * - Logs the message as coming from the participant
 * - Notifies the moderator of the response
 *
 * @param groupChatId - The ID of the group chat
 * @param participantName - The name of the responding participant
 * @param message - The message from the participant
 * @param processManager - The process manager (optional)
 */
export async function routeAgentResponse(
  groupChatId: string,
  participantName: string,
  message: string,
  processManager?: IProcessManager
): Promise<void> {
  const chat = await loadGroupChat(groupChatId);
  if (!chat) {
    throw new Error(`Group chat not found: ${groupChatId}`);
  }

  // Verify participant exists
  const participant = chat.participants.find((p) => p.name === participantName);
  if (!participant) {
    throw new Error(`Participant '${participantName}' not found in group chat`);
  }

  // Log the message as coming from the participant
  await appendToLog(chat.logPath, participantName, message);

  // Notify moderator
  if (processManager && isModeratorActive(groupChatId)) {
    const sessionId = getModeratorSessionId(groupChatId);
    if (sessionId) {
      // Format the notification to clearly indicate who responded
      const notification = `[${participantName}]: ${message}`;
      processManager.write(sessionId, notification + '\n');
    }
  }
}
