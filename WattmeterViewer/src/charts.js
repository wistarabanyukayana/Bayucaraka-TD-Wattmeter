import {
  CHART_FIELDS,
  CHART_META,
  CHART_SAMPLE_INTERVAL_MS,
  CHART_TIMEFRAMES,
  MAX_CHART_SAMPLES,
} from "./config.js";
import {
  displayUnitForField,
  displayValueForField,
  formatChartTime,
  isNumberValue,
} from "./format.js";
import { resetCharts as resetChartState } from "./state.js";

export function sampleCharts(state, requestChartRender, nowMs) {
  if (nowMs - state.lastChartSampleAt < CHART_SAMPLE_INTERVAL_MS) {
    return;
  }

  state.lastChartSampleAt = nowMs;

  for (const field of CHART_FIELDS) {
    const value = state.latest[field];
    if (!isNumberValue(value)) {
      continue;
    }

    const samples = state.chartSamples[field];
    samples.push({
      time: nowMs,
      value,
    });

    while (samples.length > MAX_CHART_SAMPLES) {
      samples.shift();
    }
  }

  requestChartRender();
}

export function resetCharts(state, requestChartRender) {
  resetChartState(state);
  requestChartRender();
}

export function requestChartRender(state, renderCharts) {
  if (state.chartFrameRequested) {
    return;
  }

  state.chartFrameRequested = true;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      state.chartFrameRequested = false;
      renderCharts();
    });
  });
}

export function forceChartRender(state, requestRender) {
  state.chartFrameRequested = false;
  requestRender();
}

export function renderCharts(state, els) {
  for (const field of CHART_FIELDS) {
    renderChart(state, els, field);
  }
}

