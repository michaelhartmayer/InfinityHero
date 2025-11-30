import * as THREE from 'three';
import { type WorldMap } from '@vibemaster/shared';
import { MonsterRenderer } from './MonsterRenderer';

export class InteractionManager {
    private camera: THREE.OrthographicCamera;
    private raycaster = new THREE.Raycaster();
    private monsterRenderer: MonsterRenderer;

    constructor(camera: THREE.OrthographicCamera, monsterRenderer: MonsterRenderer) {
        this.camera = camera;
        this.monsterRenderer = monsterRenderer;
    }

    public pickMonster(x: number, y: number, width: number, height: number): string | null {
        // Convert screen to NDC
        const ndcX = (x / width) * 2 - 1;
        const ndcY = -(y / height) * 2 + 1;

        this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

        // Optimization: Filter objects by distance to cursor in world space
        // First get world position of cursor
        // Orthographic camera: unproject is simple
        const vector = new THREE.Vector3(ndcX, ndcY, 0).unproject(this.camera);
        const cursorX = vector.x;
        const cursorY = vector.y;

        const candidates: THREE.Object3D[] = [];
        const radius = 1.5; // Check monsters within 1.5 units

        for (const mesh of this.monsterRenderer.group.children) {
            // Simple distance check (ignoring z)
            const dx = mesh.position.x - cursorX;
            const dy = mesh.position.y - cursorY;
            if (dx * dx + dy * dy < radius * radius) {
                candidates.push(mesh);
            }
        }

        if (candidates.length === 0) return null;

        const intersects = this.raycaster.intersectObjects(candidates, true);

        if (intersects.length > 0) {
            // Find the root mesh of the monster (parent of parts)
            let obj = intersects[0].object;
            while (obj.parent && obj.parent !== this.monsterRenderer.group) {
                obj = obj.parent;
            }

            return this.monsterRenderer.getMonsterId(obj);
        }
        return null;
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
        const mapY = Math.round((map.height - 1) - (worldY + offsetY));

        return { x: mapX, y: mapY };
    }
}
