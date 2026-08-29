const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
  black: "\x1b[30m",
};

function time() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function text(value) {
  if (value == null || value === "") return "";
  if (value instanceof Error) return value.message || String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function pad(value, width) {
  const s = String(value);
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function out(line, stream = "log") {
  console[stream](line);
}

/** @type {{ name: string, detail: string, ok: boolean }[]} */
let rows = [];

export const log = {
  /** Title line at process start */
  header(title = "PanelOut", subtitle = "backend") {
    rows = [];
    out("");
    out(`  ${c.bold}${c.white}${title}${c.reset}  ${c.dim}${subtitle}${c.reset}`);
    out("");
  },

  /** Collect a service for the boot block (printed by ready()) */
  service(name, detail = "", ok = true) {
    rows.push({ name, detail: text(detail), ok });
  },

  /** Soft inline note while booting (creating DB, etc.) */
  note(message, detail) {
    const extra = detail ? `  ${c.dim}${text(detail)}${c.reset}` : "";
    out(`  ${c.yellow}○${c.reset}  ${c.dim}${message}${c.reset}${extra}`);
  },

  /** Flush boot services + public URL, then open runtime section */
  ready(publicUrl) {
    for (const row of rows) {
      const dot = row.ok ? `${c.green}●${c.reset}` : `${c.red}●${c.reset}`;
      const detail = row.detail ? `  ${c.dim}${row.detail}${c.reset}` : "";
      out(`  ${dot}  ${c.white}${pad(row.name, 10)}${c.reset}${detail}`);
    }
    rows = [];

    if (publicUrl) {
      out("");
      out(`  ${c.cyan}→${c.reset}  ${publicUrl}`);
    }

    out("");
    out(`  ${c.dim}${"─".repeat(40)}${c.reset}`);
    out("");
  },

  /** Low-noise runtime detail */
  debug(action, detail) {
    const t = `${c.gray}${time()}${c.reset}`;
    const a = `${c.gray}${pad(action, 8)}${c.reset}`;
    const d = detail ? `${c.dim}${text(detail)}${c.reset}` : "";
    out(`  ${t}  ${a}${d ? `  ${d}` : ""}`);
  },

  /** Informational runtime line */
  info(action, detail) {
    this.event(action, detail);
  },

  /** Runtime one-liner */
  event(action, detail) {
    const t = `${c.gray}${time()}${c.reset}`;
    const a = `${c.cyan}${pad(action, 8)}${c.reset}`;
    const d = detail ? `${c.dim}${text(detail)}${c.reset}` : "";
    out(`  ${t}  ${a}${d ? `  ${d}` : ""}`);
  },

  /** HTTP access line: METHOD /path  status  12ms */
  http(method, path, status, ms) {
    const line = `${method} ${path}  ${status}  ${ms}ms`;
    if (status >= 500) this.error("http", line);
    else if (status >= 400) this.warn("http", line);
    else this.event("http", line);
  },

  warn(action, detail) {
    const t = `${c.gray}${time()}${c.reset}`;
    const badge = `${c.bgYellow}${c.black} WARN ${c.reset}`;
    const d = detail ? `  ${c.dim}${text(detail)}${c.reset}` : "";
    out(`  ${t}  ${badge}  ${c.yellow}${action}${c.reset}${d}`, "warn");
  },

  error(action, detail) {
    const t = `${c.gray}${time()}${c.reset}`;
    const badge = `${c.bgRed}${c.white}${c.bold} ERR  ${c.reset}`;
    const d = detail ? `  ${c.dim}${text(detail)}${c.reset}` : "";
    out(`  ${t}  ${badge}  ${c.red}${action}${c.reset}${d}`, "error");
  },
};
