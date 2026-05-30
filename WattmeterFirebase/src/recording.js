import { formatFileTimestamp, formatLocalTimestamp } from "./format.js";
import { resetRecordMetricState } from "./state.js";

export function startRecording(state, els, setRecordingUi, resetCharts) {
  if (!state.port || state.recording) {
    return;
  }

  state.rows = [];
  state.recordStartedAt = Date.now();
  resetRecordMetricState(state);
  resetCharts();
  state.recording = true;
  els.recordElapsed.textContent = "00:00.000";
  setRecordingUi(true);

  const hz = Number(els.recordHz.value);
  state.recordTimer = window.setInterval(() => appendRecordRow(state, Date.now()), Math.round(1000 / hz));
}

export function stopRecording(state, setRecordingUi, shouldSave = true) {
  if (!state.recording) {
    return;
  }

  state.recording = false;

  if (state.recordTimer) {
    window.clearInterval(state.recordTimer);
    state.recordTimer = null;
  }

  setRecordingUi(false);

  if (shouldSave && state.rows.length > 0) {
    downloadCsv(state);
  }
}

function appendRecordRow(state, nowMs) {
  const elapsedMs = nowMs - state.recordStartedAt;
  state.rows.push({
    timestamp_local: formatLocalTimestamp(nowMs),
    elapsed_ms: elapsedMs,
    A: state.latest.A,
    V: state.latest.V,
    W: state.latest.W,
    record_Ah: state.recordMetrics.Ah,
    record_Wh: state.recordMetrics.Wh,
    record_Vm: state.recordMetrics.Vm,
    record_Wp: state.recordMetrics.Wp,
    record_Ap: state.recordMetrics.Ap,
    DROP: state.latest.DROP,
    STALE: state.latest.STALE,
    active_fields: state.latest.ACTIVE.join("|"),
  });
}

function csvCell(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }

  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadCsv(state) {
  const headers = [
    "timestamp_local",
    "elapsed_ms",
    "A",
    "V",
    "W",
    "record_Ah",
    "record_Wh",
    "record_Vm",
    "record_Wp",
    "record_Ap",
    "DROP",
    "STALE",
    "active_fields",
  ];
  const lines = [headers.join(",")];

  for (const row of state.rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  }

  const csv = `\uFEFF${lines.join("\r\n")}\r\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `wattmeter-recording-${formatFileTimestamp(new Date(state.recordStartedAt))}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
