/**
 * Node-RED GET /api/machines → MES-like machine fixtures (Overview / Detail / Speed Lab V2).
 * Payload: { [machineId]: { Status|STATUS, Line|line, Length, … } | { error } }
 * Live: http://100.102.253.113:1880/api/machines
 */
(function (global) {
  "use strict";

  const WORKSHOP_BY_PREFIX = {
    LT1: "Xưởng 1",
    LT2: "Xưởng 2",
    LT3: "Xưởng 3",
    LT5: "Xưởng V",
    LT6: "Xưởng V + VI",
    LT7: "Xưởng V + VI",
    LT8: "Xưởng V + VI",
  };

  /** Process area from SAP-ish mid codes (BD/BC…), not workshop */
  const CODE_AREA = [
    { re: /^(KDDA|KDHR|KALS|KTMG|KTWG|KN|KD|KT|KA|XGCL)/i, area: "drawing", nameEn: "Drawing" },
    { re: /^(GBMC|GB)/i, area: "armoring", nameEn: "Armoring" },
    { re: /^(XB|XS|XO|OC|XC|XT)/i, area: "stranding", nameEn: "Stranding" },
    { re: /^(BD|BC|BM)/i, area: "sheathing", nameEn: "Extrusion" },
    { re: /^(LHVN|CCRA|TH)/i, area: "sheathing", nameEn: "Special" },
  ];

  const AREA_META = {
    drawing: { id: "drawing", name: "KÉO", nameEn: "Drawing", unit: "m/s" },
    stranding: { id: "stranding", name: "XOẮN", nameEn: "Stranding", unit: "m/min" },
    armoring: { id: "armoring", name: "GIÁP", nameEn: "Armoring", unit: "m/min" },
    sheathing: { id: "sheathing", name: "BỌC", nameEn: "Extrusion", unit: "m/min" },
  };

  /** Same catalog as mes-control-tower-100.html — used when PLC has no product tags */
  const DEMO_PRODUCTS = [
    "CV 3×95+50", "CVV 4×25", "CXV 3×150", "CV 1×185", "AVV 4×16", "CXV 4×70",
  ];
  const DEMO_OPERATORS = [
    "Nguyễn Văn An", "Trần Thị Bình", "Lê Minh Cường", "Phạm Thu Dung", "Hoàng Đức Em", "Vũ Thị Hoa",
  ];

  function num(v, d) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function workshopOf(id) {
    const p = String(id || "").slice(0, 3).toUpperCase();
    return WORKSHOP_BY_PREFIX[p] || "Khác";
  }

  function workshopSlug(name) {
    return String(name || "other")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "other";
  }

  function midCode(id) {
    return String(id || "").replace(/^LT\d+/i, "");
  }

  function processAreaOf(id) {
    const code = midCode(id);
    for (const row of CODE_AREA) {
      if (row.re.test(code)) {
        return { area: row.area, nameEn: row.nameEn, code };
      }
    }
    return { area: "sheathing", nameEn: "Line", code };
  }

  function statusBag(raw) {
    return (raw && (raw.Status || raw.STATUS)) || {};
  }

  function lineBag(raw) {
    return (raw && (raw.Line || raw.line)) || {};
  }

  function lengthBag(raw) {
    return (raw && raw.Length) || {};
  }

  /** True if any Line.ON / LineON / Cmd.Line.ON flag is on */
  function isLineOn(S) {
    if (!S || typeof S !== "object") return false;
    if (S["Line.ON"] === true || S.LineON === true || S.LineOn === true) return true;
    const cmd = S.Cmd;
    if (cmd && (cmd["Line.ON"] === true || cmd.LineON === true)) return true;
    return false;
  }

  function anyDriveOn(S) {
    if (!S || typeof S !== "object") return false;
    return Object.keys(S).some((k) => {
      if (k === "Fault" || k === "EMGSTOP" || k === "Alarm" || k === "Cmd") return false;
      if (/\.ON$/i.test(k) || /ON$/i.test(k)) return S[k] === true;
      return false;
    });
  }

  /** Some lines (e.g. LT3LHVN1 furnace) omit ActSpeed — use State / OUT_PID */
  function hasActSpeedTag(L) {
    return L != null && Object.prototype.hasOwnProperty.call(L, "ActSpeed");
  }

  function lineActivityHint(L) {
    if (!L || typeof L !== "object") return false;
    const state = num(L.State, null);
    if (state === 1 || state === 2) return true;
    if (num(L.OUT_PID, 0) > 0.5) return true;
    if (num(L.SpSpeed, 0) > 0.05 || num(L["SpSpeed%"], 0) > 0.05) return true;
    return false;
  }

  function deriveStatus(raw) {
    if (!raw || raw.error) return "offline";
    const S = statusBag(raw);
    const L = lineBag(raw);
    const lineOn = isLineOn(S);
    const actKnown = hasActSpeedTag(L);
    const act = actKnown ? num(L.ActSpeed, 0) : 0;
    const hazard = S.Fault === true || S.EMGSTOP === true || S.Alarm === true;
    const moving = actKnown && Math.abs(act) > 0.05;
    /**
     * Đang sản xuất: Line.ON + ActSpeed>0 (LT3KDHR1), hoặc Line.ON khi PLC không có ActSpeed (Lò).
     * EMGSTOP/Fault có thể latched sai trong lúc line vẫn chạy — không map thành error/stop đỏ.
     */
    const producing = lineOn && (moving || !actKnown || lineActivityHint(L));

    if (producing) return hazard ? "warning" : "running";
    if (hazard) return "error";
    if (lineOn && actKnown && Math.abs(act) <= 0.05) return "idle";
    if (lineOn) return "running";
    if (anyDriveOn(S)) return "setup";
    if (moving) return "warning";
    if (lineActivityHint(L)) return "warning";
    return "stopped";
  }

  function flattenTags(obj, prefix, out, depth) {
    if (!obj || typeof obj !== "object" || depth > 4) return out;
    Object.keys(obj).forEach((k) => {
      const path = prefix ? prefix + "." + k : k;
      const v = obj[k];
      if (v != null && typeof v === "object" && !Array.isArray(v)) {
        flattenTags(v, path, out, depth + 1);
      } else {
        out.push({ path, value: v });
      }
    });
    return out;
  }

  function hashSeed(str) {
    let h = 0;
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function pickCatalog(id, arr) {
    return arr[hashSeed(id) % arr.length];
  }

  /** Walk PLC tree for MES-like product / order fields (future Node-RED tags) */
  function digPlcMesMeta(raw) {
    const out = { productName: null, productionOrderId: null, productionOrderName: null };
    if (!raw || raw.error) return out;
    function walk(o, depth) {
      if (!o || depth > 6 || typeof o !== "object" || Array.isArray(o)) return;
      Object.keys(o).forEach((k) => {
        const kl = k.toLowerCase();
        const v = o[k];
        if (typeof v === "string" && v.trim().length > 0) {
          if (!out.productName && /productname|materialname|recipename|productdesc|gradename/i.test(kl)) {
            out.productName = v.trim();
          } else if (!out.productName && /^product$|^material$|^recipe$/i.test(k) && v.trim().length > 2) {
            out.productName = v.trim();
          }
          if (/orderid|orderno|pono|jobno|productionorderid/i.test(kl)) {
            out.productionOrderId = v.trim();
            if (!out.productionOrderName) out.productionOrderName = v.trim();
          }
          if (/ordername|productionordername/i.test(kl)) out.productionOrderName = v.trim();
        }
        if (typeof v === "number" && /orderid|orderno|pono/i.test(kl) && !out.productionOrderId) {
          out.productionOrderId = String(v);
        }
        if (v && typeof v === "object") walk(v, depth + 1);
      });
    }
    walk(raw, 0);
    return out;
  }

  function maxMotorCurrent(raw) {
    if (!raw || raw.error) return 0;
    let max = 0;
    flattenTags(raw, "", [], 0).forEach(({ path, value }) => {
      if (!/motorcurrent|\.current$/i.test(path)) return;
      const n = Number(value);
      if (Number.isFinite(n) && n > max) max = n;
    });
    return max;
  }

  function maxPlcTemperature(raw) {
    if (!raw || raw.error) return null;
    let t = null;
    flattenTags(raw, "", [], 0).forEach(({ path, value }) => {
      if (!/temp|zone/i.test(path)) return;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 35 || n > 450) return;
      t = t == null ? n : Math.max(t, n);
    });
    return t;
  }

  /**
   * Fill fields expected by Control Tower / Overview contract when Node-RED omits them.
   * productName / PO: PLC first, else stable per-machine catalog (same UX as V1 mock).
   */
  function enrichMesContract(m) {
    const raw = m.raw;
    const plc = digPlcMesMeta(raw);
    if (plc.productName) {
      m.productName = plc.productName;
      m.productNameSource = "plc";
    }
    if (plc.productionOrderId) m.productionOrderId = plc.productionOrderId;
    if (plc.productionOrderName) m.productionOrderName = plc.productionOrderName;

    if (!m.productName) {
      m.productName = pickCatalog(m.id, DEMO_PRODUCTS);
      m.productNameSource = "catalog";
    }
    if (!m.productionOrderId) {
      m.productionOrderId = "PO-2026-" + (100 + (hashSeed(m.id + "po") % 800));
    }
    if (!m.productionOrderName) m.productionOrderName = m.productionOrderId;
    if (!m.productionOrderProductName) m.productionOrderProductName = m.productName;
    if (!m.operatorName) m.operatorName = pickCatalog(m.id + "op", DEMO_OPERATORS);

    const mc = maxMotorCurrent(raw);
    if (mc > 0) {
      m.current = +mc.toFixed(1);
      m.power = +(mc * 1.15).toFixed(1);
      m.powerSource = "est.motorCurrent";
    } else if (m.status === "running") {
      m.power = +(45 + (hashSeed(m.id) % 55)).toFixed(1);
      m.current = +(m.power * 0.72).toFixed(1);
      m.powerSource = "demo.running";
    } else if (m.status === "setup") {
      m.power = +(15 + (hashSeed(m.id) % 20)).toFixed(1);
      m.current = +(m.power * 0.85).toFixed(1);
      m.powerSource = "demo.setup";
    } else {
      m.power = +(2 + (hashSeed(m.id) % 8)).toFixed(1);
      m.current = +(m.power * 0.55).toFixed(1);
      m.powerSource = "demo.idle";
    }

    const temp = maxPlcTemperature(raw);
    m.temperature = temp != null ? Math.round(temp) : (m.status === "running" ? 62 + (hashSeed(m.id) % 22) : null);

    if (m.producedLength > 0 && !m.producedLengthNg) {
      m.producedLengthNg = Math.floor(m.producedLength * (0.002 + (hashSeed(m.id + "ng") % 8) * 0.001));
      m.producedLengthOk = Math.max(0, m.producedLength - m.producedLengthNg);
    }
    if (!m.targetLength && m.producedLength > 0) {
      m.targetLength = Math.max(m.producedLength, 4000 + (hashSeed(m.id + "len") % 3000));
    }
    m.energyMeterKwh = m.energyMeterKwh != null ? m.energyMeterKwh : +(120000 + (hashSeed(m.id + "kwh") % 80000)).toFixed(2);

    return m;
  }

  function adaptOne(id, raw) {
    const ws = workshopOf(id);
    const proc = processAreaOf(id);
    const areaMeta = AREA_META[proc.area] || AREA_META.sheathing;
    const offline = !!(raw && raw.error);
    const S = offline ? {} : statusBag(raw);
    const L = offline ? {} : lineBag(raw);
    const Len = offline ? {} : lengthBag(raw);
    const status = deriveStatus(raw);
    const actSpeed = num(L.ActSpeed, 0);
    const maxSpeed = num(L.MaxSpeed, 0);
    const spSpeed = num(L.SpSpeed != null ? L.SpSpeed : L["SpSpeed%"], 0);
    let targetSpeed = maxSpeed > 0 ? maxSpeed : spSpeed > 0 ? spSpeed : 0;
    if (targetSpeed <= 0 && actSpeed > 0) targetSpeed = actSpeed;
    const producedLength = num(Len.ActTotal, 0);
    const targetLength = num(Len.SpTotal, 0);
    const performance =
      targetSpeed > 0 ? +Math.min(120, (Math.abs(actSpeed) / targetSpeed) * 100).toFixed(1) : status === "running" ? 80 : 0;
    const availability =
      status === "running" ? 95 : status === "idle" || status === "setup" ? 60 : status === "error" ? 15 : status === "offline" ? 0 : 40;
    const quality = 100;
    const oee = +((availability * performance * quality) / 10000).toFixed(1);

    const alarms = [];
    if (S.Fault === true) {
      alarms.push({
        id: id + "-FAULT",
        machineId: id,
        severity: "error",
        message: "PLC Fault",
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }
    if (S.EMGSTOP === true) {
      alarms.push({
        id: id + "-EMG",
        machineId: id,
        severity: "error",
        message: "Emergency stop",
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }
    if (offline) {
      alarms.push({
        id: id + "-NODATA",
        machineId: id,
        severity: "warning",
        message: String(raw.error || "No PLC data"),
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }

    const m = {
      id,
      name: id + " · " + (proc.nameEn || areaMeta.nameEn),
      area: proc.area,
      areaName: areaMeta.name,
      areaNameEn: areaMeta.nameEn,
      workshop: ws,
      workshopId: workshopSlug(ws),
      machineCode: proc.code,
      status,
      lineSpeed: +Math.abs(actSpeed).toFixed(actSpeed >= 100 ? 0 : 2),
      targetSpeed: +Math.abs(targetSpeed).toFixed(targetSpeed >= 100 ? 0 : 2),
      speedUnit: areaMeta.unit,
      producedLength,
      producedLengthOk: producedLength,
      producedLengthNg: 0,
      targetLength,
      productionOrderId: null,
      productionOrderName: null,
      productionOrderProductName: null,
      productName: null,
      operatorName: null,
      oee,
      availability,
      performance,
      quality,
      power: null,
      alarms,
      lastUpdated: new Date().toISOString(),
      offline,
      offlineReason: offline ? String(raw.error) : null,
      plc: {
        status: S,
        line: L,
        length: Len,
        diameter: (raw && raw.Diameter) || null,
        state: num(L.State, null),
        runtime: num(L.Runtime, 0),
        totalRuntime: num(L.ToltalRuntime != null ? L.ToltalRuntime : L.TotalRuntime, 0),
      },
      raw: offline ? { error: raw.error } : raw,
      tags: offline ? [] : flattenTags(raw, "", [], 0),
      source: "nodered-machines",
    };
    enrichMesContract(m);
    return m;
  }

  function parsePayload(payload) {
    const machines = [];
    const alarms = [];
    if (!payload || typeof payload !== "object") {
      return emptyFixtures("empty payload");
    }
    Object.keys(payload).forEach((id) => {
      const m = adaptOne(id, payload[id]);
      machines.push(m);
      (m.alarms || []).forEach((a) => alarms.push(a));
    });
    machines.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const running = machines.filter((m) => m.status === "running").length;
    const online = machines.filter((m) => !m.offline).length;
    const avgA = online ? machines.filter((m) => !m.offline).reduce((s, m) => s + m.availability, 0) / online : 0;
    const avgP = online ? machines.filter((m) => !m.offline).reduce((s, m) => s + m.performance, 0) / online : 0;
    const avgQ = 100;
    const powerSumKw = machines.reduce((s, m) => s + (Number(m.power) || 0), 0);
    return {
      kpis: {
        running,
        total: machines.length,
        online,
        offline: machines.length - online,
        output: +(machines.reduce((s, m) => s + (m.producedLengthOk || m.producedLength || 0), 0) * 0.15).toFixed(1),
        orders: running,
        alarms: alarms.length,
        energy: powerSumKw > 0 ? +(powerSumKw / 1000).toFixed(4) : null,
      },
      machines,
      alarms,
      analytics: {
        oeeSummary: {
          oee: +((avgA * avgP * avgQ) / 10000).toFixed(1),
          availability: +avgA.toFixed(1),
          performance: +avgP.toFixed(1),
          quality: avgQ,
          note: "estimated from Line.ON + ActSpeed/MaxSpeed (no MES OEE)",
        },
      },
      meta: {
        source: "nodered /api/machines",
        areas: Object.values(AREA_META),
        workshops: [...new Set(machines.map((m) => m.workshop))],
      },
    };
  }

  function emptyFixtures(reason) {
    return {
      kpis: { running: 0, total: 0, online: 0, offline: 0, output: 0, orders: 0, alarms: 0, energy: null },
      machines: [],
      alarms: [],
      analytics: { oeeSummary: { oee: 0, availability: 0, performance: 0, quality: 100 } },
      meta: { source: reason || "empty", areas: Object.values(AREA_META), workshops: [] },
    };
  }

  function normalizeMachinesUrl(input) {
    let u = String(input || "").trim().replace(/\/$/, "");
    if (!u) return "http://100.102.253.113:1880/api/machines";
    if (u === "/proxy/machines" || u.endsWith("/proxy/machines")) return u;
    try {
      const parsed = new URL(u, typeof location !== "undefined" ? location.href : "http://localhost");
      if (/\/api\/machines$/i.test(parsed.pathname)) return parsed.href.replace(/\/$/, "");
      if (/:1880$/i.test(parsed.origin) && parsed.pathname === "/") {
        return parsed.origin + "/api/machines";
      }
      if (/:1880$/i.test(u)) return u + "/api/machines";
    } catch (_) {}
    if (/:1880$/i.test(u)) return u + "/api/machines";
    return u;
  }

  async function fetchMachinesJson(url) {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      mode: "cors",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(res.status + " " + url);
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const text = await res.text();
    if (ct.includes("text/html") || /^\s*</.test(text)) {
      throw new Error("URL trả HTML (Node-RED editor?) — dùng …:1880/api/machines hoặc /proxy/machines");
    }
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error("Invalid JSON from machines API");
    }
    if (json && json.success === false) throw new Error((json.error && json.error.message) || json.message || "API error");
    return json;
  }

  /** Client-side speed ring buffer (no history endpoint on Node-RED) */
  function createSpeedBuffer(maxPts) {
    const max = maxPts || 900;
    const byId = Object.create(null);
    return {
      push(machines, ts) {
        const t = ts || Date.now();
        (machines || []).forEach((m) => {
          if (!m || m.offline) return;
          if (!byId[m.id]) byId[m.id] = [];
          const arr = byId[m.id];
          arr.push({ t, speed: Number(m.lineSpeed) || 0, status: m.status, target: Number(m.targetSpeed) || 0 });
          if (arr.length > max) arr.splice(0, arr.length - max);
        });
      },
      series(id, sinceMs) {
        const arr = byId[id] || [];
        if (!sinceMs) return arr.slice();
        const cut = Date.now() - sinceMs;
        return arr.filter((p) => p.t >= cut);
      },
      clear() {
        Object.keys(byId).forEach((k) => delete byId[k]);
      },
      _store: byId,
    };
  }

  global.MesNodeRedMachines = {
    AREA_META,
    WORKSHOP_BY_PREFIX,
    adaptOne,
    parsePayload,
    emptyFixtures,
    normalizeMachinesUrl,
    fetchMachinesJson,
    createSpeedBuffer,
    workshopOf,
    processAreaOf,
    deriveStatus,
    enrichMesContract,
    DEMO_PRODUCTS,
  };
})(typeof window !== "undefined" ? window : globalThis);
