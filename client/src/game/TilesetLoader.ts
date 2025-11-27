import * as THREE from 'three';

export interface TilesetTile {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
    properties: {
        walkable: boolean;
        variant: string;
    };
}

export interface TilesetData {
    texture: string;
    imageWidth: number;
    imageHeight: number;
    tileSize: number;
    tiles: TilesetTile[];
}

export class TilesetLoader {
    private tilesets: Map<string, TilesetData> = new Map();
    private textures: Map<string, THREE.Texture> = new Map();
    private textureLoader = new THREE.TextureLoader();

    async loadTileset(name: string, jsonPath: string, texturePath: string): Promise<void> {
        try {
            // Load JSON data
            const response = await fetch(jsonPath);
            const data: TilesetData = await response.json();
            this.tilesets.set(name, data);

            // Load texture
            const texture = await this.loadTexture(texturePath);
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            this.textures.set(name, texture);

            console.log(`Loaded tileset: ${name}`);
        } catch (error) {
            console.error(`Failed to load tileset ${name}:`, error);
        }
    }

    private loadTexture(path: string): Promise<THREE.Texture> {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                path,
                (texture) => {
                    // Wait for the image to be fully loaded
                    if (texture.image && texture.image.complete) {
                        resolve(texture);
                    } else if (texture.image) {
                        texture.image.onload = () => resolve(texture);
                        texture.image.onerror = () => reject(new Error(`Failed to load image: ${path}`));
                    } else {
                        // Fallback: wait a bit and check again
                        setTimeout(() => {
                            if (texture.image && texture.image.complete) {
                                resolve(texture);
                            } else {
                                reject(new Error(`Texture image not available: ${path}`));
                            }
                        }, 100);
                    }
                },
                undefined,
                (error) => reject(error)
            );
        });
    }

    getTileset(name: string): TilesetData | undefined {
        return this.tilesets.get(name);
    }

    getTexture(name: string): THREE.Texture | undefined {
        return this.textures.get(name);
    }

    // Get a random tile from a tileset
    getRandomTile(name: string): TilesetTile | undefined {
        const tileset = this.tilesets.get(name);
        if (!tileset) return undefined;

        const randomIndex = Math.floor(Math.random() * tileset.tiles.length);
        return tileset.tiles[randomIndex];
    }

    // Get a specific tile by ID
    getTileById(name: string, id: number): TilesetTile | undefined {
        const tileset = this.tilesets.get(name);
        if (!tileset) return undefined;

        return tileset.tiles.find(tile => tile.id === id);
    }

    // Create UV coordinates for a tile
    getTileUVs(tilesetName: string, tileId: number): number[] | undefined {
        const tileset = this.tilesets.get(tilesetName);
        if (!tileset) return undefined;

        const tile = tileset.tiles.find(t => t.id === tileId);
        if (!tile) return undefined;

        const { imageWidth, imageHeight } = tileset;

        // Calculate UV coordinates (normalized 0-1)
        const u1 = tile.x / imageWidth;
        const v1 = 1 - (tile.y / imageHeight); // Flip V coordinate
        const u2 = (tile.x + tile.width) / imageWidth;
        const v2 = 1 - ((tile.y + tile.height) / imageHeight); // Flip V coordinate

        // Return UVs for a quad (two triangles)
        // Bottom-left, bottom-right, top-left, top-right
        return [
            u1, v2,  // bottom-left
            u2, v2,  // bottom-right
            u1, v1,  // top-left
            u2, v1   // top-right
        ];
    }
}
