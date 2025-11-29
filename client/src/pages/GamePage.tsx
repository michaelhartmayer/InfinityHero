import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { EVENTS, type WorldMap, type Player, type GameState, type ChatMessage, type BroadcastMessage, type Item, type Monster } from '@vibemaster/shared';
import { GameCanvas } from '../components/GameCanvas';
import { ChatWindow } from '../components/ChatWindow';
import { Inventory } from '../components/Inventory';
import { HUD } from '../components/HUD';
import { BottomBar } from '../components/BottomBar';
import { BroadcastOverlay } from '../components/BroadcastOverlay';
import { DebugPanel } from '../components/DebugPanel';
import { ClassSelector } from '../components/ClassSelector';
import { AudioManager } from '../game/AudioManager';
import '../App.css';

export function GamePage() {
    const [socket, setSocket] = useState<Socket | null>(null);

    const [mapData, setMapData] = useState<WorldMap | null>(null);
    const [players, setPlayers] = useState<Record<string, Player>>({});
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [items, setItems] = useState<Record<string, Item>>({});
    const [monsters, setMonsters] = useState<Record<string, Monster>>({});
    const [broadcastMessage, setBroadcastMessage] = useState<BroadcastMessage | null>(null);
    const [lastAttackEvent, setLastAttackEvent] = useState<{ attackerId: string, targetId: string, damage: number } | null>(null);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        // Connect to Socket.IO via Vite proxy (no need to specify port)
        console.log('Connecting to server...');
        const newSocket = io();
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to server');
            const savedAlias = localStorage.getItem('player_alias');
            if (savedAlias) {
                console.log('Restoring saved alias:', savedAlias);
                newSocket.emit(EVENTS.CHAT_MESSAGE, `/alias ${savedAlias}`);
            }
        });

        newSocket.on('disconnect', () => {
            console.log('Disconnected from server');
        });

        newSocket.on(EVENTS.WELCOME, (data: any) => {
            console.log('Server says:', data.message);
        });

        newSocket.on(EVENTS.MAP_DATA, (data: WorldMap) => {
            console.log('Map data received:', data);
            setMapData(data);

            // Handle music
            if (data.music) {
                AudioManager.getInstance().playMusic(data.music.url, data.music.volume, data.music.loop);
            } else {
                AudioManager.getInstance().stopMusic();
            }
        });

        newSocket.on(EVENTS.STATE_UPDATE, (state: GameState) => {
            setPlayers(state.players);
            if (state.items) {
                setItems(state.items);
            }
            if (state.monsters) {
                setMonsters(state.monsters);
            }
        });

        newSocket.on(EVENTS.CHAT_MESSAGE, (message: ChatMessage) => {
            setMessages((prev) => [...prev, message]);
        });

        newSocket.on(EVENTS.ATTACK, (data: any) => {
            console.log('Attack:', data);
            setLastAttackEvent(data);
        });

        newSocket.on(EVENTS.PLAYER_DEATH, (data: any) => {
            console.log('Player died:', data);
        });

        newSocket.on(EVENTS.BROADCAST_MESSAGE, (message: BroadcastMessage) => {
            setBroadcastMessage(message);
        });

        newSocket.on(EVENTS.COMMAND_HELP, (data: { commands: string[] }) => {
            console.log('Received help commands:', data);
            // Display help commands in chat
            const helpMessage: ChatMessage = {
                id: Math.random().toString(36).substr(2, 9),
                playerId: 'system',
                playerName: 'System',
                message: 'Available commands:\n' + data.commands.join('\n'),
                timestamp: Date.now()
            };
            setMessages((prev) => [...prev, helpMessage]);
        });

        return () => {
            newSocket.close();
        };
    }, []);

    const handleMove = (x: number, y: number) => {
        console.log('handleMove called:', x, y);
        if (socket) {
            console.log('Socket connected, processing move...');

            const localPlayer = socket.id ? players[socket.id] : null;

            // Don't move if clicking on self
            if (localPlayer && Math.round(localPlayer.position.x) === x && Math.round(localPlayer.position.y) === y) {
                console.log('Clicked on self, ignoring');
                return;
            }

            // Check for item pickup
            for (const item of Object.values(items)) {
                if (Math.round(item.position.x) === x && Math.round(item.position.y) === y) {
                    console.log('Clicking on item:', item.id);
                    socket.emit(EVENTS.ITEM_PICKUP, item.id);
                    // We can also move there? For now just pickup if clicked.
                    // If we want to move AND pickup, we should emit move too.
                    // But let's keep it simple: click item = try to pickup.
                    // If too far, server ignores.
                    // Maybe we should move to it?
                    socket.emit(EVENTS.PLAYER_MOVE, { x, y }); // Move to item
                    return;
                }
            }

            // Check if clicking on a player to attack
            // This is a naive check, ideally we'd check if the click target is an entity
            // For now, let's just say right click is attack, left click is move?
            // Or we can check if there's a player at x,y

            // Let's assume for MVP: Left click = Move.
            // To attack, we need a way to select a target.
            // Let's iterate players to see if we clicked one.

            let targetId = null;
            for (const [id, p] of Object.entries(players)) {
                if (id === socket.id) continue; // Don't attack self
                if (Math.round(p.position.x) === x && Math.round(p.position.y) === y) {
                    targetId = id;
                    break;
                }
            }

            // Check monsters
            if (!targetId) {
                for (const [id, m] of Object.entries(monsters)) {
                    if (Math.round(m.position.x) === x && Math.round(m.position.y) === y) {
                        targetId = id;
                        break;
                    }
                }
            }

            if (targetId) {
                console.log('Attacking target:', targetId);
                socket.emit(EVENTS.ATTACK, targetId);
            } else {
                console.log('Moving to:', x, y);
                socket.emit(EVENTS.PLAYER_MOVE, { x, y });
            }
        } else {
            console.log('No socket connection!');
        }
    };



    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [isChatMode, setIsChatMode] = useState(false);
    const [debugInfo, setDebugInfo] = useState<string>('');

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input or textarea
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                // If we want to allow Escape to exit chat mode:
                if (e.key === 'Escape') {
                    setIsChatMode(false);
                    // We also need to blur, which is handled by the effect in ChatWindow dependent on isChatMode
                }
                return;
            }

            // Don't process keys if inventory is open (except 'i' to close it)
            if (isInventoryOpen && e.key.toLowerCase() !== 'i') {
                return;
            }

            if (e.key.toLowerCase() === 'i') {
                e.preventDefault();
                setIsInventoryOpen(prev => !prev);
            }

            if (e.key === 'Enter' && !isChatMode) {
                e.preventDefault();
                setIsChatMode(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isInventoryOpen, isChatMode]);

    const handleSendMessage = (message: string) => {
        // Client-side fallback for help command
        if (message.trim().toLowerCase() === '/help') {
            const helpMessage: ChatMessage = {
                id: Math.random().toString(36).substr(2, 9),
                playerId: 'system',
                playerName: 'System',
                message: 'Available commands:\n/help - Lists all available commands\n/alias [name] - Changes your character name\n/respawn - Respawns you at the starting location\n/spawn [monster id] [quantity] - Spawns monsters around you\n/broadcast [message] - Sends a broadcast message to all players',
                timestamp: Date.now()
            };
            setMessages((prev) => [...prev, helpMessage]);
            setIsChatMode(false);
            return;
        }

        // Save alias to local storage if command is used
        if (message.trim().toLowerCase().startsWith('/alias ')) {
            const parts = message.trim().split(' ');
            if (parts.length > 1) {
                const newName = parts.slice(1).join(' ').substring(0, 20);
                localStorage.setItem('player_alias', newName);
            }
        }

        if (socket) {
            socket.emit(EVENTS.CHAT_MESSAGE, message);
            setIsChatMode(false);
        }
    };

    const localPlayer = socket?.id ? players[socket.id] : undefined;

    const [isDebugVisible, setIsDebugVisible] = useState(false);
    const [isClassSelectorOpen, setIsClassSelectorOpen] = useState(false);

    const handleClassSelect = (classId: string) => {
        if (socket) {
            socket.emit(EVENTS.PLAYER_CHANGE_CLASS, classId);
        }
    };

    return (
        <div className="App">
            <div className="ui-layer">
                {socket?.id && isDebugVisible && <DebugPanel sessionId={socket.id} animationInfo={debugInfo} />}
                {socket && socket.id && mapData && players[socket.id] && (
                    <>
                        <HUD player={players[socket.id]} />
                        <div className="center-ui">
                            <BroadcastOverlay message={broadcastMessage} />
                        </div>

                        <div className="bottom-ui">
                            <ChatWindow messages={messages} onSendMessage={handleSendMessage} isChatMode={isChatMode} onSetChatMode={setIsChatMode} />
                            <BottomBar
                                onToggleInventory={() => setIsInventoryOpen(!isInventoryOpen)}
                                skills={localPlayer?.skills}
                                activeSkill={localPlayer?.activeSkill}
                                isMuted={isMuted}
                                onToggleMute={() => {
                                    const newMuted = AudioManager.getInstance().toggleMute();
                                    setIsMuted(newMuted);
                                }}
                                onToggleDebug={() => setIsDebugVisible(!isDebugVisible)}
                                onToggleClassSelector={() => setIsClassSelectorOpen(!isClassSelectorOpen)}
                            />
                        </div>
                    </>
                )}

                {localPlayer && (
                    <>
                        <Inventory
                            items={localPlayer.inventory || []}
                            isOpen={isInventoryOpen}
                            onClose={() => setIsInventoryOpen(false)}
                            onItemClick={(item) => console.log('Clicked item:', item)}
                        />
                        {isClassSelectorOpen && (
                            <ClassSelector
                                currentClassId={localPlayer.class}
                                onSelectClass={handleClassSelect}
                                onClose={() => setIsClassSelectorOpen(false)}
                            />
                        )}
                    </>
                )}
            </div>

            <div id="game-container">
                <GameCanvas
                    mapData={mapData}
                    players={players}
                    items={items}
                    monsters={monsters}
                    localPlayerId={socket?.id || null}
                    lastMessage={messages.length > 0 ? messages[messages.length - 1] : null}
                    lastAttackEvent={lastAttackEvent}
                    onMove={handleMove}
                    onAttack={(targetId) => {
                        if (socket) {
                            socket.emit(EVENTS.ATTACK, targetId);
                        }
                    }}
                    onDebugUpdate={setDebugInfo}
                />
            </div>
        </div>
    );
}
