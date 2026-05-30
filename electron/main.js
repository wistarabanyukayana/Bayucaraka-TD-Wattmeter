const path = require("node:path");
const fs = require("node:fs");
const { fileURLToPath } = require("node:url");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { SerialPort } = require("serialport");

const VIEWER_ENTRY_PATH = path.join(__dirname, "..", "WattmeterViewer", "index.html");
const TRUSTED_VIEWER_PATH = normalizePathForComparison(VIEWER_ENTRY_PATH);
const ALLOWED_EXTERNAL_PROTOCOLS = new Set([
  "http:",
  "https:",
]);

const ARDUINO_VENDOR_IDS = new Set([
  "2341",
  "2a03",
  "1a86",
  "10c4",
  "0403",
]);

const USB_SERIAL_NAME_PATTERNS = [
  /ttyusb/i,
  /ttyacm/i,
  /cu\.usb/i,
  /tty\.usb/i,
  /com\d+/i,
  /arduino/i,
  /ch340/i,
  /ch341/i,
  /cp210/i,
  /ftdi/i,
];

const BUILT_IN_SERIAL_PATH_PATTERNS = [
  /^\/dev\/ttyS\d+$/i,
  /^COM[12]$/i,
];

const BLUETOOTH_NAME_PATTERNS = [
  /bthenum/i,
  /bthmodem/i,
  /bluetooth/i,
  /bluez/i,
  /rfcomm/i,
  /dev_[0-9a-f]{2}_[0-9a-f]{2}_[0-9a-f]{2}_[0-9a-f]{2}_[0-9a-f]{2}_[0-9a-f]{2}/i,
];

let mainWindow = null;
let activeSerialPort = null;
let pendingSerialPort = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 860,
    minHeight: 620,
    title: "Wattmeter Viewer",
    backgroundColor: "#f6f7f9",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
    },
  });

  mainWindow = win;
  win.setMenuBarVisibility(false);

  win.webContents.on("will-navigate", (event, url) => {
    if (isTrustedViewerUrl(url)) {
      return;
    }

    event.preventDefault();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url).catch(() => {});
    }

    return { action: "deny" };
  });

  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }

    closeCurrentSerialConnection().catch(() => {});
  });

  win.loadFile(VIEWER_ENTRY_PATH);

  return win;
}

function normalizePathForComparison(value) {
  const normalizedPath = path.resolve(value);
  return process.platform === "win32" ? normalizedPath.toLowerCase() : normalizedPath;
}

function isTrustedViewerUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "file:") {
      return false;
    }

    return normalizePathForComparison(fileURLToPath(parsedUrl)) === TRUSTED_VIEWER_PATH;
  } catch {
    return false;
  }
}

function isAllowedExternalUrl(url) {
  try {
    return ALLOWED_EXTERNAL_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

function getIpcSenderUrl(event) {
  if (event.senderFrame && event.senderFrame.url) {
    return event.senderFrame.url;
  }

  if (event.sender && typeof event.sender.getURL === "function") {
    return event.sender.getURL();
  }

  return "";
}

function requireTrustedIpcSender(event) {
  if (!isTrustedViewerUrl(getIpcSenderUrl(event))) {
    throw new Error("Blocked IPC from untrusted sender");
  }
}

function isBluetoothLikePort(port) {
  return BLUETOOTH_NAME_PATTERNS.some((pattern) => pattern.test(serialPortText(port)));
}

function serialPortText(port) {
  return [
    port.path,
    port.portName,
    port.displayName,
    port.manufacturer,
    port.friendlyName,
    port.deviceInstanceId,
    port.portId,
    port.pnpId,
    port.pnpID,
    normalizeHex(port.vendorId),
    normalizeHex(port.productId),
  ].filter(Boolean).join(" ");
}

function serialPortMetadata(port) {
  const vendorId = normalizeHex(port.vendorId || port.vendorID);
  const productId = normalizeHex(port.productId || port.productID);
  const serialNumber = port.serialNumber || "";
  const deviceInstanceId = port.deviceInstanceId || "";
  const fingerprint = [
    port.path,
    vendorId,
    productId,
    serialNumber,
    deviceInstanceId,
  ].filter(Boolean).join(":");

  return {
    fingerprint,
    path: port.path || port.portName || "",
    displayName: port.displayName || port.friendlyName || port.path || "",
    manufacturer: port.manufacturer || "",
    vendorId,
    productId,
    serialNumber,
    pnpId: port.pnpId || port.pnpID || "",
    locationId: port.locationId || "",
    isLikelyUsbSerial: isLikelyUsbSerialPort(port),
    isActiveExternalPort: isActiveExternalPort(port),
    isBluetoothLike: isBluetoothLikePort(port),
  };
}

function isLikelyUsbSerialPort(port) {
  const vendorId = normalizeHex(port.vendorId || port.vendorID);
  if (vendorId && ARDUINO_VENDOR_IDS.has(vendorId)) {
    return true;
  }

  return USB_SERIAL_NAME_PATTERNS.some((pattern) => pattern.test(serialPortText(port)));
}

function isActiveExternalPort(port) {
  if (!port || isBluetoothLikePort(port)) {
    return false;
  }

  const portPath = port.path || "";
  if (BUILT_IN_SERIAL_PATH_PATTERNS.some((pattern) => pattern.test(portPath))) {
    return false;
  }

  if (isLikelyUsbSerialPort(port)) {
    return true;
  }

  return Boolean(
    port.vendorId
      || port.vendorID
      || port.productId
      || port.productID
      || port.serialNumber
      || port.manufacturer
      || port.pnpId
      || port.pnpID
      || port.locationId
  );
}

function normalizeHex(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "number") {
    return value.toString(16).padStart(4, "0").toLowerCase();
  }

  return String(value).replace(/^0x/i, "").padStart(4, "0").toLowerCase();
}

function sortSerialPorts(left, right) {
  if (left.isBluetoothLike !== right.isBluetoothLike) {
    return left.isBluetoothLike ? 1 : -1;
  }

  if (left.isLikelyUsbSerial !== right.isLikelyUsbSerial) {
    return left.isLikelyUsbSerial ? -1 : 1;
  }

  return left.path.localeCompare(right.path, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sendSerialStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("serial-status", status);
  }
}

function sendSerialData(chunk) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("serial-data", chunk);
  }
}

