import {
  DEFAULT_PANEL_UNLIMITED_COUNT,
  MIN_PANEL_UNLIMITED_COUNT,
  PANEL_UNLIMITED_COUNT_HIGH_THRESHOLD,
  PANEL_UNLIMITED_COUNT_MAX,
  PANEL_UNLIMITED_COUNT_STEP_HIGH,
  PANEL_UNLIMITED_COUNT_STEP_LOW,
} from "../constants/panel-unlimited.js";

export function formatPanelUnlimitedCountLabel(count) {
  return `${Number(count).toLocaleString("en-US")} عدد`;
}

export function formatPanelUnlimitedCountText(count) {
  return `${Number(count).toLocaleString("en-US")} اشتراک`;
}

export function clampPanelUnlimitedCount(count, maxCount) {
  const min = MIN_PANEL_UNLIMITED_COUNT;
  const max = Math.min(
    PANEL_UNLIMITED_COUNT_MAX,
    Math.max(min, Number(maxCount) || min),
  );
  const value = Number(count) || DEFAULT_PANEL_UNLIMITED_COUNT;

  return Math.min(Math.max(value, min), max);
}

export function getNextPanelUnlimitedCount(count, maxCount) {
  const current = clampPanelUnlimitedCount(count, maxCount);
  const max = clampPanelUnlimitedCount(maxCount, maxCount);

  if (current >= max) {
    return max;
  }

  let next;

  if (current < PANEL_UNLIMITED_COUNT_HIGH_THRESHOLD) {
    next = current + PANEL_UNLIMITED_COUNT_STEP_LOW;
  } else if (current === PANEL_UNLIMITED_COUNT_HIGH_THRESHOLD) {
    next = PANEL_UNLIMITED_COUNT_MAX;
  } else {
    next = current;
  }

  return Math.min(next, max);
}

export function getPrevPanelUnlimitedCount(count, maxCount) {
  const current = clampPanelUnlimitedCount(count, maxCount);
  const min = MIN_PANEL_UNLIMITED_COUNT;

  if (current <= min) {
    return min;
  }

  if (current > PANEL_UNLIMITED_COUNT_HIGH_THRESHOLD) {
    return Math.max(PANEL_UNLIMITED_COUNT_HIGH_THRESHOLD, min);
  }

  return Math.max(current - PANEL_UNLIMITED_COUNT_STEP_LOW, min);
}
