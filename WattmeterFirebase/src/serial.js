import { BAUD_RATE } from "./config.js";
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

  let activeReader = null;

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

  function clearConnectionState() {
    stopRecording(true);
    state.readLoopActive = false;
    state.port = null;
    state.lineBuffer = "";
    state.streamTimes = [];
    state.latest.STALE = null;
    requestChartRender();
  }

  async function readSerialPort(port, attemptId) {
    const decoder = new TextDecoder();

    try {
      while (isCurrentConnectionAttempt(attemptId) && state.readLoopActive && port.readable) {
        activeReader = port.readable.getReader();

        try {
          while (isCurrentConnectionAttempt(attemptId) && state.readLoopActive) {
            const { value, done } = await activeReader.read();
            if (done) {
              break;
            }

            if (value) {
              consumeSerialText(decoder.decode(value, { stream: true }));
            }
          }
        } finally {
          activeReader.releaseLock();
          activeReader = null;
        }
      }
    } catch (error) {
      if (isCurrentConnectionAttempt(attemptId) && state.port === port) {
        setDiagnostics(`serial read failed - ${describeError(error)}`, "error");
      }
    } finally {
      if (isCurrentConnectionAttempt(attemptId) && state.port === port) {
        clearConnectionState();
        setConnectedUi(false);
        setDiagnostics("serial port closed");
      }
    }
  }

  async function requestConnect() {
    const support = getSerialSupport();
    if (!support.ok) {
      setDiagnostics(support.message, "error");
      return;
    }

    if (state.connectionOpenPending) {
      setDiagnostics("connection already in progress");
      return;
    }

    if (state.port) {
      await disconnect();
    }

    const attemptId = beginConnectionAttempt();

    try {
      setDiagnostics("choose the wattmeter serial port in the browser prompt");
      const port = await navigator.serial.requestPort();

      if (!isCurrentConnectionAttempt(attemptId)) {
        await port.close().catch(() => {});
        return;
      }

      await port.open({ baudRate: BAUD_RATE });

      if (!isCurrentConnectionAttempt(attemptId)) {
        await port.close().catch(() => {});
        return;
      }

      state.connectionOpenPending = false;
      state.port = port;
      resetLiveMetricState(state);
      resetRecordMetricState(state);
      state.readLoopActive = true;
      setConnectedUi(true);
      setDiagnostics("connected to browser-selected serial port", "ok");
      readSerialPort(port, attemptId);
    } catch (error) {
      if (!isCurrentConnectionAttempt(attemptId)) {
        return;
      }

      state.connectionOpenPending = false;
      state.port = null;
      setConnectedUi(false);
      setDiagnostics(`connection failed - ${describeError(error)}`, "error");
    }
  }

  async function autoConnectGrantedPort() {
    const support = getSerialSupport();
    els.supportStatus.textContent = support.message;
    setDiagnostics(support.message, support.ok ? "ok" : "error");

    if (!support.ok) {
      setConnectedUi(false);
    }
  }

  async function disconnect() {
    const wasOpening = state.connectionOpenPending;
    const wasConnected = Boolean(state.port);
    const port = state.port;

    cancelConnectionAttempts();
    clearConnectionState();

    if (activeReader) {
      await activeReader.cancel().catch(() => {});
    }

    if (port) {
      await port.close().catch(() => {});
    }

    setConnectedUi(false);
    setDiagnostics(wasConnected || wasOpening ? "disconnected" : "disconnected");
  }

  return {
    autoConnectGrantedPort,
    disconnect,
    requestConnect,
  };
}
