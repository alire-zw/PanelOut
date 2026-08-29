import { GrammyError } from "grammy";
import {
  ADMIN_CALLBACKS,
  ADMIN_PLACEHOLDER_CALLBACKS,
  CallbackData,
  isAdminChannelDynamicCallback,
  isAdminServerDynamicCallback,
  isManageServicesCallback,
  isManageServicesListRefresh,
  isOutboundUsageCallback,
  isOutboundVolumeCallback,
  isPanelVolumeCallback,
  parsePanelVolumeAction,
  isWalletInvoicesCallback,
  parseManageServicesBack,
  parseManageServicesDetail,
  parseManageServicesPage,
  parseManageServicesToggle,
  parseOutboundUsageDeactivate,
  isWalletTransactionsCallback,
  parseAdminChannelEditLabelId,
  parseAdminServerEdit,
  parseOutboundVolumePay,
} from "../constants/callbacks.js";
import { isAdminUser } from "../lib/admin.js";
import { safeAnswerCallbackQuery, safeEditCallbackMessage } from "../lib/callback-query.js";
import { getPromptRefFromCallback } from "../lib/prompt-message.js";
import { getScreenByCallback } from "../screens/index.js";
import {
  AdminSessionAction,
  attachAdminPrompt,
  clearAdminSession,
  setAdminSession,
} from "../services/admin-session.service.js";
import {
  beginPanelTrialUsernameSession,
  beginPanelUnlimitedUsernameSession,
  beginPanelUsageUsernameSession,
  beginRialAmountSession,
} from "../services/user-session.service.js";
import {
  buildPanelTrialUsernamePromptScreen,
} from "../services/panel-trial.service.js";
import { validatePanelUnlimitedPurchase } from "../services/new-service-panel-volume.service.js";
import {
  buildPanelUsageProcessingScreen,
  handlePanelUsageConfirmStart,
  handlePanelUsageUpgradeFromTrial,
} from "../services/panel-usage.service.js";
import {
  buildPanelUnlimitedProcessingScreen,
  buildPanelUnlimitedUsernamePromptScreen,
  handlePanelUnlimitedRepeatPurchase,
} from "../services/panel-unlimited.service.js";
import { getUserPanelUnlimitedAdmin } from "../services/user.service.js";
import { panelTrialAlreadyClaimedMessage } from "../messages/panel-trial.message.js";
import { panelTrialPromptKeyboard } from "../keyboards/panel-trial.keyboard.js";
import { findUserPanelTrialSubscription } from "../services/user-subscription.service.js";
import {
  clearCardNumber,
  clearMasterWalletAddress,
  clearShebaNumber,
  toggleRialEnabled,
  toggleTronEnabled,
} from "../services/payment-settings.service.js";
import {
  approveOutboundVolumeOrder,
  rejectOutboundVolumeOrder,
} from "../services/outbound-volume-order.service.js";
import {
  beginOutboundVolumeCardPayment,
  buildOutboundVolumeWalletProcessingScreen,
  handleOutboundVolumeWalletPayment,
} from "../services/outbound-volume-payment.service.js";
import {
  buildOutboundUsageProcessingScreen,
  handleOutboundUsageConfirm,
  handleOutboundUsageDeactivate,
} from "../services/outbound-usage.service.js";
import {
  approveRialDeposit,
  rejectRialDeposit,
} from "../services/rial-deposit.service.js";
import { clearUserSession } from "../services/user-session.service.js";
import {
  attachChannelPrompt,
  clearChannelSession,
} from "../services/admin-channel-session.service.js";
import {
  beginChannelAddSession,
  beginChannelEditLabelSession,
} from "../services/admin-channel.service.js";
import { buildChannelMembershipScreenIfNeeded } from "../services/channel-membership.service.js";
import {
  attachServerPrompt,
  clearServerSession,
} from "../services/admin-server-session.service.js";
import {
  beginServerAddSession,
  beginServerEditSession,
} from "../services/admin-server.service.js";
import {
  buildManageServiceDetailProcessingScreen,
  buildManageServiceDetailScreen,
  buildManageServicesListScreen,
  buildManageServicesProcessingScreen,
  handleManageServiceToggleScreen,
  shouldShowManageServiceDetailLoading,
  shouldShowManageServicesListLoading,
} from "../services/manage-services.service.js";

