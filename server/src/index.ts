import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { EVENTS, MonsterStrategyType } from '@vibemaster/shared';

import { WorldManager } from './managers/WorldManager.js';
import { EntityManager } from './managers/EntityManager.js';
import { MonsterDatabase } from './managers/MonsterDatabase.js';
import { SkillDatabase } from './managers/SkillDatabase.js';
import { GameLoop } from './GameLoop.js';
import { SpriteDatabase } from './managers/SpriteDatabase.js';
import { MapLoader } from './utils/MapLoader.js';
import { ClassDatabase } from './managers/ClassDatabase.js';
import { EffectDatabase } from './managers/EffectDatabase.js';
import { ScriptEngine } from './managers/ScriptEngine.js';

// API Routes
import { createMonsterRoutes } from './api/monsters/routes.js';
import { createSkillRoutes } from './api/skills/routes.js';
import { createSpriteRoutes, createSpriteTextureRoutes } from './api/sprites/routes.js';
import { createClassRoutes } from './api/classes/routes.js';
import { createEffectRoutes } from './api/effects/routes.js';
import { createMapRoutes, createActiveMapRoutes } from './api/maps/routes.js';
import { createSwatchRoutes } from './api/swatches/routes.js';
import { createTilesetRoutes } from './api/tilesets/routes.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Initialize Managers
const worldManager = new WorldManager('01_starting_zone');
const classDatabase = new ClassDatabase();
const monsterDatabase = new MonsterDatabase();
const entityManager = new EntityManager(classDatabase, monsterDatabase);
const skillDatabase = new SkillDatabase();
const spriteDatabase = new SpriteDatabase();
const effectDatabase = new EffectDatabase();
const scriptEngine = new ScriptEngine(entityManager, io);

console.log('Initialized Class Database');

// Register API Routes
app.use('/api/monsters', createMonsterRoutes(monsterDatabase, entityManager));
app.use('/api/skills', createSkillRoutes(skillDatabase));
app.use('/api/sprites', createSpriteRoutes(spriteDatabase));
app.use('/api/sprite-textures', createSpriteTextureRoutes());
app.use('/api/classes', createClassRoutes(classDatabase));
app.use('/api/effects', createEffectRoutes(effectDatabase));
app.use('/api/maps', createMapRoutes(worldManager, io));
app.use('/api/active-map', createActiveMapRoutes(worldManager, entityManager, io));
app.use('/api/swatches', createSwatchRoutes());
app.use('/api/tilesets', createTilesetRoutes());

const gameLoop = new GameLoop(io, entityManager, worldManager, skillDatabase, scriptEngine);

// Get map data for spawning
const mapData = worldManager.getMapData();

// Spawn monsters from map data
console.log(`\n🗺️  Spawning entities from map: ${mapData.name}`);
for (const monsterSpawn of mapData.monsterSpawns) {
    const monster = entityManager.spawnMonsterFromTemplate(
        monsterSpawn.monsterId,
        monsterSpawn.position
    );
    if (monster) {
        console.log(`  ✓ ${monster.name} spawned at (${monster.position.x}, ${monster.position.y})`);
    }
}

// Spawn items from map data (for now, just log them since we need item templates)
for (const itemSpawn of mapData.itemSpawns) {
    const item: any = {
        id: `item_${itemSpawn.itemId}_${Date.now()}`,
        type: 'item',
        name: 'Health Potion', // TODO: Load from item database
        description: 'Restores 50 HP',
        icon: '🧪',
        position: itemSpawn.position
    };
    entityManager.addItem(item);
    console.log(`  ✓ ${item.name} spawned at (${item.position.x}, ${item.position.y})`);
}

console.log(`\n✅ Map loaded with ${mapData.monsterSpawns.length} monsters and ${mapData.itemSpawns.length} items\n`);

gameLoop.start();

