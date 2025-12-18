/**
 * NewGroupChatModal.tsx
 *
 * Modal for creating a new Group Chat. Allows user to:
 * - Select a moderator agent from available agents
 * - Enter a name for the group chat
 *
 * Only shows agents that are both supported by Maestro and detected on the system.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Check } from 'lucide-react';
import type { Theme, AgentConfig } from '../types';
import { MODAL_PRIORITIES } from '../constants/modalPriorities';
import { Modal, ModalFooter, FormInput } from './ui';
import { AgentLogo, AGENT_TILES } from './Wizard/screens/AgentSelectionScreen';

interface NewGroupChatModalProps {
  theme: Theme;
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, moderatorAgentId: string) => void;
}

export function NewGroupChatModal({
  theme,
  isOpen,
  onClose,
  onCreate,
}: NewGroupChatModalProps): JSX.Element | null {
  const [name, setName] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [detectedAgents, setDetectedAgents] = useState<AgentConfig[]>([]);
  const [isDetecting, setIsDetecting] = useState(true);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Detect agents on mount
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setName('');
      setSelectedAgent(null);
      setIsDetecting(true);
      return;
    }

    async function detect() {
      try {
        const agents = await window.maestro.agents.detect();
        const available = agents.filter((a: AgentConfig) => a.available && !a.hidden);
        setDetectedAgents(available);

        // Auto-select first available supported agent
        if (available.length > 0) {
          // Find first agent that is both supported in AGENT_TILES and detected
          const firstSupported = AGENT_TILES.find(tile => {
            if (!tile.supported) return false;
            return available.some((a: AgentConfig) => a.id === tile.id);
          });
          if (firstSupported) {
            setSelectedAgent(firstSupported.id);
          } else if (available.length > 0) {
            setSelectedAgent(available[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to detect agents:', error);
      } finally {
        setIsDetecting(false);
      }
    }

    detect();
  }, [isOpen]);

  // Focus name input when agents detected
  useEffect(() => {
    if (!isDetecting && isOpen) {
      nameInputRef.current?.focus();
    }
  }, [isDetecting, isOpen]);

  const handleCreate = useCallback(() => {
    if (name.trim() && selectedAgent) {
      onCreate(name.trim(), selectedAgent);
      setName('');
      setSelectedAgent(null);
      onClose();
    }
  }, [name, selectedAgent, onCreate, onClose]);

  const canCreate = name.trim().length > 0 && selectedAgent !== null;

  if (!isOpen) return null;

  // Filter AGENT_TILES to only show supported + detected agents
  const availableTiles = AGENT_TILES.filter(tile => {
    if (!tile.supported) return false;
    return detectedAgents.some((a: AgentConfig) => a.id === tile.id);
  });

  return (
    <Modal
      theme={theme}
      title="New Group Chat"
      priority={MODAL_PRIORITIES.NEW_GROUP_CHAT}
      onClose={onClose}
      initialFocusRef={nameInputRef}
      width={600}
      footer={
        <ModalFooter
          theme={theme}
          onCancel={onClose}
          onConfirm={handleCreate}
          confirmLabel="Create"
          confirmDisabled={!canCreate}
        />
      }
    >
      {/* Description */}
      <div
        className="mb-6 text-sm leading-relaxed"
        style={{ color: theme.colors.textDim }}
      >
        A Group Chat lets you collaborate with multiple AI agents in a single conversation.
        The <span style={{ color: theme.colors.textMain }}>moderator</span> manages the conversation flow,
        deciding when to involve other agents. You can <span style={{ color: theme.colors.accent }}>@mention</span> any
        agent defined in Maestro to bring them into the discussion.
      </div>

      {/* Agent Selection */}
      <div className="mb-6">
        <label
          className="block text-sm font-medium mb-3"
          style={{ color: theme.colors.textMain }}
        >
          Select Moderator
        </label>

        {isDetecting ? (
          <div className="flex items-center justify-center py-8">
            <div
              className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: theme.colors.accent, borderTopColor: 'transparent' }}
            />
          </div>
        ) : availableTiles.length === 0 ? (
          <div
            className="text-center py-8 text-sm"
            style={{ color: theme.colors.textDim }}
          >
            No agents available. Please install Claude Code, OpenCode, or Codex.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {availableTiles.map((tile) => {
              const isSelected = selectedAgent === tile.id;

              return (
                <button
                  key={tile.id}
                  onClick={() => setSelectedAgent(tile.id)}
                  className="relative flex flex-col items-center p-4 rounded-lg border-2 transition-all outline-none"
                  style={{
                    backgroundColor: isSelected
                      ? `${tile.brandColor}15`
                      : theme.colors.bgMain,
                    borderColor: isSelected
                      ? tile.brandColor
                      : theme.colors.border,
                  }}
                >
                  {isSelected && (
                    <div
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: tile.brandColor }}
                    >
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <AgentLogo
                    agentId={tile.id}
                    supported={true}
                    detected={true}
                    brandColor={tile.brandColor}
                    theme={theme}
                  />
                  <span
                    className="mt-2 text-sm font-medium"
                    style={{ color: theme.colors.textMain }}
                  >
                    {tile.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Name Input */}
      <FormInput
        ref={nameInputRef}
        theme={theme}
        label="Chat Name"
        value={name}
        onChange={setName}
        onSubmit={canCreate ? handleCreate : undefined}
        placeholder="e.g., Auth Feature Implementation"
      />
    </Modal>
  );
}
