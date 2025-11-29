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

        const intersects = this.raycaster.intersectObjects(this.monsterRenderer.group.children, true);

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
        const mapY = Math.round(worldY + offsetY);

        return { x: mapX, y: mapY };
    }
}
