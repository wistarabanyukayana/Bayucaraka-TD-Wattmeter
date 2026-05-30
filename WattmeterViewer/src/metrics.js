import { isNumberValue } from "./format.js";
import { createMetricState } from "./state.js";

export function updateMetricState(metrics, sample, nowMs, allowIntegration) {
  if (!allowIntegration) {
    metrics.lastIntegratedAt = null;
    return;
  }

  const amps = sample.A;
  const volts = sample.V;
  const watts = sample.W;

  if (isNumberValue(volts)) {
    metrics.Vm = metrics.Vm === null ? volts : Math.max(metrics.Vm, volts);
  }

  if (isNumberValue(watts)) {
    metrics.Wp = metrics.Wp === null ? watts : Math.max(metrics.Wp, watts);
  }

  if (isNumberValue(amps)) {
    metrics.Ap = metrics.Ap === null ? amps : Math.max(metrics.Ap, amps);
  }

  if (!isNumberValue(amps) && !isNumberValue(watts)) {
    metrics.lastIntegratedAt = null;
    return;
  }

  if (metrics.lastIntegratedAt !== null) {
    const deltaMs = nowMs - metrics.lastIntegratedAt;
    if (deltaMs > 0 && deltaMs <= 1000) {
      const deltaHours = deltaMs / 3600000;
      if (isNumberValue(amps)) {
        metrics.Ah += amps * deltaHours;
      }
      if (isNumberValue(watts)) {
        metrics.Wh += watts * deltaHours;
      }
    }
  }

  metrics.lastIntegratedAt = nowMs;
}

export function applyMetricStateToDisplay(metrics, display) {
  display.Ah = metrics.Ah;
  display.Wh = metrics.Wh;
  display.Vm = metrics.Vm;
  display.Wp = metrics.Wp;
  display.Ap = metrics.Ap;
}

export function resetMetricState() {
  return createMetricState();
}
