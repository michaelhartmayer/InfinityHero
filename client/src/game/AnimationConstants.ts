export const AnimationState = {
    IDLE: 'idle',
    WALK_LEFT: 'WALK_LEFT',
    WALK_RIGHT: 'WALK_RIGHT',
    WALK_UP: 'WALK_UP',
    WALK_DOWN: 'WALK_DOWN',
} as const;

export type AnimationStateValue = typeof AnimationState[keyof typeof AnimationState];
