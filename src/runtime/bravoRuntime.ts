type AnyRecord = Record<string, any>;

const BRAVO_VENDOR_ID = 0x294b;
const BRAVO_PRODUCT_ID = 0x1901;
const CMD_PHASE_END = 2;
const DOUBLE_CLICK_THRESHOLD_MS = 500;

const OPERATORS: Record<string, (left: number, right: number) => boolean> = {
  '==': (l, r) => l === r,
  '!=': (l, r) => l !== r,
  '>': (l, r) => l > r,
  '<': (l, r) => l < r,
  '>=': (l, r) => l >= r,
  '<=': (l, r) => l <= r,
};

const LED_MASKS: Record<string, { byteIndex: number; bit: number }> = {
  hdg: { byteIndex: 0, bit: 1 },
  nav: { byteIndex: 0, bit: 2 },
  apr: { byteIndex: 0, bit: 4 },
  rev: { byteIndex: 0, bit: 8 },
  alt: { byteIndex: 0, bit: 16 },
  vs: { byteIndex: 0, bit: 32 },
  ias: { byteIndex: 0, bit: 64 },
  ap: { byteIndex: 0, bit: 128 },

  master_warn: { byteIndex: 1, bit: 64 },
  fire: { byteIndex: 1, bit: 128 },

  oil_low_pressure: { byteIndex: 2, bit: 1 },
  fuel_low_pressure: { byteIndex: 2, bit: 2 },
  anti_ice: { byteIndex: 2, bit: 4 },
  eng_starter: { byteIndex: 2, bit: 8 },
  apu: { byteIndex: 2, bit: 16 },
  master_caution: { byteIndex: 2, bit: 32 },
  vacuum: { byteIndex: 2, bit: 64 },
  hydro_low_pressure: { byteIndex: 2, bit: 128 },

  aux_fuel_pump: { byteIndex: 3, bit: 1 },
  parking_brake: { byteIndex: 3, bit: 2 },
  volt_low: { byteIndex: 3, bit: 4 },
  doors: { byteIndex: 3, bit: 8 },
};

const GEAR_BITS = {
  leftGreen: 1,
  leftRed: 2,
  noseGreen: 4,
  noseRed: 8,
  rightGreen: 16,
  rightRed: 32,
};

class BravoRuntime {
  private profile: AnyRecord | null = null;
  private deviceId: number | null = null;
  private lastPayload = '';
  private ledTimerId: number | null = null;
  private initialized = false;
  private apSelector = '';
  private lastKnobTs = 0;
  private clickTimers = new Map<string, number>();

  start() {
    if (!this.hasXPlane() || this.initialized) {
      return;
    }
    this.registerCommands();
    this.ledTimerId = window.setInterval(() => this.tickLeds(), 100);
    this.initialized = true;
  }

  stop() {
    if (this.ledTimerId != null) {
      window.clearInterval(this.ledTimerId);
      this.ledTimerId = null;
    }

    this.clickTimers.forEach((id) => window.clearTimeout(id));
    this.clickTimers.clear();

    if (this.deviceId != null) {
      this.sendFeature([0, 0, 0, 0]);
      try {
        (globalThis as any).XPlane.hid.close(this.deviceId);
      } catch {
        // ignore close errors
      }
      this.deviceId = null;
    }

    this.initialized = false;
    this.lastPayload = '';
  }

  setProfile(profile: AnyRecord | null) {
    this.profile = profile;
  }

  private hasXPlane() {
    return typeof (globalThis as any).XPlane?.hid?.open === 'function' &&
      typeof (globalThis as any).XPlane?.dataref?.getTypes === 'function' &&
      typeof (globalThis as any).XPlane?.utilities?.createCommand === 'function';
  }

  private ensureDeviceOpen() {
    if (this.deviceId != null) {
      return true;
    }

    try {
      const deviceId = (globalThis as any).XPlane.hid.open(BRAVO_VENDOR_ID, BRAVO_PRODUCT_ID);
      if (deviceId == null) {
        return false;
      }
      this.deviceId = deviceId;
      (globalThis as any).XPlane.hid.setNonBlocking(deviceId, true);
      return true;
    } catch {
      return false;
    }
  }

  private tickLeds() {
    if (!this.profile) {
      return;
    }
    if (!this.ensureDeviceOpen()) {
      return;
    }

    const bytes = this.computeLedBytes(this.profile);
    const payloadKey = bytes.join(',');
    if (payloadKey === this.lastPayload) {
      return;
    }

    const written = this.sendFeature(bytes);
    if (written > 0) {
      this.lastPayload = payloadKey;
    }
  }

