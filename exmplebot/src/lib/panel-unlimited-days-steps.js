import {
  DEFAULT_PANEL_UNLIMITED_DAYS,
  MAX_PANEL_UNLIMITED_DAYS,
  MIN_PANEL_UNLIMITED_DAYS,
  PANEL_UNLIMITED_DAYS_STEP,
} from "../constants/panel-unlimited.js";

export function formatPanelUnlimitedDaysLabel(days) {
  return `${Number(days).toLocaleString("en-US")} روز`;
}

export function formatPanelUnlimitedDaysText(days) {
  return `${Number(days).toLocaleString("en-US")} روزه`;
}

export function clampPanelUnlimitedDays(days) {
  const value = Number(days) || DEFAULT_PANEL_UNLIMITED_DAYS;

  return Math.min(Math.max(value, MIN_PANEL_UNLIMITED_DAYS), MAX_PANEL_UNLIMITED_DAYS);
}

export function getNextPanelUnlimitedDays(days) {
  const current = clampPanelUnlimitedDays(days);

  if (current >= MAX_PANEL_UNLIMITED_DAYS) {
    return MAX_PANEL_UNLIMITED_DAYS;
  }

  return Math.min(current + PANEL_UNLIMITED_DAYS_STEP, MAX_PANEL_UNLIMITED_DAYS);
}

export function getPrevPanelUnlimitedDays(days) {
  const current = clampPanelUnlimitedDays(days);

  if (current <= MIN_PANEL_UNLIMITED_DAYS) {
    return MIN_PANEL_UNLIMITED_DAYS;
  }

  return Math.max(current - PANEL_UNLIMITED_DAYS_STEP, MIN_PANEL_UNLIMITED_DAYS);
}

export function getPanelUnlimitedDaysPriceMultiplier(days) {
  return clampPanelUnlimitedDays(days) === MAX_PANEL_UNLIMITED_DAYS ? 2 : 1;
}
