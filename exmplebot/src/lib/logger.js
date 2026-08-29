import { env } from "../config/env.js";

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const LEVEL_TAGS = {
  debug: "DBG",
  info: "INF",
  warn: "WRN",
  error: "ERR",
  fatal: "FTL",
};

const tehranTime = new Intl.DateTimeFormat("en-u-ca-persian", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function normalizeLine(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

function formatTehranTime() {
  const parts = tehranTime.formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function formatMeta(meta) {
  if (!meta || Object.keys(meta).length === 0) return "";

  const pairs = Object.entries(meta)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => {
      const text = normalizeLine(value);
      return `${key}=${text.length > 32 ? `${text.slice(0, 29)}...` : text}`;
    });

  return pairs.length > 0 ? ` (${pairs.join(" ")})` : "";
}

function shouldLog(level) {
  return LEVELS[level] >= LEVELS[env.logLevel];
}

function write(level, module, message, meta) {
  if (!shouldLog(level)) return;

  const output = `${formatTehranTime()} ${LEVEL_TAGS[level]} ${module.padEnd(7)} ${normalizeLine(message)}${formatMeta(meta)}`;

  if (level === "error" || level === "fatal") {
    console.error(output);
    return;
  }

  if (level === "warn") {
    console.warn(output);
    return;
  }

  console.log(output);
}

export const logger = {
  debug(module, message, meta) {
    write("debug", module, message, meta);
  },
  info(module, message, meta) {
    write("info", module, message, meta);
  },
  warn(module, message, meta) {
    write("warn", module, message, meta);
  },
  error(module, message, meta) {
    write("error", module, message, meta);
  },
  fatal(module, message, meta) {
    write("fatal", module, message, meta);
  },
};
