/**
 * Restricted expression language for calculator formulas.
 * Values, operators, callbacks, and explicitly listed pure calls are interpreted
 * as syntax trees. No JavaScript source is executed and no host globals are exposed.
 */

import { assertNever } from './assert.ts'

/** JSON value an expression may read or produce. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

/** Parsed expression. */
export type Expr =
  | { type: 'lit'; value: string | number | boolean | null }
  | { type: 'ident'; name: string }
  | { type: 'member'; object: Expr; property: string }
  | { type: 'index'; object: Expr; index: Expr }
  | { type: 'unary'; op: '!' | '-'; arg: Expr }
  | { type: 'binary'; op: '===' | '!==' | '>' | '<' | '>=' | '<=' | '+' | '-' | '*' | '/' | '%' | '&&' | '||'; left: Expr; right: Expr }
  | { type: 'cond'; test: Expr; yes: Expr; no: Expr }
  | { type: 'array'; items: Expr[] }
  | { type: 'object'; fields: { key: string; value: Expr }[] }
  | { type: 'arrow'; params: string[]; body: Expr }
  | { type: 'call'; callee: Expr; args: Expr[] }

/** Expression syntax or evaluation failure. */
export class ExprError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExprError'
  }
}

/** Exhaustion of the work or node budget shared by one operation; projection never recovers from it. */
export class DilLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DilLimitError'
  }
}

const IDENT = /^[A-Za-z_$][\w$]*/
const FORBIDDEN_PROPERTIES = new Set(['__proto__', 'prototype', 'constructor'])
const RESERVED_NAMES = new Set([
  ...FORBIDDEN_PROPERTIES,
  'DIL', 'Object', 'Math', 'Number', 'String',
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'implements', 'import', 'in', 'instanceof',
  'interface', 'let', 'new', 'null', 'package', 'private', 'protected', 'public',
  'return', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof',
  'var', 'void', 'while', 'with', 'yield', 'eval', 'arguments',
])
const MAX_EXPRESSION_LENGTH = 65_536
const MAX_EXPRESSION_DEPTH = 128
const MAX_EXPRESSION_NODES = 8_192
const MAX_JSON_NODES = 20_000
const MAX_OPERATION_STEPS = 100_000
const MAX_JSON_LENGTH = 1_048_576

/** Shared remaining work for one projection, action, or standalone expression. */
export interface EvaluationBudget {
  remaining: number
}

/**
 * Start one bounded interpreter operation.
 * @returns A budget shared by syntax, evaluation, iteration, and JSON validation.
 */
export function createEvaluationBudget(): EvaluationBudget {
  return { remaining: MAX_OPERATION_STEPS }
}

/**
 * Charge work before performing an interpreter step or collection traversal.
 * @param budget - Shared budget for the enclosing operation.
 * @param steps - Number of operations about to run.
 */
export function consumeEvaluationBudget(budget: EvaluationBudget, steps = 1): void {
  budget.remaining -= steps
  if (budget.remaining < 0) throw new DilLimitError('DIL evaluation limit exceeded')
}

function chargeString(budget: EvaluationBudget, value: string): void {
  consumeEvaluationBudget(budget, Math.ceil(value.length / 64))
}

/**
 * Validate a body, loop, or callback binding name.
 * @param name - Identifier introduced by model-written DIL.
 */
export function assertBindingName(name: string): void {
  if (!/^[A-Za-z_$][\w$]*$/.test(name) || RESERVED_NAMES.has(name)) {
    throw new ExprError(`invalid binding name '${name}'`)
  }
}

/**
 * Reject prototype-related names in model-authored data and component attributes.
 * @param property - Property name read or written by the restricted evaluator.
 */
export function checkProperty(property: string): void {
  if (FORBIDDEN_PROPERTIES.has(property)) throw new ExprError(`forbidden property '${property}'`)
}

function finiteNumber(value: number): number {
  if (!Number.isFinite(value)) throw new ExprError('result must be a finite JSON number')
  return value
}

class Parser {
  private at = 0
  private depth = 0

  constructor(private readonly source: string) {}

