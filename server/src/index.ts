import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { EVENTS, MonsterStrategyType } from '@vibemaster/shared';

import { WorldManager } from './managers/WorldManager.js';
import { EntityManager } from './managers/EntityManager.js';
import { MonsterDatabase } from './managers/MonsterDatabase.js';
import { GameLoop } from './GameLoop.js';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const worldManager = new WorldManager();
const entityManager = new EntityManager();
const monsterDatabase = new MonsterDatabase();
const gameLoop = new GameLoop(io, entityManager, worldManager);

// Spawn some random items
for (let i = 0; i < 10; i++) {
    const item: any = {
        id: `item_${i}`,
        type: 'item',
        name: 'Health Potion',
        description: 'Restores 50 HP',
        icon: '🧪',
        position: {
            x: Math.floor(Math.random() * 40) + 5,
            y: Math.floor(Math.random() * 40) + 5
        }
    };
    entityManager.addItem(item);
}

// Spawn monsters from database
for (let i = 0; i < 10; i++) {
    const template = monsterDatabase.getRandomTemplate();
    if (template) {
        const monster = entityManager.addMonster(
            `monster_${i}`,
            template.name,
            Math.floor(Math.random() * 40) + 5,
            Math.floor(Math.random() * 40) + 5,
            {
                hp: template.hp,
                level: template.baseLevel,
                strategy: MonsterStrategyType.PASSIVE
            }
        );
        console.log(`Spawned ${monster.name} (Level ${monster.level}) at (${monster.position.x}, ${monster.position.y})`);
    }
}

gameLoop.start();

