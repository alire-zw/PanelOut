import { registerAdminChannelForwardHandler } from "./admin-channel-forward.handler.js";
import { registerAdminMessageHandler } from "./admin-message.handler.js";
import { registerStartHandler } from "./start.handler.js";
import { registerCallbackHandler } from "./callback.handler.js";
import { registerInvalidMessageHandler } from "./invalid-message.handler.js";
import { registerUserReceiptHandler } from "./user-receipt.handler.js";
import { registerUserRialAmountHandler } from "./user-rial-amount.handler.js";
import { registerUserPanelTrialUsernameHandler } from "./user-panel-trial-username.handler.js";
import { registerUserPanelUnlimitedUsernameHandler } from "./user-panel-unlimited-username.handler.js";
import { registerUserPanelUsageUsernameHandler } from "./user-panel-usage-username.handler.js";

export function registerHandlers(bot) {
  registerStartHandler(bot);
  registerAdminMessageHandler(bot);
  registerAdminChannelForwardHandler(bot);
  registerUserRialAmountHandler(bot);
  registerUserPanelTrialUsernameHandler(bot);
  registerUserPanelUnlimitedUsernameHandler(bot);
  registerUserPanelUsageUsernameHandler(bot);
  registerUserReceiptHandler(bot);
  registerCallbackHandler(bot);
  registerInvalidMessageHandler(bot);
}
