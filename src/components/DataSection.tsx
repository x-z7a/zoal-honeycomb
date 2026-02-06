import React from 'react';
import DatarefValue from './DatarefValue';

type AnyRecord = Record<string, any>;

type Props = {
  keys: string[];
  data: AnyRecord;
  datarefTick: number;
  onChange: (updater: (draft: AnyRecord) => void) => void;
  normalizeLines: (value: string) => string[];
  ensureObj: (obj: AnyRecord, path: string[]) => AnyRecord;
};

const DataSection: React.FC<Props> = ({ keys, data, datarefTick, onChange, normalizeLines, ensureObj }) => {
  return (
    <section className="Card">
      <div className="Card-title Row">
        <span>Data</span>
        <span
          className="InfoIcon"
          data-tooltip="Data values are read from datarefs. Optional 'value' can be used to override or initialize a value for the profile."
        >
          i
        </span>
      </div>
      <div className="Stack">
        {keys.map((key) => {
          const entry = data?.[key] || {};
          const datarefs = (entry.datarefs || [])
            .map((d: AnyRecord) => d.dataref_str || '')
            .filter(Boolean);
          return (
            <div key={key} className="Group">
              <div className="Group-title">{key}</div>
              <div className="Grid">
                <label>
                  Value
                  <input
                    value={entry.value ?? ''}
                    onChange={(e) => onChange((p) => {
                      const target = ensureObj(p, ['data', key]);
                      target.value = e.target.value === '' ? undefined : Number(e.target.value);
                    })}
                  />
                </label>
                <label>
                  Datarefs (one per line)
                  <textarea
                    value={(entry.datarefs || []).map((d: AnyRecord) => d.dataref_str || '').join('\n')}
                    onChange={(e) => onChange((p) => {
                      const target = ensureObj(p, ['data', key]);
                      const lines = normalizeLines(e.target.value);
                      target.datarefs = lines.map((dataref_str) => ({ dataref_str }));
                    })}
                  />
                  {datarefs.length > 0 && (
                    <div className="ValueList">
                      {datarefs.map((name: string) => (
                        <div key={name} className="ValueRow">
                          <span className="ValueName">{name}</span>
                          <DatarefValue name={name} tick={datarefTick} />
                        </div>
                      ))}
                    </div>
                  )}
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default DataSection;
