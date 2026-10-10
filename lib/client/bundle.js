// src/ops/tree.ts
function cloneNode(node) {
  return {
    ...node,
    props: { ...node.props },
    children: node.children?.map(cloneNode)
  };
}
function stripUnmountable(node) {
  if (node.type === "pending" || node.type === "none") return null;
  const children = node.children?.map(stripUnmountable).filter((n) => n !== null);
  return {
    ...node,
    props: { ...node.props },
    children: children?.length ? children : void 0
  };
}
function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}
function mergeProps(old, patch) {
  const base = { ...old };
  const src = patch;
  for (const [k, v] of Object.entries(src)) {
    if (v === void 0) continue;
    const prev = base[k];
    if (isPlainObject(prev) && isPlainObject(v)) {
      base[k] = mergeProps(prev, v);
    } else {
      base[k] = Array.isArray(v) ? v.map(
        (item) => isPlainObject(item) ? { ...item } : item
      ) : v;
    }
  }
  return base;
}
function mergeUpsertNode(existing, incoming) {
  const children = incoming.children !== void 0 ? incoming.children.map(cloneNode) : existing.children?.map(cloneNode);
  return {
    ...existing,
    ...incoming,
    type: incoming.type,
    key: incoming.key,
    props: mergeProps(existing.props, incoming.props),
    children: children?.length ? children : void 0,
    bind: incoming.bind !== void 0 ? incoming.bind : existing.bind,
    binds: incoming.binds !== void 0 ? incoming.binds : existing.binds,
    visibleWhen: incoming.visibleWhen !== void 0 ? incoming.visibleWhen : existing.visibleWhen
  };
}
function replaceInForest(roots, key, next) {
  return roots.map((n) => {
    if (n.key === key) return next;
    if (!n.children?.length) return n;
    return { ...n, children: replaceInForest(n.children, key, next) };
  });
}
function findInForest(roots, key) {
  for (const n of roots) {
    if (n.key === key) return n;
    if (n.children?.length) {
      const hit = findInForest(n.children, key);
      if (hit) return hit;
    }
  }
  return null;
}
function removeFromForest(roots, key) {
  const out = [];
  for (const n of roots) {
    if (n.key === key) continue;
    out.push(
      n.children?.length ? { ...n, children: removeFromForest(n.children, key) } : n
    );
  }
  return out;
}
function patchInForest(roots, key, props) {
  return roots.map((n) => {
    if (n.key === key) {
      return { ...n, props: mergeProps(n.props, props) };
    }
    if (!n.children?.length) return n;
    return { ...n, children: patchInForest(n.children, key, props) };
  });
}
function applyOps(roots, ops) {
  let next = roots.map(cloneNode);
  for (const op of ops) {
    if (op.op === "upsert") {
      const cleaned = stripUnmountable(op.node);
      if (!cleaned) {
        next = removeFromForest(next, op.node.key);
        continue;
      }
      const existing = findInForest(next, cleaned.key);
      if (existing) {
        const merged = mergeUpsertNode(existing, cleaned);
        next = replaceInForest(next, cleaned.key, merged);
      } else {
        next = [...next, cleaned];
      }
    } else if (op.op === "remove") {
      next = removeFromForest(next, op.key);
    } else if (op.op === "patchProps") {
      next = patchInForest(next, op.key, op.props);
    }
  }
  return next;
}

// src/client/events.ts
var DSH_IUI_OPS_EVENT = "dsh-iui/ops";
var DSH_IUI_ACTION_EVENT = "dsh-iui/action";

// src/client/definition.ts
var IUI_CHAT_KIND = "dsh-iui";
function opsData(event) {
  if (event.type !== DSH_IUI_OPS_EVENT) return null;
  const data = event.data;
  if (!data || !Array.isArray(data.ops)) return null;
  return data;
}
function identityOf(event, data) {
  return data.sourceMessageId ?? `${data.sessionKey}:${data.turn ?? "t"}:${data.step ?? "s"}:${event.seq ?? 0}`;
}
var iuiDefinition = {
  kind: IUI_CHAT_KIND,
  target: "chat",
  match(event) {
    const data = opsData(event);
    if (!data) return null;
    return {
      id: identityOf(event, data),
      role: "start"
    };
  },
  start(_context, match) {
    const data = opsData(match.event);
    return {
      sessionKey: data.sessionKey,
      roots: applyOps([], data.ops),
      lastOps: data.ops,
      sourceMessageId: data.sourceMessageId
    };
  },
  update(context, match) {
    const data = opsData(match.event);
    if (!data) return context.state;
    return {
      sessionKey: data.sessionKey,
      roots: applyOps(context.state.roots, data.ops),
      lastOps: data.ops,
      sourceMessageId: data.sourceMessageId ?? context.state.sourceMessageId
    };
  },
  buildViewNode(context) {
    const start = context.start ?? context.matches[0];
    if (!context.state?.roots?.length || !start) return null;
    return {
      key: context.key,
      kind: IUI_CHAT_KIND,
      id: context.id,
      target: "chat",
      anchorSeq: start.event.seq ?? 0,
      location: start.location,
      visibility: "visible",
      data: context.state
    };
  }
};

// src/client/IuiChatNode.tsx
import { useMemo as useMemo3 } from "react";

// src/components/Node.tsx
import { useCallback, useMemo as useMemo2, useState as useState4 } from "react";

