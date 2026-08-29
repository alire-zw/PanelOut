import {
  adminServerAddCancelKeyboard,
  adminServerAddFailedKeyboard,
  adminServerAddSuccessKeyboard,
  adminServerDeleteConfirmKeyboard,
  adminServerDetailKeyboard,
  adminServerEditCancelKeyboard,
  adminServersHubKeyboard,
  adminServersListKeyboard,
} from "../keyboards/admin-server.keyboard.js";
import {
  buildAdminServerAddPromptMessage,
  buildAdminServerAddFailedMessage,
  buildAdminServerAddSuccessMessage,
  buildAdminServerConnectingMessage,
  buildAdminServerDeleteConfirmMessage,
  buildAdminServerDetailMessage,
  buildAdminServerEditPromptMessage,
  buildAdminServersHubMessage,
  buildAdminServersListMessage,
} from "../messages/admin-server.message.js";
import { formatJalaliDateTime } from "../lib/tehran-time.js";
import { parsePasarGuardPanelUrl } from "../services/pasarguard.service.js";
import {
  ADD_STEP_LABELS,
  ADD_STEPS,
  EDIT_FIELD_LABELS,
  ServerSessionMode,
  setServerSession,
} from "../services/admin-server-session.service.js";
import {
  checkServerConnection,
  createServer,
  deleteServer,
  findServerById,
  getAllServers,
  getServerStats,
  toggleServerActive,
  toggleServerOutboundUsage,
  toggleServerOutboundVolume,
  toggleServerPanelUnlimited,
  toggleServerPanelUsage,
  toggleServerPanelVolume,
  toggleServerRenewal,
  toggleServerSales,
  updateServer,
  verifyServerConnection,
} from "../services/server.service.js";

const SKIP_VALUES = ["-", "ندار", "خالی", ""];

function isSkipValue(text) {
  if (!text || typeof text !== "string") return true;
  return SKIP_VALUES.includes(text.trim().toLowerCase());
}

export async function buildAdminServersHubScreen() {
  const updatedAt = formatJalaliDateTime();

  return {
    text: buildAdminServersHubMessage(updatedAt),
    keyboard: adminServersHubKeyboard(),
  };
}

export async function buildAdminServersListScreen(page = 0) {
  const servers = await getAllServers();
  const updatedAt = formatJalaliDateTime();
  const start = page * 5;
  const slice = servers.slice(start, start + 5);

  const connectionResults = await Promise.all(
    slice.map((server) => checkServerConnection(server)),
  );

  const { keyboard } = adminServersListKeyboard(servers, connectionResults, page);

  return {
    text: buildAdminServersListMessage(updatedAt, servers.length),
    keyboard,
  };
}

export async function buildAdminServerDetailScreen(serverId) {
  const server = await findServerById(serverId);

  if (!server) {
    return {
      text: "سرور یافت نشد.",
      keyboard: adminServersHubKeyboard(),
    };
  }

  const [connectionResult, statsResult] = await Promise.all([
    checkServerConnection(server),
    getServerStats(server),
  ]);

  const stats = statsResult.success ? statsResult.stats : null;
  const updatedAt = formatJalaliDateTime();

  return {
    text: buildAdminServerDetailMessage(server, connectionResult, updatedAt),
    keyboard: adminServerDetailKeyboard(server, stats, connectionResult),
  };
}

export async function buildAdminServerDeleteConfirmScreen(serverId) {
  const server = await findServerById(serverId);

  if (!server) {
    return buildAdminServersHubScreen();
  }

  return {
    text: buildAdminServerDeleteConfirmMessage(server.serverName),
    keyboard: adminServerDeleteConfirmKeyboard(serverId),
  };
}

export async function buildAdminServerAddStartScreen() {
  const step = ADD_STEPS[0];

  return {
    text: buildAdminServerAddPromptMessage(ADD_STEP_LABELS[step]),
    keyboard: adminServerAddCancelKeyboard(),
    awaitsTextInput: true,
  };
}

export async function buildAdminServerEditStartScreen(serverId, field) {
  const server = await findServerById(serverId);

  if (!server) {
    return buildAdminServersHubScreen();
  }

  const label = EDIT_FIELD_LABELS[field] || field;
  const current =
    server[field] != null && server[field] !== "" ? String(server[field]) : "(خالی)";

  return {
    text: buildAdminServerEditPromptMessage(label, current),
    keyboard: adminServerEditCancelKeyboard(serverId),
    awaitsTextInput: true,
  };
}

export async function handleAdminServerDeleteConfirm(serverId) {
  await deleteServer(serverId);
  return buildAdminServersListScreen(0);
}