  parse(): Expr {
    const expr = this.parseTernary()
    this.skip()
    if (this.at < this.source.length) throw new ExprError(`unexpected '${this.source.slice(this.at, this.at + 12)}'`)
    return expr
  }

  private parseTernary(): Expr {
    this.depth += 1
    if (this.depth > MAX_EXPRESSION_DEPTH) throw new ExprError('expression nesting limit exceeded')
    try {
      return this.parseConditional()
    } finally {
      this.depth -= 1
    }
  }

  private parseConditional(): Expr {
    const test = this.parseOr()
    this.skip()
    if (!this.eat('?')) return test
    const yes = this.parseTernary()
    this.skip()
    if (!this.eat(':')) throw new ExprError('ternary is missing ":"')
    return { type: 'cond', test, yes, no: this.parseTernary() }
  }

  private parseOr(): Expr {
    let left = this.parseAnd()
    while (this.eatOp('||')) left = { type: 'binary', op: '||', left, right: this.parseAnd() }
    return left
  }

  private parseAnd(): Expr {
    let left = this.parseEquality()
    while (this.eatOp('&&')) left = { type: 'binary', op: '&&', left, right: this.parseEquality() }
    return left
  }

  private parseEquality(): Expr {
    let left = this.parseRelation()
    for (;;) {
      // `==` and `!=` are accepted as strict comparisons: values are JSON primitives, so no coercion is needed.
      const op = this.eatOp('===') ?? this.eatOp('!==') ?? (this.eatOp('==') === undefined ? undefined : '===')
        ?? (this.eatOp('!=') === undefined ? undefined : '!==')
      if (op === undefined) return left
      left = { type: 'binary', op, left, right: this.parseRelation() }
    }
  }

  private parseRelation(): Expr {
    let left = this.parseAdd()
    for (;;) {
      const op = this.eatOp('>=') ?? this.eatOp('<=') ?? this.eatOp('>') ?? this.eatOp('<')
      if (op === undefined) return left
      left = { type: 'binary', op, left, right: this.parseAdd() }
    }
  }

  private parseAdd(): Expr {
    let left = this.parseMul()
    for (;;) {
      const op = this.eatOp('+') ?? this.eatOp('-')
      if (op === undefined) return left
      left = { type: 'binary', op, left, right: this.parseMul() }
    }
  }

  private parseMul(): Expr {
    let left = this.parseUnary()
    for (;;) {
      const op = this.eatOp('*') ?? this.eatOp('/') ?? this.eatOp('%')
      if (op === undefined) return left
      left = { type: 'binary', op, left, right: this.parseUnary() }
    }
  }

  private parseUnary(): Expr {
    this.skip()
    this.depth += 1
    if (this.depth > MAX_EXPRESSION_DEPTH) throw new ExprError('expression nesting limit exceeded')
    try {
      if (this.eat('!')) return { type: 'unary', op: '!', arg: this.parseUnary() }
      if (this.eat('-')) return { type: 'unary', op: '-', arg: this.parseUnary() }
      return this.parsePrimary()
    } finally {
      this.depth -= 1
    }
  }

