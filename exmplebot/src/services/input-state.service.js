import { getAdminSession } from "./admin-session.service.js";
import { getChannelSession } from "./admin-channel-session.service.js";
import { getServerSession } from "./admin-server-session.service.js";
import { getUserSession } from "./user-session.service.js";

export async function isUserInAwaitingInputState(userId) {
  const [userSession, adminSession, serverSession, channelSession] =
    await Promise.all([
      getUserSession(userId),
      getAdminSession(userId),
      getServerSession(userId),
      getChannelSession(userId),
    ]);

  return Boolean(userSession || adminSession || serverSession || channelSession);
}
