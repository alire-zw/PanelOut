import {
  deleteUserMessage,
  editPromptMessage,
  getPromptRefFromSession,
} from "../lib/prompt-message.js";
import { isValidPanelTrialUsername, normalizePanelTrialUsername } from "../lib/panel-trial-username.js";
import { panelUnlimitedPromptKeyboard } from "../keyboards/panel-unlimited.keyboard.js";
import { buildPanelUnlimitedInvalidUsernameMessage } from "../messages/panel-unlimited.message.js";
import { isAdminUser } from "../lib/admin.js";
import {
  buildPanelUnlimitedProcessingScreen,
  handlePanelUnlimitedUsername,
} from "../services/panel-unlimited.service.js";
import {
  clearUserSession,
  getUserSession,
  UserSessionAction,
  beginPanelUnlimitedUsernameSession,
} from "../services/user-session.service.js";

export function registerUserPanelUnlimitedUsernameHandler(bot) {
  bot.on("message:text", async (ctx, next) => {
    if (!ctx.from) {
      return next();
    }

    const session = await getUserSession(ctx.from.id);

    if (!session || session.action !== UserSessionAction.AWAITING_PANEL_UNLIMITED_USERNAME) {
      return next();
    }

    const purchase = {
      count: Number(session.purchaseCount),
      maxUsers: Number(session.purchaseMaxUsers),
      days: Number(session.purchaseDays),
    };

    const promptRef = getPromptRefFromSession(session);
    const username = normalizePanelTrialUsername(ctx.message.text);

    if (!isValidPanelTrialUsername(username)) {
      await deleteUserMessage(ctx);
      await editPromptMessage(
        ctx.api,
        promptRef,
        buildPanelUnlimitedInvalidUsernameMessage(purchase),
        panelUnlimitedPromptKeyboard(),
      );
      return;
    }

    await deleteUserMessage(ctx);

    const processing = buildPanelUnlimitedProcessingScreen();
    await editPromptMessage(ctx.api, promptRef, processing.text, processing.keyboard);

    const result = await handlePanelUnlimitedUsername(ctx.from, username, purchase, {
      isAdmin: isAdminUser(ctx.from.id),
    });

    await editPromptMessage(ctx.api, promptRef, result.text, result.keyboard);

    if (result.retryUsername && promptRef) {
      await beginPanelUnlimitedUsernameSession(ctx.from.id, promptRef, purchase);
      return;
    }

    await clearUserSession(ctx.from.id);
  });
}
