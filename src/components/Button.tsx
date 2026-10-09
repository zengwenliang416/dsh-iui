import type { ButtonProps, IuiActionEvent } from '../types/ir'

export function ButtonView({
  nodeKey,
  props,
  onAction,
}: {
  nodeKey: string
  props: ButtonProps
  onAction: (ev: IuiActionEvent) => void
}) {
  return (
    <button
      className="iui-btn"
      type="button"
      onClick={() =>
        onAction({
          type: 'action',
          key: nodeKey,
          action: props.action,
          payload: props.payload,
        })
      }
    >
      {props.label}
    </button>
  )
}
