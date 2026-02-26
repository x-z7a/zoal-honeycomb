import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import {
  GetProfileFiles,
  GetProfiles,
  GetProfilesStatus,
  GetXplane,
  SaveProfileByIndex
} from "../wailsjs/go/main/App";
import { Quit } from "../wailsjs/runtime/runtime";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  Stack,
  Typography
} from "@mui/material";
import { main, pkg } from "../wailsjs/go/models";
import Profiles from "./components/profiles";
import Metadata from "./components/metadata";
import LightConfiguration from './components/lightConfiguration';
import Xplane from "./components/xplane";
import KnobConfiguration from "./components/knobConfiguration";
import ButtonConfiguration from "./components/buttonConfiguration";

const EDITOR_TABS = [
  "Autopilot Buttons",
  "Autopilot Lights",
  "Annunciators Top",
  "Annunciators Bottom",
  "Auto Pilot Knobs",
  "Landing Gear"
];

interface PlaneInfo {
  icao: string;
  name: string;
  connected: boolean;
}

function cloneProfile(profile: pkg.Profile): pkg.Profile {
  return JSON.parse(JSON.stringify(profile));
}

function decodeDatarefText(raw: string | undefined): string {
  if (!raw) {
    return "";
  }
  try {
    const parsed = JSON.parse(raw) as { data?: string };
    if (!parsed?.data) {
      return "";
    }
    return atob(parsed.data);
  } catch {
    return "";
  }
}

function basenameWithoutExt(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const basename = normalized.split("/").pop() || "";
  return basename.endsWith(".yaml") ? basename.slice(0, -5) : basename;
}

function findBestProfileIndex(plane: PlaneInfo, profiles: pkg.Profile[], profileFiles: string[]): number {
  if (!plane.connected || profiles.length === 0 || profileFiles.length !== profiles.length) {
    return -1;
  }

  const icao = plane.icao;
  const aircraftName = plane.name;
  const basenames = profileFiles.map(basenameWithoutExt);

  let selected = -1;
  const defaultIndex = basenames.findIndex((name) => name.toLowerCase() === "default");

  const exactIcaoIndex = basenames.findIndex((name) => name === icao);
  if (exactIcaoIndex >= 0) {
    selected = exactIcaoIndex;
  } else if (defaultIndex >= 0) {
    selected = defaultIndex;
  }

  if (icao !== "" && aircraftName !== "") {
    basenames.forEach((name, index) => {
      if (!name.startsWith(icao)) {
        return;
      }
      const selectors = profiles[index]?.metadata?.selectors || [];
      if (selectors.some((selector) => selector === aircraftName)) {
        selected = index;
      }
    });
  }

  return selected;
}

