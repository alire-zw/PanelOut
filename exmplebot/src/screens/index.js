import {
  CallbackData,
  parseAdminChannelDeleteConfirmId,
  parseAdminChannelDeleteId,
  parseAdminChannelDetailId,
  parseAdminChannelEditLabelId,
  parseAdminChannelToggleLockId,
  parseAdminChannelsListPage,
  parseAdminServerDeleteConfirmId,
  parseAdminServerDeleteId,
  parseAdminServerDetailId,
  parseAdminServerEdit,
  parseAdminServerRefreshId,
  parseAdminServerToggle,
  parseAdminServersListPage,
  parseManageServicesBack,
  parseManageServicesDetail,
  parseManageServicesPage,
  parseManageServicesToggle,
  isManageServicesListRefresh,
  parseOutboundVolumeAction,
  parseOutboundVolumePay,
  parsePanelVolumeAction,
  parseWalletInvoiceDetail,
  parseWalletInvoicesPage,
  parseWalletTransactionDetail,
  parseWalletTransactionsPage,
} from "../constants/callbacks.js";

import { adminPanelKeyboard } from "../keyboards/admin.keyboard.js";

import { adminUsersStatsKeyboard } from "../keyboards/admin-users-stats.keyboard.js";

import { backToMenuKeyboard } from "../keyboards/back.keyboard.js";
import { newServiceKeyboard } from "../keyboards/new-service.keyboard.js";
import { newServiceOutboundKeyboard } from "../keyboards/new-service-outbound.keyboard.js";
import { newServicePanelKeyboard } from "../keyboards/new-service-panel.keyboard.js";

import { startKeyboard } from "../keyboards/start.keyboard.js";

import { formatJalaliDateTime } from "../lib/tehran-time.js";

import {

  adminMessage,

  buildAdminUsersStatsMessage,

} from "../messages/admin.message.js";

import {

  adminSetCardPromptMessage,

  adminSetMasterWalletPromptMessage,

  adminSetShebaPromptMessage,

} from "../messages/admin-payment.message.js";

import {
  adminSetPanelUnlimitedCapacityPromptMessage,
} from "../messages/admin-panel-settings.message.js";
import {
  adminSetOutboundPricePromptMessage,
  adminSetPanelUsagePricePromptMessage,
  adminSetUnlimitedSubPricePromptMessage,
  adminSetUnlimitedUserPricePromptMessage,
} from "../messages/admin-pricing-settings.message.js";

import { adminPanelSettingsPromptKeyboard } from "../keyboards/admin-panel-settings.keyboard.js";
import { adminPricingSettingsPromptKeyboard } from "../keyboards/admin-pricing-settings.keyboard.js";

import { adminPaymentPromptKeyboard } from "../keyboards/admin-payment.keyboard.js";

import { newServiceMessage } from "../messages/new-service.message.js";
import { newServiceOutboundMessage } from "../messages/new-service-outbound.message.js";
import { buildNewServicePanelScreen } from "../services/panel-trial.service.js";
import { newServicePanelMessage } from "../messages/new-service-panel.message.js";
import {
  buildNewServiceOutboundVolumeScreen,
  buildNewServiceOutboundVolumeScreenFromAction,
} from "../services/new-service-outbound-volume.service.js";
import {
  buildNewServicePanelVolumeScreenFromAction,
} from "../services/new-service-panel-volume.service.js";
import { buildAdminPanelSettingsScreen } from "../services/admin-panel-settings.service.js";
import { buildAdminPricingSettingsScreen } from "../services/admin-pricing-settings.service.js";
import { buildOutboundVolumePaymentScreenForUser } from "../services/outbound-volume-payment.service.js";
import { buildOutboundUsageActivationScreen } from "../services/outbound-usage.service.js";
import { buildPanelUsageActivationScreen } from "../services/panel-usage.service.js";
import {
  buildManageServiceDetailScreen,
  buildManageServicesListScreen,
} from "../services/manage-services.service.js";

import { startMessage } from "../messages/start.message.js";

import { supportMessage } from "../messages/support.message.js";

