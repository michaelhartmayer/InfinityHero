import * as THREE from 'three';
import { type Item, type WorldMap } from '@vibemaster/shared';

export class ItemRenderer {
    public group: THREE.Group;
    private itemMeshes: Map<string, THREE.Mesh> = new Map();

    constructor() {
        this.group = new THREE.Group();
    }

    public updateItems(items: Record<string, Item>, mapData: WorldMap) {
        const offsetX = mapData.width / 2;
        const offsetY = mapData.height / 2;

        for (const [id, mesh] of this.itemMeshes) {
            if (!items[id]) {
                this.group.remove(mesh);
                this.itemMeshes.delete(id);
            }
        }

        for (const item of Object.values(items)) {
            if (!this.itemMeshes.has(item.id)) {
                const geometry = new THREE.SphereGeometry(0.3, 8, 8);
                const material = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x444400 });
                const mesh = new THREE.Mesh(geometry, material);

                mesh.position.set(item.position.x - offsetX, item.position.y - offsetY, 0.3);

                this.group.add(mesh);
                this.itemMeshes.set(item.id, mesh);
            }
        }
    }

    public clear() {
        this.group.clear();
        this.itemMeshes.clear();
    }
}
