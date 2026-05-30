const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wattmeterDesktop", {
  openDriverFolder: () => ipcRenderer.invoke("open-driver-folder"),
  listSerialPorts: () => ipcRenderer.invoke("list-serial-ports"),
  openSerialPort: (options) => ipcRenderer.invoke("open-serial-port", options),
  closeSerialPort: () => ipcRenderer.invoke("close-serial-port"),
  onSerialData: (callback) => {
    const listener = (_event, chunk) => callback(chunk);
    ipcRenderer.on("serial-data", listener);
    return () => ipcRenderer.removeListener("serial-data", listener);
  },
  onSerialStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("serial-status", listener);
    return () => ipcRenderer.removeListener("serial-status", listener);
  },
});
