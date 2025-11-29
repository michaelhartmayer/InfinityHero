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
import { SwatchLoader } from './utils/SwatchLoader.js';
import { ClassDatabase } from './managers/ClassDatabase.js';
import { EffectDatabase } from './managers/EffectDatabase.js';
import { ScriptEngine } from './managers/ScriptEngine.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API Routes
app.get('/api/monsters', (req, res) => {
    res.json(monsterDatabase.getAllTemplates());
});

app.post('/api/monsters', (req, res) => {
    const template = req.body;
    monsterDatabase.updateTemplate(template);
    res.json({ success: true });
});

app.delete('/api/monsters/:id', (req, res) => {
    const { id } = req.params;
    monsterDatabase.deleteTemplate(id);
    res.json({ success: true });
});

app.get('/api/skills', (req, res) => {
    res.json(skillDatabase.getAllTemplates());
});

app.post('/api/skills', (req, res) => {
    const template = req.body;
    skillDatabase.updateTemplate(template);
    res.json({ success: true });
});

app.delete('/api/skills/:id', (req, res) => {
    const { id } = req.params;
    skillDatabase.deleteTemplate(id);
    res.json({ success: true });
});

app.get('/api/sprites', (req, res) => {
    res.json(spriteDatabase.getAllTemplates());
});

app.post('/api/sprites', (req, res) => {
    const template = req.body;
    spriteDatabase.updateTemplate(template);
    res.json({ success: true });
});

app.delete('/api/sprites/:id', (req, res) => {
    const { id } = req.params;
    spriteDatabase.deleteTemplate(id);
    res.json({ success: true });
});

app.get('/api/sprite-textures', (req, res) => {
    try {
        const spritesDir = path.join(process.cwd(), '../client/public/assets/sprites');
        if (!fs.existsSync(spritesDir)) {
            return res.json([]);
        }
        const files = fs.readdirSync(spritesDir);
        const textures = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.gif'));
        res.json(textures);
    } catch (error) {
        console.error('Error listing sprite textures:', error);
        res.status(500).json({ error: 'Failed to list sprite textures' });
    }
});

app.get('/api/classes', (req, res) => {
    classDatabase.reload();
    res.json(classDatabase.getAllTemplates());
});

app.post('/api/classes', (req, res) => {
    const template = req.body;
    classDatabase.updateTemplate(template);
    res.json({ success: true });
});

app.delete('/api/classes/:id', (req, res) => {
    const { id } = req.params;
    classDatabase.deleteTemplate(id);
    res.json({ success: true });
});

app.get('/api/effects', (req, res) => {
    res.json(effectDatabase.getAllTemplates());
});

app.post('/api/effects', (req, res) => {
    const template = req.body;
    effectDatabase.updateTemplate(template);
    res.json({ success: true });
});

app.delete('/api/effects/:id', (req, res) => {
    const { id } = req.params;
    effectDatabase.deleteTemplate(id);
    res.json({ success: true });
});

app.get('/api/active-map', (req, res) => {
    res.json({ id: worldManager.getMapData().id });
});

app.post('/api/active-map', (req, res) => {
    const { id } = req.body;
    try {
        console.log(`Switching active map to: ${id}`);
        worldManager.loadMap(id);

        // Respawn entities for new map
        entityManager.clearMonsters();
        entityManager.clearItems();

        const mapData = worldManager.getMapData();

        // Spawn monsters
        for (const monsterSpawn of mapData.monsterSpawns) {
            entityManager.spawnMonsterFromTemplate(
                monsterSpawn.monsterId,
                monsterSpawn.position
            );
        }

        // Spawn items
        if (mapData.itemSpawns) {
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
            }
        }

        // Notify all clients
        io.emit(EVENTS.MAP_DATA, worldManager.getMap());

        // Teleport all players to spawn points
        const players = Object.values(entityManager.getAllPlayers());
        for (const player of players) {
            const spawnPoint = MapLoader.getRandomSpawnPoint(mapData, 'player');
            entityManager.updatePlayerPosition(player.id, spawnPoint);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error switching map:', error);
        res.status(500).json({ error: 'Failed to switch map' });
    }
});

app.get('/api/maps', (req, res) => {
    res.json(MapLoader.listMaps());
});

