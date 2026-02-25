import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import {useEffect} from 'react';
import {GetXplane} from "../../wailsjs/go/main/App";
import {Chip, Divider, Stack} from "@mui/material";

interface DatarefValueResponse {
  data?: string;
}

function decodeDatarefText(raw: string | undefined): string {
  if (!raw) {
    return "";
  }

  try {
    const parsed = JSON.parse(raw) as DatarefValueResponse;
    if (!parsed?.data) {
      return "";
    }
    return atob(parsed.data);
  } catch {
    return "";
  }
}

export default function Xplane() {
  const [icao, setIcao] = React.useState("");
  const [name, setName] = React.useState("");

  useEffect(() => {
    const refresh = () => {
      GetXplane()
        .then((res) => {
          const values = res || [];
          setIcao(decodeDatarefText(values[0]));
          setName(decodeDatarefText(values[1]));
        })
        .catch(() => {
          setIcao("");
          setName("");
        });
    };

    refresh();
    const interval = setInterval(() => {
      refresh();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const connected = icao !== "" || name !== "";

  return (
    <Card
      variant="outlined"
      sx={{
        margin: 0,
        borderRadius: 2.5,
        borderColor: "rgba(151, 173, 196, 0.35)",
        background: "linear-gradient(170deg, rgba(8, 17, 27, 0.92), rgba(13, 23, 35, 0.88))",
        boxShadow: "0 12px 24px rgba(0,0,0,0.28)"
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" sx={{fontWeight: 700, color: "rgba(237, 246, 255, 0.96)"}}>
            Current Plane
          </Typography>
          <Chip
            size="small"
            label={connected ? "Connected" : "Offline"}
            sx={{
              color: connected ? "#cafcd7" : "#f4d4d4",
              border: connected ? "1px solid rgba(99, 210, 126, 0.36)" : "1px solid rgba(244, 108, 108, 0.36)",
              backgroundColor: connected ? "rgba(99, 210, 126, 0.15)" : "rgba(244, 108, 108, 0.12)"
            }}
          />
        </Stack>

        <Divider sx={{margin: "10px 0", borderColor: "rgba(159, 182, 204, 0.2)"}}/>
        {connected ? (
          <Stack spacing={0.25} sx={{textAlign: "left"}}>
            <Typography variant="body2" sx={{fontSize: 14, color: "rgba(221, 236, 249, 0.7)"}}>
              ICAO
            </Typography>
            <Typography variant="subtitle1" sx={{fontWeight: 700, color: "rgba(243, 249, 254, 0.95)"}}>
              {icao}
            </Typography>
            <Typography variant="body2" sx={{fontSize: 14, color: "rgba(221, 236, 249, 0.7)", mt: 0.8}}>
              Aircraft
            </Typography>
            <Typography variant="subtitle2" sx={{fontSize: 15, color: "rgba(243, 249, 254, 0.95)"}}>
              {name}
            </Typography>
          </Stack>
        ) : (
          <Typography variant="body2" sx={{fontSize: 14, color: "rgba(209, 224, 239, 0.75)"}}>
            X-Plane not connected
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
