import {
  DEFAULT_PANEL_UNLIMITED_COUNT,
  DEFAULT_PANEL_UNLIMITED_DAYS,
  DEFAULT_PANEL_UNLIMITED_MAX_USERS,
  MAX_PANEL_UNLIMITED_DAYS,
  MAX_PANEL_UNLIMITED_MAX_USERS,
  MIN_PANEL_UNLIMITED_DAYS,
} from "../constants/panel-unlimited.js";
import { calculatePanelUnlimitedTotalPrice } from "../lib/panel-unlimited-pricing.js";
import {
  clampPanelUnlimitedDays,
  getNextPanelUnlimitedDays,
  getPrevPanelUnlimitedDays,
} from "../lib/panel-unlimited-days-steps.js";
import {
  clampPanelUnlimitedCount,
  getNextPanelUnlimitedCount,
  getPrevPanelUnlimitedCount,
} from "../lib/panel-unlimited-steps.js";
import {
  clampPanelUnlimitedMaxUsers,
  getNextPanelUnlimitedMaxUsers,
  getPrevPanelUnlimitedMaxUsers,
} from "../lib/panel-unlimited-users-steps.js";
import { newServicePanelVolumeKeyboard } from "../keyboards/new-service-panel-volume.keyboard.js";
import {
  buildNewServicePanelUnlimitedMessage,
  buildPanelUnlimitedSoldOutMessage,
} from "../messages/new-service-panel-unlimited.message.js";
import { getPanelUnlimitedAvailability } from "./panel-settings.service.js";
import { getSubscriptionPricing } from "./subscription-pricing.service.js";
import { getUserPanelUnlimitedMaxUsersLock } from "./user.service.js";

function resolveCount(count) {
  return count ?? DEFAULT_PANEL_UNLIMITED_COUNT;
}

function resolveMaxUsers(maxUsers, lockedMin) {
  if (maxUsers == null) {
    return clampPanelUnlimitedMaxUsers(DEFAULT_PANEL_UNLIMITED_MAX_USERS, lockedMin);
  }

  return clampPanelUnlimitedMaxUsers(maxUsers, lockedMin);
}

function resolveDays(days) {
  return clampPanelUnlimitedDays(days ?? DEFAULT_PANEL_UNLIMITED_DAYS);
}

async function getLockedMinMaxUsers(telegramId) {
  if (!telegramId) {
    return null;
  }

  return getUserPanelUnlimitedMaxUsersLock(telegramId);
}

async function buildScreen(selectedCount, selectedMaxUsers, selectedDays, lockedMinMaxUsers) {
  const availability = await getPanelUnlimitedAvailability();

  if (!availability.canPurchase) {
    return {
      text: buildPanelUnlimitedSoldOutMessage(availability),
      keyboard: newServicePanelVolumeKeyboard({
        selectedCount: 0,
        selectedMaxUsers: DEFAULT_PANEL_UNLIMITED_MAX_USERS,
        selectedDays: DEFAULT_PANEL_UNLIMITED_DAYS,
        remaining: 0,
        canIncrease: false,
        canDecrease: false,
        canIncreaseUsers: false,
        canDecreaseUsers: false,
        canIncreaseDays: false,
        canDecreaseDays: false,
        canContinue: false,
      }),
    };
  }

  const count = clampPanelUnlimitedCount(
    resolveCount(selectedCount),
    availability.remaining,
  );
  const maxUsers = resolveMaxUsers(selectedMaxUsers, lockedMinMaxUsers);
  const days = resolveDays(selectedDays);
  const subscriptionPricing = await getSubscriptionPricing();
  const { discountPercent, userAddon, daysMultiplier, totalPrice } =
    calculatePanelUnlimitedTotalPrice(
      count,
      maxUsers,
      days,
      subscriptionPricing.panelUnlimitedPricePerSub,
      subscriptionPricing.panelUnlimitedPricePerUser,
    );

  return {
    text: buildNewServicePanelUnlimitedMessage({
      selectedCount: count,
      selectedMaxUsers: maxUsers,
      selectedDays: days,
      lockedMinMaxUsers,
      discountPercent,
      userAddon,
      daysMultiplier,
      totalPrice,
      remaining: availability.remaining,
      pricePerSub: subscriptionPricing.panelUnlimitedPricePerSub,
      pricePerUser: subscriptionPricing.panelUnlimitedPricePerUser,
    }),
    keyboard: newServicePanelVolumeKeyboard({
      selectedCount: count,
      selectedMaxUsers: maxUsers,
      selectedDays: days,
      remaining: availability.remaining,
      canIncrease: count < availability.remaining,
      canDecrease: count > DEFAULT_PANEL_UNLIMITED_COUNT,
      canIncreaseUsers: maxUsers < MAX_PANEL_UNLIMITED_MAX_USERS,
      canDecreaseUsers: maxUsers > resolveMaxUsers(null, lockedMinMaxUsers),
      canIncreaseDays: days < MAX_PANEL_UNLIMITED_DAYS,
      canDecreaseDays: days > MIN_PANEL_UNLIMITED_DAYS,
      canContinue: true,
    }),
  };
}

