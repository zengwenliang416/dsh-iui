/** Blocks the reader operates: choice, calculator, steps, checklist, faq, and sections. */

import {
  Badge, Card, CheckboxList, CheckboxListItem, Collapsible, List, ListItem, NumberInput, RadioList, RadioListItem,
  SegmentedControl, SegmentedControlItem, SelectableCard, Selector, Slider, Step, Stepper, Switch, Tab, TabList, Text, VStack,
} from '@astryxdesign/core'
import { evaluateFormula } from '../../src/catalog/formula.ts'
import type {
  CalculatorBlock, CalculatorInput, ChecklistBlock, ChoiceBlock, FaqBlock, SectionsBlock, StepsBlock,
} from '../../src/catalog/spec.ts'
import { BlockTitle, formatValue, useCopy } from './shared.tsx'

function Feedback({ block, selected }: { block: ChoiceBlock; selected: string | undefined }) {
  const copy = useCopy()
  const option = block.options.find(candidate => candidate.id === selected)
  if (option === undefined) return null
  const verdict = block.correct === undefined ? null
    : <Badge variant={option.id === block.correct ? 'success' : 'error'} label={option.id === block.correct ? copy.correct : copy.incorrect} />
  return <VStack gap={1}>{verdict}<Text>{option.detail}</Text></VStack>
}

/** Choice as a segmented control, selectable cards, or a radio list; the selection reveals its detail. */
export function ChoiceView({ block, component, selected, select }: {
  block: ChoiceBlock; component: string; selected: string | undefined; select: (id: string) => void
}) {
  if (component === 'segmented') {
    return (
      <VStack gap={2}>
        <BlockTitle title={block.title} />
        {/* SegmentedControl uses its label only as the accessible name. */}
        <Text weight="medium" aria-hidden>{block.prompt}</Text>
        <SegmentedControl label={block.prompt} value={selected ?? ''} onChange={select} layout="fill">
          {block.options.map(option => <SegmentedControlItem key={option.id} value={option.id} label={option.label} />)}
        </SegmentedControl>
        <Feedback block={block} selected={selected} />
      </VStack>
    )
  }
  if (component === 'radio-list') {
    return (
      <VStack gap={2}>
        <BlockTitle title={block.title} />
        <RadioList label={block.prompt} value={selected ?? ''} onChange={select}>
          {block.options.map(option => <RadioListItem key={option.id} value={option.id} label={option.label} />)}
        </RadioList>
        <Feedback block={block} selected={selected} />
      </VStack>
    )
  }
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      <Text weight="medium">{block.prompt}</Text>
      {block.options.map(option => (
        <SelectableCard key={option.id} label={option.label} isSelected={selected === option.id} onChange={() => { select(option.id) }} padding={3}>
          <VStack gap={1}>
            <Text weight="medium">{option.label}</Text>
            {selected === option.id && <Feedback block={block} selected={selected} />}
          </VStack>
        </SelectableCard>
      ))}
    </VStack>
  )
}

function CalculatorField({ input, value, change, component }: {
  input: CalculatorInput; value: number; change: (value: number) => void; component: string
}) {
  switch (input.kind ?? 'number') {
    case 'toggle':
      return <Switch label={input.label} value={value === 1} onChange={(checked) => { change(checked ? 1 : 0) }} />
    case 'options': {
      const options = input.options ?? []
      if (options.length <= 4) {
        return (
          <VStack gap={1}>
            <Text aria-hidden>{input.label}</Text>
            <SegmentedControl label={input.label} value={String(value)} onChange={(next) => { change(Number(next)) }} layout="fill">
              {options.map(option => <SegmentedControlItem key={option.value} value={String(option.value)} label={option.label} />)}
            </SegmentedControl>
          </VStack>
        )
      }
      return (
        <Selector label={input.label} value={String(value)} onChange={(next) => { change(Number(next)) }}
          options={options.map(option => ({ value: String(option.value), label: option.label }))} />
      )
    }
    case 'number':
      return component === 'sliders'
        ? (
            <Slider label={input.label} value={value} min={input.min ?? 0} max={input.max ?? 100} step={input.step ?? 1} valueDisplay="text"
              formatValue={next => formatValue(next, input.unit)} onChange={(next: number) => { change(next) }} />
          )
        : (
            <NumberInput label={input.label} value={value} min={input.min ?? null} max={input.max ?? null} step={input.step ?? null}
              {...input.unit === undefined ? {} : { units: input.unit }} onChange={change} />
          )
  }
}

/** Calculator: inputs on top, live results below. */
export function CalculatorView({ block, component, values, change }: {
  block: CalculatorBlock; component: string; values: Readonly<Record<string, number>>; change: (key: string, value: number) => void
}) {
  const current = Object.fromEntries(block.inputs.map(input => [input.key, values[input.key] ?? input.value]))
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <BlockTitle title={block.title} />
        {block.inputs.map(input => (
          <CalculatorField key={input.key} input={input} value={current[input.key] ?? input.value} component={component} change={(value) => { change(input.key, value) }} />
        ))}
        {block.outputs.map((output) => {
          let result: string
          try {
            result = formatValue(evaluateFormula(output.formula, current), output.unit, output.decimals ?? 0)
          } catch (_error) {
            // A value the reader entered can make a validated formula non-finite; the result shows as unavailable.
            result = '—'
          }
          return <Text key={output.label} type="large" hasTabularNumbers>{output.label}: {result}</Text>
        })}
      </VStack>
    </Card>
  )
}

