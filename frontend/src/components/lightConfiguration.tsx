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

interface LightConfigurationProps {
  title: string;
  sectionData?: pkg.Leds | pkg.Knobs | pkg.Conditions;
  keys: string[];
  editable?: boolean;
  collapsible?: boolean;
  onSectionDataChange?: (nextData: Record<string, SectionEntry | undefined>) => void;
}

interface DatarefRow {
  dataref_str?: string;
  operator?: string;
  threshold?: number;
  index?: number;
}

interface SectionEntry {
  datarefs?: DatarefRow[];
  condition?: string;
  [key: string]: any;
}

interface LightSection {
  key: string;
  entry?: SectionEntry;
}

const OPERATOR_OPTIONS = ["", "==", "!=", ">", ">=", "<", "<="];
const LIGHT_LABEL_OVERRIDES: Record<string, string> = {
  volt_low: "Low Voltage"
};
const LIGHT_KEY_ALIASES: Record<string, string[]> = {
  volt_low: ["low_voltage", "low_volt"]
};

function formatLightKey(key: string): string {
  if (LIGHT_LABEL_OVERRIDES[key]) {
    return LIGHT_LABEL_OVERRIDES[key];
  }
  return key
    .split("_")
    .filter(Boolean)
    .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1))
    .join(" ");
}

function cloneEntry(entry?: SectionEntry): SectionEntry {
  return {
    ...(entry || {}),
    condition: entry?.condition || "",
    datarefs: (entry?.datarefs || []).map((row) => ({...row}))
  };
}

