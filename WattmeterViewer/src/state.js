import {
  CHART_FIELDS,
  CHART_TIMEFRAMES,
  ENERGY_UNITS,
  VALUE_FIELDS,
} from "./config.js";

export function createMetricState() {
  return {
    Ah: 0,
    Wh: 0,
    Vm: null,
    Wp: null,
    Ap: null,
    lastIntegratedAt: null,
  };
}

export function createChartSamples() {
  const samples = {};
  for (const field of CHART_FIELDS) {
    samples[field] = [];
  }
  return samples;
}

export function createEmptyReading() {
  const reading = {
    DROP: null,
    STALE: null,
    ACTIVE: [],
    receivedAt: null,
  };

  for (const field of VALUE_FIELDS) {
    reading[field] = null;
  }

  return reading;
}

export function createAppState() {
  return {
    port: null,
    reader: null,
    readLoopActive: false,
    lineBuffer: "",
    latest: createEmptyReading(),
    liveMetrics: createMetricState(),
    recordMetrics: createMetricState(),
    activeUpdatedAt: 0,
    lastLineAt: 0,
    streamTimes: [],
    recording: false,
    recordStartedAt: 0,
    recordTimer: null,
    rows: [],
    lastDebugLogAt: 0,
    chartSamples: createChartSamples(),
    lastChartSampleAt: 0,
    chartFrameRequested: false,
    focusedChartField: null,
    selectedChartTimeframe: CHART_TIMEFRAMES[0].value,
    selectedEnergyUnit: Object.keys(ENERGY_UNITS)[0],
    grantedPorts: [],
    grantedPortLabels: [],
    selectedGrantedPortIndex: -1,
    selectedGrantedPortIdentity: "",
    connectionAttemptId: 0,
    connectionOpenPending: false,
  };
}

export function resetLiveMetricState(state) {
  state.liveMetrics = createMetricState();
  state.latest.Ah = 0;
  state.latest.Wh = 0;
  state.latest.Vm = state.latest.V;
  state.latest.Wp = state.latest.W;
  state.latest.Ap = state.latest.A;
}

export function resetRecordMetricState(state) {
  state.recordMetrics = createMetricState();
}

export function resetCharts(state) {
  state.chartSamples = createChartSamples();
  state.lastChartSampleAt = 0;
}