const RIAL_DEPOSIT_CALLBACK =
  /^admin:rial_deposit:(approve|reject|reviewed):(\d+)$/;

const OUTBOUND_ORDER_CALLBACK =
  /^admin:outbound_order:(approve|reject|reviewed):(\d+)$/;

function resolveManageServicesListPage(callbackData) {
  const backPage = parseManageServicesBack(callbackData);

  if (backPage !== null) {
    return backPage;
  }

  const page = parseManageServicesPage(callbackData);

  return page !== null ? page : null;
}

const KNOWN_CALLBACKS = new Set(Object.values(CallbackData));

const WALLET_PLACEHOLDER_CALLBACKS = new Set([]);

const NEW_SERVICE_PLACEHOLDER_CALLBACKS = new Set([]);

const CLEAR_USER_SESSION = new Set([
  CallbackData.WALLET,
  CallbackData.WALLET_TOP_UP,
  CallbackData.WALLET_TOP_UP_TRON,
  CallbackData.BACK_TO_MENU,
  CallbackData.NEW_SERVICE,
  CallbackData.NEW_SERVICE_OUTBOUND,
  CallbackData.NEW_SERVICE_OUTBOUND_VOLUME,
  CallbackData.NEW_SERVICE_PANEL,
  CallbackData.NEW_SERVICE_PANEL_TRIAL,
  CallbackData.NEW_SERVICE_PANEL_VOLUME,
  CallbackData.NEW_SERVICE_PANEL_USAGE,
  CallbackData.MANAGE_SERVICES,
]);

const CLEAR_ADMIN_SESSION = new Set([
  CallbackData.ADMIN_PAYMENT_SETTINGS,
  CallbackData.ADMIN_TRON_SETTINGS,
  CallbackData.ADMIN_RIAL_SETTINGS,
]);

const CLEAR_SERVER_SESSION = new Set([
  CallbackData.ADMIN,
  CallbackData.ADMIN_BACK,
  CallbackData.ADMIN_SERVERS,
  CallbackData.ADMIN_SERVERS_LIST,
  CallbackData.ADMIN_SERVERS_ADD_CANCEL,
  CallbackData.ADMIN_CHANNELS,
  CallbackData.ADMIN_CHANNELS_LIST,
  CallbackData.ADMIN_CHANNELS_ADD_CANCEL,
  CallbackData.BACK_TO_MENU,
]);

const CLEAR_CHANNEL_SESSION = new Set([
  CallbackData.ADMIN,
  CallbackData.ADMIN_BACK,
  CallbackData.ADMIN_CHANNELS,
  CallbackData.ADMIN_CHANNELS_LIST,
  CallbackData.ADMIN_CHANNELS_ADD_CANCEL,
  CallbackData.BACK_TO_MENU,
]);

const ADMIN_TEXT_PROMPTS = new Set([
  CallbackData.ADMIN_SET_MASTER_WALLET,
  CallbackData.ADMIN_SET_CARD,
  CallbackData.ADMIN_SET_SHEBA,
  CallbackData.ADMIN_SET_PANEL_UNLIMITED_CAPACITY,
  CallbackData.ADMIN_SET_PANEL_USAGE_PRICE,
  CallbackData.ADMIN_SET_OUTBOUND_PRICE,
  CallbackData.ADMIN_SET_UNLIMITED_SUB_PRICE,
  CallbackData.ADMIN_SET_UNLIMITED_USER_PRICE,
]);

