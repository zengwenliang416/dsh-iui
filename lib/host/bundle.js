// src/host/parseFence.ts
var FENCE_RE = /```dsh-iui\s*\n([\s\S]*?)```/g;
var FENCE_OPEN_RE = /```dsh-iui\s*\n([\s\S]*)$/;
function extractCompleteFences(text) {
  const out = [];
  for (const m of text.matchAll(FENCE_RE)) {
    const body = m[1]?.trim();
    if (body) out.push(body);
  }
  return out;
}
function extractOpenFenceBody(text) {
  const withoutComplete = text.replace(FENCE_RE, "");
  const m = withoutComplete.match(FENCE_OPEN_RE);
  return m?.[1] ?? null;
}
function isPayload(v) {
  if (!v || typeof v !== "object") return false;
  const o = v;
  return typeof o.key === "string" && o.props !== void 0 && typeof o.props === "object";
}
function parsePayloadRoots(body) {
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return [];
  }
  if (Array.isArray(data)) return data.filter(isPayload);
  if (data && typeof data === "object" && Array.isArray(data.blocks)) {
    return data.blocks.filter(isPayload);
  }
  if (isPayload(data)) return [data];
  return [];
}
function extractCompleteJsonObjects(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "{") {
      i++;
      continue;
    }
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inStr) {
        if (esc) {
          esc = false;
        } else if (ch === "\\") {
          esc = true;
        } else if (ch === '"') {
          inStr = false;
        }
        continue;
      }
      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end < 0) {
      i++;
      continue;
    }
    const slice = text.slice(i, end + 1);
    try {
      const data = JSON.parse(slice);
      if (isPayload(data)) out.push(data);
      else if (data && typeof data === "object" && Array.isArray(data.blocks)) {
        out.push(...data.blocks.filter(isPayload));
      }
    } catch {
    }
    i = end + 1;
  }
  return out;
}
function flattenPayloads(list) {
  const out = [];
  const walk = (p) => {
    out.push(p);
    p.children?.forEach(walk);
  };
  list.forEach(walk);
  return out;
}
function parseStreamingPayloads(buffer) {
  const roots = [];
  for (const body of extractCompleteFences(buffer)) {
    roots.push(...parsePayloadRoots(body));
  }
  return roots;
}
function parseProgressivePayloads(buffer) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  const add = (list) => {
    for (const p of flattenPayloads(list)) {
      if (seen.has(p.key)) continue;
      seen.add(p.key);
      out.push(p);
    }
  };
  for (const body of extractCompleteFences(buffer)) {
    add(parsePayloadRoots(body));
  }
  const open = extractOpenFenceBody(buffer);
  if (open) {
    const full = parsePayloadRoots(open.trim());
    if (full.length) add(full);
    else add(extractCompleteJsonObjects(open));
  }
  return out;
}

// src/host/jev.ts
var LAYOUT = /* @__PURE__ */ new Set(["row", "col"]);
var CRITERIA = {
  chart: "numeric series / time series / comparison chart data",
  form: "user should fill fields or submit structured input",
  button: "a single clickable action",
  text: "prose or labels only, no interactive control",
  none: "do not render a UI block; keep markdown only"
};
function heuristicPick(payload) {
  const props = payload.props;
  if (Array.isArray(props.series)) {
    return { choice: "chart", confidence: 0.9, source: "heuristic" };
  }
  if (Array.isArray(props.fields)) {
    return { choice: "form", confidence: 0.9, source: "heuristic" };
  }
  if (typeof props.label === "string" && typeof props.action === "string") {
    return { choice: "button", confidence: 0.9, source: "heuristic" };
  }
  if (typeof props.content === "string") {
    return { choice: "text", confidence: 0.85, source: "heuristic" };
  }
  return { choice: "none", confidence: 0.6, source: "heuristic" };
}
async function decideType(payload, opts = {}) {
  if (payload.type && LAYOUT.has(payload.type)) {
    return { choice: payload.type, confidence: 1, source: "layout-passthrough" };
  }
  if (payload.type === "row" || payload.type === "col") {
    return { choice: payload.type, confidence: 1, source: "layout-passthrough" };
  }
  const apiKey = opts.apiKey ?? (typeof globalThis !== "undefined" && globalThis.process?.env ? globalThis.process.env.JEV_API_KEY : void 0);
  if (!apiKey) return heuristicPick(payload);
  const endpoint = opts.endpoint ?? "https://jevtypesafeai.com/api/v1/decide";
  const fetchFn = opts.fetchImpl ?? fetch;
  const state = {
    intent: opts.intentSummary ?? "",
    key: payload.key,
    propsShape: Object.keys(payload.props ?? {}),
    props: payload.props
  };
  try {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "jev-latest",
        state,
        questions: {
          component: {
            type: "choice",
            instructions: "Pick the best UI component type for this payload block.",
            criteria: CRITERIA
          }
        }
      })
    });
    if (!res.ok) return heuristicPick(payload);
    const data = await res.json();
    const choice = data.answers?.component?.choice;
    const confidence = data.answers?.component?.confidence ?? 0;
    if (!choice || !(choice in CRITERIA)) return heuristicPick(payload);
    return { choice, confidence, source: "jev" };
  } catch {
    return heuristicPick(payload);
  }
}
function isLayoutType(type) {
  return type === "row" || type === "col";
}

// src/host/validate.ts
var PROP_PATH = /^[a-zA-Z_][\w.]*$/;
var LINEAR_EXPR = /^\s*(-?\d+(?:\.\d+)?)\s*\*\s*\$from\s*([+-]\s*\d+(?:\.\d+)?)?\s*$/;
var LINEAR_FROM_FIRST = /^\s*\$from\s*\*\s*(-?\d+(?:\.\d+)?)\s*([+-]\s*\d+(?:\.\d+)?)?\s*$/;
var LINEAR_FROM_ONLY = /^\s*\$from\s*([+-]\s*\d+(?:\.\d+)?)?\s*$/;
function fieldKey(f) {
  const k = f.id ?? f.name;
  return typeof k === "string" && k.length > 0 ? k : null;
}
function fieldKind(f) {
  return f.kind ?? f.type;
}
function sanitizeSliderField(raw) {
  const kind = fieldKind(raw);
  if (kind !== "slider") return raw;
  const id = fieldKey(raw);
  if (!id) return null;
  const min = Number(raw.min);
  const max = Number(raw.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;
  const step = raw.step == null ? 1 : Number(raw.step);
  if (!Number.isFinite(step) || step <= 0) return null;
  let value = raw.value == null ? min : Number(raw.value);
  if (!Number.isFinite(value)) value = min;
  value = Math.min(max, Math.max(min, value));
  return {
    ...raw,
    id,
    name: raw.name ?? id,
    kind: "slider",
    type: "slider",
    min,
    max,
    step,
    value,
    local: raw.local !== false
  };
}
function sanitizeFormFields(fields) {
  if (!Array.isArray(fields)) return [];
  const out = [];
  for (const f of fields) {
    if (!f || typeof f !== "object") continue;
    const field = f;
    if (fieldKind(field) === "slider") {
      const s = sanitizeSliderField(field);
      if (s) out.push(s);
      continue;
    }
    const key = fieldKey(field);
    if (!key) continue;
    out.push({ ...field, name: field.name ?? key, id: field.id ?? key });
  }
  return out;
}
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
function sanitizeBind(raw) {
  if (!raw || typeof raw !== "object") return null;
  const b = raw;
  const parsed = parseLinearBind(b);
  if (!parsed) return null;
  return {
    from: b.from,
    to: b.to,
    scale: parsed.scale,
    offset: parsed.offset,
    ...b.expr ? { expr: b.expr } : {}
  };
}
function sanitizeBinds(raw) {
  if (raw == null) return void 0;
  const list = Array.isArray(raw) ? raw : [raw];
  const out = list.map(sanitizeBind).filter((b) => b !== null);
  return out.length ? out : void 0;
}
function evalLinearBind(bind, fromValue) {
  const parsed = parseLinearBind(bind);
  if (!parsed || !Number.isFinite(fromValue)) return null;
  return parsed.scale * fromValue + parsed.offset;
}
function isSafeDiagramSrc(src) {
  if (typeof src !== "string" || !src.trim()) return false;
  const s = src.trim();
  if (/^(javascript|data|blob|file|vbscript):/i.test(s)) return false;
  if (/^https:\/\//i.test(s)) return true;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return false;
  if (s.startsWith("//")) return false;
  return /^[./]?[\w./@%-]+$/.test(s);
}
function sanitizeRegion(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  if (typeof r.id !== "string" || !r.id) return null;
  if (typeof r.label !== "string") return null;
  const out = { id: r.id, label: r.label };
  if (typeof r.d === "string") {
    if (/[<>]|javascript:|on\w+=/i.test(r.d)) return null;
    out.d = r.d;
  }
  for (const k of ["x", "y", "w", "h"]) {
    if (r[k] != null) {
      const n = Number(r[k]);
      if (!Number.isFinite(n)) return null;
      out[k] = n;
    }
  }
  if (typeof r.body === "string") out.body = r.body;
  if (typeof r.action === "string") out.action = r.action;
  return out;
}
function sanitizeDiagramProps(raw) {
  if (!raw || typeof raw !== "object") return null;
  const p = raw;
  const out = { local: p.local !== false };
  if (typeof p.title === "string") out.title = p.title;
  if (p.src != null) {
    if (!isSafeDiagramSrc(p.src)) return null;
    out.src = String(p.src).trim();
  }
  if (p.selectedId != null) {
    if (typeof p.selectedId !== "string") return null;
    out.selectedId = p.selectedId;
  }
  if (p.regions != null) {
    if (!Array.isArray(p.regions)) return null;
    const regions = p.regions.map(sanitizeRegion).filter((r) => r !== null);
    if (!regions.length && !out.src) return null;
    out.regions = regions;
  } else if (!out.src) {
    return null;
  }
  return out;
}
function sanitizeHotspotProps(raw) {
  if (!raw || typeof raw !== "object") return null;
  const p = raw;
  if (typeof p.id !== "string" || !p.id) return null;
  if (typeof p.label !== "string") return null;
  const out = {
    id: p.id,
    label: p.label,
    local: p.local !== false
  };
  if (typeof p.body === "string") out.body = p.body;
  if (typeof p.visibleWhen === "string") out.visibleWhen = p.visibleWhen;
  if (typeof p.action === "string") out.action = p.action;
  return out;
}
function sanitizePayload(payload) {
  if (!payload?.key) return null;
  const props = { ...payload.props };
  if (payload.type === "form") {
    const fields = sanitizeFormFields(props.fields);
    props.fields = fields;
  }
  if (payload.type === "diagram") {
    const d = sanitizeDiagramProps(props);
    if (!d) return null;
    Object.assign(props, d);
  }
  if (payload.type === "hotspot") {
    const h = sanitizeHotspotProps(props);
    if (!h) return null;
    Object.assign(props, h);
  }
  const fromBind = sanitizeBinds(payload.bind);
  const fromBinds = sanitizeBinds(payload.binds);
  const merged = [...fromBind ?? [], ...fromBinds ?? []];
  const uniq = merged.filter(
    (b, i, arr) => arr.findIndex((x) => x.from === b.from && x.to === b.to) === i
  );
  const bind = uniq.length ? uniq : void 0;
  let children = payload.children;
  if (children?.length) {
    children = children.map(sanitizePayload).filter((c) => c !== null);
  }
  const { bind: _drop, binds: _db, children: _c, props: _p, ...rest } = payload;
  return {
    ...rest,
    props,
    ...bind ? { bind: bind.length === 1 ? bind[0] : bind } : {},
    ...children ? { children } : {}
  };
}

// src/host/ready.ts
function propsOf(p) {
  return p.props ?? {};
}
function nonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}
function isPayloadReady(payload, type) {
  if (!payload?.key || typeof payload.key !== "string") return false;
  const props = propsOf(payload);
  switch (type) {
    case "row":
    case "col":
      return true;
    case "text":
      return nonEmptyString(props.content) || nonEmptyString(props.text) || nonEmptyString(props.value);
    case "button":
      return nonEmptyString(props.label);
    case "chart": {
      const series = props.series;
      return Array.isArray(series) && series.length > 0;
    }
    case "form": {
      const fields = props.fields;
      if (!Array.isArray(fields) || fields.length === 0) return false;
      return fields.every((f) => {
        if (!f || typeof f !== "object") return false;
        return !!fieldKey(f);
      });
    }
    case "checklist": {
      const items = props.items;
      if (!Array.isArray(items) || items.length === 0) return false;
      return items.every(
        (it) => it && typeof it === "object" && typeof it.id === "string" && typeof it.label === "string"
      );
    }
    case "stat": {
      if (Array.isArray(props.items) && props.items.length > 0) {
        return props.items.every(
          (it) => it && typeof it === "object" && nonEmptyString(it.label) && it.value !== void 0 && it.value !== null
        );
      }
      return nonEmptyString(props.label) && props.value !== void 0 && props.value !== null;
    }
    case "table":
      return Array.isArray(props.columns) && Array.isArray(props.rows);
    case "diagram": {
      if (props.src != null) return isSafeDiagramSrc(props.src);
      const regions = props.regions;
      if (!Array.isArray(regions) || regions.length === 0) return false;
      return regions.every(
        (r) => r && typeof r === "object" && typeof r.id === "string" && typeof r.label === "string"
      );
    }
    case "hotspot":
      return nonEmptyString(props.id) && nonEmptyString(props.label);
    default:
      return false;
  }
}

// src/host/compile.ts
function emptyCompileState() {
  return { keys: /* @__PURE__ */ new Set(), propsByKey: /* @__PURE__ */ new Map() };
}
function asCompileState(prev) {
  if (prev instanceof Set) {
    return { keys: new Set(prev), propsByKey: /* @__PURE__ */ new Map() };
  }
  return {
    keys: new Set(prev.keys),
    propsByKey: new Map(prev.propsByKey)
  };
}
var RENDERABLE = /* @__PURE__ */ new Set([
  "chart",
  "form",
  "button",
  "row",
  "col",
  "text",
  "checklist",
  "stat",
  "table",
  "diagram",
  "hotspot"
]);
function whitelistType(type) {
  if (type === "pending") return "none";
  if (RENDERABLE.has(type) || type === "none") return type;
  return "none";
}
function hasConcreteType(type) {
  return !!type && RENDERABLE.has(type) && type !== "pending";
}
async function resolveType(payload, opts) {
  if (isLayoutType(payload.type)) return payload.type;
  if (hasConcreteType(payload.type)) return payload.type;
  if (!opts.jevEnabled) return "none";
  const threshold = opts.confidenceThreshold ?? 0.7;
  const decided = await decideType(payload, opts);
  if (decided.source === "layout-passthrough" && isLayoutType(payload.type) && payload.type) {
    return payload.type;
  }
  if (decided.confidence >= threshold && decided.choice !== "none") {
    return decided.choice;
  }
  if (decided.choice === "none" && decided.confidence >= threshold) return "none";
  const fb = opts.mainModelFallback ? await opts.mainModelFallback(payload) : null;
  if (fb && RENDERABLE.has(fb)) return fb;
  return "text";
}
function snapshotProps(props) {
  try {
    return JSON.stringify(props);
  } catch {
    return "";
  }
}
function propsDelta(prevJson, next) {
  if (!prevJson) return next;
  let prev = {};
  try {
    prev = JSON.parse(prevJson);
  } catch {
    return next;
  }
  const n = next;
  const delta = {};
  let changed = false;
  for (const k of Object.keys(n)) {
    if (JSON.stringify(prev[k]) !== JSON.stringify(n[k])) {
      delta[k] = n[k];
      changed = true;
    }
  }
  return changed ? delta : null;
}
async function resolveNode(payload, opts) {
  const clean = sanitizePayload(payload);
  if (!clean) return null;
  const type = whitelistType(await resolveType(clean, opts));
  if (type === "none") return null;
  if (!isPayloadReady(clean, type)) return null;
  let children;
  if (clean.children?.length) {
    const resolved = await Promise.all(clean.children.map((c) => resolveNode(c, opts)));
    children = resolved.filter((n) => n !== null);
  }
  const binds = [
    ...clean.bind ? Array.isArray(clean.bind) ? clean.bind : [clean.bind] : [],
    ...clean.binds ?? []
  ];
  return {
    key: clean.key,
    type,
    props: clean.props,
    children,
    ...binds.length === 1 ? { bind: binds[0] } : binds.length ? { bind: binds } : {},
    ...typeof clean.visibleWhen === "string" && clean.visibleWhen ? { visibleWhen: clean.visibleWhen } : {}
  };
}
function trackTree(node, nextKeys, nextProps) {
  nextKeys.add(node.key);
  nextProps.set(node.key, snapshotProps(node.props));
  node.children?.forEach((c) => trackTree(c, nextKeys, nextProps));
}
function collectOpsForTree(node, state, ops, nextKeys, nextProps) {
  if (!state.keys.has(node.key)) {
    ops.push({ op: "upsert", node });
    trackTree(node, nextKeys, nextProps);
    return;
  }
  nextKeys.add(node.key);
  const snap = snapshotProps(node.props);
  nextProps.set(node.key, snap);
  const delta = propsDelta(state.propsByKey.get(node.key), node.props);
  if (delta) ops.push({ op: "patchProps", key: node.key, props: delta });
  for (const child of node.children ?? []) {
    collectOpsForTree(child, state, ops, nextKeys, nextProps);
  }
}
async function compilePayloadsToOps(payloads, prevKeys = /* @__PURE__ */ new Set(), opts = {}) {
  const state = asCompileState(prevKeys);
  const ops = [];
  const nextKeys = /* @__PURE__ */ new Set();
  const nextProps = /* @__PURE__ */ new Map();
  const nodes = (await Promise.all(payloads.map((p) => resolveNode(p, opts)))).filter((n) => n !== null);
  for (const node of nodes) {
    collectOpsForTree(node, state, ops, nextKeys, nextProps);
  }
  for (const k of state.keys) {
    if (!nextKeys.has(k)) ops.push({ op: "remove", key: k });
  }
  const newState = { keys: nextKeys, propsByKey: nextProps };
  return { ops, keys: nextKeys, propsByKey: nextProps, state: newState };
}
async function compileStreamBuffer(buffer, prevKeys, opts, parsePayloads) {
  const payloads = parsePayloads(buffer);
  return compilePayloadsToOps(payloads, prevKeys, opts);
}

// src/host/sessionWriteback.ts
function formatStateForContext(sessionId, state) {
  const lines = [`[dsh-iui session-state session="${sessionId}"]`];
  for (const [key, slice] of Object.entries(state)) {
    lines.push(`- ${key}: ${JSON.stringify(slice)}`);
  }
  lines.push("[/dsh-iui session-state]");
  return lines.join("\n");
}
function formatActionForContext(event) {
  return [
    "[dsh-iui action]",
    JSON.stringify({ key: event.key, action: event.action, payload: event.payload ?? {} }),
    "[/dsh-iui action]"
  ].join("\n");
}
function sliceFromAction(event) {
  const payload = event.payload ?? {};
  const slice = { selected: event.action };
  const values = payload.values && typeof payload.values === "object" ? payload.values : payload.formValues && typeof payload.formValues === "object" ? payload.formValues : void 0;
  if (values) slice.formValues = { ...values };
  for (const [k, v] of Object.entries(payload)) {
    if (k === "values" || k === "formValues") continue;
    if (v === void 0) continue;
    slice[k] = v;
  }
  return slice;
}
async function handleAction(sessionId, event, sink) {
  if (event.type !== "action") return;
  sink.upsertState?.(sessionId, event.key, sliceFromAction(event));
  await sink.issueActionTurn(sessionId, event);
}

// src/host/bridge.ts
function createHostBridge(sessionId) {
  const opsHandlers = /* @__PURE__ */ new Set();
  const actionHandlers = /* @__PURE__ */ new Set();
  return {
    sessionId,
    onOps(handler) {
      opsHandlers.add(handler);
      return () => {
        opsHandlers.delete(handler);
      };
    },
    emitAction(ev) {
      for (const h of actionHandlers) h(ev);
    },
    pushOps(ops) {
      for (const h of opsHandlers) h(ops);
    },
    onAction(handler) {
      actionHandlers.add(handler);
      return () => {
        actionHandlers.delete(handler);
      };
    }
  };
}

// src/host/skill.ts
var DSH_IUI_SKILL_NAME = "dsh-iui";
var DSH_IUI_SKILL_DESCRIPTION = "Emit declarative Interactive UI (layout; checklist/stat/table/slider/diagram; when-to-emit).";
var DSH_IUI_SKILL_BODY = '# dsh-iui\n\nWhen the user would benefit from interactive UI in the reply, emit a fenced block.\n**You own the layout. Host may mount ready nodes early (upsert) and patchProps later; keep stable `key`s so local state survives. and component types.** Every block must set a concrete whitelist\n`type` yourself \u2014 do **not** leave `type` omitted or `"pending"`.\n\nAllowed `type` values: `chart` | `form` | `button` | `text` | `row` | `col` | `checklist` | `stat` | `table` | `diagram` | `hotspot`.\n\nUse `row` / `col` with `children` to compose multi-block layouts (side-by-side, nested).\n\n## When to emit UI (decision table)\n\n| Situation | Emit UI? | Preferred types |\n| --- | --- | --- |\n| Multi-step recipe / procedure the user will tick off | Yes | `checklist` (+ optional `text`) |\n| Dashboard / KPI / comparison numbers | Yes | `stat`, optionally `table` or `chart` |\n| Tabular facts (schedules, rankings, AA split) | Yes | `table` |\n| Collect structured input or one clear CTA | Yes | `form` / `button` |\n| Interactive calculator (guests\u2192portions, savings) | Yes | `form` with `slider` + sibling `bind` |\n| Annotated diagram / part explainer (bike systems) | Yes | `diagram` + `hotspot` / linked `text` |\n| Numeric trend over categories or time | Yes | `chart` |\n| Pure Q&A, definition, one-sentence thanks/ack | **No** | markdown only |\n| User only asked for prose explanation | **No** | markdown only |\n| Ambiguous one-liner with no structure to interact with | **No** | markdown only |\n\n### Negative examples (do **not** wrap in `dsh-iui`)\n\n- "\u8C22\u8C22" / "\u597D\u7684\uFF0C\u6536\u5230" / "\u660E\u767D\u4E86"\n- "\u4EC0\u4E48\u662F HTTP\uFF1F" with a short paragraph answer\n- A single clarifying question back to the user with no controls\n\n## Fence (layout + chart/form)\n\n```dsh-iui\n{\n  "blocks": [\n    {\n      "key": "layout-1",\n      "type": "row",\n      "props": { "gap": 12 },\n      "children": [\n        {\n          "key": "sales",\n          "type": "chart",\n          "props": {\n            "title": "\u8FD1\u56DB\u5468\u9500\u91CF",\n            "series": [{ "name": "\u9500\u91CF", "points": [{ "x": "W1", "y": 12 }, { "x": "W2", "y": 18 }] }]\n          }\n        },\n        {\n          "key": "prefs",\n          "type": "form",\n          "props": {\n            "fields": [\n              { "name": "city", "label": "\u57CE\u5E02", "kind": "text" },\n              { "name": "plan", "label": "\u65B9\u6848", "kind": "select", "options": ["\u57FA\u7840", "\u8FDB\u9636"] }\n            ],\n            "submitAction": "save_prefs"\n          }\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Fence (roast-style checklist)\n\n```dsh-iui\n{\n  "blocks": [\n    {\n      "key": "roast-steps",\n      "type": "checklist",\n      "props": {\n        "title": "Sunday roast",\n        "local": true,\n        "items": [\n          { "id": "prep", "label": "Preheat oven to 200\xB0C", "done": false },\n          { "id": "veg", "label": "Prep vegetables", "done": false },\n          { "id": "rest", "label": "Rest meat 15 min", "done": false }\n        ]\n      }\n    }\n  ]\n}\n```\n\nChecklist toggles are **local by default** (`local: true`): they persist session state and do **not** call the model unless an item sets `action`.\n\n## Fence (monitor card: stat + table)\n\n```dsh-iui\n{\n  "blocks": [\n    {\n      "key": "monitor",\n      "type": "col",\n      "props": { "gap": 12 },\n      "children": [\n        {\n          "key": "kpis",\n          "type": "stat",\n          "props": {\n            "items": [\n              { "label": "Requests", "value": "12.4k", "delta": "+8%" },\n              { "label": "Error rate", "value": "0.2%", "delta": "-0.1%" }\n            ]\n          }\n        },\n        {\n          "key": "top",\n          "type": "table",\n          "props": {\n            "title": "Top routes",\n            "columns": ["Route", "p95", "Errors"],\n            "rows": [["/api/chat", "120ms", 2], ["/api/ops", "80ms", 0]]\n          }\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Fence (slider + local bind: guests \u2192 portions)\n\nSlider changes are **local by default** \u2014 they write `formValues` and apply linear `bind` to sibling props. They do **not** call the model unless a field sets `action`.\n\n```dsh-iui\n{\n  "blocks": [\n    {\n      "key": "party",\n      "type": "col",\n      "props": { "gap": 12 },\n      "children": [\n        {\n          "key": "guests-form",\n          "type": "form",\n          "props": {\n            "local": true,\n            "fields": [\n              {\n                "id": "guests",\n                "type": "slider",\n                "label": "\u7528\u9910\u4EBA\u6570",\n                "min": 1,\n                "max": 12,\n                "step": 1,\n                "value": 4,\n                "local": true\n              }\n            ]\n          }\n        },\n        {\n          "key": "portions",\n          "type": "stat",\n          "props": { "label": "\u5EFA\u8BAE\u4EFD\u91CF", "value": 8 },\n          "bind": { "from": "guests", "to": "value", "scale": 2, "offset": 0 }\n        }\n      ]\n    }\n  ]\n}\n```\n\n`bind` only allows safe linear forms: `scale * $from + offset` (or `expr` like `"2 * $from + 0"`). No arbitrary JS.\n\n## Fence (slider: principal \u2192 interest)\n\n```dsh-iui\n{\n  "blocks": [\n    {\n      "key": "savings",\n      "type": "col",\n      "props": { "gap": 12 },\n      "children": [\n        {\n          "key": "savings-form",\n          "type": "form",\n          "props": {\n            "local": true,\n            "fields": [\n              {\n                "id": "principal",\n                "type": "slider",\n                "label": "\u672C\u91D1",\n                "min": 1000,\n                "max": 50000,\n                "step": 500,\n                "value": 10000,\n                "local": true\n              },\n              {\n                "id": "months",\n                "type": "slider",\n                "label": "\u6708\u6570",\n                "min": 1,\n                "max": 36,\n                "step": 1,\n                "value": 12,\n                "local": true\n              }\n            ]\n          }\n        },\n        {\n          "key": "interest",\n          "type": "stat",\n          "props": { "label": "\u9884\u4F30\u6536\u76CA", "value": 300 },\n          "bind": { "from": "principal", "to": "value", "expr": "0.03 * $from + 0" }\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Fence (diagram + hotspots: five bike systems)\n\nClicks are **local by default** (`local: true`): they write `diagramSelected` and switch highlight/copy \u2014 they do **not** call the model unless a region/hotspot sets `action`.\n\n`src` must be `https:` or a same-repo relative path. Prefer `regions` rectangles/paths when no image.\n\n```dsh-iui\n{\n  "blocks": [\n    {\n      "key": "bike",\n      "type": "row",\n      "props": { "gap": 16 },\n      "children": [\n        {\n          "key": "bike-diagram",\n          "type": "diagram",\n          "props": {\n            "title": "\u81EA\u884C\u8F66\u4E94\u7CFB\u7EDF",\n            "local": true,\n            "selectedId": "drivetrain",\n            "regions": [\n              { "id": "drivetrain", "label": "\u4F20\u52A8", "x": 40, "y": 60, "w": 80, "h": 50, "body": "\u94FE\u6761\u3001\u9F7F\u76D8\u4E0E\u98DE\u8F6E\u4F20\u9012\u52A8\u529B\u3002" },\n              { "id": "brakes", "label": "\u5239\u8F66", "x": 20, "y": 30, "w": 50, "h": 40, "body": "\u5939\u5668\u4E0E\u5239\u8F66\u7EBF\u8D1F\u8D23\u51CF\u901F\u5236\u52A8\u3002" },\n              { "id": "wheels", "label": "\u8F66\u8F6E", "x": 10, "y": 90, "w": 60, "h": 60, "body": "\u8F6E\u5708\u3001\u8F90\u6761\u4E0E\u8F6E\u80CE\u652F\u6491\u6EDA\u52A8\u3002" },\n              { "id": "steering", "label": "\u8F6C\u5411", "x": 70, "y": 10, "w": 50, "h": 40, "body": "\u8F66\u628A\u4E0E\u524D\u53C9\u63A7\u5236\u65B9\u5411\u3002" },\n              { "id": "frame", "label": "\u8F66\u67B6", "x": 50, "y": 50, "w": 70, "h": 45, "body": "\u4E3B\u7BA1\u8FDE\u63A5\u5404\u7CFB\u7EDF\u7684\u7ED3\u6784\u9AA8\u67B6\u3002" }\n            ]\n          }\n        },\n        {\n          "key": "bike-explain",\n          "type": "col",\n          "props": { "gap": 8 },\n          "children": [\n            { "key": "hs-drivetrain", "type": "hotspot", "props": { "id": "drivetrain", "label": "\u4F20\u52A8\u7CFB\u7EDF", "body": "\u94FE\u6761\u3001\u9F7F\u76D8\u4E0E\u98DE\u8F6E\u4F20\u9012\u52A8\u529B\u3002", "visibleWhen": "drivetrain", "local": true } },\n            { "key": "hs-brakes", "type": "hotspot", "props": { "id": "brakes", "label": "\u5239\u8F66\u7CFB\u7EDF", "body": "\u5939\u5668\u4E0E\u5239\u8F66\u7EBF\u8D1F\u8D23\u51CF\u901F\u5236\u52A8\u3002", "visibleWhen": "brakes", "local": true } },\n            { "key": "hs-wheels", "type": "hotspot", "props": { "id": "wheels", "label": "\u8F66\u8F6E\u7CFB\u7EDF", "body": "\u8F6E\u5708\u3001\u8F90\u6761\u4E0E\u8F6E\u80CE\u652F\u6491\u6EDA\u52A8\u3002", "visibleWhen": "wheels", "local": true } },\n            { "key": "hs-steering", "type": "hotspot", "props": { "id": "steering", "label": "\u8F6C\u5411\u7CFB\u7EDF", "body": "\u8F66\u628A\u4E0E\u524D\u53C9\u63A7\u5236\u65B9\u5411\u3002", "visibleWhen": "steering", "local": true } },\n            { "key": "hs-frame", "type": "hotspot", "props": { "id": "frame", "label": "\u8F66\u67B6\u7CFB\u7EDF", "body": "\u4E3B\u7BA1\u8FDE\u63A5\u5404\u7CFB\u7EDF\u7684\u7ED3\u6784\u9AA8\u67B6\u3002", "visibleWhen": "frame", "local": true } }\n          ]\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Props (minimal)\n\n- chart: `{ "title?", "series": [{ "name?", "points": [{ "x", "y" }] }] }`\n- form: `{ "local?", "fields": [{ "name|id", "label?", "kind|type?" (`text`/`number`/`select`/`slider`), "min?", "max?", "step?", "value?", "local?", "options?" }], "values?", "submitAction?", "submitLabel?" }`\n- bind (on any sibling node): `{ "from", "to", "scale?", "offset?" }` or `{ "from", "to", "expr": "a * $from + b" }` \u2014 local only\n- button: `{ "label", "action", "payload?" }`\n- text: `{ "content" }`\n- row / col: `{ "gap?" }` plus `children`\n- checklist: `{ "title?", "local?", "items": [{ "id", "label", "done?", "action?" }] }`\n- stat: `{ "items": [{ "label", "value", "delta?" }] }` or single `{ "label", "value", "delta?" }`\n- table: `{ "title?", "columns": string[], "rows": (string|number)[][] }`\n- diagram: `{ "title?", "src?", "local?", "selectedId?", "regions": [{ "id", "label", "d?", "x?", "y?", "w?", "h?", "body?" }] }` \u2014 `src` only `https:` or relative\n- hotspot: `{ "id", "label", "body?", "visibleWhen?", "local?" }`\n\n## Rules\n\n1. Every block (including children) must include a concrete whitelist `type` and stable `key`.\n2. Prefer nesting under `row`/`col` when showing multiple blocks together.\n3. Never emit arbitrary HTML or scripts.\n4. Markdown prose stays outside the fence; UI blocks go inside.\n5. After the user clicks/submits (non-local), you will receive a `[dsh-iui action]` block \u2014 continue from it.\n6. Read `[dsh-iui session-state]` when present to reuse prior form values / checklist / selections.\n7. Slider / checklist local controls must not set `action` unless you truly need a model turn.';
function renderSkillContent() {
  return `<skill_content name="${DSH_IUI_SKILL_NAME}">
${DSH_IUI_SKILL_BODY}
</skill_content>`;
}

// src/host/events.ts
var DSH_IUI_OPS_EVENT = "dsh-iui/ops";
var DSH_IUI_ACTION_EVENT = "dsh-iui/action";

// src/host/text.ts
function textFromContent(content) {
  if (!Array.isArray(content)) return typeof content === "string" ? content : "";
  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block;
    if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
  }
  return parts.join("\n");
}

// src/host/userMessage.ts
function buildUserMessage(text, sourceKind) {
  return {
    id: `dsh-iui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: "user",
    source: { kind: sourceKind },
    content: [{ type: "text", text }]
  };
}

// src/host/plugin.ts
var name = "dsh-iui-host";
function apply(ctx, options = {}) {
  const c = ctx;
  const sessionId = options.getSessionId?.() ?? "default";
  const bridge = createHostBridge(sessionId);
  let compileState = emptyCompileState();
  const hostState = {};
  const seenMessages = /* @__PURE__ */ new Set();
  const publishOps = async (session, text, meta = {}) => {
    const payloads = parseProgressivePayloads(text);
    if (!payloads.length) return;
    const { ops, state } = await compilePayloadsToOps(payloads, compileState, {
      confidenceThreshold: options.confidenceThreshold ?? 0.7,
      jevEnabled: options.jevEnabled === true,
      intentSummary: ""
    });
    compileState = state;
    if (!ops.length) return;
    bridge.pushOps(ops);
    const sid = String(session?.id ?? bridge.sessionId);
    const data = {
      sessionKey: sid,
      turn: meta.turn,
      step: meta.step,
      ops,
      sourceMessageId: meta.sourceMessageId
    };
    c.emit?.("dsh-iui.ops", data);
    try {
      session?.append(DSH_IUI_OPS_EVENT, data);
    } catch (err) {
      console.info("[dsh-iui-host] session.append dsh-iui/ops failed", err);
    }
  };
  const api = {
    bridge,
    onAssistantDelta: async (text) => {
      await publishOps(null, text);
    },
    getStateContext: () => formatStateForContext(bridge.sessionId, hostState)
  };
  c.provide("dshIui", api);
  try {
    c.skills?.register?.({
      name: DSH_IUI_SKILL_NAME,
      description: DSH_IUI_SKILL_DESCRIPTION,
      body: DSH_IUI_SKILL_BODY,
      content: DSH_IUI_SKILL_BODY
    });
  } catch {
    console.info("[dsh-iui-host] skills.register unavailable; skill exported for manual mount");
  }
  c.on?.(
    "session/event",
    (session, event) => {
      const s = session;
      const ev = event;
      if (ev?.type !== "assistant/message") return;
      const msg = ev.data?.message;
      const mid = msg?.id;
      if (mid && seenMessages.has(mid)) return;
      if (mid) seenMessages.add(mid);
      const text = textFromContent(msg?.content);
      if (!text.includes("```dsh-iui")) return;
      void publishOps(s, text, {
        turn: ev.data?.turn,
        step: ev.data?.step,
        sourceMessageId: mid
      });
    },
    { global: true }
  );
  const findRootAgent = (session) => {
    const roots = c.agents?.roots?.() ?? [];
    if (!session) return roots[0];
    return roots.find((a) => a.session === session || String(a.session?.id) === String(session.id));
  };
  bridge.onAction(async (ev) => {
    await handleAction(bridge.sessionId, ev, {
      issueActionTurn: async (sid, event) => {
        const msgText = formatActionForContext(event);
        c.emit?.("dsh-iui.action", { sessionId: sid, event, message: msgText });
        try {
          const agent = findRootAgent(null);
          const session = agent?.session;
          session?.append(DSH_IUI_ACTION_EVENT, {
            sessionKey: sid,
            key: event.key,
            action: event.action,
            payload: event.payload
          });
          const userMsg = buildUserMessage(msgText, "dsh-iui-action");
          if (agent?.followup) agent.followup(userMsg);
          else agent?.steer(userMsg);
        } catch (err) {
          console.info("[dsh-iui-host] action writeback failed", err);
        }
      },
      upsertState: (sid, blockKey, slice) => {
        hostState[blockKey] = { ...hostState[blockKey], ...slice };
        const ctxText = formatStateForContext(sid, hostState);
        c.emit?.("dsh-iui.state", { sessionId: sid, state: hostState, context: ctxText });
        try {
          const agent = findRootAgent(null);
          agent?.inject(
            buildUserMessage(ctxText, "dsh-iui-state")
          );
        } catch (err) {
          console.info("[dsh-iui-host] state inject failed", err);
        }
      }
    });
  });
  c.on?.(
    "session/event",
    (_session, event) => {
      const ev = event;
      if (ev?.type !== DSH_IUI_ACTION_EVENT) return;
      if (!ev.data?.key || !ev.data?.action) return;
      const actionEv = {
        type: "action",
        key: ev.data.key,
        action: ev.data.action,
        payload: ev.data.payload
      };
      void handleAction(ev.data.sessionKey ?? bridge.sessionId, actionEv, {
        issueActionTurn: async (_sid, event2) => {
          const msgText = formatActionForContext(event2);
          c.emit?.("dsh-iui.action", { sessionId: _sid, event: event2, message: msgText });
          try {
            const agent = findRootAgent(null);
            const userMsg = buildUserMessage(msgText, "dsh-iui-action");
            if (agent?.followup) agent.followup(userMsg);
            else agent?.steer(userMsg);
          } catch (err) {
            console.info("[dsh-iui-host] wire action writeback failed", err);
          }
        },
        upsertState: (sid, blockKey, slice) => {
          hostState[blockKey] = { ...hostState[blockKey], ...slice };
          const ctxText = formatStateForContext(sid, hostState);
          c.emit?.("dsh-iui.state", { sessionId: sid, state: hostState, context: ctxText });
          try {
            const agent = findRootAgent(null);
            agent?.inject(buildUserMessage(ctxText, "dsh-iui-state"));
          } catch (err) {
            console.info("[dsh-iui-host] wire state inject failed", err);
          }
        }
      });
    },
    { global: true }
  );
  console.info("[dsh-iui-host] loaded (provide dshIui + session ops + action steer)");
}
export {
  DSH_IUI_ACTION_EVENT,
  DSH_IUI_OPS_EVENT,
  DSH_IUI_SKILL_BODY,
  DSH_IUI_SKILL_DESCRIPTION,
  DSH_IUI_SKILL_NAME,
  apply,
  apply as applyHost,
  compilePayloadsToOps,
  compileStreamBuffer,
  createHostBridge,
  decideType,
  emptyCompileState,
  evalLinearBind,
  extractCompleteFences,
  extractCompleteJsonObjects,
  extractOpenFenceBody,
  fieldKey,
  fieldKind,
  formatActionForContext,
  formatStateForContext,
  handleAction,
  heuristicPick,
  name as hostPluginName,
  isLayoutType,
  isPayloadReady,
  isSafeDiagramSrc,
  name,
  parseLinearBind,
  parsePayloadRoots,
  parseProgressivePayloads,
  parseStreamingPayloads,
  renderSkillContent,
  sanitizeBind,
  sanitizeBinds,
  sanitizeDiagramProps,
  sanitizeFormFields,
  sanitizeHotspotProps,
  sanitizePayload,
  sanitizeRegion,
  sanitizeSliderField,
  sliceFromAction,
  textFromContent
};