async function closeActiveSerialPort() {
  const port = activeSerialPort;
  activeSerialPort = null;

  if (!port) {
    return;
  }

  await new Promise((resolve) => {
    if (!port.isOpen) {
      resolve();
      return;
    }

    port.close(() => resolve());
  });
}

async function closeCurrentSerialConnection() {
  const port = pendingSerialPort;
  pendingSerialPort = null;

  if (port && port !== activeSerialPort) {
    closeUntrackedSerialPort(port);
  }

  await closeActiveSerialPort();
}

function clearPendingSerialPort(port) {
  if (pendingSerialPort === port) {
    pendingSerialPort = null;
  }
}

function closeUntrackedSerialPort(port) {
  if (!port) {
    return;
  }

  if (activeSerialPort === port) {
    activeSerialPort = null;
  }

  port.removeAllListeners("data");
  port.removeAllListeners("close");
  port.removeAllListeners("error");
  port.on("error", () => {});

  try {
    if (port.isOpen) {
      port.close(() => {});
      return;
    }

    port.destroy();
  } catch {
    // The port is already closing or failed before it could be opened.
  }
}

function getDriverFolderPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "drivers", "CH340");
  }

  return path.join(__dirname, "..", "drivers", "CH340");
}

ipcMain.handle("open-driver-folder", async (event) => {
  requireTrustedIpcSender(event);

  const driverFolderPath = getDriverFolderPath();
  if (!fs.existsSync(driverFolderPath)) {
    return {
      ok: false,
      error: `missing ${driverFolderPath}`,
    };
  }

  const error = await shell.openPath(driverFolderPath);
  return {
    ok: error === "",
    error,
  };
});

ipcMain.handle("list-serial-ports", async (event) => {
  requireTrustedIpcSender(event);

  const ports = await SerialPort.list();
  return ports
    .map(serialPortMetadata)
    .filter((port) => port.isActiveExternalPort)
    .sort(sortSerialPorts);
});

ipcMain.handle("open-serial-port", async (event, options) => {
  requireTrustedIpcSender(event);

  const portPath = options && options.path;
  const baudRate = Number(options && options.baudRate);
  if (!portPath || !Number.isFinite(baudRate)) {
    return {
      ok: false,
      error: "missing serial port path or baud rate",
    };
  }

  await closeCurrentSerialConnection();

  return new Promise((resolve) => {
    const port = new SerialPort({
      path: portPath,
      baudRate,
      autoOpen: false,
    });

    pendingSerialPort = port;

    let settled = false;
    const openTimeout = setTimeout(() => {
      if (settle({
        ok: false,
        error: "serial port open timed out",
      })) {
        clearPendingSerialPort(port);
        closeUntrackedSerialPort(port);
      }
    }, 5000);

    function settle(result) {
      if (settled) {
        return false;
      }

      settled = true;
      clearTimeout(openTimeout);
      resolve(result);
      return true;
    }

    port.on("data", (data) => {
      sendSerialData(data.toString("utf8"));
    });

    port.on("error", (error) => {
      sendSerialStatus({
        type: "error",
        path: portPath,
        error: error.message || String(error),
      });
    });

    port.on("close", () => {
      if (activeSerialPort === port) {
        activeSerialPort = null;
      }

      sendSerialStatus({
        type: "closed",
        path: portPath,
      });
    });

    port.open((error) => {
      if (settled) {
        clearPendingSerialPort(port);
        if (!error) {
          closeUntrackedSerialPort(port);
        }
        return;
      }

      if (pendingSerialPort !== port) {
        if (!error) {
          closeUntrackedSerialPort(port);
        }

        settle({
          ok: false,
          error: "serial port open was canceled",
        });
        return;
      }

      clearPendingSerialPort(port);

      if (error) {
        settle({
          ok: false,
          error: error.message || String(error),
        });
        return;
      }

      activeSerialPort = port;
      settle({
        ok: true,
      });
    });
  });
});

ipcMain.handle("close-serial-port", async (event) => {
  requireTrustedIpcSender(event);

  await closeCurrentSerialConnection();
  return {
    ok: true,
  };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  closeCurrentSerialConnection().catch(() => {});
});
