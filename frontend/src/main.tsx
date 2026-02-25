import React from 'react'
import {createRoot} from 'react-dom/client'
import {createTheme, CssBaseline, ThemeProvider} from "@mui/material";

import './style.css'
import App from './App'

const container = document.getElementById('root')

const root = createRoot(container!)

const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#081320",
      paper: "#0e1b2a",
    },
    text: {
      primary: "#eaf3ff",
      secondary: "rgba(215, 229, 245, 0.76)",
    }
  },
  typography: {
    fontFamily: '"Nunito", "Avenir Next", "Trebuchet MS", sans-serif'
  }
});

root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline/>
      <App/>
    </ThemeProvider>
  </React.StrictMode>
)
