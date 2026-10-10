import { jsx as _jsx } from "react/jsx-runtime";
import { IuiForest } from '../components/Node';
import { useIuiBridge } from './useIuiBridge';
import '../components/styles.css';
/** Bind a HostBridge to the whitelist component tree. */
export function IuiMount({ bridge }) {
    const { roots, sessionId, emitAction } = useIuiBridge(bridge);
    return _jsx(IuiForest, { roots: roots, sessionId: sessionId, onAction: emitAction });
}
