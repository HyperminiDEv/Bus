import { escapeHtml } from "./utils.js";

const LEVELS = Object.freeze({ debug: 0, info: 1, warn: 2, error: 3 });

export function createLogger({ config, logBody, logPanel }) {
  const lines = [];
  const minLevel = LEVELS[config.level] ?? LEVELS.info;

  function paint() {
    logBody.innerHTML = lines.map(line => {
      const match = line.match(/\[(DEBUG|INFO|WARN|ERROR)\]/);
      const className = match ? `l-${match[1].toLowerCase()}` : "";
      return `<div class="${className}">${escapeHtml(line)}</div>`;
    }).join("");
    logBody.scrollTop = logBody.scrollHeight;
  }

  function write(level, message, data) {
    if ((LEVELS[level] ?? LEVELS.info) < minLevel) return;
    const time = new Date().toISOString().slice(11, 23);
    let extra = "";
    if (data !== undefined) {
      try {
        extra = ` ${typeof data === "string" ? data : JSON.stringify(data)}`;
      } catch {
        extra = " [no serializable]";
      }
      if (extra.length > 900) extra = `${extra.slice(0, 900)}…`;
    }
    const line = `${time} [${level.toUpperCase()}] ${message}${extra}`;
    (console[level] || console.log)("[buses]", message, data ?? "");
    lines.push(line);
    if (lines.length > config.maxLines) lines.shift();
    if (logPanel.classList.contains("open")) paint();
  }

  function bindGlobalErrors() {
    window.addEventListener("error", event => write("error", `Error global: ${event.message}`));
    window.addEventListener("unhandledrejection", event => {
      const reason = event.reason?.message || event.reason;
      write("error", `Promesa rechazada: ${reason}`);
    });
  }

  return Object.freeze({
    debug: (message, data) => write("debug", message, data),
    info: (message, data) => write("info", message, data),
    warn: (message, data) => write("warn", message, data),
    error: (message, data) => write("error", message, data),
    paint,
    clear: () => {
      lines.length = 0;
      paint();
    },
    text: () => lines.join("\n"),
    bindGlobalErrors
  });
}
