import * as React from 'react';
import {pkg} from "../../wailsjs/go/models";
import {
  Box,
  Card,
  Chip,
  Stack,
  TextField,
  Typography
} from "@mui/material";

interface TrimWheelConfigurationProps {
  trimWheels?: pkg.TrimWheels;
  editable?: boolean;
  onTrimWheelsChange?: (nextTrimWheels: TrimWheelsEntry | undefined) => void;
}

interface TrimWheelsEntry {
  up_cmd?: string;
  down_cmd?: string;
  sensitivity?: number;
  window_ms?: number;
  [key: string]: any;
}

const DEFAULT_UP_COMMAND = "sim/flight_controls/pitch_trim_up";
const DEFAULT_DOWN_COMMAND = "sim/flight_controls/pitch_trim_down";
const DEFAULT_SENSITIVITY = 23;
const DEFAULT_WINDOW_MS = 500;

const NUMBER_FIELD_SX = {
  "& input[type=number]": {
    appearance: "textfield",
    MozAppearance: "textfield",
  },
  "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": {
    WebkitAppearance: "none",
    margin: 0,
  },
};

function sanitizeTrimWheels(entry: TrimWheelsEntry): TrimWheelsEntry | undefined {
  const normalized: TrimWheelsEntry = {...entry};

  const upCmd = (normalized.up_cmd || "").trim();
  if (upCmd === "") {
    delete normalized.up_cmd;
  } else {
    normalized.up_cmd = upCmd;
  }

  const downCmd = (normalized.down_cmd || "").trim();
  if (downCmd === "") {
    delete normalized.down_cmd;
  } else {
    normalized.down_cmd = downCmd;
  }

  if (
    typeof normalized.sensitivity !== "number"
    || Number.isNaN(normalized.sensitivity)
    || !Number.isFinite(normalized.sensitivity)
    || normalized.sensitivity <= 0
  ) {
    delete normalized.sensitivity;
  }

  if (
    typeof normalized.window_ms !== "number"
    || Number.isNaN(normalized.window_ms)
    || !Number.isFinite(normalized.window_ms)
    || normalized.window_ms <= 0
  ) {
    delete normalized.window_ms;
  } else {
    normalized.window_ms = Math.round(normalized.window_ms);
  }

  if (Object.keys(normalized).length === 0) {
    return undefined;
  }

  return normalized;
}

export default function TrimWheelConfiguration(props: TrimWheelConfigurationProps) {
  const trimWheels = (props.trimWheels as TrimWheelsEntry | undefined) || {};

  const effectiveUpCommand = (trimWheels.up_cmd || "").trim() || DEFAULT_UP_COMMAND;
  const effectiveDownCommand = (trimWheels.down_cmd || "").trim() || DEFAULT_DOWN_COMMAND;
  const effectiveSensitivity = typeof trimWheels.sensitivity === "number" && trimWheels.sensitivity > 0
    ? trimWheels.sensitivity
    : DEFAULT_SENSITIVITY;
  const effectiveWindowMs = typeof trimWheels.window_ms === "number" && trimWheels.window_ms > 0
    ? trimWheels.window_ms
    : DEFAULT_WINDOW_MS;

  const updateField = (field: keyof TrimWheelsEntry, rawValue: string) => {
    if (!props.editable || !props.onTrimWheelsChange) {
      return;
    }

    const next: TrimWheelsEntry = {...trimWheels};

    if (field === "sensitivity") {
      const parsed = Number(rawValue);
      next.sensitivity = rawValue === "" || Number.isNaN(parsed) ? undefined : parsed;
    } else if (field === "window_ms") {
      const parsed = Number.parseInt(rawValue, 10);
      next.window_ms = rawValue === "" || Number.isNaN(parsed) ? undefined : parsed;
    } else {
      next[field] = rawValue;
    }

    props.onTrimWheelsChange(sanitizeTrimWheels(next));
  };

  return (
    <Box sx={{p: 1.25, overflowY: "auto", flex: 1}}>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 2.5,
          borderColor: "rgba(138, 170, 197, 0.34)",
          backgroundColor: "rgba(12, 22, 33, 0.72)",
          p: 1.4
        }}
      >
        <Stack spacing={1.2}>
          <Stack direction="row" spacing={1} sx={{flexWrap: "wrap", rowGap: 1}}>
            <Typography variant="h6" sx={{fontWeight: 700, color: "rgba(229, 244, 255, 0.96)"}}>
              Trim Wheel Behavior
            </Typography>
            <Chip
              label={`Sensitivity: ${effectiveSensitivity}`}
              size="small"
              sx={{
                color: "#d9f0ff",
                border: "1px solid rgba(152, 207, 247, 0.35)",
                backgroundColor: "rgba(29, 73, 108, 0.36)"
              }}
            />
            <Chip
              label={`Window: ${effectiveWindowMs} ms`}
              size="small"
              sx={{
                color: "#d9f0ff",
                border: "1px solid rgba(152, 207, 247, 0.35)",
                backgroundColor: "rgba(29, 73, 108, 0.36)"
              }}
            />
          </Stack>

          <Typography variant="body2" sx={{color: "rgba(199, 222, 241, 0.8)", textAlign: "left"}}>
            Configure the command pair and smoothing curve for the Bravo trim wheel. Leave any field blank to use the generic X-Plane trim defaults.
          </Typography>

          <TextField
            size="small"
            label="Trim Up Command"
            value={trimWheels.up_cmd || ""}
            onChange={(event) => updateField("up_cmd", event.target.value)}
            fullWidth
            disabled={!props.editable}
            helperText={`Default: ${DEFAULT_UP_COMMAND}`}
          />

          <TextField
            size="small"
            label="Trim Down Command"
            value={trimWheels.down_cmd || ""}
            onChange={(event) => updateField("down_cmd", event.target.value)}
            fullWidth
            disabled={!props.editable}
            helperText={`Default: ${DEFAULT_DOWN_COMMAND}`}
          />

          <Stack direction="row" spacing={1.2} sx={{flexWrap: "wrap"}}>
            <TextField
              size="small"
              label="Sensitivity"
              type="number"
              value={typeof trimWheels.sensitivity === "number" ? trimWheels.sensitivity : ""}
              onChange={(event) => updateField("sensitivity", event.target.value)}
              disabled={!props.editable}
              sx={{width: 180, ...NUMBER_FIELD_SX}}
              helperText={`Default: ${DEFAULT_SENSITIVITY}`}
            />
            <TextField
              size="small"
              label="Window (ms)"
              type="number"
              value={typeof trimWheels.window_ms === "number" ? trimWheels.window_ms : ""}
              onChange={(event) => updateField("window_ms", event.target.value)}
              disabled={!props.editable}
              sx={{width: 180, ...NUMBER_FIELD_SX}}
              helperText={`Default: ${DEFAULT_WINDOW_MS}`}
            />
          </Stack>

          <Typography variant="caption" sx={{textAlign: "left", color: "rgba(173, 204, 229, 0.75)"}}>
            Higher sensitivity keeps the trim command held a little longer when the wheel is turned quickly. Window defines how fast that smoothing decays back to the base hold time.
          </Typography>

          <Stack spacing={0.3}>
            <Typography variant="caption" sx={{textAlign: "left", color: "rgba(173, 204, 229, 0.75)"}}>
              Effective Up Command: {effectiveUpCommand}
            </Typography>
            <Typography variant="caption" sx={{textAlign: "left", color: "rgba(173, 204, 229, 0.75)"}}>
              Effective Down Command: {effectiveDownCommand}
            </Typography>
          </Stack>
        </Stack>
      </Card>
    </Box>
  );
}
