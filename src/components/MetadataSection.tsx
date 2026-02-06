import React from 'react';
import { hasXPlane } from '../utils/dataref';

type AnyRecord = Record<string, any>;

type Props = {
  metadata: AnyRecord;
  onChange: (updater: (draft: AnyRecord) => void) => void;
  normalizeLines: (value: string) => string[];
  ensureObj: (obj: AnyRecord, path: string[]) => AnyRecord;
  datarefTick: number;
};

const MetadataSection: React.FC<Props> = ({ metadata, onChange, normalizeLines, ensureObj, datarefTick }) => {
  const uiNameDataref = 'sim/aircraft/view/acf_ui_name';
  void datarefTick;
  let uiName = '';
  if (hasXPlane()) {
    try {
      uiName = (globalThis as any).XPlane.dataref.getData(uiNameDataref) || '';
    } catch {
      uiName = '';
    }
  }
  const selectors = metadata.selectors || [];
  const isMatch = uiName !== '' && selectors.includes(uiName);
  return (
    <section className="Card">
      <div className="Card-title">Metadata</div>
      <div className="MetadataGrid">
        <label>
          Name
          <input
            value={metadata.name || ''}
            onChange={(e) => onChange((p) => {
              ensureObj(p, ['metadata']);
              p.metadata.name = e.target.value;
            })}
          />
        </label>
        <label>
          Description
          <input
            value={metadata.description || ''}
            onChange={(e) => onChange((p) => {
              ensureObj(p, ['metadata']);
              p.metadata.description = e.target.value;
            })}
          />
        </label>
        <label className="MetadataSelectors">
          <div className="LabelRow">
            Selectors (one per line)
            <span
              className="InfoIcon"
              data-tooltip="Used to match specific aircraft UI names when multiple profiles share the same ICAO. The loader picks the profile whose selector equals the current aircraft UI name."
            >
              i
            </span>
          </div>
          <textarea
            value={(metadata.selectors || []).join('\n')}
            onChange={(e) => onChange((p) => {
              ensureObj(p, ['metadata']);
              p.metadata.selectors = normalizeLines(e.target.value);
            })}
          />
          <div className="ValueRow">
            <span className="ValueName LabelRow">
              Current UI name
              <span
                className="InfoIcon"
                data-tooltip="This is sim/aircraft/view/acf_ui_name. The loader uses selectors to match the current aircraft UI name when multiple profiles share the same ICAO."
              >
                i
              </span>
            </span>
            <span className={`StatusBadge ${isMatch ? 'good' : 'bad'}`}>
              <span className="StatusIcon">{isMatch ? '✓' : '!'}</span>
              {uiName || 'Unavailable'}
            </span>
          </div>
        </label>
      </div>
    </section>
  );
};

export default MetadataSection;
