import type { TextProps } from '../types/ir'

export function TextView({ props }: { props: TextProps }) {
  return <div className="iui-text">{props.content}</div>
}
