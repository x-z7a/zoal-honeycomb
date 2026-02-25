import Accordion from '@mui/material/Accordion';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import {pkg} from "../../wailsjs/go/models";
import {
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField
} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DatarefValue from './datarefValue';

interface KnobConfigurationProps {
  title: string;
  knobs?: pkg.Knobs;
  keys: string[];
  editable?: boolean;
  collapsible?: boolean;
  onKnobsChange?: (nextData: Record<string, KnobEntry | undefined>) => void;
}

interface DatarefRow {
  dataref_str?: string;
  index?: number;
}

interface CommandRow {
  command_str?: string;
  [key: string]: any;
}

interface KnobEntry {
  datarefs?: DatarefRow[];
  commands?: CommandRow[];
  [key: string]: any;
}

interface KnobSection {
  key: string;
  entry?: KnobEntry;
}

type KnobMode = "dataref" | "command";

const STEP_HINT: Record<string, string> = {
  ap_alt: "Step: default 100 (uses data.ap_alt_step if configured)",
  ap_vs: "Step: default 1 (uses data.ap_vs_step if configured)",
  ap_ias: "Step: default 1 (uses data.ap_ias_step if configured)",
  ap_hdg: "Step: fixed 1",
  ap_crs: "Step: fixed 1",
};

function formatKnobKey(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1))
    .join(" ");
}

function cloneEntry(entry?: KnobEntry): KnobEntry {
  return {
    ...(entry || {}),
    datarefs: (entry?.datarefs || []).map((row) => ({...row})),
    commands: (entry?.commands || []).map((command) => ({...command})),
  };
}

function getKnobMode(entry?: KnobEntry): KnobMode {
  if ((entry?.commands || []).length > 0) {
    return "command";
  }
  return "dataref";
}

function hasConfiguredDataref(entry?: KnobEntry): boolean {
  return (entry?.datarefs || []).some((row) => (row.dataref_str || "").trim() !== "");
}

function hasConfiguredCommand(entry?: KnobEntry): boolean {
  return (entry?.commands || []).some((command) => (command.command_str || "").trim() !== "");
}