/** Steps as a clickable stepper, a numbered list, or collapsible steps. */
export function StepsView({ block, component, active, activate }: {
  block: StepsBlock; component: string; active: number; activate: (index: number) => void
}) {
  if (component === 'stepper') {
    const step = block.steps[active]
    return (
      <VStack gap={3}>
        <BlockTitle title={block.title} />
        <Stepper activeStep={active} onStepClick={activate}>
          {block.steps.map((entry, index) => <Step key={index} step={index} label={entry.title} />)}
        </Stepper>
        {step?.detail !== undefined && <Card padding={3} variant="muted"><Text>{step.detail}</Text></Card>}
      </VStack>
    )
  }
  if (component === 'accordion') {
    return (
      <VStack gap={2}>
        <BlockTitle title={block.title} />
        {block.steps.map((entry, index) => (
          <Collapsible key={index} trigger={<Text weight="medium">{index + 1}. {entry.title}</Text>} defaultIsOpen={index === active}>
            {entry.detail !== undefined && <Text>{entry.detail}</Text>}
          </Collapsible>
        ))}
      </VStack>
    )
  }
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      <List listStyle="decimal" density="balanced">
        {block.steps.map((entry, index) => <ListItem key={index} label={entry.title} {...entry.detail === undefined ? {} : { description: entry.detail }} />)}
      </List>
    </VStack>
  )
}

/** Checklist as a checkbox list or selectable cards; ticks stay in the card. */
export function ChecklistView({ block, component, checked, change }: {
  block: ChecklistBlock; component: string; checked: readonly string[]; change: (ids: string[]) => void
}) {
  const done = `${String(checked.length)} / ${String(block.items.length)}`
  if (component === 'cards') {
    return (
      <VStack gap={2}>
        <BlockTitle title={block.title} />
        <Text type="supporting">{done}</Text>
        {block.items.map(item => (
          <SelectableCard key={item.id} label={item.label} isSelected={checked.includes(item.id)} padding={3}
            onChange={(isSelected) => { change(isSelected ? [...checked, item.id] : checked.filter(id => id !== item.id)) }}>
            <VStack gap={1}>
              <Text weight="medium" hasStrikethrough={checked.includes(item.id)}>{item.label}</Text>
              {item.detail !== undefined && <Text type="supporting">{item.detail}</Text>}
            </VStack>
          </SelectableCard>
        ))}
      </VStack>
    )
  }
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      <CheckboxList label={block.title ?? done} isLabelHidden value={[...checked]} onChange={change} description={done}>
        {block.items.map(item => <CheckboxListItem key={item.id} value={item.id} label={item.label} {...item.detail === undefined ? {} : { description: item.detail }} />)}
      </CheckboxList>
    </VStack>
  )
}

/** Questions as collapsibles or a plain list. */
export function FaqView({ block, component }: { block: FaqBlock; component: string }) {
  if (component === 'list') {
    return (
      <VStack gap={2}>
        <BlockTitle title={block.title} />
        <List density="balanced" hasDividers>
          {block.items.map(item => <ListItem key={item.question} label={item.question} description={item.answer} />)}
        </List>
      </VStack>
    )
  }
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      {block.items.map(item => (
        <Collapsible key={item.question} trigger={<Text weight="medium">{item.question}</Text>}>
          <Text>{item.answer}</Text>
        </Collapsible>
      ))}
    </VStack>
  )
}

/** Sections as tabs, a radio list, or collapsibles; the chosen section's text shows below. */
export function SectionsView({ block, component, selected, select }: {
  block: SectionsBlock; component: string; selected: string | undefined; select: (id: string) => void
}) {
  const copy = useCopy()
  const current = block.sections.find(section => section.id === selected) ?? block.sections[0]
  if (component === 'accordion') {
    return (
      <VStack gap={2}>
        <BlockTitle title={block.title} />
        {block.sections.map((section, index) => (
          <Collapsible key={section.id} trigger={<Text weight="medium">{section.label}</Text>} defaultIsOpen={index === 0}>
            <Text>{section.text}</Text>
          </Collapsible>
        ))}
      </VStack>
    )
  }
  const panel = current === undefined ? null : <Card padding={3} variant="muted"><Text>{current.text}</Text></Card>
  if (component === 'radio-list') {
    return (
      <VStack gap={2}>
        <BlockTitle title={block.title} />
        <RadioList label={block.title ?? copy.chooseSection} isLabelHidden={block.title === undefined} value={current?.id ?? ''} onChange={select}>
          {block.sections.map(section => <RadioListItem key={section.id} value={section.id} label={section.label} />)}
        </RadioList>
        {panel}
      </VStack>
    )
  }
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      <TabList value={current?.id ?? ''} onChange={select} hasDivider>
        {block.sections.map(section => <Tab key={section.id} value={section.id} label={section.label} />)}
      </TabList>
      {panel}
    </VStack>
  )
}
