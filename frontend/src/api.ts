// Calls into the zoal-honeycomb plugin through SkyScript.
//
// Each function sends skyscript.postMessage(<method>, [args...]); the plugin
// answers it in pkg/xplane/configui.go under the same method name. Types come
// from ./models, generated from the Go structs by cmd/gen-ts-models.
import type { pkg, profilestore } from "./models";

interface SkyScriptBridge {
  postMessage(channel: string, payload: unknown): Promise<any>;
  onMessage(channel: string, callback: (payload: any) => void): void;
}

let bridgePromise: Promise<SkyScriptBridge> | null = null;

// SkyScript injects window.skyscript into the page; wait briefly in case the
// first call races the injection.
function bridge(): Promise<SkyScriptBridge> {
  if (!bridgePromise) {
    bridgePromise = new Promise((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        const s = (window as any).skyscript as SkyScriptBridge | undefined;
        if (s && typeof s.postMessage === "function") {
          resolve(s);
        } else if (Date.now() - started > 5000) {
          bridgePromise = null;
          reject(new Error("SkyScript bridge not available"));
        } else {
          setTimeout(poll, 25);
        }
      };
      poll();
    });
  }
  return bridgePromise;
}

async function call<T>(method: string, ...args: unknown[]): Promise<T> {
  const s = await bridge();
  return s.postMessage(method, args) as Promise<T>;
}

/** Listen for messages the plugin pushes with App.PostMessage. */
export function onPluginMessage(channel: string, callback: (payload: any) => void): void {
  bridge().then((s) => s.onMessage(channel, callback)).catch(() => {});
}

export const GetProfilesStatus = () => call<profilestore.Status>("GetProfilesStatus");
export const GetProfiles = () => call<pkg.Profile[]>("GetProfiles");
export const GetProfileFiles = () => call<string[]>("GetProfileFiles");
export const GetProfileErrors = () => call<string[]>("GetProfileErrors");
export const GetProfileSources = () => call<string[]>("GetProfileSources");

/** The profile the plugin has loaded for the current aircraft. */
export const GetActiveProfile = () => call<profilestore.ActiveProfile>("GetActiveProfile");

export const SaveProfileByIndex = (index: number, profile: pkg.Profile) =>
  call<void>("SaveProfileByIndex", index, profile);
export const CreateProfileFromDefault = (filename: string, profileName: string, description: string, selectors: string[]) =>
  call<string>("CreateProfileFromDefault", filename, profileName, description, selectors);

/** Reread the profile folders and reload the profile the plugin is using. */
export const ReloadProfiles = () => call<void>("ReloadProfiles");
/** Delete user profiles by file path; the plugin refuses shipped profiles. Returns how many were deleted. */
export const DeleteUserProfiles = (files: string[]) => call<number>("DeleteUserProfiles", files);

/** [acf_ICAO, acf_ui_name], each in the X-Plane web API's {"data": ...} form. */
export const GetXplane = () => call<string[]>("GetXplane");
export const GetXplaneDataref = (dataref: string) => call<string>("GetXplaneDataref", dataref);
