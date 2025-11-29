import { WorldMap, Tile, TileType, CONSTANTS } from '@vibemaster/shared';
import { MapLoader, type MapData } from '../utils/MapLoader.js';
import { SwatchLoader } from '../utils/SwatchLoader.js';

export class WorldManager {
    private map!: WorldMap;
    private mapData!: MapData;

    constructor(mapId: string = '01_starting_zone') {
        this.loadMap(mapId);
    }

    public loadMap(mapId: string) {
        this.mapData = MapLoader.loadMap(mapId);
        this.map = this.generateMapFromData(this.mapData);
    }

    private generateMapFromData(mapData: MapData): WorldMap {
        const width = mapData.width;
        const height = mapData.height;
        const tiles: Tile[][] = [];

        // Helper to convert string type to TileType enum
        const getTileType = (typeStr: string): TileType => {
            switch (typeStr.toUpperCase()) {
                case 'GRASS': return TileType.GRASS;
                case 'WALL': return TileType.WALL;
                case 'WATER': return TileType.WATER;
                case 'FLOOR': return TileType.FLOOR;
                default: return TileType.GRASS;
            }
        };

        // Initialize with default tiles
        const defaultType = getTileType(mapData.tiles.default.type);
        const defaultWalkable = mapData.tiles.default.walkable;

        for (let x = 0; x < width; x++) {
            tiles[x] = [];
            for (let y = 0; y < height; y++) {
                tiles[x][y] = {
                    x,
                    y,
                    type: defaultType,
                    walkable: defaultWalkable
                };
            }
        }

        // Apply regions
        for (const region of mapData.tiles.regions) {
            const regionType = getTileType(region.type);
            const { x: startX, y: startY, width: w, height: h } = region.area;

            for (let dx = 0; dx < w; dx++) {
                for (let dy = 0; dy < h; dy++) {
                    const x = startX + dx;
                    const y = startY + dy;

                    if (x >= 0 && x < width && y >= 0 && y < height) {
                        tiles[x][y] = {
                            x,
                            y,
                            type: regionType,
                            walkable: region.walkable
                        };
                    }
                }
            }
        }

        // Apply placed swatches
        if (mapData.placedSwatches) {
            for (const placement of mapData.placedSwatches) {
                const swatch = SwatchLoader.getSwatch(placement.swatchId);
                if (!swatch) continue;

                // Assuming the first tile in the swatch is the anchor (0,0 relative)
                // But swatch.tiles contains texture coordinates.
                // We need to map the swatch tiles to the world grid.
                // The swatch definition doesn't explicitly say "this tile is at 0,0, that one is at 1,0".
                // However, based on the texture coordinates and grid size, we can infer the relative layout.
                // BUT, the current Swatch structure in swatches.json is just a list of tiles.
                // It seems the intention is that the tiles in the list correspond to a spatial arrangement?
                // Or maybe we should assume the texture layout matches the spatial layout?
                // Let's assume the texture coordinates relative to the top-left of the bounding box of the swatch tiles
                // correspond to the spatial coordinates.

                // Check for new single-tile placement format
                if (placement.tileIdx !== undefined) {
                    const t = swatch.tiles[placement.tileIdx];
                    if (!t) continue;

                    const worldX = Math.round(placement.x / 32);
                    const worldY = Math.round(placement.y / 32);

                    if (worldX >= 0 && worldX < width && worldY >= 0 && worldY < height) {
                        tiles[worldX][worldY] = {
                            x: worldX,
                            y: worldY,
                            type: TileType.FLOOR,
                            walkable: swatch.properties?.walkable ?? true,
                            tileset: swatch.tileset,
                            textureCoords: { x: t.x, y: t.y },
                            color: swatch.color,
                            tileSize: swatch.gridSize
                        };
                    }
                    continue;
                }

                // Legacy: Full swatch placement logic
                // Find bounding box of tiles in texture space
                let minTx = Infinity, minTy = Infinity;
                for (const t of swatch.tiles) {
                    minTx = Math.min(minTx, t.x);
                    minTy = Math.min(minTy, t.y);
                }

                for (const t of swatch.tiles) {
                    // Calculate relative grid position
                    // We assume 1 tile in world = swatch.gridSize in texture
                    const relX = (t.x - minTx) / swatch.gridSize;
                    const relY = (t.y - minTy) / swatch.gridSize;

                    const worldX = Math.round(placement.x / 32) + relX;
                    const worldY = Math.round(placement.y / 32) + relY;

                    if (worldX >= 0 && worldX < width && worldY >= 0 && worldY < height) {
                        // Update tile
                        tiles[worldX][worldY] = {
                            x: worldX,
                            y: worldY,
                            type: TileType.FLOOR, // Default to floor for swatches? Or keep underlying type?
                            // Ideally we should have a 'custom' type or override rendering
                            walkable: swatch.properties?.walkable ?? true,
                            tileset: swatch.tileset,
                            textureCoords: { x: t.x, y: t.y },
                            color: swatch.color,
                            tileSize: swatch.gridSize
                        };
                    }
                }
            }
        }

        return {
            width,
            height,
            tiles,
            music: mapData.music
        };
    }