io.on('connection', (socket) => {
    try {
        console.log('User connected:', socket.id);

        const player = entityManager.addPlayer(socket.id, `Player ${socket.id.substring(0, 4)}`);

        socket.emit(EVENTS.WELCOME, { message: 'Welcome to VibeMaster!', playerId: socket.id });
        socket.emit(EVENTS.MAP_DATA, worldManager.getMap());

        // Debug: Log all incoming events
        socket.onAny((eventName, ...args) => {
            console.log('Received event:', eventName, 'with args:', args);
        });

        socket.on(EVENTS.PLAYER_MOVE, (target: { x: number, y: number }) => {
            console.log(`Player ${socket.id.substring(0, 4)} moving to:`, target);
            const player = entityManager.getPlayer(socket.id);
            if (player) {
                // Calculate path from current position to target
                const obstacles = entityManager.getOccupiedPositions(socket.id);
                const path = worldManager.findPath(
                    player.position.x,
                    player.position.y,
                    target.x,
                    target.y,
                    obstacles
                );

                if (path.length > 0) {
                    console.log(`  -> Path found! Length: ${path.length}`);
                    entityManager.setMovePath(socket.id, path);
                } else {
                    console.log('  -> No path found or target unreachable');
                }
            }
        });

        socket.on(EVENTS.CHAT_MESSAGE, (message: string) => {
            const player = entityManager.getPlayer(socket.id);
            if (player) {
                // Check if it's a slash command
                if (message.startsWith('/')) {
                    const parts = message.slice(1).split(' ');
                    const command = parts[0].toLowerCase();
                    const args = parts.slice(1);

                    switch (command) {
                        case 'help':
                            socket.emit(EVENTS.COMMAND_HELP, {
                                commands: [
                                    '/help - Lists all available commands',
                                    '/alias [name] - Changes your character name',
                                    '/respawn - Respawns you at the starting location',
                                    '/spawn [monster id] [quantity] - Spawns monsters around you',
                                    '/broadcast [message] - Sends a broadcast message to all players'
                                ]
                            });
                            break;

                        case 'alias':
                            if (args.length === 0) {
                                socket.emit(EVENTS.CHAT_MESSAGE, {
                                    id: Math.random().toString(36).substr(2, 9),
                                    playerId: 'system',
                                    playerName: 'System',
                                    message: 'Usage: /alias [name]',
                                    timestamp: Date.now()
                                });
                            } else {
                                const newName = args.join(' ').substring(0, 20);
                                entityManager.setPlayerName(socket.id, newName);
                                socket.emit(EVENTS.CHAT_MESSAGE, {
                                    id: Math.random().toString(36).substr(2, 9),
                                    playerId: 'system',
                                    playerName: 'System',
                                    message: `Your name has been changed to: ${newName}`,
                                    timestamp: Date.now()
                                });
                            }
                            break;

                        case 'respawn':
                            entityManager.respawnPlayer(socket.id);
                            socket.emit(EVENTS.CHAT_MESSAGE, {
                                id: Math.random().toString(36).substr(2, 9),
                                playerId: 'system',
                                playerName: 'System',
                                message: 'You have been respawned!',
                                timestamp: Date.now()
                            });
                            break;

                        case 'spawn':
                            if (args.length === 0) {
                                socket.emit(EVENTS.CHAT_MESSAGE, {
                                    id: Math.random().toString(36).substr(2, 9),
                                    playerId: 'system',
                                    playerName: 'System',
                                    message: 'Usage: /spawn [monster id] [quantity]',
                                    timestamp: Date.now()
                                });
                            } else {
                                const monsterId = args[0];
                                const quantity = args.length > 1 ? parseInt(args[1]) : 1;
                                const template = monsterDatabase.getTemplate(monsterId);

                                if (!template) {
                                    socket.emit(EVENTS.CHAT_MESSAGE, {
                                        id: Math.random().toString(36).substr(2, 9),
                                        playerId: 'system',
                                        playerName: 'System',
                                        message: `Monster ID "${monsterId}" not found in database`,
                                        timestamp: Date.now()
                                    });
                                } else {
                                    const spawnCount = Math.min(Math.max(1, quantity), 10); // Limit to 10
                                    for (let i = 0; i < spawnCount; i++) {
                                        const offsetX = Math.floor(Math.random() * 5) - 2;
                                        const offsetY = Math.floor(Math.random() * 5) - 2;
                                        const spawnX = Math.max(1, Math.min(49, player.position.x + offsetX));
                                        const spawnY = Math.max(1, Math.min(49, player.position.y + offsetY));

                                        entityManager.addMonster(
                                            `monster_${Date.now()}_${i}`,
                                            template.name,
                                            spawnX,
                                            spawnY,
                                            {
                                                hp: template.hp,
                                                level: template.baseLevel,
                                                strategy: MonsterStrategyType.PASSIVE
                                            }
                                        );
                                    }
                                    socket.emit(EVENTS.CHAT_MESSAGE, {
                                        id: Math.random().toString(36).substr(2, 9),
                                        playerId: 'system',
                                        playerName: 'System',
                                        message: `Spawned ${spawnCount} ${template.name}(s) around you`,
                                        timestamp: Date.now()
                                    });
                                }
                            }
                            break;

                        case 'broadcast':
                            if (args.length === 0) {
                                socket.emit(EVENTS.CHAT_MESSAGE, {
                                    id: Math.random().toString(36).substr(2, 9),
                                    playerId: 'system',
                                    playerName: 'System',
                                    message: 'Usage: /broadcast [message]',
                                    timestamp: Date.now()
                                });
                            } else {
                                const broadcastMsg = args.join(' ').substring(0, 200);
                                io.emit(EVENTS.BROADCAST_MESSAGE, {
                                    id: Math.random().toString(36).substr(2, 9),
                                    message: broadcastMsg,
                                    timestamp: Date.now()
                                });
                            }
                            break;

                        default:
                            socket.emit(EVENTS.CHAT_MESSAGE, {
                                id: Math.random().toString(36).substr(2, 9),
                                playerId: 'system',
                                playerName: 'System',
                                message: `Unknown command: /${command}. Type /help for a list of commands.`,
                                timestamp: Date.now()
                            });
                    }
                } else {
                    // Regular chat message
                    const chatMessage = {
                        id: Math.random().toString(36).substr(2, 9),
                        playerId: player.id,
                        playerName: player.name,
                        message: message.substring(0, 200),
                        timestamp: Date.now()
                    };
                    io.emit(EVENTS.CHAT_MESSAGE, chatMessage);
                }
            }
        });

        socket.on(EVENTS.ATTACK, (targetId: string) => {
            const attacker = entityManager.getPlayer(socket.id);
            let target: any = entityManager.getPlayer(targetId);
            if (!target) {
                target = entityManager.getMonster(targetId);
            }

            if (attacker && target) {
                const dx = attacker.position.x - target.position.x;
                const dy = attacker.position.y - target.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= 2) {
                    const isDead = entityManager.applyDamage(targetId, 10, attacker.id);
                    io.emit(EVENTS.ATTACK, { attackerId: attacker.id, targetId: target.id, damage: 10 });

                    if (isDead) {
                        io.emit(EVENTS.PLAYER_DEATH, { playerId: target.id });
                        if (target.type === 'player') {
                            entityManager.respawnPlayer(target.id);
                        } else {
                            entityManager.removeMonster(target.id);
                        }
                    }
                }
            }
        });

        socket.on(EVENTS.ITEM_PICKUP, (itemId: string) => {
            const player = entityManager.getPlayer(socket.id);
            const item = entityManager.getItem(itemId);

            if (player && item) {
                const dx = player.position.x - item.position.x;
                const dy = player.position.y - item.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= 1.5) {
                    entityManager.removeItem(itemId);
                    player.inventory.push(item);
                }
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            entityManager.removePlayer(socket.id);
        });
    } catch (error) {
        console.error('Error in connection handler:', error);
    }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
