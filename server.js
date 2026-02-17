import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true }));

/**
 * ENV REQUIRED:
 * - AIRTABLE_TOKEN  (Twój access token)
 * - AIRTABLE_BASE_ID   = appAHi3IJKwxUuxBb
 * - AIRTABLE_TABLE_ID  = tblEU37Z4McYDA86w
 *
 * OPTIONAL (jeśli kiedyś zmienisz nazwy kolumn):
 * - FIELD_NAME (default: "Name")
 * - FIELD_LAT  (default: "Attitude")   <-- u Ciebie “Attitude” = latitude (tak zapisuję)
 * - FIELD_LNG  (default: "Longitude")
 * - FIELD_ROLE (default: "Role")
 */

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID || "appAHi3IJKwxUuxBb";
const TABLE_ID = process.env.AIRTABLE_TABLE_ID || "tblEU37Z4McYDA86w";

const FIELD_NAME = process.env.FIELD_NAME || "Name";
const FIELD_LAT  = process.env.FIELD_LAT  || "Attitude";  // <- tak jak podałeś
const FIELD_LNG  = process.env.FIELD_LNG  || "Longitude";
const FIELD_ROLE = process.env.FIELD_ROLE || "Role";

const ROLE_TO_COLOR = {
  "RED PINS": "#d32f2f",
  "BLACK PINS": "#000000",
  "BLUE PINS": "#1976d2",
};

// --- helpers ---
function extractLatLngFromUrl(url) {
  try {
    const s = String(url || "").trim();

    // @lat,lng
    let m = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };

    // ?q=lat,lng
    m = s.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };

    // !3dLAT!4dLNG
    m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };

    // ?ll=lat,lng
    m = s.match(/[?&]ll=(-?\d+(?:\.\d+)?)(?:%2C|,)(-?\d+(?:\.\d+)?)/);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };

    return null;
  } catch {
    return null;
  }
}

/**
 * maps.app.goo.gl to często shortlink.
 * Robimy request z redirectami i bierzemy finalny URL z response.url.
 */
async function resolveFinalUrl(url) {
  const u = String(url || "").trim();
  if (!u) return u;
  // Node 18+ ma global fetch
  const res = await fetch(u, { redirect: "follow" });
  // final url po redirectach
  return res.url || u;
}

async function airtableRequest(method, path, body) {
  if (!AIRTABLE_TOKEN) throw new Error("Missing AIRTABLE_TOKEN in env");

  const url = `https://api.airtable.com/v0/${BASE_ID}/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}

  if (!res.ok) {
    const msg = json?.error?.message || json?.error || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json;
}

// --- static ---
app.use(express.static(path.join(__dirname, "public"), { etag: false, maxAge: "0" }));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/form", (req, res) => res.sendFile(path.join(__dirname, "public/form.html")));

// --- API: points ---
app.get("/api/points", async (req, res) => {
  try {
    const maxRecords = Math.min(Number(req.query.max || 2000), 5000);

    // używamy tableId w path, bo jest pewny
    // Airtable: GET /v0/{baseId}/{tableNameOrId}?maxRecords=...
    const data = await airtableRequest(
      "GET",
      `${TABLE_ID}?maxRecords=${encodeURIComponent(String(maxRecords))}&sort%5B0%5D%5Bfield%5D=Created%20time&sort%5B0%5D%5Bdirection%5D=desc`,
      null
    );

    const points = (data.records || []).map(r => {
      const f = r.fields || {};
      const role = String(f[FIELD_ROLE] || "").trim();
      return {
        id: r.id,
        name: String(f[FIELD_NAME] || "").trim(),
        role,
        color: ROLE_TO_COLOR[role] || "#000000",
        lat: Number(f[FIELD_LAT]),
        lng: Number(f[FIELD_LNG]),
        createdTime: r.createdTime,
      };
    }).filter(p => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));

    res.json({ ok: true, count: points.length, points });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// --- API: submit ---
app.post("/api/submit", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const link = String(req.body.link || "").trim();
    const role = String(req.body.role || "").trim();

    if (!name) return res.status(400).json({ ok: false, error: "Missing name" });
    if (!link) return res.status(400).json({ ok: false, error: "Missing google maps link" });
    if (!ROLE_TO_COLOR[role]) return res.status(400).json({ ok: false, error: "Invalid role" });

    // resolve shortlink -> final url -> parse coords
    const finalUrl = await resolveFinalUrl(link);
    const coords = extractLatLngFromUrl(finalUrl) || extractLatLngFromUrl(link);

    if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
      return res.status(400).json({
        ok: false,
        error: "Could not extract lat/lng from the link. Please copy a link that contains coordinates.",
        debugFinalUrl: finalUrl
      });
    }

    // zapis do Airtable
    const payload = {
      records: [
        {
          fields: {
            [FIELD_NAME]: name,
            [FIELD_ROLE]: role,
            [FIELD_LAT]: String(coords.lat),  // short text kolumny
            [FIELD_LNG]: String(coords.lng),  // short text kolumny
          }
        }
      ]
    };

    const created = await airtableRequest("POST", `${TABLE_ID}`, payload);
    res.json({ ok: true, created });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`praymap-airtable on :${PORT}`));
