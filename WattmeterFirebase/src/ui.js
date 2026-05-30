import {
  ACTIVE_STALE_MS,
  CHART_FIELDS,
  CHART_TIMEFRAME_STORAGE_KEY,
  CHART_TIMEFRAMES,
  DISPLAY_FIELDS,
  ENERGY_UNIT_STORAGE_KEY,
  ENERGY_UNITS,
  THEME_STORAGE_KEY,
} from "./config.js";
import { formatElapsed, formatLocalTimestamp, formatValue } from "./format.js";

export function createElements() {
  const els = {
    supportStatus: document.getElementById("supportStatus"),
    connectBtn: document.getElementById("connectBtn"),
    disconnectBtn: document.getElementById("disconnectBtn"),
    connectionState: document.getElementById("connectionState"),
    streamRate: document.getElementById("streamRate"),
    lastUpdate: document.getElementById("lastUpdate"),
    dropCount: document.getElementById("dropCount"),
    recordHz: document.getElementById("recordHz"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    startRecordBtn: document.getElementById("startRecordBtn"),
    stopRecordBtn: document.getElementById("stopRecordBtn"),
    recordState: document.getElementById("recordState"),
    recordRows: document.getElementById("recordRows"),
    recordElapsed: document.getElementById("recordElapsed"),
    diagnostics: document.getElementById("diagnostics"),
    chartPanel: document.querySelector(".chart-panel"),
    chartTimeframe: document.getElementById("chartTimeframe"),
    energyUnit: document.getElementById("energyUnit"),
    charts: {},
    chartCards: {},
    chartRanges: {},
    chartTimeRanges: {},
    values: {
      A: document.getElementById("valueA"),
      V: document.getElementById("valueV"),
      W: document.getElementById("valueW"),
      Ah: document.getElementById("valueAh"),
      Wh: document.getElementById("valueWh"),
    },
    maxValues: {
      A: document.getElementById("maxA"),
      V: document.getElementById("maxV"),
      W: document.getElementById("maxW"),
    },
    valueLabels: {
      Ah: document.getElementById("labelAh"),
      Wh: document.getElementById("labelWh"),
    },
  };

  for (const field of CHART_FIELDS) {
    els.charts[field] = document.getElementById(`chart${field}`);
    els.chartCards[field] = document.querySelector(`[data-chart="${field}"]`);
    els.chartRanges[field] = document.getElementById(`chartRange${field}`);
    els.chartTimeRanges[field] = document.getElementById(`chartTimeRange${field}`);
  }

  return els;
}

export function populateChartControls(els) {
  els.chartTimeframe.innerHTML = "";
  for (const option of CHART_TIMEFRAMES) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    els.chartTimeframe.appendChild(element);
  }

  els.energyUnit.innerHTML = "";
  for (const [value, config] of Object.entries(ENERGY_UNITS)) {
    const element = document.createElement("option");
    element.value = value;
    element.textContent = config.label;
    els.energyUnit.appendChild(element);
  }
}

export function refreshUi(state, els) {
  if (state.latest.ACTIVE.length > 0 && Date.now() - state.activeUpdatedAt > ACTIVE_STALE_MS) {
    state.latest.ACTIVE = [];
  }

  updateEnergyLabels(state, els);

  for (const field of DISPLAY_FIELDS) {
    els.values[field].textContent = formatValue(state.latest[field], field, state);
    applyChartCardState(state, els, field);
  }

  updateMaxDetails(state, els);
  applyChartPanelState(state, els);

  els.streamRate.textContent = `${state.streamTimes.length.toFixed(1)} Hz`;
  els.dropCount.textContent = state.latest.DROP === null ? "0" : String(state.latest.DROP);
  els.lastUpdate.textContent = state.latest.receivedAt ? formatLocalTimestamp(state.latest.receivedAt).slice(11) : "--";
  document.body.classList.toggle("is-stale", Boolean(state.port) && state.latest.STALE === true);
  if (state.port) {
    els.connectionState.textContent = state.latest.STALE ? "Connected (stale)" : "Connected";
  }
  els.recordRows.textContent = String(state.rows.length);

  if (state.recording) {
    els.recordElapsed.textContent = formatElapsed(Date.now() - state.recordStartedAt);
  }

  window.setTimeout(() => refreshUi(state, els), 100);
}

export function setConnectedUi(state, els, connected) {
  const connecting = !connected && state.connectionOpenPending;
  document.body.classList.toggle("is-connected", connected);
  if (!connected) {
    document.body.classList.remove("is-stale");
  }
  els.connectionState.textContent = connected ? "Connected" : connecting ? "Connecting" : "Disconnected";
  els.connectBtn.disabled = connected || connecting || !getSerialSupport().ok;
  els.disconnectBtn.disabled = !connected && !connecting;
  els.startRecordBtn.disabled = !connected || state.recording;
}

