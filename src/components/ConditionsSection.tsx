import React from 'react';
import DatarefValue from './DatarefValue';

type AnyRecord = Record<string, any>;

type Props = {
  keys: string[];
  conditions: AnyRecord;
  datarefTick: number;
  operators: string[];
  getConditionKey: (section: AnyRecord) => 'condition' | 'conditions';
  getConditionValue: (section: AnyRecord) => 'any' | 'all';
  ensureObj: (obj: AnyRecord, path: string[]) => AnyRecord;
  onChange: (updater: (draft: AnyRecord) => void) => void;
};

const ConditionsSection: React.FC<Props> = ({
  keys,
  conditions,
  datarefTick,
  operators,
  getConditionKey,
  getConditionValue,
  ensureObj,
  onChange,
}) => {
  return (
    <section className="Card">
      <div className="Card-title Row">
        <span>Conditions</span>
        <span
          className="InfoIcon"
          data-tooltip="Conditions are shared boolean gates. bus_voltage turns all LEDs off when false. retractable_gear disables gear LEDs on fixed-gear aircraft. Multiple datarefs can be combined with 'any' (OR) or default ALL (AND)."
        >
          i
        </span>
      </div>
      <div className="Stack">
        {keys.map((key) => {
          const condition = conditions?.[key] || {};
          const conditionKey = getConditionKey(condition);
          const conditionTooltip = key === 'bus_voltage'
            ? 'Gate for all LEDs. If false, all LEDs are turned off.'
            : key === 'retractable_gear'
              ? 'Gear LEDs are disabled when this is false (used for fixed-gear aircraft).'
              : 'Shared boolean gate for profile logic.';
          return (
            <div key={key} className="Group">
              <div className="Group-title Row">
                <span>{key}</span>
                <span className="InfoIcon" data-tooltip={conditionTooltip}>i</span>
              </div>
              <div className="Row">
                <label>
                  Condition
                  <select
                    value={getConditionValue(condition)}
                    onChange={(e) => onChange((p) => {
                      const target = ensureObj(p, ['conditions', key]);
                      const value = e.target.value as 'any' | 'all';
                      if (value === 'any') {
                        target[conditionKey] = 'any';
                      } else {
                        delete target[conditionKey];
                      }
                    })}
                  >
                    <option value="all">all</option>
                    <option value="any">any</option>
                  </select>
                </label>
              </div>
              <div className="Table">
                <div className="Table-row header">
                  <div>Dataref</div>
                  <div>Operator</div>
                  <div>Threshold</div>
                  <div>Index</div>
                  <div>Value</div>
                  <div></div>
                </div>
                {(condition.datarefs || []).map((d: AnyRecord, idx: number) => (
                  <div key={idx} className="Table-row">
                    <input
                      value={d.dataref_str || ''}
                      onChange={(e) => onChange((p) => {
                        const target = ensureObj(p, ['conditions', key]);
                        target.datarefs = target.datarefs || [];
                        target.datarefs[idx] = { ...target.datarefs[idx], dataref_str: e.target.value };
                      })}
                    />
                    <select
                      value={d.operator || '=='}
                      onChange={(e) => onChange((p) => {
                        const target = ensureObj(p, ['conditions', key]);
                        target.datarefs = target.datarefs || [];
                        target.datarefs[idx] = { ...target.datarefs[idx], operator: e.target.value };
                      })}
                    >
                      {operators.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                    <input
                      value={d.threshold ?? ''}
                      onChange={(e) => onChange((p) => {
                        const target = ensureObj(p, ['conditions', key]);
                        target.datarefs = target.datarefs || [];
                        const threshold = e.target.value === '' ? undefined : Number(e.target.value);
                        target.datarefs[idx] = { ...target.datarefs[idx], threshold };
                      })}
                    />
                    <input
                      value={d.index ?? ''}
                      onChange={(e) => onChange((p) => {
                        const target = ensureObj(p, ['conditions', key]);
                        target.datarefs = target.datarefs || [];
                        const index = e.target.value === '' ? undefined : Number(e.target.value);
                        target.datarefs[idx] = { ...target.datarefs[idx], index };
                      })}
                    />
                    <DatarefValue name={d.dataref_str} index={d.index} tick={datarefTick} />
                    <button
                      className="Danger"
                      onClick={() => onChange((p) => {
                        const target = ensureObj(p, ['conditions', key]);
                        target.datarefs = (target.datarefs || []).filter((_: any, i: number) => i !== idx);
                      })}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  className="Small"
                  onClick={() => onChange((p) => {
                    const target = ensureObj(p, ['conditions', key]);
                    target.datarefs = target.datarefs || [];
                    target.datarefs.push({ dataref_str: '', operator: '==', threshold: 1 });
                  })}
                >
                  Add Dataref
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ConditionsSection;
