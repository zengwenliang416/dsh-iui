/**
 * Semantic content blocks and their candidate components.
 *
 * The model describes what an answer contains; it never names a component.
 * Each block type lists the renderer-neutral components that can present it,
 * and one description per component feeds both rule tie-breaks and the Jev
 * choice criteria, so the catalog has a single source.
 */

/** A short highlighted takeaway with optional supporting points. */
export interface SummaryBlock {
  readonly type: 'summary'
  readonly title?: string
  readonly text: string
  readonly highlights?: readonly string[]
}

/** A status message the reader must not miss. */
export interface NoticeBlock {
  readonly type: 'notice'
  readonly tone: 'info' | 'success' | 'warning' | 'danger'
  readonly title?: string
  readonly text: string
}

/** One compared attribute; `key` addresses each item's value. */
export interface ComparisonAttribute {
  readonly key: string
  readonly label: string
  readonly unit?: string
}

/** One compared item with a value for every attribute. */
export interface ComparisonItem {
  readonly name: string
  readonly values: Readonly<Record<string, string | number>>
  readonly note?: string
}

/** Items compared across shared attributes. */
export interface ComparisonBlock {
  readonly type: 'comparison'
  readonly title?: string
  readonly attributes: readonly ComparisonAttribute[]
  readonly items: readonly ComparisonItem[]
}

/** One selectable option; `detail` appears once the reader selects it. */
export interface ChoiceOption {
  readonly id: string
  readonly label: string
  readonly detail: string
}

/** Options the reader selects to reveal details; `correct` turns it into a check. */
export interface ChoiceBlock {
  readonly type: 'choice'
  readonly title?: string
  readonly prompt: string
  readonly options: readonly ChoiceOption[]
  readonly correct?: string
}

/** One labelled numeric choice of an `options` calculator input. */
export interface CalculatorChoice {
  readonly label: string
  readonly value: number
}

/**
 * One calculator input. `number` (the default) uses min, max, and step;
 * `toggle` is 0 or 1; `options` picks one of the listed values.
 */
export interface CalculatorInput {
  readonly key: string
  readonly label: string
  readonly kind?: 'number' | 'toggle' | 'options'
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly value: number
  readonly unit?: string
  readonly options?: readonly CalculatorChoice[]
}

/** One derived result; `formula` reads input keys with the restricted expression subset. */
export interface CalculatorOutput {
  readonly label: string
  readonly formula: string
  readonly unit?: string
  readonly decimals?: number
}

/** Inputs the reader adjusts and the results derived from them. */
export interface CalculatorBlock {
  readonly type: 'calculator'
  readonly title?: string
  readonly inputs: readonly CalculatorInput[]
  readonly outputs: readonly CalculatorOutput[]
}

/** One step of a process. */
export interface Step {
  readonly title: string
  readonly detail?: string
}

/** An ordered process; `current` marks the step the reader is on, counted from 0. */
export interface StepsBlock {
  readonly type: 'steps'
  readonly title?: string
  readonly steps: readonly Step[]
  readonly current?: number
}

/** One headline number; `max` makes it a share of a whole. */
export interface Metric {
  readonly label: string
  readonly value: number | string
  readonly unit?: string
  readonly max?: number
  readonly note?: string
}

/** A few headline numbers read at a glance. */
export interface MetricsBlock {
  readonly type: 'metrics'
  readonly title?: string
  readonly metrics: readonly Metric[]
}

/** One item the reader can tick off. */
export interface ChecklistItem {
  readonly id: string
  readonly label: string
  readonly detail?: string
}

/** Actions or requirements the reader ticks off; ticks stay in the card. */
export interface ChecklistBlock {
  readonly type: 'checklist'
  readonly title?: string
  readonly items: readonly ChecklistItem[]
}

/** One question with its answer. */
export interface FaqItem {
  readonly question: string
  readonly answer: string
}

/** Questions the reader opens one at a time. */
export interface FaqBlock {
  readonly type: 'faq'
  readonly title?: string
  readonly items: readonly FaqItem[]
}

/** One switchable section. */
export interface Section {
  readonly id: string
  readonly label: string
  readonly text: string
}

/** Alternative views of one topic, of which the reader reads one at a time. */
export interface SectionsBlock {
  readonly type: 'sections'
  readonly title?: string
  readonly sections: readonly Section[]
}

/** One plotted series; `key` addresses each row's numeric value. */
export interface ChartSeries {
  readonly key: string
  readonly label: string
}

/** Numeric series over shared x values. */
export interface ChartBlock {
  readonly type: 'chart'
  readonly title?: string
  readonly x: { readonly key: string; readonly label: string }
  readonly series: readonly ChartSeries[]
  readonly unit?: string
  readonly data: readonly Readonly<Record<string, string | number>>[]
}

/** Source code shown as text; it is never executed. */
export interface CodeBlockSpec {
  readonly type: 'code'
  readonly title?: string
  readonly language: string
  readonly code: string
}

/** A quotation with its source. */
export interface QuoteBlock {
  readonly type: 'quote'
  readonly text: string
  readonly source?: string
}

/** One short label. */
export interface Tag {
  readonly label: string
  readonly tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
}

