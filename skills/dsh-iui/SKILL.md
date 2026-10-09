---
name: dsh-iui
description: Emit declarative Interactive UI (type+layout; checklist/stat/table; when-to-emit).
---

# dsh-iui

When the user would benefit from interactive UI in the reply, emit a fenced block.
**You own the layout and component types.** Every block must set a concrete whitelist
`type` yourself — do **not** leave `type` omitted or `"pending"`.

Allowed `type` values: `chart` | `form` | `button` | `text` | `row` | `col` | `checklist` | `stat` | `table`.

Use `row` / `col` with `children` to compose multi-block layouts (side-by-side, nested).

## When to emit UI (decision table)

| Situation | Emit UI? | Preferred types |
| --- | --- | --- |
| Multi-step recipe / procedure the user will tick off | Yes | `checklist` (+ optional `text`) |
| Dashboard / KPI / comparison numbers | Yes | `stat`, optionally `table` or `chart` |
| Tabular facts (schedules, rankings, AA split) | Yes | `table` |
| Collect structured input or one clear CTA | Yes | `form` / `button` |
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

## Props (minimal)

- chart: `{ "title?", "series": [{ "name?", "points": [{ "x", "y" }] }] }`
- form: `{ "fields": [{ "name", "label?", "kind?", "options?" }], "values?", "submitAction?", "submitLabel?" }`
- button: `{ "label", "action", "payload?" }`
- text: `{ "content" }`
- row / col: `{ "gap?" }` plus `children`
- checklist: `{ "title?", "local?", "items": [{ "id", "label", "done?", "action?" }] }`
- stat: `{ "items": [{ "label", "value", "delta?" }] }` or single `{ "label", "value", "delta?" }`
- table: `{ "title?", "columns": string[], "rows": (string|number)[][] }`

## Rules

1. Every block (including children) must include a concrete whitelist `type` and stable `key`.
2. Prefer nesting under `row`/`col` when showing multiple blocks together.
3. Never emit arbitrary HTML or scripts.
4. Markdown prose stays outside the fence; UI blocks go inside.
5. After the user clicks/submits (non-local), you will receive a `[dsh-iui action]` block — continue from it.
6. Read `[dsh-iui session-state]` when present to reuse prior form values / checklist / selections.
