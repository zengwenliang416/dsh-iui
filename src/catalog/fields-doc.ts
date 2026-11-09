/** Compact field lists generated from the block schemas, so validation and documentation never diverge. */

/** The schema node fields this generator reads. */
interface FieldSchema {
  readonly type?: string
  readonly required?: boolean
  readonly description?: string
  readonly enum?: readonly unknown[]
  readonly items?: FieldSchema
  readonly properties?: Readonly<Record<string, FieldSchema>>
  readonly oneOf?: readonly FieldSchema[]
}

function typeName(schema: FieldSchema): string {
  if (schema.enum !== undefined) return schema.enum.map(value => JSON.stringify(value)).join(' | ')
  if (schema.oneOf !== undefined) return schema.oneOf.map(typeName).join(' | ')
  if (schema.type === 'array') return schema.items?.properties === undefined ? `${typeName(schema.items ?? {})}[]` : 'list of objects'
  return schema.type ?? 'value'
}

function lines(fields: Readonly<Record<string, FieldSchema>>, indent: string): string[] {
  return Object.entries(fields).flatMap(([name, schema]) => {
    const head = `${indent}- ${name} (${typeName(schema)}${schema.required === true ? ', required' : ''})${schema.description === undefined ? '' : `: ${schema.description}`}`
    const nested = schema.properties ?? schema.items?.properties
    return nested === undefined ? [head] : [head, ...lines(nested, `${indent}  `)]
  })
}

/**
 * Render a block type's fields as an indented list.
 * @param fields - The block's field schemas.
 * @returns One line per field, nested fields indented below their parent.
 */
export function describeFields(fields: Readonly<Record<string, FieldSchema>>): string {
  return lines(fields, '').join('\n')
}