/** Short labels such as categories, keywords, or attributes. */
export interface TagsBlock {
  readonly type: 'tags'
  readonly title?: string
  readonly tags: readonly Tag[]
}

/** Rich text written as Markdown. */
export interface TextBlock {
  readonly type: 'text'
  readonly title?: string
  readonly markdown: string
}

/** One dated event. */
export interface TimelineEvent {
  readonly date: string
  readonly title: string
  readonly detail?: string
}

/** Events in time order. */
export interface TimelineBlock {
  readonly type: 'timeline'
  readonly title?: string
  readonly events: readonly TimelineEvent[]
}

/** One node of a hierarchy. */
export interface TreeNode {
  readonly label: string
  readonly detail?: string
  readonly children?: readonly TreeNode[]
}

/** A hierarchy such as an outline, organisation, or file structure. */
export interface TreeBlock {
  readonly type: 'tree'
  readonly title?: string
  readonly nodes: readonly TreeNode[]
}

/** One browsable card. */
export interface GalleryItem {
  readonly title: string
  readonly text: string
  readonly tag?: string
}

/** Parallel examples or cases the reader browses. */
export interface GalleryBlock {
  readonly type: 'gallery'
  readonly title?: string
  readonly items: readonly GalleryItem[]
}

/** One defined term. */
export interface GlossaryTerm {
  readonly term: string
  readonly definition: string
}

/** Terms and their definitions. */
export interface GlossaryBlock {
  readonly type: 'glossary'
  readonly title?: string
  readonly terms: readonly GlossaryTerm[]
}

/** One keyboard shortcut; `keys` uses + between keys, such as Ctrl+Shift+P. */
export interface Shortcut {
  readonly keys: string
  readonly action: string
}

/** Keyboard shortcuts and what they do. */
export interface ShortcutsBlock {
  readonly type: 'shortcuts'
  readonly title?: string
  readonly shortcuts: readonly Shortcut[]
}

/** One cited source; `url` opens outside the card. */
export interface Source {
  readonly title: string
  readonly url: string
  readonly note?: string
}

/** Sources the answer relies on. */
export interface SourcesBlock {
  readonly type: 'sources'
  readonly title?: string
  readonly sources: readonly Source[]
}

/** One status line. */
export interface StatusItem {
  readonly label: string
  readonly state: 'ok' | 'warning' | 'error' | 'pending' | 'info'
  readonly note?: string
}

/** The state of several checks, services, or tasks. */
export interface StatusBlock {
  readonly type: 'status'
  readonly title?: string
  readonly items: readonly StatusItem[]
}

/** A local practice timer; nothing is sent anywhere when it runs. */
export interface TimerBlock {
  readonly type: 'timer'
  readonly title?: string
  readonly label: string
  readonly minutes: number
}

/** One person. */
export interface Person {
  readonly name: string
  readonly role?: string
  readonly note?: string
}

/** People and their roles. */
export interface PeopleBlock {
  readonly type: 'people'
  readonly title?: string
  readonly people: readonly Person[]
}

/** One calendar entry; `date` is YYYY-MM-DD. */
export interface CalendarEvent {
  readonly date: string
  readonly title: string
  readonly detail?: string
}

/** Dated plans the reader inspects by day. */
export interface CalendarBlock {
  readonly type: 'calendar'
  readonly title?: string
  readonly events: readonly CalendarEvent[]
}

/** Every content block the card accepts. */
export type Block =
  | SummaryBlock | NoticeBlock | ComparisonBlock | ChoiceBlock | CalculatorBlock | StepsBlock
  | MetricsBlock | ChecklistBlock | FaqBlock | SectionsBlock | ChartBlock | CodeBlockSpec | QuoteBlock | TagsBlock
  | TextBlock | TimelineBlock | TreeBlock | GalleryBlock | GlossaryBlock | ShortcutsBlock | SourcesBlock | StatusBlock
  | TimerBlock | PeopleBlock | CalendarBlock

/** Discriminant of {@link Block}. */
export type BlockType = Block['type']

/** The validated `render_ui` arguments. */
export interface UiSpec {
  readonly title?: string
  readonly blocks: readonly Block[]
}

