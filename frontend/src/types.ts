export interface Command {
  command_str?: string;
}

export interface Dataref {
  dataref_str?: string;
  index?: number;
}

export interface DatarefCondition {
  dataref_str?: string;
  index?: number;
  operator?: string;
  threshold?: number;
}

export interface Metadata {
  name?: string;
  description?: string;
  selectors?: string[];
}

export interface ConditionProfile {
  datarefs?: DatarefCondition[];
  condition?: string;
}

export interface LEDProfile {
  datarefs?: DatarefCondition[];
  condition?: string;
}

export interface DataProfile {
  datarefs?: Dataref[];
  value?: number;
}

export interface KnobProfile {
  datarefs?: Dataref[];
  commands?: Command[];
}

export interface ButtonProfile {
  single_click?: Command[];
  double_click?: Command[];
}

export interface Buttons {
  hdg?: ButtonProfile;
  nav?: ButtonProfile;
  alt?: ButtonProfile;
  apr?: ButtonProfile;
  vs?: ButtonProfile;
  ap?: ButtonProfile;
  ias?: ButtonProfile;
  rev?: ButtonProfile;
}

export interface Leds {
  hdg?: LEDProfile;
  nav?: LEDProfile;
  alt?: LEDProfile;
  apr?: LEDProfile;
  vs?: LEDProfile;
  ap?: LEDProfile;
  ias?: LEDProfile;
  rev?: LEDProfile;
  gear?: LEDProfile;
  master_warn?: LEDProfile;
  master_caution?: LEDProfile;
  fire?: LEDProfile;
  oil_low_pressure?: LEDProfile;
  fuel_low_pressure?: LEDProfile;
  anti_ice?: LEDProfile;
  eng_starter?: LEDProfile;
  apu?: LEDProfile;
  vacuum?: LEDProfile;
  hydro_low_pressure?: LEDProfile;
  aux_fuel_pump?: LEDProfile;
  parking_brake?: LEDProfile;
  volt_low?: LEDProfile;
  doors?: LEDProfile;
}

export interface Knobs {
  ap_hdg?: KnobProfile;
  ap_vs?: KnobProfile;
  ap_alt?: KnobProfile;
  ap_ias?: KnobProfile;
  ap_crs?: KnobProfile;
}

export interface Data {
  ap_alt_step?: DataProfile;
  ap_vs_step?: DataProfile;
  ap_ias_step?: DataProfile;
}

export interface TrimWheels {
  up_cmd?: string;
  down_cmd?: string;
  sensitivity?: number;
  window_ms?: number;
}

export interface Conditions {
  bus_voltage?: ConditionProfile;
  retractable_gear?: ConditionProfile;
}

export interface Profile {
  metadata?: Metadata;
  buttons?: Buttons;
  knobs?: Knobs;
  leds?: Leds;
  data?: Data;
  trim_wheels?: TrimWheels;
  conditions?: Conditions;
}

export interface ProfilesStatus {
  profilesDir: string;
  userProfilesDir: string;
  profilesCount: number;
  needsSelection: boolean;
  loadError: string;
  parseErrors: number;
}

export interface ProfilesDataResponse {
  profiles: Profile[];
  files: string[];
  errors: string[];
  sources: string[];
  status: ProfilesStatus;
}
