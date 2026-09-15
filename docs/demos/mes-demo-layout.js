/**
 * Shared Grafana-like panel drag / resize for MES HTML demos.
 * Usage:
 *   const layoutApi = MesDemoLayout.create({
 *     board, layoutKey, editKey, defaultLayout, panelMeta,
 *     showToast, panelMinSize?, onResizeCharts?, gridCols?: 24
 *   });
 *   // in panel HTML: use layoutApi.panelShellAttrs(item) + resize handle + drag handle
 *   layoutApi.syncDomFromLayout();
 *   layoutApi.bindPanelInteractions();
 *   layoutApi.setEditLayout(localStorage…);
 */
(function (global) {
  "use strict";

  function packLayoutItems(items, gridCols) {
    const GRID_COLS = gridCols || 24;
    let x = 0;
    let y = 0;
    let rowH = 0;
    return items.map((it) => {
      const w = Math.min(GRID_COLS, Number(it.w) || 4);
      const h = Number(it.h) || 4;
      if (x + w > GRID_COLS) {
        x = 0;
        y += rowH;
        rowH = 0;
      }
      const placed = { id: it.id, x, y, w, h };
      x += w;
      rowH = Math.max(rowH, h);
      return placed;
    });
  }

  function create(opts) {
    const board = opts.board;
    const LAYOUT_KEY = opts.layoutKey;
    const EDIT_LAYOUT_KEY = opts.editKey;
    const GRID_COLS = opts.gridCols || 24;
    const PANEL_META = opts.panelMeta || {};
    const showToast = opts.showToast || function () {};
    const onResizeCharts = opts.onResizeCharts || function () {};
    const defaultMin = opts.panelMinSize || function (id) {
      if (String(id).indexOf("stat_") === 0) return { w: 3, h: 3 };
      if (String(id).indexOf("chart_") === 0) return { w: 6, h: 4 };
      if (id === "mosaic" || id === "zones") return { w: 8, h: 6 };
      return { w: 4, h: 3 };
    };

    let layout = loadLayout(opts.defaultLayout);
    let activeResize = null;
    let activeDrag = null;

    function loadLayout(defaultLayout) {
      try {
        const raw = localStorage.getItem(LAYOUT_KEY);
        if (!raw) return defaultLayout.map((x) => Object.assign({}, x));
        const p = JSON.parse(raw);
        if (!Array.isArray(p) || p.length !== defaultLayout.length) {
          return defaultLayout.map((x) => Object.assign({}, x));
        }
        const ids = defaultLayout.map((d) => d.id).sort().join(",");
        const got = p.map((d) => d.id).sort().join(",");
        if (ids !== got) return defaultLayout.map((x) => Object.assign({}, x));
        if (p.some((it) => it.x == null || it.y == null)) {
          return packLayoutItems(p.map((it) => ({ id: it.id, w: it.w, h: it.h })), GRID_COLS);
        }
        return p.map((it) => ({
          id: it.id,
          x: Number(it.x) || 0,
          y: Number(it.y) || 0,
          w: Number(it.w) || 4,
          h: Number(it.h) || 4,
        }));
      } catch (_) {
        return defaultLayout.map((x) => Object.assign({}, x));
      }
    }

    function rectsOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function clampPanelXY(x, y, w, h) {
      const nw = Math.min(GRID_COLS, Math.max(1, w));
      const nx = Math.max(0, Math.min(GRID_COLS - nw, Math.round(x)));
      const ny = Math.max(0, Math.round(y));
      return { x: nx, y: ny, w: nw, h: Math.max(1, Math.round(h)) };
    }

    function resolveCollisions(items, movingId) {
      const next = items.map((p) => Object.assign({}, p));
      let guard = 0;
      let changed = true;
      while (changed && guard++ < 60) {
        changed = false;
        const sorted = next.slice().sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
        for (let i = 0; i < sorted.length; i++) {
          for (let j = 0; j < sorted.length; j++) {
            if (i === j) continue;
            const a = sorted[i];
            const b = sorted[j];
            if (!rectsOverlap(a, b)) continue;
            const pushTarget = movingId && a.id === movingId ? b : (movingId && b.id === movingId ? a : (a.y <= b.y ? b : a));
            const blocker = pushTarget.id === a.id ? b : a;
            const newY = blocker.y + blocker.h;
            if (pushTarget.y !== newY) {
              pushTarget.y = newY;
              changed = true;
            }
          }
        }
      }
      return next;
    }

    function applyPlacement(el, x, y, w, h) {
      const placed = clampPanelXY(x, y, w, h);
      el.dataset.x = String(placed.x);
      el.dataset.y = String(placed.y);
      el.dataset.w = String(placed.w);
      el.dataset.h = String(placed.h);
      el.style.gridColumn = (placed.x + 1) + " / span " + placed.w;
      el.style.gridRow = (placed.y + 1) + " / span " + placed.h;
      const badge = el.querySelector(".panel-size");
      if (badge) badge.textContent = placed.w + "×" + placed.h;
      return placed;
    }

    function applyPanelSize(el, w, h) {
      const id = el.dataset.id;
      const min = defaultMin(id);
      const nw = Math.max(min.w, Math.min(GRID_COLS, Math.round(w)));
      const nh = Math.max(min.h, Math.min(18, Math.round(h)));
      let x = Number(el.dataset.x) || 0;
      let y = Number(el.dataset.y) || 0;
      if (x + nw > GRID_COLS) x = Math.max(0, GRID_COLS - nw);
      return applyPlacement(el, x, y, nw, nh);
    }

    function layoutItemFromEl(el) {
      return {
        id: el.dataset.id,
        x: Number(el.dataset.x) || 0,
        y: Number(el.dataset.y) || 0,
        w: Number(el.dataset.w) || 4,
        h: Number(el.dataset.h) || 4,
      };
    }

    function persistLayoutFromDom() {
      layout = Array.prototype.map.call(board.querySelectorAll(".panel"), layoutItemFromEl);
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    }

    function syncDomFromLayout() {
      layout.forEach((item) => {
        const el = board.querySelector('.panel[data-id="' + item.id + '"]');
        if (el) applyPlacement(el, item.x, item.y, item.w, item.h);
      });
      const maxRow = Math.max(8, Math.max.apply(null, layout.map((p) => p.y + p.h)));
      board.style.minHeight = (maxRow * 36 + (maxRow - 1) * 8 + 40) + "px";
    }

    function gridMetrics() {
      const style = getComputedStyle(board);
      const padL = parseFloat(style.paddingLeft) || 0;
      const padR = parseFloat(style.paddingRight) || 0;
      const padT = parseFloat(style.paddingTop) || 0;
      const gap = parseFloat(style.columnGap || style.gap) || 8;
      const rect = board.getBoundingClientRect();
      const innerW = Math.max(1, board.clientWidth - padL - padR);
      const colW = (innerW - gap * (GRID_COLS - 1)) / GRID_COLS;
      return { padL, padT, gap, colW, rowH: 36, rect };
    }

    function clientToGrid(clientX, clientY, w, h, offsetX, offsetY) {
      const m = gridMetrics();
      const bx = clientX - m.rect.left - m.padL + board.scrollLeft;
      const by = clientY - m.rect.top - m.padT + board.scrollTop;
      const col = (bx - offsetX) / (m.colW + m.gap);
      const row = (by - offsetY) / (m.rowH + m.gap);
      return clampPanelXY(col, row, w, h);
    }

    function setEditLayout(on, toastOpts) {
      const active = !!on;
      board.classList.toggle("layout-edit", active);
      const btn = document.getElementById("btnEditLayout");
      if (btn) btn.classList.toggle("theme-active", active);
      localStorage.setItem(EDIT_LAYOUT_KEY, active ? "1" : "0");
      if (toastOpts && toastOpts.toast) {
        showToast(active
          ? "Edit layout ON — kéo title đặt vị trí, kéo góc resize"
          : "Edit layout OFF");
      }
    }

    function panelShellOpen(item, extraClass) {
      const id = item.id;
      const w = item.w;
      const h = item.h;
      const x = item.x || 0;
      const y = item.y || 0;
      return (
        '<section class="panel' + (extraClass || "") + '" data-id="' + id +
        '" data-x="' + x + '" data-y="' + y + '" data-w="' + w + '" data-h="' + h +
        '" style="grid-column:' + (x + 1) + " / span " + w + ";grid-row:" + (y + 1) + " / span " + h + '">'
      );
    }

    function panelHeadHtml(item, badgeHtml) {
      const meta = PANEL_META[item.id] || { title: item.id, api: "" };
      return (
        '<div class="panel-head" data-drag-handle="1">' +
        '<div class="panel-title-wrap"><div class="panel-title">' + meta.title +
        '</div><div class="panel-api">' + (meta.api || "") + "</div></div>" +
        '<span class="panel-size" title="Grid size">' + item.w + "×" + item.h + "</span>" +
        (badgeHtml || "") +
        "</div>"
      );
    }

    function panelResizeHtml() {
      return '<div class="panel-resize" data-resize-handle="1" title="Resize panel"></div>';
    }

    function bindPanelInteractions() {
      board.querySelectorAll(".panel").forEach((el) => {
        const head = el.querySelector("[data-drag-handle]");
        if (head && !head._mesLayoutBound) {
          head._mesLayoutBound = true;
          head.addEventListener("pointerdown", (e) => {
            if (e.button != null && e.button !== 0) return;
            if (e.target.closest("[data-resize-handle]")) return;
            if (e.target.closest("button, a, input, select, textarea, .chip")) return;
            if (activeResize || activeDrag) return;
            e.preventDefault();

            const rect = el.getBoundingClientRect();
            const item = layoutItemFromEl(el);
            const title = (PANEL_META[item.id] && PANEL_META[item.id].title) || item.id;

            const ghost = document.createElement("div");
            ghost.className = "panel-ghost";
            board.appendChild(ghost);
            applyPlacement(ghost, item.x, item.y, item.w, item.h);

            const mirror = document.createElement("div");
            mirror.className = "panel-drag-mirror";
            mirror.innerHTML = '<div class="mirror-title">' + title + '</div><div class="mirror-body"></div>';
            mirror.style.width = rect.width + "px";
            mirror.style.height = Math.min(rect.height, 120) + "px";
            mirror.style.left = rect.left + "px";
            mirror.style.top = rect.top + "px";
            document.body.appendChild(mirror);

            el.classList.add("dragging-source");
            document.body.classList.add("layout-dragging");

            activeDrag = {
              el,
              id: item.id,
              w: item.w,
              h: item.h,
              offsetX: e.clientX - rect.left,
              offsetY: e.clientY - rect.top,
              ghost,
              mirror,
              previewX: item.x,
              previewY: item.y,
              moved: false,
            };
            try { head.setPointerCapture(e.pointerId); } catch (_) {}
          });
        }

        const handle = el.querySelector("[data-resize-handle]");
        if (handle && !handle._mesLayoutBound) {
          handle._mesLayoutBound = true;
          handle.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (activeDrag) return;
            const startW = Number(el.dataset.w);
            const startH = Number(el.dataset.h);
            const rect = el.getBoundingClientRect();
            activeResize = {
              el,
              startX: e.clientX,
              startY: e.clientY,
              startW,
              startH,
              cellW: Math.max(8, rect.width / startW),
              cellH: Math.max(8, rect.height / startH),
            };
            el.classList.add("resizing");
            document.body.classList.add("layout-resizing");
            try { handle.setPointerCapture(e.pointerId); } catch (_) {}
          });
        }
      });

      if (!board._layoutPointerBound) {
        board._layoutPointerBound = true;

        window.addEventListener("pointermove", (e) => {
          if (activeDrag) {
            const d = activeDrag;
            d.moved = true;
            d.mirror.style.left = (e.clientX - d.offsetX) + "px";
            d.mirror.style.top = (e.clientY - d.offsetY) + "px";
            const snap = clientToGrid(e.clientX, e.clientY, d.w, d.h, d.offsetX, d.offsetY);
            d.previewX = snap.x;
            d.previewY = snap.y;
            applyPlacement(d.ghost, snap.x, snap.y, d.w, d.h);
            return;
          }
          if (activeResize) {
            const { el, startX, startY, startW, startH, cellW, cellH } = activeResize;
            applyPanelSize(el, startW + (e.clientX - startX) / cellW, startH + (e.clientY - startY) / cellH);
          }
        });

        function endPointer() {
          if (activeDrag) {
            const d = activeDrag;
            activeDrag = null;
            d.el.classList.remove("dragging-source");
            document.body.classList.remove("layout-dragging");
            if (d.mirror) d.mirror.remove();
            if (d.ghost) d.ghost.remove();
            if (d.moved) {
              const next = layout.map((p) => Object.assign({}, p));
              const me = next.find((p) => p.id === d.id);
              if (me) {
                me.x = d.previewX;
                me.y = d.previewY;
              }
              layout = resolveCollisions(next, d.id);
              syncDomFromLayout();
              persistLayoutFromDom();
              requestAnimationFrame(function () {
                board.querySelectorAll(".panel").forEach(onResizeCharts);
              });
              showToast("Moved → (" + d.previewX + "," + d.previewY + ")");
            }
            return;
          }
          if (activeResize) {
            const el = activeResize.el;
            activeResize = null;
            el.classList.remove("resizing");
            document.body.classList.remove("layout-resizing");
            const next = Array.prototype.map.call(board.querySelectorAll(".panel"), layoutItemFromEl);
            layout = resolveCollisions(next, el.dataset.id);
            syncDomFromLayout();
            persistLayoutFromDom();
            requestAnimationFrame(function () {
              onResizeCharts(el);
              requestAnimationFrame(function () { onResizeCharts(el); });
            });
            showToast("Size " + el.dataset.w + "×" + el.dataset.h + " saved");
          }
        }

        window.addEventListener("pointerup", endPointer);
        window.addEventListener("pointercancel", endPointer);
      }
    }

    function resetLayout(defaultLayout) {
      localStorage.removeItem(LAYOUT_KEY);
      layout = defaultLayout.map((x) => Object.assign({}, x));
    }

    function cleanupArtifacts() {
      document.querySelectorAll(".panel-drag-mirror, .panel-ghost").forEach((n) => n.remove());
    }

    return {
      get layout() { return layout; },
      set layout(v) { layout = v; },
      packLayoutItems: function (items) { return packLayoutItems(items, GRID_COLS); },
      loadLayout: loadLayout,
      syncDomFromLayout: syncDomFromLayout,
      persistLayoutFromDom: persistLayoutFromDom,
      bindPanelInteractions: bindPanelInteractions,
      setEditLayout: setEditLayout,
      resetLayout: resetLayout,
      cleanupArtifacts: cleanupArtifacts,
      panelShellOpen: panelShellOpen,
      panelHeadHtml: panelHeadHtml,
      panelResizeHtml: panelResizeHtml,
      applyPlacement: applyPlacement,
    };
  }

  global.MesDemoLayout = { create: create, packLayoutItems: packLayoutItems };
})(typeof window !== "undefined" ? window : globalThis);