export async function buildNewServicePanelVolumeScreen(
  selectedCount = DEFAULT_PANEL_UNLIMITED_COUNT,
  telegramId = null,
  selectedMaxUsers = null,
  selectedDays = null,
) {
  const lockedMinMaxUsers = await getLockedMinMaxUsers(telegramId);

  return buildScreen(
    resolveCount(selectedCount),
    resolveMaxUsers(selectedMaxUsers, lockedMinMaxUsers),
    resolveDays(selectedDays),
    lockedMinMaxUsers,
  );
}

export async function buildNewServicePanelVolumeScreenFromAction(action, telegramId = null) {
  if (!action) {
    return buildNewServicePanelVolumeScreen(undefined, telegramId);
  }

  if (
    action.action === "display" ||
    action.action === "users_display" ||
    action.action === "days_display"
  ) {
    return null;
  }

  const lockedMinMaxUsers = await getLockedMinMaxUsers(telegramId);
  const availability = await getPanelUnlimitedAvailability();

  if (!availability.canPurchase) {
    return buildScreen(
      DEFAULT_PANEL_UNLIMITED_COUNT,
      DEFAULT_PANEL_UNLIMITED_MAX_USERS,
      DEFAULT_PANEL_UNLIMITED_DAYS,
      lockedMinMaxUsers,
    );
  }

  const currentCount = clampPanelUnlimitedCount(
    resolveCount(action.gb),
    availability.remaining,
  );
  const currentMaxUsers = resolveMaxUsers(action.maxUsers, lockedMinMaxUsers);
  const currentDays = resolveDays(action.days);

  if (action.action === "inc") {
    return buildScreen(
      getNextPanelUnlimitedCount(currentCount, availability.remaining),
      currentMaxUsers,
      currentDays,
      lockedMinMaxUsers,
    );
  }

  if (action.action === "dec") {
    return buildScreen(
      getPrevPanelUnlimitedCount(currentCount, availability.remaining),
      currentMaxUsers,
      currentDays,
      lockedMinMaxUsers,
    );
  }

  if (action.action === "users_inc") {
    return buildScreen(
      currentCount,
      getNextPanelUnlimitedMaxUsers(currentMaxUsers, lockedMinMaxUsers),
      currentDays,
      lockedMinMaxUsers,
    );
  }

  if (action.action === "users_dec") {
    return buildScreen(
      currentCount,
      getPrevPanelUnlimitedMaxUsers(currentMaxUsers, lockedMinMaxUsers),
      currentDays,
      lockedMinMaxUsers,
    );
  }

  if (action.action === "days_inc") {
    return buildScreen(
      currentCount,
      currentMaxUsers,
      getNextPanelUnlimitedDays(currentDays),
      lockedMinMaxUsers,
    );
  }

  if (action.action === "days_dec") {
    return buildScreen(
      currentCount,
      currentMaxUsers,
      getPrevPanelUnlimitedDays(currentDays),
      lockedMinMaxUsers,
    );
  }

  return buildScreen(currentCount, currentMaxUsers, currentDays, lockedMinMaxUsers);
}

export async function validatePanelUnlimitedPurchase(count, maxUsers, telegramId = null, days = null) {
  const availability = await getPanelUnlimitedAvailability();

  if (!availability.canPurchase) {
    return { ok: false, reason: "SOLD_OUT" };
  }

  const lockedMinMaxUsers = await getLockedMinMaxUsers(telegramId);
  const selectedCount = clampPanelUnlimitedCount(count, availability.remaining);

  if (selectedCount > availability.remaining) {
    return { ok: false, reason: "INSUFFICIENT_CAPACITY" };
  }

  const selectedMaxUsers = resolveMaxUsers(maxUsers, lockedMinMaxUsers);
  const selectedDays = resolveDays(days);
  const subscriptionPricing = await getSubscriptionPricing();
  const pricing = calculatePanelUnlimitedTotalPrice(
    selectedCount,
    selectedMaxUsers,
    selectedDays,
    subscriptionPricing.panelUnlimitedPricePerSub,
    subscriptionPricing.panelUnlimitedPricePerUser,
  );

  return {
    ok: true,
    count: selectedCount,
    maxUsers: selectedMaxUsers,
    days: selectedDays,
    pricing,
    availability,
  };
}
