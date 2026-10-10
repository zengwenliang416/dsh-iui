/** Embedded skill body: teach the main model to emit dsh-iui payload fences. */
export const DSH_IUI_SKILL_NAME = 'dsh-iui';
export const DSH_IUI_SKILL_DESCRIPTION = 'Emit declarative Interactive UI payloads in DSH replies (charts, forms, buttons).';
export const DSH_IUI_SKILL_BODY = `
# dsh-iui

When the user would benefit from an interactive chart, form, or button in the reply,
emit a fenced block. Do **not** pick the final component \`type\` for data blocks —
leave it omitted or \`"pending"\`. Layout blocks \`row\` / \`col\` may set \`type\` yourself.

## Fence

\`\`\`dsh-iui
{
  "blocks": [
    {
      "key": "stable-id-1",
      "type": "pending",
      "props": { }
    }
  ]
}
\`\`\`

## Props (minimal)

- chart: \`{ "title?", "series": [{ "name?", "points": [{ "x", "y" }] }] }\`
- form: \`{ "fields": [{ "name", "label?", "kind?", "options?" }], "values?", "submitAction?", "submitLabel?" }\`
- button: \`{ "label", "action", "payload?" }\`
- text: \`{ "content" }\`
- row / col: \`{ "gap?" }\` plus \`children\`

## Rules

1. \`key\` must be stable across stream chunks for the same block.
2. Never emit arbitrary HTML or scripts.
3. Markdown prose stays outside the fence; UI blocks go inside.
4. After the user clicks/submits, you will receive a \`[dsh-iui action]\` block — continue the conversation from it.
5. Read \`[dsh-iui session-state]\` when present to reuse prior form values / selections.
`.trim();
export function renderSkillContent() {
    return `<skill_content name="${DSH_IUI_SKILL_NAME}">\n${DSH_IUI_SKILL_BODY}\n</skill_content>`;
}
