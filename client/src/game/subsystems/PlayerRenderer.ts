import * as THREE from 'three';
import { CSS2DObject } from 'three-stdlib';
import { type Player, type WorldMap } from '@vibemaster/shared';
import { SpriteLoader } from '../SpriteLoader';
import { AnimationState } from '../AnimationConstants';
import { AudioManager } from '../AudioManager';

export class PlayerRenderer {
    public group: THREE.Group;
    private playerMeshes: Map<string, THREE.Mesh> = new Map();
    private playerTargets: Map<string, { x: number, y: number }> = new Map();
    private playerStates: Map<string, {
        facing: 'down' | 'left' | 'right' | 'up';
        isMoving: boolean;
        lastPosition: { x: number, y: number };
        animationTime: number;
    }> = new Map();

    private spriteLoader: SpriteLoader;
    private shadowTexture: THREE.Texture;
    private localPlayerId: string | null;
    private localPlayerWalkingSound: { source: AudioBufferSourceNode, gainNode: GainNode } | null = null;
    private lastDebugUpdateTime: number = 0;

    constructor(spriteLoader: SpriteLoader, shadowTexture: THREE.Texture, localPlayerId: string | null) {
        this.group = new THREE.Group();
        this.spriteLoader = spriteLoader;
        this.shadowTexture = shadowTexture;
        this.localPlayerId = localPlayerId;
    }

