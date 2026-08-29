import { isAdminUser } from "../lib/admin.js";
import {
  deleteUserMessage,
  editPromptMessage,
  getPromptRefFromSession,
} from "../lib/prompt-message.js";
import { adminPaymentPromptKeyboard } from "../keyboards/admin-payment.keyboard.js";
import { adminPanelSettingsPromptKeyboard } from "../keyboards/admin-panel-settings.keyboard.js";
import { adminPricingSettingsPromptKeyboard } from "../keyboards/admin-pricing-settings.keyboard.js";
import { adminServerAddCancelKeyboard, adminServerEditCancelKeyboard } from "../keyboards/admin-server.keyboard.js";
import {
  buildAdminPaymentSettingsScreen,
  buildAdminRialSettingsScreen,
  buildAdminTronSettingsScreen,
} from "../services/admin-payment.service.js";
import {
  AdminSessionAction,
  clearAdminSession,
  getAdminSession,
} from "../services/admin-session.service.js";
import { adminChannelEditLabelCancelKeyboard } from "../keyboards/admin-channel.keyboard.js";
import {
  ChannelSessionMode,
  clearChannelSession,
  getChannelSession,
} from "../services/admin-channel-session.service.js";
import { processChannelEditLabel } from "../services/admin-channel.service.js";
import {
  ServerSessionMode,
  clearServerSession,
  getServerSession,
  setServerSession,
} from "../services/admin-server-session.service.js";
import {
  finalizeServerAdd,
  processServerAddStep,
  processServerEditStep,
  buildServerAddConnectingScreen,
} from "../services/admin-server.service.js";
import {
  adminSetCardPromptMessage,
  adminSetMasterWalletPromptMessage,
  adminSetShebaPromptMessage,
} from "../messages/admin-payment.message.js";
import { adminSetPanelUnlimitedCapacityPromptMessage } from "../messages/admin-panel-settings.message.js";
import {
  adminSetOutboundPricePromptMessage,
  adminSetPanelUsagePricePromptMessage,
  adminSetUnlimitedSubPricePromptMessage,
  adminSetUnlimitedUserPricePromptMessage,
} from "../messages/admin-pricing-settings.message.js";
import { buildAdminPanelSettingsScreen } from "../services/admin-panel-settings.service.js";
import { buildAdminPricingSettingsScreen } from "../services/admin-pricing-settings.service.js";
import {
  setCardNumber,
  setMasterWalletAddress,
  setShebaNumber,
} from "../services/payment-settings.service.js";
import { setPanelUnlimitedCapacity } from "../services/panel-settings.service.js";
import {
  PricingField,
  setSubscriptionPricingField,
} from "../services/subscription-pricing.service.js";

function getAdminPromptMessage(action) {
  switch (action) {
    case AdminSessionAction.SET_MASTER_WALLET:
      return adminSetMasterWalletPromptMessage;
    case AdminSessionAction.SET_CARD:
      return adminSetCardPromptMessage;
    case AdminSessionAction.SET_SHEBA:
      return adminSetShebaPromptMessage;
    case AdminSessionAction.SET_PANEL_UNLIMITED_CAPACITY:
      return adminSetPanelUnlimitedCapacityPromptMessage;
    case AdminSessionAction.SET_PANEL_USAGE_PRICE_PER_GB:
      return adminSetPanelUsagePricePromptMessage;
    case AdminSessionAction.SET_OUTBOUND_PRICE_PER_GB:
      return adminSetOutboundPricePromptMessage;
    case AdminSessionAction.SET_PANEL_UNLIMITED_PRICE_PER_SUB:
      return adminSetUnlimitedSubPricePromptMessage;
    case AdminSessionAction.SET_PANEL_UNLIMITED_PRICE_PER_USER:
      return adminSetUnlimitedUserPricePromptMessage;
    default:
      return "";
  }
}

function getAdminPromptKeyboard(session) {
  if (session.returnTo === "panel") {
    return adminPanelSettingsPromptKeyboard();
  }

  if (session.returnTo === "pricing") {
    return adminPricingSettingsPromptKeyboard();
  }

  return adminPaymentPromptKeyboard(session.returnTo ?? "payment");
}

async function resolveReturnScreen(returnTo) {
  if (returnTo === "tron") {
    return buildAdminTronSettingsScreen();
  }

  if (returnTo === "rial") {
    return buildAdminRialSettingsScreen();
  }

  if (returnTo === "panel") {
    return buildAdminPanelSettingsScreen();
  }

  if (returnTo === "pricing") {
    return buildAdminPricingSettingsScreen();
  }

  return buildAdminPaymentSettingsScreen();
}