export function setRecordingUi(state, els, recording) {
  document.body.classList.toggle("is-recording", recording);
  els.recordState.textContent = recording ? "On" : "Off";
  els.startRecordBtn.disabled = recording || !state.port;
  els.stopRecordBtn.disabled = !recording;
  els.recordHz.disabled = recording;
}

export function getSerialSupport() {
  if (!window.isSecureContext) {
    return {
      ok: false,
      message: "Web Serial requires HTTPS or localhost.",
    };
  }

  if (!navigator.serial || typeof navigator.serial.requestPort !== "function") {
    return {
      ok: false,
      message: "Web Serial is unavailable in this browser.",
    };
  }

  return {
    ok: true,
    message: "Web Serial ready",
  };
}

export function describeError(error) {
  if (!error) {
    return "Unknown error";
  }

  const name = error.name || "Error";
  const message = error.message || String(error);
  return `${name}: ${message}`;
}

export function setDiagnostics(els, message, level = "info") {
  els.diagnostics.textContent = `Diagnostics: ${message}`;
  els.diagnostics.classList.toggle("is-error", level === "error");
  els.diagnostics.classList.toggle("is-ok", level === "ok");
}

export function getPreferredTheme() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setTheme(els, requestChartRender, theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  els.themeToggleBtn.textContent = theme === "dark" ? "\u2600" : "\u263e";
  els.themeToggleBtn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  els.themeToggleBtn.setAttribute("aria-label", els.themeToggleBtn.title);
  requestChartRender();
}

export function toggleTheme(els, requestChartRender) {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  setTheme(els, requestChartRender, currentTheme === "dark" ? "light" : "dark");
}

export function toggleChartFocus(state, els, field, forceChartRender) {
  state.focusedChartField = state.focusedChartField === field ? null : field;
  applyChartPanelState(state, els);
  for (const chartField of CHART_FIELDS) {
    applyChartCardState(state, els, chartField);
  }
  forceChartRender();
}

export function applyChartPanelState(state, els) {
  els.chartPanel.classList.toggle("has-focus", state.focusedChartField !== null);
}

export function applyChartCardState(state, els, field) {
  const card = els.chartCards[field];
  if (!card) {
    return;
  }

  card.classList.toggle("is-active", state.latest.ACTIVE.includes(field));
  card.classList.toggle("is-focused", state.focusedChartField === field);
}

export function restoreChartControlState(state, els) {
  const savedTimeframe = window.localStorage.getItem(CHART_TIMEFRAME_STORAGE_KEY);
  if (CHART_TIMEFRAMES.some((option) => option.value === savedTimeframe)) {
    state.selectedChartTimeframe = savedTimeframe;
  }
  els.chartTimeframe.value = state.selectedChartTimeframe;

  const savedEnergyUnit = window.localStorage.getItem(ENERGY_UNIT_STORAGE_KEY);
  if (Object.hasOwn(ENERGY_UNITS, savedEnergyUnit)) {
    state.selectedEnergyUnit = savedEnergyUnit;
  }
  els.energyUnit.value = state.selectedEnergyUnit;
  updateEnergyLabels(state, els);
}

export function handleChartTimeframeChange(state, els, requestChartRender) {
  state.selectedChartTimeframe = els.chartTimeframe.value;
  window.localStorage.setItem(CHART_TIMEFRAME_STORAGE_KEY, state.selectedChartTimeframe);
  requestChartRender();
}

export function handleEnergyUnitChange(state, els, requestChartRender) {
  state.selectedEnergyUnit = els.energyUnit.value;
  window.localStorage.setItem(ENERGY_UNIT_STORAGE_KEY, state.selectedEnergyUnit);
  updateEnergyLabels(state, els);
  requestChartRender();
}

function updateEnergyLabels(state, els) {
  const config = ENERGY_UNITS[state.selectedEnergyUnit] || ENERGY_UNITS.hours;
  els.valueLabels.Ah.textContent = config.suffixes.Ah;
  els.valueLabels.Wh.textContent = config.suffixes.Wh;
}

function updateMaxDetails(state, els) {
  els.maxValues.A.textContent = `Max: ${formatValue(state.latest.Ap, "Ap", state)} A`;
  els.maxValues.V.textContent = `Max: ${formatValue(state.latest.Vm, "Vm", state)} V`;
  els.maxValues.W.textContent = `Max: ${formatValue(state.latest.Wp, "Wp", state)} W`;
}