export function registerCallbackHandler(bot) {
  bot.on("callback_query:data", async (ctx) => {
    const isAdmin = ctx.from ? isAdminUser(ctx.from.id) : false;
    const callbackData = ctx.callbackQuery.data;

    if (ADMIN_CALLBACKS.has(callbackData) && !isAdmin) {
      await safeAnswerCallbackQuery(ctx, {
        text: "دسترسی ندارید.",
        show_alert: true,
      });
      return;
    }

    if (
      callbackData === CallbackData.ADMIN_STATS_DISPLAY ||
      callbackData === CallbackData.ADMIN_PAYMENT_DISPLAY ||
      callbackData === CallbackData.ADMIN_SERVERS_DISPLAY ||
      callbackData === CallbackData.ADMIN_CHANNELS_DISPLAY ||
      callbackData === CallbackData.WALLET_TX_DISPLAY ||
      callbackData === CallbackData.WALLET_INVOICE_DISPLAY ||
      callbackData === CallbackData.NEW_SERVICE_OUTBOUND_VOLUME_DISPLAY ||
      callbackData === CallbackData.NEW_SERVICE_PANEL_VOLUME_DISPLAY ||
      callbackData === CallbackData.NEW_SERVICE_PANEL_VOLUME_USERS_DISPLAY ||
      callbackData === CallbackData.NEW_SERVICE_PANEL_VOLUME_DAYS_DISPLAY ||
      callbackData === CallbackData.MANAGE_SERVICES_DISPLAY ||
      callbackData === CallbackData.PANEL_ADMIN_GLASS_DISPLAY
    ) {
      await safeAnswerCallbackQuery(ctx);
      return;
    }

    const panelVolumeContinue = parsePanelVolumeAction(callbackData);

    if (panelVolumeContinue?.action === "continue" && ctx.from) {
      const purchase = await validatePanelUnlimitedPurchase(
        panelVolumeContinue.gb,
        panelVolumeContinue.maxUsers,
        ctx.from.id,
        panelVolumeContinue.days,
      );

      if (!purchase.ok) {
        const message =
          purchase.reason === "SOLD_OUT"
            ? "ظرفیت سرویس نامحدود تکمیل شده است."
            : "تعداد انتخابی بیش از ظرفیت باقی‌مانده است.";

        await safeAnswerCallbackQuery(ctx, { text: message, show_alert: true });
        return;
      }

      await safeAnswerCallbackQuery(ctx);

      const purchasePayload = {
        count: purchase.count,
        maxUsers: purchase.maxUsers,
        days: purchase.days,
      };

      const existingAdmin = await getUserPanelUnlimitedAdmin(ctx.from.id);

      if (existingAdmin?.username) {
        const processing = buildPanelUnlimitedProcessingScreen();
        await ctx.editMessageText(processing.text, {
          parse_mode: "HTML",
          reply_markup: processing.keyboard,
          link_preview_options: { is_disabled: true },
        });

        const result = await handlePanelUnlimitedRepeatPurchase(ctx.from, purchasePayload, {
          isAdmin: isAdminUser(ctx.from.id),
        });

        await ctx.editMessageText(result.text, {
          parse_mode: "HTML",
          reply_markup: result.keyboard,
          link_preview_options: { is_disabled: true },
        });

        return;
      }

      const screen = buildPanelUnlimitedUsernamePromptScreen(purchasePayload);

      await ctx.editMessageText(screen.text, {
        parse_mode: "HTML",
        reply_markup: screen.keyboard,
        link_preview_options: { is_disabled: true },
      });

      const prompt = getPromptRefFromCallback(ctx);

      if (prompt) {
        await beginPanelUnlimitedUsernameSession(ctx.from.id, prompt, purchasePayload);
      }

      return;
    }

    if (isAdminServerDynamicCallback(callbackData) && !isAdmin) {
      await safeAnswerCallbackQuery(ctx, {
        text: "دسترسی ندارید.",
        show_alert: true,
      });
      return;
    }

    if (isAdminChannelDynamicCallback(callbackData) && !isAdmin) {
      await safeAnswerCallbackQuery(ctx, {
        text: "دسترسی ندارید.",
        show_alert: true,
      });
      return;
    }

    const rialDepositMatch = callbackData.match(RIAL_DEPOSIT_CALLBACK);

    if (rialDepositMatch) {
      if (!isAdmin) {
        await safeAnswerCallbackQuery(ctx, {
          text: "دسترسی ندارید.",
          show_alert: true,
        });
        return;
      }

      const [, action, depositId] = rialDepositMatch;
      const reviewerName = ctx.from
        ? [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ")
        : "ادمین";

      if (action === "reviewed") {
        await safeAnswerCallbackQuery(ctx);
        return;
      }

      try {
        if (action === "approve") {
          await approveRialDeposit(depositId, ctx.from.id, reviewerName);
          await safeAnswerCallbackQuery(ctx, { text: "واریز تأیید شد." });
        } else {
          await rejectRialDeposit(depositId, ctx.from.id, reviewerName);
          await safeAnswerCallbackQuery(ctx, { text: "واریز رد شد." });
        }
      } catch (err) {
        const message =
          err.message === "ALREADY_REVIEWED"
            ? "این درخواست قبلاً بررسی شده است."
            : "خطا در بررسی درخواست.";

        await safeAnswerCallbackQuery(ctx, { text: message, show_alert: true });
      }

      return;
    }

    const outboundOrderMatch = callbackData.match(OUTBOUND_ORDER_CALLBACK);

    if (outboundOrderMatch) {
      if (!isAdmin) {
        await safeAnswerCallbackQuery(ctx, {
          text: "دسترسی ندارید.",
          show_alert: true,
        });
        return;
      }

      const [, action, orderId] = outboundOrderMatch;
      const reviewerName = ctx.from
        ? [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ")
        : "ادمین";

      if (action === "reviewed") {
        await safeAnswerCallbackQuery(ctx);
        return;
      }

      try {
        if (action === "approve") {
          await approveOutboundVolumeOrder(orderId, ctx.from.id, reviewerName);
          await safeAnswerCallbackQuery(ctx, { text: "سفارش تأیید شد." });
        } else {
          await rejectOutboundVolumeOrder(orderId, ctx.from.id, reviewerName);
          await safeAnswerCallbackQuery(ctx, { text: "سفارش رد شد." });
        }
      } catch (err) {
        const message =
          err.message === "ALREADY_REVIEWED"
            ? "این سفارش قبلاً بررسی شده است."
            : "خطا در بررسی سفارش.";

        await safeAnswerCallbackQuery(ctx, { text: message, show_alert: true });
      }

      return;
    }

    if (callbackData === CallbackData.NEW_SERVICE_PANEL_TRIAL && ctx.from) {
      await safeAnswerCallbackQuery(ctx);

      const existing = await findUserPanelTrialSubscription(ctx.from.id);

      if (existing) {
        await ctx.editMessageText(panelTrialAlreadyClaimedMessage, {
          parse_mode: "HTML",
          reply_markup: panelTrialPromptKeyboard(),
          link_preview_options: { is_disabled: true },
        });
        return;
      }

      const screen = buildPanelTrialUsernamePromptScreen();

      await ctx.editMessageText(screen.text, {
        parse_mode: "HTML",
        reply_markup: screen.keyboard,
        link_preview_options: { is_disabled: true },
      });

      const prompt = getPromptRefFromCallback(ctx);

      if (prompt) {
        await beginPanelTrialUsernameSession(ctx.from.id, prompt);
      }

      return;
    }

    if (callbackData === CallbackData.NEW_SERVICE_OUTBOUND_USAGE_CONFIRM && ctx.from) {
      await safeAnswerCallbackQuery(ctx);

      const processing = buildOutboundUsageProcessingScreen();

      await ctx.editMessageText(processing.text, {
        parse_mode: "HTML",
        reply_markup: processing.keyboard,
        link_preview_options: { is_disabled: true },
      });

      const result = await handleOutboundUsageConfirm(ctx.from);

      await ctx.editMessageText(result.text, {
        parse_mode: "HTML",
        reply_markup: result.keyboard,
        link_preview_options: { is_disabled: true },
      });
      return;
    }

    if (callbackData === CallbackData.NEW_SERVICE_PANEL_USAGE_CONFIRM && ctx.from) {
      await safeAnswerCallbackQuery(ctx);

      const result = await handlePanelUsageConfirmStart(ctx.from);

      if (!result.ok) {
        if (result.alreadyActive && result.screen) {
          await ctx.editMessageText(result.screen.text, {
            parse_mode: "HTML",
            reply_markup: result.screen.keyboard,
            link_preview_options: { is_disabled: true },
          });
          return;
        }

        await ctx.editMessageText(result.text, {
          parse_mode: "HTML",
          reply_markup: result.keyboard,
          link_preview_options: { is_disabled: true },
        });
        return;
      }

      if (result.upgradeFromTrial) {
        const processing = buildPanelUsageProcessingScreen();
        await ctx.editMessageText(processing.text, {
          parse_mode: "HTML",
          reply_markup: processing.keyboard,
          link_preview_options: { is_disabled: true },
        });

        const screen = await handlePanelUsageUpgradeFromTrial(ctx.from, {
          isAdmin: isAdminUser(ctx.from.id),
        });

        await ctx.editMessageText(screen.text, {
          parse_mode: "HTML",
          reply_markup: screen.keyboard,
          link_preview_options: { is_disabled: true },
        });
        return;
      }

      await ctx.editMessageText(result.screen.text, {
        parse_mode: "HTML",
        reply_markup: result.screen.keyboard,
        link_preview_options: { is_disabled: true },
      });

      const prompt = getPromptRefFromCallback(ctx);

      if (prompt) {
        await beginPanelUsageUsernameSession(ctx.from.id, prompt);
      }

      return;
    }

    const manageServicesListPage = resolveManageServicesListPage(callbackData);

    if (manageServicesListPage !== null && ctx.from) {
      await safeAnswerCallbackQuery(ctx);

      const listRefresh = isManageServicesListRefresh(callbackData);
      const showLoading = await shouldShowManageServicesListLoading(
        ctx.from,
        manageServicesListPage,
        listRefresh,
      );

      if (showLoading) {
        const processing = buildManageServicesProcessingScreen();
        await safeEditCallbackMessage(ctx, processing.text, processing.keyboard);
      }

      const screen = await buildManageServicesListScreen(ctx.from, manageServicesListPage, {
        refresh: listRefresh,
      });

      await safeEditCallbackMessage(ctx, screen.text, screen.keyboard);
      return;
    }

    const manageServicesDetail = parseManageServicesDetail(callbackData);

    if (manageServicesDetail && ctx.from) {
      await safeAnswerCallbackQuery(ctx);

      const showLoading = await shouldShowManageServiceDetailLoading(
        manageServicesDetail.subscriptionId,
        manageServicesDetail.refresh,
      );

      if (showLoading) {
        const processing = buildManageServiceDetailProcessingScreen();
        await safeEditCallbackMessage(ctx, processing.text, processing.keyboard);
      }

      const screen = await buildManageServiceDetailScreen(
        ctx.from,
        manageServicesDetail.subscriptionId,
        manageServicesDetail.listPage,
        { refresh: manageServicesDetail.refresh },
      );

      await safeEditCallbackMessage(ctx, screen.text, screen.keyboard);
      return;
    }

    const manageServicesToggle = parseManageServicesToggle(callbackData);

    if (manageServicesToggle && ctx.from) {
      const result = await handleManageServiceToggleScreen(
        ctx.from,
        manageServicesToggle.subscriptionId,
        manageServicesToggle.listPage,
      );

      if (result.alert) {
        await safeAnswerCallbackQuery(ctx, {
          text: result.alert,
          show_alert: true,
        });
      } else {
        await safeAnswerCallbackQuery(ctx);
      }

      await safeEditCallbackMessage(ctx, result.screen.text, result.screen.keyboard);
      return;
    }

    const outboundUsageDeactivate = parseOutboundUsageDeactivate(callbackData);

    if (outboundUsageDeactivate && ctx.from) {
      await safeAnswerCallbackQuery(ctx);

      const screen = await handleOutboundUsageDeactivate(
        ctx.from,
        outboundUsageDeactivate.subscriptionId,
      );

      await ctx.editMessageText(screen.text, {
        parse_mode: "HTML",
        reply_markup: screen.keyboard,
        link_preview_options: { is_disabled: true },
      });
      return;
    }

    const outboundVolumePay = parseOutboundVolumePay(callbackData);

    if (outboundVolumePay && ctx.from) {
      await safeAnswerCallbackQuery(ctx);

      if (outboundVolumePay.method === "wallet") {
        const processing = buildOutboundVolumeWalletProcessingScreen();

        await ctx.editMessageText(processing.text, {
          parse_mode: "HTML",
          reply_markup: processing.keyboard,
          link_preview_options: { is_disabled: true },
        });

        const result = await handleOutboundVolumeWalletPayment(
          ctx.from,
          outboundVolumePay.gb,
        );

        await ctx.editMessageText(result.text, {
          parse_mode: "HTML",
          reply_markup: result.keyboard,
          link_preview_options: { is_disabled: true },
        });
        return;
      }

      if (outboundVolumePay.method === "card") {
        const prompt = getPromptRefFromCallback(ctx);
        const screen = await beginOutboundVolumeCardPayment(
          ctx.from,
          outboundVolumePay.gb,
          prompt,
        );

        await ctx.editMessageText(screen.text, {
          parse_mode: "HTML",
          reply_markup: screen.keyboard,
          link_preview_options: { is_disabled: true },
        });
        return;
      }
    }

    if (WALLET_PLACEHOLDER_CALLBACKS.has(callbackData)) {
      await safeAnswerCallbackQuery(ctx, { text: "به زودی فعال می‌شود." });
      return;
    }

    if (NEW_SERVICE_PLACEHOLDER_CALLBACKS.has(callbackData)) {
      await safeAnswerCallbackQuery(ctx, { text: "به زودی فعال می‌شود." });
      return;
    }

    if (ADMIN_PLACEHOLDER_CALLBACKS.has(callbackData)) {
      await safeAnswerCallbackQuery(ctx, { text: "به زودی فعال می‌شود." });
      return;
    }

    if (
      !KNOWN_CALLBACKS.has(callbackData) &&
      !isWalletTransactionsCallback(callbackData) &&
      !isWalletInvoicesCallback(callbackData) &&
      !isAdminServerDynamicCallback(callbackData) &&
      !isAdminChannelDynamicCallback(callbackData) &&
      !isOutboundVolumeCallback(callbackData) &&
      !isPanelVolumeCallback(callbackData) &&
      !isOutboundUsageCallback(callbackData) &&
      !isManageServicesCallback(callbackData)
    ) {
      await safeAnswerCallbackQuery(ctx, { text: "گزینه نامعتبر است." });
      return;
    }

    if (
      callbackData === CallbackData.VERIFY_MEMBERSHIP &&
      ctx.from &&
      (await buildChannelMembershipScreenIfNeeded(ctx.api, ctx.from.id))
    ) {
      await safeAnswerCallbackQuery(ctx, {
        text: "لطفاً در تمام کانال‌ها عضو شوید.",
        show_alert: true,
      });
    } else {
      await safeAnswerCallbackQuery(ctx);
    }

    if (ctx.from && CLEAR_USER_SESSION.has(callbackData)) {
      await clearUserSession(ctx.from.id);
    }

    if (ctx.from && CLEAR_ADMIN_SESSION.has(callbackData)) {
      await clearAdminSession(ctx.from.id);
    }

    if (ctx.from && CLEAR_SERVER_SESSION.has(callbackData)) {
      await clearServerSession(ctx.from.id);
    }

    if (ctx.from && CLEAR_CHANNEL_SESSION.has(callbackData)) {
      await clearChannelSession(ctx.from.id);
    }

    if (callbackData === CallbackData.ADMIN_SERVERS_ADD_CANCEL && ctx.from) {
      await clearServerSession(ctx.from.id);
    }

    if (callbackData === CallbackData.ADMIN_CHANNELS_ADD_CANCEL && ctx.from) {
      await clearChannelSession(ctx.from.id);
    }

    if (callbackData === CallbackData.ADMIN_SET_MASTER_WALLET && isAdmin && ctx.from) {
      await clearServerSession(ctx.from.id);
      await setAdminSession(
        ctx.from.id,
        AdminSessionAction.SET_MASTER_WALLET,
        "tron",
      );
    }

    if (callbackData === CallbackData.ADMIN_SET_CARD && isAdmin && ctx.from) {
      await clearServerSession(ctx.from.id);
      await setAdminSession(ctx.from.id, AdminSessionAction.SET_CARD, "rial");
    }

    if (callbackData === CallbackData.ADMIN_SET_SHEBA && isAdmin && ctx.from) {
      await clearServerSession(ctx.from.id);
      await setAdminSession(ctx.from.id, AdminSessionAction.SET_SHEBA, "rial");
    }

    if (
      callbackData === CallbackData.ADMIN_SET_PANEL_UNLIMITED_CAPACITY &&
      isAdmin &&
      ctx.from
    ) {
      await clearServerSession(ctx.from.id);
      await setAdminSession(
        ctx.from.id,
        AdminSessionAction.SET_PANEL_UNLIMITED_CAPACITY,
        "panel",
      );
    }

    if (callbackData === CallbackData.ADMIN_SET_PANEL_USAGE_PRICE && isAdmin && ctx.from) {
      await clearServerSession(ctx.from.id);
      await setAdminSession(
        ctx.from.id,
        AdminSessionAction.SET_PANEL_USAGE_PRICE_PER_GB,
        "pricing",
      );
    }

    if (callbackData === CallbackData.ADMIN_SET_OUTBOUND_PRICE && isAdmin && ctx.from) {
      await clearServerSession(ctx.from.id);
      await setAdminSession(
        ctx.from.id,
        AdminSessionAction.SET_OUTBOUND_PRICE_PER_GB,
        "pricing",
      );
    }

    if (callbackData === CallbackData.ADMIN_SET_UNLIMITED_SUB_PRICE && isAdmin && ctx.from) {
      await clearServerSession(ctx.from.id);
      await setAdminSession(
        ctx.from.id,
        AdminSessionAction.SET_PANEL_UNLIMITED_PRICE_PER_SUB,
        "pricing",
      );
    }

    if (callbackData === CallbackData.ADMIN_SET_UNLIMITED_USER_PRICE && isAdmin && ctx.from) {
      await clearServerSession(ctx.from.id);
      await setAdminSession(
        ctx.from.id,
        AdminSessionAction.SET_PANEL_UNLIMITED_PRICE_PER_USER,
        "pricing",
      );
    }

    if (callbackData === CallbackData.ADMIN_CLEAR_MASTER_WALLET && isAdmin && ctx.from) {
      await clearMasterWalletAddress(ctx.from.id);
      await clearAdminSession(ctx.from.id);
    }

    if (callbackData === CallbackData.ADMIN_CLEAR_CARD && isAdmin && ctx.from) {
      await clearCardNumber(ctx.from.id);
      await clearAdminSession(ctx.from.id);
    }

    if (callbackData === CallbackData.ADMIN_CLEAR_SHEBA && isAdmin && ctx.from) {
      await clearShebaNumber(ctx.from.id);
      await clearAdminSession(ctx.from.id);
    }

    if (callbackData === CallbackData.ADMIN_TOGGLE_TRON && isAdmin && ctx.from) {
      await toggleTronEnabled(ctx.from.id);
    }

    if (callbackData === CallbackData.ADMIN_TOGGLE_RIAL && isAdmin && ctx.from) {
      await toggleRialEnabled(ctx.from.id);
    }

    const screen = await getScreenByCallback(callbackData, {
      isAdmin,
      from: ctx.from,
      api: ctx.api,
    });
    if (!screen) return;

    try {
      await ctx.editMessageText(screen.text, {
        parse_mode: "HTML",
        reply_markup: screen.keyboard,
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      const isUnchanged =
        err instanceof GrammyError &&
        err.description.includes("message is not modified");

      if (!isUnchanged) {
        throw err;
      }
    }

    if (screen.beginsChannelSession && ctx.from) {
      await clearAdminSession(ctx.from.id);
      await clearServerSession(ctx.from.id);

      const channelEditLabelId = parseAdminChannelEditLabelId(callbackData);

      if (callbackData === CallbackData.ADMIN_CHANNELS_ADD) {
        await beginChannelAddSession(ctx.from.id);
      } else if (channelEditLabelId) {
        await beginChannelEditLabelSession(ctx.from.id, channelEditLabelId);
      }

      const prompt = getPromptRefFromCallback(ctx);

      if (prompt) {
        await attachChannelPrompt(ctx.from.id, prompt);
      }
    } else if (screen.beginsServerSession && ctx.from) {
      await clearAdminSession(ctx.from.id);
      await clearChannelSession(ctx.from.id);
      const serverEdit = parseAdminServerEdit(callbackData);

      if (callbackData === CallbackData.ADMIN_SERVERS_ADD) {
        await beginServerAddSession(ctx.from.id);
      } else if (serverEdit) {
        await beginServerEditSession(ctx.from.id, serverEdit.serverId, serverEdit.field);
      }

      const prompt = getPromptRefFromCallback(ctx);

      if (prompt) {
        await attachServerPrompt(ctx.from.id, prompt);
      }
    } else if (screen.awaitsTextInput && ctx.from) {
      const prompt = getPromptRefFromCallback(ctx);

      if (prompt) {
        if (ADMIN_TEXT_PROMPTS.has(callbackData)) {
          await attachAdminPrompt(ctx.from.id, prompt);
        } else {
          await beginRialAmountSession(ctx.from.id, prompt);
        }
      }
    }
  });
}
