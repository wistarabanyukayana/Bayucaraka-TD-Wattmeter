import {
  CHART_FIELDS,
  PRIMARY_FIELDS,
} from "./config.js";
import {
  forceChartRender as forceChartRenderCore,
  renderCharts,
  requestChartRender as requestChartRenderCore,
  resetCharts as resetChartsCore,
  sampleCharts,
} from "./charts.js";
import { applyMetricStateToDisplay, updateMetricState } from "./metrics.js";
import { parseDataLine } from "./parser.js";
import { startRecording, stopRecording as stopRecordingCore } from "./recording.js";
import { createAppState } from "./state.js";
import { createSerialController } from "./serial.js";
import {
  createElements,
  describeError,
  getPreferredTheme,
  getSerialSupport,
  handleChartTimeframeChange,
  handleEnergyUnitChange,
  openDriverHelp,
  populateChartControls,
  refreshUi,
  restoreChartControlState,
  setConnectedUi as setConnectedUiCore,
  setDiagnostics as setDiagnosticsCore,
  setRecordingUi as setRecordingUiCore,
  setTheme,
  toggleChartFocus,
  toggleTheme,
} from "./ui.js";

const state = createAppState();
const els = createElements();

const requestChartRender = () => requestChartRenderCore(state, () => renderCharts(state, els));
const forceChartRender = () => forceChartRenderCore(state, requestChartRender);
const resetCharts = () => resetChartsCore(state, requestChartRender);
const setConnectedUi = (connected) => setConnectedUiCore(state, els, connected);
const setRecordingUi = (recording) => setRecordingUiCore(state, els, recording);
const setDiagnostics = (message, level = "info") => setDiagnosticsCore(els, message, level);
const stopRecording = (shouldSave = true) => stopRecordingCore(state, setRecordingUi, shouldSave);

const serial = createSerialController({
  state,
  els,
  consumeSerialText,
  describeError,
  getSerialSupport,
  requestChartRender,
  setConnectedUi,
  setDiagnostics,
  stopRecording,
});

function mergeReading(next) {
  for (const field of PRIMARY_FIELDS) {
    if (next[field] !== null) {
      state.latest[field] = next[field];
    }
  }

  if (next.DROP !== null) {
    state.latest.DROP = next.DROP;
  }

  if (next.STALE !== null) {
    state.latest.STALE = next.STALE;
  }

  state.latest.ACTIVE = next.ACTIVE;
  state.activeUpdatedAt = next.receivedAt;
  state.latest.receivedAt = next.receivedAt;
  state.lastLineAt = next.receivedAt;
  state.streamTimes.push(next.receivedAt);
  updateMetricState(state.liveMetrics, next, next.receivedAt, next.STALE !== true);
  applyMetricStateToDisplay(state.liveMetrics, state.latest);
  sampleCharts(state, requestChartRender, next.receivedAt);

  if (state.recording) {
    updateMetricState(state.recordMetrics, next, next.receivedAt, next.STALE !== true);
  }

  const cutoff = next.receivedAt - 1000;
  while (state.streamTimes.length > 0 && state.streamTimes[0] < cutoff) {
    state.streamTimes.shift();
  }
}

function consumeSerialText(text) {
  state.lineBuffer += text;
  const lines = state.lineBuffer.split("\n");
  state.lineBuffer = lines.pop() ?? "";

  for (const rawLine of lines) {
    const parsed = parseDataLine(rawLine.replace(/\r$/, ""));
    if (parsed) {
      mergeReading(parsed);
    }
  }
}

function bindEvents() {
  els.portSelect.addEventListener("change", () => {
    const selectedIndex = Number.parseInt(els.portSelect.value, 10);
    serial.selectGrantedPortIndex(Number.isInteger(selectedIndex) ? selectedIndex : -1);
  });

  els.refreshPortsBtn.addEventListener("click", () => {
    serial.refreshGrantedPorts().then((ports) => {
      setDiagnostics(`found ${ports.length} granted port${ports.length === 1 ? "" : "s"}`, "ok");
    }).catch((error) => {
      console.error(error);
      setDiagnostics(`refresh failed - ${describeError(error)}`, "error");
    });
  });

  els.connectBtn.addEventListener("click", () => {
    serial.requestConnect();
  });

  els.disconnectBtn.addEventListener("click", () => {
    serial.disconnect().catch(console.error);
  });

  els.themeToggleBtn.addEventListener("click", () => toggleTheme(els, requestChartRender));
  els.driverHelpBtn.addEventListener("click", () => {
    openDriverHelp(els).catch((error) => {
      console.error(error);
      setDiagnostics(`driver help failed - ${describeError(error)}`, "error");
    });
  });

  els.chartTimeframe.addEventListener("change", () => handleChartTimeframeChange(state, els, requestChartRender));
  els.energyUnit.addEventListener("change", () => handleEnergyUnitChange(state, els, requestChartRender));
  els.chartPanel.addEventListener("click", (event) => {
    const focusTarget = event.target.closest("[data-focus-chart], [data-chart]");
    if (!focusTarget) {
      return;
    }

    const field = focusTarget.dataset.focusChart || focusTarget.dataset.chart;
    if (CHART_FIELDS.includes(field)) {
      toggleChartFocus(state, els, field, forceChartRender);
    }
  });

  els.startRecordBtn.addEventListener("click", () => startRecording(state, els, setRecordingUi, resetCharts));
  els.stopRecordBtn.addEventListener("click", () => stopRecording(true));

  window.addEventListener("resize", forceChartRender);

  if ("ResizeObserver" in window) {
    const chartResizeObserver = new ResizeObserver(forceChartRender);
    chartResizeObserver.observe(els.chartPanel);
    for (const field of CHART_FIELDS) {
      if (els.charts[field]) {
        chartResizeObserver.observe(els.charts[field]);
      }
    }
  }
}

populateChartControls(els);
restoreChartControlState(state, els);
bindEvents();
setTheme(els, requestChartRender, getPreferredTheme());
setConnectedUi(false);
setRecordingUi(false);
refreshUi(state, els);
requestChartRender();
serial.autoConnectGrantedPort().catch(console.error);
