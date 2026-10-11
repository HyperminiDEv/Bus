import { ApiClient } from "./apiClient.js";
import { CONFIG } from "./config.js";
import { createLogger } from "./logger.js";
import { BusMap } from "./mapController.js";
import { renderBusPopup } from "./popup.js";
import { normalizeBusesResponse } from "./serviceMapper.js";
import { createUi, getElements } from "./ui.js";

const elements = getElements();
const logger = createLogger({
  config: CONFIG.logging,
  logBody: elements.logBody,
  logPanel: elements.logPanel
});

logger.bindGlobalErrors();

const api = new ApiClient(CONFIG.api, logger);
const busMap = new BusMap({
  config: CONFIG.map,
  logger,
  popupRenderer: renderBusPopup
});
const ui = createUi({ elements, logger });

let failures = 0;
let timer = null;
let rawLogged = false;

ui.bind({
  onCompanyChange: company => {
    busMap.setCompanyFilter(company);
    ui.updateCount(busMap.counts());
    logger.debug("Filtro empresa", company || "(todas)");
  },
  onLocate: () => busMap.locate(false)
});

document.addEventListener("visibilitychange", () => {
  logger.debug(document.hidden ? "App en segundo plano" : "App en primer plano");
  if (!document.hidden) refresh();
});

logger.info("Iniciando", {
  api: CONFIG.api.baseUrl,
  endpoint: CONFIG.api.busesEndpoint,
  auth: CONFIG.api.useAuth,
  refresh_ms: CONFIG.refresh.intervalMs,
  ua: navigator.userAgent
});

busMap.locate(true);
refresh();

async function refresh() {
  window.clearTimeout(timer);

  if (CONFIG.refresh.pauseWhenHidden && document.hidden) {
    logger.debug("Pestaña oculta, actualización pausada");
    return;
  }

  const hasMarkers = busMap.counts().total > 0;
  ui.setStatus("load", hasMarkers ? "Actualizando…" : "Cargando buses…");

  try {
    const payload = await api.listBuses();
    if (CONFIG.logging.rawSample && !rawLogged) {
      rawLogged = true;
      logger.debug("Muestra de respuesta cruda", JSON.stringify(payload).slice(0, 700));
    }

    const buses = normalizeBusesResponse(payload, CONFIG.fields);
    if (!buses.length) {
      logger.warn("La respuesta no trae buses con coordenadas válidas");
      ui.setStatus("err", "Sin buses con coordenadas");
    } else {
      busMap.setData(buses);
      ui.fillCompanies(buses);
      ui.updateCount(busMap.counts());
    }
    failures = 0;
  } catch (error) {
    failures += 1;
    logger.error(`Falló la actualización (#${failures}): ${error.message}`);
    ui.setStatus("err", error.message);
  } finally {
    scheduleNextRefresh();
  }
}

function scheduleNextRefresh() {
  const wait = Math.min(
    CONFIG.refresh.intervalMs * Math.pow(2, Math.max(0, failures - 1)),
    CONFIG.refresh.maxBackoffMs
  );
  if (failures) logger.debug(`Próximo intento en ${Math.round(wait / 1000)} s`);
  timer = window.setTimeout(refresh, wait);
}
