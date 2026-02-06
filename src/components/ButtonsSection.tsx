import React from 'react';

type AnyRecord = Record<string, any>;

type Props = {
  keys: string[];
  buttons: AnyRecord;
  onChange: (updater: (draft: AnyRecord) => void) => void;
  normalizeLines: (value: string) => string[];
  ensureObj: (obj: AnyRecord, path: string[]) => AnyRecord;
};

const ButtonsSection: React.FC<Props> = ({ keys, buttons, onChange, normalizeLines, ensureObj }) => {
  return (
    <section className="Card">
      <div className="Card-title Row">
        <span>Buttons</span>
        <span
          className="InfoIcon"
          data-tooltip="Buttons support single and double click. Each line is an X-Plane command string that will be executed in order."
        >
          i
        </span>
      </div>
      <div className="Stack">
        {keys.map((key) => {
          const btn = buttons?.[key] || {};
          return (
            <div key={key} className="Group">
              <div className="Group-title">{key}</div>
              <div className="Grid">
                <label>
                  Single Click (one command per line)
                  <textarea
                    value={(btn.single_click || []).map((c: AnyRecord) => c.command_str || '').join('\n')}
                    onChange={(e) => onChange((p) => {
                      const target = ensureObj(p, ['buttons', key]);
                      const lines = normalizeLines(e.target.value);
                      target.single_click = lines.map((command_str) => ({ command_str }));
                    })}
                  />
                </label>
                <label>
                  Double Click (one command per line)
                  <textarea
                    value={(btn.double_click || []).map((c: AnyRecord) => c.command_str || '').join('\n')}
                    onChange={(e) => onChange((p) => {
                      const target = ensureObj(p, ['buttons', key]);
                      const lines = normalizeLines(e.target.value);
                      target.double_click = lines.map((command_str) => ({ command_str }));
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

export default ButtonsSection;
