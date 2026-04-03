import {Typography} from '@mui/material';
import * as React from 'react';
import {useEffect} from 'react';
import {getXplaneDataref} from "../api";

interface ListProps {
  dataref: string;
  index: number;
}

export default function DatarefValue(props: ListProps) {
  const [value, setValue] = React.useState<string | number>("--");

  useEffect(() => {
    const refresh = () => {
      getXplaneDataref(props.dataref)
        .then((res) => {
          if (res == null) {
            setValue("--");
            return;
          }

          if (Array.isArray(res)) {
            const next = res[props.index];
            setValue(next ?? "--");
            return;
          }

          if (typeof res === "number") {
            setValue(res);
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
