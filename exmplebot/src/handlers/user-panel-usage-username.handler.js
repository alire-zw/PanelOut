import {
  deleteUserMessage,
  editPromptMessage,
  getPromptRefFromSession,
} from "../lib/prompt-message.js";
import { isValidPanelTrialUsername, normalizePanelTrialUsername } from "../lib/panel-trial-username.js";
import { panelUsagePromptKeyboard } from "../keyboards/panel-usage.keyboard.js";
import { buildPanelUsageInvalidUsernameMessage } from "../messages/panel-usage.message.js";
import { isAdminUser } from "../lib/admin.js";
import { logger } from "../lib/logger.js";
import {
  buildPanelUsageProcessingScreen,
  handlePanelUsageUsername,
} from "../services/panel-usage.service.js";
import {
  clearUserSession,
  getUserSession,
  UserSessionAction,
  beginPanelUsageUsernameSession,
  markPanelUsageProvisioning,
} from "../services/user-session.service.js";

async function finalizePanelUsageUsernameFlow(ctx, from, username, promptRef) {
  try {
    const result = await handlePanelUsageUsername(from, username, {
      isAdmin: isAdminUser(from.id),
    });

    await editPromptMessage(ctx.api, promptRef, result.text, result.keyboard);

    if (result.retryUsername && promptRef) {
      await beginPanelUsageUsernameSession(from.id, promptRef);
      return;
    }

    await clearUserSession(from.id);
  } catch (err) {
    logger.error("panel-usage", "username handler failed", {
      userId: String(from.id),
      username,
      error: err.message,
    });

    if (promptRef) {
      await editPromptMessage(
        ctx.api,
        promptRef,
        "خطا در پردازش درخواست. لطفاً چند لحظه صبر کنید و دوباره تلاش کنید.",
        panelUsagePromptKeyboard(),
      );
      await beginPanelUsageUsernameSession(from.id, promptRef);
    }
  }
}

export function registerUserPanelUsageUsernameHandler(bot) {
  bot.on("message:text", async (ctx, next) => {
    if (!ctx.from) {
      return next();
    }

    const session = await getUserSession(ctx.from.id);

    if (!session || session.action !== UserSessionAction.AWAITING_PANEL_USAGE_USERNAME) {
      return next();
    }

    if (session.provisioning) {
      return;
    }

    const promptRef = getPromptRefFromSession(session);
    const username = normalizePanelTrialUsername(ctx.message.text);

    if (!isValidPanelTrialUsername(username)) {
      await deleteUserMessage(ctx);
      await editPromptMessage(
        ctx.api,
        promptRef,
        buildPanelUsageInvalidUsernameMessage(),
        panelUsagePromptKeyboard(),
      );
      return;
    }

    await deleteUserMessage(ctx);

    const processing = buildPanelUsageProcessingScreen();
    await editPromptMessage(ctx.api, promptRef, processing.text, processing.keyboard);

    if (promptRef) {
      await markPanelUsageProvisioning(ctx.from.id, promptRef);
    }

    void finalizePanelUsageUsernameFlow(ctx, ctx.from, username, promptRef);
  });
}
