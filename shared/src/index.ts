export * from './chat.js';

export interface Position {
    x: number;
    y: number;
}

export interface Entity {
    id: string;
    type: 'player' | 'monster' | 'item';
    position: Position;
}

export interface Item extends Entity {
    type: 'item';
    name: string;
    description: string;
    icon: string;
}

export interface Player extends Entity {
    type: 'player';
    name: string;
    hp: number;
    maxHp: number;
    energy: number;
    maxEnergy: number;
    level: number;
    xp: number;
    class: 'WARRIOR' | 'MAGE' | 'ROGUE';
    inventory: Item[];
    moveTarget: Position | null; // Current target position (next node in path)
    movePath: Position[]; // Full path to destination
}

export enum MonsterStrategyType {
    PASSIVE = 'passive',
    SLEEPING = 'sleeping',
    AGGRESSIVE = 'aggressive'
}

export interface Monster extends Entity {
    type: 'monster';
    name: string;
    hp: number;
    maxHp: number;
    level: number;
    targetId: string | null;
    strategy: MonsterStrategyType;
    lastActionTime: number;
    moveTarget: Position | null;
    movePath: Position[];
}

export interface GameState {
    players: Record<string, Player>;
    items: Record<string, Item>;
    monsters: Record<string, Monster>;
}

export const EVENTS = {
    WELCOME: 'welcome',
    DISCONNECT: 'disconnect',
    PLAYER_JOIN: 'player_join',
    PLAYER_MOVE: 'player_move',
    STATE_UPDATE: 'state_update',
    MAP_DATA: 'map_data',
    CHAT_MESSAGE: 'chat_message',
    ATTACK: 'attack',
    PLAYER_DEATH: 'player_death',
    ITEM_PICKUP: 'item_pickup',
    ITEM_DROP: 'item_drop',
};

export const CONSTANTS = {
    TILE_SIZE: 1,
    MAP_WIDTH: 50,
    MAP_HEIGHT: 50,
    TICK_RATE: 60, // Increased from 20 to 60 for smoother movement
    MOVE_SPEED: 5 // Increased from 3 to 5 for faster pace
};

export enum TileType {
    GRASS = 0,
    WALL = 1,
    WATER = 2,
    FLOOR = 3,
}

export interface Tile {
    x: number;
    y: number;
    type: TileType;
    walkable: boolean;
}

export interface WorldMap {
    width: number;
    height: number;
    tiles: Tile[][];
}