export default function LightConfiguration(props: LightConfigurationProps) {
  const isCollapsible = props.collapsible !== false;
  const sectionRecord = (props.sectionData as Record<string, SectionEntry | undefined> | undefined) || {};
  const resolveSectionEntry = (key: string): SectionEntry | undefined => {
    const directEntry = sectionRecord[key];
    if (directEntry) {
      return directEntry;
    }
    const aliases = LIGHT_KEY_ALIASES[key] || [];
    for (const alias of aliases) {
      if (sectionRecord[alias]) {
        return sectionRecord[alias];
      }
    }
    return undefined;
  };

  const sections: LightSection[] = props.keys.map((key) => ({
    key,
    entry: resolveSectionEntry(key)
  }));

  const configuredCount = sections.filter((section) => (section.entry?.datarefs || []).length > 0).length;

  const updateEntry = (key: string, updater: (entry: SectionEntry) => SectionEntry) => {
    if (!props.editable || !props.onSectionDataChange) {
      return;
    }
    const nextRecord = {...sectionRecord};
    const aliases = LIGHT_KEY_ALIASES[key] || [];
    let sourceEntry = nextRecord[key];
    if (!sourceEntry) {
      for (const alias of aliases) {
        if (nextRecord[alias]) {
          sourceEntry = nextRecord[alias];
          break;
        }
      }
    }
    const nextEntry = updater(cloneEntry(sourceEntry));
    for (const alias of aliases) {
      delete nextRecord[alias];
    }
    nextRecord[key] = nextEntry;
    props.onSectionDataChange(nextRecord);
  };

  const addRow = (key: string) => {
    updateEntry(key, (entry) => ({
      ...entry,
      datarefs: [
        ...(entry.datarefs || []),
        {
          dataref_str: "",
          operator: "==",
          threshold: 0,
          index: 0
        }
      ]
    }));
  };

  const removeRow = (key: string, rowIndex: number) => {
    updateEntry(key, (entry) => ({
      ...entry,
      datarefs: (entry.datarefs || []).filter((_, index) => index !== rowIndex)
    }));
  };

  const updateRow = (key: string, rowIndex: number, field: keyof DatarefRow, value: string) => {
    updateEntry(key, (entry) => {
      const rows = [...(entry.datarefs || [])];
      if (!rows[rowIndex]) {
        return entry;
      }
      const nextRow = {...rows[rowIndex]};
      if (field === "threshold") {
        const parsed = Number(value);
        nextRow.threshold = value === "" || Number.isNaN(parsed) ? undefined : parsed;
      } else if (field === "index") {
        const parsed = Number.parseInt(value, 10);
        nextRow.index = value === "" || Number.isNaN(parsed) ? undefined : parsed;
      } else if (field === "operator") {
        nextRow.operator = value;
      } else {
        nextRow.dataref_str = value;
      }
      rows[rowIndex] = nextRow;
      return {
        ...entry,
        datarefs: rows
      };
    });
  };

  const updateCondition = (key: string, condition: string) => {
    updateEntry(key, (entry) => ({
      ...entry,
      condition,
    }));
  };

  const sectionContent = (
    <>
      {sections.map((section) => {
        const rows = section.entry?.datarefs || [];
        const conditionLabel = (section.entry?.condition || "").trim();
        const effectiveConditionLabel = conditionLabel === "" ? "all (default)" : conditionLabel;
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
              <Box sx={{display: "flex", alignItems: "center", gap: 1, width: "100%"}}>
                <Typography
                  variant="subtitle1"
                  component="div"
                  sx={{textAlign: 'left', fontWeight: 700, color: "rgba(233, 244, 255, 0.93)"}}
                >
                  {formatLightKey(section.key)}
                </Typography>
                <Chip
                  label={`Condition: ${effectiveConditionLabel}`}
                  size="small"
                  sx={{
                    color: "#c6ecff",
                    border: "1px solid rgba(114, 171, 216, 0.45)",
                    backgroundColor: "rgba(38, 86, 128, 0.28)"
                  }}
                />
              </Box>
            </AccordionSummary>

            <AccordionDetails sx={{px: 1.2, pb: 1.2, pt: 0.2}}>
              {props.editable && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{mb: 1.2}}>
                  <TextField
                    select
                    size="small"
                    label="Condition"
                    value={section.entry?.condition || ""}
                    onChange={(event) => updateCondition(section.key, event.target.value)}
                    sx={{width: 150}}
                  >
                    <MenuItem value="">default (all)</MenuItem>
                    <MenuItem value="any">any</MenuItem>
                    <MenuItem value="all">all</MenuItem>
                  </TextField>
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
                  <Table size="small" aria-label={`${section.key} datarefs`}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{color: "rgba(194, 221, 244, 0.86)", fontWeight: 700}}>Dataref</TableCell>
                        <TableCell sx={{color: "rgba(194, 221, 244, 0.86)", fontWeight: 700}}>Op</TableCell>
                        <TableCell sx={{color: "rgba(194, 221, 244, 0.86)", fontWeight: 700}}>Threshold</TableCell>
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
                          <TableCell align="left" sx={{width: "52%", color: "rgba(230, 240, 250, 0.94)"}}>
                            {props.editable ? (
                              <TextField
                                size="small"
                                value={dataref.dataref_str || ""}
                                onChange={(event) => updateRow(section.key, idx, "dataref_str", event.target.value)}
                                fullWidth
                              />
                            ) : (
                              dataref.dataref_str
                            )}
                          </TableCell>
                          <TableCell align="left" sx={{width: "10%", color: "rgba(230, 240, 250, 0.92)"}}>
                            {props.editable ? (
                              <TextField
                                select
                                size="small"
                                value={dataref.operator || ""}
                                onChange={(event) => updateRow(section.key, idx, "operator", event.target.value)}
                                sx={{width: 86}}
                              >
                                {OPERATOR_OPTIONS.map((option) => (
                                  <MenuItem key={option || "none"} value={option}>
                                    {option || "--"}
                                  </MenuItem>
                                ))}
                              </TextField>
                            ) : (
                              dataref.operator || "--"
                            )}
                          </TableCell>
                          <TableCell align="left" sx={{width: "12%", color: "rgba(230, 240, 250, 0.92)"}}>
                            {props.editable ? (
                              <TextField
                                size="small"
                                type="number"
                                value={typeof dataref.threshold === "number" ? dataref.threshold : ""}
                                onChange={(event) => updateRow(section.key, idx, "threshold", event.target.value)}
                                sx={{width: 104}}
                              />
                            ) : (
                              typeof dataref.threshold === "number" ? dataref.threshold : "--"
                            )}
                          </TableCell>
                          <TableCell align="left" sx={{width: "8%", color: "rgba(230, 240, 250, 0.92)"}}>
                            {props.editable ? (
                              <TextField
                                size="small"
                                type="number"
                                value={typeof dataref.index === "number" ? dataref.index : ""}
                                onChange={(event) => updateRow(section.key, idx, "index", event.target.value)}
                                sx={{width: 86}}
                              />
                            ) : (
                              dataref.index ?? 0
                            )}
                          </TableCell>
                          <TableCell align="left" sx={{width: "14%"}}>
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
