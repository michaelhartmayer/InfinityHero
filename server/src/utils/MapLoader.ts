import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MapRegion {
    name: string;
    type: string;
    walkable: boolean;
    tileset: string;
    area: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export interface MapData {
    id: string;
    name: string;
    width: number;
    height: number;
    description: string;
    spawnPoints: Array<{ x: number; y: number; type: string }>;
    tiles: {
        default: {
            type: string;
            walkable: boolean;
            tileset: string;
        };
        regions: MapRegion[];
    };
    monsterSpawns: Array<{
        monsterId: string;
        position: { x: number; y: number };
        respawnTime: number;
    }>;
    itemSpawns: Array<{
        itemId: string;
        position: { x: number; y: number };
        respawnTime: number;
    }>;
    metadata: {
        difficulty: string;
        recommendedLevel: number;
        maxPlayers: number;
        theme: string;
        music?: string;
        ambientSound?: string;
    };
}

export class MapLoader {
    private static mapsCache: Map<string, MapData> = new Map();

    static loadMap(mapId: string): MapData {
        // Check cache first
        if (this.mapsCache.has(mapId)) {
            return this.mapsCache.get(mapId)!;
        }

        // Load from file
        const mapPath = path.join(__dirname, '..', '..', '..', 'databases', 'maps', `${mapId}.json`);

        if (!fs.existsSync(mapPath)) {
            throw new Error(`Map file not found: ${mapId}`);
        }

        const mapData: MapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

        // Validate map data
        if (!mapData.id || !mapData.width || !mapData.height) {
            throw new Error(`Invalid map data in ${mapId}`);
        }

        // Cache it
        this.mapsCache.set(mapId, mapData);

        console.log(`📍 Loaded map: ${mapData.name} (${mapData.width}x${mapData.height})`);

        return mapData;
    }

    static getRandomSpawnPoint(mapData: MapData, type: string = 'player'): { x: number; y: number } {
        const spawnPoints = mapData.spawnPoints.filter(sp => sp.type === type);

        if (spawnPoints.length === 0) {
            // Fallback to center if no spawn points defined
            return {
                x: Math.floor(mapData.width / 2),
                y: Math.floor(mapData.height / 2)
            };
        }

        const randomIndex = Math.floor(Math.random() * spawnPoints.length);
        return {
            x: spawnPoints[randomIndex].x,
            y: spawnPoints[randomIndex].y
        };
    }

    static saveMap(mapData: MapData): void {
        const mapId = mapData.id;
        const mapPath = path.join(__dirname, '..', '..', '..', 'databases', 'maps', `${mapId}.json`);

        try {
            fs.writeFileSync(mapPath, JSON.stringify(mapData, null, 4));
            // Update cache
            this.mapsCache.set(mapId, mapData);
            console.log(`Saved map: ${mapData.name}`);
        } catch (error) {
            console.error(`Failed to save map ${mapId}:`, error);
            throw error;
        }
    }

    static clearCache(): void {
        this.mapsCache.clear();
    }
}
