import { DISPLAY_DECIMALS, ENERGY_UNITS } from "./config.js";

export function isNumberValue(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function getEnergyUnitConfig(state) {
  return ENERGY_UNITS[state.selectedEnergyUnit] || ENERGY_UNITS.hours;
}

export function displayValueForField(value, field, state) {
  if ((field === "Ah" || field === "Wh") && isNumberValue(value)) {
    return value * getEnergyUnitConfig(state).multiplier;
  }
  return value;
}

export function displayUnitForField(field, state, fallbackUnit = "") {
  if (field === "Ah" || field === "Wh") {
    return getEnergyUnitConfig(state).suffixes[field];
  }
  return fallbackUnit;
}

export function formatValue(value, field, state) {
  const displayValue = displayValueForField(value, field, state);
  if (!isNumberValue(displayValue)) {
    return "--";
  }

  return displayValue.toFixed(DISPLAY_DECIMALS[field]);
}

export function formatValueWithUnit(value, field, unit, state) {
  const displayValue = displayValueForField(value, field, state);
  if (!isNumberValue(displayValue)) {
    return `-- ${displayUnitForField(field, state, unit)}`;
  }

  return `${displayValue.toFixed(DISPLAY_DECIMALS[field])} ${displayUnitForField(field, state, unit)}`;
}

export function formatLocalTimestamp(timeMs) {
  const date = new Date(timeMs);
  const pad = (value, size = 2) => String(value).padStart(size, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":",
    pad(date.getSeconds()),
    ".",
    pad(date.getMilliseconds(), 3),
  ].join("");
}

export function formatElapsed(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function formatChartTime(timeMs) {
  const date = new Date(timeMs);
  const pad = (value, size = 2) => String(value).padStart(size, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatFileTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
