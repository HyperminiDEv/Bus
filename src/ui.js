import { uniqueSorted } from "./utils.js";

export function getElements() {
  return Object.freeze({
    company: requiredElement("company"),
    btnLocate: requiredElement("btnLocate"),
    btnLog: requiredElement("btnLog"),
    logPanel: requiredElement("logpanel"),
    logBody: requiredElement("logbody"),
    logCopy: requiredElement("logCopy"),
    logClear: requiredElement("logClear"),
    logClose: requiredElement("logClose"),
    dot: requiredElement("dot"),
    statusText: requiredElement("statusText")
  });
}

export function createUi({ elements, logger }) {
  function setStatus(kind, text) {
    elements.dot.className = `dot ${kind}`;
    elements.statusText.textContent = text;
  }

  function updateCount(counts) {
    const time = new Date().toLocaleTimeString("es-UY", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const text = counts.total === counts.shown
      ? `${counts.total} buses · ${time}`
      : `${counts.shown} de ${counts.total} buses · ${time}`;
    setStatus("ok", text);
  }

  function fillCompanies(list) {
    const names = uniqueSorted(list.map(bus => bus.company));
    const currentOptions = [...elements.company.options].slice(1).map(option => option.value).join("|");
    if (currentOptions === names.join("|")) return;
    const currentValue = elements.company.value;
    elements.company.length = 1;
    for (const name of names) elements.company.add(new Option(name, name));
    elements.company.value = names.includes(currentValue) ? currentValue : "";
    logger.debug("Empresas detectadas", names);
  }

  function toggleLogs(open) {
    elements.logPanel.classList.toggle("open", open);
    elements.logPanel.setAttribute("aria-hidden", String(!open));
    elements.btnLog.classList.toggle("on", open);
    elements.btnLog.setAttribute("aria-expanded", String(open));
    if (open) logger.paint();
  }

  function bind({ onCompanyChange, onLocate }) {
    elements.company.addEventListener("change", event => onCompanyChange(event.target.value));
    elements.btnLocate.addEventListener("click", onLocate);
    elements.btnLog.addEventListener("click", () => toggleLogs(!elements.logPanel.classList.contains("open")));
    elements.logClose.addEventListener("click", () => toggleLogs(false));
    elements.logClear.addEventListener("click", logger.clear);
    elements.logCopy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(logger.text());
        logger.info("Logs copiados");
      } catch {
        logger.warn("No se pudo copiar al portapapeles");
      }
    });
  }

  return Object.freeze({
    bind,
    fillCompanies,
    setStatus,
    updateCount
  });
}

function requiredElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Falta el elemento #${id}`);
  return element;
}