/** Candidate components of one block type, each with the description deciders compare. */
export const COMPONENTS = {
  summary: {
    callout: 'A highlighted callout for one key takeaway, best when the point is short or carries a few highlights',
    card: 'A plain titled card for an explanation of a few sentences without emphasis',
  },
  notice: {
    banner: 'A full-width coloured banner, best for a warning or result the reader must notice first',
    inline: 'A small tone badge beside the text, best for a brief status that should not dominate the card',
  },
  comparison: {
    table: 'Rows are items and columns are attributes; best for exact values, many items, or numeric data',
    'card-grid': 'One card per item listing its attributes; best for two or three items with short prose values',
  },
  choice: {
    segmented: 'A compact segmented control; best for two to four options with very short labels',
    'option-cards': 'A stack of selectable cards; best for longer labels or when each option needs room',
    'radio-list': 'A vertical radio list; best for four or more options read as a list, such as quiz answers',
  },
  calculator: {
    sliders: 'One slider per numeric input; best for bounded ranges explored by dragging',
    'number-fields': 'One numeric field per input; best for wide ranges or exact values typed by the reader',
  },
  steps: {
    stepper: 'A clickable stepper; best for up to six short steps the reader walks through one at a time',
    'numbered-list': 'A numbered list with each step\'s detail; best for many steps read straight through',
    accordion: 'Collapsible steps; best when each step carries a long explanation',
  },
  metrics: {
    'stat-cards': 'Large numbers in cards; best for two to four headline figures',
    metadata: 'A compact label and value list; best for many figures or text values',
    progress: 'Progress bars; best when every figure is a share of a known maximum',
  },
  checklist: {
    'checkbox-list': 'A checkbox list; best for short items ticked in order',
    cards: 'Selectable cards; best when items carry explanations the reader should see while ticking',
  },
  faq: {
    accordion: 'Collapsible questions; best for several questions or long answers',
    list: 'Questions with their answers visible; best for two or three short answers',
  },
  sections: {
    tabs: 'Tabs; best for two to four sections with short labels',
    'radio-list': 'A radio list that shows the chosen section; best for many sections or long labels',
    accordion: 'Collapsible sections; best when the reader may open several at once',
  },
  chart: {
    bar: 'A bar chart; best for comparing values across categories',
    line: 'A line chart; best for a trend over ordered x values such as time',
    area: 'An area chart; best for a trend whose magnitude matters, such as cumulative totals',
    scatter: 'A scatter plot; best for numeric x values where each point stands alone',
  },
  code: {
    'code-block': 'A code block; best for a short snippet',
    numbered: 'A code block with line numbers; best for longer code the answer refers to by line',
  },
  quote: {
    blockquote: 'An indented quotation; best for a quotation inside an explanation',
    card: 'A quotation in its own card; best for a quotation that is the main point',
  },
  tags: {
    tokens: 'Neutral tokens; best for keywords or categories without status',
    badges: 'Coloured badges; best when tags carry a status such as success or warning',
  },
  text: {
    markdown: 'Markdown at normal reading size; best for a few paragraphs of explanation',
    compact: 'Compact Markdown; best for short notes beside other blocks',
  },
  timeline: {
    'vertical-steps': 'A vertical timeline with markers; best for a few milestones read in order',
    'dated-list': 'A list with the date beside each event; best for many events or exact dates',
  },
  tree: {
    tree: 'An expandable tree; best for deep hierarchies the reader explores',
    'nested-list': 'An indented list with everything visible; best for shallow outlines',
  },
  gallery: {
    carousel: 'A horizontal carousel; best for several parallel examples browsed one by one',
    grid: 'A grid of cards; best for a few items compared side by side',
  },
  glossary: {
    metadata: 'A term and definition list; best for several short definitions',
    infotips: 'Terms with a definition tip; best for many terms the reader checks on demand',
    list: 'A list with definitions under each term; best for longer definitions',
  },
  shortcuts: {
    table: 'A table of keys and actions; best for many shortcuts',
    list: 'A list with keys beside each action; best for a few shortcuts',
  },
  sources: {
    citations: 'Numbered citations; best when the answer refers to sources by number',
    links: 'A list of links with notes; best for further reading',
  },
  status: {
    dots: 'Status dots with labels; best for many checks read at a glance',
    badges: 'Status badges with notes; best when each status needs an explanation',
  },
  timer: {
    countdown: 'A countdown with a progress bar; best for timed practice of a fixed length',
    stopwatch: 'A stopwatch that counts up; best for measuring how long something takes',
  },
  people: {
    list: 'A list with avatars; best for many people',
    cards: 'Cards with avatars; best for a few people with roles and notes',
  },
  calendar: {
    calendar: 'A month calendar where choosing a day shows its plans; best for dates within one or two months',
    agenda: 'An agenda grouped by date; best for many dates or dates far apart',
  },
} as const satisfies Record<BlockType, Record<string, string>>

/** Every block type, in catalog order. */
export const BLOCK_TYPES = Object.keys(COMPONENTS) as readonly BlockType[]

/** A component id valid for block type `T`. */
export type ComponentId<T extends BlockType = BlockType> = T extends BlockType ? keyof typeof COMPONENTS[T] & string : never

/** Where a block's component came from. */
export type PlacementSource = 'rules' | 'jev'

/** The component chosen for one block, recorded with the card so replay never decides again. */
export interface Placement {
  readonly component: string
  readonly source: PlacementSource
  /** Jev confidence for its choice, kept even when rules replaced a low-confidence choice. */
  readonly confidence?: number
  /** Why rules decided although Jev was configured. */
  readonly fallback?: 'low-confidence' | 'unavailable'
}

/** A rendered card: the validated content and one placement per block. */
export interface ResolvedCard {
  readonly spec: UiSpec
  readonly placements: readonly Placement[]
}

/**
 * Candidate component ids of a block type, in declaration order.
 * @param type - Block type.
 * @returns Component ids the renderer supports for it.
 */
export function candidates(type: BlockType): readonly string[] {
  return Object.keys(COMPONENTS[type])
}
