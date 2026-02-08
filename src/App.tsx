import React, { useCallback, useEffect, useMemo, useState } from 'react';
import yaml from 'js-yaml';
import './App.css';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import MetadataSection from './components/MetadataSection';
import ButtonsSection from './components/ButtonsSection';
import KnobsSection from './components/KnobsSection';
import LedsSection from './components/LedsSection';
import DataSection from './components/DataSection';
import ConditionsSection from './components/ConditionsSection';
import { hasXPlane } from './utils/dataref';
import { bravoRuntime } from './runtime/bravoRuntime';

type AnyRecord = Record<string, any>;

type LoadResult = {
  ok: boolean;
  list?: string[];
  message?: string;
};

const BUTTON_KEYS = ['hdg', 'nav', 'alt', 'apr', 'vs', 'ap', 'ias', 'rev'];
const KNOB_KEYS = ['ap_hdg', 'ap_vs', 'ap_alt', 'ap_ias', 'ap_crs'];
const LED_KEYS = [
  'hdg', 'nav', 'alt', 'apr', 'vs', 'ap', 'ias', 'rev', 'gear', 'master_warn', 'master_caution',
  'fire', 'oil_low_pressure', 'fuel_low_pressure', 'anti_ice', 'eng_starter', 'apu', 'vacuum',
  'hydro_low_pressure', 'aux_fuel_pump', 'parking_brake', 'volt_low', 'doors',
];
const DATA_KEYS = ['ap_state', 'ap_alt_step', 'ap_vs_step', 'ap_ias_step'];
const CONDITION_KEYS = ['bus_voltage', 'retractable_gear'];
const OPERATORS = ['==', '!=', '>', '<', '>=', '<='];

const defaultProfile = (): AnyRecord => ({
  metadata: {
    name: 'New Profile',
    description: '',
    selectors: [],
  },
  buttons: {},
  knobs: {},
  leds: {},
  data: {},
  conditions: {},
});

const hasSkyScript = () => typeof (window as any).SkyScript?.fs?.readFile === 'function';

const readFile = async (path: string): Promise<string | null> => {
  if (hasSkyScript()) {
    return (window as any).SkyScript.fs.readFile(path);
  }
  const url = `${process.env.PUBLIC_URL || ''}/${path}`.replace(/\\+/g, '/');
  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.text();
};

const writeFile = (path: string, content: string): boolean => {
  if (!hasSkyScript()) return false;
  return (window as any).SkyScript.fs.writeFile(path, content);
};