async function showAdminPromptError(ctx, session, errorText) {
  const promptRef = getPromptRefFromSession(session);
  const promptMessage = getAdminPromptMessage(session.action);

  await deleteUserMessage(ctx);
  await editPromptMessage(
    ctx.api,
    promptRef,
    `⚠️ <b>${errorText}</b>\n\n${promptMessage}`,
    getAdminPromptKeyboard(session),
  );
}

async function handleServerSessionMessage(ctx, session, text) {
  const promptRef = getPromptRefFromSession(session);

  try {
    if (session.mode === ServerSessionMode.ADD) {
      const result = await processServerAddStep(session, text);

      await deleteUserMessage(ctx);

      if (result.finalize) {
        await clearServerSession(ctx.from.id);

        const connecting = buildServerAddConnectingScreen(result.data.serverName);
        await editPromptMessage(ctx.api, promptRef, connecting.text, connecting.keyboard);

        const final = await finalizeServerAdd(result.data);
        await editPromptMessage(ctx.api, promptRef, final.text, final.keyboard);
        return;
      }

      if (result.done) {
        await clearServerSession(ctx.from.id);
        await editPromptMessage(ctx.api, promptRef, result.screen.text, result.screen.keyboard);
        return;
      }

      await setServerSession(ctx.from.id, result.session);
      await editPromptMessage(ctx.api, promptRef, result.screen.text, result.screen.keyboard);
      return;
    }

    if (session.mode === ServerSessionMode.EDIT) {
      const result = await processServerEditStep(session, text);

      await clearServerSession(ctx.from.id);
      await deleteUserMessage(ctx);
      await editPromptMessage(ctx.api, promptRef, result.screen.text, result.screen.keyboard);
    }
  } catch (err) {
    await deleteUserMessage(ctx);

    if (err.message === "EMPTY") {
      const cancelKeyboard =
        session.mode === ServerSessionMode.ADD
          ? adminServerAddCancelKeyboard()
          : adminServerEditCancelKeyboard(session.serverId);

      await editPromptMessage(
        ctx.api,
        promptRef,
        "⚠️ <b>مقدار خالی مجاز نیست.</b>\n\nلطفاً دوباره وارد کنید.",
        cancelKeyboard,
      );
      return;
    }

    if (err.message === "INVALID_PORT") {
      await editPromptMessage(
        ctx.api,
        promptRef,
        "⚠️ <b>پورت باید عددی بین ۱ تا ۶۵۵۳۵ باشد.</b>\n\nلطفاً دوباره وارد کنید.",
        adminServerEditCancelKeyboard(session.serverId),
      );
      return;
    }

    if (err.message === "INVALID_URL") {
      await editPromptMessage(
        ctx.api,
        promptRef,
        "⚠️ <b>آدرس نامعتبر است.</b>\n\nلطفاً دوباره وارد کنید.",
        adminServerEditCancelKeyboard(session.serverId),
      );
      return;
    }

    await clearServerSession(ctx.from.id);
    await editPromptMessage(
      ctx.api,
      promptRef,
      `⚠️ <b>${err.message || "خطا در ذخیره سرور"}</b>`,
      adminServerAddCancelKeyboard(),
    );
  }
}

async function handleChannelSessionMessage(ctx, session, text) {
  const promptRef = getPromptRefFromSession(session);

  try {
    if (session.mode === ChannelSessionMode.EDIT_LABEL) {
      const screen = await processChannelEditLabel(session, text);

      await clearChannelSession(ctx.from.id);
      await deleteUserMessage(ctx);
      await editPromptMessage(ctx.api, promptRef, screen.text, screen.keyboard);
    }
  } catch (err) {
    await deleteUserMessage(ctx);

    if (err.message === "INVALID_LABEL") {
      await editPromptMessage(
        ctx.api,
        promptRef,
        "⚠️ <b>لیبل نامعتبر است.</b>\n\nلیبل نباید خالی باشد و حداکثر ۲۵۵ کاراکتر باشد. دوباره ارسال کنید.",
        adminChannelEditLabelCancelKeyboard(session.channelId),
      );
      return;
    }

    await clearChannelSession(ctx.from.id);
    await editPromptMessage(
      ctx.api,
      promptRef,
      `⚠️ <b>${err.message || "خطا در ذخیره لیبل"}</b>`,
      adminChannelEditLabelCancelKeyboard(session.channelId),
    );
  }
}

