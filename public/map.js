const REFRESH_MS = 15000;
document.getElementById("refresh").textContent = String(REFRESH_MS / 1000);

const map = L.map("map").setView([52.2297, 21.0122], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap"
}).addTo(map);

const ROLE_META = {
  "RED PINS":  { color:"#d32f2f", label:"RED PINS — If you bleed: offer." },
  "BLACK PINS":{ color:"#000000", label:"BLACK PINS — If you don’t: bless." },
  "BLUE PINS": { color:"#1976d2", label:"BLUE PINS — If you’re a man: protect." }
};

const layerGroups = new Map();    // role -> layerGroup
const layerEnabled = new Map();   // role -> bool
const markersByRole = new Map();  // role -> [marker]

// === NEW: fit only once (or until user moves map) ===
let didInitialFit = false;
let userInteracted = false;

// Jeśli user zacznie poruszać mapą (drag/zoom), nie auto-fitujemy już nigdy
map.on("dragstart zoomstart", () => { userInteracted = true; });

function esc(s){
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function makeIcon(color){
  const html = `<div style="width:14px;height:14px;border-radius:999px;background:${color};
    border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);"></div>`;
  return L.divIcon({ html, className:"", iconSize:[14,14], iconAnchor:[7,7] });
}

function ensureRole(role){
  if (!layerGroups.has(role)) {
    layerGroups.set(role, L.layerGroup().addTo(map));
    layerEnabled.set(role, true);
    markersByRole.set(role, []);
  }
}

function clearAll(){
  for (const [role, g] of layerGroups.entries()) {
    g.clearLayers();
    markersByRole.set(role, []);
  }
}

function addPoint(p){
  const role = p.role || "UNKNOWN";
  ensureRole(role);

  const icon = makeIcon(p.color || ROLE_META[role]?.color || "#000");
  const g = layerGroups.get(role);

  const m = L.marker([p.lat, p.lng], { icon });

  const popup = `
    <div style="font-family:system-ui;max-width:260px">
      <div style="font-weight:700;margin-bottom:6px">${esc(p.name || "")}</div>
      <div class="muted" style="margin-top:6px">${esc(role)}</div>
      ${p.createdTime ? `<div class="muted">${esc(p.createdTime)}</div>` : ""}
    </div>
  `;
  m.bindPopup(popup);
  m.addTo(g);

  markersByRole.get(role).push(m);

  if (!layerEnabled.get(role)) map.removeLayer(g);
}

function fitToVisible(){
  const bounds = L.latLngBounds([]);
  let any = false;

  for (const [role, enabled] of layerEnabled.entries()) {
    if (!enabled) continue;
    const arr = markersByRole.get(role) || [];
    for (const m of arr) { bounds.extend(m.getLatLng()); any = true; }
  }
  if (any) map.fitBounds(bounds.pad(0.2));
}

// === NEW: counts per role ===
function getCount(role){
  return (markersByRole.get(role) || []).length;
}

function renderControls(){
  const el = document.getElementById("layers");
  el.innerHTML = "";

  const order = ["RED PINS","BLACK PINS","BLUE PINS"];
  const roles = Array.from(layerGroups.keys()).sort((a,b)=>order.indexOf(a)-order.indexOf(b));

  for (const role of roles) {
    const enabled = !!layerEnabled.get(role);
    const color = ROLE_META[role]?.color || "#000";
    const labelText = ROLE_META[role]?.label || role;
    const count = getCount(role);

    const row = document.createElement("label");
    row.className = "row";
    row.style.margin = "0";
    row.style.justifyContent = "space-between";

    const left = document.createElement("div");
    left.className = "row";
    left.style.margin = "0";
    left.style.gap = "8px";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = enabled;
    cb.onchange = () => {
      layerEnabled.set(role, cb.checked);
      const g = layerGroups.get(role);
      if (cb.checked) g.addTo(map);
      else map.removeLayer(g);
      // fit ręcznie tylko jeśli user kliknie Fit
    };

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = color;

    const span = document.createElement("span");
    span.className = "muted";
    span.style.opacity = "1";
    span.textContent = labelText;

    const right = document.createElement("span");
    right.className = "muted";
    right.style.opacity = "0.9";
    right.textContent = String(count);

    left.appendChild(cb);
    left.appendChild(dot);
    left.appendChild(span);

    row.appendChild(left);
    row.appendChild(right);

    el.appendChild(row);
  }
}

async function refresh(){
  const status = document.getElementById("status");

  try {
    const res = await fetch("/api/points?max=5000", { cache: "no-store" });
    const data = await res.json();
    if (!data || !data.ok) throw new Error(data?.error || "Bad response");

    clearAll();

    for (const p of data.points) addPoint(p);

    // odśwież warstwy (zlicza)
    renderControls();

    status.textContent = `✅ Points: ${data.count} · ${new Date().toLocaleTimeString()}`;

    // === CHANGE: fit tylko raz, na start, i tylko jeśli user nie ruszał mapy ===
    if (!didInitialFit && !userInteracted) {
      fitToVisible();
      didInitialFit = true;
    }

  } catch (e) {
    status.textContent = `⚠️ ${e.message}`;
  }
}

document.getElementById("fitBtn").onclick = () => fitToVisible();
document.getElementById("reloadBtn").onclick = () => refresh();

refresh();
setInterval(refresh, REFRESH_MS);
