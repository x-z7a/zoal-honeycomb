import React from 'react';
import DatarefValue from './DatarefValue';

type AnyRecord = Record<string, any>;

type Props = {
  keys: string[];
  knobs: AnyRecord;
  datarefTick: number;
  onChange: (updater: (draft: AnyRecord) => void) => void;
  normalizeLines: (value: string) => string[];
  ensureObj: (obj: AnyRecord, path: string[]) => AnyRecord;
};

const KnobsSection: React.FC<Props> = ({ keys, knobs, datarefTick, onChange, normalizeLines, ensureObj }) => {
  return (
    <section className="Card">
      <div className="Card-title Row">
        <span>Knobs</span>
        <span
          className="InfoIcon"
          data-tooltip="Knobs can be wired to datarefs (for direct set) or command pairs (increment/decrement). One entry per line."
        >
          i
        </span>
      </div>
      <div className="Stack">
        {keys.map((key) => {
          const knob = knobs?.[key] || {};
          const knobDatarefs = (knob.datarefs || [])
            .map((d: AnyRecord) => d.dataref_str || '')
            .filter(Boolean);
          return (
            <div key={key} className="Group">
              <div className="Group-title">{key}</div>
              <div className="Grid">
                <label>
                  Datarefs (one per line)
                  <textarea
                    value={(knob.datarefs || []).map((d: AnyRecord) => d.dataref_str || '').join('\n')}
                    onChange={(e) => onChange((p) => {
                      const target = ensureObj(p, ['knobs', key]);
                      const lines = normalizeLines(e.target.value);
                      target.datarefs = lines.map((dataref_str) => ({ dataref_str }));
                    })}
                  />
                  {knobDatarefs.length > 0 && (
                    <div className="ValueList">
                      {knobDatarefs.map((name: string) => (
                        <div key={name} className="ValueRow">
                          <span className="ValueName">{name}</span>
                          <DatarefValue name={name} tick={datarefTick} />
                        </div>
                      ))}
                    </div>
                  )}
                </label>
                <label>
                  Commands (one command per line)
                  <textarea
                    value={(knob.commands || []).map((c: AnyRecord) => c.command_str || '').join('\n')}
                    onChange={(e) => onChange((p) => {
                      const target = ensureObj(p, ['knobs', key]);
                      const lines = normalizeLines(e.target.value);
                      target.commands = lines.map((command_str) => ({ command_str }));
                    })}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default KnobsSection;