import {

  buildAdminPaymentSettingsScreen,

  buildAdminRialSettingsScreen,

  buildAdminTronSettingsScreen,

} from "../services/admin-payment.service.js";

import { getUserStats } from "../services/user-stats.service.js";

import { buildWalletScreen } from "../services/wallet.service.js";
import {
  buildWalletInvoiceDetailScreen,
  buildWalletInvoicesScreen,
} from "../services/wallet-invoices.service.js";
import {
  buildWalletTransactionDetailScreen,
  buildWalletTransactionsScreen,
} from "../services/wallet-transactions.service.js";
import {
  buildAdminChannelAddStartScreen,
  buildAdminChannelDeleteConfirmScreen,
  buildAdminChannelDetailScreen,
  buildAdminChannelEditLabelStartScreen,
  buildAdminChannelsHubScreen,
  buildAdminChannelsListScreen,
  handleAdminChannelDeleteConfirm,
  handleAdminChannelToggleLock,
} from "../services/admin-channel.service.js";
import {
  buildAdminServerAddStartScreen,
  buildAdminServerDeleteConfirmScreen,
  buildAdminServerDetailScreen,
  buildAdminServerEditStartScreen,
  buildAdminServersHubScreen,
  buildAdminServersListScreen,
  handleAdminServerDeleteConfirm,
  handleAdminServerToggle,
} from "../services/admin-server.service.js";
import { buildChannelMembershipScreenIfNeeded } from "../services/channel-membership.service.js";

import {

  buildWalletRialAmountPromptScreen,

  buildWalletTopUpMethodScreen,

  buildWalletTronTopUpScreen,

} from "../services/wallet-topup.service.js";



const screens = {

  [CallbackData.NEW_SERVICE]: {

    text: newServiceMessage,

    keyboard: newServiceKeyboard,

  },

  [CallbackData.NEW_SERVICE_OUTBOUND]: {

    text: newServiceOutboundMessage,

    keyboard: newServiceOutboundKeyboard,

  },

  [CallbackData.NEW_SERVICE_PANEL]: {

    text: newServicePanelMessage,

    keyboard: () => newServicePanelKeyboard(),

  },

  [CallbackData.SUPPORT]: {

    text: supportMessage,

    keyboard: backToMenuKeyboard,

  },

  [CallbackData.ADMIN]: {

    text: adminMessage,

    keyboard: adminPanelKeyboard,

    adminOnly: true,

  },

  [CallbackData.ADMIN_BACK]: {

    text: adminMessage,

    keyboard: adminPanelKeyboard,

    adminOnly: true,

  },

};



async function buildUsersStatsScreen() {

  const stats = await getUserStats();

  const updatedAt = formatJalaliDateTime();



  return {

    text: buildAdminUsersStatsMessage(updatedAt),

    keyboard: adminUsersStatsKeyboard(stats),

  };

}



