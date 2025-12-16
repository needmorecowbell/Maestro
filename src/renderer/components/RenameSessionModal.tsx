import React, { useRef } from 'react';
import type { Theme, Session } from '../types';
import { MODAL_PRIORITIES } from '../constants/modalPriorities';
import { Modal, ModalFooter } from './ui/Modal';

interface RenameSessionModalProps {
  theme: Theme;
  value: string;
  setValue: (value: string) => void;
  onClose: () => void;
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  activeSessionId: string;
  /** Optional: specific session ID to rename (overrides activeSessionId) */
  targetSessionId?: string;
}

export function RenameSessionModal(props: RenameSessionModalProps) {
  const { theme, value, setValue, onClose, sessions, setSessions, activeSessionId, targetSessionId } = props;
  // Use targetSessionId if provided, otherwise fall back to activeSessionId
  const sessionIdToRename = targetSessionId || activeSessionId;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRename = () => {
    if (value.trim()) {
      const trimmedName = value.trim();

      // Find the target session to check for Claude session association
      const targetSession = sessions.find(s => s.id === sessionIdToRename);

      // Update local state
      setSessions(prev => prev.map(s =>
        s.id === sessionIdToRename ? { ...s, name: trimmedName } : s
      ));

      // Also update the Claude session name if this session has an associated Claude session
      if (targetSession?.claudeSessionId && targetSession?.cwd) {
        window.maestro.claude.updateSessionName(
          targetSession.cwd,
          targetSession.claudeSessionId,
          trimmedName
        ).catch(err => console.error('Failed to update Claude session name:', err));
      }

      onClose();
    }
  };

  return (
    <Modal
      theme={theme}
      title="Rename Agent"
      priority={MODAL_PRIORITIES.RENAME_INSTANCE}
      onClose={onClose}
      initialFocusRef={inputRef}
      footer={
        <ModalFooter
          theme={theme}
          onCancel={onClose}
          onConfirm={handleRename}
          confirmLabel="Rename"
          confirmDisabled={!value.trim()}
        />
      }
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleRename();
          }
        }}
        placeholder="Enter agent name..."
        className="w-full p-3 rounded border bg-transparent outline-none"
        style={{ borderColor: theme.colors.border, color: theme.colors.textMain }}
      />
    </Modal>
  );
}
