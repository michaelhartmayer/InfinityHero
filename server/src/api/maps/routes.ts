import { Router } from 'express';
import { Server } from 'socket.io';
import { EVENTS } from '@vibemaster/shared';
import { WorldManager } from '../../managers/WorldManager.js';
import { EntityManager } from '../../managers/EntityManager.js';
import { MapLoader } from '../../utils/MapLoader.js';

export const createMapRoutes = (worldManager: WorldManager, io: Server) => {
    const router = Router();

    router.get('/', (req, res) => {
        res.json(MapLoader.listMaps());
    });

    router.get('/:id', (req, res) => {
        try {
            const map = MapLoader.loadMap(req.params.id);
            res.json(map);
        } catch (error) {
            res.status(404).json({ error: 'Map not found' });
        }
    });

    router.post('/', (req, res) => {
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

    router.delete('/:id', (req, res) => {
        try {
            MapLoader.deleteMap(req.params.id);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete map' });
        }
    });

    return router;
};

export const createActiveMapRoutes = (worldManager: WorldManager, entityManager: EntityManager, io: Server) => {
    const router = Router();

    router.get('/', (req, res) => {
        res.json({ id: worldManager.getMapData().id });
    });

    router.post('/', (req, res) => {
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

    return router;
};
