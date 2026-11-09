/** Data blocks: comparison, metrics, and chart. */

import '@astryxdesign/charts/charts.css'
import { Card, Grid, MetadataList, MetadataListItem, ProgressBar, Table, Text, VStack } from '@astryxdesign/core'
import { area, bar, Chart, ChartAxis, ChartGrid, dot, line } from '@astryxdesign/charts'
import type { ChartBlock, ComparisonBlock, MetricsBlock } from '../../src/catalog/spec.ts'
import { BlockTitle, formatValue } from './shared.tsx'

/** Comparison as a table or one card per item. */
export function ComparisonView({ block, component }: { block: ComparisonBlock; component: string }) {
  if (component === 'table') {
    const data = block.items.map((item, index) => ({ id: index, name: item.name, ...item.values }))
    const columns = [
      { key: 'name', header: '' },
      ...block.attributes.map(attribute => ({
        key: attribute.key,
        header: attribute.unit === undefined ? attribute.label : `${attribute.label} (${attribute.unit})`,
        renderCell: (row: Record<string, unknown>) => {
          const value = row[attribute.key]
          return typeof value === 'string' || typeof value === 'number' ? formatValue(value) : ''
        },
      })),
    ]
    return (
      <VStack gap={2}>
        <BlockTitle title={block.title} />
        <Table data={data} columns={columns} idKey="id" dividers="rows" density="balanced" textOverflow="wrap" />
      </VStack>
    )
  }
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      <Grid columns={{ minWidth: 200 }} gap={3}>
        {block.items.map(item => (
          <Card key={item.name} padding={3} variant="muted">
            <VStack gap={1}>
              <Text weight="semibold">{item.name}</Text>
              {block.attributes.map((attribute) => {
                const value = item.values[attribute.key]
                return value === undefined ? null : <Text key={attribute.key} type="supporting">{attribute.label}: {formatValue(value, attribute.unit)}</Text>
              })}
              {item.note !== undefined && <Text type="supporting">{item.note}</Text>}
            </VStack>
          </Card>
        ))}
      </Grid>
    </VStack>
  )
}

/** Metrics as stat cards, a metadata list, or progress bars. */
export function MetricsView({ block, component }: { block: MetricsBlock; component: string }) {
  if (component === 'progress') {
    return (
      <VStack gap={3}>
        <BlockTitle title={block.title} />
        {block.metrics.map(metric => metric.max === undefined || typeof metric.value !== 'number'
          // A figure without a known whole is not a share; it reads as a plain value.
          ? <Text key={metric.label}>{metric.label}: {formatValue(metric.value, metric.unit)}</Text>
          : (
              <ProgressBar key={metric.label} label={metric.label} value={metric.value} max={metric.max} hasValueLabel
                formatValueLabel={(value, max) => `${formatValue(value, metric.unit)} / ${formatValue(max, metric.unit)}`} />
            ))}
      </VStack>
    )
  }
  if (component === 'metadata') {
    return (
      <MetadataList {...block.title === undefined ? {} : { title: block.title }} columns="multi">
        {block.metrics.map(metric => (
          <MetadataListItem key={metric.label} label={metric.label}>
            {formatValue(metric.value, metric.unit)}{metric.note === undefined ? '' : ` · ${metric.note}`}
          </MetadataListItem>
        ))}
      </MetadataList>
    )
  }
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      <Grid columns={{ minWidth: 150 }} gap={3}>
        {block.metrics.map(metric => (
          <Card key={metric.label} padding={3} variant="muted">
            <VStack gap={1}>
              <Text type="supporting">{metric.label}</Text>
              <Text type="display-3" hasTabularNumbers>{formatValue(metric.value, metric.unit)}</Text>
              {metric.note !== undefined && <Text type="supporting">{metric.note}</Text>}
            </VStack>
          </Card>
        ))}
      </Grid>
    </VStack>
  )
}

/** Chart as bars, lines, areas, or dots over the x field. */
export function ChartView({ block, component }: { block: ChartBlock; component: string }) {
  const grouped = block.series.length > 1
  const series = block.series.map((entry) => {
    switch (component) {
      // Straight segments: a smoothed curve would draw values between points that the data does not contain.
      case 'line': return line(entry.key, { label: entry.label, dots: true, curve: 'linear' })
      case 'area': return area(entry.key, { label: entry.label, curve: 'linear' })
      case 'scatter': return dot(entry.key, { label: entry.label })
      default: return bar(entry.key, { label: entry.label, ...grouped ? { group: 'series' } : {} })
    }
  })
  const unit = block.unit
  // Bars need a category axis, so their x values are drawn as labels even when numeric.
  const data = block.data.map(row => component === 'bar' ? { ...row, [block.x.key]: String(row[block.x.key]) } : { ...row })
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      <Chart data={data} xKey={block.x.key} series={series} height={260} margin={{ left: unit === undefined ? 48 : 72 }}
        grid={<ChartGrid horizontal />}
        axes={(
          <>
            <ChartAxis position="bottom" />
            <ChartAxis position="left" {...unit === undefined ? {} : { tickFormat: (value: unknown) => `${String(value)} ${unit}` }} />
          </>
        )}
        legend={grouped} tooltip />
      <Text type="supporting">{block.x.label}{unit === undefined ? '' : ` · ${unit}`}</Text>
    </VStack>
  )
}
