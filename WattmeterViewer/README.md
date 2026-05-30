# Wattmeter Viewer UI 📊

The core frontend dashboard of the Bayucaraka TD Wattmeter desktop suite. It is designed to be embedded in an **Electron** wrapper to render high-frequency real-time metrics, dynamic charts, integration statistics, and session data logging.

---

## ✨ Features

- **High-Frequency Dashboard**: Real-time display of core measurements: Voltage (`V`), Current (`A`), and Active Power (`W`).
- **Computed Telemetry**: Automatically integrates and computes advanced parameters over time:
  - Amp-hours (`Ah`) & Watt-hours (`Wh`) session accumulations.
  - Peak and minimum metrics: Maximum Voltage (`Vm`), Peak Power (`Wp`), and Peak Current (`Ap`).
- **Interactive Multi-Timeframe Charts**: Smooth time-series charts visualizing real-time metrics with adjustable time ranges (1 min, 3 min, 5 min, 7 min, 10 min, or all-time).
- **Session Data Recording**: Clean CSV output with custom recording rates (e.g. 1Hz, 5Hz, 10Hz) mapping local timestamps to millisecond-accurate offsets.
- **Dual Theme Support**: Beautiful dark mode (deep blues/greys) and clean light mode, with automatic state saving in the browser local storage.

---

## 📂 File Architecture

The frontend components inside `WattmeterViewer/src/` are split into decoupled modules:

- **[charts.js](file:///home/wistarabanyukayana/Documents/Bayucaraka/arduino-workspace/Wattmeter/WattmeterViewer/src/charts.js)**: Configures and draws real-time trends using Chart.js.
- **[config.js](file:///home/wistarabanyukayana/Documents/Bayucaraka/arduino-workspace/Wattmeter/WattmeterViewer/src/config.js)**: Manages persistence settings (e.g., active units, chart window, recording sample rate).
- **[format.js](file:///home/wistarabanyukayana/Documents/Bayucaraka/arduino-workspace/Wattmeter/WattmeterViewer/src/format.js)**: Multi-unit utility functions for localized numbers and times.
- **[main.js](file:///home/wistarabanyukayana/Documents/Bayucaraka/arduino-workspace/Wattmeter/WattmeterViewer/src/main.js)**: Entry script that hooks up all system modules on load.
- **[metrics.js](file:///home/wistarabanyukayana/Documents/Bayucaraka/arduino-workspace/Wattmeter/WattmeterViewer/src/metrics.js)**: Integrates energy measurements (Ah/Wh) over active session segments.
- **[parser.js](file:///home/wistarabanyukayana/Documents/Bayucaraka/arduino-workspace/Wattmeter/WattmeterViewer/src/parser.js)**: Robust string parser to ingest `DATA,...` packets from Serial.
- **[recording.js](file:///home/wistarabanyukayana/Documents/Bayucaraka/arduino-workspace/Wattmeter/WattmeterViewer/src/recording.js)**: Manages recording loops, memory buffer, and outputs downloadable Excel-compatible CSVs.
- **[serial.js](file:///home/wistarabanyukayana/Documents/Bayucaraka/arduino-workspace/Wattmeter/WattmeterViewer/src/serial.js)**: Ingests serial port telemetry streams utilizing Electron IPC bridges.
- **[state.js](file:///home/wistarabanyukayana/Documents/Bayucaraka/arduino-workspace/Wattmeter/WattmeterViewer/src/state.js)**: Internal centralized state controller.
- **[ui.js](file:///home/wistarabanyukayana/Documents/Bayucaraka/arduino-workspace/Wattmeter/WattmeterViewer/src/ui.js)**: Injects state variables into the DOM and manages UI events.

---

## 📈 Charts & Dynamic Unit Modes

- The X-axis presents real-time local timestamps, and the Y-axis automatically scales to focus on active fluctuations.
- The unit selectors allow you to display session data scaled to **second, minute, or hourly** intervals (e.g., displaying `W-sec`, `W-min`, or `Wh`). The application retains true standardized metric scales in the background and only recalculates formatting for live presentation.

---

## 💾 CSV Log Structure

When recording session data, the downloaded CSV contains the following columns:

```csv
timestamp_local,elapsed_ms,A,V,W,record_Ah,record_Wh,record_Vm,record_Wp,record_Ap,DROP,STALE,active_fields
```

- **`elapsed_ms`**: Running session timer in milliseconds since recording started.
- **`record_*`**: Session-isolated integrations starting from the exact second recording is clicked.
- **`DROP`**: Direct indicator from the Arduino sniffer alerting of dropped LCD bus transactions.
- **`STALE`**: Signals whether the sniffer has lost communication with the host hardware LCD bus.
