import {Typography} from '@mui/material';
import * as React from 'react';
import {useEffect} from 'react';
import {GetXplaneDataref} from "../../wailsjs/go/main/App";

interface ListProps {
  dataref: string;
  index: number;
}

export default function DatarefValue(props: ListProps) {
  const [value, setValue] = React.useState<string | number>("--");

  useEffect(() => {
    const refresh = () => {
      GetXplaneDataref(props.dataref)
        .then((res) => {
          if (!res) {
            setValue("--");
            return;
          }

          let obj: { data?: number | number[] };
          try {
            obj = JSON.parse(res);
          } catch {
            setValue("--");
            return;
          }

          if (Array.isArray(obj.data)) {
            const next = obj.data[props.index];
            setValue(next ?? "--");
            return;
          }

          if (typeof obj.data === "number") {
            setValue(obj.data);
            return;
          }

          setValue("--");
        })
        .catch(() => {
          setValue("--");
        });
    };

    refresh();
    const interval = setInterval(() => {
      refresh();
    }, 1000);

    return () => clearInterval(interval);
  }, [props.dataref, props.index]);

  return (
    <Typography
      variant="body2"
      sx={{
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.02em",
        color: value === "--" ? "rgba(201, 219, 236, 0.72)" : "#8cf5f0"
      }}
    >
      {value}
    </Typography>

  );
}
