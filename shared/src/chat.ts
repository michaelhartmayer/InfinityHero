export interface ChatMessage {
    id: string;
    playerId: string;
    playerName: string;
    message: string;
    timestamp: number;
}

export interface BroadcastMessage {
    id: string;
    message: string;
    timestamp: number;
}
