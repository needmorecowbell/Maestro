/**
 * SessionPillBar component for Maestro mobile web interface
 *
 * A horizontal scrollable bar displaying session pills at the top of the mobile interface.
 * Each pill shows the session name, status dot (color-coded), and mode icon (AI/terminal).
 *
 * Features:
 * - Horizontal scroll with momentum/snap
 * - Touch-friendly tap targets
 * - Color-coded status indicators (green=idle, yellow=busy, red=error, orange=connecting)
 * - Mode indicator (AI vs Terminal)
 * - Active session highlighting
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useThemeColors } from '../components/ThemeProvider';
import { StatusDot, type SessionStatus } from '../components/Badge';
import type { Session } from '../hooks/useSessions';
import { triggerHaptic, HAPTIC_PATTERNS } from './index';

/**
 * Props for individual session pill
 */
interface SessionPillProps {
  session: Session;
  isActive: boolean;
  onSelect: (sessionId: string) => void;
}

/**
 * Individual session pill component
 */
function SessionPill({ session, isActive, onSelect }: SessionPillProps) {
  const colors = useThemeColors();

  // Map session state to status for StatusDot
  const getStatus = (): SessionStatus => {
    const state = session.state as string;
    if (state === 'idle') return 'idle';
    if (state === 'busy') return 'busy';
    if (state === 'connecting') return 'connecting';
    return 'error';
  };

  // Handle tap with haptic feedback
  const handleTap = useCallback(() => {
    triggerHaptic(HAPTIC_PATTERNS.tap);
    onSelect(session.id);
  }, [session.id, onSelect]);

  // Mode icon based on input mode
  const renderModeIcon = () => {
    const isAI = session.inputMode === 'ai';
    return (
      <span
        style={{
          fontSize: '10px',
          fontWeight: 600,
          color: isAI ? colors.accent : colors.textDim,
          backgroundColor: isAI ? `${colors.accent}20` : `${colors.textDim}20`,
          padding: '2px 4px',
          borderRadius: '3px',
          lineHeight: 1,
        }}
      >
        {isAI ? 'AI' : '⌘'}
      </span>
    );
  };

  return (
    <button
      onClick={handleTap}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        borderRadius: '20px',
        border: isActive ? `2px solid ${colors.accent}` : `1px solid ${colors.border}`,
        backgroundColor: isActive ? `${colors.accent}15` : colors.bgSidebar,
        color: colors.textMain,
        fontSize: '13px',
        fontWeight: isActive ? 600 : 400,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        flexShrink: 0,
        minWidth: 'fit-content',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
      }}
      aria-pressed={isActive}
      aria-label={`${session.name} session, ${getStatus()}, ${session.inputMode} mode${isActive ? ', active' : ''}`}
    >
      {/* Status dot */}
      <StatusDot status={getStatus()} size="sm" />

      {/* Session name */}
      <span
        style={{
          maxWidth: '120px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {session.name}
      </span>

      {/* Mode icon */}
      {renderModeIcon()}
    </button>
  );
}

/**
 * Props for the SessionPillBar component
 */
export interface SessionPillBarProps {
  /** List of sessions to display */
  sessions: Session[];
  /** ID of the currently active session */
  activeSessionId: string | null;
  /** Callback when a session is selected */
  onSelectSession: (sessionId: string) => void;
  /** Optional className for additional styling */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
}

/**
 * SessionPillBar component
 *
 * Renders a horizontally scrollable bar of session pills for the mobile interface.
 *
 * @example
 * ```tsx
 * <SessionPillBar
 *   sessions={sessions}
 *   activeSessionId={activeSession?.id}
 *   onSelectSession={(id) => setActiveSessionId(id)}
 * />
 * ```
 */
export function SessionPillBar({
  sessions,
  activeSessionId,
  onSelectSession,
  className = '',
  style,
}: SessionPillBarProps) {
  const colors = useThemeColors();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll active session into view when it changes
  useEffect(() => {
    if (!activeSessionId || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const activeButton = container.querySelector(`[aria-pressed="true"]`) as HTMLElement | null;

    if (activeButton) {
      // Calculate the scroll position to center the active pill
      const containerWidth = container.offsetWidth;
      const buttonLeft = activeButton.offsetLeft;
      const buttonWidth = activeButton.offsetWidth;
      const scrollTarget = buttonLeft - (containerWidth / 2) + (buttonWidth / 2);

      container.scrollTo({
        left: Math.max(0, scrollTarget),
        behavior: 'smooth',
      });
    }
  }, [activeSessionId]);

  // Don't render if no sessions
  if (sessions.length === 0) {
    return (
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: colors.bgSidebar,
          ...style,
        }}
        className={className}
      >
        <p
          style={{
            fontSize: '13px',
            color: colors.textDim,
            textAlign: 'center',
            margin: 0,
          }}
        >
          No sessions available
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.bgSidebar,
        ...style,
      }}
      className={className}
    >
      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 16px',
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          scrollSnapType: 'x proximity',
        }}
        // Hide scrollbar using inline style (for webkit browsers)
        className="hide-scrollbar"
        role="tablist"
        aria-label="Session selector"
      >
        {sessions.map((session) => (
          <div
            key={session.id}
            style={{
              scrollSnapAlign: 'start',
            }}
            role="presentation"
          >
            <SessionPill
              session={session}
              isActive={session.id === activeSessionId}
              onSelect={onSelectSession}
            />
          </div>
        ))}
      </div>

      {/* Inline style for hiding scrollbar */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

export default SessionPillBar;