  private sendFeature(bytes: number[]) {
    if (this.deviceId == null) {
      return -1;
    }

    const report = new Array(65).fill(0);
    report[0] = 0;
    report[1] = bytes[0] || 0;
    report[2] = bytes[1] || 0;
    report[3] = bytes[2] || 0;
    report[4] = bytes[3] || 0;

    try {
      return (globalThis as any).XPlane.hid.sendFeatureReport(this.deviceId, report);
    } catch {
      this.deviceId = null;
      return -1;
    }
  }

  private computeLedBytes(profile: AnyRecord): number[] {
    const bytes = [0, 0, 0, 0];

    const busVoltageGate = this.evalConditionProfile(profile?.conditions?.bus_voltage || {});
    if (busVoltageGate.valid && !busVoltageGate.result) {
      return bytes;
    }

    const leds = profile?.leds || {};
    Object.keys(LED_MASKS).forEach((key) => {
      if (key === 'gear') {
        return;
      }
      const section = leds[key];
      if (!section || !Array.isArray(section.datarefs) || section.datarefs.length === 0) {
        return;
      }
      const evaluated = this.evalConditionProfile(section);
      if (!evaluated.valid) {
        return;
      }
      this.setLed(bytes, key, evaluated.result);
    });

    this.applyGearLeds(profile, bytes);
    return bytes;
  }

  private applyGearLeds(profile: AnyRecord, bytes: number[]) {
    const retractable = this.evalConditionProfile(profile?.conditions?.retractable_gear || {});
    if (retractable.valid && !retractable.result) {
      return;
    }

    const gearProfile = profile?.leds?.gear;
    if (!gearProfile || !Array.isArray(gearProfile.datarefs) || gearProfile.datarefs.length === 0) {
      return;
    }

    const firstDataref = gearProfile.datarefs[0];
    if (!firstDataref?.dataref_str) {
      return;
    }

    const values = this.readArrayDataref(firstDataref.dataref_str);
    if (!values || values.length < 2) {
      return;
    }

    const rightIndex = profile?.metadata?.name === 'Flight Factor B772' ? 3 : 2;

    const applyWheel = (value: number, greenBit: number, redBit: number) => {
      if (value >= 0.99) {
        this.setBit(bytes, 1, greenBit, true);
        this.setBit(bytes, 1, redBit, false);
      } else if (value <= 0.01) {
        this.setBit(bytes, 1, greenBit, false);
        this.setBit(bytes, 1, redBit, false);
      } else {
        this.setBit(bytes, 1, greenBit, false);
        this.setBit(bytes, 1, redBit, true);
      }
    };

    applyWheel(values[0] ?? 0, GEAR_BITS.noseGreen, GEAR_BITS.noseRed);
    applyWheel(values[1] ?? 0, GEAR_BITS.leftGreen, GEAR_BITS.leftRed);
    applyWheel(values[rightIndex] ?? 0, GEAR_BITS.rightGreen, GEAR_BITS.rightRed);
  }

  private evalConditionProfile(section: AnyRecord): { valid: boolean; result: boolean } {
    const list = Array.isArray(section?.datarefs) ? section.datarefs : [];
    const conditionKey = section?.condition === 'any' || section?.conditions === 'any' ? 'any' : 'all';
    let valid = false;
    let result = conditionKey === 'any' ? false : true;

    list.forEach((entry: AnyRecord) => {
      const outcome = this.evalDatarefCondition(entry);
      if (!outcome.valid) {
        return;
      }
      valid = true;
      if (conditionKey === 'any') {
        result = result || outcome.result;
      } else {
        result = result && outcome.result;
      }
    });

    return { valid, result };
  }

  private evalDatarefCondition(entry: AnyRecord): { valid: boolean; result: boolean } {
    const name = entry?.dataref_str;
    const op = entry?.operator;
    const threshold = Number(entry?.threshold);
    const index = entry?.index != null ? Number(entry.index) : undefined;

    if (!name || !op || Number.isNaN(threshold) || !OPERATORS[op]) {
      return { valid: false, result: false };
    }

    const value = this.readNumericDataref(name, index);
    if (value == null) {
      return { valid: false, result: false };
    }

    return { valid: true, result: OPERATORS[op](value, threshold) };
  }