  private parsePrimary(): Expr {
    this.skip()
    const quote = this.source[this.at]
    if (quote === '"' || quote === "'") return this.parsePostfix({ type: 'lit', value: this.readString(quote) })
    if (this.peek('[')) return this.parsePostfix(this.parseArray())
    if (this.peek('{')) return this.parsePostfix(this.parseObject())
    if (this.peek('(')) {
      if (this.looksLikeArrow()) return this.parseArrow()
      this.at += 1
      const inner = this.parseTernary()
      this.skip()
      if (!this.eat(')')) throw new ExprError('unclosed "("')
      return this.parsePostfix(inner)
    }
    if (/[0-9]/.test(this.source[this.at] ?? '')) {
      const match = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.source.slice(this.at)) as RegExpExecArray
      this.at += match[0].length
      return this.parsePostfix({ type: 'lit', value: finiteNumber(Number(match[0])) })
    }
    const name = this.readIdent()
    if (name === undefined) throw new ExprError(`unexpected '${this.source.slice(this.at, this.at + 12)}'`)
    if (name === 'true') return this.parsePostfix({ type: 'lit', value: true })
    if (name === 'false') return this.parsePostfix({ type: 'lit', value: false })
    if (name === 'null') return this.parsePostfix({ type: 'lit', value: null })
    return this.parsePostfix({ type: 'ident', name })
  }

  private parsePostfix(atom: Expr): Expr {
    let expr = atom
    for (;;) {
      this.skip()
      if (this.eat('.')) {
        const property = this.readIdent()
        if (property === undefined) throw new ExprError('member access is missing a name')
        checkProperty(property)
        expr = { type: 'member', object: expr, property }
        continue
      }
      if (this.eat('[')) {
        const index = this.parseTernary()
        this.skip()
        if (!this.eat(']')) throw new ExprError('unclosed "["')
        expr = { type: 'index', object: expr, index }
        continue
      }
      if (this.eat('(')) {
        const args: Expr[] = []
        this.skip()
        if (!this.peek(')')) {
          for (;;) {
            args.push(this.parseTernary())
            this.skip()
            if (this.eat(')')) break
            if (!this.eat(',')) throw new ExprError('call is missing ","')
          }
        } else this.eat(')')
        expr = { type: 'call', callee: expr, args }
        continue
      }
      return expr
    }
  }

  private parseArray(): Expr {
    this.at += 1
    const items: Expr[] = []
    this.skip()
    if (this.eat(']')) return { type: 'array', items }
    for (;;) {
      items.push(this.parseTernary())
      this.skip()
      if (this.eat(']')) return { type: 'array', items }
      if (!this.eat(',')) throw new ExprError('array is missing ","')
      this.skip()
      if (this.eat(']')) return { type: 'array', items }
    }
  }

  private parseObject(): Expr {
    this.at += 1
    const fields: { key: string; value: Expr }[] = []
    this.skip()
    if (this.eat('}')) return { type: 'object', fields }
    for (;;) {
      this.skip()
      const key = this.readKey()
      checkProperty(key)
      this.skip()
      if (!this.eat(':')) throw new ExprError('object field is missing ":"')
      fields.push({ key, value: this.parseTernary() })
      this.skip()
      if (this.eat('}')) return { type: 'object', fields }
      if (!this.eat(',')) throw new ExprError('object is missing ","')
      this.skip()
      if (this.eat('}')) return { type: 'object', fields }
    }
  }

  private parseArrow(): Expr {
    this.at += 1
    const params: string[] = []
    this.skip()
    if (!this.peek(')')) {
      for (;;) {
        const name = this.readIdent()
        if (name === undefined) throw new ExprError('arrow parameter must be a name')
        assertBindingName(name)
        if (params.includes(name)) throw new ExprError(`duplicate arrow parameter '${name}'`)
        params.push(name)
        this.skip()
        if (this.eat(')')) break
        if (!this.eat(',')) throw new ExprError('arrow parameters are missing ","')
      }
    } else this.eat(')')
    this.skip()
    this.eat('=>')
    return { type: 'arrow', params, body: this.parseTernary() }
  }

  private looksLikeArrow(): boolean {
    let depth = 0
    let quote = ''
    for (let index = this.at; index < this.source.length; index += 1) {
      const char = this.source[index]
      if (quote) {
        if (char === '\\') { index += 1; continue }
        if (char === quote) quote = ''
        continue
      }
      if (char === '"' || char === "'") { quote = char; continue }
      if (char === '(') depth += 1
      else if (char === ')') {
        depth -= 1
        if (depth === 0) {
          let next = index + 1
          while (next < this.source.length && /\s/.test(this.source.charAt(next))) next += 1
          return this.source.startsWith('=>', next)
        }
      }
    }
    return false
  }

  private readKey(): string {
    const quote = this.source[this.at]
    if (quote === '"' || quote === "'") return this.readString(quote)
    const name = this.readIdent()
    if (name === undefined) throw new ExprError('object field is missing a name')
    return name
  }

  private readString(quote: string): string {
    this.at += 1
    let value = ''
    while (this.at < this.source.length) {
      const char = this.source.charAt(this.at)
      if (char === '\\') {
        const escaped = this.source[this.at + 1] ?? ''
        if (escaped === 'u') {
          const digits = this.source.slice(this.at + 2, this.at + 6)
          if (!/^[\da-fA-F]{4}$/.test(digits)) throw new ExprError('invalid Unicode escape')
          value += String.fromCharCode(Number.parseInt(digits, 16))
          this.at += 6
          continue
        }
        value += escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped === 'r' ? '\r' : escaped === 'b' ? '\b' : escaped === 'f' ? '\f' : escaped
        this.at += 2
        continue
      }
      if (char === quote) { this.at += 1; return value }
      value += char
      this.at += 1
    }
    throw new ExprError('unclosed string')
  }

  private readIdent(): string | undefined {
    this.skip()
    const match = IDENT.exec(this.source.slice(this.at))
    if (match?.[0] === undefined) return undefined
    this.at += match[0].length
    return match[0]
  }

  private eatOp<T extends string>(op: T): T | undefined {
    this.skip()
    if (!this.source.startsWith(op, this.at)) return undefined
    // `<=` and `>=` are tried before the single-character forms.
    if (op === '<' && this.source[this.at + 1] === '>') return undefined
    this.at += op.length
    return op
  }

  private eat(token: string): boolean {
    this.skip()
    if (!this.source.startsWith(token, this.at)) return false
    this.at += token.length
    return true
  }

  private peek(token: string): boolean {
    this.skip()
    return this.source.startsWith(token, this.at)
  }

  private skip(): void {
    while (this.at < this.source.length && /\s/.test(this.source.charAt(this.at))) this.at += 1
  }
}

