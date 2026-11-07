import * as React from 'react';
import Box from '@mui/material/Box';
import {pkg} from '../models';
import {
  Button,
  Checkbox,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChecklistIcon from '@mui/icons-material/Checklist';
import LocalAirportOutlinedIcon from '@mui/icons-material/LocalAirportOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

type SourceFilter = "all" | "default" | "user";


const HEADER_BUTTON_SX = {
  backgroundColor: "rgba(255,255,255,0.1)",
  color: "#d8f3dc",
  border: "1px solid rgba(216,243,220,0.25)",
  "&:hover": {
    backgroundColor: "rgba(255,255,255,0.16)"
  }
};

// Marks the profile the plugin is actually using.
const ACTIVE_COLOR = "#5fd38d";
const ACTIVE_BORDER = "rgba(95, 211, 141, 0.55)";
const ACTIVE_BACKGROUND = "rgba(95, 211, 141, 0.1)";

interface TabPanelProps {
  profiles: pkg.Profile[];
  profileErrors: string[];
  profileFiles: string[];
  profileSources: string[];
  selectedProfileIndex: number;
  /** Index of the profile the plugin is using for the current aircraft, or -1. */
  activeProfileIndex: number;
  onSelectProfile: (index: number) => void;
  onOpenAddProfile: () => void;
  addProfileDisabled?: boolean;
  /** Reread the profile folders and the in-use profile. */
  onReload: () => void;
  /** Ask to delete these user profiles (indices into profiles). */
  onDeleteProfiles: (indices: number[]) => void;
  /** Set while reload/delete must wait (e.g. unsaved changes); shown as the tooltip. */
  busyReason?: string;
  /** Changes after a successful delete; leaves selection mode. */
  selectionEpoch?: number;
}

export default function Profiles(props: TabPanelProps) {
  const [query, setQuery] = React.useState("");
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>("all");
  // Bulk delete: while selecting, clicking a user profile toggles it.
  const [selecting, setSelecting] = React.useState(false);
  const [checked, setChecked] = React.useState<Set<string>>(new Set());

  const isUserIndex = (index: number) => (props.profileSources[index] || "default") === "user";

  // Selection is kept by file, so it survives the list reloading.
  React.useEffect(() => {
    setChecked((prev) => {
      const files = new Set(props.profileFiles.filter((_, i) => isUserIndex(i)));
      const next = new Set([...prev].filter((f) => files.has(f)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.profileFiles, props.profileSources]);

  const toggleChecked = (index: number) => {
    const file = props.profileFiles[index];
    if (!file || !isUserIndex(index)) {
      return;
    }
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  };

  const stopSelecting = () => {
    setSelecting(false);
    setChecked(new Set());
  };

  React.useEffect(() => {
    stopSelecting();
  }, [props.selectionEpoch]);

  const basenameFromPath = (index: number): string => {
    const filePath = props.profileFiles[index] || "";
    const normalized = filePath.replace(/\\/g, "/");
    const basename = normalized.split("/").pop() || "";
    return basename.endsWith(".yaml") ? basename.slice(0, -5) : basename || `Profile ${index + 1}`;
  };

  const filteredProfiles = React.useMemo(() => {
    const indexedProfiles = props.profiles.map((profile, index) => ({
      profile,
      originalIndex: index,
    }));
    const normalizedQuery = query.trim().toLowerCase();

    return indexedProfiles.filter(({profile, originalIndex}) => {
      // Source filter
      if (sourceFilter !== "all") {
        const source = props.profileSources[originalIndex] || "default";
        if (source !== sourceFilter) {
          return false;
        }
      }
      // Text search filter
      if (normalizedQuery) {
        const metadata = profile.metadata || {};
        if (!JSON.stringify(metadata).toLowerCase().includes(normalizedQuery)) {
          return false;
        }
      }
      return true;
    });
  }, [props.profiles, props.profileSources, query, sourceFilter]);

  const handleSourceFilterChange = (_: React.MouseEvent<HTMLElement>, value: SourceFilter | null) => {
    if (value !== null) {
      setSourceFilter(value);
    }
  };

  // The profile the plugin is using stays locked above the list, whatever
  // the search or source filter, so it is always one glance away.
  const activeItem = props.activeProfileIndex >= 0 && props.activeProfileIndex < props.profiles.length
    ? {profile: props.profiles[props.activeProfileIndex], originalIndex: props.activeProfileIndex}
    : null;
  const listedProfiles = filteredProfiles.filter((item) => item.originalIndex !== props.activeProfileIndex);

  const renderProfileItem = (item: {profile: pkg.Profile; originalIndex: number}) => {
    const profile = item.profile;
    const profileError = props.profileErrors[item.originalIndex] || "";
    const hasError = profileError !== "";
    const name = hasError
      ? (profile.metadata?.name || basenameFromPath(item.originalIndex))
      : (profile.metadata?.name || `Profile ${item.originalIndex + 1}`);
    const description = hasError ? "YAML parse error" : (profile.metadata?.description || "No description");
    const selectors = profile.metadata?.selectors || [];
    const isSelected = props.selectedProfileIndex === item.originalIndex;
    const source = props.profileSources[item.originalIndex] || "default";
    const isUserProfile = source === "user";
    const isActive = props.activeProfileIndex === item.originalIndex;
    const isChecked = checked.has(props.profileFiles[item.originalIndex] || "");
    const selectable = selecting && isUserProfile;
    return (
      <ListItemButton
        key={`${name}-${item.originalIndex}`}
        selected={isSelected}
        onClick={() => (selecting ? toggleChecked(item.originalIndex) : props.onSelectProfile(item.originalIndex))}
        disabled={selecting && !isUserProfile}
        sx={{
          borderRadius: 2,
          mb: 0.75,
          border: hasError
            ? "1px solid rgba(244, 67, 54, 0.4)"
            : isActive ? `1px solid ${ACTIVE_BORDER}` : "1px solid transparent",
          // The in-use profile keeps a green edge even while another is selected.
          boxShadow: isActive && !hasError ? `inset 3px 0 0 ${ACTIVE_COLOR}` : undefined,
          alignItems: "flex-start",
          backgroundColor: hasError ? "rgba(244, 67, 54, 0.06)" : isActive ? ACTIVE_BACKGROUND : undefined,
          "&.Mui-selected": {
            backgroundColor: hasError ? "rgba(244, 67, 54, 0.14)" : "rgba(3, 169, 244, 0.16)",
            borderColor: hasError ? "rgba(244, 67, 54, 0.55)" : isActive ? ACTIVE_COLOR : "rgba(3, 169, 244, 0.55)",
          },
          "&.Mui-selected:hover": {
            backgroundColor: hasError ? "rgba(244, 67, 54, 0.18)" : "rgba(3, 169, 244, 0.2)",
          },
          "&:hover": {
            backgroundColor: hasError ? "rgba(244, 67, 54, 0.1)" : "rgba(255,255,255,0.08)",
          }
        }}
      >
        <ListItemIcon sx={{minWidth: 34, mt: 0.35}}>
          {selectable ? (
            <Checkbox
              edge="start"
              size="small"
              checked={isChecked}
              tabIndex={-1}
              disableRipple
              sx={{p: 0, color: "rgba(255,213,158,0.6)", "&.Mui-checked": {color: "#ff8a80"}}}
            />
          ) : hasError ? (
            <ErrorOutlineIcon sx={{color: "#f44336"}}/>
          ) : (
            <LocalAirportOutlinedIcon sx={{color: isActive ? ACTIVE_COLOR : isSelected ? "#84d8ff" : "rgba(168, 200, 232, 0.7)"}}/>
          )}
        </ListItemIcon>
        <ListItemText
          primary={name}
          secondary={description}
          primaryTypographyProps={{
            sx: {
              fontWeight: isSelected ? 700 : 600,
              color: hasError ? "rgba(244, 67, 54, 0.9)" : "rgba(247, 250, 252, 0.95)",
              lineHeight: 1.2
            }
          }}
          secondaryTypographyProps={{
            sx: {
              mt: 0.35,
              color: hasError ? "rgba(244, 67, 54, 0.7)" : "rgba(236, 244, 252, 0.66)",
              lineHeight: 1.25,
              maxHeight: "2.5em",
              overflow: "hidden"
            }
          }}
        />
        {!hasError && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5, mt: 0.2 }}>
            {isActive && (
              <Tooltip title="The plugin is using this profile for the current aircraft">
                <Chip
                  label="In use"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    color: "#06210f",
                    backgroundColor: ACTIVE_COLOR
                  }}
                />
              </Tooltip>
            )}
            <Chip
              label={isUserProfile ? "User" : "Default"}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.65rem",
                fontWeight: 700,
                color: isUserProfile ? "#ffd59e" : "#a8c8e8",
                border: isUserProfile
                  ? "1px solid rgba(255,213,158,0.4)"
                  : "1px solid rgba(168,200,232,0.3)",
                backgroundColor: isUserProfile
                  ? "rgba(255,213,158,0.1)"
                  : "rgba(168,200,232,0.06)"
              }}
            />
            {selectors.length > 0 && (
              <Chip
                label={selectors.length}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.68rem",
                  color: "#b7f3ce",
                  border: "1px solid rgba(183,243,206,0.35)",
                  backgroundColor: "rgba(183,243,206,0.08)"
                }}
              />
            )}
          </Box>
        )}
        {isUserProfile && !selecting && (
          <Tooltip title={props.busyReason || "Delete this user profile"}>
            <span>
              <IconButton
                size="small"
                aria-label="Delete profile"
                disabled={!!props.busyReason}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onDeleteProfiles([item.originalIndex]);
                }}
                sx={{ml: 0.5, mt: 0.1, color: "rgba(255,138,128,0.75)", "&:hover": {color: "#ff8a80"}}}
              >
                <DeleteOutlineIcon fontSize="small"/>
              </IconButton>
            </span>
          </Tooltip>
        )}
      </ListItemButton>
    );
  };

  return (
    <Box sx={{height: "100%", display: "flex", flexDirection: "column"}}>
      <Box sx={{px: 2.25, pt: 2.25, pb: 1.5}}>
        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5}}>
          <Typography variant="h5" sx={{fontWeight: 700, letterSpacing: "-0.03em", color: "rgba(237, 246, 255, 0.96)"}}>
            Profiles
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75 }}>
            <Tooltip title={props.busyReason || "Reload profiles from disk"}>
              <span>
                <IconButton onClick={props.onReload} disabled={!!props.busyReason} size="small" sx={HEADER_BUTTON_SX}>
                  <RefreshIcon fontSize="small"/>
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={props.busyReason || (selecting ? "Stop selecting" : "Select user profiles to delete")}>
              <span>
                <IconButton
                  onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
                  disabled={!!props.busyReason && !selecting}
                  size="small"
                  sx={{...HEADER_BUTTON_SX, ...(selecting ? {color: "#ff8a80", borderColor: "rgba(255,138,128,0.5)"} : {})}}
                >
                  <ChecklistIcon fontSize="small"/>
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={props.addProfileDisabled ? "Creating a profile..." : "Create a new profile from default.yaml"}>
              <IconButton
                onClick={props.onOpenAddProfile}
                disabled={props.addProfileDisabled}
                size="small"
                sx={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: "#d8f3dc",
                  border: "1px solid rgba(216,243,220,0.25)",
                  "&:hover": {
                    backgroundColor: "rgba(255,255,255,0.16)"
                  }
                }}
              >
                <AddIcon fontSize="small"/>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <TextField
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          size="small"
          placeholder="Search by metadata..."
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" sx={{color: "rgba(255,255,255,0.72)"}}/>
                </InputAdornment>
              ),
            }
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              color: "#f3f6f8",
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: 2,
              "& fieldset": {
                borderColor: "rgba(255,255,255,0.12)",
              },
              "&:hover fieldset": {
                borderColor: "rgba(255,255,255,0.2)",
              },
              "&.Mui-focused fieldset": {
                borderColor: "rgba(173,232,244,0.9)",
              }
            }
          }}
        />

        <ToggleButtonGroup
          value={sourceFilter}
          exclusive
          onChange={handleSourceFilterChange}
          size="small"
          sx={{
            mt: 1,
            width: "100%",
            "& .MuiToggleButton-root": {
              flex: 1,
              py: 0.3,
              fontSize: "0.7rem",
              fontWeight: 600,
              textTransform: "none",
              color: "rgba(200, 220, 240, 0.7)",
              borderColor: "rgba(255,255,255,0.12)",
              "&.Mui-selected": {
                color: "#e6f6ff",
                backgroundColor: "rgba(3, 169, 244, 0.18)",
                borderColor: "rgba(3, 169, 244, 0.4)",
              },
              "&.Mui-selected:hover": {
                backgroundColor: "rgba(3, 169, 244, 0.24)",
              },
              "&:hover": {
                backgroundColor: "rgba(255,255,255,0.06)",
              }
            }
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="default">Default</ToggleButton>
          <ToggleButton value="user">User</ToggleButton>
        </ToggleButtonGroup>

        <Typography
          variant="caption"
          sx={{display: "block", mt: 1, color: "rgba(244,248,252,0.66)", textAlign: "left"}}
        >
          {filteredProfiles.length} of {props.profiles.length} profiles
        </Typography>
      </Box>

      <Divider sx={{borderColor: "rgba(255,255,255,0.08)"}}/>

      {activeItem && (
        <>
          <Box sx={{px: 1.25, pt: 1.25}}>
            <Typography
              variant="overline"
              sx={{display: "block", px: 0.75, lineHeight: 1.6, letterSpacing: "0.08em", color: ACTIVE_COLOR, fontWeight: 700}}
            >
              In use for this aircraft
            </Typography>
            {renderProfileItem(activeItem)}
          </Box>
          <Divider sx={{borderColor: "rgba(255,255,255,0.08)"}}/>
        </>
      )}

      {selecting && (
        <Box sx={{px: 2, py: 1, display: "flex", alignItems: "center", gap: 1, backgroundColor: "rgba(255,138,128,0.08)", borderBottom: "1px solid rgba(255,138,128,0.2)"}}>
          <Typography variant="caption" noWrap sx={{flex: 1, minWidth: 0, color: "rgba(255,220,215,0.9)"}}>
            {checked.size === 0 ? "Pick user profiles" : `${checked.size} selected`}
          </Typography>
          <Tooltip title="Select every user profile">
            <Button size="small" sx={{minWidth: 0, whiteSpace: "nowrap"}} onClick={() => setChecked(new Set(props.profileFiles.filter((_, i) => isUserIndex(i))))}>
              All
            </Button>
          </Tooltip>
          <Button
            size="small"
            color="error"
            variant="contained"
            disabled={checked.size === 0 || !!props.busyReason}
            onClick={() => props.onDeleteProfiles(
              props.profileFiles.map((f, i) => (checked.has(f) ? i : -1)).filter((i) => i >= 0)
            )}
          >
            Delete
          </Button>
          <Button size="small" sx={{minWidth: 0}} onClick={stopSelecting}>Cancel</Button>
        </Box>
      )}

      <List sx={{px: 1.25, py: 1.25, overflowY: "auto", flex: 1}}>
        {listedProfiles.map((item) => renderProfileItem(item))}

        {filteredProfiles.length === 0 && (
          <Box
            sx={{
              px: 2,
              py: 3,
              textAlign: "left",
              color: "rgba(235,245,250,0.72)",
              border: "1px dashed rgba(255,255,255,0.16)",
              borderRadius: 2
            }}
          >
            <Typography variant="subtitle2" sx={{fontWeight: 700}}>
              No matches
            </Typography>
            <Typography variant="body2" sx={{mt: 0.5}}>
              Try searching by name, description, or selector.
            </Typography>
          </Box>
        )}
      </List>
    </Box>
  );
}