  private readNumericDataref(name: string, index?: number): number | null {
    try {
      const types = (globalThis as any).XPlane.dataref.getTypes(name);
      if (!types) {
        return null;
      }
      if (types.float) {
        return (globalThis as any).XPlane.dataref.getFloat(name);
      }
      if (types.int) {
        return (globalThis as any).XPlane.dataref.getInt(name);
      }
      if (types.double) {
        return (globalThis as any).XPlane.dataref.getDouble(name);
      }
      if (types.floatArray) {
        const arr = (globalThis as any).XPlane.dataref.getFloatArray(name) || [];
        const idx = index ?? 0;
        return arr[idx] ?? arr[0] ?? null;
      }
      if (types.intArray) {
        const arr = (globalThis as any).XPlane.dataref.getIntArray(name) || [];
        const idx = index ?? 0;
        return arr[idx] ?? arr[0] ?? null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private readArrayDataref(name: string): number[] | null {
    try {
      const types = (globalThis as any).XPlane.dataref.getTypes(name);
      if (!types) {
        return null;
      }
      if (types.floatArray) {
        return (globalThis as any).XPlane.dataref.getFloatArray(name) || [];
      }
      if (types.intArray) {
        return (globalThis as any).XPlane.dataref.getIntArray(name) || [];
      }
      return null;
    } catch {
      return null;
    }
  }

  private setLed(bytes: number[], key: string, on: boolean) {
    const led = LED_MASKS[key];
    if (!led) {
      return;
    }
    this.setBit(bytes, led.byteIndex, led.bit, on);
  }

  private setBit(bytes: number[], byteIndex: number, bitMask: number, on: boolean) {
    if (on) {
      bytes[byteIndex] = (bytes[byteIndex] | bitMask) & 0xff;
    } else {
      bytes[byteIndex] = (bytes[byteIndex] & ~bitMask) & 0xff;
    }
  }

  private getOrCreateCommand(name: string, description: string): number {
    const existing = (globalThis as any).XPlane.utilities.findCommand(name);
    if (existing) {
      return existing;
    }
    return (globalThis as any).XPlane.utilities.createCommand(name, description);
  }

  private registerCommands() {
    const util = (globalThis as any).XPlane.utilities;

    const increase = this.getOrCreateCommand(
      'Honeycomb Bravo/increase',
      'Increase the value of the selected autopilot mode.'
    );
    const decrease = this.getOrCreateCommand(
      'Honeycomb Bravo/decrease',
      'Decrease the value of the selected autopilot mode.'
    );

    const modeIas = this.getOrCreateCommand('Honeycomb Bravo/mode_ias', 'Set AP selector to IAS.');
    const modeAlt = this.getOrCreateCommand('Honeycomb Bravo/mode_alt', 'Set AP selector to ALT.');
    const modeVs = this.getOrCreateCommand('Honeycomb Bravo/mode_vs', 'Set AP selector to VS.');
    const modeHdg = this.getOrCreateCommand('Honeycomb Bravo/mode_hdg', 'Set AP selector to HDG.');
    const modeCrs = this.getOrCreateCommand('Honeycomb Bravo/mode_crs', 'Set AP selector to CRS.');

    util.registerCommandHandler(increase, (_: number, phase: number) => {
      if (phase === CMD_PHASE_END) {
        this.handleKnobTurn(1);
      }
      return 1;
    }, true);

    util.registerCommandHandler(decrease, (_: number, phase: number) => {
      if (phase === CMD_PHASE_END) {
        this.handleKnobTurn(-1);
      }
      return 1;
    }, true);

    util.registerCommandHandler(modeIas, (_: number, phase: number) => {
      if (phase === CMD_PHASE_END) {
        this.apSelector = 'ias';
      }
      return 1;
    }, true);

    util.registerCommandHandler(modeAlt, (_: number, phase: number) => {
      if (phase === CMD_PHASE_END) {
        this.apSelector = 'alt';
      }
      return 1;
    }, true);

    util.registerCommandHandler(modeVs, (_: number, phase: number) => {
      if (phase === CMD_PHASE_END) {
        this.apSelector = 'vs';
      }
      return 1;
    }, true);

    util.registerCommandHandler(modeHdg, (_: number, phase: number) => {
      if (phase === CMD_PHASE_END) {
        this.apSelector = 'hdg';
      }
      return 1;
    }, true);

    util.registerCommandHandler(modeCrs, (_: number, phase: number) => {
      if (phase === CMD_PHASE_END) {
        this.apSelector = 'crs';
      }
      return 1;
    }, true);

    const buttonCommands = ['ias', 'alt', 'vs', 'hdg', 'rev', 'nav', 'apr', 'ap'];
    buttonCommands.forEach((key) => {
      const cmd = this.getOrCreateCommand(`Honeycomb Bravo/ap_${key}`, `Bravo ${key.toUpperCase()} pressed.`);
      util.registerCommandHandler(cmd, (_: number, phase: number) => {
        if (phase === CMD_PHASE_END) {
          this.handleApButton(key);
        }
        return 1;
      }, true);
    });
  }

  private handleApButton(ref: string) {
    const now = Date.now();
    const existingTimer = this.clickTimers.get(ref);

    if (existingTimer != null) {
      window.clearTimeout(existingTimer);
      this.clickTimers.delete(ref);
      this.executeButtonCommands(ref, true);
      return;
    }

    const timerId = window.setTimeout(() => {
      if (this.clickTimers.has(ref)) {
        this.clickTimers.delete(ref);
        this.executeButtonCommands(ref, false);
      }
    }, DOUBLE_CLICK_THRESHOLD_MS);

    this.clickTimers.set(ref, timerId);
    void now;
  }

  private executeButtonCommands(ref: string, doubleClick: boolean) {
    const btn = this.profile?.buttons?.[ref];
    if (!btn) {
      return;
    }
    const list = doubleClick ? btn.double_click : btn.single_click;
    if (!Array.isArray(list)) {
      return;
    }

    list.forEach((entry: AnyRecord) => {
      const commandStr = entry?.command_str;
      if (!commandStr) {
        return;
      }
      const cmd = (globalThis as any).XPlane.utilities.findCommand(commandStr);
      if (!cmd) {
        return;
      }
      (globalThis as any).XPlane.utilities.commandOnce(cmd);
    });
  }

  private handleKnobTurn(direction: -1 | 1) {
    if (!this.profile?.knobs) {
      return;
    }

    const now = Date.now();
    const elapsed = this.lastKnobTs > 0 ? now - this.lastKnobTs : 1000;
    this.lastKnobTs = now;

    let multiplier = 1;
    if (elapsed < 100) {
      multiplier = 5;
    } else if (elapsed < 200) {
      multiplier = 3;
    }

    const selector = this.apSelector || 'hdg';
    let knobKey = 'ap_hdg';
    let step = 1;

    if (selector === 'ias') {
      knobKey = 'ap_ias';
      step = this.readDataProfileValue(this.profile?.data?.ap_ias_step, 1);
    } else if (selector === 'alt') {
      knobKey = 'ap_alt';
      step = this.readDataProfileValue(this.profile?.data?.ap_alt_step, 100);
      if (elapsed < 100) {
        multiplier *= 5;
      } else if (elapsed < 200) {
        multiplier *= 2;
      }
    } else if (selector === 'vs') {
      knobKey = 'ap_vs';
      step = this.readDataProfileValue(this.profile?.data?.ap_vs_step, 1);
    } else if (selector === 'crs') {
      knobKey = 'ap_crs';
      step = 1;
    }

    const knobProfile = this.profile.knobs?.[knobKey] || {};
    this.adjustKnob(knobProfile, direction, multiplier, step);
  }

  private readDataProfileValue(dataProfile: AnyRecord, fallback: number): number {
    if (!dataProfile) {
      return fallback;
    }

    const refs = Array.isArray(dataProfile.datarefs) ? dataProfile.datarefs : [];
    if (refs.length > 0) {
      const refName = refs[0]?.dataref_str;
      if (refName) {
        const value = this.readNumericDataref(refName, refs[0]?.index);
        if (value != null) {
          return value;
        }
      }
    }

    if (dataProfile.value != null && !Number.isNaN(Number(dataProfile.value))) {
      return Number(dataProfile.value);
    }

    return fallback;
  }

  private adjustKnob(knobProfile: AnyRecord, direction: -1 | 1, multiplier: number, step: number) {
    const commands = Array.isArray(knobProfile?.commands) ? knobProfile.commands : [];
    if (commands.length >= 2) {
      const commandStr = direction > 0 ? commands[0]?.command_str : commands[1]?.command_str;
      if (commandStr) {
        const cmd = (globalThis as any).XPlane.utilities.findCommand(commandStr);
        if (cmd) {
          for (let i = 0; i < Math.floor(multiplier); i += 1) {
            (globalThis as any).XPlane.utilities.commandOnce(cmd);
          }
        }
      }
    }

    const refs = Array.isArray(knobProfile?.datarefs) ? knobProfile.datarefs : [];
    refs.forEach((entry: AnyRecord) => {
      const refName = entry?.dataref_str;
      if (!refName) {
        return;
      }
      try {
        const types = (globalThis as any).XPlane.dataref.getTypes(refName);
        if (!types) {
          return;
        }
        const delta = direction * multiplier * step;
        if (types.float) {
          const current = (globalThis as any).XPlane.dataref.getFloat(refName);
          (globalThis as any).XPlane.dataref.setFloat(refName, current + delta);
          return;
        }
        if (types.int) {
          const current = (globalThis as any).XPlane.dataref.getInt(refName);
          (globalThis as any).XPlane.dataref.setInt(refName, Math.round(current + delta));
        }
      } catch {
        // ignore write failures
      }
    });
  }
}

export const bravoRuntime = new BravoRuntime();
