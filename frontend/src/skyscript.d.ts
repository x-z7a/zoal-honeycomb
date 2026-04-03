interface SkyscriptXplm {
  getDataref(ref: string): Promise<number | string | number[]>;
  setDataref(ref: string, value: number | string, valueType?: string): Promise<void>;
  executeCommand(command: string): Promise<void>;
}

interface SkyscriptFs {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listDir(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
}

interface Skyscript {
  version: string;
  xplaneVersion: string;
  xplm: SkyscriptXplm;
  postMessage(channel: string, payload: any): Promise<any>;
  onMessage(channel: string, callback: (payload: any) => void): void;
  fs: SkyscriptFs;
}

interface Window {
  skyscript: Skyscript;
}
