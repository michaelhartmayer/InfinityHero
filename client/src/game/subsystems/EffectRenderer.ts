import * as THREE from 'three';
import { type WorldMap } from '@vibemaster/shared';
import { VFXLibrary } from '../../vfx/VFXLibrary';
import { CursorGroundEffect } from '../../vfx/effects/CursorGroundEffect';

export const CursorState = {
    PASSIVE: 0,
    SELECT_TARGET: 1
} as const;
export type CursorState = typeof CursorState[keyof typeof CursorState];

export class EffectRenderer {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;

    private vfxLibrary: VFXLibrary;
    private cursorGroundEffect: CursorGroundEffect;
    private highlightMesh: THREE.LineSegments;
    private selectionMesh: THREE.Mesh;
    private shadowTexture: THREE.Texture;

    private cursorState: CursorState = CursorState.PASSIVE;
    private cursorPosition: { x: number, y: number } | null = null;

    constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.OrthographicCamera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        this.vfxLibrary = new VFXLibrary(this.renderer, this.scene, this.camera);

        // Cursor ground effect
        this.cursorGroundEffect = new CursorGroundEffect();
        this.scene.add(this.cursorGroundEffect.group);

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

    public setCursorState(state: CursorState) {
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

    public update(dt: number) {
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

        this.vfxLibrary.render(dt);
    }

    public resize(width: number, height: number) {
        this.vfxLibrary.resize(width, height);
    }
}
