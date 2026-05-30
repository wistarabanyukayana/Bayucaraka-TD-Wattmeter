import { BAUD_RATE, LAST_PORT_STORAGE_KEY } from "./config.js";
import { resetLiveMetricState, resetRecordMetricState } from "./state.js";

export function createSerialController(deps) {
  const {
    state,
    els,
    consumeSerialText,
    describeError,
    getSerialSupport,
    requestChartRender,
    setConnectedUi,
    setDiagnostics,
    stopRecording,
  } = deps;

  bindDesktopSerialEvents();

  function bindDesktopSerialEvents() {
    const desktop = window.wattmeterDesktop;
    if (!desktop || typeof desktop.onSerialData !== "function") {
      return;
    }

    desktop.onSerialData((chunk) => {
      if (typeof chunk === "string") {
        consumeSerialText(chunk);
      }
    });

    if (typeof desktop.onSerialStatus === "function") {
      desktop.onSerialStatus((status) => {
        handleSerialStatus(status);
      });
    }
  }

  function handleSerialStatus(status) {
    if (!status || !state.port || status.path !== state.port.path) {
      return;
    }

    if (status.type === "error") {
      setDiagnostics(`serial error on ${state.port.path} - ${status.error || "unknown error"}`, "error");
      return;
    }

    if (status.type === "closed") {
      const closedPath = state.port.path;
      clearConnectionState();
      setConnectedUi(false);
      setDiagnostics(`serial port closed - ${closedPath}`);
    }
  }

  function readLastSuccessfulPortInfo() {
    try {
      const raw = window.localStorage.getItem(LAST_PORT_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      if (typeof parsed.path !== "string" && typeof parsed.fingerprint !== "string") {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  function writeLastSuccessfulPortInfo(port) {
    if (!port) {
      return;
    }

    try {
      window.localStorage.setItem(LAST_PORT_STORAGE_KEY, JSON.stringify({
        path: port.path || "",
        fingerprint: port.fingerprint || "",
        vendorId: port.vendorId || "",
        productId: port.productId || "",
        serialNumber: port.serialNumber || "",
      }));
    } catch {
      // Ignore storage failures.
    }
  }

  function isSamePortInfo(leftInfo, rightInfo) {
    if (!leftInfo || !rightInfo) {
      return false;
    }

    if (leftInfo.fingerprint && rightInfo.fingerprint) {
      return leftInfo.fingerprint === rightInfo.fingerprint;
    }

    if (leftInfo.path && rightInfo.path) {
      return leftInfo.path === rightInfo.path;
    }

    const hasStableDetails = Boolean(
      leftInfo.vendorId
        || leftInfo.productId
        || leftInfo.serialNumber
        || rightInfo.vendorId
        || rightInfo.productId
        || rightInfo.serialNumber
    );
    if (!hasStableDetails) {
      return false;
    }

    return leftInfo.vendorId === rightInfo.vendorId
      && leftInfo.productId === rightInfo.productId
      && leftInfo.serialNumber === rightInfo.serialNumber;
  }

  function getPortIdentity(port) {
    if (!port) {
      return "";
    }

    if (port.fingerprint) {
      return `fingerprint:${port.fingerprint}`;
    }

    if (port.path) {
      return `path:${port.path}`;
    }

    const details = [
      port.vendorId || "",
      port.productId || "",
      port.serialNumber || "",
    ];

    return details.some(Boolean) ? `details:${details.join(":")}` : "";
  }

  function findPortIdentityIndex(ports, identity) {
    if (!identity || !Array.isArray(ports)) {
      return -1;
    }

    return ports.findIndex((port) => getPortIdentity(port) === identity);
  }

  function rememberSelectedGrantedPort(port) {
    const identity = getPortIdentity(port);
    if (identity) {
      state.selectedGrantedPortIdentity = identity;
    }
  }

  function pickSelectedGrantedPortIndex(ports) {
    if (state.selectedGrantedPortIdentity) {
      return findPortIdentityIndex(ports, state.selectedGrantedPortIdentity);
    }

    return pickPreferredGrantedPortIndex(ports);
  }

  function syncPortControlState() {
    const support = getSerialSupport();
    els.connectBtn.disabled = Boolean(state.port)
      || state.connectionOpenPending
      || state.selectedGrantedPortIndex < 0
      || !support.ok;
    els.disconnectBtn.disabled = !state.port && !state.connectionOpenPending;
    els.refreshPortsBtn.disabled = !support.ok;
  }

  function beginConnectionAttempt() {
    state.connectionAttemptId += 1;
    state.connectionOpenPending = true;
    setConnectedUi(false);
    return state.connectionAttemptId;
  }

  function isCurrentConnectionAttempt(attemptId) {
    return state.connectionAttemptId === attemptId;
  }

  function cancelConnectionAttempts() {
    state.connectionAttemptId += 1;
    state.connectionOpenPending = false;
  }

  function formatPortOptionLabel(port, index) {
    if (!port) {
      return `Port ${index + 1}`;
    }

    const primary = port.path || port.displayName || `Port ${index + 1}`;
    const details = [];

    if (port.displayName && port.displayName !== primary) {
      details.push(port.displayName);
    }

    if (port.manufacturer) {
      details.push(port.manufacturer);
    }

    const ids = [];
    if (port.vendorId) {
      ids.push(`VID 0x${port.vendorId}`);
    }
    if (port.productId) {
      ids.push(`PID 0x${port.productId}`);
    }
    if (ids.length > 0) {
      details.push(ids.join(" "));
    }

    if (port.serialNumber) {
      details.push(`SN ${port.serialNumber}`);
    }

    return [primary, ...details].join(" | ");
  }

  function pickPreferredGrantedPortIndex(ports) {
    const rememberedIndex = findRememberedGrantedPortIndex(ports);
    if (rememberedIndex >= 0) {
      return rememberedIndex;
    }

    const likelyUsbIndex = ports.findIndex((port) => port.isLikelyUsbSerial && !port.isBluetoothLike);
    if (likelyUsbIndex >= 0) {
      return likelyUsbIndex;
    }

    return Array.isArray(ports) && ports.length > 0 ? 0 : -1;
  }

  function findRememberedGrantedPortIndex(ports) {
    if (!Array.isArray(ports) || ports.length === 0) {
      return -1;
    }

    const lastPortInfo = readLastSuccessfulPortInfo();
    if (!lastPortInfo) {
      return -1;
    }

    return ports.findIndex((port) => isSamePortInfo(port, lastPortInfo));
  }

  function populateGrantedPortSelect() {
    const ports = state.grantedPorts;
    els.portSelect.innerHTML = "";

    if (ports.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No active serial port";
      els.portSelect.appendChild(option);
      els.portSelect.disabled = true;
      state.selectedGrantedPortIndex = -1;
      syncPortControlState();
      return;
    }

    const selectedIndex = pickSelectedGrantedPortIndex(ports);

    state.selectedGrantedPortIndex = selectedIndex;
    els.portSelect.disabled = false;

    if (selectedIndex >= 0) {
      rememberSelectedGrantedPort(ports[selectedIndex]);
    } else {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = state.selectedGrantedPortIdentity
        ? "Selected port not found"
        : "Select a serial port";
      option.selected = true;
      els.portSelect.appendChild(option);
    }

    ports.forEach((port, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = formatPortOptionLabel(port, index);
      option.selected = index === selectedIndex;
      els.portSelect.appendChild(option);
    });

    syncPortControlState();
  }

  async function refreshGrantedPorts() {
    rememberSelectedGrantedPort(getSelectedGrantedPort());

    const support = getSerialSupport();
    if (!support.ok) {
      state.grantedPorts = [];
      state.grantedPortLabels = [];
      populateGrantedPortSelect();
      return [];
    }

    const ports = await window.wattmeterDesktop.listSerialPorts();
    state.grantedPorts = Array.isArray(ports) ? ports : [];
    state.grantedPortLabels = [];
    populateGrantedPortSelect();
    return state.grantedPorts;
  }

  function selectGrantedPortIndex(index) {
    state.selectedGrantedPortIndex = Number.isInteger(index) ? index : -1;
    rememberSelectedGrantedPort(getSelectedGrantedPort());
    syncPortControlState();
  }

  function getSelectedGrantedPort() {
    if (state.selectedGrantedPortIndex < 0) {
      return null;
    }

    return state.grantedPorts[state.selectedGrantedPortIndex] || null;
  }

  function describePort(port) {
    if (!port) {
      return "selected serial port";
    }

    return formatPortOptionLabel(port, state.grantedPorts.indexOf(port));
  }

  async function connectWithPort(port) {
    if (state.connectionOpenPending) {
      setDiagnostics("connection already in progress");
      return;
    }

    if (state.port) {
      await disconnect();
    }

    const attemptId = beginConnectionAttempt();

    try {
      setDiagnostics(`opening ${describePort(port)} at ${BAUD_RATE} baud`);
      const result = await window.wattmeterDesktop.openSerialPort({
        path: port.path,
        baudRate: BAUD_RATE,
      });

      if (!isCurrentConnectionAttempt(attemptId)) {
        return;
      }

      if (!result || !result.ok) {
        throw new Error(result && result.error ? result.error : "serial open failed");
      }

      state.connectionOpenPending = false;
      state.port = port;
      resetLiveMetricState(state);
      resetRecordMetricState(state);
      state.readLoopActive = true;
      setConnectedUi(true);
      writeLastSuccessfulPortInfo(port);
      setDiagnostics(`connected to ${describePort(port)}`, "ok");
    } catch (error) {
      if (!isCurrentConnectionAttempt(attemptId)) {
        return;
      }

      state.connectionOpenPending = false;
      state.port = null;
      setConnectedUi(false);
      setDiagnostics(`connection failed - ${describeError(error)}`, "error");
      throw error;
    }
  }

  async function requestConnect() {
    if (!getSerialSupport().ok) {
      setDiagnostics(getSerialSupport().message, "error");
      return;
    }

    if (state.connectionOpenPending) {
      setDiagnostics("connection already in progress");
      return;
    }

    try {
      if (state.grantedPorts.length === 0) {
        await refreshGrantedPorts();
      }

      const port = getSelectedGrantedPort();
      if (!port) {
        setDiagnostics("no active serial port selected", "error");
        return;
      }

      await connectWithPort(port);
    } catch (error) {
      console.error(error);
      els.connectionState.textContent = "Connection failed";
      setDiagnostics(`connection failed - ${describeError(error)}`, "error");
    }
  }

  async function autoConnectGrantedPort() {
    const support = getSerialSupport();
    els.supportStatus.textContent = support.message;
    setDiagnostics(support.message, support.ok ? "ok" : "error");

    if (state.port || state.connectionOpenPending) {
      return;
    }

    if (!support.ok) {
      els.connectBtn.disabled = true;
      return;
    }

    const ports = await refreshGrantedPorts();
    if (ports.length === 0) {
      setDiagnostics("no active serial ports found - connect the wattmeter and refresh", "error");
      return;
    }

    const rememberedIndex = findRememberedGrantedPortIndex(ports);
    const likelyPorts = ports.filter((port) => port.isLikelyUsbSerial && !port.isBluetoothLike);
    if (rememberedIndex >= 0 || ports.length === 1 || likelyPorts.length === 1) {
      const preferredPort = rememberedIndex >= 0
        ? ports[rememberedIndex]
        : likelyPorts[0] || ports[0];
      selectGrantedPortIndex(ports.indexOf(preferredPort));
      populateGrantedPortSelect();
      await connectWithPort(preferredPort).catch((error) => {
        console.error(error);
        setDiagnostics(`auto-connect failed - ${describeError(error)}`, "error");
      });
      return;
    }

    setDiagnostics("multiple serial ports found - choose one and click Connect", "ok");
  }

  function clearConnectionState() {
    stopRecording(true);
    state.readLoopActive = false;
    state.port = null;
    state.lineBuffer = "";
    state.streamTimes = [];
    state.latest.STALE = null;
    requestChartRender();
  }

  async function disconnect() {
    const wasOpening = state.connectionOpenPending;
    const wasConnected = Boolean(state.port);
    cancelConnectionAttempts();
    clearConnectionState();

    if (window.wattmeterDesktop && typeof window.wattmeterDesktop.closeSerialPort === "function") {
      await window.wattmeterDesktop.closeSerialPort().catch(() => {});
    }

    setConnectedUi(false);
    setDiagnostics(wasConnected || wasOpening ? "disconnected" : "disconnected");
  }

  return {
    autoConnectGrantedPort,
    disconnect,
    populateGrantedPortSelect,
    refreshGrantedPorts,
    requestConnect,
    selectGrantedPortIndex,
  };
}
