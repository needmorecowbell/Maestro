/**
 * SshRemoteSelector.tsx
 *
 * Standalone component for SSH remote execution configuration.
 * Extracted from AgentConfigPanel to be used at the top level of modals.
 *
 * Displays:
 * - Dropdown to select SSH remote (or local execution)
 * - Status indicator showing effective remote
 * - Hint when no remotes are configured
 */

import { ChevronDown, Monitor, Cloud } from 'lucide-react';
import type { Theme } from '../../types';
import type { SshRemoteConfig, AgentSshRemoteConfig } from '../../../shared/types';

export interface SshRemoteSelectorProps {
  theme: Theme;
  sshRemotes: SshRemoteConfig[];
  sshRemoteConfig?: AgentSshRemoteConfig;
  onSshRemoteConfigChange: (config: AgentSshRemoteConfig) => void;
  globalDefaultSshRemoteId?: string | null;
  /** Optional: compact mode with less padding */
  compact?: boolean;
}

export function SshRemoteSelector({
  theme,
  sshRemotes,
  sshRemoteConfig,
  onSshRemoteConfigChange,
  globalDefaultSshRemoteId,
  compact = false,
}: SshRemoteSelectorProps): JSX.Element {
  const padding = compact ? 'p-2' : 'p-3';

  return (
    <div
      className={`${padding} rounded border`}
      style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.bgMain }}
    >
      <label className="block text-xs font-medium mb-2" style={{ color: theme.colors.textDim }}>
        SSH Remote Execution
      </label>

      {/* SSH Remote Selection */}
      <div className="space-y-3">
        {/* Dropdown to select remote */}
        <div className="relative">
          <select
            value={
              sshRemoteConfig?.enabled === false
                ? 'disabled'
                : sshRemoteConfig?.remoteId || 'default'
            }
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'disabled') {
                // Explicitly disable SSH for this agent (run locally even if global default is set)
                onSshRemoteConfigChange({
                  enabled: false,
                  remoteId: null,
                });
              } else if (value === 'default') {
                // Use global default (or local if no global default)
                onSshRemoteConfigChange({
                  enabled: true,
                  remoteId: null,
                });
              } else {
                // Use specific remote
                onSshRemoteConfigChange({
                  enabled: true,
                  remoteId: value,
                });
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full p-2 rounded border bg-transparent outline-none text-xs appearance-none cursor-pointer pr-8"
            style={{
              borderColor: theme.colors.border,
              color: theme.colors.textMain,
              backgroundColor: theme.colors.bgMain,
            }}
          >
            <option value="default">
              {globalDefaultSshRemoteId
                ? `Use Global Default (${sshRemotes.find(r => r.id === globalDefaultSshRemoteId)?.name || 'Unknown'})`
                : 'Local Execution (No SSH Remote)'}
            </option>
            <option value="disabled">Force Local Execution</option>
            {sshRemotes.filter(r => r.enabled).map((remote) => (
              <option key={remote.id} value={remote.id}>
                {remote.name} ({remote.host})
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: theme.colors.textDim }}
          />
        </div>

        {/* Status indicator showing effective remote */}
        {(() => {
          const effectiveRemoteId = sshRemoteConfig?.enabled === false
            ? null
            : sshRemoteConfig?.remoteId || globalDefaultSshRemoteId || null;
          const effectiveRemote = effectiveRemoteId
            ? sshRemotes.find(r => r.id === effectiveRemoteId && r.enabled)
            : null;
          const isForceLocal = sshRemoteConfig?.enabled === false;

          return (
            <div
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
              style={{ backgroundColor: theme.colors.bgActivity }}
            >
              {isForceLocal ? (
                <>
                  <Monitor className="w-3 h-3" style={{ color: theme.colors.textDim }} />
                  <span style={{ color: theme.colors.textDim }}>
                    Agent will run locally (SSH disabled)
                  </span>
                </>
              ) : effectiveRemote ? (
                <>
                  <Cloud className="w-3 h-3" style={{ color: theme.colors.success }} />
                  <span style={{ color: theme.colors.textMain }}>
                    Agent will run on <span className="font-medium">{effectiveRemote.name}</span>
                    <span style={{ color: theme.colors.textDim }}> ({effectiveRemote.host})</span>
                  </span>
                </>
              ) : (
                <>
                  <Monitor className="w-3 h-3" style={{ color: theme.colors.textDim }} />
                  <span style={{ color: theme.colors.textDim }}>
                    Agent will run locally
                  </span>
                </>
              )}
            </div>
          );
        })()}

        {/* No remotes configured hint */}
        {sshRemotes.filter(r => r.enabled).length === 0 && (
          <p className="text-xs" style={{ color: theme.colors.textDim }}>
            No SSH remotes configured.{' '}
            <span style={{ color: theme.colors.accent }}>
              Configure remotes in Settings → SSH Remotes.
            </span>
          </p>
        )}
      </div>

      <p className="text-xs opacity-50 mt-2">
        Execute this agent on a remote host via SSH instead of locally
      </p>
    </div>
  );
}