app.get('/api/maps/:id', (req, res) => {
    try {
        const map = MapLoader.loadMap(req.params.id);
        res.json(map);
    } catch (error) {
        res.status(404).json({ error: 'Map not found' });
    }
});

app.post('/api/map', (req, res) => {
    try {
        const mapData = req.body;
        MapLoader.saveMap(mapData);

        // If this is the active map, reload it in WorldManager
        if (worldManager.getMapData().id === mapData.id) {
            console.log(`Reloading active map: ${mapData.id}`);
            worldManager.loadMap(mapData.id);
            // Notify all clients
            io.emit(EVENTS.MAP_DATA, worldManager.getMap());
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving map:', error);
        res.status(500).json({ error: 'Failed to save map' });
    }
});

app.delete('/api/maps/:id', (req, res) => {
    try {
        MapLoader.deleteMap(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete map' });
    }
});

// --- Swatches API ---
const SWATCHES_FILE = path.join(process.cwd(), '../databases/swatches.json');

app.get('/api/swatches', (req, res) => {
    try {
        if (!fs.existsSync(SWATCHES_FILE)) {
            return res.json([]);
        }
        const content = fs.readFileSync(SWATCHES_FILE, 'utf-8');
        res.json(JSON.parse(content));
    } catch (error) {
        console.error('Error reading swatches:', error);
        res.status(500).json({ error: 'Failed to read swatches' });
    }
});

app.post('/api/swatches', (req, res) => {
    try {
        const swatches = req.body;
        fs.writeFileSync(SWATCHES_FILE, JSON.stringify(swatches, null, 4));
        SwatchLoader.loadSwatches();
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving swatches:', error);
        res.status(500).json({ error: 'Failed to save swatches' });
    }
});

// --- Tileset API ---

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Assuming server is running from server/dist or similar, we need to go up to root then to client
// But simpler to rely on process.cwd() if we know where we run from.
// Let's assume process.cwd() is the 'server' directory as per package.json scripts.
const TILESETS_DIR = path.join(process.cwd(), '../client/public/assets/tilesets');

app.get('/api/tilesets', (req, res) => {
    try {
        if (!fs.existsSync(TILESETS_DIR)) {
            return res.json([]);
        }
        const files = fs.readdirSync(TILESETS_DIR);
        const tilesets = files
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
        res.json(tilesets);
    } catch (error) {
        console.error('Error listing tilesets:', error);
        res.status(500).json({ error: 'Failed to list tilesets' });
    }
});

app.get('/api/tilesets/:name', (req, res) => {
    try {
        const { name } = req.params;
        const filePath = path.join(TILESETS_DIR, `${name}.json`);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Tileset not found' });
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json(JSON.parse(content));
    } catch (error) {
        console.error('Error reading tileset:', error);
        res.status(500).json({ error: 'Failed to read tileset' });
    }
});

app.post('/api/tilesets/:name', (req, res) => {
    try {
        const { name } = req.params;
        const filePath = path.join(TILESETS_DIR, `${name}.json`);
        // Basic validation
        JSON.parse(JSON.stringify(req.body)); // Ensure valid JSON
        fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving tileset:', error);
        res.status(500).json({ error: 'Failed to save tileset' });
    }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const worldManager = new WorldManager('01_starting_zone');
const classDatabase = new ClassDatabase();
const monsterDatabase = new MonsterDatabase();
const entityManager = new EntityManager(classDatabase, monsterDatabase);
const skillDatabase = new SkillDatabase();
const spriteDatabase = new SpriteDatabase();
const effectDatabase = new EffectDatabase();
const scriptEngine = new ScriptEngine(entityManager, io);

app.get('/api/effects', (req, res) => {
    res.json(effectDatabase.getAllTemplates());
});
console.log('Initialized Class Database');
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
                                                spawnEffect: template.spawnEffect
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
                player.activeSkill = skillId;

                // Check if this is a self-cast skill - if so, execute immediately
                const skillTemplate = skillDatabase.getTemplate(skillId);
                if (skillTemplate && skillTemplate.target === 'self' && skillTemplate.script) {
                    // Execute the skill script immediately
                    const scriptEngine = new ScriptEngine(entityManager, io);
                    scriptEngine.execute(skillTemplate.script, {
                        self: player,
                        target: player,
                        trigger: 'ACTIVATE'
                    });
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
