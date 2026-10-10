import type { FormField, FormProps, IuiActionEvent } from '../types/ir';
type Props = {
    nodeKey: string;
    sessionId: string;
    props: FormProps;
    onAction: (ev: IuiActionEvent) => void;
    /** Notify parent of local formValues so forest can apply binds. */
    onLocalValues?: (formKey: string, values: Record<string, string | number>) => void;
};
export declare function fieldKey(f: FormField): string;
export declare function fieldKind(f: FormField): NonNullable<FormField['kind']>;
export declare function FormView({ nodeKey, sessionId, props, onAction, onLocalValues }: Props): import("react").JSX.Element;
export {};
