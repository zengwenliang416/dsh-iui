---
name: dsh-iui
description: Emit declarative Interactive UI (layout; checklist/stat/table/slider/diagram; when-to-emit).
---

# dsh-iui

When the user would benefit from interactive UI in the reply, emit a fenced block.
**You own the layout. Host may mount ready nodes early (upsert) and patchProps later; keep stable `key`s so local state survives. and component types.** Every block must set a concrete whitelist
`type` yourself — do **not** leave `type` omitted or `"pending"`.

Allowed `type` values: `chart` | `form` | `button` | `text` | `row` | `col` | `checklist` | `stat` | `table` | `diagram` | `hotspot`.

Use `row` / `col` with `children` to compose multi-block layouts (side-by-side, nested).

## When to emit UI (decision table)

| Situation | Emit UI? | Preferred types |
| --- | --- | --- |
| Multi-step recipe / procedure the user will tick off | Yes | `checklist` (+ optional `text`) |
| Dashboard / KPI / comparison numbers | Yes | `stat`, optionally `table` or `chart` |
| Tabular facts (schedules, rankings, AA split) | Yes | `table` |
| Collect structured input or one clear CTA | Yes | `form` / `button` |
| Interactive calculator (guests→portions, savings) | Yes | `form` with `slider` + sibling `bind` |
| Annotated diagram / part explainer (bike systems) | Yes | `diagram` + `hotspot` / linked `text` |
| Numeric trend over categories or time | Yes | `chart` |
| Pure Q&A, definition, one-sentence thanks/ack | **No** | markdown only |
| User only asked for prose explanation | **No** | markdown only |
| Ambiguous one-liner with no structure to interact with | **No** | markdown only |

### Negative examples (do **not** wrap in `dsh-iui`)

- "谢谢" / "好的，收到" / "明白了"
- "什么是 HTTP？" with a short paragraph answer
- A single clarifying question back to the user with no controls

## Fence (layout + chart/form)

```dsh-iui
{
  "blocks": [
    {
      "key": "layout-1",
      "type": "row",
      "props": { "gap": 12 },
      "children": [
        {
          "key": "sales",
          "type": "chart",
          "props": {
            "title": "近四周销量",
            "series": [{ "name": "销量", "points": [{ "x": "W1", "y": 12 }, { "x": "W2", "y": 18 }] }]
          }
        },
        {
          "key": "prefs",
          "type": "form",
          "props": {
            "fields": [
              { "name": "city", "label": "城市", "kind": "text" },
              { "name": "plan", "label": "方案", "kind": "select", "options": ["基础", "进阶"] }
            ],
            "submitAction": "save_prefs"
          }
        }
      ]
    }
  ]
}
```

## Fence (roast-style checklist)

```dsh-iui
{
  "blocks": [
    {
      "key": "roast-steps",
      "type": "checklist",
      "props": {
        "title": "Sunday roast",
        "local": true,
        "items": [
          { "id": "prep", "label": "Preheat oven to 200°C", "done": false },
          { "id": "veg", "label": "Prep vegetables", "done": false },
          { "id": "rest", "label": "Rest meat 15 min", "done": false }
        ]
      }
    }
  ]
}
```

Checklist toggles are **local by default** (`local: true`): they persist session state and do **not** call the model unless an item sets `action`.

## Fence (monitor card: stat + table)

```dsh-iui
{
  "blocks": [
    {
      "key": "monitor",
      "type": "col",
      "props": { "gap": 12 },
      "children": [
        {
          "key": "kpis",
          "type": "stat",
          "props": {
            "items": [
              { "label": "Requests", "value": "12.4k", "delta": "+8%" },
              { "label": "Error rate", "value": "0.2%", "delta": "-0.1%" }
            ]
          }
        },
        {
          "key": "top",
          "type": "table",
          "props": {
            "title": "Top routes",
            "columns": ["Route", "p95", "Errors"],
            "rows": [["/api/chat", "120ms", 2], ["/api/ops", "80ms", 0]]
          }
        }
      ]
    }
  ]
}
```

## Fence (slider + local bind: guests → portions)

Slider changes are **local by default** — they write `formValues` and apply linear `bind` to sibling props. They do **not** call the model unless a field sets `action`.

```dsh-iui
{
  "blocks": [
    {
      "key": "party",
      "type": "col",
      "props": { "gap": 12 },
      "children": [
        {
          "key": "guests-form",
          "type": "form",
          "props": {
            "local": true,
            "fields": [
              {
                "id": "guests",
                "type": "slider",
                "label": "用餐人数",
                "min": 1,
                "max": 12,
                "step": 1,
                "value": 4,
                "local": true
              }
            ]
          }
        },
        {
          "key": "portions",
          "type": "stat",
          "props": { "label": "建议份量", "value": 8 },
          "bind": { "from": "guests", "to": "value", "scale": 2, "offset": 0 }
        }
      ]
    }
  ]
}
```

`bind` only allows safe linear forms: `scale * $from + offset` (or `expr` like `"2 * $from + 0"`). No arbitrary JS.

## Fence (slider: principal → interest)

