type Content = {
    type: 'text';
    text: string;
};
export type PlainUserMessage = {
    id: string;
    role: 'user';
    source: {
        kind: string;
    };
    content: Content[];
};
/** Build a plain user-shaped message for agent.steer / followup / inject. */
export declare function buildUserMessage(text: string, sourceKind: string): PlainUserMessage;
export {};
