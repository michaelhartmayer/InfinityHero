import * as THREE from 'three';
import { CSS2DObject } from 'three-stdlib';
import { type Monster, type WorldMap } from '@vibemaster/shared';
import { SpriteLoader } from '../SpriteLoader';
import { AnimationState } from '../AnimationConstants';

import { EffectRenderer } from './EffectRenderer';

export class MonsterRenderer {
    public group: THREE.Group;
    private monsterMeshes: Map<string, THREE.Mesh> = new Map();
    private monsterTargets: Map<string, { x: number, y: number }> = new Map();
    private monsterStates: Map<string, {
        facing: 'down' | 'left' | 'right' | 'up';
        isMoving: boolean;
        lastPosition: { x: number, y: number };
        animationTime: number;
        spriteId?: string;
    }> = new Map();

    private spriteLoader: SpriteLoader;
    private shadowTexture: THREE.Texture;
    private effectRenderer: EffectRenderer;

    constructor(spriteLoader: SpriteLoader, shadowTexture: THREE.Texture, effectRenderer: EffectRenderer) {
        this.group = new THREE.Group();
        this.spriteLoader = spriteLoader;
        this.shadowTexture = shadowTexture;
        this.effectRenderer = effectRenderer;
    }

    public updateMonsters(monsters: Record<string, Monster>, mapData: WorldMap) {
        const offsetX = mapData.width / 2;
        const offsetY = mapData.height / 2;

        for (const [id, mesh] of this.monsterMeshes) {
            if (!monsters[id]) {
                const label = mesh.getObjectByName('nameLabel');
                if (label) mesh.remove(label);
                this.group.remove(mesh);
                this.monsterMeshes.delete(id);
                this.monsterTargets.delete(id);
                this.monsterStates.delete(id);
            }
        }

        for (const monster of Object.values(monsters)) {
            let mesh = this.monsterMeshes.get(monster.id);

            // Check for sprite update
            if (mesh) {
                const state = this.monsterStates.get(monster.id);
                // If sprite changed, remove mesh to force recreation
                if (state && state.spriteId !== (monster.sprite || '')) {
                    // Clean up old label if exists (good practice, though clear() handles it too)
                    const label = mesh.getObjectByName('nameLabel');
                    if (label) mesh.remove(label);

                    this.group.remove(mesh);
                    this.monsterMeshes.delete(monster.id);
                    mesh = undefined;
                }
            }

            if (!mesh) {
                if (!this.monsterStates.has(monster.id)) {
                    this.monsterStates.set(monster.id, {
                        facing: 'down',
                        isMoving: false,
                        lastPosition: { x: monster.position.x, y: monster.position.y },
                        animationTime: 0,
                        spriteId: monster.sprite || ''
                    });

                    // Trigger spawn effect if configured
                    if (monster.spawnEffect) {
                        this.effectRenderer.playEffect(monster.spawnEffect, {
                            x: monster.position.x - offsetX,
                            y: monster.position.y - offsetY
                        });
                    }
                } else {
                    // Update spriteId in existing state
                    const state = this.monsterStates.get(monster.id)!;
                    state.spriteId = monster.sprite || '';
                }

                if (monster.sprite) {
                    const texture = this.spriteLoader.getTexture(monster.sprite);
                    if (texture) {
                        const geometry = new THREE.PlaneGeometry(1, 1.25);
                        const material = new THREE.MeshStandardMaterial({
                            map: texture,
                            transparent: true,
                            alphaTest: 0.5,
                            side: THREE.DoubleSide
                        });
                        mesh = new THREE.Mesh(geometry, material);

                        const uvs = this.spriteLoader.getFrameUVs(monster.sprite, 1);
                        if (uvs) {
                            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                        }
                    } else {
                        if (this.spriteLoader.hasTextures()) {
                            console.warn('⚠️ Texture not found for sprite: ' + monster.sprite + '. Using fallback.');
                        }
                        const geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
                        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
                        mesh = new THREE.Mesh(geometry, material);
                        mesh.userData.isFallback = true;
                        mesh.userData.name = monster.name;
                        mesh.userData.level = monster.level;
                    }
                } else {
                    console.warn('⚠️ No sprite ID for monster: ' + monster.name + ' (' + monster.id + ')');
                    const geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
                    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
                    mesh = new THREE.Mesh(geometry, material);
                    mesh.userData.isFallback = true;
                    mesh.userData.name = monster.name;
                    mesh.userData.level = monster.level;
                }

                const shadowGeo = new THREE.PlaneGeometry(1.0, 0.5);
                const shadowMat = new THREE.MeshBasicMaterial({
                    map: this.shadowTexture,
                    transparent: true,
                    depthWrite: false,
                    opacity: 0.8
                });
                const shadow = new THREE.Mesh(shadowGeo, shadowMat);
                shadow.position.y = -0.3;
                shadow.position.z = -0.25;
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

                this.group.add(mesh);
                this.monsterMeshes.set(monster.id, mesh);
            }

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
        }
    }