    public getMapData(): MapData {
        return this.mapData;
    }

    public getMap(): WorldMap {
        return this.map;
    }

    public isWalkable(x: number, y: number, isOccupied?: (x: number, y: number) => boolean): boolean {
        const rx = Math.round(x);
        const ry = Math.round(y);
        if (rx < 0 || rx >= this.map.width || ry < 0 || ry >= this.map.height) {
            return false;
        }
        const tile = this.map.tiles[rx][ry];

        // Check tile walkability (includes swatches)
        if (!tile.walkable) return false;

        // Fallback for legacy types if walkable property isn't set correctly (though it should be)
        if (tile.type === TileType.WALL || tile.type === TileType.WATER) return false;

        if (isOccupied && isOccupied(rx, ry)) {
            return false;
        }
        return true;
    }

    public findPath(startX: number, startY: number, endX: number, endY: number, isOccupied?: (x: number, y: number) => boolean): { x: number, y: number }[] {
        const rEndX = Math.round(endX);
        const rEndY = Math.round(endY);

        // Simple BFS for pathfinding
        if (!this.isWalkable(rEndX, rEndY, isOccupied)) return [];

        const startNode = { x: Math.round(startX), y: Math.round(startY), parent: null as any };
        const queue = [startNode];
        const visited = new Set<string>();
        visited.add(`${startNode.x},${startNode.y}`);

        let foundNode = null;
        let iterations = 0;

        while (queue.length > 0 && iterations < 1000) {
            iterations++;
            const current = queue.shift()!;

            if (current.x === rEndX && current.y === rEndY) {
                foundNode = current;
                break;
            }

            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 },
                { x: current.x, y: current.y - 1 },
                // Diagonals
                { x: current.x + 1, y: current.y + 1 },
                { x: current.x - 1, y: current.y - 1 },
                { x: current.x + 1, y: current.y - 1 },
                { x: current.x - 1, y: current.y + 1 }
            ];

            for (const neighbor of neighbors) {
                const key = `${neighbor.x},${neighbor.y}`;

                // Check bounds and walkability
                if (!visited.has(key) && this.isWalkable(neighbor.x, neighbor.y, isOccupied)) {
                    // Prevent corner cutting for diagonals
                    // If moving diagonally, check if the two adjacent cardinal tiles are walkable
                    const dx = neighbor.x - current.x;
                    const dy = neighbor.y - current.y;

                    if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
                        if (!this.isWalkable(current.x + dx, current.y, isOccupied) || !this.isWalkable(current.x, current.y + dy, isOccupied)) {
                            continue; // Corner is blocked
                        }
                    }

                    visited.add(key);
                    queue.push({ x: neighbor.x, y: neighbor.y, parent: current });
                }
            }
        }

        if (foundNode) {
            const path = [];
            let curr = foundNode;
            while (curr.parent) {
                path.unshift({ x: curr.x, y: curr.y });
                curr = curr.parent;
            }
            return path;
        }

        return [];
    }
    public findNearestWalkableTile(targetX: number, targetY: number, startX: number, startY: number, isOccupied?: (x: number, y: number) => boolean): { x: number, y: number } | null {
        const rTargetX = Math.round(targetX);
        const rTargetY = Math.round(targetY);

        // If target itself is walkable, return it
        if (this.isWalkable(rTargetX, rTargetY, isOccupied)) {
            return { x: rTargetX, y: rTargetY };
        }

        // Check neighbors in expanding rings
        // For now, just check immediate neighbors (radius 1)
        // We want the one closest to startX, startY
        const neighbors = [
            { x: rTargetX + 1, y: rTargetY },
            { x: rTargetX - 1, y: rTargetY },
            { x: rTargetX, y: rTargetY + 1 },
            { x: rTargetX, y: rTargetY - 1 },
            { x: rTargetX + 1, y: rTargetY + 1 },
            { x: rTargetX - 1, y: rTargetY - 1 },
            { x: rTargetX + 1, y: rTargetY - 1 },
            { x: rTargetX - 1, y: rTargetY + 1 }
        ];

        let bestTile = null;
        let minDist = Infinity;

        for (const tile of neighbors) {
            if (this.isWalkable(tile.x, tile.y, isOccupied)) {
                const dx = tile.x - startX;
                const dy = tile.y - startY;
                const dist = dx * dx + dy * dy;

                if (dist < minDist) {
                    minDist = dist;
                    bestTile = tile;
                }
            }
        }

        return bestTile;
    }
}
