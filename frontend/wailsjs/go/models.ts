export namespace main {
	
	export class ProfilesStatus {
	    profilesDir: string;
	    profilesCount: number;
	    needsSelection: boolean;
	    loadError: string;
	
	    static createFrom(source: any = {}) {
	        return new ProfilesStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profilesDir = source["profilesDir"];
	        this.profilesCount = source["profilesCount"];
	        this.needsSelection = source["needsSelection"];
	        this.loadError = source["loadError"];
	    }
	}

}

export namespace pkg {
	
	export class Command {
	    command_str?: string;
	    Command: any;
	
	    static createFrom(source: any = {}) {
	        return new Command(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.command_str = source["command_str"];
	        this.Command = source["Command"];
	    }
	}
	export class ButtonProfile {
	    single_click?: Command[];
	    double_click?: Command[];
	
	    static createFrom(source: any = {}) {
	        return new ButtonProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.single_click = this.convertValues(source["single_click"], Command);
	        this.double_click = this.convertValues(source["double_click"], Command);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Buttons {
	    hdg?: ButtonProfile;
	    nav?: ButtonProfile;
	    alt?: ButtonProfile;
	    apr?: ButtonProfile;
	    vs?: ButtonProfile;
	    ap?: ButtonProfile;
	    ias?: ButtonProfile;
	    rev?: ButtonProfile;
	
	    static createFrom(source: any = {}) {
	        return new Buttons(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hdg = this.convertValues(source["hdg"], ButtonProfile);
	        this.nav = this.convertValues(source["nav"], ButtonProfile);
	        this.alt = this.convertValues(source["alt"], ButtonProfile);
	        this.apr = this.convertValues(source["apr"], ButtonProfile);
	        this.vs = this.convertValues(source["vs"], ButtonProfile);
	        this.ap = this.convertValues(source["ap"], ButtonProfile);
	        this.ias = this.convertValues(source["ias"], ButtonProfile);
	        this.rev = this.convertValues(source["rev"], ButtonProfile);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class DatarefCondition {
	    dataref_str?: string;
	    Dataref: any;
	    index?: number;
	    operator?: string;
	    threshold?: number;
	    Expr?: vm.Program;
	    Env: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new DatarefCondition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dataref_str = source["dataref_str"];
	        this.Dataref = source["Dataref"];
	        this.index = source["index"];
	        this.operator = source["operator"];
	        this.threshold = source["threshold"];
	        this.Expr = this.convertValues(source["Expr"], vm.Program);
	        this.Env = source["Env"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ConditionProfile {
	    datarefs?: DatarefCondition[];
	    condition?: string;
	
	    static createFrom(source: any = {}) {
	        return new ConditionProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.datarefs = this.convertValues(source["datarefs"], DatarefCondition);
	        this.condition = source["condition"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Conditions {
	    bus_voltage?: ConditionProfile;
	    retractable_gear?: ConditionProfile;
	
	    static createFrom(source: any = {}) {
	        return new Conditions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bus_voltage = this.convertValues(source["bus_voltage"], ConditionProfile);
	        this.retractable_gear = this.convertValues(source["retractable_gear"], ConditionProfile);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Dataref {
	    dataref_str?: string;
	    Dataref: any;
	    index?: number;
	
	    static createFrom(source: any = {}) {
	        return new Dataref(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dataref_str = source["dataref_str"];
	        this.Dataref = source["Dataref"];
	        this.index = source["index"];
	    }
	}
	export class DataProfile {
	    datarefs?: Dataref[];
	    value?: number;
	
	    static createFrom(source: any = {}) {
	        return new DataProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.datarefs = this.convertValues(source["datarefs"], Dataref);
	        this.value = source["value"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Data {
	    ap_alt_step?: DataProfile;
	    ap_vs_step?: DataProfile;
	    ap_ias_step?: DataProfile;
	
	    static createFrom(source: any = {}) {
	        return new Data(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ap_alt_step = this.convertValues(source["ap_alt_step"], DataProfile);
	        this.ap_vs_step = this.convertValues(source["ap_vs_step"], DataProfile);
	        this.ap_ias_step = this.convertValues(source["ap_ias_step"], DataProfile);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class KnobProfile {
	    datarefs?: Dataref[];
	    commands?: Command[];
	
	    static createFrom(source: any = {}) {
	        return new KnobProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.datarefs = this.convertValues(source["datarefs"], Dataref);
	        this.commands = this.convertValues(source["commands"], Command);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Knobs {
	    ap_hdg?: KnobProfile;
	    ap_vs?: KnobProfile;
	    ap_alt?: KnobProfile;
	    ap_ias?: KnobProfile;
	    ap_crs?: KnobProfile;
	
	    static createFrom(source: any = {}) {
	        return new Knobs(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ap_hdg = this.convertValues(source["ap_hdg"], KnobProfile);
	        this.ap_vs = this.convertValues(source["ap_vs"], KnobProfile);
	        this.ap_alt = this.convertValues(source["ap_alt"], KnobProfile);
	        this.ap_ias = this.convertValues(source["ap_ias"], KnobProfile);
	        this.ap_crs = this.convertValues(source["ap_crs"], KnobProfile);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LEDProfile {
	    datarefs?: DatarefCondition[];
	    condition?: string;
	
	    static createFrom(source: any = {}) {
	        return new LEDProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.datarefs = this.convertValues(source["datarefs"], DatarefCondition);
	        this.condition = source["condition"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Leds {
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
	
	    static createFrom(source: any = {}) {
	        return new Leds(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hdg = this.convertValues(source["hdg"], LEDProfile);
	        this.nav = this.convertValues(source["nav"], LEDProfile);
	        this.alt = this.convertValues(source["alt"], LEDProfile);
	        this.apr = this.convertValues(source["apr"], LEDProfile);
	        this.vs = this.convertValues(source["vs"], LEDProfile);
	        this.ap = this.convertValues(source["ap"], LEDProfile);
	        this.ias = this.convertValues(source["ias"], LEDProfile);
	        this.rev = this.convertValues(source["rev"], LEDProfile);
	        this.gear = this.convertValues(source["gear"], LEDProfile);
	        this.master_warn = this.convertValues(source["master_warn"], LEDProfile);
	        this.master_caution = this.convertValues(source["master_caution"], LEDProfile);
	        this.fire = this.convertValues(source["fire"], LEDProfile);
	        this.oil_low_pressure = this.convertValues(source["oil_low_pressure"], LEDProfile);
	        this.fuel_low_pressure = this.convertValues(source["fuel_low_pressure"], LEDProfile);
	        this.anti_ice = this.convertValues(source["anti_ice"], LEDProfile);
	        this.eng_starter = this.convertValues(source["eng_starter"], LEDProfile);
	        this.apu = this.convertValues(source["apu"], LEDProfile);
	        this.vacuum = this.convertValues(source["vacuum"], LEDProfile);
	        this.hydro_low_pressure = this.convertValues(source["hydro_low_pressure"], LEDProfile);
	        this.aux_fuel_pump = this.convertValues(source["aux_fuel_pump"], LEDProfile);
	        this.parking_brake = this.convertValues(source["parking_brake"], LEDProfile);
	        this.volt_low = this.convertValues(source["volt_low"], LEDProfile);
	        this.doors = this.convertValues(source["doors"], LEDProfile);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Metadata {
	    name?: string;
	    description?: string;
	    selectors?: string[];
	
	    static createFrom(source: any = {}) {
	        return new Metadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.selectors = source["selectors"];
	    }
	}
	export class Profile {
	    metadata?: Metadata;
	    buttons?: Buttons;
	    knobs?: Knobs;
	    leds?: Leds;
	    data?: Data;
	    conditions?: Conditions;
	
	    static createFrom(source: any = {}) {
	        return new Profile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.metadata = this.convertValues(source["metadata"], Metadata);
	        this.buttons = this.convertValues(source["buttons"], Buttons);
	        this.knobs = this.convertValues(source["knobs"], Knobs);
	        this.leds = this.convertValues(source["leds"], Leds);
	        this.data = this.convertValues(source["data"], Data);
	        this.conditions = this.convertValues(source["conditions"], Conditions);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace vm {
	
	export class Program {
	    Bytecode: number[];
	    Arguments: number[];
	    Constants: any[];
	
	    static createFrom(source: any = {}) {
	        return new Program(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Bytecode = source["Bytecode"];
	        this.Arguments = source["Arguments"];
	        this.Constants = source["Constants"];
	    }
	}

}

