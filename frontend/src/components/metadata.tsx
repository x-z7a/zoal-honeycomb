import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import {Chip, Stack} from "@mui/material";
import {pkg} from "../../wailsjs/go/models";

interface ListProps {
  metadata?: pkg.Metadata;
  filePath?: string;
}

export default function Metadata(props: ListProps) {
  const selectors = props.metadata?.selectors || [];

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
        <Typography variant="overline" sx={{letterSpacing: "0.14em", color: "rgba(187, 220, 248, 0.8)"}}>
          Active Profile
        </Typography>
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

        {selectors.length > 0 && (
          <Stack direction="row" spacing={1} sx={{mt: 1.5, flexWrap: "wrap", rowGap: 1}}>
            {selectors.slice(0, 8).map((selector, index) => (
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
        )}
      </CardContent>
    </Card>
  );
}
