import * as THREE from 'three';
import { type WorldMap, TileType } from '@vibemaster/shared';
import { TilesetLoader } from '../TilesetLoader';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export class MapRenderer {
    public group: THREE.Group;
    private tilesGroup: THREE.Group;
    private collisionGroup: THREE.Group;
    private tilesetLoader: TilesetLoader;
    private currentMapData: WorldMap | null = null;
    private isCollisionVisible: boolean = false;

    constructor() {
        this.group = new THREE.Group();
        this.tilesGroup = new THREE.Group();
        this.collisionGroup = new THREE.Group();
        this.collisionGroup.visible = false;

        this.group.add(this.tilesGroup);
        this.group.add(this.collisionGroup);

        this.tilesetLoader = new TilesetLoader();
    }

    public async loadAssets() {
        try {
            // Fetch list of available tilesets
            const res = await fetch('/api/tilesets');
            const tilesetIds: string[] = await res.json();

            console.log('📦 Loading tilesets:', tilesetIds);

            await Promise.all(tilesetIds.map(async (id) => {
                try {
                    // Fetch metadata to get texture filename
                    const metaRes = await fetch(`/api/tilesets/${id}`);
                    const meta = await metaRes.json();

                    await this.tilesetLoader.loadTileset(
                        id,
                        `/assets/tilesets/${id}.json`,
                        `/assets/tilesets/${meta.texture}`
                    );
                } catch (err) {
                    console.error(`Failed to load tileset ${id}:`, err);
                }
            }));

        } catch (e) {
            console.error("Failed to load tileset list:", e);
            // Fallback for dev/offline
            await Promise.all([
                this.tilesetLoader.loadTileset(
                    'dev-tileset-grass',
                    '/assets/tilesets/dev-tileset-grass.json',
                    '/assets/tilesets/dev-tileset-grass.png'
                ),
                this.tilesetLoader.loadTileset(
                    'dev-tileset-stone',
                    '/assets/tilesets/dev-tileset-stone.json',
                    '/assets/tilesets/dev-tileset-stone.png'
                )
            ]);
        }
    }

    public renderMap(map: WorldMap) {
        this.currentMapData = map;
        this.tilesGroup.clear();

        console.log('🎨 Rendering map with dynamic tilesets (Optimized v3)');

        const offsetX = map.width / 2;
        const offsetY = map.height / 2;

        // Group geometries by texture UUID/path to merge them later
        const geometriesByTexture: Map<string, THREE.PlaneGeometry[]> = new Map();
        const textureCache: Map<string, THREE.Texture> = new Map();

        for (let x = 0; x < map.width; x++) {
            for (let y = 0; y < map.height; y++) {
                const tile = map.tiles[x][y];

                let texture: THREE.Texture | undefined;
                let tilesetName: string | undefined;
                let uvs: number[] | null = null;

                // 1. Try to get texture from tile.tileset
                if (tile.tileset) {
                    texture = this.tilesetLoader.getTexture(tile.tileset);
                    tilesetName = tile.tileset;

                    // Legacy Fallback: 'grass' -> 'dev-tileset-grass'
                    if (!texture) {
                        if (tile.tileset === 'grass' || tile.tileset.includes('grass')) {
                            tilesetName = 'dev-tileset-grass';
                            texture = this.tilesetLoader.getTexture(tilesetName);
                        } else if (tile.tileset === 'stone' || tile.tileset.includes('stone')) {
                            tilesetName = 'dev-tileset-stone';
                            texture = this.tilesetLoader.getTexture(tilesetName);
                        }
                    }
                }

                // 2. Calculate UVs if we have a texture and coords
                if (texture && tile.textureCoords && tilesetName) {
                    if (texture.image) {
                        const texWidth = (texture.image as HTMLImageElement).width;
                        const texHeight = (texture.image as HTMLImageElement).height;
                        const tX = tile.textureCoords.x;
                        const tY = tile.textureCoords.y;

                        let tileSize = tile.tileSize || 32;
                        // Legacy hack for stone tileset size if needed
                        if (!tile.tileSize && tilesetName.includes('stone')) tileSize = 256;

                        const u0 = tX / texWidth;
                        const v1 = 1 - (tY / texHeight);
                        const u1 = (tX + tileSize) / texWidth;
                        const v0 = 1 - ((tY + tileSize) / texHeight);

                        uvs = [
                            u0, v1, // Top Left
                            u1, v1, // Top Right
                            u0, v0, // Bottom Left
                            u1, v0  // Bottom Right
                        ];
                    }
                } else {
                    // 3. Fallback / Default Tile Logic
                    if (!tilesetName || !texture) {
                        switch (tile.type) {
                            case TileType.WALL:
                            case TileType.WATER:
                                tilesetName = 'dev-tileset-stone';
                                break;
                            default:
                                tilesetName = 'dev-tileset-grass';
                        }
                        texture = this.tilesetLoader.getTexture(tilesetName);
                    }

                    if (tilesetName && texture) {
                        const randomTile = this.tilesetLoader.getRandomTile(tilesetName);
                        if (randomTile) {
                            uvs = this.tilesetLoader.getTileUVs(tilesetName, randomTile.id) || null;
                        }
                    }
                }

                if (!uvs || !texture || !tilesetName) continue;

                // Store texture for later use
                if (!textureCache.has(tilesetName)) {
                    textureCache.set(tilesetName, texture);
                }

                const geometry = new THREE.PlaneGeometry(1, 1);
                const uvAttribute = new THREE.Float32BufferAttribute(uvs, 2);
                geometry.setAttribute('uv', uvAttribute);

                // Translate geometry to correct position immediately
                // Invert Y axis: map[0][0] should be at top-left
                geometry.translate(x - offsetX, (map.height - 1 - y) - offsetY, 0);

                if (!geometriesByTexture.has(tilesetName)) {
                    geometriesByTexture.set(tilesetName, []);
                }
                geometriesByTexture.get(tilesetName)!.push(geometry);
            }
        }

        // Determine merge function
        // @ts-ignore
        const mergeFn = BufferGeometryUtils.mergeGeometries;

        if (!mergeFn) {
            console.error('❌ BufferGeometryUtils.mergeGeometries not found! Map will not render.');
            console.log('BufferGeometryUtils exports:', BufferGeometryUtils);
            return;
        }

        // Merge and create meshes
        for (const [tilesetName, geometries] of geometriesByTexture) {
            if (geometries.length === 0) continue;

            const texture = textureCache.get(tilesetName);
            if (!texture) continue;

            try {
                const mergedGeometry = mergeFn(geometries);

                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.FrontSide,
                    transparent: true,
                    alphaTest: 0.5
                });

                const mesh = new THREE.Mesh(mergedGeometry, material);
                this.tilesGroup.add(mesh);
                console.log(`✅ Merged ${geometries.length} tiles for ${tilesetName}`);
            } catch (e) {
                console.error(`❌ Failed to merge geometries for ${tilesetName}:`, e);
            }
        }
    }

    public getTilesetLoader(): TilesetLoader {
        return this.tilesetLoader;
    }

    public reRender() {
        if (this.currentMapData) {
            console.log('🔄 Re-rendering map with loaded assets');
            this.renderMap(this.currentMapData);
            // Re-render collision overlay if it was visible or just clear it so it regenerates next time
            this.collisionGroup.clear();
            if (this.isCollisionVisible) {
                this.renderCollisionOverlay();
            }
        }
    }

    public toggleCollisionView(show: boolean) {
        this.isCollisionVisible = show;
        this.collisionGroup.visible = show;
        if (show && this.collisionGroup.children.length === 0 && this.currentMapData) {
            this.renderCollisionOverlay();
        }
    }

    private renderCollisionOverlay() {
        if (!this.currentMapData) return;
        this.collisionGroup.clear();

        const map = this.currentMapData;
        const offsetX = map.width / 2;
        const offsetY = map.height / 2;

        const geometries: THREE.PlaneGeometry[] = [];

        for (let x = 0; x < map.width; x++) {
            for (let y = 0; y < map.height; y++) {
                const tile = map.tiles[x][y];
                if (!tile.walkable) {
                    const geometry = new THREE.PlaneGeometry(1, 1);
                    // Invert Y axis: map[0][0] should be at top-left
                    geometry.translate(x - offsetX, (map.height - 1 - y) - offsetY, 0);
                    geometries.push(geometry);
                }
            }
        }

        if (geometries.length > 0) {
            // @ts-ignore
            const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
            const material = new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.5,
                side: THREE.FrontSide
            });
            const mesh = new THREE.Mesh(mergedGeometry, material);
            mesh.position.z = 0.01; // Slightly above map
            this.collisionGroup.add(mesh);
            console.log(`✅ Rendered collision overlay with ${geometries.length} tiles`);
        }
    }
}
