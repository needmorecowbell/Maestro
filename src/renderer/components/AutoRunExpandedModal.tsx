import React, { useEffect, useRef } from 'react';
import { X, Minimize2 } from 'lucide-react';
import type { Theme, BatchRunState, SessionState } from '../types';
import { useLayerStack } from '../contexts/LayerStackContext';
import { MODAL_PRIORITIES } from '../constants/modalPriorities';
import { AutoRun, AutoRunHandle } from './AutoRun';

interface AutoRunExpandedModalProps {
  theme: Theme;
  onClose: () => void;
  // Pass through all AutoRun props
  sessionId: string;
  folderPath: string | null;
  selectedFile: string | null;
  documentList: string[];
  documentTree?: Array<{ name: string; type: 'file' | 'folder'; path: string; children?: unknown[] }>;
  content: string;
  onContentChange: (content: string) => void;
  contentVersion?: number;
  mode: 'edit' | 'preview';
  onModeChange: (mode: 'edit' | 'preview') => void;
  initialCursorPosition?: number;
  initialEditScrollPos?: number;
  initialPreviewScrollPos?: number;
  onStateChange?: (state: {
    mode: 'edit' | 'preview';
    cursorPosition: number;
    editScrollPos: number;
    previewScrollPos: number;
  }) => void;
  onOpenSetup: () => void;
  onRefresh: () => void;
  onSelectDocument: (filename: string) => void;
  onCreateDocument: (filename: string) => Promise<boolean>;
  isLoadingDocuments?: boolean;
  batchRunState?: BatchRunState;
  onOpenBatchRunner?: () => void;
  onStopBatchRun?: () => void;
  sessionState?: SessionState;
}

export function AutoRunExpandedModal({
  theme,
  onClose,
  ...autoRunProps
}: AutoRunExpandedModalProps) {
  const { registerLayer, unregisterLayer, updateLayerHandler } = useLayerStack();
  const layerIdRef = useRef<string>();
  const onCloseRef = useRef(onClose);
  const autoRunRef = useRef<AutoRunHandle>(null);
  onCloseRef.current = onClose;

  // Register layer on mount
  useEffect(() => {
    const id = registerLayer({
      type: 'modal',
      priority: MODAL_PRIORITIES.AUTORUN_EXPANDED,
      onEscape: () => {
        onCloseRef.current();
      }
    });
    layerIdRef.current = id;

    return () => {
      if (layerIdRef.current) {
        unregisterLayer(layerIdRef.current);
      }
    };
  }, [registerLayer, unregisterLayer]);

  // Keep escape handler up to date
  useEffect(() => {
    if (layerIdRef.current) {
      updateLayerHandler(layerIdRef.current, () => {
        onCloseRef.current();
      });
    }
  }, [onClose, updateLayerHandler]);

  // Focus the AutoRun component on mount
  useEffect(() => {
    // Small delay to ensure the modal is rendered
    const timer = setTimeout(() => {
      autoRunRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Modal - same size as PromptComposer for consistency */}
      <div
        className="relative w-[90vw] h-[80vh] max-w-5xl overflow-hidden rounded-xl border shadow-2xl flex flex-col"
        style={{
          backgroundColor: theme.colors.bgSidebar,
          borderColor: theme.colors.border
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: theme.colors.border }}
        >
          <h2 className="text-sm font-semibold" style={{ color: theme.colors.textMain }}>
            Auto Run - Expanded View
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors hover:bg-white/10"
              style={{ color: theme.colors.textDim }}
              title="Collapse (Esc)"
            >
              <Minimize2 className="w-4 h-4" />
              Collapse
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" style={{ color: theme.colors.textDim }} />
            </button>
          </div>
        </div>

        {/* AutoRun Content */}
        <div className="flex-1 min-h-0 overflow-hidden p-4">
          <AutoRun
            ref={autoRunRef}
            theme={theme}
            {...autoRunProps}
          />
        </div>
      </div>
    </div>
  );
}
