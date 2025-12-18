/**
 * GroupChatMessages.tsx
 *
 * Displays the message history for a Group Chat. Messages are styled differently
 * based on sender: user messages align right, moderator and participant messages
 * align left with colored borders. Includes auto-scroll and typing indicator.
 */

import { useRef, useEffect, useCallback } from 'react';
import { BookOpen, Eye, FileText, Copy } from 'lucide-react';
import type { GroupChatMessage, GroupChatParticipant, GroupChatState, Theme } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { stripMarkdown } from '../utils/textProcessing';

interface GroupChatMessagesProps {
  theme: Theme;
  messages: GroupChatMessage[];
  participants: GroupChatParticipant[];
  state: GroupChatState;
  markdownEditMode?: boolean;
  onToggleMarkdownEditMode?: () => void;
}

// Color mapping for participants
const PARTICIPANT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EF4444', // red
  '#06B6D4', // cyan
];

export function GroupChatMessages({
  theme,
  messages,
  participants,
  state,
  markdownEditMode,
  onToggleMarkdownEditMode,
}: GroupChatMessagesProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const getParticipantColor = (name: string): string => {
    const index = participants.findIndex(p => p.name === name);
    return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
  };

  const getSenderStyle = (from: string) => {
    if (from === 'user') {
      return {
        align: 'right' as const,
        bgColor: theme.colors.accent,
        textColor: '#ffffff',
      };
    }
    if (from === 'moderator') {
      return {
        align: 'left' as const,
        bgColor: theme.colors.bgSidebar,
        textColor: theme.colors.textMain,
        borderColor: theme.colors.warning,
      };
    }
    // Participant
    return {
      align: 'left' as const,
      bgColor: theme.colors.bgSidebar,
      textColor: theme.colors.textMain,
      borderColor: getParticipantColor(from),
    };
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {messages.length === 0 ? (
        <div
          className="flex items-center justify-center h-full"
        >
          <div className="text-center max-w-md space-y-3">
            <p className="text-sm" style={{ color: theme.colors.textDim }}>
              Messages you send go directly to the <span style={{ color: theme.colors.warning }}>moderator</span>,
              who orchestrates the conversation and decides when to involve other agents.
            </p>
            <p className="text-sm" style={{ color: theme.colors.textDim }}>
              Use <span style={{ color: theme.colors.accent }}>@agent</span> to message a specific agent directly at any time.
            </p>
          </div>
        </div>
      ) : (
        messages.map((msg, index) => {
          const style = getSenderStyle(msg.from);
          const isUser = msg.from === 'user';

          return (
            <div
              key={`${msg.timestamp}-${index}`}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="group relative max-w-[70%] rounded-lg px-4 py-2"
                style={{
                  backgroundColor: style.bgColor,
                  color: style.textColor,
                  borderLeft: style.borderColor ? `3px solid ${style.borderColor}` : undefined,
                }}
              >
                {/* Sender label */}
                {!isUser && (
                  <div
                    className="text-xs font-medium mb-1"
                    style={{ color: style.borderColor || theme.colors.textDim }}
                  >
                    {msg.from === 'moderator' ? 'Moderator' : msg.from}
                  </div>
                )}

                {/* Message content */}
                {!isUser && !markdownEditMode ? (
                  <div className="text-sm">
                    <MarkdownRenderer
                      content={msg.content}
                      theme={theme}
                      onCopy={copyToClipboard}
                    />
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap">
                    {isUser ? msg.content : stripMarkdown(msg.content)}
                  </div>
                )}

                {/* Timestamp and read-only indicator */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs opacity-50">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                  {msg.readOnly && (
                    <span
                      className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded"
                      style={{
                        color: theme.colors.warning,
                        backgroundColor: `${theme.colors.warning}15`,
                      }}
                      title="Read-only mode: no file changes were made"
                    >
                      <BookOpen className="w-3 h-3" />
                      read-only
                    </span>
                  )}
                </div>

                {/* Action buttons - bottom right corner (non-user messages only) */}
                {!isUser && (
                  <div
                    className="absolute bottom-2 right-2 flex items-center gap-1"
                    style={{ transition: 'opacity 0.15s ease-in-out' }}
                  >
                    {/* Markdown toggle button */}
                    {onToggleMarkdownEditMode && (
                      <button
                        onClick={onToggleMarkdownEditMode}
                        className="p-1.5 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100"
                        style={{ color: markdownEditMode ? theme.colors.accent : theme.colors.textDim }}
                        title={markdownEditMode ? "Show formatted (⌘E)" : "Show plain text (⌘E)"}
                      >
                        {markdownEditMode ? <Eye className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </button>
                    )}
                    {/* Copy to Clipboard Button */}
                    <button
                      onClick={() => copyToClipboard(msg.content)}
                      className="p-1.5 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100"
                      style={{ color: theme.colors.textDim }}
                      title="Copy to clipboard"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Typing indicator */}
      {state !== 'idle' && (
        <div className="flex justify-start">
          <div
            className="rounded-lg px-4 py-2"
            style={{ backgroundColor: theme.colors.bgSidebar }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: theme.colors.warning }}
              />
              <span
                className="text-sm"
                style={{ color: theme.colors.textDim }}
              >
                {state === 'moderator-thinking' ? 'Moderator is thinking...' : 'Agent is working...'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
