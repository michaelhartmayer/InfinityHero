
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three-stdlib';
import { type WorldMap, TileType, type Player, type Item, type Monster } from '@vibemaster/shared';
import { VFXLibrary } from '../vfx/VFXLibrary';
import { CursorGroundEffect } from '../vfx/effects/CursorGroundEffect';
import { TilesetLoader } from './TilesetLoader';
import { SpriteLoader } from './SpriteLoader';

export const CursorState = {
    PASSIVE: 0,
    SELECT_TARGET: 1
} as const;
export type CursorState = typeof CursorState[keyof typeof CursorState];

export class GameRenderer {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;
    private mapGroup: THREE.Group;
    private playersGroup: THREE.Group;
    private itemsGroup: THREE.Group;
    private monstersGroup: THREE.Group;
    private playerMeshes: Map<string, THREE.Mesh> = new Map();
    private itemMeshes: Map<string, THREE.Mesh> = new Map();
    private monsterMeshes: Map<string, THREE.Mesh> = new Map();
    private localPlayerId: string | null = null;

    private raycaster = new THREE.Raycaster();
    private selectedMonsterId: string | null = null;
    private selectionMesh: THREE.Mesh;

    // Interpolation targets
    private playerTargets: Map<string, { x: number, y: number }> = new Map();
    private monsterTargets: Map<string, { x: number, y: number }> = new Map();

    private chatBubbles: Map<string, { element: CSS2DObject, startTime: number, duration: number }> = new Map();

    private highlightMesh: THREE.LineSegments;
    private labelRenderer: CSS2DRenderer;
    private vfxLibrary: VFXLibrary;
    private cursorGroundEffect: CursorGroundEffect;
    private cursorPosition: { x: number, y: number } | null = null;
    private tilesetLoader: TilesetLoader;
    private spriteLoader: SpriteLoader;
    private playerStates: Map<string, {
        facing: 'down' | 'left' | 'right' | 'up';
        isMoving: boolean;
        lastPosition: { x: number, y: number };
        animationTime: number;
    }> = new Map();
    private cursorState: CursorState = CursorState.PASSIVE;

    private currentMapData: WorldMap | null = null;
    private lastFrameTime: number = 0;
    private shadowTexture: THREE.Texture;

    constructor(canvas: HTMLCanvasElement, localPlayerId: string | null) {
        this.localPlayerId = localPlayerId;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x202020);

