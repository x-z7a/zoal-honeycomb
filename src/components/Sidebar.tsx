import React, { useEffect, useState } from 'react';

type Props = {
  profileList: string[];
  activeFile: string;
  inUseFile: string;
  status: string;
  hasSkyScript: boolean;
  onNewProfile: () => void;
  onSelectProfile: (file: string) => void;
};

type ReleaseInfo = {
  tag_name: string;
  prerelease: boolean;
  draft: boolean;
};

type ParsedSemver = {
  major: number;
  minor: number;
  patch: number;
  prereleaseParts: string[];
  version: string;
};

const RELEASES_API_URL = 'https://api.github.com/repos/x-z7a/zoal-honeycomb/releases?per_page=100';
const MANIFEST_URL = `${process.env.PUBLIC_URL || ''}/manifest.json`;

const semverRegex = /^[vV]?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const parseSemver = (value: string): ParsedSemver | null => {
  const match = value.trim().match(semverRegex);
  if (!match) return null;
  const prereleaseParts = match[4] ? match[4].split('.') : [];
  const version = `${match[1]}.${match[2]}.${match[3]}${prereleaseParts.length ? `-${prereleaseParts.join('.')}` : ''}`;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prereleaseParts,
    version,
  };
};

const comparePrereleasePart = (a: string, b: string): number => {
  const aIsNumeric = /^\d+$/.test(a);
  const bIsNumeric = /^\d+$/.test(b);
  if (aIsNumeric && bIsNumeric) {
    return Number(a) - Number(b);
  }
  if (aIsNumeric && !bIsNumeric) return -1;
  if (!aIsNumeric && bIsNumeric) return 1;
  return a.localeCompare(b);
};

const compareSemver = (a: ParsedSemver, b: ParsedSemver): number => {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  const aPreLen = a.prereleaseParts.length;
  const bPreLen = b.prereleaseParts.length;
  if (aPreLen === 0 && bPreLen === 0) return 0;
  if (aPreLen === 0) return 1;
  if (bPreLen === 0) return -1;

  const len = Math.max(aPreLen, bPreLen);
  for (let i = 0; i < len; i += 1) {
    const aPart = a.prereleaseParts[i];
    const bPart = b.prereleaseParts[i];
    if (aPart == null) return -1;
    if (bPart == null) return 1;
    const cmp = comparePrereleasePart(aPart, bPart);
    if (cmp !== 0) return cmp;
  }
  return 0;
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
  const packageVersion = 'n/a';
  const [currentVersion, setCurrentVersion] = useState<string>(packageVersion);
  const [stableVersion, setStableVersion] = useState<string>('...');
  const [unstableVersion, setUnstableVersion] = useState<string>('...');
  const parsedCurrentVersion = parseSemver(currentVersion);
  const parsedStableVersion = parseSemver(stableVersion);
  const hasStableUpdate = Boolean(
    parsedCurrentVersion
    && parsedStableVersion
    && compareSemver(parsedStableVersion, parsedCurrentVersion) > 0,
  );

  useEffect(() => {
    let active = true;
    const loadReleaseVersions = async () => {
      try {
        const res = await fetch(RELEASES_API_URL, {
          headers: {
            Accept: 'application/vnd.github+json',
          },
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const releases = (await res.json()) as ReleaseInfo[];
        let latestStable: ParsedSemver | null = null;
        let latestUnstable: ParsedSemver | null = null;

        for (const release of releases) {
          if (release?.draft) continue;
          const parsed = parseSemver(release?.tag_name || '');
          if (!parsed) continue;

          const isPrerelease = release.prerelease || parsed.prereleaseParts.length > 0;
          if (isPrerelease) {
            if (!latestUnstable || compareSemver(parsed, latestUnstable) > 0) {
              latestUnstable = parsed;
            }
            continue;
          }

          if (!latestStable || compareSemver(parsed, latestStable) > 0) {
            latestStable = parsed;
          }
        }

        if (!active) return;
        setStableVersion(latestStable ? latestStable.version : 'n/a');
        setUnstableVersion(latestUnstable ? latestUnstable.version : 'n/a');
      } catch {
        if (!active) return;
        setStableVersion('n/a');
        setUnstableVersion('n/a');
      }
    };

    void loadReleaseVersions();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadCurrentVersion = async () => {
      try {
        const res = await fetch(MANIFEST_URL);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const manifest = (await res.json()) as { version?: string };
        const manifestVersion = parseSemver(manifest?.version || '')?.version;
        if (!active) return;
        setCurrentVersion(manifestVersion ?? packageVersion);
      } catch {
        if (!active) return;
        setCurrentVersion(packageVersion);
      }
    };
    void loadCurrentVersion();
    return () => {
      active = false;
    };
  }, [packageVersion]);

  return (
    <aside className="Sidebar">
      <div className="Sidebar-header">
        <div className="Brand">Honeycomb Bravo</div>
        <div className="Sub">Profile Editor</div>
        <div className="ReleaseVersions">
          <div className="ReleaseVersions-title">Versions</div>
          <div className="ReleaseVersions-row">
            <span className="ReleaseVersions-label">Current</span>
            <span className="ReleaseVersions-value">{currentVersion}</span>
          </div>
          <div className={`ReleaseVersions-row ${hasStableUpdate ? 'isUpdate' : ''}`}>
            <span className="ReleaseVersions-label">Stable</span>
            <span className="ReleaseVersions-value">{stableVersion}</span>
          </div>
          <div className="ReleaseVersions-row">
            <span className="ReleaseVersions-label">Unstable</span>
            <span className="ReleaseVersions-value">{unstableVersion}</span>
          </div>
        </div>
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
