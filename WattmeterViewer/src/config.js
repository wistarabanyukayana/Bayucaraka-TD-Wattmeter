export const BAUD_RATE = 250000;
export const ACTIVE_STALE_MS = 500;
export const PRIMARY_FIELDS = ["A", "V", "W"];
export const MAX_FIELDS = ["Vm", "Wp", "Ap"];
export const VALUE_FIELDS = ["A", "V", "W", "Ah", "Wh", ...MAX_FIELDS];
export const DISPLAY_FIELDS = ["A", "V", "W", "Ah", "Wh"];
export const CHART_FIELDS = DISPLAY_FIELDS;
export const CHART_SAMPLE_INTERVAL_MS = 100;
export const MAX_CHART_SAMPLES = 36000;
export const LAST_PORT_STORAGE_KEY = "wattmeter-last-port";
export const THEME_STORAGE_KEY = "wattmeter-theme";
export const CHART_TIMEFRAME_STORAGE_KEY = "wattmeter-chart-timeframe";
export const ENERGY_UNIT_STORAGE_KEY = "wattmeter-energy-unit";

export const DISPLAY_DECIMALS = {
  A: 3,
  V: 2,
  W: 2,
  Ah: 3,
  Wh: 2,
  Vm: 2,
  Wp: 2,
  Ap: 2,
};

export const CHART_META = {
  A: {
    color: "#0b7285",
    unit: "A",
    decimals: 3,
  },
  V: {
    color: "#087f5b",
    unit: "V",
    decimals: 2,
  },
  W: {
    color: "#7c3aed",
    unit: "W",
    decimals: 2,
  },
  Ah: {
    color: "#b7791f",
    unit: "Ah",
    decimals: 3,
  },
  Wh: {
    color: "#d97706",
    unit: "Wh",
    decimals: 2,
  },
};

export const CHART_TIMEFRAMES = [
  {
    value: "all",
    label: "All time",
    durationMs: null,
  },
  {
    value: "1m",
    label: "1 min",
    durationMs: 60_000,
  },
  {
    value: "3m",
    label: "3 min",
    durationMs: 180_000,
  },
  {
    value: "5m",
    label: "5 min",
    durationMs: 300_000,
  },
  {
    value: "7m",
    label: "7 min",
    durationMs: 420_000,
  },
  {
    value: "10m",
    label: "10 min",
    durationMs: 600_000,
  },
];

export const ENERGY_UNITS = {
  hours: {
    label: "Hours",
    suffixes: {
      Ah: "Ah",
      Wh: "Wh",
    },
    multiplier: 1,
  },
  minutes: {
    label: "Minutes",
    suffixes: {
      Ah: "A-min",
      Wh: "W-min",
    },
    multiplier: 60,
  },
  seconds: {
    label: "Seconds",
    suffixes: {
      Ah: "A-sec",
      Wh: "W-sec",
    },
    multiplier: 3600,
  },
};