const clone = <T,>(value: T): T => {
  if (typeof (globalThis as any).structuredClone === 'function') {
    return (globalThis as any).structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const ensureObj = (obj: AnyRecord, path: string[]) => {
  let cur = obj;
  for (const key of path) {
    if (cur[key] == null || typeof cur[key] !== 'object') {
      cur[key] = {};
    }
    cur = cur[key];
  }
  return cur;
};

const normalizeLines = (value: string) => value
  .split(/\r?\n/)
  .map((v) => v.trim())
  .filter(Boolean);

const ensureYamlFilename = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.toLowerCase().endsWith('.yaml') ? trimmed : `${trimmed}.yaml`;
};

const getConditionKey = (section: AnyRecord): 'condition' | 'conditions' => {
  if (section && typeof section === 'object') {
    if ('condition' in section) return 'condition';
    if ('conditions' in section) return 'conditions';
  }
  return 'condition';
};

const getConditionValue = (section: AnyRecord): 'any' | 'all' => {
  if (!section) return 'all';
  const key = getConditionKey(section);
  return section[key] === 'any' ? 'any' : 'all';
};

function App() {
  const [profileList, setProfileList] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');
  const [inUseFile, setInUseFile] = useState<string>('');
  const [profile, setProfile] = useState<AnyRecord | null>(null);
  const [yamlText, setYamlText] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [parseError, setParseError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'form' | 'yaml'>('form');
  const [datarefTick, setDatarefTick] = useState<number>(0);
  const [nameDialogOpen, setNameDialogOpen] = useState<boolean>(false);
  const [nameDialogTitle, setNameDialogTitle] = useState<string>('Save As');
  const [nameDialogValue, setNameDialogValue] = useState<string>('new_profile.yaml');
  const [nameDialogAction, setNameDialogAction] = useState<'saveAs' | 'newProfile'>('saveAs');

  useEffect(() => {
    if (!hasSkyScript()) {
      return;
    }
    try {
      const flag = sessionStorage.getItem('zoal_honeycomb_initial_reload_done');
      if (flag !== '1') {
        sessionStorage.setItem('zoal_honeycomb_initial_reload_done', '1');
        window.location.reload();
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  const loadIndex = useCallback(async (): Promise<LoadResult> => {
    setStatus('Loading profiles...');
    const content = await readFile('profiles/index.json');
    if (!content) {
      setStatus('No profiles/index.json found.');
      return { ok: false, message: 'Missing profiles/index.json' };
    }
    try {
      const list = JSON.parse(content) as string[];
      setProfileList(list);
      setStatus(`Loaded ${list.length} profiles.`);
      return { ok: true, list };
    } catch (err) {
      setStatus('Failed to parse profiles/index.json.');
      return { ok: false, message: 'Invalid profiles/index.json' };
    }
  }, []);

  const loadProfile = useCallback(async (filename: string): Promise<LoadResult> => {
    setStatus(`Loading ${filename}...`);
    const content = await readFile(`profiles/${filename}`);
    if (!content) {
      setStatus(`Failed to read profiles/${filename}.`);
      return { ok: false, message: 'File not found' };
    }
    try {
      const parsed = yaml.load(content) as AnyRecord;
      setProfile(parsed || {});
      setActiveFile(filename);
      setYamlText(content);
      setParseError('');
      setStatus(`Loaded ${filename}.`);
      return { ok: true };
    } catch (err: any) {
      setParseError(err?.message || 'YAML parse error');
      setStatus(`Failed to parse ${filename}.`);
      return { ok: false, message: 'YAML parse error' };
    }
  }, []);

  const detectInUseProfile = useCallback(async (list: string[]): Promise<string> => {
    if (!hasXPlane() || list.length === 0) {
      return '';
    }
    try {
      const dataref = (globalThis as any).XPlane.dataref;
      const aircraftIcao = (dataref.getData('sim/aircraft/view/acf_ICAO') || '').trim();
      const aircraftUiName = (dataref.getData('sim/aircraft/view/acf_ui_name') || '').trim();
      if (!aircraftIcao) {
        return list.includes('default.yaml') ? 'default.yaml' : '';
      }

      let selected = `${aircraftIcao}.yaml`;
      if (!list.includes(selected)) {
        selected = list.includes('default.yaml') ? 'default.yaml' : list[0];
      }

      const candidates = list.filter((name) => name.startsWith(`${aircraftIcao}`) && name.endsWith('.yaml'));
      for (const candidate of candidates) {
        const content = await readFile(`profiles/${candidate}`);
        if (!content) {
          continue;
        }
        try {
          const parsed = (yaml.load(content) as AnyRecord) || {};
          const selectors = Array.isArray(parsed?.metadata?.selectors) ? parsed.metadata.selectors : [];
          if (selectors.includes(aircraftUiName)) {
            selected = candidate;
            break;
          }
        } catch {
          // ignore parse errors while matching
        }
      }

      return selected;
    } catch {
      return '';
    }
  }, []);

  useEffect(() => {
    (async () => {
      const result = await loadIndex();
      if (result.ok) {
        const list = result.list || [];
        let detected = '';
        if (hasXPlane()) {
          detected = await detectInUseProfile(list);
          if (detected) {
            setInUseFile(detected);
          }
        }
        const first = detected || list[0];
        if (first) {
          await loadProfile(first);
        }
      }
    })();
  }, [loadIndex, loadProfile, detectInUseProfile]);

  useEffect(() => {
    if (!hasXPlane()) {
      return;
    }
    let canceled = false;
    const tick = async () => {
      const detected = await detectInUseProfile(profileList);
      if (!canceled && detected) {
        setInUseFile((prev) => (prev === detected ? prev : detected));
      }
    };
    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, 4000);
    return () => {
      canceled = true;
      window.clearInterval(id);
    };
  }, [profileList, detectInUseProfile]);

  useEffect(() => {
    if (!hasXPlane()) return;
    const id = window.setInterval(() => setDatarefTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hasXPlane()) {
      return;
    }
    bravoRuntime.start();
    return () => {
      bravoRuntime.stop();
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    try {
      const dumped = yaml.dump(profile, { lineWidth: 120 });
      setYamlText(dumped);
    } catch {
      // ignore
    }
  }, [profile]);

  useEffect(() => {
    if (!hasXPlane()) {
      return;
    }
    bravoRuntime.setProfile(profile);
  }, [profile]);

  const updateProfile = useCallback((updater: (draft: AnyRecord) => void) => {
    setProfile((prev) => {
      const next = clone(prev || {});
      updater(next);
      return next;
    });
  }, []);

  const profileMeta = profile?.metadata || {};

  const allButtonKeys = useMemo(() => Array.from(new Set([...(Object.keys(profile?.buttons || {})), ...BUTTON_KEYS])), [profile]);
  const allKnobKeys = useMemo(() => Array.from(new Set([...(Object.keys(profile?.knobs || {})), ...KNOB_KEYS])), [profile]);
  const allLedKeys = useMemo(() => Array.from(new Set([...(Object.keys(profile?.leds || {})), ...LED_KEYS])), [profile]);
  const allDataKeys = useMemo(() => Array.from(new Set([...(Object.keys(profile?.data || {})), ...DATA_KEYS])), [profile]);
  const allConditionKeys = useMemo(() => Array.from(new Set([...(Object.keys(profile?.conditions || {})), ...CONDITION_KEYS])), [profile]);

  const saveProfileToName = useCallback((name: string, contentProfile: AnyRecord) => {
    const content = yaml.dump(contentProfile, { lineWidth: 120 });
    const ok = writeFile(`profiles/${name}`, content);
    if (!ok) {
      setStatus('Save not available in browser mode.');
      return false;
    }
    let nextList = profileList.slice();
    if (!nextList.includes(name)) {
      nextList.push(name);
      nextList = nextList.sort();
      writeFile('profiles/index.json', JSON.stringify(nextList, null, 2));
      setProfileList(nextList);
    }
    setActiveFile(name);
    setStatus(`Saved profiles/${name}.`);
    return true;
  }, [profileList]);

  const openNameDialog = useCallback((action: 'saveAs' | 'newProfile') => {
    const defaultName = ensureYamlFilename(activeFile || 'new_profile.yaml');
    setNameDialogAction(action);
    setNameDialogTitle(action === 'newProfile' ? 'Create New Profile' : 'Save Profile As');
    setNameDialogValue(defaultName);
    setNameDialogOpen(true);
  }, [activeFile]);

  const handleNameDialogConfirm = useCallback(async () => {
    const name = ensureYamlFilename(nameDialogValue);
    if (!name) {
      setStatus('Please enter a valid filename.');
      return;
    }

    if (nameDialogAction === 'saveAs') {
      if (!profile) return;
      const ok = saveProfileToName(name, profile);
      if (ok) {
        setNameDialogOpen(false);
      }
      return;
    }

    const template = await readFile('profiles/default.yaml');
    let baseProfile: AnyRecord = defaultProfile();
    if (template) {
      try {
        baseProfile = (yaml.load(template) as AnyRecord) || baseProfile;
      } catch {
        // fall back to default profile object
      }
    }

    setProfile(baseProfile);
    setActiveFile(name);
    setStatus(`New profile created from default.yaml: ${name}`);
    setNameDialogOpen(false);
  }, [nameDialogValue, nameDialogAction, profile, saveProfileToName]);

  const handleSaveAs = useCallback(() => {
    openNameDialog('saveAs');
  }, [openNameDialog]);

  const handleSave = useCallback(() => {
    if (!profile) return;
    if (!activeFile) {
      handleSaveAs();
      return;
    }
    const content = yaml.dump(profile, { lineWidth: 120 });
    const ok = writeFile(`profiles/${activeFile}`, content);
    if (ok) {
      if (!profileList.includes(activeFile)) {
        const nextList = [...profileList, activeFile].sort();
        writeFile('profiles/index.json', JSON.stringify(nextList, null, 2));
        setProfileList(nextList);
      }
      setStatus(`Saved profiles/${activeFile}.`);
    } else {
      setStatus('Save not available in browser mode.');
    }
  }, [profile, activeFile, handleSaveAs, profileList]);

  const handleNewProfile = useCallback(() => {
    openNameDialog('newProfile');
  }, [openNameDialog]);

  const handleApplyYaml = useCallback(() => {
    try {
      const parsed = yaml.load(yamlText) as AnyRecord;
      setProfile(parsed || {});
      setParseError('');
      setStatus('YAML applied.');
    } catch (err: any) {
      setParseError(err?.message || 'YAML parse error');
      setStatus('Failed to parse YAML.');
    }
  }, [yamlText]);

  const handleRefreshPage = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <div className="App">
      <Sidebar
        profileList={profileList}
        activeFile={activeFile}
        inUseFile={inUseFile}
        status={status}
        hasSkyScript={hasSkyScript()}
        onNewProfile={handleNewProfile}
        onSelectProfile={loadProfile}
      />

      <main className="Main">
        <TopBar
          activeFile={activeFile}
          activeTab={activeTab}
          canSave={!!profile}
          onFilenameChange={setActiveFile}
          onTabChange={setActiveTab}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
        />

        {parseError && <div className="Error">YAML error: {parseError}</div>}

        {activeTab === 'yaml' && (
          <div className="YamlPanel">
            <textarea value={yamlText} onChange={(e) => setYamlText(e.target.value)} />
            <div className="Row">
              <button className="Primary" onClick={handleApplyYaml}>Apply YAML</button>
            </div>
          </div>
        )}

        {activeTab === 'form' && profile && (
          <div className="Form">
            <MetadataSection
              metadata={profileMeta}
              onChange={updateProfile}
              normalizeLines={normalizeLines}
              ensureObj={ensureObj}
              datarefTick={datarefTick}
            />

            <ButtonsSection
              keys={allButtonKeys}
              buttons={profile.buttons}
              onChange={updateProfile}
              normalizeLines={normalizeLines}
              ensureObj={ensureObj}
            />

            <KnobsSection
              keys={allKnobKeys}
              knobs={profile.knobs}
              datarefTick={datarefTick}
              onChange={updateProfile}
              normalizeLines={normalizeLines}
              ensureObj={ensureObj}
            />

            <LedsSection
              keys={allLedKeys}
              leds={profile.leds}
              datarefTick={datarefTick}
              operators={OPERATORS}
              getConditionKey={getConditionKey}
              getConditionValue={getConditionValue}
              ensureObj={ensureObj}
              onChange={updateProfile}
            />

            <DataSection
              keys={allDataKeys}
              data={profile.data}
              datarefTick={datarefTick}
              onChange={updateProfile}
              normalizeLines={normalizeLines}
              ensureObj={ensureObj}
            />

            <ConditionsSection
              keys={allConditionKeys}
              conditions={profile.conditions}
              datarefTick={datarefTick}
              operators={OPERATORS}
              getConditionKey={getConditionKey}
              getConditionValue={getConditionValue}
              ensureObj={ensureObj}
              onChange={updateProfile}
            />
          </div>
        )}
      </main>

      {nameDialogOpen && (
        <div className="ModalOverlay" onClick={() => setNameDialogOpen(false)}>
          <div className="Modal" onClick={(e) => e.stopPropagation()}>
            <div className="ModalTitle">{nameDialogTitle}</div>
            <label className="ModalLabel">
              Filename
              <input
                autoFocus
                value={nameDialogValue}
                onChange={(e) => setNameDialogValue(e.target.value)}
                placeholder="e.g. C172.yaml"
              />
            </label>
            <div className="ModalActions">
              <button onClick={() => setNameDialogOpen(false)}>Cancel</button>
              <button className="Primary" onClick={() => void handleNameDialogConfirm()}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className="FloatingRefreshButton"
        onClick={handleRefreshPage}
        title="Refresh page"
      >
        Refresh
      </button>
    </div>
  );
}

export default App;
