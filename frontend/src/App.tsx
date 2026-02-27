import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import {
  CreateProfileFromDefault,
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
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { main, pkg } from "../wailsjs/go/models";
import Profiles from "./components/profiles";
import Metadata from "./components/metadata";
import LightConfiguration from './components/lightConfiguration';
import Xplane from "./components/xplane";
import KnobConfiguration from "./components/knobConfiguration";
import ButtonConfiguration from "./components/buttonConfiguration";
import DataConfiguration from "./components/dataConfiguration";

const EDITOR_TABS = [
  "Autopilot Buttons",
  "Autopilot Lights",
  "Annunciators Top",
  "Annunciators Bottom",
  "Auto Pilot Knobs",
  "AP Rotary Steps",
  "Bus Voltage",
  "Landing Gear"
];

const ADD_PROFILE_STEPS = ["Template", "File Name", "Metadata", "Selectors", "Create"];

interface PlaneInfo {
  icao: string;
  name: string;
  connected: boolean;
}

function cloneProfile(profile: pkg.Profile): pkg.Profile {
  return JSON.parse(JSON.stringify(profile));
}

function sanitizeProfileForApi(profile: pkg.Profile): pkg.Profile {
  return pkg.Profile.createFrom(JSON.parse(JSON.stringify(profile)));
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

function normalizeFilenameInput(raw: string): string {
  let value = raw.trim();
  if (value.toLowerCase().endsWith(".yaml")) {
    value = value.slice(0, -5);
  }
  return value.trim();
}

function parseSelectorsInput(raw: string): string[] {
  const parts = raw.split(/\r?\n|,/g);
  const seen = new Set<string>();
  const selectors: string[] = [];
  parts.forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    selectors.push(trimmed);
  });
  return selectors;
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
  const [isAddProfileModalOpen, setIsAddProfileModalOpen] = useState(false);
  const [addProfileStep, setAddProfileStep] = useState(0);
  const [newProfileFilename, setNewProfileFilename] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileDescription, setNewProfileDescription] = useState("");
  const [newProfileSelectorsInput, setNewProfileSelectorsInput] = useState("");
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [createProfileError, setCreateProfileError] = useState("");

  const refreshProfiles = useCallback(async () => {
    const [status, profiles, files] = await Promise.all([
      GetProfilesStatus(),
      GetProfiles(),
      GetProfileFiles()
    ]);
    const normalizedProfiles = profiles.map((profile) => sanitizeProfileForApi(profile));
    setProfilesStatus(status);
    setProfilesData(normalizedProfiles);
    setProfileFiles(files);
    return { status, profiles: normalizedProfiles, files };
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
  const normalizedNewProfileFilename = normalizeFilenameInput(newProfileFilename);
  const newProfileFinalFilename = normalizedNewProfileFilename === "" ? "new-profile.yaml" : `${normalizedNewProfileFilename}.yaml`;
  const newProfileSelectors = useMemo(
    () => parseSelectorsInput(newProfileSelectorsInput),
    [newProfileSelectorsInput]
  );
  const canProceedAddProfileStep = useMemo(() => {
    if (addProfileStep === 0) {
      return true;
    }
    if (addProfileStep === 1) {
      return normalizedNewProfileFilename.length > 0;
    }
    if (addProfileStep === 2) {
      return newProfileName.trim().length > 0;
    }
    if (addProfileStep === 3) {
      return newProfileSelectors.length > 0;
    }
    return true;
  }, [addProfileStep, normalizedNewProfileFilename, newProfileName, newProfileSelectors.length]);

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

  const handleOpenAddProfileTutorial = () => {
    const defaultFilename = planeInfo.icao.trim();
    const defaultName = planeInfo.name.trim();
    setNewProfileFilename(defaultFilename);
    setNewProfileName(defaultName);
    setNewProfileDescription(defaultName ? `Profile for ${defaultName}` : "");
    setNewProfileSelectorsInput(defaultName);
    setCreateProfileError("");
    setAddProfileStep(0);
    setIsAddProfileModalOpen(true);
  };

  const handleCloseAddProfileTutorial = () => {
    if (isCreatingProfile) {
      return;
    }
    setIsAddProfileModalOpen(false);
    setAddProfileStep(0);
    setCreateProfileError("");
  };

  const handleNextAddProfileStep = () => {
    if (!canProceedAddProfileStep || addProfileStep >= ADD_PROFILE_STEPS.length - 1) {
      return;
    }
    setAddProfileStep((current) => current + 1);
  };

  const handleBackAddProfileStep = () => {
    if (addProfileStep <= 0) {
      return;
    }
    setAddProfileStep((current) => current - 1);
  };

  const handleCreateProfileFromTemplate = async () => {
    if (!canProceedAddProfileStep || addProfileStep !== ADD_PROFILE_STEPS.length - 1) {
      return;
    }

    setIsCreatingProfile(true);
    setCreateProfileError("");
    try {
      const createdPath = await CreateProfileFromDefault(
        newProfileFinalFilename,
        newProfileName.trim(),
        newProfileDescription.trim(),
        newProfileSelectors
      );

      const refreshed = await refreshProfiles();
      const normalizedCreatedPath = createdPath.replace(/\\/g, "/");
      const createdBasename = basenameWithoutExt(normalizedCreatedPath);
      const createdIndexByPath = refreshed.files.findIndex((file) => file.replace(/\\/g, "/") === normalizedCreatedPath);
      const createdIndex = createdIndexByPath >= 0
        ? createdIndexByPath
        : refreshed.files.findIndex((file) => basenameWithoutExt(file) === createdBasename);

      if (createdIndex >= 0) {
        setHasUserSelectedProfile(true);
        setSelectedProfileIndex(createdIndex);
      }

      setSaveMessage(`Created profile ${newProfileFinalFilename}.`);
      setSaveError("");
      setIsAddProfileModalOpen(false);
      setAddProfileStep(0);
    } catch (error: any) {
      setCreateProfileError(error?.message || "Failed to create profile from default.yaml.");
    } finally {
      setIsCreatingProfile(false);
    }
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

    const profileToSave = sanitizeProfileForApi(editableProfile);

    setIsSaving(true);
    setSaveMessage("");
    setSaveError("");
    try {
      await SaveProfileByIndex(selectedProfileIndex, profileToSave);
      setProfilesData((previous) =>
        previous.map((profile, index) => (index === selectedProfileIndex ? cloneProfile(profileToSave) : profile))
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

      <Dialog
        open={isAddProfileModalOpen}
        onClose={handleCloseAddProfileTutorial}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Create New Profile</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{pt: 1}}>
            <Stepper activeStep={addProfileStep} alternativeLabel>
              {ADD_PROFILE_STEPS.map((step) => (
                <Step key={step}>
                  <StepLabel>{step}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {addProfileStep === 0 && (
              <Stack spacing={1.2}>
                <Alert severity="info">
                  This wizard creates a new profile by copying <code>default.yaml</code> and then updating metadata.
                </Alert>
                <Typography variant="body2">
                  Template source: <code>{`${profilesStatus?.profilesDir || "--"}/default.yaml`}</code>
                </Typography>
                <Typography variant="body2">
                  You can fine-tune all tabs after creation, then click <strong>Save YAML</strong>.
                </Typography>
              </Stack>
            )}

            {addProfileStep === 1 && (
              <Stack spacing={1.2}>
                <TextField
                  label="Profile file name"
                  value={newProfileFilename}
                  onChange={(event) => setNewProfileFilename(event.target.value)}
                  placeholder="A320 or A320.yaml"
                  fullWidth
                  autoFocus
                />
                <Typography variant="caption">
                  Final file: <code>{newProfileFinalFilename}</code>
                </Typography>
              </Stack>
            )}

            {addProfileStep === 2 && (
              <Stack spacing={1.2}>
                <TextField
                  label="Profile display name"
                  value={newProfileName}
                  onChange={(event) => setNewProfileName(event.target.value)}
                  placeholder="Toliss A320"
                  fullWidth
                  autoFocus
                />
                <TextField
                  label="Description"
                  value={newProfileDescription}
                  onChange={(event) => setNewProfileDescription(event.target.value)}
                  placeholder="Profile for Toliss A320"
                  fullWidth
                />
              </Stack>
            )}

            {addProfileStep === 3 && (
              <Stack spacing={1.2}>
                <TextField
                  label="Selectors (one per line or comma-separated)"
                  value={newProfileSelectorsInput}
                  onChange={(event) => setNewProfileSelectorsInput(event.target.value)}
                  placeholder={"ToLiss Airbus A320 Neo\nToLiss Airbus A320 Std"}
                  multiline
                  minRows={4}
                  fullWidth
                  autoFocus
                />
                <Typography variant="caption">
                  Matching uses exact aircraft UI names from X-Plane.
                </Typography>
                {newProfileSelectors.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{flexWrap: "wrap", rowGap: 1}}>
                    {newProfileSelectors.map((selector) => (
                      <Chip key={selector} label={selector} size="small" />
                    ))}
                  </Stack>
                )}
              </Stack>
            )}

            {addProfileStep === 4 && (
              <Stack spacing={1.2}>
                <Typography variant="body2">
                  New file: <code>{newProfileFinalFilename}</code>
                </Typography>
                <Typography variant="body2">
                  Name: <strong>{newProfileName.trim() || "--"}</strong>
                </Typography>
                <Typography variant="body2">
                  Description: {newProfileDescription.trim() || "--"}
                </Typography>
                <Typography variant="body2">Selectors:</Typography>
                <Stack direction="row" spacing={1} sx={{flexWrap: "wrap", rowGap: 1}}>
                  {newProfileSelectors.map((selector) => (
                    <Chip key={selector} label={selector} size="small" />
                  ))}
                </Stack>
              </Stack>
            )}

            {createProfileError && <Alert severity="error">{createProfileError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{px: 3, pb: 2}}>
          <Button onClick={handleCloseAddProfileTutorial} disabled={isCreatingProfile}>
            Cancel
          </Button>
          <Button onClick={handleBackAddProfileStep} disabled={addProfileStep === 0 || isCreatingProfile}>
            Back
          </Button>
          {addProfileStep < ADD_PROFILE_STEPS.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleNextAddProfileStep}
              disabled={!canProceedAddProfileStep || isCreatingProfile}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleCreateProfileFromTemplate}
              disabled={!canProceedAddProfileStep || isCreatingProfile}
            >
              {isCreatingProfile ? "Creating..." : "Create Profile"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Box className="appBackdrop" />
      <Box className="appLayout">
        <Box className="sidebarPane">
          <Profiles
            profiles={profilesData}
            selectedProfileIndex={selectedProfileIndex}
            onSelectProfile={handleProfileSelect}
            onOpenAddProfile={handleOpenAddProfileTutorial}
            addProfileDisabled={showProfilesModal || isCreatingProfile}
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
                  <DataConfiguration
                    editable
                    collapsible={false}
                    title={"AP Rotary Step Controls"}
                    data={editableProfile?.data}
                    onDataChange={(next) => updateProfileField("data", next)}
                    keys={["ap_alt_step", "ap_vs_step", "ap_ias_step"]}
                  />
                )}
                {editorTab === 6 && (
                  <LightConfiguration
                    editable
                    collapsible={false}
                    title={"Bus Voltage Condition"}
                    sectionData={editableProfile?.conditions}
                    onSectionDataChange={(next) => updateProfileField("conditions", next)}
                    keys={["bus_voltage"]}
                  />
                )}
                {editorTab === 7 && (
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
