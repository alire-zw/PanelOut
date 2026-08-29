import { PANEL_TRIAL_SERVER_ID, ServiceType } from "../constants/service-types.js";
import { normalizePanelTrialError } from "../lib/panel-trial-error.js";
import { logger } from "../lib/logger.js";
import { panelTrialPromptKeyboard, panelTrialSuccessKeyboard } from "../keyboards/panel-trial.keyboard.js";
import {
  buildPanelTrialFailedMessage,
  buildPanelTrialSuccessMessage,
  panelTrialAlreadyClaimedMessage,
  panelTrialProcessingMessage,
  panelTrialUnavailableMessage,
  panelTrialUsernamePromptMessage,
} from "../messages/panel-trial.message.js";
import { createPanelTrialAdmin } from "./panel-trial-provision.service.js";
import {
  createUserSubscription,
  findUserPanelTrialSubscription,
} from "./user-subscription.service.js";
import { findServerById, isServerActive } from "./server.service.js";
import { savePanelUsageAdminPassword } from "./user.service.js";
import { buildNewServicePanelMessage } from "../messages/new-service-panel.message.js";
import { newServicePanelKeyboard } from "../keyboards/new-service-panel.keyboard.js";

export async function buildNewServicePanelScreen(from) {
  const trial = from ? await findUserPanelTrialSubscription(from.id) : null;
  const showTrial = !trial;

  return {
    text: buildNewServicePanelMessage({ showTrial }),
    keyboard: newServicePanelKeyboard({ showTrial }),
  };
}

export async function getPanelTrialServer() {
  const server = await findServerById(PANEL_TRIAL_SERVER_ID);

  if (!server || !isServerActive(server)) {
    return null;
  }

  return server;
}

export function buildPanelTrialUsernamePromptScreen() {
  return {
    text: panelTrialUsernamePromptMessage,
    keyboard: panelTrialPromptKeyboard(),
  };
}

export async function handlePanelTrialUsername(from, username, { isAdmin = false } = {}) {
  const existing = await findUserPanelTrialSubscription(from.id);

  if (existing) {
    return {
      text: panelTrialAlreadyClaimedMessage,
      keyboard: panelTrialPromptKeyboard(),
    };
  }

  const server = await getPanelTrialServer();

  if (!server) {
    return {
      text: panelTrialUnavailableMessage,
      keyboard: panelTrialPromptKeyboard(),
    };
  }

  let provision;

  try {
    provision = await createPanelTrialAdmin(server, {
      username,
      telegramUserId: from.id,
    });
  } catch (err) {
    const normalized = normalizePanelTrialError(err);

    logger.error("panel-trial", "provision flow failed", {
      userId: String(from.id),
      username,
      serverId: String(server.id),
      serverName: server.serverName,
      code: err.code || normalized.code,
      status: err.status ?? normalized.status,
      error: normalized.message,
    });

    return {
      text: buildPanelTrialFailedMessage(normalized, { isAdmin }),
      keyboard: panelTrialPromptKeyboard(),
      retryUsername:
        normalized.code === "USERNAME_TAKEN" || normalized.code === "CONFLICT",
    };
  }

  try {
    await createUserSubscription({
      userId: from.id,
      serverId: server.id,
      serviceType: ServiceType.PANEL_TRIAL,
      volumeGb: provision.volumeGb,
      connectionLink: provision.panelUrl,
      panelSubId: provision.adminId != null ? String(provision.adminId) : null,
      clientEmail: provision.username,
      remark: provision.username,
      paymentMethod: "trial",
    });

    await savePanelUsageAdminPassword(from.id, provision.password);
  } catch (err) {
    logger.error("panel-trial", "subscription save failed after admin created", {
      userId: String(from.id),
      username: provision.username,
      serverId: String(server.id),
      adminId: provision.adminId != null ? String(provision.adminId) : null,
      error: err.message,
    });

    const normalized = normalizePanelTrialError(err);

    return {
      text: buildPanelTrialFailedMessage(
        {
          code: "DB_SAVE_FAILED",
          status: null,
          message: normalized.message,
        },
        { isAdmin },
      ),
      keyboard: panelTrialPromptKeyboard(),
    };
  }

  return {
    text: buildPanelTrialSuccessMessage(),
    keyboard: panelTrialSuccessKeyboard({
      username: provision.username,
      password: provision.password,
      panelUrl: provision.panelUrl,
    }),
  };
}

export function buildPanelTrialProcessingScreen() {
  return {
    text: panelTrialProcessingMessage,
    keyboard: panelTrialPromptKeyboard(),
  };
}