export default function KnobConfiguration(props: KnobConfigurationProps) {
  const isCollapsible = props.collapsible !== false;
  const knobRecord = (props.knobs as Record<string, KnobEntry | undefined> | undefined) || {};
  const sections: KnobSection[] = props.keys.map((key) => ({
    key,
    entry: knobRecord[key]
  }));
  const configuredCount = sections.filter((section) => {
    const mode = getKnobMode(section.entry);
    return mode === "command" ? hasConfiguredCommand(section.entry) : hasConfiguredDataref(section.entry);
  }).length;

  const updateEntry = (key: string, updater: (entry: KnobEntry) => KnobEntry) => {
    if (!props.editable || !props.onKnobsChange) {
      return;
    }
    const nextRecord = {...knobRecord};
    const nextEntry = updater(cloneEntry(nextRecord[key]));
    nextRecord[key] = nextEntry;
    props.onKnobsChange(nextRecord);
  };

  const setMode = (key: string, mode: KnobMode) => {
    updateEntry(key, (entry) => {
      if (mode === "command") {
        const commands = [...(entry.commands || [])].slice(0, 2).map((command) => ({...command}));
        while (commands.length < 2) {
          commands.push({command_str: ""});
        }
        return {
          ...entry,
          commands,
          datarefs: []
        };
      }

      const datarefs = (entry.datarefs || []).map((row) => ({...row}));
      if (datarefs.length === 0) {
        datarefs.push({dataref_str: "", index: 0});
      }
      return {
        ...entry,
        datarefs,
        commands: []
      };
    });
  };

  const addRow = (key: string) => {
    updateEntry(key, (entry) => ({
      ...entry,
      commands: [],
      datarefs: [...(entry.datarefs || []), {dataref_str: "", index: 0}]
    }));
  };

  const removeRow = (key: string, rowIndex: number) => {
    updateEntry(key, (entry) => ({
      ...entry,
      commands: [],
      datarefs: (entry.datarefs || []).filter((_, index) => index !== rowIndex)
    }));
  };

  const updateDataref = (key: string, rowIndex: number, field: keyof DatarefRow, value: string) => {
    updateEntry(key, (entry) => {
      const rows = [...(entry.datarefs || [])];
      if (!rows[rowIndex]) {
        return entry;
      }
      const nextRow = {...rows[rowIndex]};
      if (field === "index") {
        const parsed = Number.parseInt(value, 10);
        nextRow.index = value === "" || Number.isNaN(parsed) ? undefined : parsed;
      } else {
        nextRow.dataref_str = value;
      }
      rows[rowIndex] = nextRow;
      return {
        ...entry,
        commands: [],
        datarefs: rows
      };
    });
  };

  const updateCommand = (key: string, direction: 0 | 1, commandStr: string) => {
    updateEntry(key, (entry) => {
      const commands = [...(entry.commands || [])];
      while (commands.length <= direction) {
        commands.push({command_str: ""});
      }
      commands[direction] = {
        ...(commands[direction] || {}),
        command_str: commandStr
      };
      return {
        ...entry,
        datarefs: [],
        commands
      };
    });
  };

  const sectionContent = (
    <>
      {sections.map((section) => {
        const mode = getKnobMode(section.entry);
        const rows = section.entry?.datarefs || [];
        const commands = section.entry?.commands || [];
        const showCommandsEmpty = !hasConfiguredCommand(section.entry);

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
              "&::before": {display: "none"},
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{color: "rgba(200, 227, 251, 0.86)"}}/>}
              sx={{px: 1.75, py: 0.45}}
            >
              <Box sx={{display: "flex", alignItems: "center", gap: 1, width: "100%", flexWrap: "wrap"}}>
                <Typography
                  variant="subtitle1"
                  component="div"
                  sx={{textAlign: 'left', fontWeight: 700, color: "rgba(233, 244, 255, 0.93)"}}
                >
                  {formatKnobKey(section.key)}
                </Typography>
                <Chip
                  label={STEP_HINT[section.key] || "Knob adjustment profile"}
                  size="small"
                  sx={{
                    color: "#c6ecff",
                    border: "1px solid rgba(114, 171, 216, 0.45)",
                    backgroundColor: "rgba(38, 86, 128, 0.28)"
                  }}
                />
                <Chip
                  label={`Mode: ${mode === "command" ? "command" : "dataref"}`}
                  size="small"
                  sx={{
                    color: "#e6f5ff",
                    border: "1px solid rgba(172, 220, 255, 0.5)",
                    backgroundColor: "rgba(32, 101, 148, 0.28)"
                  }}
                />
              </Box>
            </AccordionSummary>

            <AccordionDetails sx={{px: 1.2, pb: 1.2, pt: 0.2}}>
              <Stack spacing={1.2}>
                {props.editable && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{flexWrap: "wrap"}}>
                    <TextField
                      select
                      size="small"
                      label="Knob Input"
                      value={mode}
                      onChange={(event) => setMode(section.key, event.target.value as KnobMode)}
                      sx={{width: 172}}
                    >
                      <MenuItem value="dataref">Dataref</MenuItem>
                      <MenuItem value="command">Command</MenuItem>
                    </TextField>
                    <Typography variant="caption" sx={{textAlign: "left", color: "rgba(190, 214, 237, 0.82)"}}>
                      Use one mode only. Dataref mode writes values directly, command mode triggers commands.
                    </Typography>
                  </Stack>
                )}

                {mode === "command" ? (
                  <>
                    {showCommandsEmpty && !props.editable ? (
                      <Typography sx={{px: 1, py: 1, color: "rgba(216, 231, 245, 0.82)", textAlign: "left"}}>
                        No commands configured.
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        <TextField
                          size="small"
                          label="Increase Command"
                          value={commands[0]?.command_str || ""}
                          onChange={(event) => updateCommand(section.key, 0, event.target.value)}
                          fullWidth
                          disabled={!props.editable}
                        />
                        <TextField
                          size="small"
                          label="Decrease Command"
                          value={commands[1]?.command_str || ""}
                          onChange={(event) => updateCommand(section.key, 1, event.target.value)}
                          fullWidth
                          disabled={!props.editable}
                        />
                      </Stack>
                    )}
                  </>
                ) : (
                  <>
                    {props.editable && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button
                          size="small"
                          startIcon={<AddIcon/>}
                          variant="outlined"
                          onClick={() => addRow(section.key)}
                        >
                          Add Dataref
                        </Button>
                      </Stack>
                    )}

                    {rows.length === 0 ? (
                      <Typography sx={{px: 1, py: 1, color: "rgba(216, 231, 245, 0.82)", textAlign: "left"}}>
                        No datarefs configured.
                      </Typography>
                    ) : (
                      <TableContainer
                        sx={{
                          borderRadius: 1.5,
                          border: "1px solid rgba(143, 173, 201, 0.22)",
                          backgroundColor: "rgba(6, 14, 23, 0.65)"
                        }}
                      >
                        <Table size="small" aria-label={`${section.key} knob datarefs`}>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{color: "rgba(194, 221, 244, 0.86)", fontWeight: 700}}>Dataref</TableCell>
                              <TableCell sx={{color: "rgba(194, 221, 244, 0.86)", fontWeight: 700}}>Index</TableCell>
                              <TableCell sx={{color: "rgba(194, 221, 244, 0.86)", fontWeight: 700}}>Live</TableCell>
                              {props.editable && (
                                <TableCell sx={{color: "rgba(194, 221, 244, 0.86)", fontWeight: 700, width: 30}}/>
                              )}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {rows.map((dataref, idx) => (
                              <TableRow
                                key={`${section.key}-${dataref.dataref_str || idx}-${idx}`}
                                sx={{
                                  "&:last-child td, &:last-child th": {border: 0},
                                  "& td": {borderColor: "rgba(102, 134, 164, 0.24)"}
                                }}
                              >
                                <TableCell align="left" sx={{width: "68%", color: "rgba(230, 240, 250, 0.94)"}}>
                                  {props.editable ? (
                                    <TextField
                                      size="small"
                                      value={dataref.dataref_str || ""}
                                      onChange={(event) => updateDataref(section.key, idx, "dataref_str", event.target.value)}
                                      fullWidth
                                    />
                                  ) : (
                                    dataref.dataref_str
                                  )}
                                </TableCell>
                                <TableCell align="left" sx={{width: "12%", color: "rgba(230, 240, 250, 0.92)"}}>
                                  {props.editable ? (
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={typeof dataref.index === "number" ? dataref.index : ""}
                                      onChange={(event) => updateDataref(section.key, idx, "index", event.target.value)}
                                      sx={{width: 86}}
                                    />
                                  ) : (
                                    dataref.index ?? 0
                                  )}
                                </TableCell>
                                <TableCell align="left" sx={{width: "16%"}}>
                                  <DatarefValue dataref={dataref.dataref_str || ""} index={dataref.index || 0}/>
                                </TableCell>
                                {props.editable && (
                                  <TableCell align="right" sx={{width: "4%"}}>
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => removeRow(section.key, idx)}
                                    >
                                      <DeleteOutlineIcon fontSize="small"/>
                                    </IconButton>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </>
  );

  const header = (
    <Box sx={{display: "flex", alignItems: "center", gap: 1.2}}>
      <Typography
        variant="h6"
        component="div"
        sx={{textAlign: 'left', fontWeight: 700, color: "rgba(235, 246, 255, 0.96)"}}
      >
        {props.title}
      </Typography>
      <Chip
        label={`${configuredCount}/${sections.length}`}
        size="small"
        sx={{
          color: "#dcf2ff",
          border: "1px solid rgba(162, 220, 255, 0.35)",
          backgroundColor: "rgba(31, 70, 98, 0.38)"
        }}
      />
    </Box>
  );

  if (!isCollapsible) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          overflowY: "auto",
          "&::-webkit-scrollbar": {width: 8},
          "&::-webkit-scrollbar-track": {background: "rgba(11, 20, 30, 0.45)"},
          "&::-webkit-scrollbar-thumb": {
            background: "rgba(124, 167, 203, 0.48)",
            borderRadius: "999px"
          }
        }}
      >
        {sectionContent}
      </Box>
    );
  }

  return (
    <Card
      variant="outlined"
      sx={{
        width: "100%",
        borderRadius: 3,
        borderColor: "rgba(120, 159, 192, 0.35)",
        background: "linear-gradient(150deg, rgba(10, 17, 28, 0.92), rgba(16, 24, 34, 0.9))",
        boxShadow: "0 14px 28px rgba(0,0,0,0.3)"
      }}
    >
      <Accordion
        disableGutters
        defaultExpanded
        elevation={0}
        sx={{
          background: "transparent",
          "&::before": {display: "none"}
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon sx={{color: "rgba(193, 227, 255, 0.85)"}}/>}
          sx={{px: 2.2, py: 0.75}}
        >
          {header}
        </AccordionSummary>

        <AccordionDetails
          sx={{
            px: 1.6,
            pb: 1.8,
            maxHeight: "44vh",
            overflowY: "auto",
            "&::-webkit-scrollbar": {width: 8},
            "&::-webkit-scrollbar-track": {background: "rgba(11, 20, 30, 0.45)"},
            "&::-webkit-scrollbar-thumb": {
              background: "rgba(124, 167, 203, 0.48)",
              borderRadius: "999px"
            }
          }}
        >
          {sectionContent}
        </AccordionDetails>
      </Accordion>
    </Card>
  );
}