// src/ops/bind.ts
var PROP_PATH = /^[a-zA-Z_][\w.]*$/;
var LINEAR_EXPR = /^\s*(-?\d+(?:\.\d+)?)\s*\*\s*\$from\s*([+-]\s*\d+(?:\.\d+)?)?\s*$/;
var LINEAR_FROM_FIRST = /^\s*\$from\s*\*\s*(-?\d+(?:\.\d+)?)\s*([+-]\s*\d+(?:\.\d+)?)?\s*$/;
var LINEAR_FROM_ONLY = /^\s*\$from\s*([+-]\s*\d+(?:\.\d+)?)?\s*$/;
function parseLinearBind(bind) {
  if (typeof bind.from !== "string" || !bind.from) return null;
  if (typeof bind.to !== "string" || !PROP_PATH.test(bind.to)) return null;
  if (bind.expr == null || bind.expr === "") {
    const scale = bind.scale == null ? 1 : Number(bind.scale);
    const offset = bind.offset == null ? 0 : Number(bind.offset);
    if (!Number.isFinite(scale) || !Number.isFinite(offset)) return null;
    return { scale, offset };
  }
  if (typeof bind.expr !== "string") return null;
  if (/[;`(){}[\]]|function|=>|eval|Math|window|global/i.test(bind.expr)) return null;
  let m = bind.expr.match(LINEAR_EXPR);
  if (m) {
    const scale = Number(m[1]);
    const offset = m[2] ? Number(m[2].replace(/\s+/g, "")) : 0;
    return Number.isFinite(scale) && Number.isFinite(offset) ? { scale, offset } : null;
  }
  m = bind.expr.match(LINEAR_FROM_FIRST);
  if (m) {
    const scale = Number(m[1]);
    const offset = m[2] ? Number(m[2].replace(/\s+/g, "")) : 0;
    return Number.isFinite(scale) && Number.isFinite(offset) ? { scale, offset } : null;
  }
  m = bind.expr.match(LINEAR_FROM_ONLY);
  if (m) {
    const offset = m[1] ? Number(m[1].replace(/\s+/g, "")) : 0;
    return Number.isFinite(offset) ? { scale: 1, offset } : null;
  }
  return null;
}
function evalLinearBind(bind, fromValue) {
  const parsed = parseLinearBind(bind);
  if (!parsed || !Number.isFinite(fromValue)) return null;
  return parsed.scale * fromValue + parsed.offset;
}
function getAtPath(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return void 0;
    cur = cur[p];
  }
  return cur;
}
function setAtPath(obj, path, value) {
  const parts = path.split(".");
  if (parts.length === 1) return { ...obj, [parts[0]]: value };
  const out = { ...obj };
  let cur = out;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const next = cur[p];
    if (Array.isArray(next)) {
      cur[p] = [...next];
    } else if (next && typeof next === "object") {
      cur[p] = { ...next };
    } else {
      cur[p] = {};
    }
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
  return out;
}
function collectBinds(node) {
  const list = [];
  if (node.bind) {
    if (Array.isArray(node.bind)) list.push(...node.bind);
    else list.push(node.bind);
  }
  return list;
}
function roundDisplay(v) {
  if (Number.isInteger(v)) return v;
  return Math.round(v * 100) / 100;
}
function applyBindsToNode(node, formValues) {
  const binds = collectBinds(node);
  let props = { ...node.props };
  let propsChanged = false;
  for (const b of binds) {
    const raw = formValues[b.from];
    const fromNum = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(fromNum)) continue;
    const v = evalLinearBind(b, fromNum);
    if (v == null) continue;
    const leaf = roundDisplay(v);
    const existing = getAtPath(props, b.to);
    const outVal = typeof existing === "string" ? String(leaf) : leaf;
    props = setAtPath(props, b.to, outVal);
    propsChanged = true;
  }
  let children = node.children;
  let kidsChanged = false;
  if (node.children?.length) {
    const nextKids = node.children.map((c) => applyBindsToNode(c, formValues));
    kidsChanged = nextKids.some((c, i) => c !== node.children[i]);
    if (kidsChanged) children = nextKids;
  }
  if (!propsChanged && !kidsChanged) return node;
  return {
    ...node,
    props,
    ...children ? { children } : {}
  };
}
function applyBinds(roots, formValues) {
  if (!roots.length) return roots;
  if (!formValues || !Object.keys(formValues).length) {
    return roots;
  }
  return roots.map((n) => applyBindsToNode(n, formValues));
}

// src/components/Button.tsx
import { jsx } from "react/jsx-runtime";
function ButtonView({
  nodeKey,
  props,
  onAction
}) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      className: "iui-btn",
      type: "button",
      onClick: () => onAction({
        type: "action",
        key: nodeKey,
        action: props.action,
        payload: props.payload
      }),
      children: props.label
    }
  );
}

// src/components/Chart.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var COLORS = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed"];
function ChartView({ props }) {
  const series = props.series ?? [];
  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  const maxY = Math.max(1, ...allY);
  const width = 360;
  const height = 160;
  const pad = 24;
  return /* @__PURE__ */ jsxs("div", { className: "iui-card iui-chart", children: [
    props.title ? /* @__PURE__ */ jsx2("h3", { className: "iui-title", children: props.title }) : null,
    /* @__PURE__ */ jsxs("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": props.title ?? "chart", children: [
      /* @__PURE__ */ jsx2("line", { x1: pad, y1: height - pad, x2: width - 8, y2: height - pad, stroke: "#e2e8f0" }),
      /* @__PURE__ */ jsx2("line", { x1: pad, y1: 8, x2: pad, y2: height - pad, stroke: "#e2e8f0" }),
      series.map((s, si) => {
        const pts = s.points;
        if (!pts.length) return null;
        const step = pts.length === 1 ? 0 : (width - pad - 16) / (pts.length - 1);
        const d = pts.map((p, i) => {
          const x = pad + i * step;
          const y = height - pad - p.y / maxY * (height - pad - 16);
          return `${i === 0 ? "M" : "L"}${x},${y}`;
        }).join(" ");
        return /* @__PURE__ */ jsx2(
          "path",
          {
            d,
            fill: "none",
            stroke: COLORS[si % COLORS.length],
            strokeWidth: 2.5,
            strokeLinejoin: "round",
            strokeLinecap: "round"
          },
          si
        );
      })
    ] }),
    /* @__PURE__ */ jsx2("div", { className: "iui-legend", children: series.map((s, si) => /* @__PURE__ */ jsx2("span", { style: { ["--c"]: COLORS[si % COLORS.length] }, children: s.name ?? `\u7CFB\u5217 ${si + 1}` }, si)) })
  ] });
}

// src/components/Checklist.tsx
import { useEffect, useState } from "react";

// src/state/sessionStore.ts
var PREFIX = "dsh-iui:state:";
function storageKey(sessionId, blockKey) {
  return `${PREFIX}${sessionId}:${blockKey}`;
}
function loadState(sessionId, blockKey) {
  try {
    const raw = localStorage.getItem(storageKey(sessionId, blockKey));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveState(sessionId, blockKey, slice) {
  localStorage.setItem(storageKey(sessionId, blockKey), JSON.stringify(slice));
}

// src/components/Checklist.tsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function ChecklistView({ nodeKey, sessionId, props, onAction }) {
  const items = props.items ?? [];
  const saved = loadState(sessionId, nodeKey);
  const initial = {};
  for (const it of items) {
    if (it.done != null) initial[it.id] = !!it.done;
  }
  Object.assign(initial, saved?.checklistDone ?? {});
  const [doneMap, setDoneMap] = useState(initial);
  useEffect(() => {
    saveState(sessionId, nodeKey, { checklistDone: doneMap });
  }, [sessionId, nodeKey, doneMap]);
  const toggle = (id, itemAction) => {
    const nextDone = !doneMap[id];
    setDoneMap((prev) => ({ ...prev, [id]: nextDone }));
    if (itemAction) {
      onAction({
        type: "action",
        key: nodeKey,
        action: itemAction,
        payload: { itemId: id, done: nextDone }
      });
    }
  };
  return /* @__PURE__ */ jsxs2("div", { className: "iui-card iui-checklist", children: [
    props.title ? /* @__PURE__ */ jsx3("h3", { className: "iui-title", children: props.title }) : null,
    /* @__PURE__ */ jsx3("ul", { className: "iui-checklist-list", children: items.map((it) => {
      const checked = !!doneMap[it.id];
      return /* @__PURE__ */ jsx3("li", { className: checked ? "iui-checklist-item is-done" : "iui-checklist-item", children: /* @__PURE__ */ jsxs2("label", { children: [
        /* @__PURE__ */ jsx3(
          "input",
          {
            type: "checkbox",
            checked,
            onChange: () => toggle(it.id, it.action)
          }
        ),
        /* @__PURE__ */ jsx3("span", { children: it.label })
      ] }) }, it.id);
    }) })
  ] });
}

// src/components/Diagram.tsx
import { useEffect as useEffect2, useMemo, useState as useState2 } from "react";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var VIEW_W = 400;
var VIEW_H = 260;
var FILL = "#94a3b8";
var FILL_SEL = "#2563eb";
var STROKE = "#64748b";
var STROKE_SEL = "#1d4ed8";
function regionShape(r, selected) {
  const fill = selected ? FILL_SEL : FILL;
  const stroke = selected ? STROKE_SEL : STROKE;
  const opacity = selected ? 0.55 : 0.28;
  const common = {
    fill,
    stroke,
    strokeWidth: selected ? 2.5 : 1.5,
    opacity,
    style: { cursor: "pointer" }
  };
  if (r.d) {
    return /* @__PURE__ */ jsx4("path", { d: r.d, ...common, "data-region-id": r.id }, r.id);
  }
  const x = r.x ?? 0;
  const y = r.y ?? 0;
  const w = r.w ?? 40;
  const h = r.h ?? 40;
  return /* @__PURE__ */ jsx4(
    "rect",
    {
      x,
      y,
      width: w,
      height: h,
      rx: 6,
      ...common,
      "data-region-id": r.id
    },
    r.id
  );
}
function DiagramView({ nodeKey, sessionId, props, onAction, onDiagramSelect }) {
  const regions = props.regions ?? [];
  const saved = loadState(sessionId, nodeKey);
  const initial = typeof saved?.diagramSelected === "string" && saved.diagramSelected || props.selectedId || regions[0]?.id || "";
  const [selectedId, setSelectedId] = useState2(initial);
  useEffect2(() => {
    if (selectedId) {
      saveState(sessionId, nodeKey, { diagramSelected: selectedId });
      onDiagramSelect?.(nodeKey, selectedId);
    }
  }, [sessionId, nodeKey, selectedId, onDiagramSelect]);
  const selected = useMemo(
    () => regions.find((r) => r.id === selectedId) ?? null,
    [regions, selectedId]
  );
  const select = (id, regionAction) => {
    setSelectedId(id);
    const action = regionAction ?? props.action;
    if (action) {
      onAction({
        type: "action",
        key: nodeKey,
        action,
        payload: { regionId: id }
      });
    }
  };
  const onSvgClick = (e) => {
    const el = e.target.closest("[data-region-id]");
    if (!el) return;
    const id = el.getAttribute("data-region-id");
    if (!id) return;
    const region = regions.find((r) => r.id === id);
    select(id, region?.action);
  };
  const src = props.src;
  return /* @__PURE__ */ jsxs3("div", { className: "iui-card iui-diagram", children: [
    props.title ? /* @__PURE__ */ jsx4("h3", { className: "iui-title", children: props.title }) : null,
    /* @__PURE__ */ jsx4("div", { className: "iui-diagram-canvas", children: /* @__PURE__ */ jsxs3(
      "svg",
      {
        viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
        role: "img",
        "aria-label": props.title ?? "diagram",
        onClick: onSvgClick,
        children: [
          src ? /* @__PURE__ */ jsx4("image", { href: src, x: 0, y: 0, width: VIEW_W, height: VIEW_H, preserveAspectRatio: "xMidYMid meet" }) : /* @__PURE__ */ jsx4("rect", { x: 0, y: 0, width: VIEW_W, height: VIEW_H, fill: "#f8fafc", rx: 8 }),
          !src ? /* @__PURE__ */ jsxs3("g", { opacity: 0.12, pointerEvents: "none", children: [
            /* @__PURE__ */ jsx4("circle", { cx: 90, cy: 180, r: 48, fill: "none", stroke: "#0f172a", strokeWidth: 6 }),
            /* @__PURE__ */ jsx4("circle", { cx: 300, cy: 180, r: 48, fill: "none", stroke: "#0f172a", strokeWidth: 6 }),
            /* @__PURE__ */ jsx4(
              "path",
              {
                d: "M90 180 L160 100 L250 100 L300 180 M160 100 L140 180 M200 100 L200 70",
                fill: "none",
                stroke: "#0f172a",
                strokeWidth: 5,
                strokeLinecap: "round"
              }
            )
          ] }) : null,
          regions.map((r) => regionShape(r, r.id === selectedId)),
          regions.map((r) => {
            const cx = r.d ? void 0 : (r.x ?? 0) + (r.w ?? 40) / 2;
            const cy = r.d ? void 0 : (r.y ?? 0) + (r.h ?? 40) / 2;
            if (cx == null || cy == null) return null;
            return /* @__PURE__ */ jsx4(
              "text",
              {
                x: cx,
                y: cy,
                textAnchor: "middle",
                dominantBaseline: "middle",
                fontSize: 12,
                fontWeight: r.id === selectedId ? 700 : 500,
                fill: r.id === selectedId ? "#1e3a8a" : "#334155",
                pointerEvents: "none",
                children: r.label
              },
              `${r.id}-label`
            );
          })
        ]
      }
    ) }),
    selected ? /* @__PURE__ */ jsxs3("div", { className: "iui-diagram-panel", "data-selected": selected.id, children: [
      /* @__PURE__ */ jsx4("div", { className: "iui-diagram-panel-label", children: selected.label }),
      selected.body ? /* @__PURE__ */ jsx4("div", { className: "iui-diagram-panel-body", children: selected.body }) : null
    ] }) : /* @__PURE__ */ jsx4("div", { className: "iui-diagram-panel is-empty", children: "\u70B9\u51FB\u5206\u533A\u67E5\u770B\u8BF4\u660E" })
  ] });
}

// src/components/Form.tsx
import { useEffect as useEffect3, useState as useState3 } from "react";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function fieldKey(f) {
  return f.id ?? f.name ?? "";
}
function fieldKind(f) {
  return f.kind ?? f.type ?? "text";
}
function buildInitial(props, sessionId, nodeKey) {
  const initial = { ...props.values ?? {} };
  for (const f of props.fields ?? []) {
    const k = fieldKey(f);
    if (!k) continue;
    if (fieldKind(f) === "slider" && f.value != null && initial[k] == null) {
      initial[k] = f.value;
    }
  }
  const saved = loadState(sessionId, nodeKey);
  Object.assign(initial, saved?.formValues ?? {});
  return initial;
}
function FormView({ nodeKey, sessionId, props, onAction, onLocalValues }) {
  const [values, setValues] = useState3(() => buildInitial(props, sessionId, nodeKey));
  useEffect3(() => {
    saveState(sessionId, nodeKey, { formValues: values });
  }, [sessionId, nodeKey, values]);
  useEffect3(() => {
    onLocalValues?.(nodeKey, values);
  }, [nodeKey, values, onLocalValues]);
  useEffect3(() => {
    setValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const f of props.fields ?? []) {
        const k = fieldKey(f);
        if (!k || next[k] != null) continue;
        if (fieldKind(f) === "slider" && f.value != null) {
          next[k] = f.value;
          changed = true;
        }
      }
      const saved = loadState(sessionId, nodeKey);
      if (saved?.formValues) {
        for (const [k, v] of Object.entries(saved.formValues)) {
          if (next[k] == null && v != null) {
            next[k] = v;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [sessionId, nodeKey, props.fields]);
  const showSubmit = props.submitAction != null || props.submitLabel != null;
  const setField = (key, val) => {
    setValues((v) => ({ ...v, [key]: val }));
  };
  return /* @__PURE__ */ jsxs4(
    "form",
    {
      className: "iui-card iui-form",
      onSubmit: (e) => {
        e.preventDefault();
        if (!showSubmit) return;
        onAction({
          type: "action",
          key: nodeKey,
          action: props.submitAction ?? "submit",
          payload: { values }
        });
      },
      children: [
        (props.fields ?? []).map((f) => {
          const key = fieldKey(f);
          if (!key) return null;
          const kind = fieldKind(f);
          const id = `${nodeKey}-${key}`;
          if (kind === "slider") {
            const min = f.min ?? 0;
            const max = f.max ?? 100;
            const step = f.step ?? 1;
            const raw = values[key];
            const num = typeof raw === "number" ? raw : Number(raw ?? f.value ?? min);
            const safe = Number.isFinite(num) ? num : min;
            return /* @__PURE__ */ jsxs4("div", { className: "iui-field iui-field-slider", children: [
              /* @__PURE__ */ jsxs4("div", { className: "iui-slider-head", children: [
                /* @__PURE__ */ jsx5("label", { htmlFor: id, children: f.label ?? key }),
                /* @__PURE__ */ jsx5("span", { className: "iui-slider-value", children: safe })
              ] }),
              /* @__PURE__ */ jsx5(
                "input",
                {
                  id,
                  type: "range",
                  min,
                  max,
                  step,
                  value: safe,
                  onChange: (e) => setField(key, Number(e.target.value))
                }
              ),
              /* @__PURE__ */ jsxs4("div", { className: "iui-slider-range", children: [
                /* @__PURE__ */ jsx5("span", { children: min }),
                /* @__PURE__ */ jsx5("span", { children: max })
              ] })
            ] }, key);
          }
          return /* @__PURE__ */ jsxs4("div", { className: "iui-field", children: [
            /* @__PURE__ */ jsx5("label", { htmlFor: id, children: f.label ?? key }),
            kind === "select" ? /* @__PURE__ */ jsxs4(
              "select",
              {
                id,
                value: String(values[key] ?? ""),
                onChange: (e) => setField(key, e.target.value),
                children: [
                  /* @__PURE__ */ jsx5("option", { value: "", children: "\u8BF7\u9009\u62E9" }),
                  (f.options ?? []).map((o) => /* @__PURE__ */ jsx5("option", { value: o, children: o }, o))
                ]
              }
            ) : /* @__PURE__ */ jsx5(
              "input",
              {
                id,
                type: kind === "number" ? "number" : "text",
                placeholder: f.placeholder,
                value: values[key] ?? "",
                onChange: (e) => setField(
                  key,
                  kind === "number" ? Number(e.target.value) : e.target.value
                )
              }
            )
          ] }, key);
        }),
        showSubmit ? /* @__PURE__ */ jsx5("button", { className: "iui-btn", type: "submit", children: props.submitLabel ?? "\u63D0\u4EA4" }) : null
      ]
    }
  );
}

// src/components/Hotspot.tsx
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function HotspotView({ props }) {
  return /* @__PURE__ */ jsxs5("div", { className: "iui-card iui-hotspot", "data-hotspot-id": props.id, children: [
    /* @__PURE__ */ jsx6("div", { className: "iui-hotspot-label", children: props.label }),
    props.body ? /* @__PURE__ */ jsx6("div", { className: "iui-hotspot-body", children: props.body }) : null
  ] });
}

// src/components/Stat.tsx
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
function normalizeItems(props) {
  if (props.items?.length) return props.items;
  if (props.label != null && props.value != null) {
    return [{ label: props.label, value: props.value, delta: props.delta }];
  }
  return [];
}
function formatDelta(delta) {
  if (delta == null || delta === "") return null;
  return String(delta);
}
function StatView({ props }) {
  const items = normalizeItems(props);
  return /* @__PURE__ */ jsx7("div", { className: "iui-card iui-stat", children: /* @__PURE__ */ jsx7("div", { className: "iui-stat-grid", children: items.map((it, i) => {
    const delta = formatDelta(it.delta);
    const deltaPositive = delta != null && (String(delta).startsWith("+") || !String(delta).startsWith("-") && Number(delta) > 0);
    const deltaNegative = delta != null && (String(delta).startsWith("-") || Number(delta) < 0);
    return /* @__PURE__ */ jsxs6("div", { className: "iui-stat-item", children: [
      /* @__PURE__ */ jsx7("div", { className: "iui-stat-label", children: it.label }),
      /* @__PURE__ */ jsx7("div", { className: "iui-stat-value", children: it.value }),
      delta != null ? /* @__PURE__ */ jsx7(
        "div",
        {
          className: deltaNegative ? "iui-stat-delta is-neg" : deltaPositive ? "iui-stat-delta is-pos" : "iui-stat-delta",
          children: delta
        }
      ) : null
    ] }, `${it.label}-${i}`);
  }) }) });
}

// src/components/Table.tsx
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
function TableView({ props }) {
  const columns = props.columns ?? [];
  const rows = props.rows ?? [];
  return /* @__PURE__ */ jsxs7("div", { className: "iui-card iui-table-wrap", children: [
    props.title ? /* @__PURE__ */ jsx8("h3", { className: "iui-title", children: props.title }) : null,
    /* @__PURE__ */ jsx8("div", { className: "iui-table-scroll", children: /* @__PURE__ */ jsxs7("table", { className: "iui-table", children: [
      /* @__PURE__ */ jsx8("thead", { children: /* @__PURE__ */ jsx8("tr", { children: columns.map((c) => /* @__PURE__ */ jsx8("th", { children: c }, c)) }) }),
      /* @__PURE__ */ jsx8("tbody", { children: rows.map((row, ri) => /* @__PURE__ */ jsx8("tr", { children: columns.map((_, ci) => /* @__PURE__ */ jsx8("td", { children: row[ci] ?? "" }, ci)) }, ri)) })
    ] }) })
  ] });
}

// src/components/Text.tsx
import { jsx as jsx9 } from "react/jsx-runtime";
function TextView({ props }) {
  return /* @__PURE__ */ jsx9("div", { className: "iui-text", children: props.content });
}

// src/components/Node.tsx
import { jsx as jsx10 } from "react/jsx-runtime";
var ALIGN_MAP = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch"
};
var JUSTIFY_MAP = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around"
};
function isMountable(n) {
  return n.type !== "pending" && n.type !== "none";
}
function visibleWhenId(node) {
  if (typeof node.visibleWhen === "string" && node.visibleWhen) return node.visibleWhen;
  if (node.type === "hotspot") {
    const p = node.props;
    if (typeof p.visibleWhen === "string" && p.visibleWhen) return p.visibleWhen;
  }
  return void 0;
}
function isVisible(node, ctx) {
  const when = visibleWhenId(node);
  if (!when) return true;
  const selected = ctx.diagramSelected ?? {};
  return Object.values(selected).includes(when);
}
function LayoutItem({
  child,
  parentType,
  ctx
}) {
  if (!isVisible(child, ctx)) return null;
  const lp = child.props ?? {};
  const isLeafCtrl = child.type === "button";
  const grow = lp.grow ?? (parentType === "row" ? isLeafCtrl ? 0 : 1 : void 0);
  const minWidth = lp.minWidth ?? (parentType === "row" ? isLeafCtrl ? 0 : 200 : void 0);
  const style = {};
  if (grow != null) style.flex = `${grow} 1 auto`;
  if (minWidth != null) style.minWidth = minWidth;
  if (parentType === "col") style.width = "100%";
  if (isLeafCtrl) {
    style.flexGrow = 0;
    style.flexBasis = "auto";
  }
  return /* @__PURE__ */ jsx10("div", { className: "iui-layout-item", style, children: /* @__PURE__ */ jsx10(NodeView, { node: child, ctx }) });
}
function NodeView({ node, ctx }) {
  if (!isMountable(node)) return null;
  if (!isVisible(node, ctx)) return null;
  if (node.type === "chart") {
    return /* @__PURE__ */ jsx10("div", { "data-iui-type": "chart", "data-iui-key": node.key, className: "iui-node", children: /* @__PURE__ */ jsx10(ChartView, { props: node.props }) });
  }
  if (node.type === "form") {
    return /* @__PURE__ */ jsx10("div", { "data-iui-type": "form", "data-iui-key": node.key, className: "iui-node", children: /* @__PURE__ */ jsx10(
      FormView,
      {
        nodeKey: node.key,
        sessionId: ctx.sessionId,
        props: node.props,
        onAction: ctx.onAction,
        onLocalValues: ctx.onLocalValues
      }
    ) });
  }
  if (node.type === "button") {
    return /* @__PURE__ */ jsx10("div", { "data-iui-type": "button", "data-iui-key": node.key, className: "iui-node", children: /* @__PURE__ */ jsx10(
      ButtonView,
      {
        nodeKey: node.key,
        props: node.props,
        onAction: ctx.onAction
      }
    ) });
  }
  if (node.type === "text") {
    return /* @__PURE__ */ jsx10("div", { "data-iui-type": "text", "data-iui-key": node.key, className: "iui-node", children: /* @__PURE__ */ jsx10(TextView, { props: node.props }) });
  }
  if (node.type === "checklist") {
    return /* @__PURE__ */ jsx10("div", { "data-iui-type": "checklist", "data-iui-key": node.key, className: "iui-node", children: /* @__PURE__ */ jsx10(
      ChecklistView,
      {
        nodeKey: node.key,
        sessionId: ctx.sessionId,
        props: node.props,
        onAction: ctx.onAction
      }
    ) });
  }
  if (node.type === "stat") {
    return /* @__PURE__ */ jsx10("div", { "data-iui-type": "stat", "data-iui-key": node.key, className: "iui-node", children: /* @__PURE__ */ jsx10(StatView, { props: node.props }) });
  }
  if (node.type === "table") {
    return /* @__PURE__ */ jsx10("div", { "data-iui-type": "table", "data-iui-key": node.key, className: "iui-node", children: /* @__PURE__ */ jsx10(TableView, { props: node.props }) });
  }
  if (node.type === "diagram") {
    return /* @__PURE__ */ jsx10("div", { "data-iui-type": "diagram", "data-iui-key": node.key, className: "iui-node", children: /* @__PURE__ */ jsx10(
      DiagramView,
      {
        nodeKey: node.key,
        sessionId: ctx.sessionId,
        props: node.props,
        onAction: ctx.onAction,
        onDiagramSelect: ctx.onDiagramSelect
      }
    ) });
  }
  if (node.type === "hotspot") {
    return /* @__PURE__ */ jsx10("div", { "data-iui-type": "hotspot", "data-iui-key": node.key, className: "iui-node", children: /* @__PURE__ */ jsx10(HotspotView, { props: node.props }) });
  }
  if (node.type === "row" || node.type === "col") {
    const lp = node.props ?? {};
    const gap = lp.gap ?? 12;
    const cls = node.type === "row" ? "iui-row" : "iui-col";
    const style = { gap };
    if (lp.align) style.alignItems = ALIGN_MAP[lp.align];
    if (lp.justify) style.justifyContent = JUSTIFY_MAP[lp.justify];
    if (lp.wrap != null) style.flexWrap = lp.wrap ? "wrap" : "nowrap";
    const kids = (node.children ?? []).filter(isMountable);
    return /* @__PURE__ */ jsx10(
      "div",
      {
        className: cls,
        style,
        "data-iui-type": node.type,
        "data-iui-key": node.key,
        children: kids.map((c) => /* @__PURE__ */ jsx10(LayoutItem, { child: c, parentType: node.type, ctx }, c.key))
      }
    );
  }
  return null;
}
function IuiForest({
  roots,
  sessionId,
  onAction
}) {
  const [formValues, setFormValues] = useState4({});
  const [diagramSelected, setDiagramSelected] = useState4({});
  const onLocalValues = useCallback(
    (_formKey, values) => {
      setFormValues((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [k, v] of Object.entries(values)) {
          if (next[k] !== v) {
            next[k] = v;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    []
  );
  const onDiagramSelect = useCallback((diagramKey, selectedId) => {
    setDiagramSelected((prev) => {
      if (prev[diagramKey] === selectedId) return prev;
      return { ...prev, [diagramKey]: selectedId };
    });
  }, []);
  const displayRoots = useMemo2(
    () => applyBinds(roots, formValues),
    [roots, formValues]
  );
  const ctx = useMemo2(
    () => ({ sessionId, onAction, onLocalValues, diagramSelected, onDiagramSelect }),
    [sessionId, onAction, onLocalValues, diagramSelected, onDiagramSelect]
  );
  return /* @__PURE__ */ jsx10("div", { className: "iui-root", children: displayRoots.filter(isMountable).map((n) => /* @__PURE__ */ jsx10(NodeView, { node: n, ctx }, n.key)) });
}

// src/client/ensureStyles.ts
var STYLE_ID = "dsh-iui-styles";
var CSS = ".iui-root {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  width: 100%;\n  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;\n  color: #0f172a;\n}\n.iui-card {\n  border: 1px solid #e2e8f0;\n  border-radius: 12px;\n  padding: 14px 16px;\n  background: #fff;\n  box-shadow: 0 1px 2px rgb(15 23 42 / 4%);\n  width: 100%;\n  box-sizing: border-box;\n}\n.iui-title {\n  font-size: 14px;\n  font-weight: 600;\n  margin: 0 0 10px;\n}\n.iui-row {\n  display: flex;\n  flex-direction: row;\n  flex-wrap: wrap;\n  align-items: stretch;\n  width: 100%;\n  box-sizing: border-box;\n}\n.iui-col {\n  display: flex;\n  flex-direction: column;\n  width: 100%;\n  box-sizing: border-box;\n  min-width: 0;\n}\n.iui-row > .iui-layout-item,\n.iui-col > .iui-layout-item {\n  box-sizing: border-box;\n  min-width: 0;\n}\n.iui-layout-item {\n  flex: 1 1 0;\n  min-width: 200px;\n  display: flex;\n  flex-direction: column;\n}\n.iui-layout-item > .iui-node,\n.iui-layout-item > .iui-row,\n.iui-layout-item > .iui-col {\n  width: 100%;\n  flex: 1 1 auto;\n}\n.iui-node {\n  width: 100%;\n  min-width: 0;\n}\n.iui-text {\n  font-size: 14px;\n  line-height: 1.55;\n  white-space: pre-wrap;\n}\n.iui-btn {\n  appearance: none;\n  border: none;\n  border-radius: 8px;\n  padding: 8px 14px;\n  background: #2563eb;\n  color: #fff;\n  font-size: 14px;\n  font-weight: 600;\n  cursor: pointer;\n}\n.iui-btn:hover { background: #1d4ed8; }\n.iui-btn:active { transform: translateY(1px); }\n.iui-form {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n.iui-field {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n.iui-field label {\n  font-size: 12px;\n  color: #64748b;\n}\n.iui-field input,\n.iui-field select {\n  border: 1px solid #cbd5e1;\n  border-radius: 8px;\n  padding: 8px 10px;\n  font-size: 14px;\n}\n.iui-chart {\n  width: 100%;\n  overflow: hidden;\n}\n.iui-chart svg {\n  width: 100%;\n  height: auto;\n  display: block;\n}\n.iui-legend {\n  display: flex;\n  gap: 12px;\n  flex-wrap: wrap;\n  margin-top: 8px;\n  font-size: 12px;\n  color: #64748b;\n}\n.iui-legend span::before {\n  content: '';\n  display: inline-block;\n  width: 8px;\n  height: 8px;\n  border-radius: 2px;\n  margin-right: 6px;\n  background: var(--c, #2563eb);\n}\n.iui-checklist-list {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n.iui-checklist-item label {\n  display: flex;\n  align-items: flex-start;\n  gap: 10px;\n  font-size: 14px;\n  line-height: 1.45;\n  cursor: pointer;\n}\n.iui-checklist-item input[type='checkbox'] {\n  margin-top: 3px;\n  width: 16px;\n  height: 16px;\n  accent-color: #2563eb;\n  flex-shrink: 0;\n}\n.iui-checklist-item.is-done span {\n  color: #64748b;\n  text-decoration: line-through;\n}\n.iui-stat-grid {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 12px;\n}\n.iui-stat-item {\n  flex: 1 1 120px;\n  min-width: 100px;\n}\n.iui-stat-label {\n  font-size: 12px;\n  color: #64748b;\n  margin-bottom: 4px;\n}\n.iui-stat-value {\n  font-size: 22px;\n  font-weight: 700;\n  letter-spacing: -0.02em;\n  line-height: 1.2;\n}\n.iui-stat-delta {\n  margin-top: 4px;\n  font-size: 12px;\n  color: #64748b;\n}\n.iui-stat-delta.is-pos { color: #16a34a; }\n.iui-stat-delta.is-neg { color: #dc2626; }\n.iui-table-scroll {\n  width: 100%;\n  overflow-x: auto;\n}\n.iui-table {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 13px;\n}\n.iui-table th,\n.iui-table td {\n  border-bottom: 1px solid #e2e8f0;\n  padding: 8px 10px;\n  text-align: left;\n  white-space: nowrap;\n}\n.iui-table th {\n  font-size: 11px;\n  font-weight: 600;\n  color: #64748b;\n  text-transform: uppercase;\n  letter-spacing: 0.03em;\n}\n.iui-table tbody tr:last-child td {\n  border-bottom: none;\n}\n.iui-field-slider input[type='range'] {\n  width: 100%;\n  accent-color: #2563eb;\n  height: 6px;\n  cursor: pointer;\n}\n.iui-slider-head {\n  display: flex;\n  align-items: baseline;\n  justify-content: space-between;\n  gap: 8px;\n}\n.iui-slider-head label {\n  font-size: 12px;\n  color: #64748b;\n}\n.iui-slider-value {\n  font-size: 14px;\n  font-weight: 700;\n  color: #0f172a;\n  font-variant-numeric: tabular-nums;\n}\n.iui-slider-range {\n  display: flex;\n  justify-content: space-between;\n  font-size: 11px;\n  color: #94a3b8;\n  margin-top: 2px;\n}\n.iui-diagram-canvas {\n  width: 100%;\n  overflow: hidden;\n  border-radius: 8px;\n  background: #f8fafc;\n  border: 1px solid #e2e8f0;\n}\n.iui-diagram-canvas svg {\n  width: 100%;\n  height: auto;\n  display: block;\n}\n.iui-diagram-panel {\n  margin-top: 10px;\n  padding: 10px 12px;\n  border-radius: 8px;\n  background: #eff6ff;\n  border: 1px solid #bfdbfe;\n}\n.iui-diagram-panel.is-empty {\n  background: #f8fafc;\n  border-color: #e2e8f0;\n  color: #94a3b8;\n  font-size: 13px;\n}\n.iui-diagram-panel-label {\n  font-size: 14px;\n  font-weight: 700;\n  color: #1e3a8a;\n  margin-bottom: 4px;\n}\n.iui-diagram-panel-body {\n  font-size: 13px;\n  line-height: 1.5;\n  color: #334155;\n}\n.iui-hotspot-label {\n  font-size: 14px;\n  font-weight: 700;\n  color: #0f172a;\n  margin-bottom: 6px;\n}\n.iui-hotspot-body {\n  font-size: 13px;\n  line-height: 1.55;\n  color: #475569;\n}\n";
function ensureIuiStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

// src/client/IuiChatNode.tsx
import { jsx as jsx11 } from "react/jsx-runtime";
function IuiChatNodeView({ node, emitAction, appendSessionEvent }) {
  ensureIuiStyles();
  const state = node?.data;
  const roots = state?.roots ?? [];
  const sessionId = state?.sessionKey ?? "default";
  const onAction = useMemo3(
    () => (ev) => {
      emitAction?.(ev);
      appendSessionEvent?.(DSH_IUI_ACTION_EVENT, {
        sessionKey: sessionId,
        key: ev.key,
        action: ev.action,
        payload: ev.payload
      });
    },
    [emitAction, appendSessionEvent, sessionId]
  );
  if (!roots.length) return null;
  return /* @__PURE__ */ jsx11("div", { className: "iui-chat-node", "data-dsh-iui": "1", children: /* @__PURE__ */ jsx11(IuiForest, { roots, sessionId, onAction }) });
}

// src/client/plugin.ts
var name = "dsh-iui-client";
var inject = ["slots", "uiConversation", "remote"];
var attached = null;
function getAttachedBridge() {
  return attached;
}
function attachBridge(bridge) {
  attached = bridge;
  return () => {
    if (attached === bridge) attached = null;
  };
}
function apply(ctx) {
  const c = ctx;
  if (c.dshIui?.bridge) {
    attachBridge(c.dshIui.bridge);
    console.info("[dsh-iui-client] optional in-process bridge attached", c.dshIui.bridge.sessionId);
  }
  const run = (fn, label) => {
    if (c.effect) c.effect(fn, label);
    else fn();
  };
  run(() => c.uiConversation.events.register(iuiDefinition), "dsh-iui: conversation definition");
  run(
    () => c.slots.inject(
      "conversation.chat.node",
      () => c.slots.register(
        {
          name: "conversation.chat.node",
          key: IUI_CHAT_KIND,
          inject: () => ({
            emitAction: (ev) => {
              attached?.emitAction(ev);
            },
            appendSessionEvent: (type, data) => {
              try {
                c.remote?.session?.append?.(type, data);
              } catch (err) {
                console.info("[dsh-iui-client] appendSessionEvent failed", type, err);
              }
            }
          })
        },
        IuiChatNodeView
      )
    ),
    "dsh-iui: chat.node renderer"
  );
  console.info("[dsh-iui-client] registered match dsh-iui/ops + conversation.chat.node");
}

// src/client/useIuiBridge.ts
import { useEffect as useEffect4, useState as useState5 } from "react";
function useIuiBridge(bridge) {
  const [roots, setRoots] = useState5([]);
  useEffect4(() => {
    if (!bridge) return;
    setRoots([]);
    return bridge.onOps((ops) => {
      setRoots((prev) => applyOps(prev, ops));
    });
  }, [bridge]);
  const emitAction = (ev) => {
    bridge?.emitAction(ev);
  };
  return {
    roots,
    sessionId: bridge?.sessionId ?? "default",
    emitAction,
    reset: () => setRoots([])
  };
}

// src/client/IuiMount.tsx
import { jsx as jsx12 } from "react/jsx-runtime";
function IuiMount({ bridge }) {
  ensureIuiStyles();
  const { roots, sessionId, emitAction } = useIuiBridge(bridge);
  return /* @__PURE__ */ jsx12(IuiForest, { roots, sessionId, onAction: emitAction });
}
export {
  DSH_IUI_ACTION_EVENT,
  DSH_IUI_OPS_EVENT,
  IUI_CHAT_KIND,
  IuiChatNodeView,
  IuiMount,
  apply,
  attachBridge,
  getAttachedBridge,
  inject,
  iuiDefinition,
  name,
  useIuiBridge
};
