# Desktop Wrapper

This Electron wrapper loads the `WattmeterViewer` UI and provides native serial access through the `serialport` package. The renderer receives real OS port paths such as `/dev/ttyUSB0`, `/dev/ttyACM0`, and `COM5` through preload IPC methods.

## Development

```bash
npm install
npm start
```

## Packaging

```bash
npm run package:dir
npm run dist
```

The wrapper lists serial ports in the main process, prefers likely Arduino/USB-serial devices, and opens the selected path at the viewer baud rate.
