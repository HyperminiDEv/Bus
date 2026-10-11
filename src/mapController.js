import { slugify } from "./utils.js";

export class BusMap {
  constructor({ config, logger, popupRenderer }) {
    this.config = config;
    this.logger = logger;
    this.popupRenderer = popupRenderer;
    this.markers = new Map();
    this.filterCompany = "";
    this.userMoved = false;
    this.userMarker = null;
    this.colorCache = new Map();
    this.L = window.L;

    if (!this.L) throw new Error("Leaflet no está disponible");
    this.map = this.createMap();
    this.canvas = this.L.canvas({ padding: 0.3, tolerance: 8 });
    this.layer = this.L.layerGroup().addTo(this.map);
    this.popup = this.L.popup({ closeButton: true, autoPan: true, maxWidth: 300 });
    this.bindMovement();
  }

  createMap() {
    const L = this.L;
    const map = L.map("map", {
      center: this.config.defaultCenter,
      zoom: this.config.defaultZoom,
      preferCanvas: true,
      zoomControl: false,
      attributionControl: true,
      zoomAnimation: !/iP(hone|ad|od)/.test(navigator.userAgent),
      markerZoomAnimation: false,
      fadeAnimation: false,
      inertia: true,
      tap: true
    });

    map.attributionControl.setPrefix(false);
    document.documentElement.style.setProperty("--tile-filter", this.config.tileFilter || "none");
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer(this.config.tileUrl, {
      attribution: this.config.tileAttribution,
      subdomains: this.config.tileSubdomains,
      maxZoom: this.config.tileMaxZoom,
      className: "base-tiles",
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 1
    }).addTo(map);

    this.logger.info("Mapa inicializado", {
      center: this.config.defaultCenter,
      zoom: this.config.defaultZoom
    });
    return map;
  }

  bindMovement() {
    this.map.on("dragstart zoomstart", () => {
      this.userMoved = true;
    });
  }

  setData(list) {
    const seen = new Set();
    let added = 0;
    let moved = 0;

    for (const bus of list) {
      seen.add(bus.id);
      const entry = this.markers.get(bus.id);
      if (!entry) {
        this.markers.set(bus.id, this.createEntry(bus));
        added += 1;
        continue;
      }

      if (entry.data.ll[0] !== bus.ll[0] || entry.data.ll[1] !== bus.ll[1]) {
        entry.marker.setLatLng(bus.ll);
        moved += 1;
      }
      entry.data = bus;
      entry.marker.setStyle({ fillColor: this.colorFor(bus.company) });
    }

    let removed = 0;
    for (const [id, entry] of this.markers) {
      if (!seen.has(id)) {
        this.layer.removeLayer(entry.marker);
        this.markers.delete(id);
        removed += 1;
      }
    }

    this.refreshVisibility();
    this.logger.info(`Buses: ${list.length} (nuevos ${added}, movidos ${moved}, quitados ${removed})`);
  }

  createEntry(bus) {
    const marker = this.L.circleMarker(bus.ll, {
      renderer: this.canvas,
      radius: this.config.markerRadius,
      weight: 2,
      color: "#fff",
      fillColor: this.colorFor(bus.company),
      fillOpacity: 0.95
    });

    marker.on("click", () => {
      const current = this.markers.get(bus.id);
      if (!current) return;
      this.popup
        .setLatLng(current.marker.getLatLng())
        .setContent(this.popupRenderer(current.data))
        .openOn(this.map);
    });

    return { marker, data: bus, visible: false };
  }

  colorFor(company) {
    if (this.colorCache.has(company)) return this.colorCache.get(company);
    const styles = getComputedStyle(document.documentElement);
    const variable = `--bus-${slugify(company)}`;
    const color = styles.getPropertyValue(variable).trim()
      || styles.getPropertyValue("--bus-default").trim()
      || "#1d4ed8";
    this.colorCache.set(company, color);
    this.logger.debug(`Color de ${company}`, { variable, color });
    return color;
  }

  setCompanyFilter(company) {
    this.filterCompany = company;
    return this.refreshVisibility();
  }

  refreshVisibility() {
    let shown = 0;
    for (const entry of this.markers.values()) {
      const visible = !this.filterCompany || entry.data.company === this.filterCompany;
      if (visible && !entry.visible) {
        this.layer.addLayer(entry.marker);
        entry.visible = true;
      } else if (!visible && entry.visible) {
        this.layer.removeLayer(entry.marker);
        entry.visible = false;
      }
      if (visible) shown += 1;
    }
    return shown;
  }

  counts() {
    const total = this.markers.size;
    const shown = [...this.markers.values()].filter(entry => entry.visible).length;
    return { total, shown };
  }

  locate(auto = false) {
    if (!("geolocation" in navigator)) {
      this.logger.warn("Geolocalización no disponible; se usa la vista inicial");
      return;
    }

    this.logger.info(auto ? "Pidiendo ubicación de inicio" : "Pidiendo ubicación");
    navigator.geolocation.getCurrentPosition(
      position => this.showUserLocation(position, auto),
      error => this.logger.warn(`No se pudo obtener ubicación (${error.code}): ${error.message}`),
      {
        enableHighAccuracy: false,
        timeout: this.config.geolocationTimeoutMs,
        maximumAge: 60000
      }
    );
  }

  showUserLocation(position, auto) {
    const location = [position.coords.latitude, position.coords.longitude];
    this.logger.info("Ubicación obtenida", {
      lat: location[0],
      lng: location[1],
      precision_m: Math.round(position.coords.accuracy)
    });

    if (!this.userMarker) {
      this.userMarker = this.L.marker(location, {
        icon: this.L.divIcon({
          className: "",
          html: '<div class="me"></div>',
          iconSize: [16, 16]
        }),
        interactive: false,
        keyboard: false
      }).addTo(this.map);
    } else {
      this.userMarker.setLatLng(location);
    }

    if (!auto || !this.userMoved) {
      this.map.setView(location, this.config.locationZoom, { animate: false });
    }
  }
}