    public updateAnimations(dt: number) {
        for (const [id, state] of this.monsterStates) {
            let mesh = this.monsterMeshes.get(id);
            if (!mesh) continue;

            if (mesh.userData.isFallback && state.spriteId) {
                const texture = this.spriteLoader.getTexture(state.spriteId);
                if (texture) {
                    console.log('✨ Lazy loaded sprite for monster: ' + id);

                    const savedName = mesh.userData.name || 'Monster';
                    const savedLevel = mesh.userData.level || 1;

                    const oldLabel = mesh.children.find(c => c instanceof CSS2DObject) as CSS2DObject;
                    if (oldLabel) {
                        mesh.remove(oldLabel);
                        if (oldLabel.element && oldLabel.element.parentNode) {
                            oldLabel.element.parentNode.removeChild(oldLabel.element);
                        }
                    }

                    this.group.remove(mesh);
                    this.monsterMeshes.delete(id);

                    const geometry = new THREE.PlaneGeometry(1, 1.25);
                    const material = new THREE.MeshStandardMaterial({
                        map: texture,
                        transparent: true,
                        alphaTest: 0.5,
                        side: THREE.DoubleSide
                    });
                    mesh = new THREE.Mesh(geometry, material);

                    const shadowGeo = new THREE.PlaneGeometry(1.0, 0.5);
                    const shadowMat = new THREE.MeshBasicMaterial({
                        map: this.shadowTexture,
                        transparent: true,
                        depthWrite: false,
                        opacity: 0.8
                    });
                    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
                    shadow.position.y = -0.3;
                    shadow.position.z = -0.25;
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

                    const div = document.createElement('div');
                    div.className = 'monster-label';
                    div.textContent = `${savedName} (Lvl ${savedLevel})`;
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

                    mesh.position.set(state.lastPosition.x, state.lastPosition.y, 0.4);

                    const uvs = this.spriteLoader.getFrameUVs(state.spriteId, 10);
                    if (uvs) {
                        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                    }

                    this.group.add(mesh);
                    this.monsterMeshes.set(id, mesh);
                }
            }

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

            const spriteId = state.spriteId;
            if (spriteId) {
                const sprite = this.spriteLoader.getSprite(spriteId);
                if (sprite && sprite.animations) {
                    let animName: string = AnimationState.IDLE;
                    if (state.isMoving) {
                        switch (state.facing) {
                            case 'left': animName = AnimationState.WALK_LEFT; break;
                            case 'right': animName = AnimationState.WALK_RIGHT; break;
                            case 'up': animName = AnimationState.WALK_UP; break;
                            case 'down': animName = AnimationState.WALK_DOWN; break;
                        }
                    }

                    // Robust lookup:
                    // 1. Exact match (e.g. "WALK_DOWN")
                    // 2. Uppercase match (e.g. "WALK_DOWN")
                    // 3. Base action match (e.g. "idle")
                    // 4. Uppercase base action match (e.g. "IDLE")
                    let anim = sprite.animations[animName] ||
                        sprite.animations[animName.toUpperCase()];

                    // 5. Case-insensitive search for full name
                    if (!anim) {
                        const targetName = animName.toLowerCase();
                        const key = Object.keys(sprite.animations).find(k => k.toLowerCase() === targetName);
                        if (key) anim = sprite.animations[key];
                    }

                    if (anim && anim.frames.length > 0) {
                        const totalFrames = anim.frames.length;
                        const frameIdx = Math.floor(state.animationTime * anim.frameRate) % totalFrames;
                        const frame = anim.frames[frameIdx];

                        const uvs = this.spriteLoader.getFrameUVs(spriteId, frame);
                        if (uvs) {
                            mesh.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                            (mesh.geometry.attributes.uv as THREE.BufferAttribute).needsUpdate = true;
                        }
                    }
                }
            }
        }
    }

    public interpolatePositions(dt: number) {
        const lerpFactor = 1 - Math.exp(-20 * dt);
        for (const [id, mesh] of this.monsterMeshes) {
            const target = this.monsterTargets.get(id);
            if (target) {
                mesh.position.x += (target.x - mesh.position.x) * lerpFactor;
                mesh.position.y += (target.y - mesh.position.y) * lerpFactor;
            }
        }
    }

    public getMesh(id: string): THREE.Mesh | undefined {
        return this.monsterMeshes.get(id);
    }

    public getMonsterId(mesh: THREE.Object3D): string | null {
        for (const [id, m] of this.monsterMeshes) {
            if (m === mesh) return id;
        }
        return null;
    }

    public clear() {
        for (const mesh of this.monsterMeshes.values()) {
            const label = mesh.children.find(c => c instanceof CSS2DObject) as CSS2DObject;
            if (label) {
                mesh.remove(label);
                if (label.element && label.element.parentNode) {
                    label.element.parentNode.removeChild(label.element);
                }
            }
            this.group.remove(mesh);
        }
        this.monsterMeshes.clear();
        this.monsterStates.clear();
        this.monsterTargets.clear();
    }
}