/**
 * Parse one expression with bounded source length, nesting, and syntax nodes.
 * @param source - Expression text, without the surrounding braces.
 * @param budget - Enclosing operation budget, when syntax is parsed during projection or an action.
 * @returns The expression tree.
 */
export function parseExpr(source: string, budget?: EvaluationBudget): Expr {
  if (source.length > MAX_EXPRESSION_LENGTH) throw new ExprError('expression length limit exceeded')
  if (budget !== undefined) consumeEvaluationBudget(budget, Math.ceil(source.length / 16))
  const expr = new Parser(source).parse()
  const pending = [{ expr, depth: 0 }]
  let remaining = MAX_EXPRESSION_NODES
  for (const next of pending) {
    remaining -= 1
    if (remaining < 0 || next.depth > MAX_EXPRESSION_DEPTH) throw new ExprError('expression complexity limit exceeded')
    for (const child of expressionChildren(next.expr)) pending.push({ expr: child, depth: next.depth + 1 })
  }
  return expr
}

function expressionChildren(expr: Expr): Expr[] {
  switch (expr.type) {
    case 'member': return [expr.object]
    case 'index': return [expr.object, expr.index]
    case 'unary': return [expr.arg]
    case 'binary': return [expr.left, expr.right]
    case 'cond': return [expr.test, expr.yes, expr.no]
    case 'array': return expr.items
    case 'object': return expr.fields.map(field => field.value)
    case 'arrow': return [expr.body]
    case 'call': return [expr.callee, ...expr.args]
    case 'lit':
    case 'ident': return []
    /* v8 ignore next -- every member of the closed expression union is handled above */
    default: return assertNever(expr)
  }
}

type PureCall = 'Object.keys' | 'Object.values' | 'Object.entries'
  | 'Math.min' | 'Math.max' | 'Math.round' | 'Math.floor' | 'Math.ceil' | 'Math.abs'
  | 'Number' | 'String'

function pureCallName(expr: Extract<Expr, { type: 'call' }>): PureCall | undefined {
  const { callee, args } = expr
  if (callee.type === 'ident' && (callee.name === 'Number' || callee.name === 'String') && args.length === 1) return callee.name
  if (callee.type !== 'member' || callee.object.type !== 'ident') return undefined
  if (callee.object.name === 'Object' && args.length === 1) {
    if (callee.property === 'keys') return 'Object.keys'
    if (callee.property === 'values') return 'Object.values'
    if (callee.property === 'entries') return 'Object.entries'
  }
  if (callee.object.name === 'Math') {
    if (args.length > 0 && args.length <= 64) {
      if (callee.property === 'min') return 'Math.min'
      if (callee.property === 'max') return 'Math.max'
    }
    if (args.length === 1) {
      if (callee.property === 'round') return 'Math.round'
      if (callee.property === 'floor') return 'Math.floor'
      if (callee.property === 'ceil') return 'Math.ceil'
      if (callee.property === 'abs') return 'Math.abs'
    }
  }
  return undefined
}

