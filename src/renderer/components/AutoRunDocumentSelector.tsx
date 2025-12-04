import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, RefreshCw, FolderOpen, Plus } from 'lucide-react';
import type { Theme } from '../types';

interface AutoRunDocumentSelectorProps {
  theme: Theme;
  documents: string[];  // List of document filenames (without .md extension)
  selectedDocument: string | null;
  onSelectDocument: (filename: string) => void;
  onRefresh: () => void;
  onChangeFolder: () => void;
  onCreateDocument: (filename: string) => Promise<boolean>;  // Returns true if created successfully
  isLoading?: boolean;
}

export function AutoRunDocumentSelector({
  theme,
  documents,
  selectedDocument,
  onSelectDocument,
  onRefresh,
  onChangeFolder,
  onCreateDocument,
  isLoading = false,
}: AutoRunDocumentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  // Check for duplicate document name
  const normalizedNewName = newDocName.trim().toLowerCase().replace(/\.md$/i, '');
  const isDuplicate = normalizedNewName && documents.some(
    doc => doc.toLowerCase() === normalizedNewName
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  // Focus input when create modal opens
  useEffect(() => {
    if (showCreateModal) {
      requestAnimationFrame(() => {
        createInputRef.current?.focus();
      });
    }
  }, [showCreateModal]);

  const handleSelectDocument = (doc: string) => {
    onSelectDocument(doc);
    setIsOpen(false);
  };

  const handleCreateDocument = async () => {
    const trimmedName = newDocName.trim();
    if (!trimmedName || isCreating || isDuplicate) return;

    setIsCreating(true);

    // Add .md extension if not present
    let filename = trimmedName;
    if (!filename.toLowerCase().endsWith('.md')) {
      filename += '.md';
    }

    // Remove .md for the document name (our convention)
    const docName = filename.replace(/\.md$/i, '');

    const success = await onCreateDocument(docName);

    if (success) {
      setShowCreateModal(false);
      setNewDocName('');
    }

    setIsCreating(false);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setNewDocName('');
  };

  // Sort documents alphabetically
  const sortedDocuments = [...documents].sort((a, b) => a.localeCompare(b));

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        {/* Document Dropdown */}
        <div ref={dropdownRef} className="relative flex-1">
          <button
            ref={buttonRef}
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors hover:opacity-90"
            style={{
              backgroundColor: theme.colors.bgActivity,
              color: theme.colors.textMain,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <span className="truncate">
              {selectedDocument || 'Select a document...'}
            </span>
            <ChevronDown
              className={`w-4 h-4 ml-2 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              style={{ color: theme.colors.textDim }}
            />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded shadow-lg overflow-hidden z-50"
              style={{
                backgroundColor: theme.colors.bgSidebar,
                border: `1px solid ${theme.colors.border}`,
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {sortedDocuments.length === 0 ? (
                <div
                  className="px-3 py-2 text-sm"
                  style={{ color: theme.colors.textDim }}
                >
                  No markdown files found
                </div>
              ) : (
                sortedDocuments.map((doc) => (
                  <button
                    key={doc}
                    onClick={() => handleSelectDocument(doc)}
                    className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5"
                    style={{
                      color: doc === selectedDocument ? theme.colors.accent : theme.colors.textMain,
                      backgroundColor: doc === selectedDocument ? theme.colors.bgActivity : 'transparent',
                    }}
                  >
                    {doc}
                  </button>
                ))
              )}

              {/* Divider */}
              <div
                className="border-t my-1"
                style={{ borderColor: theme.colors.border }}
              />

              {/* Change Folder Option */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  onChangeFolder();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-white/5"
                style={{ color: theme.colors.textDim }}
              >
                <FolderOpen className="w-4 h-4" />
                Change Folder...
              </button>
            </div>
          )}
        </div>

        {/* Create New Document Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="p-2 rounded transition-colors hover:bg-white/10"
          style={{
            color: theme.colors.textDim,
            border: `1px solid ${theme.colors.border}`,
          }}
          title="Create new document"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={`p-2 rounded transition-colors hover:bg-white/10 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{
            color: theme.colors.textDim,
            border: `1px solid ${theme.colors.border}`,
          }}
          title="Refresh document list"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        {/* Change Folder Button */}
        <button
          onClick={onChangeFolder}
          className="p-2 rounded transition-colors hover:bg-white/10"
          style={{
            color: theme.colors.textDim,
            border: `1px solid ${theme.colors.border}`,
          }}
          title="Change folder"
        >
          <FolderOpen className="w-4 h-4" />
        </button>
      </div>

      {/* Create New Document Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[10000] animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Create New Document"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseCreateModal();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              handleCloseCreateModal();
            }
          }}
        >
          <div
            className="w-[400px] border rounded-lg shadow-2xl overflow-hidden"
            style={{ backgroundColor: theme.colors.bgSidebar, borderColor: theme.colors.border }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="p-4 border-b flex items-center justify-between"
              style={{ borderColor: theme.colors.border }}
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" style={{ color: theme.colors.accent }} />
                <h3 className="text-sm font-bold" style={{ color: theme.colors.textMain }}>
                  Create New Document
                </h3>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <label
                className="block text-xs mb-2 font-medium"
                style={{ color: theme.colors.textDim }}
              >
                Document Name
              </label>
              <input
                ref={createInputRef}
                type="text"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newDocName.trim() && !isDuplicate) {
                    e.preventDefault();
                    handleCreateDocument();
                  }
                }}
                placeholder="my-tasks"
                className="w-full p-3 rounded border bg-transparent outline-none focus:ring-1"
                style={{
                  borderColor: isDuplicate ? theme.colors.error : theme.colors.border,
                  color: theme.colors.textMain
                }}
              />
              {isDuplicate ? (
                <p className="text-xs mt-2" style={{ color: theme.colors.error }}>
                  A document with this name already exists
                </p>
              ) : (
                <p className="text-xs mt-2" style={{ color: theme.colors.textDim }}>
                  The .md extension will be added automatically if not provided.
                </p>
              )}
            </div>

            {/* Footer */}
            <div
              className="p-4 border-t flex justify-end gap-3"
              style={{ borderColor: theme.colors.border }}
            >
              <button
                type="button"
                onClick={handleCloseCreateModal}
                className="px-4 py-2 rounded border hover:bg-white/5 transition-colors"
                style={{ borderColor: theme.colors.border, color: theme.colors.textMain }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateDocument}
                disabled={!newDocName.trim() || isCreating || isDuplicate}
                className="px-4 py-2 rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: theme.colors.accent,
                  color: theme.colors.accentForeground
                }}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
