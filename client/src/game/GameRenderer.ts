
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three-stdlib';
import { type WorldMap, TileType, type Player, type Item, type Monster } from '@vibemaster/shared';
import { VFXLibrary } from '../vfx/VFXLibrary';

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

    private chatBubbles: Map<string, { element: CSS2DObject, startTime: number, duration: number }> = new Map();

    private highlightMesh: THREE.LineSegments;
    private labelRenderer: CSS2DRenderer;
    private vfxLibrary: VFXLibrary;

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

        this.animate();
    }

    public setHighlight(x: number, y: number, map: WorldMap) {
        const offsetX = map.width / 2;
        const offsetY = map.height / 2;
        this.highlightMesh.position.set(x - offsetX, y - offsetY, 0.1);
        this.highlightMesh.visible = true;

        // Pulse effect
        const scale = 1 + Math.sin(Date.now() * 0.01) * 0.05;
        this.highlightMesh.scale.set(scale, scale, 1);
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

        const div = document.createElement('div');
        div.className = 'chat-bubble';
        div.textContent = message;

        const label = new CSS2DObject(div);
        label.position.set(0, 1.5, 0); // Above head
        playerMesh.add(label);

        this.chatBubbles.set(playerId, {
            element: label,
            startTime: Date.now(),
            duration: 5000 // 5 seconds
        });
    }

    public renderMap(map: WorldMap) {
        this.mapGroup.clear();

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
                this.chatBubbles.delete(id);
            }
        }

        let localPlayer: Player | null = null;
        if (this.localPlayerId && players[this.localPlayerId]) {
            localPlayer = players[this.localPlayerId];
        }

        for (const player of Object.values(players)) {
            let mesh = this.playerMeshes.get(player.id);
            if (!mesh) {
                let geometry: THREE.BufferGeometry;
                let color: number;

                switch (player.class) {
                    case 'WARRIOR':
                        geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
                        color = 0x3f51b5;
                        break;
                    case 'MAGE':
                        geometry = new THREE.ConeGeometry(0.5, 1, 8);
                        color = 0x9c27b0;
                        break;
                    case 'ROGUE':
                        geometry = new THREE.OctahedronGeometry(0.5);
                        color = 0xffeb3b;
                        break;
                    default:
                        geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
                        color = 0xff0000;
                }

                const material = new THREE.MeshStandardMaterial({ color });
                mesh = new THREE.Mesh(geometry, material);

                const headGeo = new THREE.SphereGeometry(0.25, 8, 8);
                const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc80 });
                const head = new THREE.Mesh(headGeo, headMat);
                head.position.y = 0.6;
                mesh.add(head);

                if (player.id === this.localPlayerId) {
                    const ringGeo = new THREE.RingGeometry(0.4, 0.5, 32);
                    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
                    const ring = new THREE.Mesh(ringGeo, ringMat);
                    ring.rotation.x = -Math.PI / 2;
                    ring.position.y = -0.39;
                    mesh.add(ring);
                }

                // Add Name Label
                const div = document.createElement('div');
                div.className = 'player-label';
                div.textContent = player.name;

                const label = new CSS2DObject(div);
                label.position.set(0, 1.0, 0); // Above head
                mesh.add(label);

                this.playersGroup.add(mesh);
                this.playerMeshes.set(player.id, mesh);
            }

            // Smooth interpolation for player movement
            const targetX = player.position.x - offsetX;
            const targetY = player.position.y - offsetY;

            // If distance is large (teleport), snap immediately
            // Otherwise interpolate smoothly
            const dist = Math.sqrt(
                Math.pow(mesh.position.x - targetX, 2) +
                Math.pow(mesh.position.y - targetY, 2)
            );

            if (dist > 5) {
                mesh.position.set(targetX, targetY, 0.4);
            } else {
                // Lerp factor of 0.3 gives smooth but responsive movement
                mesh.position.x += (targetX - mesh.position.x) * 0.3;
                mesh.position.y += (targetY - mesh.position.y) * 0.3;
                mesh.position.z = 0.4;
            }

            let healthBar = mesh.getObjectByName('healthBar') as THREE.Mesh;
            if (!healthBar) {
                const bgGeo = new THREE.PlaneGeometry(0.8, 0.1);
                const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
                const bgMesh = new THREE.Mesh(bgGeo, bgMat);
                bgMesh.position.set(0, 0.6, 0);

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

        if (localPlayer) {
            const targetX = localPlayer.position.x - offsetX;
            const targetY = localPlayer.position.y - offsetY;

            const lerpFactor = 0.1;
            this.camera.position.x += (targetX - this.camera.position.x) * lerpFactor;
            this.camera.position.y += (targetY - this.camera.position.y) * lerpFactor;
        }
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

                const bgGeo = new THREE.PlaneGeometry(0.6, 0.1);
                const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
                const bgMesh = new THREE.Mesh(bgGeo, bgMat);
                bgMesh.position.set(0, 0.5, 0);

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
                label.position.set(0, 0.8, 0);
                label.name = 'nameLabel';
                mesh.add(label);

                this.monstersGroup.add(mesh);
                this.monsterMeshes.set(monster.id, mesh);
            }

            mesh.position.set(monster.position.x - offsetX, monster.position.y - offsetY, 0.3);

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

    private animate = () => {
        requestAnimationFrame(this.animate);

        // Animate highlight
        if (this.highlightMesh.visible) {
            const scale = 1 + Math.sin(Date.now() * 0.005) * 0.05;
            this.highlightMesh.scale.set(scale, scale, 1);
        }

        // Animate selection
        if (this.selectionMesh.visible) {
            this.selectionMesh.rotation.z += 0.02;
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

        this.vfxLibrary.render(0.016);
        this.labelRenderer.render(this.scene, this.camera);
    }
}
