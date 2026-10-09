/** Embedded skill body: teach the main model to emit full dsh-iui IR (type + layout). */
export const DSH_IUI_SKILL_NAME = 'dsh-iui'

export const DSH_IUI_SKILL_DESCRIPTION =
  'Emit declarative Interactive UI with full type + nested layout in DSH replies.'

export const DSH_IUI_SKILL_BODY = `
# dsh-iui

When the user would benefit from interactive UI in the reply, emit a fenced block.
**You own the layout and component types.** Every block must set a concrete whitelist
\`type\` yourself — do **not** leave \`type\` omitted or \`"pending"\`.

Allowed \`type\` values: \`chart\` | \`form\` | \`button\` | \`text\` | \`row\` | \`col\`.

Use \`row\` / \`col\` with \`children\` to compose multi-block layouts (side-by-side, nested).

## Fence

\`\`\`dsh-iui
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
    },
    {
      "key": "go",
      "type": "button",
      "props": { "label": "继续", "action": "continue" }
    }
  ]
}
\`\`\`

## Props (minimal)

- chart: \`{ "title?", "series": [{ "name?", "points": [{ "x", "y" }] }] }\`
- form: \`{ "fields": [{ "name", "label?", "kind?", "options?" }], "values?", "submitAction?", "submitLabel?" }\`
- button: \`{ "label", "action", "payload?" }\`
- text: \`{ "content" }\`
- row / col: \`{ "gap?" }\` plus \`children\` (nested payloads, each with its own \`type\`)

## Rules

1. Every block (including children) must include a concrete whitelist \`type\` and stable \`key\`.
2. Prefer nesting under \`row\`/\`col\` when showing chart + form/button together.
3. Never emit arbitrary HTML or scripts.
4. Markdown prose stays outside the fence; UI blocks go inside.
5. After the user clicks/submits, you will receive a \`[dsh-iui action]\` block — continue the conversation from it.
6. Read \`[dsh-iui session-state]\` when present to reuse prior form values / selections.
`.trim()

export function renderSkillContent(): string {
  return `<skill_content name="${DSH_IUI_SKILL_NAME}">\n${DSH_IUI_SKILL_BODY}\n</skill_content>`
}
