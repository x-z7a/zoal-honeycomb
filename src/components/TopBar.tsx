import React, { useEffect, useState } from 'react';

type Props = {
  activeFile: string;
  activeTab: 'form' | 'yaml';
  canSave: boolean;
  onFilenameChange: (value: string) => void;
  onTabChange: (tab: 'form' | 'yaml') => void;
  onSave: () => void;
  onSaveAs: () => void;
};

const TopBar: React.FC<Props> = ({
  activeFile,
  activeTab,
  canSave,
  onFilenameChange,
  onTabChange,
  onSave,
  onSaveAs,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(activeFile);

  const stripExt = (value: string) => {
    const dot = value.lastIndexOf('.');
    return dot > 0 ? value.slice(0, dot) : value;
  };

  const withYamlExt = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return trimmed.endsWith('.yaml') ? trimmed : `${trimmed}.yaml`;
  };

  useEffect(() => {
    if (!isEditing) {
      setDraftName(activeFile);
    }
  }, [activeFile, isEditing]);

  const commitName = () => {
    const next = withYamlExt(draftName);
    if (next && next !== activeFile) {
      onFilenameChange(next);
    }
    setIsEditing(false);
  };

  return (
    <div className="TopBar">
      <div className="FileName">
        {!isEditing && (
          <div className="FileName-display">
            <span>{stripExt(activeFile) || 'Untitled'}</span>
            <button
              className="IconButton"
              type="button"
              aria-label="Edit filename"
              onClick={() => {
                setDraftName(stripExt(activeFile));
                setIsEditing(true);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm2.92 2.83H5v-.92l9.06-9.06.92.92-9.06 9.06ZM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.82 1.82 3.75 3.75 1.83-1.81Z" />
              </svg>
            </button>
          </div>
        )}
        {isEditing && (
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitName();
              } else if (e.key === 'Escape') {
                setDraftName(activeFile);
                setIsEditing(false);
              }
            }}
            placeholder="Filename (e.g. C172.yaml)"
            autoFocus
          />
        )}
      </div>
      <div className="TopBar-actions">
        <button onClick={() => onTabChange('form')} className={activeTab === 'form' ? 'Active' : ''}>Form</button>
        <button onClick={() => onTabChange('yaml')} className={activeTab === 'yaml' ? 'Active' : ''}>YAML</button>
        <button className="Primary" onClick={onSave} disabled={!canSave}>Save</button>
        <button onClick={onSaveAs}>Save As</button>
      </div>
    </div>
  );
};

export default TopBar;
