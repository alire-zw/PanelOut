export function normalizePanelTrialError(err) {
  const message = String(err?.message || err || "UNKNOWN_ERROR");
  const status = err?.status ?? null;

  if (message === "USERNAME_TAKEN") {
    return { code: "USERNAME_TAKEN", status, message };
  }

  if (message === "ROLE_NOT_FOUND") {
    return { code: "ROLE_NOT_FOUND", status, message };
  }

  if (/telegram id is already assigned/i.test(message)) {
    return { code: "TELEGRAM_ID_TAKEN", status: status ?? 409, message };
  }

  if (status === 409 || /exist|duplicate|conflict/i.test(message)) {
    if (/username/i.test(message)) {
      return { code: "USERNAME_TAKEN", status: status ?? 409, message };
    }

    return { code: "CONFLICT", status: status ?? 409, message };
  }

  if (status === 405) {
    return { code: "METHOD_NOT_ALLOWED", status, message };
  }

  if (status === 403) {
    return { code: "FORBIDDEN", status, message };
  }

  if (status === 422) {
    return { code: "VALIDATION", status, message };
  }

  return { code: "PROVISION_FAILED", status, message };
}
