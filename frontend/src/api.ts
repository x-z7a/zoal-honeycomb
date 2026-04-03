import type { Profile, ProfilesDataResponse } from './types';

// Profile management via SkyScript message passing

export async function getProfilesData(): Promise<ProfilesDataResponse> {
  return window.skyscript.postMessage('getProfilesData', {});
}

export async function saveProfileByIndex(
  index: number,
  profile: Profile
): Promise<ProfilesDataResponse> {
  return window.skyscript.postMessage('saveProfileByIndex', { index, profile });
}

export async function createProfileFromDefault(
  filename: string,
  name: string,
  description: string,
  selectors: string[]
): Promise<{ createdPath: string; data: ProfilesDataResponse }> {
  return window.skyscript.postMessage('createProfileFromDefault', {
    filename,
    name,
    description,
    selectors,
  });
}

// X-Plane data via direct SkyScript XPLM bridge

export async function getXplaneInfo(): Promise<{ icao: string; name: string }> {
  try {
    const [icao, uiName] = await Promise.all([
      window.skyscript.xplm.getDataref('sim/aircraft/view/acf_ICAO'),
      window.skyscript.xplm.getDataref('sim/aircraft/view/acf_ui_name'),
    ]);
    return {
      icao: truncateAtNul(String(icao)),
      name: truncateAtNul(String(uiName)),
    };
  } catch {
    return { icao: '', name: '' };
  }
}

export async function getXplaneDataref(
  ref: string
): Promise<number | string | number[]> {
  return window.skyscript.xplm.getDataref(ref);
}

function truncateAtNul(value: string): string {
  const nulIndex = value.indexOf('\0');
  return nulIndex >= 0 ? value.slice(0, nulIndex) : value;
}