io.on('connection', (socket) => {
    try {
        console.log('User connected:', socket.id);

        // Get a random spawn point from the map
        const spawnPoint = MapLoader.getRandomSpawnPoint(mapData, 'player');
        const player = entityManager.addPlayer(
            socket.id,
            `Player ${socket.id.substring(0, 4)}`,
            spawnPoint
        );

        socket.emit(EVENTS.WELCOME, { message: 'Welcome to VibeMaster!', playerId: socket.id, player });
        socket.emit(EVENTS.MAP_DATA, worldManager.getMap());

        // Debug: Log all incoming events
        socket.onAny((eventName, ...args) => {
            console.log('Received event:', eventName, 'with args:', args);
        });

        socket.on(EVENTS.PLAYER_MOVE, (target: { x: number, y: number }) => {
            console.log(`Player ${socket.id.substring(0, 4)} moving to:`, target);
            const player = entityManager.getPlayer(socket.id);
            if (player) {
                const map = worldManager.getMap();
                if (target.x >= 0 && target.x < map.width && target.y >= 0 && target.y < map.height) {
                    const tile = map.tiles[target.x][target.y];
                    console.log(`[DEBUG] Target tile (${target.x}, ${target.y}): type=${tile.type}, walkable=${tile.walkable}`);
                }
                // Clear attack target on manual move
                player.targetId = null;

                // Calculate path from current position to target
                const path = worldManager.findPath(
                    player.position.x,
                    player.position.y,
                    target.x,
                    target.y,
                    (x, y) => entityManager.isPositionOccupied(x, y, player.id)
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
                                                strategy: MonsterStrategyType.PASSIVE,
                                                sprite: template.sprite,
                                                spawnEffect: template.spawnEffect,
                                                xpReward: template.xpReward
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

                        case 'debug_xp':
                            player.xp += 50;
                            socket.emit(EVENTS.CHAT_MESSAGE, {
                                id: Math.random().toString(36).substr(2, 9),
                                playerId: 'system',
                                playerName: 'System',
                                message: `Debug: Added 50 XP. Total: ${player.xp}`,
                                timestamp: Date.now()
                            });
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
                // Set target for auto-attacking
                attacker.targetId = targetId;

                const dx = attacker.position.x - target.position.x;
                const dy = attacker.position.y - target.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Get active skill range
                const skillId = attacker.activeSkill || 'melee';
                const skillTemplate = skillDatabase.getTemplate(skillId);
                const range = skillTemplate ? skillTemplate.range : 0;
                const attackRange = range + 1.5;

                // If out of range, start moving towards target
                if (dist > attackRange) {
                    const dest = worldManager.findNearestWalkableTile(
                        target.position.x,
                        target.position.y,
                        attacker.position.x,
                        attacker.position.y,
                        (x, y) => entityManager.isPositionOccupied(x, y, attacker.id)
                    );

                    if (dest) {
                        const path = worldManager.findPath(
                            attacker.position.x,
                            attacker.position.y,
                            dest.x,
                            dest.y,
                            (x, y) => entityManager.isPositionOccupied(x, y, attacker.id)
                        );

                        if (path.length > 0) {
                            entityManager.setMovePath(attacker.id, path);
                        }
                    }
                }
                // If in range, the GameLoop will handle the attack execution
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

        socket.on(EVENTS.PLAYER_CHANGE_CLASS, (classId: string) => {
            const success = entityManager.changePlayerClass(socket.id, classId);
            if (success) {
                const player = entityManager.getPlayer(socket.id);
                socket.emit(EVENTS.CHAT_MESSAGE, {
                    id: Math.random().toString(36).substr(2, 9),
                    playerId: 'system',
                    playerName: 'System',
                    message: `You have changed your class to ${classId}`,
                    timestamp: Date.now()
                });
                // Force state update immediately
                io.emit(EVENTS.STATE_UPDATE, {
                    players: entityManager.getAllPlayers(),
                    items: entityManager.getAllItems(),
                    monsters: entityManager.getAllMonsters()
                });
            }
        });

        socket.on(EVENTS.PLAYER_SET_ACTIVE_SKILL, (skillId: string) => {
            const player = entityManager.getPlayer(socket.id);
            if (player && player.skills.includes(skillId)) {
                const skillTemplate = skillDatabase.getTemplate(skillId);

                if (skillTemplate) {
                    // Handle based on skill type
                    if (skillTemplate.target === 'self' || skillTemplate.target === 'passive') {
                        // Self and passive skills: execute immediately, don't change activeSkill
                        if (skillTemplate.script) {
                            // Check cooldown first
                            if (scriptEngine.isOnCooldown(socket.id, skillId)) {
                                socket.emit(EVENTS.CHAT_MESSAGE, {
                                    id: Math.random().toString(36).substr(2, 9),
                                    playerId: 'system',
                                    playerName: 'System',
                                    message: `Skill ${skillTemplate.name} is on cooldown!`,
                                    timestamp: Date.now()
                                });
                                return;
                            }

                            // Execute the skill script
                            scriptEngine.execute(skillTemplate.script, {
                                self: player,
                                target: player,
                                trigger: 'ACTIVATE',
                                skillId: skillId
                            });
                        }
                        // Don't change activeSkill for self/passive
                    } else {
                        // Auto-target and target skills: set as active skill
                        player.activeSkill = skillId;
                    }
                }

                // Notify player
                io.emit(EVENTS.STATE_UPDATE, {
                    players: entityManager.getAllPlayers(),
                    items: entityManager.getAllItems(),
                    monsters: entityManager.getAllMonsters()
                });
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
