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
  Tooltip,
  Typography
} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import LocalAirportOutlinedIcon from '@mui/icons-material/LocalAirportOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

interface TabPanelProps {
  profiles: pkg.Profile[];
  selectedProfileIndex: number;
  onSelectProfile: (index: number) => void;
}

export default function Profiles(props: TabPanelProps) {
  const [query, setQuery] = React.useState("");

  const filteredProfiles = React.useMemo(() => {
    const indexedProfiles = props.profiles.map((profile, index) => ({
      profile,
      originalIndex: index,
    }));
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return indexedProfiles;
    }
    return indexedProfiles.filter(({profile}) => {
      const metadata = profile.metadata || {};
      return JSON.stringify(metadata).toLowerCase().includes(normalizedQuery);
    });
  }, [props.profiles, query]);

  return (
    <Box sx={{height: "100%", display: "flex", flexDirection: "column"}}>
      <Box sx={{px: 2.25, pt: 2.25, pb: 1.5}}>
        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5}}>
          <Typography variant="h5" sx={{fontWeight: 700, letterSpacing: "-0.03em", color: "rgba(237, 246, 255, 0.96)"}}>
            Profiles
          </Typography>
          <Tooltip title="Add profile (coming soon)">
            <IconButton
              onClick={() => alert("TODO: Add new profile")}
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
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" sx={{color: "rgba(255,255,255,0.72)"}}/>
              </InputAdornment>
            ),
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
          const name = profile.metadata?.name || `Profile ${index + 1}`;
          const description = profile.metadata?.description || "No description";
          const selectors = profile.metadata?.selectors || [];
          const isSelected = props.selectedProfileIndex === item.originalIndex;
          return (
            <ListItemButton
              key={`${name}-${item.originalIndex}`}
              selected={isSelected}
              onClick={() => props.onSelectProfile(item.originalIndex)}
              sx={{
                borderRadius: 2,
                mb: 0.75,
                border: "1px solid transparent",
                alignItems: "flex-start",
                "&.Mui-selected": {
                  backgroundColor: "rgba(3, 169, 244, 0.16)",
                  borderColor: "rgba(3, 169, 244, 0.55)",
                },
                "&.Mui-selected:hover": {
                  backgroundColor: "rgba(3, 169, 244, 0.2)",
                },
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.08)",
                }
              }}
            >
              <ListItemIcon sx={{minWidth: 34, mt: 0.35}}>
                <LocalAirportOutlinedIcon sx={{color: isSelected ? "#84d8ff" : "#7fd1a5"}}/>
              </ListItemIcon>
              <ListItemText
                primary={name}
                secondary={description}
                primaryTypographyProps={{
                  sx: {
                    fontWeight: isSelected ? 700 : 600,
                    color: "rgba(247, 250, 252, 0.95)",
                    lineHeight: 1.2
                  }
                }}
                secondaryTypographyProps={{
                  sx: {
                    mt: 0.35,
                    color: "rgba(236, 244, 252, 0.66)",
                    lineHeight: 1.25,
                    maxHeight: "2.5em",
                    overflow: "hidden"
                  }
                }}
              />
              {selectors.length > 0 && (
                <Chip
                  label={selectors.length}
                  size="small"
                  sx={{
                    height: 20,
                    mt: 0.2,
                    fontSize: "0.68rem",
                    color: "#b7f3ce",
                    border: "1px solid rgba(183,243,206,0.35)",
                    backgroundColor: "rgba(183,243,206,0.08)"
                  }}
                />
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
