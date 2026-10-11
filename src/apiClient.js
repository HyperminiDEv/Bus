export class ApiClient {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.inflight = null;
  }

  buildHeaders() {
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json"
    };
    if (this.config.sendXhrHeader) headers["X-Requested-With"] = "XMLHttpRequest";
    if (this.config.useAuth && this.config.authToken) {
      headers[this.config.authHeader] = this.config.authToken;
    }
    return Object.assign(headers, this.config.extraHeaders);
  }

  async post(path, body) {
    if (this.inflight) this.inflight.abort();
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    const url = `${this.config.baseUrl}/${path}`;
    const startedAt = performance.now();
    this.inflight = controller;
    this.logger.debug(`POST ${url}`, body);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const elapsed = Math.round(performance.now() - startedAt);
      this.logger.info(`HTTP ${response.status} ${path} (${elapsed} ms)`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Tiempo de espera agotado");
      if (error instanceof TypeError) throw new Error("No se pudo conectar. Revisá internet o CORS.");
      throw error;
    } finally {
      window.clearTimeout(timer);
      if (this.inflight === controller) this.inflight = null;
    }
  }

  listBuses() {
    return this.post(this.config.busesEndpoint, { filtros: this.config.filters });
  }
}
