import { useEffect, useState } from 'react';
import { applyOps } from '../ops/tree';
export function useIuiBridge(bridge) {
    const [roots, setRoots] = useState([]);
    useEffect(() => {
        if (!bridge)
            return;
        setRoots([]);
        return bridge.onOps((ops) => {
            setRoots((prev) => applyOps(prev, ops));
        });
    }, [bridge]);
    const emitAction = (ev) => {
        bridge?.emitAction(ev);
    };
    return {
        roots,
        sessionId: bridge?.sessionId ?? 'default',
        emitAction,
        reset: () => setRoots([]),
    };
}
