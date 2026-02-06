import React from 'react';

type Props = {
  profileList: string[];
  activeFile: string;
  inUseFile: string;
  status: string;
  hasSkyScript: boolean;
  onNewProfile: () => void;
  onSelectProfile: (file: string) => void;
};

const Sidebar: React.FC<Props> = ({
  profileList,
  activeFile,
  inUseFile,
  status,
  hasSkyScript,
  onNewProfile,
  onSelectProfile,
}) => {
  const inUseBase = inUseFile ? inUseFile.replace(/\.yaml$/i, '') : 'Unknown';
  return (
    <aside className="Sidebar">
      <div className="Sidebar-header">
        <div className="Brand">Honeycomb Bravo</div>
        <div className="Sub">Profile Editor</div>
      </div>
      <div className="Sidebar-actions">
        <button className="Primary" onClick={onNewProfile}>New Profile</button>
      </div>
      <div className="Sidebar-list">
        <button
          className={`ListItem InUsePinned ${inUseFile === activeFile ? 'active' : ''}`}
          onClick={() => {
            if (inUseFile) onSelectProfile(inUseFile);
          }}
          title="Current in-use profile"
        >
          <span className="ListItem-name">{inUseBase}</span>
          <span className="ListItem-right">
            <span className="PingDot" />
            <span className="InUsePill">In Use</span>
          </span>
        </button>
        {profileList.filter((file) => file !== inUseFile).map((file) => {
          const dot = file.lastIndexOf('.');
          const base = dot > 0 ? file.slice(0, dot) : file;
          return (
            <button
              key={file}
              className={`ListItem ${file === activeFile ? 'active' : ''}`}
              onClick={() => onSelectProfile(file)}
            >
              <span className="ListItem-name">{base}</span>
              <span className="ListItem-right">
                {file === inUseFile && <span className="InUseBadge" title="Currently in-use profile">✓</span>}
              </span>
            </button>
          );
        })}
        {!profileList.length && (
          <div className="Muted">No profiles loaded.</div>
        )}
      </div>
      <div className="Sidebar-footer">
        <div className="Status">{status}</div>
        {!hasSkyScript && (
          <div className="Muted">Browser mode: read-only</div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
