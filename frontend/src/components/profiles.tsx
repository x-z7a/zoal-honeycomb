import * as React from 'react';
import Box from '@mui/material/Box';
import {pkg} from '../../wailsjs/go/models';
import {
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
import LocalAirportOutlinedIcon from '@mui/icons-material/LocalAirportOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

type SourceFilter = "all" | "default" | "user";

interface TabPanelProps {
  profiles: pkg.Profile[];
  profileErrors: string[];
  profileFiles: string[];
  profileSources: string[];
  selectedProfileIndex: number;
  onSelectProfile: (index: number) => void;
  onOpenAddProfile: () => void;
  addProfileDisabled?: boolean;
}

export default function Profiles(props: TabPanelProps) {
  const [query, setQuery] = React.useState("");
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>("all");

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

  return (
    <Box sx={{height: "100%", display: "flex", flexDirection: "column"}}>
      <Box sx={{px: 2.25, pt: 2.25, pb: 1.5}}>
        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5}}>
          <Typography variant="h5" sx={{fontWeight: 700, letterSpacing: "-0.03em", color: "rgba(237, 246, 255, 0.96)"}}>
            Profiles
          </Typography>
          <Tooltip title={props.addProfileDisabled ? "Profiles folder required first" : "Create a new profile from default.yaml"}>
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

      <List sx={{px: 1.25, py: 1.25, overflowY: "auto", flex: 1}}>
        {filteredProfiles.map((item, index) => {
          const profile = item.profile;
          const profileError = props.profileErrors[item.originalIndex] || "";
          const hasError = profileError !== "";
          const name = hasError
            ? (profile.metadata?.name || basenameFromPath(item.originalIndex))
            : (profile.metadata?.name || `Profile ${index + 1}`);
          const description = hasError ? "YAML parse error" : (profile.metadata?.description || "No description");
          const selectors = profile.metadata?.selectors || [];
          const isSelected = props.selectedProfileIndex === item.originalIndex;
          const source = props.profileSources[item.originalIndex] || "default";
          const isUserProfile = source === "user";
          return (
            <ListItemButton
              key={`${name}-${item.originalIndex}`}
              selected={isSelected}
              onClick={() => props.onSelectProfile(item.originalIndex)}
              sx={{
                borderRadius: 2,
                mb: 0.75,
                border: hasError ? "1px solid rgba(244, 67, 54, 0.4)" : "1px solid transparent",
                alignItems: "flex-start",
                backgroundColor: hasError ? "rgba(244, 67, 54, 0.06)" : undefined,
                "&.Mui-selected": {
                  backgroundColor: hasError ? "rgba(244, 67, 54, 0.14)" : "rgba(3, 169, 244, 0.16)",
                  borderColor: hasError ? "rgba(244, 67, 54, 0.55)" : "rgba(3, 169, 244, 0.55)",
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
                {hasError ? (
                  <ErrorOutlineIcon sx={{color: "#f44336"}}/>
                ) : (
                  <LocalAirportOutlinedIcon sx={{color: isSelected ? "#84d8ff" : "#7fd1a5"}}/>
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
            </ListItemButton>
          );
        })}

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
