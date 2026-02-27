import Accordion from '@mui/material/Accordion';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import { pkg } from "../../wailsjs/go/models";
import {
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  TextField
} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

interface ButtonConfigurationProps {
  buttons?: pkg.Buttons;
  keys: string[];
  editable?: boolean;
  onButtonsChange?: (nextData: Record<string, ButtonEntry | undefined>) => void;
}

interface CommandRow {
  command_str?: string;
  [key: string]: any;
}

interface ButtonEntry {
  single_click?: CommandRow[];
  double_click?: CommandRow[];
  [key: string]: any;
}

interface ButtonSection {
  key: string;
  entry?: ButtonEntry;
}

type ClickMode = "single_click" | "double_click";

function formatButtonKey(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((piece) => piece.toUpperCase())
    .join(" ");
}

function cloneEntry(entry?: ButtonEntry): ButtonEntry {
  return {
    ...(entry || {}),
    single_click: (entry?.single_click || []).map((command) => ({ ...command })),
    double_click: (entry?.double_click || []).map((command) => ({ ...command }))
  };
}

export default function ButtonConfiguration(props: ButtonConfigurationProps) {
  const buttonRecord = (props.buttons as Record<string, ButtonEntry | undefined> | undefined) || {};
  const sections: ButtonSection[] = props.keys.map((key) => ({
    key,
    entry: buttonRecord[key]
  }));

  const updateEntry = (key: string, updater: (entry: ButtonEntry) => ButtonEntry) => {
    if (!props.editable || !props.onButtonsChange) {
      return;
    }
    const nextRecord = { ...buttonRecord };
    const nextEntry = updater(cloneEntry(nextRecord[key]));
    nextRecord[key] = nextEntry;
    props.onButtonsChange(nextRecord);
  };

  const addCommand = (key: string, mode: ClickMode) => {
    updateEntry(key, (entry) => ({
      ...entry,
      [mode]: [...(entry[mode] || []), { command_str: "" }]
    }));
  };

  const removeCommand = (key: string, mode: ClickMode, commandIndex: number) => {
    updateEntry(key, (entry) => ({
      ...entry,
      [mode]: (entry[mode] || []).filter((_, index) => index !== commandIndex)
    }));
  };

  const updateCommand = (key: string, mode: ClickMode, commandIndex: number, commandStr: string) => {
    updateEntry(key, (entry) => {
      const commands = [...(entry[mode] || [])];
      if (!commands[commandIndex]) {
        return entry;
      }
      commands[commandIndex] = {
        ...commands[commandIndex],
        command_str: commandStr
      };
      return {
        ...entry,
        [mode]: commands
      };
    });
  };

  const renderCommandGroup = (sectionKey: string, mode: ClickMode, label: string, commands: CommandRow[]) => (
    <Box
      sx={{
        p: 1.2,
        borderRadius: 1.6,
        border: "1px solid rgba(135, 168, 198, 0.22)",
        backgroundColor: "rgba(8, 19, 30, 0.62)"
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "rgba(224, 242, 255, 0.92)" }}>
          {label}
        </Typography>
        {props.editable && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => addCommand(sectionKey, mode)}
          >
            Add Command
          </Button>
        )}
      </Stack>

      {commands.length === 0 ? (
        <Typography variant="body2" sx={{ color: "rgba(198, 220, 241, 0.8)", textAlign: "left" }}>
          No commands configured.
        </Typography>
      ) : (
        <Stack spacing={0.9}>
          {commands.map((command, index) => (
            <Stack key={`${sectionKey}-${mode}-${index}`} direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                fullWidth
                label="Command"
                value={command.command_str || ""}
                onChange={(event) => updateCommand(sectionKey, mode, index, event.target.value)}
                disabled={!props.editable}
              />
              {props.editable && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removeCommand(sectionKey, mode, index)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflowY: "auto",
        "&::-webkit-scrollbar": { width: 8 },
        "&::-webkit-scrollbar-track": { background: "rgba(11, 20, 30, 0.45)" },
        "&::-webkit-scrollbar-thumb": {
          background: "rgba(124, 167, 203, 0.48)",
          borderRadius: "999px"
        }
      }}
    >
      {sections.map((section) => {
        const singleCommands = section.entry?.single_click || [];
        const doubleCommands = section.entry?.double_click || [];
        const populatedCount = singleCommands.length + doubleCommands.length;
        return (
          <Accordion
            key={section.key}
            disableGutters
            defaultExpanded
            elevation={0}
            sx={{
              mb: 1.4,
              borderRadius: 2,
              border: "1px solid rgba(151, 173, 196, 0.22)",
              backgroundColor: "rgba(16, 25, 36, 0.82)",
              overflow: "hidden",
              "&::before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: "rgba(200, 227, 251, 0.86)" }} />}
              sx={{ px: 1.75, py: 0.45 }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                <Typography
                  variant="subtitle1"
                  component="div"
                  sx={{ textAlign: 'left', fontWeight: 700, color: "rgba(233, 244, 255, 0.93)" }}
                >
                  {formatButtonKey(section.key)}
                </Typography>
                <Chip
                  label={`${populatedCount} command${populatedCount === 1 ? "" : "s"}`}
                  size="small"
                  sx={{
                    color: "#c6ecff",
                    border: "1px solid rgba(114, 171, 216, 0.45)",
                    backgroundColor: "rgba(38, 86, 128, 0.28)"
                  }}
                />
              </Box>
            </AccordionSummary>

            <AccordionDetails sx={{ px: 1.2, pb: 1.2, pt: 0.2 }}>
              <Stack spacing={1.1}>
                {renderCommandGroup(section.key, "single_click", "Single Click", singleCommands)}
                {renderCommandGroup(section.key, "double_click", "Double Click", doubleCommands)}
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}