        // Orthographic camera for 2D top-down view
        const aspect = canvas.width / canvas.height;
        const frustumSize = 20;
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            1,
            1000
        );
        this.camera.position.set(0, 0, 10);
        this.camera.zoom = 1;
        this.camera.updateProjectionMatrix();

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(canvas.width, canvas.height);

        // CSS2D Renderer for labels
        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(canvas.width, canvas.height);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0px';
        this.labelRenderer.domElement.style.pointerEvents = 'none'; // Let clicks pass through
        canvas.parentElement?.appendChild(this.labelRenderer.domElement);

        this.mapGroup = new THREE.Group();
        this.playersGroup = new THREE.Group();
        this.itemsGroup = new THREE.Group();
        this.monstersGroup = new THREE.Group();
        this.scene.add(this.mapGroup);
        this.scene.add(this.itemsGroup);
        this.scene.add(this.monstersGroup);
        this.scene.add(this.playersGroup);

        // Highlight Mesh
        const highlightGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 0.1));
        const highlightMat = new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 2 });
        this.highlightMesh = new THREE.LineSegments(highlightGeo, highlightMat);
        this.highlightMesh.visible = false;
        this.scene.add(this.highlightMesh);

        // Selection Mesh (Red Circle)
        const selectionGeo = new THREE.RingGeometry(0.4, 0.5, 32);
        const selectionMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
        this.selectionMesh = new THREE.Mesh(selectionGeo, selectionMat);
        this.selectionMesh.rotation.x = -Math.PI / 2; // Flat on ground
        this.selectionMesh.visible = false;
        this.scene.add(this.selectionMesh);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(5, 10, 7);
        this.scene.add(dirLight);

        this.vfxLibrary = new VFXLibrary(this.renderer, this.scene, this.camera);

        // Cursor ground effect
        this.cursorGroundEffect = new CursorGroundEffect();
        this.scene.add(this.cursorGroundEffect.group);

        // Initialize loaders
        this.tilesetLoader = new TilesetLoader();
        this.spriteLoader = new SpriteLoader();
        this.loadAssets();

        // Create shadow texture
        this.shadowTexture = this.createShadowTexture();

        requestAnimationFrame(this.animate);
    }

    private createShadowTexture(): THREE.Texture {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;

        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)'); // Darker center
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    private async loadAssets() {
        await Promise.all([
            this.tilesetLoader.loadTileset(
                'grass',
                '/assets/tilesets/dev-tileset-grass.json',
                '/assets/tilesets/dev-tileset-grass.png'
            ),
            this.tilesetLoader.loadTileset(
                'stone',
                '/assets/tilesets/dev-tileset-stone.json',
                '/assets/tilesets/dev-tileset-stone.png'
            ),
            this.spriteLoader.loadSprite(
                'dev-rpg-characters-1',
                '/assets/sprites/dev-rpg-characters-1.json',
                '/assets/sprites/dev-rpg-characters-1.png'
            )
        ]);

        console.log('✅ Assets loaded successfully');

        // Re-render map if it was already loaded
        if (this.currentMapData) {
            console.log('🔄 Re-rendering map with loaded assets');
            this.renderMap(this.currentMapData);
        }

        // Clear existing player meshes to force re-creation with sprites
        console.log('🔄 Clearing player meshes to apply sprites');
        for (const mesh of this.playerMeshes.values()) {
            // Explicitly remove CSS2DObjects
            const label = mesh.children.find(c => c instanceof CSS2DObject);
            if (label) {
                mesh.remove(label);
            }
            this.playersGroup.remove(mesh);
        }
        this.playerMeshes.clear();
        this.playerStates.clear();
        this.playerTargets.clear();
        this.chatBubbles.clear();
    }

    public setCursorState(state: CursorState) {
        this.cursorState = state;

        // Immediate visibility update
        if (state === CursorState.PASSIVE) {
            this.cursorGroundEffect.group.visible = false;
            // highlightMesh visibility is handled in setHighlight/animate
        } else {
            this.highlightMesh.visible = false;
            // cursorGroundEffect visibility is handled in animate
        }
    }

    public setHighlight(x: number, y: number, map: WorldMap) {
        const offsetX = map.width / 2;
        const offsetY = map.height / 2;
        const worldX = x - offsetX;
        const worldY = y - offsetY;

        this.highlightMesh.position.set(worldX, worldY, 0.1);

        if (this.cursorState === CursorState.PASSIVE) {
            this.highlightMesh.visible = true;
        } else {
            this.highlightMesh.visible = false;
        }

        // Pulse effect
        const scale = 1 + Math.sin(Date.now() * 0.01) * 0.05;
        this.highlightMesh.scale.set(scale, scale, 1);

        // Store position for animation loop
        this.cursorPosition = { x: worldX, y: worldY };
    }

    public selectMonster(monsterId: string | null, monsters: Record<string, Monster>, map: WorldMap) {
        this.selectedMonsterId = monsterId;

        if (monsterId && monsters[monsterId]) {
            const monster = monsters[monsterId];
            const offsetX = map.width / 2;
            const offsetY = map.height / 2;

            this.selectionMesh.position.set(monster.position.x - offsetX, monster.position.y - offsetY, 0.1);
            this.selectionMesh.visible = true;
        } else {
            this.selectionMesh.visible = false;
        }
    }

    public pickMonster(x: number, y: number, width: number, height: number): string | null {
        // Convert screen to NDC
        const ndcX = (x / width) * 2 - 1;
        const ndcY = -(y / height) * 2 + 1;

        this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

        const intersects = this.raycaster.intersectObjects(this.monstersGroup.children, true);

        if (intersects.length > 0) {
            // Find the root mesh of the monster (parent of parts)
            let obj = intersects[0].object;
            while (obj.parent && obj.parent !== this.monstersGroup) {
                obj = obj.parent;
            }

            // Find ID from map
            for (const [id, mesh] of this.monsterMeshes) {
                if (mesh === obj) return id;
            }
        }
        return null;
    }

    public showChatBubble(playerId: string, message: string) {
        // Remove existing bubble for this player
        if (this.chatBubbles.has(playerId)) {
            const existing = this.chatBubbles.get(playerId)!;
            const mesh = this.playerMeshes.get(playerId);
            if (mesh) {
                mesh.remove(existing.element);
            }
            this.chatBubbles.delete(playerId);
        }

        const playerMesh = this.playerMeshes.get(playerId);
        if (!playerMesh) return;

        // Create wrapper for positioning
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-bubble-wrapper';

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.textContent = message;

        wrapper.appendChild(bubble);

        const label = new CSS2DObject(wrapper);
        label.position.set(0, 1.7, 0); // Above head
        playerMesh.add(label);

        this.chatBubbles.set(playerId, {
            element: label,
            startTime: Date.now(),
            duration: 5000 // 5 seconds
        });
    }

    public renderMap(map: WorldMap) {
        this.currentMapData = map; // Store for re-rendering after tilesets load
        this.mapGroup.clear();

        const grassTexture = this.tilesetLoader.getTexture('grass');
        const stoneTexture = this.tilesetLoader.getTexture('stone');

        if (!grassTexture || !stoneTexture) {
            console.warn('⚠️ Tilesets not loaded yet, using fallback colors');
            this.renderMapFallback(map);
            return;
        }

        console.log('🎨 Rendering map with textured tilesets');

        const offsetX = map.width / 2;
        const offsetY = map.height / 2;

        for (let x = 0; x < map.width; x++) {
            for (let y = 0; y < map.height; y++) {
                const tile = map.tiles[x][y];

                // Determine which tileset to use
                let texture: THREE.Texture;
                let tilesetName: string;
                let uvs: number[] | null = null;

                if (tile.tileset && tile.textureCoords) {
                    // Custom tileset from swatch
                    // Map tileset name to texture
                    if (tile.tileset.includes('grass')) {
                        texture = grassTexture;
                        tilesetName = 'grass';
                    } else if (tile.tileset.includes('stone')) {
                        texture = stoneTexture;
                        tilesetName = 'stone';
                    } else {
                        // Fallback
                        texture = grassTexture;
                        tilesetName = 'grass';
                    }

                    // Calculate UVs manually based on textureCoords
                    // We need to know the texture size.
                    // Assuming tilesetLoader stores texture dimensions or we can get them from texture.image
                    // But texture might not be fully loaded? It should be if we are here.

                    if (texture.image) {
                        const texWidth = (texture.image as HTMLImageElement).width;
                        const texHeight = (texture.image as HTMLImageElement).height;
                        const tX = tile.textureCoords.x;
                        const tY = tile.textureCoords.y;
                        // Assuming 32px grid size for now, or we need to know the swatch grid size.
                        // But we don't have swatch grid size here.
                        // However, we can assume standard tile size (e.g. 32 or 256 depending on tileset).
                        // The swatches.json says gridSize: 32 or 256.
                        // If we look at the texture coordinates, we can infer.
                        // For now, let's assume the tile size is implied by the UV mapping logic.
                        // Actually, we should probably fetch the tile size from the tileset definition if possible.
                        // But we don't have easy access to it here without querying TilesetLoader more deeply.

                        // Let's try to use a fixed size or infer from tileset name?
                        // 'dev-tileset-grass' seems to use 32px? No, swatches.json says 32.
                        // 'dev-tileset-stone' says 256.

                        let tileSize = tile.tileSize || 32;
                        if (!tile.tileSize && tilesetName === 'stone') tileSize = 256;

                        // UVs: [0,1], [1,1], [0,0], [1,0] (TopLeft, TopRight, BottomLeft, BottomRight) ?
                        // Three.js PlaneGeometry UVs are usually:
                        // (0, 1) top-left
                        // (1, 1) top-right
                        // (0, 0) bottom-left
                        // (1, 0) bottom-right
                        // Wait, PlaneGeometry(1,1) UVs:
                        // 0: (0, 1) - Top Left
                        // 1: (1, 1) - Top Right
                        // 2: (0, 0) - Bottom Left
                        // 3: (1, 0) - Bottom Right

                        // Texture Y is inverted in WebGL usually (0 is bottom).
                        // But our coords are likely top-down pixel coords.

                        const u0 = tX / texWidth;
                        const v1 = 1 - (tY / texHeight); // Top
                        const u1 = (tX + tileSize) / texWidth;
                        const v0 = 1 - ((tY + tileSize) / texHeight); // Bottom

                        // Standard UV order for PlaneGeometry is:
                        // (0, 1), (1, 1), (0, 0), (1, 0)
                        // wait, let's check standard.
                        // actually it's by vertex index.
                        // 0: -0.5, 0.5, 0 (Top Left) -> uv 0, 1
                        // 1: 0.5, 0.5, 0 (Top Right) -> uv 1, 1
                        // 2: -0.5, -0.5, 0 (Bottom Left) -> uv 0, 0
                        // 3: 0.5, -0.5, 0 (Bottom Right) -> uv 1, 0

                        uvs = [
                            u0, v1, // Top Left
                            u1, v1, // Top Right
                            u0, v0, // Bottom Left
                            u1, v0  // Bottom Right
                        ];
                    }

                } else {
                    // Standard tile generation
                    switch (tile.type) {
                        case TileType.GRASS:
                        case TileType.FLOOR:
                            texture = grassTexture;
                            tilesetName = 'grass';
                            break;
                        case TileType.WALL:
                        case TileType.WATER:
                            texture = stoneTexture;
                            tilesetName = 'stone';
                            break;
                        default:
                            texture = grassTexture;
                            tilesetName = 'grass';
                    }

                    // Get a random tile variant for variety
                    const randomTile = this.tilesetLoader.getRandomTile(tilesetName);
                    if (randomTile) {
                        uvs = this.tilesetLoader.getTileUVs(tilesetName, randomTile.id) || null;
                    }
                }

                if (!uvs) continue;

                // Create geometry with custom UVs
                const geometry = new THREE.PlaneGeometry(1, 1);
                const uvAttribute = new THREE.Float32BufferAttribute(uvs, 2);
                geometry.setAttribute('uv', uvAttribute);

                const material = new THREE.MeshStandardMaterial({
                    map: texture!,
                    side: THREE.FrontSide,
                    transparent: true, // Enable transparency for swatches
                    alphaTest: 0.5,
                    color: tile.color !== undefined ? tile.color : 0xffffff // Apply tint if present
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(x - offsetX, y - offsetY, 0);
                this.mapGroup.add(mesh);
            }
        }
    }

    private renderMapFallback(map: WorldMap) {
        const geometry = new THREE.PlaneGeometry(1, 1);
        const materials = {
            [TileType.GRASS]: new THREE.MeshStandardMaterial({ color: 0x4caf50 }),
            [TileType.WALL]: new THREE.MeshStandardMaterial({ color: 0x607d8b }),
            [TileType.WATER]: new THREE.MeshStandardMaterial({ color: 0x2196f3 }),
            [TileType.FLOOR]: new THREE.MeshStandardMaterial({ color: 0x795548 }),
        };

        const offsetX = map.width / 2;
        const offsetY = map.height / 2;

        for (let x = 0; x < map.width; x++) {
            for (let y = 0; y < map.height; y++) {
                const tile = map.tiles[x][y];
                const mesh = new THREE.Mesh(geometry, materials[tile.type]);
                mesh.position.set(x - offsetX, y - offsetY, 0);
                this.mapGroup.add(mesh);
            }
        }
    }

    public updatePlayers(players: Record<string, Player>, currentMap: WorldMap | null) {
        if (!currentMap) return;
        const offsetX = currentMap.width / 2;
        const offsetY = currentMap.height / 2;

        const activeIds = new Set(Object.keys(players));

        for (const [id, mesh] of this.playerMeshes) {
            if (!activeIds.has(id)) {
                this.playersGroup.remove(mesh);
                this.playerMeshes.delete(id);
                this.playerTargets.delete(id);
                this.chatBubbles.delete(id);
            }
        }

        for (const player of Object.values(players)) {
            let mesh = this.playerMeshes.get(player.id);
            if (!mesh) {
                const spriteId = 'dev-rpg-characters-1';
                const texture = this.spriteLoader.getTexture(spriteId);

                if (texture) {
                    // User requested 1.25 grid squares height
                    const geometry = new THREE.PlaneGeometry(1, 1.25);
                    const material = new THREE.MeshStandardMaterial({
                        map: texture,
                        transparent: true,
                        alphaTest: 0.5,
                        side: THREE.DoubleSide
                    });
                    mesh = new THREE.Mesh(geometry, material);

                    // Offset sprite to stand on ground (center is at 0,0, so move up by half height)
                    // But our map logic assumes z=0 is ground.
                    // The mesh position is set to x,y,0.
                    // If height is 1.25, we need to shift the geometry up so the feet are at 0.
                    // Actually, let's keep the mesh position logic and just offset the geometry or a child mesh.
                    // But here we are creating the mesh directly.
                    // Let's offset the geometry vertices or just adjust the mesh position in update loop?
                    // Adjusting geometry is cleaner for rotation/scaling.
                    geometry.translate(0, 0.125, 0); // Shift up by (1.25 - 1)/2 = 0.125? 
                    // No, if height is 1.25, center is at 0.625. Feet are at 0.
                    // If we want feet at -0.5 (relative to center 0), we need center at 0.125?
                    // Wait, standard 1x1 box has center at 0,0. Feet at -0.5.
                    // 1x1.25 plane has center at 0,0. Feet at -0.625.
                    // We want feet at -0.4 (shadow position) or just visually correct.
                    // Let's try shifting up by 0.125 to align center with 1x1 box center?
                    // Or better, let's just use the requested size.

                    // Initialize state
                    this.playerStates.set(player.id, {
                        facing: 'down',
                        isMoving: false,
                        lastPosition: { x: player.position.x, y: player.position.y },
                        animationTime: 0
                    });

                    // Initial UVs (Down frame 1 - middle)
                    const uvs = this.spriteLoader.getFrameUVs(spriteId, 1);
                    if (uvs) {
                        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                    }
                } else {
                    // Fallback geometry
                    const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
                    const material = new THREE.MeshStandardMaterial({ color: 0x9e9e9e });
                    mesh = new THREE.Mesh(geometry, material);

                    const headGeo = new THREE.SphereGeometry(0.25, 8, 8);
                    const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc80 });
                    const head = new THREE.Mesh(headGeo, headMat);
                    head.position.y = 0.6;
                    mesh.add(head);
                }

                if (player.id === this.localPlayerId) {
                    const ringGeo = new THREE.RingGeometry(0.4, 0.5, 32);
                    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
                    const ring = new THREE.Mesh(ringGeo, ringMat);
                    ring.rotation.x = -Math.PI / 2; // Flat on ground
                    // Adjust ring position for sprite (z is up/down in 3D, but here y is up/down on screen)
                    // Actually in this 2D setup, Z is depth.
                    // The ring should be behind the player.
                    ring.position.z = -0.1;
                    mesh.add(ring);
                }

                // Add Shadow
                const shadowGeo = new THREE.PlaneGeometry(0.8, 0.4);
                const shadowMat = new THREE.MeshBasicMaterial({
                    map: this.shadowTexture,
                    transparent: true,
                    depthWrite: false,
                    opacity: 0.6
                });
                const shadow = new THREE.Mesh(shadowGeo, shadowMat);
                shadow.position.y = -0.4; // Feet
                shadow.position.z = -0.2; // Behind
                mesh.add(shadow);

                // Add Name Label
                const div = document.createElement('div');
                div.className = 'player-label';
                div.textContent = player.name;
                const label = new CSS2DObject(div);
                label.position.set(0, 0.6, 0); // Above head
                mesh.add(label);

                this.playersGroup.add(mesh);
                this.playerMeshes.set(player.id, mesh);
            }

            // Update target position for interpolation
            const targetX = player.position.x - offsetX;
            const targetY = player.position.y - offsetY;

            // If this is a new player or distance is large (teleport), snap immediately
            if (!this.playerTargets.has(player.id)) {
                mesh.position.set(targetX, targetY, 0.4);
                this.playerTargets.set(player.id, { x: targetX, y: targetY });
            } else {
                const currentTarget = this.playerTargets.get(player.id)!;
                const dist = Math.sqrt(
                    Math.pow(currentTarget.x - targetX, 2) +
                    Math.pow(currentTarget.y - targetY, 2)
                );

                if (dist > 5) {
                    // Teleport
                    mesh.position.set(targetX, targetY, 0.4);
                    this.playerTargets.set(player.id, { x: targetX, y: targetY });
                } else {
                    // Update target for smooth interpolation in animate loop
                    this.playerTargets.set(player.id, { x: targetX, y: targetY });
                }
            }

            // Update player name label if it changed
            const nameLabel = mesh.children.find(child => child instanceof CSS2DObject) as CSS2DObject | undefined;
            if (nameLabel && nameLabel.element.textContent !== player.name) {
                nameLabel.element.textContent = player.name;
            }

            let healthBar = mesh.getObjectByName('healthBar') as THREE.Mesh;
            if (!healthBar) {
                const bgGeo = new THREE.PlaneGeometry(0.8, 0.1);
                const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
                const bgMesh = new THREE.Mesh(bgGeo, bgMat);
                bgMesh.position.set(0, 1.15, 0);

                const fgGeo = new THREE.PlaneGeometry(0.8, 0.1);
                const fgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                healthBar = new THREE.Mesh(fgGeo, fgMat);
                healthBar.name = 'healthBar';
                healthBar.position.z = 0.01;

                bgMesh.add(healthBar);
                mesh.add(bgMesh);
            }

            const healthPercent = Math.max(0, player.hp / player.maxHp);
            healthBar.scale.setX(healthPercent);
        }

        // Camera update is now handled in animate loop for smoother tracking
        /*
        if (localPlayer) {
            const targetX = localPlayer.position.x - offsetX;
            const targetY = localPlayer.position.y - offsetY;
    
            const lerpFactor = 0.1;
            this.camera.position.x += (targetX - this.camera.position.x) * lerpFactor;
            this.camera.position.y += (targetY - this.camera.position.y) * lerpFactor;
        }
        */
    }

    public updateItems(items: Record<string, Item>, mapData: WorldMap) {
        for (const [id, mesh] of this.itemMeshes) {
            if (!items[id]) {
                this.itemsGroup.remove(mesh);
                this.itemMeshes.delete(id);
            }
        }

        const offsetX = mapData.width / 2;
        const offsetY = mapData.height / 2;

        for (const item of Object.values(items)) {
            if (!this.itemMeshes.has(item.id)) {
                const geometry = new THREE.SphereGeometry(0.3, 8, 8);
                const material = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x444400 });
                const mesh = new THREE.Mesh(geometry, material);

                mesh.position.set(item.position.x - offsetX, item.position.y - offsetY, 0.3);

                this.itemsGroup.add(mesh);
                this.itemMeshes.set(item.id, mesh);
            }
        }
    }

    public updateMonsters(monsters: Record<string, Monster>, mapData: WorldMap) {
        for (const [id, mesh] of this.monsterMeshes) {
            if (!monsters[id]) {
                const label = mesh.getObjectByName('nameLabel');
                if (label) mesh.remove(label); // Cleanup label
                this.monstersGroup.remove(mesh);
                this.monsterMeshes.delete(id);
                this.monsterTargets.delete(id);

                if (this.selectedMonsterId === id) {
                    this.selectMonster(null, monsters, mapData);
                }
            }
        }

        const offsetX = mapData.width / 2;
        const offsetY = mapData.height / 2;

        for (const monster of Object.values(monsters)) {
            let mesh = this.monsterMeshes.get(monster.id);
            if (!mesh) {
                const geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
                const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
                mesh = new THREE.Mesh(geometry, material);

                // Add Shadow
                const shadowGeo = new THREE.PlaneGeometry(1.0, 0.5); // Squashed vertically
                const shadowMat = new THREE.MeshBasicMaterial({
                    map: this.shadowTexture,
                    transparent: true,
                    depthWrite: false,
                    opacity: 0.8
                });
                const shadow = new THREE.Mesh(shadowGeo, shadowMat);
                shadow.position.y = -0.3; // At the feet (South)
                shadow.position.z = -0.25; // Behind monster
                mesh.add(shadow);

                const bgGeo = new THREE.PlaneGeometry(0.6, 0.1);
                const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
                const bgMesh = new THREE.Mesh(bgGeo, bgMat);
                bgMesh.position.set(0, 0.7, 0);

                const fgGeo = new THREE.PlaneGeometry(0.6, 0.1);
                const fgMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                const healthBar = new THREE.Mesh(fgGeo, fgMat);
                healthBar.name = 'healthBar';
                healthBar.position.z = 0.01;

                bgMesh.add(healthBar);
                mesh.add(bgMesh);

                // Add Name Label
                const div = document.createElement('div');
                div.className = 'monster-label';
                div.textContent = `${monster.name} (Lvl ${monster.level})`;
                div.style.color = 'white';
                div.style.textShadow = '0 0 4px black';
                div.style.fontSize = '12px';
                div.style.fontWeight = 'bold';
                div.style.background = 'rgba(0,0,0,0.5)';
                div.style.padding = '2px 4px';
                div.style.borderRadius = '4px';

                const label = new CSS2DObject(div);
                label.position.set(0, 1.0, 0);
                label.name = 'nameLabel';
                mesh.add(label);

                this.monstersGroup.add(mesh);
                this.monsterMeshes.set(monster.id, mesh);
            }

            // Update target position for interpolation
            const targetX = monster.position.x - offsetX;
            const targetY = monster.position.y - offsetY;

            if (!this.monsterTargets.has(monster.id)) {
                mesh.position.set(targetX, targetY, 0.3);
                this.monsterTargets.set(monster.id, { x: targetX, y: targetY });
            } else {
                const currentTarget = this.monsterTargets.get(monster.id)!;
                const dist = Math.sqrt(
                    Math.pow(currentTarget.x - targetX, 2) +
                    Math.pow(currentTarget.y - targetY, 2)
                );

                if (dist > 5) {
                    mesh.position.set(targetX, targetY, 0.3);
                    this.monsterTargets.set(monster.id, { x: targetX, y: targetY });
                } else {
                    this.monsterTargets.set(monster.id, { x: targetX, y: targetY });
                }
            }

            const healthBar = mesh.getObjectByName('healthBar') as THREE.Mesh;
            if (healthBar) {
                const healthPercent = Math.max(0, monster.hp / monster.maxHp);
                healthBar.scale.setX(healthPercent);
            }

            // Update selection mesh position if this is the selected monster
            if (this.selectedMonsterId === monster.id) {
                this.selectionMesh.position.set(monster.position.x - offsetX, monster.position.y - offsetY, 0.1);
            }
        }
    }

    public screenToWorld(x: number, y: number, width: number, height: number, map: WorldMap): { x: number, y: number } | null {
        // Convert screen to NDC
        const ndcX = (x / width) * 2 - 1;
        const ndcY = -(y / height) * 2 + 1;

        // Get camera frustum dimensions
        const frustumWidth = this.camera.right - this.camera.left;
        const frustumHeight = this.camera.top - this.camera.bottom;

        // Convert NDC to camera space
        const camX = ndcX * (frustumWidth / 2);
        const camY = ndcY * (frustumHeight / 2);

        // Add camera position to get world space
        const worldX = (camX / this.camera.zoom) + this.camera.position.x;
        const worldY = (camY / this.camera.zoom) + this.camera.position.y;

        // Convert to map coordinates
        const offsetX = map.width / 2;
        const offsetY = map.height / 2;

        const mapX = Math.round(worldX + offsetX);
        const mapY = Math.round(worldY + offsetY);

        return { x: mapX, y: mapY };
    }

    public resize(width: number, height: number) {
        const aspect = width / height;
        const frustumSize = 20;

        this.camera.left = -frustumSize * aspect / 2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = -frustumSize / 2;

        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.labelRenderer.setSize(width, height);
        this.vfxLibrary.resize(width, height);
    }

    public onDebugUpdate: ((info: string) => void) | null = null;

    private updateAnimations(dt: number) {
        for (const [id, state] of this.playerStates) {
            const mesh = this.playerMeshes.get(id);
            if (!mesh) continue;

            // Calculate movement
            // Let's use mesh position delta
            const dx = mesh.position.x - state.lastPosition.x;
            const dy = mesh.position.y - state.lastPosition.y;

            const moved = Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001;
            state.isMoving = moved;

            if (moved) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    state.facing = dx > 0 ? 'right' : 'left';
                } else {
                    state.facing = dy > 0 ? 'up' : 'down';
                }
                state.animationTime += dt;
            } else {
                state.animationTime = 0;
            }

            state.lastPosition.x = mesh.position.x;
            state.lastPosition.y = mesh.position.y;

            // Update UVs
            const spriteId = 'dev-rpg-characters-1';
            const sprite = this.spriteLoader.getSprite(spriteId);
            if (sprite && sprite.animations) {
                const action = state.isMoving ? 'walk' : 'idle';
                const animName = `${action}_${state.facing}`;
                const anim = sprite.animations[animName];

                if (anim && anim.frames.length > 0) {
                    const totalFrames = anim.frames.length;
                    // Use modulo to loop
                    const frameIdx = Math.floor(state.animationTime * anim.frameRate) % totalFrames;
                    const frame = anim.frames[frameIdx];

                    const uvs = this.spriteLoader.getFrameUVs(spriteId, frame);
                    if (uvs) {
                        mesh.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                        mesh.geometry.attributes.uv.needsUpdate = true;

                        // Debug info for local player
                        if (id === this.localPlayerId && this.onDebugUpdate) {
                            this.onDebugUpdate(`Anim: ${animName} [${frameIdx}/${totalFrames}]`);
                        }
                    }
                }
            }
        }
    }

    private animate = (time: number) => {
        requestAnimationFrame(this.animate);

        const dt = Math.min((time - this.lastFrameTime) / 1000, 0.1); // Clamp dt to 100ms
        this.lastFrameTime = time;

        // Update animations
        this.updateAnimations(dt);

        // Interpolate positions
        const lerpFactor = 10 * dt; // Adjust for smoothness

        for (const [id, target] of this.playerTargets) {
            const mesh = this.playerMeshes.get(id);
            if (mesh) {
                mesh.position.x += (target.x - mesh.position.x) * lerpFactor;
                mesh.position.y += (target.y - mesh.position.y) * lerpFactor;
                // Z is constant
            }
        }

        for (const [id, target] of this.monsterTargets) {
            const mesh = this.monsterMeshes.get(id);
            if (mesh) {
                mesh.position.x += (target.x - mesh.position.x) * lerpFactor;
                mesh.position.y += (target.y - mesh.position.y) * lerpFactor;
            }
        }

        // Animate highlight
        if (this.highlightMesh.visible) {
            const scale = 1 + Math.sin(Date.now() * 0.005) * 0.05;
            this.highlightMesh.scale.set(scale, scale, 1);
        }

        // Animate cursor effect
        if (this.cursorPosition) {
            const showGroundEffect = this.cursorState === CursorState.SELECT_TARGET;
            this.cursorGroundEffect.update(this.cursorPosition.x, this.cursorPosition.y, showGroundEffect);
        }

        // Animate selection
        if (this.selectionMesh.visible) {
            this.selectionMesh.rotation.z += 0.02;
        }

        // Interpolate Players
        // Use a time-based lerp for frame-rate independence
        // factor = 1 - exp(-speed * dt)
        // Speed of 20 gives a quick but smooth response
        const entityLerpFactor = 1 - Math.exp(-20 * dt);

        for (const [id, mesh] of this.playerMeshes) {
            const target = this.playerTargets.get(id);
            if (target) {
                mesh.position.x += (target.x - mesh.position.x) * entityLerpFactor;
                mesh.position.y += (target.y - mesh.position.y) * entityLerpFactor;

                // Update camera if local player
                if (id === this.localPlayerId) {
                    // Camera follows slightly smoother/slower than the player to avoid jitter
                    const cameraLerpFactor = 1 - Math.exp(-5 * dt);
                    this.camera.position.x += (mesh.position.x - this.camera.position.x) * cameraLerpFactor;
                    this.camera.position.y += (mesh.position.y - this.camera.position.y) * cameraLerpFactor;
                }
            }
        }

        // Interpolate Monsters
        for (const [id, mesh] of this.monsterMeshes) {
            const target = this.monsterTargets.get(id);
            if (target) {
                mesh.position.x += (target.x - mesh.position.x) * entityLerpFactor;
                mesh.position.y += (target.y - mesh.position.y) * entityLerpFactor;

                // Update selection mesh if this is the selected monster
                if (this.selectedMonsterId === id) {
                    this.selectionMesh.position.set(mesh.position.x, mesh.position.y, 0.1);
                }
            }
        }

        // Check bubbles
        const now = Date.now();
        for (const [id, bubble] of this.chatBubbles) {
            if (now - bubble.startTime > bubble.duration) {
                const mesh = this.playerMeshes.get(id);
                if (mesh) {
                    mesh.remove(bubble.element);
                }
                this.chatBubbles.delete(id);
            }
        }

        this.vfxLibrary.render(dt);
        this.labelRenderer.render(this.scene, this.camera);
    }
}
