import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import {Button, Chip, Stack, TextField} from "@mui/material";
import type { Metadata } from "../types";

interface ListProps {
  metadata?: Metadata;
  filePath?: string;
  source?: string;
  editable?: boolean;
  onMetadataChange?: (metadata: Metadata) => void;
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

export default function Metadata(props: ListProps) {
  const selectors = props.metadata?.selectors || [];
  const isUserProfile = props.source === "user";
  const [isEditing, setIsEditing] = React.useState(false);
  const [selectorsInput, setSelectorsInput] = React.useState(selectors.join("\n"));

  React.useEffect(() => {
    setSelectorsInput(selectors.join("\n"));
  }, [selectors]);

  React.useEffect(() => {
    if (!props.editable) {
      setIsEditing(false);
    }
  }, [props.editable]);

  const handleMetadataChange = (field: keyof Metadata, value: string | string[]) => {
    props.onMetadataChange?.({
      ...(props.metadata || {}),
      [field]: value
    } as Metadata);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        borderColor: "rgba(151, 173, 196, 0.35)",
        background: "linear-gradient(135deg, rgba(16, 30, 44, 0.9), rgba(14, 22, 34, 0.82))",
        boxShadow: "0 16px 30px rgba(0, 0, 0, 0.28)"
      }}
    >
      <CardContent sx={{px: 2.5, py: 2.25}}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="overline" sx={{letterSpacing: "0.14em", color: "rgba(187, 220, 248, 0.8)"}}>
              Active Profile
            </Typography>
            <Chip
              label={isUserProfile ? "User Profile" : "Default Profile"}
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
          </Stack>
          {props.editable && (
            <Button
              size="small"
              variant={isEditing ? "contained" : "outlined"}
              onClick={() => setIsEditing((current) => !current)}
            >
              {isEditing ? "Done" : "Edit"}
            </Button>
          )}
        </Stack>

        {!isEditing ? (
          <>
            <Typography
              variant="h4"
              component="div"
              sx={{fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", color: "rgba(242, 248, 255, 0.96)"}}
            >
              {props.metadata?.name || "No profile selected"}
            </Typography>
            <Typography gutterBottom sx={{color: "rgba(215, 231, 248, 0.76)", fontSize: 15, mt: 0.8}}>
              {props.metadata?.description || "Select a profile from the list to inspect its lighting datarefs."}
            </Typography>
          </>
        ) : (
          <Stack spacing={1.25} sx={{mt: 1.5}}>
            <TextField
              label="Profile display name"
              value={props.metadata?.name || ""}
              onChange={(event) => handleMetadataChange("name", event.target.value)}
              placeholder="Toliss A320"
              fullWidth
            />
            <TextField
              label="Description"
              value={props.metadata?.description || ""}
              onChange={(event) => handleMetadataChange("description", event.target.value)}
              placeholder="Profile for Toliss A320"
              fullWidth
            />
            <TextField
              label="Selectors"
              value={selectorsInput}
              onChange={(event) => {
                const nextValue = event.target.value;
                setSelectorsInput(nextValue);
                handleMetadataChange("selectors", parseSelectorsInput(nextValue));
              }}
              placeholder={"ToLiss Airbus A320 Neo\nToLiss Airbus A320 Std"}
              helperText="Use the exact X-Plane aircraft UI names. Enter one per line or separate with commas."
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        )}

        <Stack spacing={0.35} sx={{mt: 1.25}}>
          <Typography variant="caption" sx={{textAlign: "left", color: "rgba(180, 207, 232, 0.74)", letterSpacing: "0.06em"}}>
            YAML Path
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
              color: "rgba(223, 239, 255, 0.9)",
              wordBreak: "break-all",
              lineHeight: 1.35
            }}
          >
            {props.filePath || "--"}
          </Typography>
        </Stack>

        {selectors.length > 0 ? (
          <Stack direction="row" spacing={1} sx={{mt: 1.5, flexWrap: "wrap", rowGap: 1}}>
            {selectors.map((selector, index) => (
              <Chip
                key={`${selector}-${index}`}
                label={selector}
                size="small"
                sx={{
                  color: "#d4eef8",
                  border: "1px solid rgba(163, 223, 255, 0.34)",
                  backgroundColor: "rgba(50, 108, 152, 0.22)"
                }}
              />
            ))}
          </Stack>
        ) : isEditing ? (
          <Typography variant="caption" sx={{display: "block", mt: 1.5, color: "rgba(180, 207, 232, 0.74)"}}>
            No selectors configured yet. Profiles match aircraft by exact selector names.
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}
