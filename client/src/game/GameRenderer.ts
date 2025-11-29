import * as THREE from 'three';
import { type WorldMap, type Player, type Item, type Monster } from '@vibemaster/shared';
import { SpriteLoader, type SpriteData } from './SpriteLoader';
import { MapRenderer } from './subsystems/MapRenderer';
import { PlayerRenderer } from './subsystems/PlayerRenderer';
import { MonsterRenderer } from './subsystems/MonsterRenderer';
import { ItemRenderer } from './subsystems/ItemRenderer';
import { InteractionManager } from './subsystems/InteractionManager';
import { EffectRenderer, CursorState } from './subsystems/EffectRenderer';
import { UIRenderer } from './subsystems/UIRenderer';

export { CursorState };

export class GameRenderer {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;

    private spriteLoader: SpriteLoader;

    private mapRenderer: MapRenderer;
    private playerRenderer: PlayerRenderer;
    private monsterRenderer: MonsterRenderer;
    private itemRenderer: ItemRenderer;
    private interactionManager: InteractionManager;
    private effectRenderer: EffectRenderer;
    private uiRenderer: UIRenderer;

    private lastFrameTime: number = 0;
    private localPlayerPos: { x: number, y: number } | undefined;
    private localPlayerId: string | null;

    public onDebugUpdate: ((info: string) => void) | undefined;

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

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: false, // Performance optimization
            alpha: false, // We have a solid background color
            powerPreference: "high-performance"
        });
        this.renderer.setPixelRatio(1); // Force 1:1 pixel ratio for performance
        this.renderer.setSize(canvas.width, canvas.height);
        this.renderer.shadowMap.enabled = false; // Disable shadows for performance
        this.renderer.outputColorSpace = THREE.SRGBColorSpace; // Ensure correct sRGB output

        // Lighting - Removed for unlit/true-color rendering
        // const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        // this.scene.add(ambientLight);

        // const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        // dirLight.position.set(5, 10, 7);
        // this.scene.add(dirLight);

        // Initialize Loaders
        this.spriteLoader = new SpriteLoader();

        // Initialize Subsystems
        this.effectRenderer = new EffectRenderer(this.renderer, this.scene, this.camera);

        this.mapRenderer = new MapRenderer();
        this.scene.add(this.mapRenderer.group);

        this.playerRenderer = new PlayerRenderer(this.spriteLoader, this.effectRenderer.getShadowTexture(), localPlayerId);
        this.scene.add(this.playerRenderer.group);

        this.monsterRenderer = new MonsterRenderer(this.spriteLoader, this.effectRenderer.getShadowTexture(), this.effectRenderer);
        this.scene.add(this.monsterRenderer.group);

        this.itemRenderer = new ItemRenderer();
        this.scene.add(this.itemRenderer.group);

        this.interactionManager = new InteractionManager(this.camera, this.monsterRenderer);

        this.uiRenderer = new UIRenderer(canvas, this.playerRenderer, this.monsterRenderer);

        this.loadAssets();

        this.renderer.setAnimationLoop(this.animate);
    }

    private async loadAssets() {
        await Promise.all([
            this.mapRenderer.loadAssets(),
            // Dynamic sprite loading
            fetch('/api/sprites')
                .then(res => res.json())
                .then((sprites: SpriteData[]) => {
                    console.log('📦 Fetched ' + sprites.length + ' sprites from API');
                    const promises = sprites.map(sprite =>
                        this.spriteLoader.loadSpriteFromData(sprite)
                    );
                    return Promise.all(promises);
                })
                .catch(err => console.error('Failed to load sprites:', err))
        ]);

        console.log('✅ Assets loaded successfully');

        // Clear existing meshes to force re-creation with sprites
        console.log('🔄 Clearing meshes to apply sprites');
        this.playerRenderer.clear();
        this.monsterRenderer.clear();
        this.itemRenderer.clear();

        // Re-render map with loaded tilesets
        this.mapRenderer.reRender();
    }

    public setCursorState(state: CursorState) {
        this.effectRenderer.setCursorState(state);
    }

    public setHighlight(x: number, y: number, map: WorldMap) {
        this.effectRenderer.setHighlight(x, y, map);
    }

    public selectMonster(monsterId: string | null, monsters: Record<string, Monster>, map: WorldMap) {
        if (monsterId && monsters[monsterId]) {
            this.effectRenderer.setSelection(monsters[monsterId].position, map);
        } else {
            this.effectRenderer.setSelection(null, map);
        }
    }

    public pickMonster(x: number, y: number, width: number, height: number): string | null {
        return this.interactionManager.pickMonster(x, y, width, height);
    }

    public showChatBubble(playerId: string, message: string) {
        this.uiRenderer.showChatBubble(playerId, message);
    }

    public showDamage(targetId: string, damage: number, attackerId?: string) {
        this.uiRenderer.showDamage(targetId, damage, attackerId);
    }

    public renderMap(map: WorldMap) {
        this.mapRenderer.renderMap(map);
    }

    public updatePlayers(players: Record<string, Player>, currentMap: WorldMap | null) {
        this.playerRenderer.updatePlayers(players, currentMap);

        // Update local player position for audio calculations
        // Convert to world coordinates (same as monster positions)
        const localPlayer = players[this.localPlayerId || ''];
        if (localPlayer && currentMap) {
            const offsetX = currentMap.width / 2;
            const offsetY = currentMap.height / 2;
            this.localPlayerPos = {
                x: localPlayer.position.x - offsetX,
                y: localPlayer.position.y - offsetY
            };
        }
    }

    public updateItems(items: Record<string, Item>, mapData: WorldMap) {
        this.itemRenderer.updateItems(items, mapData);
    }

    public updateMonsters(monsters: Record<string, Monster>, mapData: WorldMap) {
        this.monsterRenderer.updateMonsters(monsters, mapData, this.localPlayerPos);
    }

    public screenToWorld(x: number, y: number, width: number, height: number, map: WorldMap): { x: number, y: number } | null {
        return this.interactionManager.screenToWorld(x, y, width, height, map);
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

        this.effectRenderer.resize(width, height);
        this.uiRenderer.resize(width, height);
    }

    private lastDrawCalls: number = 0;

    private animate = (time: number) => {
        const dt = Math.min((time - this.lastFrameTime) / 1000, 0.1); // Clamp dt to 100ms
        this.lastFrameTime = time;

        // Wrap the debug update callback to inject draw calls
        const wrappedDebugUpdate = this.onDebugUpdate ? (info: string) => {
            this.onDebugUpdate!(info + `\nDraw Calls: ${this.lastDrawCalls}`);
        } : undefined;

        this.playerRenderer.updateAnimations(dt, wrappedDebugUpdate);
        this.playerRenderer.interpolatePositions(dt);

        this.monsterRenderer.updateAnimations(dt);
        this.monsterRenderer.interpolatePositions(dt);

        this.effectRenderer.update(dt);
        this.uiRenderer.update();

        // Camera follow local player
        const localPlayerMesh = this.playerRenderer.getLocalPlayerMesh();
        if (localPlayerMesh) {
            const cameraLerpFactor = 1 - Math.exp(-5 * dt);
            this.camera.position.x += (localPlayerMesh.position.x - this.camera.position.x) * cameraLerpFactor;
            this.camera.position.y += (localPlayerMesh.position.y - this.camera.position.y) * cameraLerpFactor;
        }

        this.effectRenderer.render(dt);
        this.lastDrawCalls = this.renderer.info.render.calls;
        this.uiRenderer.render(this.scene, this.camera);
    }
}
