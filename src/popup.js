import { escapeHtml } from "./utils.js";

export function renderBusPopup(bus) {
  const info = bus.passenger;
  const rows = [
    ["Empresa", info.company],
    ["Salida", info.departure],
    ["Llegada", info.arrival],
    ["Plataforma", info.platform],
    ["Actualizado", info.updated]
  ];

  if (info.variant) rows.splice(3, 0, ["Servicio", info.variant]);

  const note = info.note
    ? `<p class="pop__note">${escapeHtml(info.note)}</p>`
    : "";

  return `
    <article class="pop">
      <div class="pop__head">
        <div>
          <p class="pop__label">Unidad</p>
          <h3>${escapeHtml(info.unit)}</h3>
        </div>
        <span class="pop__status ${escapeHtml(info.status.tone)}">${escapeHtml(info.status.label)}</span>
      </div>
      <p class="pop__route">${escapeHtml(info.route)}</p>
      <dl>
        ${rows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}
      </dl>
      ${note}
    </article>
  `;
}