function App() {
  const [profilesData, setProfilesData] = useState([] as pkg.Profile[]);
  const [profileFiles, setProfileFiles] = useState([] as string[]);
  const [selectedProfileIndex, setSelectedProfileIndex] = useState(-1);
  const [editableProfile, setEditableProfile] = useState<pkg.Profile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [hasUserSelectedProfile, setHasUserSelectedProfile] = useState(false);
  const [planeInfo, setPlaneInfo] = useState<PlaneInfo>({ icao: "", name: "", connected: false });
  const [profilesStatus, setProfilesStatus] = useState<main.ProfilesStatus | null>(null);
  const [editorTab, setEditorTab] = useState(0);

  const refreshProfiles = useCallback(async () => {
    const [status, profiles, files] = await Promise.all([
      GetProfilesStatus(),
      GetProfiles(),
      GetProfileFiles()
    ]);
    setProfilesStatus(status);
    setProfilesData(profiles);
    setProfileFiles(files);
  }, []);

  useEffect(() => {
    refreshProfiles().catch((error: any) => {
      setProfilesStatus({
        profilesDir: "",
        profilesCount: 0,
        needsSelection: true,
        loadError: error?.message || "Failed to load profile status."
      } as main.ProfilesStatus);
      setProfilesData([]);
      setProfileFiles([]);
    });
  }, [refreshProfiles]);

  useEffect(() => {
    if (profilesData.length > 0 && !profilesStatus?.needsSelection) {
      return;
    }
    const interval = setInterval(() => {
      refreshProfiles().catch(() => {
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [profilesData.length, profilesStatus?.needsSelection, refreshProfiles]);

  useEffect(() => {
    const refresh = () => {
      GetXplane()
        .then((res) => {
          const values = res || [];
          const icao = decodeDatarefText(values[0]);
          const name = decodeDatarefText(values[1]);
          setPlaneInfo({
            icao,
            name,
            connected: icao !== "" || name !== "",
          });
        })
        .catch(() => {
          setPlaneInfo({ icao: "", name: "", connected: false });
        });
    };

    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  const selectedProfile = selectedProfileIndex >= 0 ? profilesData[selectedProfileIndex] : null;
  const selectedProfilePath = selectedProfileIndex >= 0 ? profileFiles[selectedProfileIndex] || "" : "";
  const needsProfilesSelection = profilesStatus?.needsSelection || false;
  const profilesLoadError = profilesStatus?.loadError || "";
  const showProfilesModal = needsProfilesSelection || !!profilesLoadError;

  const isDirty = useMemo(() => {
    if (!editableProfile || !selectedProfile) {
      return false;
    }
    return JSON.stringify(editableProfile) !== JSON.stringify(selectedProfile);
  }, [editableProfile, selectedProfile]);

  useEffect(() => {
    if (profilesData.length === 0) {
      setEditableProfile(null);
      setSelectedProfileIndex(-1);
      return;
    }

    if (selectedProfileIndex < 0 || selectedProfileIndex >= profilesData.length) {
      return;
    }

    setEditableProfile(cloneProfile(profilesData[selectedProfileIndex]));
    setSaveMessage("");
    setSaveError("");
  }, [profilesData, selectedProfileIndex]);

  useEffect(() => {
    if (profilesData.length === 0) {
      return;
    }

    if (!hasUserSelectedProfile && !isDirty) {
      if (planeInfo.connected) {
        const planeIndex = findBestProfileIndex(planeInfo, profilesData, profileFiles);
        if (planeIndex >= 0 && planeIndex !== selectedProfileIndex) {
          setSelectedProfileIndex(planeIndex);
          return;
        }
      } else if (selectedProfileIndex < 0) {
        setSelectedProfileIndex(0);
        return;
      }
    }

    if (selectedProfileIndex < 0) {
      setSelectedProfileIndex(0);
    }
  }, [profilesData, profileFiles, planeInfo, hasUserSelectedProfile, isDirty, selectedProfileIndex]);

  const handleExitApp = () => {
    Quit();
  };

  const handleProfileSelect = (index: number) => {
    setHasUserSelectedProfile(true);
    setSelectedProfileIndex(index);
  };

  const updateProfileField = (field: keyof pkg.Profile, value: any) => {
    setEditableProfile((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        [field]: value
      } as pkg.Profile;
    });
  };

  const handleRevert = () => {
    if (!selectedProfile) {
      return;
    }
    setEditableProfile(cloneProfile(selectedProfile));
    setSaveMessage("Reverted unsaved changes.");
    setSaveError("");
  };

  const handleSave = async () => {
    if (selectedProfileIndex < 0 || !editableProfile) {
      return;
    }

    setIsSaving(true);
    setSaveMessage("");
    setSaveError("");
    try {
      await SaveProfileByIndex(selectedProfileIndex, editableProfile);
      setProfilesData((previous) =>
        previous.map((profile, index) => (index === selectedProfileIndex ? cloneProfile(editableProfile) : profile))
      );
      setSaveMessage("Profile saved to YAML.");
    } catch (error: any) {
      setSaveError(error?.message || "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="app">
      <Dialog open={showProfilesModal} disableEscapeKeyDown fullWidth maxWidth="sm">
        <DialogTitle>Return App To Plugin Folder</DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ pt: 0.5 }}>
            <Typography variant="body2">
              Put <code>bravo.app</code> back into your <code>zoal-honeycomb</code> plugin folder so it is next to
              <code> profiles/</code>, then relaunch.
            </Typography>
            <Typography variant="body2">
              Expected location example: <code>.../X-Plane 12/Resources/plugins/zoal-honeycomb</code>.
            </Typography>
            {profilesStatus?.profilesDir && (
              <Typography variant="caption">Current folder: {profilesStatus.profilesDir}</Typography>
            )}
            {profilesLoadError && (
              <Alert severity="error">Load error: {profilesLoadError}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            color="error"
            onClick={handleExitApp}
          >
            Exit App
          </Button>
        </DialogActions>
      </Dialog>

      <Box className="appBackdrop" />
      <Box className="appLayout">
        <Box className="sidebarPane">
          <Profiles
            profiles={profilesData}
            selectedProfileIndex={selectedProfileIndex}
            onSelectProfile={handleProfileSelect}
          />
          <Box className="xplanePane">
            <Xplane />
          </Box>
        </Box>

        <Box className="editorPane">
          <Stack spacing={2.25} className="editorStack">
            <Box
              sx={{
                px: 2,
                py: 1.2,
                borderRadius: 2,
                border: "1px solid rgba(129, 158, 184, 0.25)",
                backgroundColor: "rgba(5, 17, 30, 0.5)"
              }}
            >
              <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    disabled={showProfilesModal || !isDirty || isSaving || selectedProfileIndex < 0}
                    onClick={handleSave}
                  >
                    Save YAML
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={showProfilesModal || !isDirty || isSaving || selectedProfileIndex < 0}
                    onClick={handleRevert}
                  >
                    Revert
                  </Button>
                </Stack>
                <Typography variant="caption" sx={{ color: "rgba(196, 221, 245, 0.8)" }}>
                  {isDirty ? "Unsaved changes" : "No pending changes"}
                </Typography>
              </Stack>
              {isSaving && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <CircularProgress size={14} />
                  <Typography variant="caption">Saving profile...</Typography>
                </Stack>
              )}
              {saveMessage && <Alert severity="success" sx={{ mt: 1 }}>{saveMessage}</Alert>}
              {saveError && <Alert severity="error" sx={{ mt: 1 }}>{saveError}</Alert>}
            </Box>

            <Metadata metadata={editableProfile?.metadata} filePath={selectedProfilePath} />
            <Box
              sx={{
                borderRadius: 3,
                border: "1px solid rgba(120, 159, 192, 0.35)",
                background: "linear-gradient(150deg, rgba(10, 17, 28, 0.92), rgba(16, 24, 34, 0.9))",
                boxShadow: "0 14px 28px rgba(0,0,0,0.3)",
                overflow: "hidden",
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column"
              }}
            >
              <Tabs
                value={editorTab}
                onChange={(_, next) => setEditorTab(next)}
                variant="fullWidth"
                sx={{
                  px: 1.2,
                  minHeight: 46,
                  borderBottom: "1px solid rgba(139, 170, 197, 0.24)",
                  backgroundColor: "rgba(8, 18, 30, 0.8)",
                  "& .MuiTabs-indicator": {
                    backgroundColor: "rgba(135, 206, 250, 0.95)",
                    height: 3
                  },
                  "& .MuiTab-root": {
                    minHeight: 46,
                    py: 1,
                    textTransform: "none",
                    fontWeight: 700,
                    color: "rgba(194, 221, 244, 0.76)"
                  },
                  "& .MuiTab-root.Mui-selected": {
                    color: "rgba(230, 246, 255, 0.98)"
                  }
                }}
              >
                {EDITOR_TABS.map((label) => (
                  <Tab key={label} label={label} disableRipple />
                ))}
              </Tabs>
              <Box sx={{p: 1.3, flex: 1, minHeight: 0, display: "flex"}}>
                {editorTab === 0 && (
                  <ButtonConfiguration
                    editable
                    buttons={editableProfile?.buttons}
                    onButtonsChange={(next) => updateProfileField("buttons", next)}
                    keys={["hdg", "nav", "alt", "apr", "vs", "ap", "ias", "rev"]}
                  />
                )}
                {editorTab === 1 && (
                  <LightConfiguration
                    editable
                    collapsible={false}
                    sectionData={editableProfile?.leds}
                    onSectionDataChange={(next) => updateProfileField("leds", next)}
                    title={"Autopilot Lights"}
                    keys={["alt", "hdg", "apr", "rev", "nav", "vs", "ap", "ias"]}
                  />
                )}
                {editorTab === 2 && (
                  <LightConfiguration
                    editable
                    collapsible={false}
                    title={"Annunciators Row (Top)"}
                    sectionData={editableProfile?.leds}
                    onSectionDataChange={(next) => updateProfileField("leds", next)}
                    keys={["master_warn", "fire", "oil_low_pressure", "fuel_low_pressure", "anti_ice", "eng_starter", "apu"]}
                  />
                )}
                {editorTab === 3 && (
                  <LightConfiguration
                    editable
                    collapsible={false}
                    title={"Annunciators Row (Bottom)"}
                    sectionData={editableProfile?.leds}
                    onSectionDataChange={(next) => updateProfileField("leds", next)}
                    keys={["master_caution", "vacuum", "hydro_low_pressure", "aux_fuel_pump", "parking_brake", "volt_low", "doors"]}
                  />
                )}
                {editorTab === 4 && (
                  <KnobConfiguration
                    editable
                    collapsible={false}
                    title={"Auto Pilot Knobs"}
                    knobs={editableProfile?.knobs}
                    onKnobsChange={(next) => updateProfileField("knobs", next)}
                    keys={["ap_alt", "ap_hdg", "ap_vs", "ap_crs", "ap_ias"]}
                  />
                )}
                {editorTab === 5 && (
                  <LightConfiguration
                    editable
                    collapsible={false}
                    title={"Landing Gear Configuration"}
                    sectionData={editableProfile?.leds}
                    onSectionDataChange={(next) => updateProfileField("leds", next)}
                    keys={["gear"]}
                  />
                )}
              </Box>
            </Box>
          </Stack>
        </Box>
      </Box>
    </div>
  );
}

export default App
