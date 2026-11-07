import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import {
  CreateProfileFromDefault,
  DeleteUserProfiles,
  GetProfileErrors,
  GetProfileFiles,
  GetProfileSources,
  GetProfiles,
  GetActiveProfile,
  GetProfilesStatus,
  GetXplane,
  onPluginMessage,
  ReloadProfiles,
  SaveProfileByIndex
} from "./api";
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
import { pkg, profilestore } from "./models";
import Profiles from "./components/profiles";
import Metadata from "./components/metadata";
import LightConfiguration from './components/lightConfiguration';
import Xplane from "./components/xplane";
import KnobConfiguration from "./components/knobConfiguration";
import ButtonConfiguration from "./components/buttonConfiguration";
import DataConfiguration from "./components/dataConfiguration";
import TrimWheelConfiguration from "./components/trimWheelConfiguration";
import { decodeDatarefText } from "./utils/datarefs";

const EDITOR_TABS = [
  "Autopilot Buttons",
  "Autopilot Lights",
  "Annunciators Top",
  "Annunciators Bottom",
  "Auto Pilot Knobs",
  "AP Rotary Steps",
  "Trim Wheels",
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
  return JSON.parse(JSON.stringify(profile)) as pkg.Profile;
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  if (error && typeof error === "object") {
    const errorWithMessage = error as { message?: unknown; error?: unknown };
    if (typeof errorWithMessage.message === "string" && errorWithMessage.message.trim() !== "") {
      return errorWithMessage.message;
    }
    if (typeof errorWithMessage.error === "string" && errorWithMessage.error.trim() !== "") {
      return errorWithMessage.error;
    }
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
    }
  }
  return fallback;
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
  const [profileErrors, setProfileErrors] = useState([] as string[]);
  const [profileSources, setProfileSources] = useState([] as string[]);
  const [selectedProfileIndex, setSelectedProfileIndex] = useState(-1);
  const [editableProfile, setEditableProfile] = useState<pkg.Profile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [hasUserSelectedProfile, setHasUserSelectedProfile] = useState(false);
  const [planeInfo, setPlaneInfo] = useState<PlaneInfo>({ icao: "", name: "", connected: false });
  // File of the profile the plugin is actually using; "" when none is loaded.
  const [activeProfileFile, setActiveProfileFile] = useState("");
  const [profilesStatus, setProfilesStatus] = useState<profilestore.Status | null>(null);
  const [editorTab, setEditorTab] = useState(0);
  const [isAddProfileModalOpen, setIsAddProfileModalOpen] = useState(false);
  const [addProfileStep, setAddProfileStep] = useState(0);
  const [newProfileFilename, setNewProfileFilename] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileDescription, setNewProfileDescription] = useState("");
  const [newProfileSelectorsInput, setNewProfileSelectorsInput] = useState("");
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  // Indices of user profiles waiting for delete confirmation, or null.
  const [deleteTargets, setDeleteTargets] = useState<number[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  // Bumped after a delete so the sidebar leaves selection mode.
  const [selectionEpoch, setSelectionEpoch] = useState(0);
  const [createProfileError, setCreateProfileError] = useState("");

  const refreshProfiles = useCallback(async () => {
    const [status, profiles, files, errors, sources] = await Promise.all([
      GetProfilesStatus(),
      GetProfiles(),
      GetProfileFiles(),
      GetProfileErrors(),
      GetProfileSources()
    ]);
    const normalizedProfiles = profiles.map((profile) => sanitizeProfileForApi(profile));
    setProfilesStatus(status);
    setProfilesData(normalizedProfiles);
    setProfileFiles(files);
    setProfileErrors(errors);
    setProfileSources(sources);
    return { status, profiles: normalizedProfiles, files, errors, sources };
  }, []);

  useEffect(() => {
    refreshProfiles().catch((error: any) => {
      setProfilesStatus({
        profilesDir: "",
        userProfilesDir: "",
        profilesCount: 0,
        parseErrors: 0,
        loadError: getErrorMessage(error, "Failed to load profile status.")
      } as profilestore.Status);
      setProfilesData([]);
      setProfileFiles([]);
      setProfileErrors([]);
      setProfileSources([]);
    });
  }, [refreshProfiles]);

  // Retry until the first load succeeds (the bridge can lag the first render).
  useEffect(() => {
    if (profilesData.length > 0) {
      return;
    }
    const interval = setInterval(() => {
      refreshProfiles().catch(() => {
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [profilesData.length, refreshProfiles]);

  // The plugin rereads the profile folders each time the window is opened.
  useEffect(() => {
    onPluginMessage("profilesChanged", () => {
      refreshProfiles().catch(() => {
      });
      GetActiveProfile().then((p) => setActiveProfileFile(p?.file || "")).catch(() => {
      });
    });
  }, [refreshProfiles]);

  // The plugin pushes the active profile whenever it (re)loads one: on
  // aircraft load and right after a save or create.
  useEffect(() => {
    GetActiveProfile().then((p) => setActiveProfileFile(p?.file || "")).catch(() => {
    });
    onPluginMessage("activeProfileChanged", (p: profilestore.ActiveProfile) => {
      setActiveProfileFile(p?.file || "");
    });
  }, []);

  const activeProfileIndex = useMemo(
    () => (activeProfileFile === "" ? -1 : profileFiles.indexOf(activeProfileFile)),
    [activeProfileFile, profileFiles]
  );

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
  const selectedProfileSource = selectedProfileIndex >= 0 ? (profileSources[selectedProfileIndex] || "default") : "default";
  const profilesLoadError = profilesStatus?.loadError || "";
  const selectedProfileError = selectedProfileIndex >= 0 ? (profileErrors[selectedProfileIndex] || "") : "";
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

    // Status messages are cleared when the user picks another profile
    // (handleProfileSelect), not here: this also runs after every list refresh,
    // which would wipe "Saved", "Deleted" and "Reloaded" as they appear.
    setEditableProfile(cloneProfile(profilesData[selectedProfileIndex]));
  }, [profilesData, selectedProfileIndex]);

  useEffect(() => {
    if (profilesData.length === 0) {
      return;
    }

    if (!hasUserSelectedProfile && !isDirty) {
      // Open on the profile the plugin is using, when it has one.
      if (activeProfileIndex >= 0) {
        if (activeProfileIndex !== selectedProfileIndex) {
          setSelectedProfileIndex(activeProfileIndex);
        }
        return;
      }
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
  }, [profilesData, profileFiles, planeInfo, hasUserSelectedProfile, isDirty, selectedProfileIndex, activeProfileIndex]);


  // Reload and delete replace the profile being edited, so they wait while
  // there are unsaved changes.
  const busyReason = isDirty
    ? "Save or revert your changes first"
    : (isSaving || isReloading || isDeleting || isCreatingProfile) ? "Working..." : "";

  // After the list reloads, indices shift: find a profile again by its file.
  const reselectByPath = (files: string[], path: string) => {
    const index = path ? files.indexOf(path) : -1;
    if (index >= 0) {
      setSelectedProfileIndex(index);
    } else {
      setHasUserSelectedProfile(false);
      setSelectedProfileIndex(-1);
    }
  };

  const handleReload = async () => {
    if (busyReason) {
      return;
    }
    const keepPath = selectedProfilePath;
    setIsReloading(true);
    setSaveError("");
    try {
      await ReloadProfiles();
      const refreshed = await refreshProfiles();
      reselectByPath(refreshed.files, keepPath);
      setSaveMessage("Profiles reloaded.");
    } catch (error: any) {
      setSaveError(getErrorMessage(error, "Failed to reload profiles."));
    } finally {
      setIsReloading(false);
    }
  };

  const handleRequestDelete = (indices: number[]) => {
    const userIndices = indices.filter((i) => profileSources[i] === "user");
    if (userIndices.length === 0 || busyReason) {
      return;
    }
    setDeleteError("");
    setDeleteTargets(userIndices);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargets) {
      return;
    }
    const files = deleteTargets.map((i) => profileFiles[i]).filter(Boolean);
    const keepPath = deleteTargets.includes(selectedProfileIndex) ? "" : selectedProfilePath;
    setIsDeleting(true);
    setDeleteError("");
    try {
      const deleted = await DeleteUserProfiles(files);
      const refreshed = await refreshProfiles();
      reselectByPath(refreshed.files, keepPath);
      setDeleteTargets(null);
      setSelectionEpoch((n) => n + 1);
      setSaveError("");
      setSaveMessage(`Deleted ${deleted} user profile${deleted === 1 ? "" : "s"}.`);
    } catch (error: any) {
      setDeleteError(getErrorMessage(error, "Failed to delete profiles."));
      refreshProfiles().catch(() => {
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const profileLabel = (index: number) => {
    const file = (profileFiles[index] || "").replace(/\\/g, "/").split("/").pop() || "";
    const name = profilesData[index]?.metadata?.name;
    return name ? `${name} (${file})` : file;
  };

  const handleProfileSelect = (index: number) => {
    setHasUserSelectedProfile(true);
    setSelectedProfileIndex(index);
    setSaveMessage("");
    setSaveError("");
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
      setCreateProfileError(getErrorMessage(error, "Failed to create profile from default.yaml."));
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

  const handleMetadataChange = (metadata: pkg.Metadata) => {
    setEditableProfile((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        metadata
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

      // Reload all profiles from backend to pick up updated paths and any new entries
      const refreshed = await refreshProfiles();
      // Re-select the saved profile — find the user copy by matching the profile name
      const savedName = profileToSave.metadata?.name || "";
      const userIdx = refreshed.files.findIndex((_, i) =>
        refreshed.sources[i] === "user" && refreshed.profiles[i]?.metadata?.name === savedName
      );
      if (userIdx >= 0 && userIdx !== selectedProfileIndex) {
        setHasUserSelectedProfile(true);
        setSelectedProfileIndex(userIdx);
      }

      setSaveMessage("Profile saved to user profiles.");
    } catch (error: any) {
      setSaveError(getErrorMessage(error, "Failed to save profile."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="app">
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
                  Preferred template path: <code>{`${profilesStatus?.profilesDir || "--"}/default.yaml`}</code>
                </Typography>
                <Typography variant="body2">
                  If that file is missing, the app falls back to the bundled default template.
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

      <Dialog open={deleteTargets !== null} onClose={() => !isDeleting && setDeleteTargets(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          Delete {deleteTargets?.length === 1 ? "user profile" : `${deleteTargets?.length || 0} user profiles`}?
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ pt: 0.5 }}>
            <Typography variant="body2">
              These files are removed from <code>user profiles/</code>. This cannot be undone.
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 220, overflowY: "auto" }}>
              {(deleteTargets || []).map((i) => (
                <li key={profileFiles[i] || i}>
                  <Typography variant="body2">{profileLabel(i)}</Typography>
                </li>
              ))}
            </Box>
            {deleteTargets?.includes(activeProfileIndex) && (
              <Alert severity="warning">
                The plugin is using {profileLabel(activeProfileIndex)} for this aircraft. After deleting it,
                the plugin switches to the next matching profile (the shipped copy, if there is one, or default).
              </Alert>
            )}
            {deleteError && <Alert severity="error">{deleteError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTargets(null)} disabled={isDeleting}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Box className="appBackdrop" />
      <Box className="appLayout">
        <Box className="sidebarPane">
          <Profiles
            profiles={profilesData}
            profileErrors={profileErrors}
            profileFiles={profileFiles}
            profileSources={profileSources}
            activeProfileIndex={activeProfileIndex}
            onReload={handleReload}
            onDeleteProfiles={handleRequestDelete}
            busyReason={busyReason}
            selectionEpoch={selectionEpoch}
            selectedProfileIndex={selectedProfileIndex}
            onSelectProfile={handleProfileSelect}
            onOpenAddProfile={handleOpenAddProfileTutorial}
            addProfileDisabled={isCreatingProfile}
          />
          <Box className="xplanePane">
            <Xplane />
          </Box>
        </Box>

        <Box className="editorPane">
          <Stack spacing={2.25} className="editorStack">
            {profilesLoadError && (
              <Alert severity="error">Could not load profiles: {profilesLoadError}</Alert>
            )}
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
                    disabled={!!selectedProfileError || !isDirty || isSaving || selectedProfileIndex < 0}
                    onClick={handleSave}
                  >
                    Save YAML
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!!selectedProfileError || !isDirty || isSaving || selectedProfileIndex < 0}
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

            {selectedProfileError ? (
              <Alert severity="error" sx={{ mt: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Profile has a YAML error
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "0.8rem" }}>
                  {selectedProfileError}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Fix the YAML syntax in <code>{selectedProfilePath}</code> and the profile will reload automatically.
                </Typography>
              </Alert>
            ) : (
            <>
            <Metadata
              metadata={editableProfile?.metadata}
              filePath={selectedProfilePath}
              source={selectedProfileSource}
              editable
              onMetadataChange={handleMetadataChange}
            />
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
                  <TrimWheelConfiguration
                    editable
                    trimWheels={editableProfile?.trim_wheels}
                    onTrimWheelsChange={(next) => updateProfileField("trim_wheels", next)}
                  />
                )}
                {editorTab === 7 && (
                  <LightConfiguration
                    editable
                    collapsible={false}
                    title={"Bus Voltage Condition"}
                    sectionData={editableProfile?.conditions}
                    onSectionDataChange={(next) => updateProfileField("conditions", next)}
                    keys={["bus_voltage"]}
                  />
                )}
                {editorTab === 8 && (
                  <LightConfiguration
                    editable
                    collapsible={false}
                    title={"Landing Gear Configuration"}
                    sectionData={editableProfile?.conditions}
                    onSectionDataChange={(next) => updateProfileField("conditions", next)}
                    keys={["retractable_gear"]}
                  />
                )}
              </Box>
            </Box>
            </>
            )}
          </Stack>
        </Box>
      </Box>
    </div>
  );
}

export default App
