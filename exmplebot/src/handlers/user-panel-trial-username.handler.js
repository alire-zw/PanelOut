import {
  deleteUserMessage,
  editPromptMessage,
  getPromptRefFromSession,
} from "../lib/prompt-message.js";
import { isValidPanelTrialUsername, normalizePanelTrialUsername } from "../lib/panel-trial-username.js";
import { panelTrialPromptKeyboard } from "../keyboards/panel-trial.keyboard.js";
import { buildPanelTrialInvalidUsernameMessage } from "../messages/panel-trial.message.js";
import { isAdminUser } from "../lib/admin.js";
import {
  buildPanelTrialProcessingScreen,
  handlePanelTrialUsername,
} from "../services/panel-trial.service.js";
import {
  clearUserSession,
  getUserSession,
  UserSessionAction,
  beginPanelTrialUsernameSession,
} from "../services/user-session.service.js";

export function registerUserPanelTrialUsernameHandler(bot) {
  bot.on("message:text", async (ctx, next) => {
    if (!ctx.from) {
      return next();
    }

    const session = await getUserSession(ctx.from.id);

    if (!session || session.action !== UserSessionAction.AWAITING_PANEL_TRIAL_USERNAME) {
      return next();
    }

    const promptRef = getPromptRefFromSession(session);
    const username = normalizePanelTrialUsername(ctx.message.text);

    if (!isValidPanelTrialUsername(username)) {
      await deleteUserMessage(ctx);
      await editPromptMessage(
        ctx.api,
        promptRef,
        buildPanelTrialInvalidUsernameMessage(),
        panelTrialPromptKeyboard(),
      );
      return;
    }

    await deleteUserMessage(ctx);

    const processing = buildPanelTrialProcessingScreen();
    await editPromptMessage(
      ctx.api,
      promptRef,
      processing.text,
      processing.keyboard,
    );

    const result = await handlePanelTrialUsername(ctx.from, username, {
      isAdmin: isAdminUser(ctx.from.id),
    });

    await editPromptMessage(ctx.api, promptRef, result.text, result.keyboard);

    if (result.retryUsername && promptRef) {
      await beginPanelTrialUsernameSession(ctx.from.id, promptRef);
      return;
    }

    await clearUserSession(ctx.from.id);
  });
}