    public updatePlayers(players: Record<string, Player>, currentMap: WorldMap | null) {
        if (!currentMap) return;
        const offsetX = currentMap.width / 2;
        const offsetY = currentMap.height / 2;

        const activeIds = new Set(Object.keys(players));

        for (const [id, mesh] of this.playerMeshes) {
            if (!activeIds.has(id)) {
                this.group.remove(mesh);
                this.playerMeshes.delete(id);
                this.playerTargets.delete(id);
                // Chat bubbles should be handled by UIRenderer observing this or via callback
                // For now, we'll assume UIRenderer handles its own cleanup or we expose a way to check
            }
        }

        for (const player of Object.values(players)) {
            let mesh = this.playerMeshes.get(player.id);
            if (!mesh) {
                const spriteId = 'dev_guy';
                const texture = this.spriteLoader.getTexture(spriteId);

                if (texture) {
                    const geometry = new THREE.PlaneGeometry(1, 1.25);
                    const material = new THREE.MeshStandardMaterial({
                        map: texture,
                        transparent: true,
                        alphaTest: 0.5,
                        side: THREE.DoubleSide
                    });
                    mesh = new THREE.Mesh(geometry, material);
                    geometry.translate(0, 0.125, 0);

                    this.playerStates.set(player.id, {
                        facing: 'down',
                        isMoving: false,
                        lastPosition: { x: player.position.x, y: player.position.y },
                        animationTime: 0
                    });

                    const uvs = this.spriteLoader.getFrameUVs(spriteId, 1);
                    if (uvs) {
                        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                    }
                } else {
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
                    ring.rotation.x = -Math.PI / 2;
                    ring.position.z = -0.1;
                    mesh.add(ring);
                }

                const shadowGeo = new THREE.PlaneGeometry(0.8, 0.4);
                const shadowMat = new THREE.MeshBasicMaterial({
                    map: this.shadowTexture,
                    transparent: true,
                    depthWrite: false,
                    opacity: 0.6
                });
                const shadow = new THREE.Mesh(shadowGeo, shadowMat);
                shadow.position.y = -0.4;
                shadow.position.z = -0.2;
                mesh.add(shadow);

                const div = document.createElement('div');
                div.className = 'player-label';
                div.textContent = player.name;
                const label = new CSS2DObject(div);
                label.position.set(0, 2.6, 0);
                mesh.add(label);

                this.group.add(mesh);
                this.playerMeshes.set(player.id, mesh);
            }

            const targetX = player.position.x - offsetX;
            const targetY = player.position.y - offsetY;

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
                    mesh.position.set(targetX, targetY, 0.4);
                    this.playerTargets.set(player.id, { x: targetX, y: targetY });
                } else {
                    this.playerTargets.set(player.id, { x: targetX, y: targetY });
                }
            }

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
    }

    public updateAnimations(dt: number, onDebugUpdate?: (info: string) => void) {
        for (const [id, state] of this.playerStates) {
            const mesh = this.playerMeshes.get(id);
            if (!mesh) continue;

            // Use target position to determine intent/direction
            // This is more reliable than previous frame position for direction
            const target = this.playerTargets.get(id);
            let dx = 0;
            let dy = 0;

            if (target) {
                dx = target.x - mesh.position.x;
                dy = target.y - mesh.position.y;
            }

            // Threshold for "moving"
            // Lowered to 0.01 to ensure slow movement is detected
            const isMoving = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
            state.isMoving = isMoving;

            // Handle local player walking sound
            if (id === this.localPlayerId) {
                if (isMoving && !this.localPlayerWalkingSound) {
                    // Start looping walking sound
                    AudioManager.getInstance().playLoopingSFX('/assets/sounds/dev-pc-walking.mp3', 0.5).then(soundNodes => {
                        if (soundNodes) {
                            this.localPlayerWalkingSound = soundNodes;
                        }
                    });
                } else if (!isMoving && this.localPlayerWalkingSound) {
                    // Fade out walking sound
                    AudioManager.getInstance().fadeOutSound(this.localPlayerWalkingSound.gainNode, 0.25);
                    this.localPlayerWalkingSound.source.stop(AudioManager.getInstance()['audioContext']!.currentTime + 0.25);
                    this.localPlayerWalkingSound = null;
                }
            }

            if (isMoving) {
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

            const spriteId = 'dev_guy';
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

                const anim = sprite.animations[animName];

                if (anim && anim.frames.length > 0) {
                    const totalFrames = anim.frames.length;
                    const frameIdx = Math.floor(state.animationTime * anim.frameRate) % totalFrames;
                    const frame = anim.frames[frameIdx];

                    const uvs = this.spriteLoader.getFrameUVs(spriteId, frame);
                    if (uvs) {
                        mesh.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                        (mesh.geometry.attributes.uv as THREE.BufferAttribute).needsUpdate = true;

                        if (id === this.localPlayerId && onDebugUpdate) {
                            const now = Date.now();
                            if (now - this.lastDebugUpdateTime > 100) {
                                this.lastDebugUpdateTime = now;
                                onDebugUpdate(
                                    `State: ${state.facing.toUpperCase()} ${state.isMoving ? '(MOVING)' : '(IDLE)'}\n` +
                                    `Pos: ${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}\n` +
                                    `Target: ${target ? target.x.toFixed(2) + ', ' + target.y.toFixed(2) : 'None'}\n` +
                                    `Anim: ${animName} [${frameIdx}/${totalFrames}]`
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    public interpolatePositions(dt: number) {
        const lerpFactor = 1 - Math.exp(-20 * dt);
        for (const [id, mesh] of this.playerMeshes) {
            const target = this.playerTargets.get(id);
            if (target) {
                mesh.position.x += (target.x - mesh.position.x) * lerpFactor;
                mesh.position.y += (target.y - mesh.position.y) * lerpFactor;
            }
        }
    }

    public getMesh(id: string): THREE.Mesh | undefined {
        return this.playerMeshes.get(id);
    }

    public getLocalPlayerMesh(): THREE.Mesh | undefined {
        if (this.localPlayerId) return this.playerMeshes.get(this.localPlayerId);
        return undefined;
    }

    public clear() {
        for (const mesh of this.playerMeshes.values()) {
            const label = mesh.children.find(c => c instanceof CSS2DObject) as CSS2DObject;
            if (label) {
                mesh.remove(label);
                if (label.element && label.element.parentNode) {
                    label.element.parentNode.removeChild(label.element);
                }
            }
            this.group.remove(mesh);
        }
        this.playerMeshes.clear();
        this.playerStates.clear();
        this.playerTargets.clear();
    }
}