export async function getScreenByCallback(

  callbackData,

  { isAdmin = false, from = null, api = null } = {},

) {

  if (callbackData === CallbackData.BACK_TO_MENU) {
    if (from && api && !isAdmin) {
      const membership = await buildChannelMembershipScreenIfNeeded(api, from.id);

      if (membership) {
        return membership;
      }
    }

    return {

      text: startMessage,

      keyboard: startKeyboard(isAdmin),

    };

  }

  if (callbackData === CallbackData.VERIFY_MEMBERSHIP) {
    if (!from || !api) return null;

    const membership = await buildChannelMembershipScreenIfNeeded(api, from.id);

    if (membership) {
      return membership;
    }

    return {
      text: startMessage,
      keyboard: startKeyboard(isAdmin),
    };
  }



  if (callbackData === CallbackData.NEW_SERVICE_OUTBOUND_USAGE) {
    if (!from) return null;
    return buildOutboundUsageActivationScreen(from);
  }

  if (callbackData === CallbackData.NEW_SERVICE_PANEL_USAGE) {
    if (!from) return null;
    return buildPanelUsageActivationScreen(from);
  }

  if (callbackData === CallbackData.NEW_SERVICE_PANEL) {
    if (!from) return null;
    return buildNewServicePanelScreen(from);
  }

  const manageServicesPage = parseManageServicesPage(callbackData);
  if (manageServicesPage !== null) {
    if (!from) return null;
    return buildManageServicesListScreen(from, manageServicesPage, {
      refresh: isManageServicesListRefresh(callbackData),
    });
  }

  const manageServicesBackPage = parseManageServicesBack(callbackData);
  if (manageServicesBackPage !== null) {
    if (!from) return null;
    return buildManageServicesListScreen(from, manageServicesBackPage);
  }

  const manageServicesDetail = parseManageServicesDetail(callbackData);
  if (manageServicesDetail) {
    if (!from) return null;
    return buildManageServiceDetailScreen(
      from,
      manageServicesDetail.subscriptionId,
      manageServicesDetail.listPage,
      { refresh: manageServicesDetail.refresh },
    );
  }

  const panelVolumeAction = parsePanelVolumeAction(callbackData);

  if (panelVolumeAction) {
    if (
      panelVolumeAction.action === "display" ||
      panelVolumeAction.action === "users_display" ||
      panelVolumeAction.action === "days_display" ||
      panelVolumeAction.action === "continue"
    ) {
      return null;
    }

    return buildNewServicePanelVolumeScreenFromAction(panelVolumeAction, from?.id);
  }

  if (callbackData === CallbackData.ADMIN_PANEL_SETTINGS) {
    if (!isAdmin) return null;
    return buildAdminPanelSettingsScreen();
  }

  if (callbackData === CallbackData.ADMIN_PRICING_SETTINGS) {
    if (!isAdmin) return null;
    return buildAdminPricingSettingsScreen();
  }

  const outboundVolumeAction = parseOutboundVolumeAction(callbackData);

  if (outboundVolumeAction) {
    if (outboundVolumeAction.action === "display") {
      return null;
    }

    if (
      (outboundVolumeAction.action === "continue" ||
        outboundVolumeAction.action === "payment") &&
      from
    ) {
      return buildOutboundVolumePaymentScreenForUser(from, outboundVolumeAction.gb);
    }

    return await buildNewServiceOutboundVolumeScreenFromAction(outboundVolumeAction);
  }

  const outboundVolumePay = parseOutboundVolumePay(callbackData);

  if (outboundVolumePay) {
    return null;
  }

  if (callbackData === CallbackData.WALLET) {

    if (!from) return null;

    return buildWalletScreen(from);

  }



  const walletInvoicesPage = parseWalletInvoicesPage(callbackData);

  if (walletInvoicesPage !== null) {
    if (!from) return null;
    return buildWalletInvoicesScreen(from, walletInvoicesPage);
  }

  const walletInvoiceDetail = parseWalletInvoiceDetail(callbackData);

  if (walletInvoiceDetail) {
    if (!from) return null;
    return buildWalletInvoiceDetailScreen(
      from,
      walletInvoiceDetail.anchorChargeId,
      walletInvoiceDetail.listPage,
    );
  }

  const walletTransactionsPage = parseWalletTransactionsPage(callbackData);

  if (walletTransactionsPage !== null) {
    if (!from) return null;
    return buildWalletTransactionsScreen(from, walletTransactionsPage);
  }

  const walletTransactionDetail = parseWalletTransactionDetail(callbackData);

  if (walletTransactionDetail) {
    if (!from) return null;
    return buildWalletTransactionDetailScreen(
      from,
      walletTransactionDetail.type,
      walletTransactionDetail.id,
      walletTransactionDetail.listPage,
    );
  }



  if (callbackData === CallbackData.WALLET_TOP_UP) {

    if (!from) return null;

    return buildWalletTopUpMethodScreen(from);

  }



  if (callbackData === CallbackData.WALLET_TOP_UP_TRON) {

    if (!from) return null;

    return buildWalletTronTopUpScreen(from);

  }



  if (callbackData === CallbackData.WALLET_TOP_UP_RIAL) {

    if (!from) return null;

    return buildWalletRialAmountPromptScreen(from);

  }



  if (

    callbackData === CallbackData.ADMIN_USERS_STATS ||

    callbackData === CallbackData.ADMIN_REFRESH_STATS

  ) {

    if (!isAdmin) return null;

    return buildUsersStatsScreen();

  }



  if (

    callbackData === CallbackData.ADMIN_PAYMENT_SETTINGS ||

    callbackData === CallbackData.ADMIN_REFRESH_PAYMENT

  ) {

    if (!isAdmin) return null;

    return buildAdminPaymentSettingsScreen();

  }



  if (

    callbackData === CallbackData.ADMIN_TRON_SETTINGS ||

    callbackData === CallbackData.ADMIN_REFRESH_TRON ||

    callbackData === CallbackData.ADMIN_TOGGLE_TRON ||

    callbackData === CallbackData.ADMIN_CLEAR_MASTER_WALLET

  ) {

    if (!isAdmin) return null;

    return buildAdminTronSettingsScreen();

  }



  if (

    callbackData === CallbackData.ADMIN_RIAL_SETTINGS ||

    callbackData === CallbackData.ADMIN_REFRESH_RIAL ||

    callbackData === CallbackData.ADMIN_TOGGLE_RIAL ||

    callbackData === CallbackData.ADMIN_CLEAR_CARD ||

    callbackData === CallbackData.ADMIN_CLEAR_SHEBA

  ) {

    if (!isAdmin) return null;

    return buildAdminRialSettingsScreen();

  }



  if (callbackData === CallbackData.ADMIN_SET_MASTER_WALLET) {

    if (!isAdmin) return null;

    return {

      text: adminSetMasterWalletPromptMessage,

      keyboard: adminPaymentPromptKeyboard("tron"),

      awaitsTextInput: true,

    };

  }



  if (callbackData === CallbackData.ADMIN_SET_CARD) {

    if (!isAdmin) return null;

    return {

      text: adminSetCardPromptMessage,

      keyboard: adminPaymentPromptKeyboard("rial"),

      awaitsTextInput: true,

    };

  }



  if (callbackData === CallbackData.ADMIN_SET_SHEBA) {

    if (!isAdmin) return null;

    return {

      text: adminSetShebaPromptMessage,

      keyboard: adminPaymentPromptKeyboard("rial"),

      awaitsTextInput: true,

    };

  }

  if (callbackData === CallbackData.ADMIN_SET_PANEL_UNLIMITED_CAPACITY) {
    if (!isAdmin) return null;

    return {
      text: adminSetPanelUnlimitedCapacityPromptMessage,
      keyboard: adminPanelSettingsPromptKeyboard(),
      awaitsTextInput: true,
    };
  }

  if (callbackData === CallbackData.ADMIN_SET_PANEL_USAGE_PRICE) {
    if (!isAdmin) return null;

    return {
      text: adminSetPanelUsagePricePromptMessage,
      keyboard: adminPricingSettingsPromptKeyboard(),
      awaitsTextInput: true,
    };
  }

  if (callbackData === CallbackData.ADMIN_SET_OUTBOUND_PRICE) {
    if (!isAdmin) return null;

    return {
      text: adminSetOutboundPricePromptMessage,
      keyboard: adminPricingSettingsPromptKeyboard(),
      awaitsTextInput: true,
    };
  }

  if (callbackData === CallbackData.ADMIN_SET_UNLIMITED_SUB_PRICE) {
    if (!isAdmin) return null;

    return {
      text: adminSetUnlimitedSubPricePromptMessage,
      keyboard: adminPricingSettingsPromptKeyboard(),
      awaitsTextInput: true,
    };
  }

  if (callbackData === CallbackData.ADMIN_SET_UNLIMITED_USER_PRICE) {
    if (!isAdmin) return null;

    return {
      text: adminSetUnlimitedUserPricePromptMessage,
      keyboard: adminPricingSettingsPromptKeyboard(),
      awaitsTextInput: true,
    };
  }

  if (callbackData === CallbackData.ADMIN_CHANNELS) {
    if (!isAdmin) return null;
    return buildAdminChannelsHubScreen();
  }

  if (callbackData === CallbackData.ADMIN_CHANNELS_ADD_CANCEL) {
    if (!isAdmin) return null;
    return buildAdminChannelsHubScreen();
  }

  if (callbackData === CallbackData.ADMIN_CHANNELS_ADD) {
    if (!isAdmin) return null;
    return { ...(await buildAdminChannelAddStartScreen()), beginsChannelSession: true };
  }

  const channelsListPage = parseAdminChannelsListPage(callbackData);
  if (channelsListPage !== null) {
    if (!isAdmin) return null;
    return buildAdminChannelsListScreen(channelsListPage);
  }

  const channelDetailId = parseAdminChannelDetailId(callbackData);
  if (channelDetailId) {
    if (!isAdmin) return null;
    return buildAdminChannelDetailScreen(channelDetailId, api);
  }

  const channelToggleLockId = parseAdminChannelToggleLockId(callbackData);
  if (channelToggleLockId) {
    if (!isAdmin) return null;
    return handleAdminChannelToggleLock(channelToggleLockId, api);
  }

  const channelDeleteId = parseAdminChannelDeleteId(callbackData);
  if (channelDeleteId) {
    if (!isAdmin) return null;
    return buildAdminChannelDeleteConfirmScreen(channelDeleteId);
  }

  const channelDeleteConfirmId = parseAdminChannelDeleteConfirmId(callbackData);
  if (channelDeleteConfirmId) {
    if (!isAdmin) return null;
    return handleAdminChannelDeleteConfirm(channelDeleteConfirmId);
  }

  const channelEditLabelId = parseAdminChannelEditLabelId(callbackData);
  if (channelEditLabelId) {
    if (!isAdmin) return null;
    return {
      ...(await buildAdminChannelEditLabelStartScreen(channelEditLabelId)),
      beginsChannelSession: true,
    };
  }

  if (callbackData === CallbackData.ADMIN_SERVERS) {
    if (!isAdmin) return null;
    return buildAdminServersHubScreen();
  }

  if (callbackData === CallbackData.ADMIN_SERVERS_ADD_CANCEL) {
    if (!isAdmin) return null;
    return buildAdminServersHubScreen();
  }

  if (callbackData === CallbackData.ADMIN_SERVERS_ADD) {
    if (!isAdmin) return null;
    return { ...(await buildAdminServerAddStartScreen()), beginsServerSession: true };
  }

  const serversListPage = parseAdminServersListPage(callbackData);
  if (serversListPage !== null) {
    if (!isAdmin) return null;
    return buildAdminServersListScreen(serversListPage);
  }

  const serverDetailId =
    parseAdminServerDetailId(callbackData) ?? parseAdminServerRefreshId(callbackData);
  if (serverDetailId) {
    if (!isAdmin) return null;
    return buildAdminServerDetailScreen(serverDetailId);
  }

  const serverToggle = parseAdminServerToggle(callbackData);
  if (serverToggle) {
    if (!isAdmin) return null;
    return handleAdminServerToggle(serverToggle.kind, serverToggle.serverId);
  }

  const serverDeleteId = parseAdminServerDeleteId(callbackData);
  if (serverDeleteId) {
    if (!isAdmin) return null;
    return buildAdminServerDeleteConfirmScreen(serverDeleteId);
  }

  const serverDeleteConfirmId = parseAdminServerDeleteConfirmId(callbackData);
  if (serverDeleteConfirmId) {
    if (!isAdmin) return null;
    return handleAdminServerDeleteConfirm(serverDeleteConfirmId);
  }

  const serverEdit = parseAdminServerEdit(callbackData);
  if (serverEdit) {
    if (!isAdmin) return null;
    return {
      ...(await buildAdminServerEditStartScreen(serverEdit.serverId, serverEdit.field)),
      beginsServerSession: true,
    };
  }



  const screen = screens[callbackData];

  if (!screen) return null;



  if (screen.adminOnly && !isAdmin) {

    return null;

  }



  return {

    text: screen.text,

    keyboard: screen.keyboard(),

  };

}


