import type { HotspotProps } from '../types/ir'

export function HotspotView({ props }: { props: HotspotProps }) {
  return (
    <div className="iui-card iui-hotspot" data-hotspot-id={props.id}>
      <div className="iui-hotspot-label">{props.label}</div>
      {props.body ? <div className="iui-hotspot-body">{props.body}</div> : null}
    </div>
  )
}