/**
 * Validate pure calls, setter arguments, properties, and optional lexical names.
 * Functional setter arguments accept one parameter and a pure expression body.
 * @param expr - Expression to inspect.
 * @param setters - Setter names introduced by `DIL.useState`.
 * @param bindings - Visible state, constant, and loop names; omitted for call-only checks.
 */
export function rejectDisallowedCalls(expr: Expr, setters: ReadonlySet<string>, bindings?: ReadonlySet<string>): void {
  const visit = (node: Expr, visible: ReadonlySet<string> | undefined, callable: ReadonlySet<string>): void => {
    switch (node.type) {
      case 'call': {
        if (node.callee.type === 'ident' && callable.has(node.callee.name)) {
          const argument = node.args[0]
          if (node.args.length !== 1 || argument === undefined) throw new ExprError('a setter expects one value or updater')
          if (argument.type === 'arrow' && argument.params.length !== 1) throw new ExprError('a setter updater expects one parameter')
          visit(argument, visible, new Set())
          return
        }
        if (pureCallName(node) !== undefined) {
          node.args.forEach((argument) => { visit(argument, visible, new Set()) })
          return
        }
        throw new ExprError(setters.size > 0 ? 'only a declared setter or an allowed pure function may be called' : 'only Math.min, max, round, floor, ceil, abs, Number, String, and Object.keys, values, entries may be called')
      }
      case 'member':
        checkProperty(node.property)
        visit(node.object, visible, callable)
        return
      case 'index':
        if (node.index.type === 'lit' && typeof node.index.value === 'string') checkProperty(node.index.value)
        visit(node.object, visible, callable)
        visit(node.index, visible, callable)
        return
      case 'object':
        for (const field of node.fields) {
          checkProperty(field.key)
          visit(field.value, visible, callable)
        }
        return
      case 'arrow': {
        const names = visible === undefined ? undefined : new Set(visible)
        const parameters = new Set<string>()
        for (const name of node.params) {
          assertBindingName(name)
          if (parameters.has(name) || setters.has(name)) throw new ExprError(`duplicate or shadowed callback name '${name}'`)
          parameters.add(name)
          names?.add(name)
        }
        visit(node.body, names, callable)
        return
      }
      case 'ident':
        if (setters.has(node.name)) throw new ExprError(`setter '${node.name}' must be called directly`)
        if (visible !== undefined && !visible.has(node.name)) throw new ExprError(`unknown name '${node.name}'`)
        return
      case 'lit': return
      case 'unary':
      case 'binary':
      case 'cond':
      case 'array':
        expressionChildren(node).forEach((child) => { visit(child, visible, callable) })
        return
      /* v8 ignore next -- every member of the closed expression union is handled above */
      default: assertNever(node)
    }
  }
  visit(expr, bindings, setters)
}

function readProperty(object: unknown, property: string): unknown {
  checkProperty(property)
  if (object == null) throw new ExprError(`cannot read '${property}'`)
  if (property === 'length' && (Array.isArray(object) || typeof object === 'string')) return object.length
  if (typeof object !== 'object') throw new ExprError(`cannot read '${property}'`)
  const descriptor = Object.getOwnPropertyDescriptor(object, property)
  if (descriptor !== undefined && !Object.hasOwn(descriptor, 'value')) throw new ExprError('accessor properties are not supported')
  return descriptor?.value
}

function readIndex(object: unknown, index: unknown): unknown {
  if (Array.isArray(object)) {
    if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0) throw new ExprError('array index must be a nonnegative integer')
    return readProperty(object, String(index))
  }
  if (object == null || typeof object !== 'object') throw new ExprError('cannot index this value')
  if (typeof index !== 'string' && typeof index !== 'number') throw new ExprError('object index must be a string or number')
  return readProperty(object, String(index))
}

