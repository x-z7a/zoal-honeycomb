import Accordion from '@mui/material/Accordion';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import {pkg} from "../../wailsjs/go/models";
import {
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField
} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import DatarefValue from './datarefValue';

interface DataConfigurationProps {
  title: string;
  data?: pkg.Data;
  keys: string[];
  editable?: boolean;
  collapsible?: boolean;
  onDataChange?: (nextData: Record<string, DataEntry | undefined>) => void;
}

interface DatarefRow {
  dataref_str?: string;
  index?: number;
}

interface DataEntry {
  datarefs?: DatarefRow[];
  value?: number;
  [key: string]: any;
}

interface DataSection {
  key: string;
  entry?: DataEntry;
}

type StepSource = "dataref" | "value";

const STEP_LABELS: Record<string, string> = {
  ap_alt_step: "ALT Step",
  ap_vs_step: "VS Step",
  ap_ias_step: "IAS Step",
};

const STEP_DEFAULTS: Record<string, number> = {
  ap_alt_step: 100,
  ap_vs_step: 1,
  ap_ias_step: 1,
};

const DARK_NUMBER_FIELD_SX = {
  "& input[type=number]": {
    appearance: "textfield",
    MozAppearance: "textfield",
  },
  "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": {
    WebkitAppearance: "none",
    margin: 0,
  },
};

function formatStepKey(key: string): string {
  if (STEP_LABELS[key]) {
    return STEP_LABELS[key];
  }

  return key
    .split("_")
    .filter(Boolean)
    .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1))
    .join(" ");
}

function cloneEntry(entry?: DataEntry): DataEntry {
  return {
    ...(entry || {}),
    datarefs: (entry?.datarefs || []).map((row) => ({...row})),
    value: entry?.value
  };
}

function hasPrimaryDataref(entry?: DataEntry): boolean {
  const first = entry?.datarefs?.[0];
  return (first?.dataref_str || "").trim() !== "";
}

function getStepSource(entry?: DataEntry): StepSource {
  if (hasPrimaryDataref(entry)) {
    return "dataref";
  }
  return "value";
}