export function registerAdminMessageHandler(bot) {
  bot.on("message:text", async (ctx, next) => {
    if (!ctx.from || !isAdminUser(ctx.from.id)) {
      return next();
    }

    const channelSession = await getChannelSession(ctx.from.id);

    if (channelSession?.mode === ChannelSessionMode.EDIT_LABEL) {
      await handleChannelSessionMessage(ctx, channelSession, ctx.message.text.trim());
      return;
    }

    const serverSession = await getServerSession(ctx.from.id);

    if (serverSession) {
      await handleServerSessionMessage(ctx, serverSession, ctx.message.text.trim());
      return;
    }

    const session = await getAdminSession(ctx.from.id);

    if (!session) {
      return next();
    }

    const { action, returnTo } = session;
    const value = ctx.message.text.trim();
    const promptRef = getPromptRefFromSession(session);

    try {
      if (action === AdminSessionAction.SET_MASTER_WALLET) {
        await setMasterWalletAddress(value, ctx.from.id);
      } else if (action === AdminSessionAction.SET_CARD) {
        await setCardNumber(value, ctx.from.id);
      } else if (action === AdminSessionAction.SET_SHEBA) {
        await setShebaNumber(value, ctx.from.id);
      } else if (action === AdminSessionAction.SET_PANEL_UNLIMITED_CAPACITY) {
        const capacity = Number(value.replace(/[^\d]/g, ""));

        if (!Number.isInteger(capacity) || capacity < 0) {
          throw new Error("INVALID_CAPACITY");
        }

        await setPanelUnlimitedCapacity(capacity, ctx.from.id);
      } else if (action === AdminSessionAction.SET_PANEL_USAGE_PRICE_PER_GB) {
        await setSubscriptionPricingField(
          PricingField.PANEL_USAGE_PRICE_PER_GB,
          value,
          ctx.from.id,
        );
      } else if (action === AdminSessionAction.SET_OUTBOUND_PRICE_PER_GB) {
        await setSubscriptionPricingField(
          PricingField.OUTBOUND_PRICE_PER_GB,
          value,
          ctx.from.id,
        );
      } else if (action === AdminSessionAction.SET_PANEL_UNLIMITED_PRICE_PER_SUB) {
        await setSubscriptionPricingField(
          PricingField.PANEL_UNLIMITED_PRICE_PER_SUB,
          value,
          ctx.from.id,
        );
      } else if (action === AdminSessionAction.SET_PANEL_UNLIMITED_PRICE_PER_USER) {
        await setSubscriptionPricingField(
          PricingField.PANEL_UNLIMITED_PRICE_PER_USER,
          value,
          ctx.from.id,
        );
      } else {
        return next();
      }

      await clearAdminSession(ctx.from.id);

      const screen = await resolveReturnScreen(returnTo);

      await deleteUserMessage(ctx);
      await editPromptMessage(ctx.api, promptRef, screen.text, screen.keyboard);
    } catch (err) {
      if (err.message === "INVALID_ADDRESS") {
        await showAdminPromptError(
          ctx,
          session,
          "آدرس وارد شده معتبر نیست. لطفاً یک آدرس TRON معتبر (Base58) ارسال کنید.",
        );
        return;
      }

      if (err.message === "INVALID_CARD") {
        await showAdminPromptError(
          ctx,
          session,
          "شماره کارت معتبر نیست. لطفاً یک شماره کارت ۱۶ رقمی ارسال کنید.",
        );
        return;
      }

      if (err.message === "INVALID_SHEBA") {
        await showAdminPromptError(
          ctx,
          session,
          "شماره شبا معتبر نیست. لطفاً شماره شبا ۲۴ رقمی (با یا بدون IR) ارسال کنید.",
        );
        return;
      }

      if (err.message === "INVALID_CAPACITY") {
        await showAdminPromptError(
          ctx,
          session,
          "ظرفیت باید یک عدد صحیح و بزرگ‌تر یا مساوی صفر باشد.",
        );
        return;
      }

      if (err.message === "CAPACITY_BELOW_SOLD") {
        await showAdminPromptError(
          ctx,
          session,
          "ظرفیت جدید نمی‌تواند از تعداد فروخته‌شده کمتر باشد.",
        );
        return;
      }

      if (err.message === "INVALID_PRICE") {
        await showAdminPromptError(
          ctx,
          session,
          "قیمت باید یک عدد صحیح و بزرگ‌تر از صفر باشد.",
        );
        return;
      }

      throw err;
    }
  });
}
