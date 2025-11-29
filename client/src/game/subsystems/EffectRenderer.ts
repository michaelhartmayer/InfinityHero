import * as THREE from 'three';
import { type WorldMap }
    from '@vibemaster/shared';
import { VFXLibrary } from '../../vfx/VFXLibrary';
import { VisualEffect, type EffectConfig } from '../../vfx/effects/VisualEffect';
import { CursorGroundEffect } from '../../vfx/effects/CursorGroundEffect';

export const CursorState = {
    PASSIVE: 'passive',
    SELECT_TARGET: 'select_target'
} as const;
export type CursorStateType = typeof CursorState[keyof typeof CursorState];

export class EffectRenderer {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;

    private vfxLibrary: VFXLibrary;
    private cursorGroundEffect: CursorGroundEffect;
    private highlightMesh: THREE.Mesh;
    private selectionMesh: THREE.Mesh;
    private shadowTexture: THREE.Texture;

    private activeEffects: VisualEffect[] = [];
    private effectConfigs: Map<string, EffectConfig> = new Map();

    private cursorState: CursorStateType = CursorState.PASSIVE;
    private cursorPosition: { x: number, y: number } | null = null;

    constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.OrthographicCamera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        this.vfxLibrary = new VFXLibrary(this.renderer, this.scene, this.camera);

        // Load effect definitions
        fetch('/api/effects')
            .then(res => res.json())
            .then((data: EffectConfig[]) => {
                data.forEach(config => {
                    this.effectConfigs.set(config.id, config);
                });
                console.log(`✨ Loaded ${data.length} effect definitions`);
            })
            .catch(err => console.error('Failed to load effects:', err));

        // Cursor ground effect
        this.cursorGroundEffect = new CursorGroundEffect();
        this.scene.add(this.cursorGroundEffect.group);

        // Highlight Mesh
        const geometry = new THREE.PlaneGeometry(1, 1);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        this.highlightMesh = new THREE.Mesh(geometry, material);
        this.highlightMesh.visible = false;
        this.scene.add(this.highlightMesh);

        // Selection Mesh (Red Circle)
        const selectionGeo = new THREE.RingGeometry(0.4, 0.5, 32);
        const selectionMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
        this.selectionMesh = new THREE.Mesh(selectionGeo, selectionMat);
        // this.selectionMesh.rotation.x = -Math.PI / 2; // Already XY (flat on ground)
        this.selectionMesh.visible = false;
        this.scene.add(this.selectionMesh);

        this.shadowTexture = this.createShadowTexture();
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

    public getShadowTexture(): THREE.Texture {
        return this.shadowTexture;
    }

    public setCursorState(state: CursorStateType) {
        this.cursorState = state;

        if (state === CursorState.PASSIVE) {
            this.cursorGroundEffect.group.visible = false;
        } else {
            this.highlightMesh.visible = false;
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

        this.cursorPosition = { x: worldX, y: worldY };
    }

    public setSelection(position: { x: number, y: number } | null, map: WorldMap) {
        if (position) {
            const offsetX = map.width / 2;
            const offsetY = map.height / 2;
            this.selectionMesh.position.set(position.x - offsetX, position.y - offsetY, 0.1);
            this.selectionMesh.visible = true;
        } else {
            this.selectionMesh.visible = false;
        }
    }

    public playEffect(effectId: string, position: { x: number, y: number }) {
        const config = this.effectConfigs.get(effectId);
        if (!config) {
            console.warn(`[EffectRenderer] Effect config not found: ${effectId}`);
            return;
        }

        const effect = new VisualEffect(config);
        effect.group.rotation.x = Math.PI / 2; // Map XZ effect to XY world
        effect.group.position.set(position.x, position.y, 0.1); // Slightly above ground
        this.scene.add(effect.group);
        this.activeEffects.push(effect);
    }

    public update(dt: number) {
        // Animate highlight
        if (this.highlightMesh.visible) {
            const time = Date.now() / 1000;
            (this.highlightMesh.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(time * 5) * 0.1;
        }

        // Update active effects
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            effect.update(dt);
            if (effect.isDead) {
                this.scene.remove(effect.group);
                effect.dispose();
                this.activeEffects.splice(i, 1);
            }
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

        this.vfxLibrary.render(dt);
    }

    public resize(width: number, height: number) {
        this.vfxLibrary.resize(width, height);
    }
}
