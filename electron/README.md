# Electron Desktop Wrapper 🖥️

A lightweight, secure desktop wrapper that embeds the `WattmeterViewer` frontend and exposes high-performance OS-level serial communication through the native Node `serialport` module.

---

## ⚙️ How It Works

Because the standard Web Serial API can be restricted by browser versions or sandbox configurations, the desktop app uses a local native implementation:

1. **Main Process (`main.js`)**: Manages the application lifecycle, registers OS-level serial event handlers, and listens for command lines. It lists real serial device paths (e.g. `COM5` on Windows or `/dev/ttyUSB0` / `/dev/ttyACM0` on Linux).
2. **Preload Script (`preload.js`)**: Acts as a secure IPC (Inter-Process Communication) bridge. It exposes a minimal, safe API to the renderer process (the frontend) via `contextBridge.exposeInMainWorld`, ensuring the frontend has no direct access to Node's internal `process` or `require` functions (following security best practices).
3. **Serial Port Multiplexer**: The desktop wrapper automatically detects and filters devices, highlighting likely Arduino/USB-serial devices, and establishes high-speed channels operating at **250000 baud**.

---

## 🚀 Development Quick Start

Run these commands from the **root directory**:

```bash
# Install node packages
pnpm install

# Launch the Electron app in development mode
pnpm start
```

---

## 📦 Compiling and Distribution

The app uses `electron-builder` to package native executables. You can package directories for testing or generate full setup installers:

```bash
# Package into executable directory (no installer)
pnpm run package:dir

# Package as standard distribution installers
pnpm run dist
```

### Supported Targets
- **Linux**: Generates a zero-install **AppImage** utility.
- **Windows**: Generates an **NSIS Installer** executable.
- **macOS**: Configured for **DMG** packaging.