```dsh-iui
{
  "blocks": [
    {
      "key": "savings",
      "type": "col",
      "props": { "gap": 12 },
      "children": [
        {
          "key": "savings-form",
          "type": "form",
          "props": {
            "local": true,
            "fields": [
              {
                "id": "principal",
                "type": "slider",
                "label": "本金",
                "min": 1000,
                "max": 50000,
                "step": 500,
                "value": 10000,
                "local": true
              },
              {
                "id": "months",
                "type": "slider",
                "label": "月数",
                "min": 1,
                "max": 36,
                "step": 1,
                "value": 12,
                "local": true
              }
            ]
          }
        },
        {
          "key": "interest",
          "type": "stat",
          "props": { "label": "预估收益", "value": 300 },
          "bind": { "from": "principal", "to": "value", "expr": "0.03 * $from + 0" }
        }
      ]
    }
  ]
}
```

## Fence (diagram + hotspots: five bike systems)

Clicks are **local by default** (`local: true`): they write `diagramSelected` and switch highlight/copy — they do **not** call the model unless a region/hotspot sets `action`.

`src` must be `https:` or a same-repo relative path. Prefer `regions` rectangles/paths when no image.

```dsh-iui
{
  "blocks": [
    {
      "key": "bike",
      "type": "row",
      "props": { "gap": 16 },
      "children": [
        {
          "key": "bike-diagram",
          "type": "diagram",
          "props": {
            "title": "自行车五系统",
            "local": true,
            "selectedId": "drivetrain",
            "regions": [
              { "id": "drivetrain", "label": "传动", "x": 40, "y": 60, "w": 80, "h": 50, "body": "链条、齿盘与飞轮传递动力。" },
              { "id": "brakes", "label": "刹车", "x": 20, "y": 30, "w": 50, "h": 40, "body": "夹器与刹车线负责减速制动。" },
              { "id": "wheels", "label": "车轮", "x": 10, "y": 90, "w": 60, "h": 60, "body": "轮圈、辐条与轮胎支撑滚动。" },
              { "id": "steering", "label": "转向", "x": 70, "y": 10, "w": 50, "h": 40, "body": "车把与前叉控制方向。" },
              { "id": "frame", "label": "车架", "x": 50, "y": 50, "w": 70, "h": 45, "body": "主管连接各系统的结构骨架。" }
            ]
          }
        },
        {
          "key": "bike-explain",
          "type": "col",
          "props": { "gap": 8 },
          "children": [
            { "key": "hs-drivetrain", "type": "hotspot", "props": { "id": "drivetrain", "label": "传动系统", "body": "链条、齿盘与飞轮传递动力。", "visibleWhen": "drivetrain", "local": true } },
            { "key": "hs-brakes", "type": "hotspot", "props": { "id": "brakes", "label": "刹车系统", "body": "夹器与刹车线负责减速制动。", "visibleWhen": "brakes", "local": true } },
            { "key": "hs-wheels", "type": "hotspot", "props": { "id": "wheels", "label": "车轮系统", "body": "轮圈、辐条与轮胎支撑滚动。", "visibleWhen": "wheels", "local": true } },
            { "key": "hs-steering", "type": "hotspot", "props": { "id": "steering", "label": "转向系统", "body": "车把与前叉控制方向。", "visibleWhen": "steering", "local": true } },
            { "key": "hs-frame", "type": "hotspot", "props": { "id": "frame", "label": "车架系统", "body": "主管连接各系统的结构骨架。", "visibleWhen": "frame", "local": true } }
          ]
        }
      ]
    }
  ]
}
```

## Props (minimal)

- chart: `{ "title?", "series": [{ "name?", "points": [{ "x", "y" }] }] }`
- form: `{ "local?", "fields": [{ "name|id", "label?", "kind|type?" (`text`/`number`/`select`/`slider`), "min?", "max?", "step?", "value?", "local?", "options?" }], "values?", "submitAction?", "submitLabel?" }`
- bind (on any sibling node): `{ "from", "to", "scale?", "offset?" }` or `{ "from", "to", "expr": "a * $from + b" }` — local only
- button: `{ "label", "action", "payload?" }`
- text: `{ "content" }`
- row / col: `{ "gap?" }` plus `children`
- checklist: `{ "title?", "local?", "items": [{ "id", "label", "done?", "action?" }] }`
- stat: `{ "items": [{ "label", "value", "delta?" }] }` or single `{ "label", "value", "delta?" }`
- table: `{ "title?", "columns": string[], "rows": (string|number)[][] }`
- diagram: `{ "title?", "src?", "local?", "selectedId?", "regions": [{ "id", "label", "d?", "x?", "y?", "w?", "h?", "body?" }] }` — `src` only `https:` or relative
- hotspot: `{ "id", "label", "body?", "visibleWhen?", "local?" }`

## Rules

1. Every block (including children) must include a concrete whitelist `type` and stable `key`.
2. Prefer nesting under `row`/`col` when showing multiple blocks together.
3. Never emit arbitrary HTML or scripts.
4. Markdown prose stays outside the fence; UI blocks go inside.
5. After the user clicks/submits (non-local), you will receive a `[dsh-iui action]` block — continue from it.
6. Read `[dsh-iui session-state]` when present to reuse prior form values / checklist / selections.
7. Slider / checklist local controls must not set `action` unless you truly need a model turn.
