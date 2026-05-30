# Wattmeter Viewer

Electron viewer for the Arduino wattmeter sniffer.

## Requirements

- Arduino sketch streaming at `250000` baud
- Electron app runtime. From the `Wattmeter` directory:

```bash
npm start
```

The renderer uses Electron IPC and the native `serialport` package to list and open real OS serial ports such as `/dev/ttyUSB0`, `/dev/ttyACM0`, or `COM5`.

## Serial Format

The viewer reads primary measurements from lines like:

```text
DATA,A=0.123,V=12.34,W=1.52,ACTIVE=A|V|W,STALE=0
```

`A`, `V`, and `W` are treated as the source measurements.
`Ah`, `Wh`, `Vm`, `Wp`, and `Ap` are computed by the viewer from `A/V/W`.
Optional `DROP=...` is displayed when the Arduino reports dropped LCD events.
`ACTIVE=...` marks which source fields were visible on the current LCD page.
`STALE=1` means the Arduino has not seen LCD bus activity recently.

## Charts

The chart time frame is selectable in the app: all time, 1 min, 3 min, 5 min, 7 min, or 10 min.
The X-axis is local time and the Y-axis auto-scales to the selected unit's visible range.
Chart history is retained after disconnect until the page is refreshed or recording is started.

`Ah` and `Wh` can be displayed as hour, minute, or second based units. The app still stores and exports true `Ah` and `Wh`; the selector only changes the live display and charts.

## Recording

Recording saves CSV files with Excel-readable columns:

```text
timestamp_local,elapsed_ms,A,V,W,record_Ah,record_Wh,record_Vm,record_Wp,record_Ap,DROP,STALE,active_fields
```

The recording rate is selectable in the app. Recording samples the latest known reading at the selected rate.
The live dashboard shows session values since connect. The CSV values named `record_*` are computed only from the current recording session. Integration pauses while `STALE=1`.
Starting a recording clears the visible chart history so the charts begin again from the recording start.

## Theme

Use the theme button to switch between light and dark mode. The choice is saved in the browser.