function renderChart(state, els, field) {
  const canvas = els.charts[field];
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * pixelRatio));
  const height = Math.max(1, Math.round(rect.height * pixelRatio));

  if (canvas.width !== width || canvas.height !== height) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    canvas.width = width;
    canvas.height = height;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);

  const rawSamples = state.chartSamples[field] || [];
  const samples = getVisibleSamples(state, rawSamples);
  const isFocused = state.focusedChartField === field;
  const isMini = state.focusedChartField !== null && !isFocused;
  if (samples.length < 2) {
    drawChartBackground(context, rect.width, rect.height, null);
    drawChartEmptyState(context, rect.width, rect.height);
    els.chartRanges[field].textContent = "--";
    els.chartTimeRanges[field].textContent = "--";
    return;
  }

  const meta = getChartMeta(state, field);
  let minValue = displayValueForField(samples[0].value, field, state);
  let maxValue = minValue;
  for (const sample of samples) {
    const value = displayValueForField(sample.value, field, state);
    minValue = Math.min(minValue, value);
    maxValue = Math.max(maxValue, value);
  }

  const rangePadding = Math.max((maxValue - minValue) * 0.12, Math.abs(maxValue || 1) * 0.02, 0.001);
  const minY = minValue - rangePadding;
  const maxY = maxValue + rangePadding;
  const start = samples[0].time;
  const end = samples[samples.length - 1].time;
  const timeSpan = Math.max(1, end - start);
  const plot = {
    left: isMini ? 8 : Math.min(74, Math.max(50, rect.width * 0.12)),
    top: isMini ? 8 : 14,
    right: rect.width - 10,
    bottom: isMini ? rect.height - 10 : rect.height - 30,
  };
  const plotWidth = Math.max(1, plot.right - plot.left);
  const plotHeight = Math.max(1, plot.bottom - plot.top);
  const drawableSamples = getDrawableSamples(samples, Math.max(2, Math.floor(plotWidth * 2)));

  drawChartBackground(context, rect.width, rect.height, plot);
  if (!isMini) {
    drawYAxis(context, plot, minY, maxY, meta);
    drawXAxis(context, plot, start, end);
  }

  context.beginPath();
  for (let i = 0; i < drawableSamples.length; i++) {
    const sample = drawableSamples[i];
    const value = displayValueForField(sample.value, field, state);
    const x = plot.left + ((sample.time - start) / timeSpan) * plotWidth;
    const y = plot.bottom - ((value - minY) / (maxY - minY)) * plotHeight;
    if (i === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.lineWidth = isMini ? 1.5 : 2;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = meta.color;
  context.stroke();

  const last = samples[samples.length - 1];
  const lastValue = displayValueForField(last.value, field, state);
  const lastX = plot.left + ((last.time - start) / timeSpan) * plotWidth;
  const lastY = plot.bottom - ((lastValue - minY) / (maxY - minY)) * plotHeight;
  context.beginPath();
  context.arc(lastX, lastY, isMini ? 2.5 : 3.4, 0, Math.PI * 2);
  context.fillStyle = meta.color;
  context.fill();

  els.chartRanges[field].textContent = `${minValue.toFixed(meta.decimals)}-${maxValue.toFixed(meta.decimals)} ${meta.unit}`;
  els.chartTimeRanges[field].textContent = `${formatChartTime(start)} - ${formatChartTime(end)}`;
}

function getChartMeta(state, field) {
  const meta = CHART_META[field];
  return {
    ...meta,
    unit: displayUnitForField(field, state, meta.unit),
  };
}

function getVisibleSamples(state, samples) {
  const timeframe = CHART_TIMEFRAMES.find((option) => option.value === state.selectedChartTimeframe);
  if (!timeframe || timeframe.durationMs === null || samples.length === 0) {
    return samples;
  }

  const end = samples[samples.length - 1].time;
  const cutoff = end - timeframe.durationMs;
  return samples.filter((sample) => sample.time >= cutoff);
}

function getDrawableSamples(samples, maxPoints) {
  if (samples.length <= maxPoints) {
    return samples;
  }

  const selected = [];
  const step = (samples.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    selected.push(samples[Math.round(i * step)]);
  }
  return selected;
}

function drawChartBackground(context, width, height, plot) {
  context.fillStyle = getCssVar("--chart-fill-b", "#eef3f8");
  context.fillRect(0, 0, width, height);

  const gridColor = getCssVar("--chart-grid", "rgba(98, 112, 122, 0.18)");
  context.strokeStyle = gridColor;
  context.lineWidth = 1;

  const left = plot ? plot.left : 10;
  const right = plot ? plot.right : width - 10;
  const top = plot ? plot.top : 12;
  const bottom = plot ? plot.bottom : height - 18;

  for (let i = 1; i < 4; i++) {
    const y = Math.round(top + ((bottom - top) * i) / 4) + 0.5;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
  }
}

function drawYAxis(context, plot, minY, maxY, meta) {
  const axisColor = getCssVar("--chart-axis", "rgba(98, 112, 122, 0.78)");
  context.fillStyle = axisColor;
  context.strokeStyle = axisColor;
  context.font = "11px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.textAlign = "right";
  context.textBaseline = "middle";

  for (let i = 0; i <= 4; i++) {
    const ratio = i / 4;
    const value = maxY - (maxY - minY) * ratio;
    const y = plot.top + (plot.bottom - plot.top) * ratio;
    context.fillText(value.toFixed(meta.decimals), plot.left - 8, y);
  }

  drawAxisLine(context, plot.left, plot.top, plot.left, plot.bottom);
}

function drawXAxis(context, plot, start, end) {
  const axisColor = getCssVar("--chart-axis", "rgba(98, 112, 122, 0.78)");
  context.fillStyle = axisColor;
  context.strokeStyle = axisColor;
  context.font = "11px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "top";

  for (let i = 0; i <= 3; i++) {
    const ratio = i / 3;
    const time = start + (end - start) * ratio;
    const x = plot.left + (plot.right - plot.left) * ratio;
    context.fillText(formatChartTime(time), x, plot.bottom + 9);
  }

  drawAxisLine(context, plot.left, plot.bottom, plot.right, plot.bottom);
}

function drawAxisLine(context, x1, y1, x2, y2) {
  context.beginPath();
  context.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
  context.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
  context.stroke();
}

function drawChartEmptyState(context, width, height) {
  context.fillStyle = getCssVar("--muted", "#62707a");
  context.font = "12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("Waiting for data", width / 2, height / 2);
}

function getCssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