function primitive(value: unknown): null | boolean | number | string {
  if (value === null) return null
  if (typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') return finiteNumber(value)
  throw new ExprError('operation expects a JSON primitive')
}

function boundedString(value: string): string {
  if (value.length > MAX_JSON_LENGTH) throw new ExprError('JSON string length limit exceeded')
  return value
}

function evalPureCall(name: PureCall, args: unknown[], budget: EvaluationBudget): unknown {
  const first = args[0]
  for (const argument of args) if (typeof argument === 'string') chargeString(budget, argument)
  switch (name) {
    case 'Object.keys':
    case 'Object.values':
    case 'Object.entries': {
      if (first === null || typeof first !== 'object' || !isJsonValue(first, budget)) {
        throw new ExprError(`${name} expects a JSON object or array`)
      }
      const keys = Object.keys(first)
      consumeEvaluationBudget(budget, keys.length * 2)
      if (name === 'Object.keys') return keys
      if (name === 'Object.values') return keys.map(key => readProperty(first, key))
      return keys.map(key => [key, readProperty(first, key)])
    }
    case 'Number': return finiteNumber(Number(primitive(first)))
    case 'String': return boundedString(String(primitive(first)))
    case 'Math.min': return Math.min(...args.map(value => finiteNumber(Number(primitive(value)))))
    case 'Math.max': return Math.max(...args.map(value => finiteNumber(Number(primitive(value)))))
    case 'Math.round': return Math.round(finiteNumber(Number(primitive(first))))
    case 'Math.floor': return Math.floor(finiteNumber(Number(primitive(first))))
    case 'Math.ceil': return Math.ceil(finiteNumber(Number(primitive(first))))
    case 'Math.abs': return Math.abs(finiteNumber(Number(primitive(first))))
    /* v8 ignore next -- pureCallName only returns the closed names handled above */
    default: return assertNever(name)
  }
}

/**
 * Evaluate bounded syntax against an explicit environment, without host globals.
 * Callers must validate allowed calls before passing setter functions.
 * @param expr - Parsed and validated expression.
 * @param env - Bindings visible to identifiers. Setter functions may be present.
 * @param budget - Shared work for the enclosing projection or action; fresh for a standalone call.
 * @returns The expression result, or a restricted callback sharing the evaluation budget.
 */
export function evalExpr(expr: Expr, env: Readonly<Record<string, unknown>>, budget = createEvaluationBudget()): unknown {
  return evaluate(expr, env, budget, 0)
}

function evaluate(expr: Expr, env: Readonly<Record<string, unknown>>, budget: EvaluationBudget, depth: number): unknown {
  consumeEvaluationBudget(budget)
  if (depth > MAX_EXPRESSION_DEPTH) throw new ExprError('expression evaluation limit exceeded')
  const evaluateChild = (child: Expr): unknown => evaluate(child, env, budget, depth + 1)
  switch (expr.type) {
    case 'lit': return expr.value
    case 'ident':
      if (!Object.hasOwn(env, expr.name)) throw new ExprError(`unknown name '${expr.name}'`)
      return env[expr.name]
    case 'member': return readProperty(evaluateChild(expr.object), expr.property)
    case 'index': return readIndex(evaluateChild(expr.object), evaluateChild(expr.index))
    case 'unary': {
      const value = evaluateChild(expr.arg)
      if (typeof value === 'string') chargeString(budget, value)
      return expr.op === '!' ? !value : finiteNumber(-Number(primitive(value)))
    }
    case 'binary': {
      const left = evaluateChild(expr.left)
      if (expr.op === '&&') return left ? evaluateChild(expr.right) : left
      if (expr.op === '||') return left ? left : evaluateChild(expr.right)
      const right = evaluateChild(expr.right)
      if (expr.op === '===') return left === right
      if (expr.op === '!==') return left !== right
      const a = primitive(left)
      const b = primitive(right)
      if (typeof a === 'string') chargeString(budget, a)
      if (typeof b === 'string') chargeString(budget, b)
      switch (expr.op) {
        case '>': return (a as number) > (b as number)
        case '<': return (a as number) < (b as number)
        case '>=': return (a as number) >= (b as number)
        case '<=': return (a as number) <= (b as number)
        case '+': return typeof a === 'string' || typeof b === 'string' ? boundedString(String(a) + String(b)) : finiteNumber(Number(a) + Number(b))
        case '-': return finiteNumber(Number(a) - Number(b))
        case '*': return finiteNumber(Number(a) * Number(b))
        case '/': return finiteNumber(Number(a) / Number(b))
        case '%': return finiteNumber(Number(a) % Number(b))
        /* v8 ignore next -- short-circuit and equality operators returned before this closed switch */
        default: return assertNever(expr.op)
      }
    }
    case 'cond': return evaluateChild(expr.test) ? evaluateChild(expr.yes) : evaluateChild(expr.no)
    case 'array': return expr.items.map(evaluateChild)
    case 'object': {
      const out: Record<string, unknown> = {}
      for (const field of expr.fields) {
        checkProperty(field.key)
        out[field.key] = evaluateChild(field.value)
      }
      return out
    }
    case 'arrow':
      return (...args: unknown[]) => {
        const inner: Record<string, unknown> = { ...env }
        expr.params.forEach((name, index) => { inner[name] = args[index] })
        return evaluate(expr.body, inner, budget, depth + 1)
      }
    case 'call': {
      const pure = pureCallName(expr)
      if (pure !== undefined) return evalPureCall(pure, expr.args.map(evaluateChild), budget)
      const fn = evaluateChild(expr.callee)
      if (typeof fn !== 'function') throw new ExprError('called value is not a function')
      return (fn as (...args: unknown[]) => unknown)(...expr.args.map(evaluateChild))
    }
    /* v8 ignore next -- every member of the closed expression union is handled above */
    default: return assertNever(expr)
  }
}

/**
 * Whether a value is finite, bounded JSON data without accessors or prototypes.
 * Shared values are permitted; cycles exceed the nesting bound and are rejected.
 * @param value - Candidate result.
 * @param budget - Enclosing work budget; exhaustion throws before additional traversal.
 * @returns True when the value is JSON data within the interpreter limits.
 */
export function isJsonValue(value: unknown, budget?: EvaluationBudget): value is JsonValue {
  const pending = [{ value, depth: 0 }]
  let remaining = MAX_JSON_NODES
  let characters = 0
  for (const item of pending) {
    const child = item.value
    if (budget !== undefined) consumeEvaluationBudget(budget)
    remaining -= 1
    if (remaining < 0 || item.depth > MAX_EXPRESSION_DEPTH) return false
    if (child === null || typeof child === 'boolean') continue
    if (typeof child === 'number') {
      if (!Number.isFinite(child)) return false
      continue
    }
    if (typeof child === 'string') {
      characters += child.length
      if (characters > MAX_JSON_LENGTH) return false
      if (budget !== undefined) chargeString(budget, child)
      continue
    }
    if (typeof child !== 'object') return false
    if (Array.isArray(child)) {
      if (pending.length + child.length > MAX_JSON_NODES) return false
      if (budget !== undefined) consumeEvaluationBudget(budget, child.length * 2 + 1)
      if (Reflect.ownKeys(child).length !== child.length + 1) return false
      for (let index = 0; index < child.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(child, String(index))
        if (descriptor === undefined || !Object.hasOwn(descriptor, 'value')) return false
        const value: unknown = descriptor.value
        pending.push({ value, depth: item.depth + 1 })
      }
      continue
    }
    const prototype: unknown = Object.getPrototypeOf(child)
    if (prototype !== null && prototype !== Object.prototype) return false
    const keys = Reflect.ownKeys(child)
    if (pending.length + keys.length > MAX_JSON_NODES) return false
    if (budget !== undefined) consumeEvaluationBudget(budget, keys.length * 2 + 1)
    for (const key of keys) {
      if (typeof key !== 'string' || FORBIDDEN_PROPERTIES.has(key)) return false
      characters += key.length
      if (characters > MAX_JSON_LENGTH) return false
      if (budget !== undefined) chargeString(budget, key)
      const descriptor = Object.getOwnPropertyDescriptor(child, key)
      if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return false
      const value: unknown = descriptor.value
      pending.push({ value, depth: item.depth + 1 })
    }
  }
  return true
}