export default function DataConfiguration(props: DataConfigurationProps) {
  const isCollapsible = props.collapsible !== false;
  const dataRecord = (props.data as Record<string, DataEntry | undefined> | undefined) || {};
  const sections: DataSection[] = props.keys.map((key) => ({
    key,
    entry: dataRecord[key]
  }));

  const updateEntry = (key: string, updater: (entry: DataEntry) => DataEntry) => {
    if (!props.editable || !props.onDataChange) {
      return;
    }
    const nextRecord = {...dataRecord};
    nextRecord[key] = updater(cloneEntry(nextRecord[key]));
    props.onDataChange(nextRecord);
  };

  const setSource = (key: string, source: StepSource) => {
    updateEntry(key, (entry) => {
      if (source === "dataref") {
        const datarefs = (entry.datarefs || []).map((row) => ({...row}));
        if (datarefs.length === 0) {
          datarefs.push({dataref_str: "", index: 0});
        }
        return {
          ...entry,
          datarefs,
          value: undefined
        };
      }

      return {
        ...entry,
        datarefs: []
      };
    });
  };

  const updatePrimaryDataref = (key: string, field: keyof DatarefRow, value: string) => {
    updateEntry(key, (entry) => {
      const datarefs = [...(entry.datarefs || [])];
      if (datarefs.length === 0) {
        datarefs.push({dataref_str: "", index: 0});
      }
      const first = {...(datarefs[0] || {})};
      if (field === "index") {
        const parsed = Number.parseInt(value, 10);
        first.index = value === "" || Number.isNaN(parsed) ? undefined : parsed;
      } else {
        first.dataref_str = value;
      }
      datarefs[0] = first;
      return {
        ...entry,
        datarefs,
        value: undefined
      };
    });
  };

  const updateValue = (key: string, rawValue: string) => {
    updateEntry(key, (entry) => {
      const parsed = Number(rawValue);
      return {
        ...entry,
        datarefs: [],
        value: rawValue === "" || Number.isNaN(parsed) ? undefined : parsed
      };
    });
  };

  const bumpIndex = (key: string, delta: number) => {
    updateEntry(key, (entry) => {
      const datarefs = [...(entry.datarefs || [])];
      if (datarefs.length === 0) {
        datarefs.push({dataref_str: "", index: 0});
      }
      const first = {...(datarefs[0] || {})};
      const current = first.index ?? 0;
      first.index = current + delta;
      datarefs[0] = first;
      return {
        ...entry,
        datarefs,
        value: undefined
      };
    });
  };

  const bumpValue = (key: string, delta: number) => {
    updateEntry(key, (entry) => {
      const fallbackValue = STEP_DEFAULTS[key] ?? 1;
      const current = typeof entry.value === "number" ? entry.value : fallbackValue;
      return {
        ...entry,
        datarefs: [],
        value: current + delta
      };
    });
  };

  const numberStepperAdornment = (
    onUp: () => void,
    onDown: () => void
  ) => (
    <InputAdornment position="end" sx={{ml: 0}}>
      <Stack spacing={0} sx={{mr: -0.5}}>
        <IconButton
          size="small"
          onClick={onUp}
          sx={{
            p: 0.2,
            color: "rgba(220, 240, 255, 0.95)",
            "&:hover": {backgroundColor: "rgba(122, 183, 235, 0.18)"}
          }}
        >
          <KeyboardArrowUpIcon fontSize="small"/>
        </IconButton>
        <IconButton
          size="small"
          onClick={onDown}
          sx={{
            p: 0.2,
            color: "rgba(220, 240, 255, 0.95)",
            "&:hover": {backgroundColor: "rgba(122, 183, 235, 0.18)"}
          }}
        >
          <KeyboardArrowDownIcon fontSize="small"/>
        </IconButton>
      </Stack>
    </InputAdornment>
  );

  const sectionContent = (
    <>
      {sections.map((section) => {
        const source = getStepSource(section.entry);
        const firstDataref = section.entry?.datarefs?.[0];
        const fallbackValue = STEP_DEFAULTS[section.key] ?? 1;
        const firstDatarefValue = (firstDataref?.dataref_str || "").trim();
        const firstDatarefIndex = firstDataref?.index ?? 0;
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
              expandIcon={isCollapsible ? <ExpandMoreIcon sx={{color: "rgba(200, 227, 251, 0.86)"}}/> : null}
              sx={{px: 1.75, py: 0.45}}
            >
              <Box sx={{display: "flex", alignItems: "center", gap: 1, width: "100%", flexWrap: "wrap"}}>
                <Typography
                  variant="subtitle1"
                  component="div"
                  sx={{textAlign: 'left', fontWeight: 700, color: "rgba(233, 244, 255, 0.93)"}}
                >
                  {formatStepKey(section.key)}
                </Typography>
                <Chip
                  label={`Source: ${source === "dataref" ? "dataref" : "fixed value"}`}
                  size="small"
                  sx={{
                    color: "#c6ecff",
                    border: "1px solid rgba(114, 171, 216, 0.45)",
                    backgroundColor: "rgba(38, 86, 128, 0.28)"
                  }}
                />
                <Chip
                  label={`Default: ${fallbackValue}`}
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
                  <TextField
                    select
                    size="small"
                    label="Source"
                    value={source}
                    onChange={(event) => setSource(section.key, event.target.value as StepSource)}
                    sx={{width: 220}}
                  >
                    <MenuItem value="value">Fixed value</MenuItem>
                    <MenuItem value="dataref">Read from dataref</MenuItem>
                  </TextField>
                )}

                {source === "dataref" ? (
                  <Card
                    variant="outlined"
                    sx={{
                      p: 1.15,
                      borderRadius: 2,
                      borderColor: "rgba(148, 180, 210, 0.3)",
                      backgroundColor: "rgba(11, 23, 35, 0.55)"
                    }}
                  >
                    <Stack spacing={1.1}>
                      <TextField
                        size="small"
                        label="Dataref"
                        value={firstDataref?.dataref_str || ""}
                        onChange={(event) => updatePrimaryDataref(section.key, "dataref_str", event.target.value)}
                        fullWidth
                        disabled={!props.editable}
                      />
                      <Stack direction="row" spacing={1.1} alignItems="center" flexWrap="wrap">
                        <TextField
                          size="small"
                          label="Index"
                          type="number"
                          value={firstDataref?.index ?? ""}
                          onChange={(event) => updatePrimaryDataref(section.key, "index", event.target.value)}
                          sx={{width: 110, ...DARK_NUMBER_FIELD_SX}}
                          disabled={!props.editable}
                          InputProps={{
                            endAdornment: numberStepperAdornment(
                              () => bumpIndex(section.key, 1),
                              () => bumpIndex(section.key, -1)
                            )
                          }}
                        />
                        <Typography variant="caption" sx={{color: "rgba(197, 218, 238, 0.76)"}}>
                          Live:
                        </Typography>
                        {firstDatarefValue === "" ? (
                          <Typography variant="body2" sx={{color: "rgba(201, 219, 236, 0.72)"}}>
                            --
                          </Typography>
                        ) : (
                          <DatarefValue dataref={firstDatarefValue} index={firstDatarefIndex}/>
                        )}
                      </Stack>
                      {(section.entry?.datarefs?.length || 0) > 1 && (
                        <Typography variant="caption" sx={{color: "rgba(245, 203, 145, 0.9)"}}>
                          Only the first dataref is used for step calculation at runtime.
                        </Typography>
                      )}
                    </Stack>
                  </Card>
                ) : (
                  <Card
                    variant="outlined"
                    sx={{
                      p: 1.15,
                      borderRadius: 2,
                      borderColor: "rgba(148, 180, 210, 0.3)",
                      backgroundColor: "rgba(11, 23, 35, 0.55)"
                    }}
                  >
                    <Stack spacing={0.8} alignItems="flex-start">
                      <TextField
                        size="small"
                        label="Step Value"
                        type="number"
                        value={typeof section.entry?.value === "number" ? section.entry.value : ""}
                        onChange={(event) => updateValue(section.key, event.target.value)}
                        disabled={!props.editable}
                        sx={{width: 180, ...DARK_NUMBER_FIELD_SX}}
                        InputProps={{
                          endAdornment: numberStepperAdornment(
                            () => bumpValue(section.key, 1),
                            () => bumpValue(section.key, -1)
                          )
                        }}
                      />
                      <Typography variant="caption" sx={{color: "rgba(197, 218, 238, 0.76)"}}>
                        Leave blank to use runtime default ({fallbackValue}).
                      </Typography>
                    </Stack>
                  </Card>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </>
  );

  const body = (
    <Box sx={{p: 1.25, overflowY: "auto", flex: 1}}>
      {sectionContent}
    </Box>
  );

  if (!isCollapsible) {
    return body;
  }

  return (
    <Accordion
      defaultExpanded
      disableGutters
      elevation={0}
      sx={{
        borderRadius: 2.5,
        border: "1px solid rgba(146, 177, 203, 0.3)",
        backgroundColor: "transparent",
        overflow: "hidden",
        width: "100%",
        "&::before": {display: "none"}
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{color: "rgba(196, 224, 247, 0.88)"}}/>}
        sx={{px: 1.2, py: 0.2, backgroundColor: "rgba(11, 22, 33, 0.68)"}}
      >
        <Typography sx={{fontWeight: 700, color: "rgba(231, 244, 255, 0.95)"}}>
          {props.title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{p: 0}}>
        {body}
      </AccordionDetails>
    </Accordion>
  );
}
