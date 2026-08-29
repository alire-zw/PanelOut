import {
  DEFAULT_PANEL_UNLIMITED_MAX_USERS,
  MAX_PANEL_UNLIMITED_MAX_USERS,
  MIN_PANEL_UNLIMITED_MAX_USERS,
} from "../constants/panel-unlimited.js";

export function formatPanelUnlimitedMaxUsersLabel(maxUsers) {
  return `${Number(maxUsers).toLocaleString("en-US")} کاربر`;
}

export function formatPanelUnlimitedMaxUsersText(maxUsers) {
  return `${Number(maxUsers).toLocaleString("en-US")} کاربر`;
}

export function clampPanelUnlimitedMaxUsers(maxUsers, lockedMin = MIN_PANEL_UNLIMITED_MAX_USERS) {
  const min = Math.max(MIN_PANEL_UNLIMITED_MAX_USERS, Number(lockedMin) || MIN_PANEL_UNLIMITED_MAX_USERS);
  const max = MAX_PANEL_UNLIMITED_MAX_USERS;
  const value = Number(maxUsers) || DEFAULT_PANEL_UNLIMITED_MAX_USERS;

  return Math.min(Math.max(value, min), max);
}

export function getNextPanelUnlimitedMaxUsers(maxUsers, lockedMin = MIN_PANEL_UNLIMITED_MAX_USERS) {
  const current = clampPanelUnlimitedMaxUsers(maxUsers, lockedMin);

  if (current >= MAX_PANEL_UNLIMITED_MAX_USERS) {
    return MAX_PANEL_UNLIMITED_MAX_USERS;
  }

  return current + 1;
}

export function getPrevPanelUnlimitedMaxUsers(maxUsers, lockedMin = MIN_PANEL_UNLIMITED_MAX_USERS) {
  const current = clampPanelUnlimitedMaxUsers(maxUsers, lockedMin);
  const min = Math.max(
    MIN_PANEL_UNLIMITED_MAX_USERS,
    Number(lockedMin) || MIN_PANEL_UNLIMITED_MAX_USERS,
  );

  if (current <= min) {
    return min;
  }

  return current - 1;
}