export async function handleAdminServerToggle(kind, serverId) {
  if (kind === "active") {
    await toggleServerActive(serverId);
  } else if (kind === "sales") {
    await toggleServerSales(serverId);
  } else if (kind === "renewal") {
    await toggleServerRenewal(serverId);
  } else if (kind === "outboundVolume") {
    await toggleServerOutboundVolume(serverId);
  } else if (kind === "outboundUsage") {
    await toggleServerOutboundUsage(serverId);
  } else if (kind === "panelVolume") {
    await toggleServerPanelVolume(serverId);
  } else if (kind === "panelUsage") {
    await toggleServerPanelUsage(serverId);
  } else if (kind === "panelUnlimited") {
    await toggleServerPanelUnlimited(serverId);
  }

  return buildAdminServerDetailScreen(serverId);
}

export async function processServerAddStep(session, text) {
  const { step, data = {} } = session;
  const nextData = { ...data };

  if (step === "panelUrl") {
    if (!text) {
      throw new Error("EMPTY");
    }

    const parsed = parsePasarGuardPanelUrl(text);
    nextData.panelUrl = parsed.baseUrl;
    nextData.serverIp = parsed.serverIp;
    nextData.serverDomain = parsed.serverDomain;
    nextData.port = parsed.port;
  } else if (step === "remark") {
    nextData.remark = isSkipValue(text) ? null : text;
  } else if (!text) {
    throw new Error("EMPTY");
  } else {
    nextData[step] = text;
  }

  const currentIndex = ADD_STEPS.indexOf(step);
  const nextIndex = currentIndex + 1;

  if (nextIndex >= ADD_STEPS.length) {
    return {
      done: false,
      finalize: true,
      data: nextData,
    };
  }

  const nextStep = ADD_STEPS[nextIndex];

  return {
    done: false,
    session: { ...session, step: nextStep, data: nextData },
    screen: {
      text: buildAdminServerAddPromptMessage(ADD_STEP_LABELS[nextStep]),
      keyboard: adminServerAddCancelKeyboard(),
      awaitsTextInput: true,
    },
  };
}

export async function finalizeServerAdd(data) {
  const loginResult = await verifyServerConnection({
    serverName: data.serverName,
    serverIp: data.serverIp,
    serverDomain: data.serverDomain,
    port: data.port,
    userName: data.userName,
    userPassword: data.userPassword,
  });

  if (!loginResult.success) {
    return {
      success: false,
      text: buildAdminServerAddFailedMessage(
        data.serverName,
        loginResult.error || "اتصال به پنل ناموفق بود",
      ),
      keyboard: adminServerAddFailedKeyboard(),
    };
  }

  await createServer({
    serverName: data.serverName,
    serverIp: data.serverIp,
    serverDomain: data.serverDomain,
    port: data.port,
    userName: data.userName,
    userPassword: data.userPassword,
    remark: data.remark ?? null,
    isActive: true,
  });

  return {
    success: true,
    text: buildAdminServerAddSuccessMessage(data.serverName),
    keyboard: adminServerAddSuccessKeyboard(),
  };
}

export function buildServerAddConnectingScreen(serverName) {
  return {
    text: buildAdminServerConnectingMessage(serverName),
    keyboard: adminServerAddCancelKeyboard(),
  };
}

export async function processServerEditStep(session, text) {
  const { serverId, field } = session;
  const patch = {};

  if (field === "port") {
    const num = parseInt(text, 10);

    if (Number.isNaN(num) || num < 1 || num > 65535) {
      throw new Error("INVALID_PORT");
    }

    patch.port = num;
  } else if (field === "subPublicBaseUrl") {
    if (text && !isSkipValue(text)) {
      let probe = text;

      if (!/^https?:\/\//i.test(probe)) probe = `http://${probe}`;

      try {
        new URL(probe);
      } catch {
        throw new Error("INVALID_URL");
      }

      patch.subPublicBaseUrl = text;
    } else {
      patch.subPublicBaseUrl = null;
    }
  } else if (["remark", "serverDomain"].includes(field)) {
    patch[field] = isSkipValue(text) ? null : text;
  } else if (!text) {
    throw new Error("EMPTY");
  } else {
    patch[field] = text;
  }

  await updateServer(serverId, patch);

  return {
    done: true,
    screen: await buildAdminServerDetailScreen(serverId),
  };
}

export async function beginServerAddSession(userId) {
  const step = ADD_STEPS[0];

  await setServerSession(userId, {
    mode: ServerSessionMode.ADD,
    step,
    data: {},
  });
}

export async function beginServerEditSession(userId, serverId, field) {
  await setServerSession(userId, {
    mode: ServerSessionMode.EDIT,
    serverId: String(serverId),
    field,
  });
}
