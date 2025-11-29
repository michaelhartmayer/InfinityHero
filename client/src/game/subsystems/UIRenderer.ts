import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three-stdlib';
import { PlayerRenderer } from './PlayerRenderer';
import { MonsterRenderer } from './MonsterRenderer';

export class UIRenderer {
    private labelRenderer: CSS2DRenderer;
    private playerRenderer: PlayerRenderer;
    private monsterRenderer: MonsterRenderer;
    private chatBubbles: Map<string, { element: CSS2DObject, startTime: number, duration: number }> = new Map();
    private damageIndicators: Set<{ element: CSS2DObject, startTime: number, duration: number, mesh: THREE.Object3D }> = new Set();

    constructor(canvas: HTMLCanvasElement, playerRenderer: PlayerRenderer, monsterRenderer: MonsterRenderer) {
        this.playerRenderer = playerRenderer;
        this.monsterRenderer = monsterRenderer;

        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(canvas.width, canvas.height);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0px';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        canvas.parentElement?.appendChild(this.labelRenderer.domElement);
    }

    public showChatBubble(playerId: string, message: string) {
        if (this.chatBubbles.has(playerId)) {
            const existing = this.chatBubbles.get(playerId)!;
            const mesh = this.playerRenderer.getMesh(playerId);
            if (mesh) {
                mesh.remove(existing.element);
            }
            this.chatBubbles.delete(playerId);
        }

        let mesh = this.playerRenderer.getMesh(playerId);
        if (!mesh) {
            mesh = this.monsterRenderer.getMesh(playerId);
        }
        if (!mesh) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'chat-bubble-wrapper';

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.textContent = message;

        wrapper.appendChild(bubble);

        const label = new CSS2DObject(wrapper);
        label.position.set(0, 1.4, 0);
        mesh.add(label);

        this.chatBubbles.set(playerId, {
            element: label,
            startTime: Date.now(),
            duration: 5000
        });
    }

    public showDamage(targetId: string, damage: number, attackerId?: string) {
        let mesh = this.playerRenderer.getMesh(targetId);
        let yOffset = 3.0; // Higher for players due to name label position

        if (!mesh) {
            mesh = this.monsterRenderer.getMesh(targetId);
            yOffset = 2.0; // Just above monster head (name is at 1.0)
        }
        if (!mesh) return;

        // Calculate direction from attacker
        let dirX = 0;
        let dirY = 1; // Default up

        if (attackerId) {
            let attackerMesh = this.playerRenderer.getMesh(attackerId);
            if (!attackerMesh) {
                attackerMesh = this.monsterRenderer.getMesh(attackerId);
            }

            if (attackerMesh) {
                const dx = mesh.position.x - attackerMesh.position.x;
                const dy = mesh.position.y - attackerMesh.position.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 0.001) {
                    dirX = dx / len;
                    dirY = dy / len;
                }
            }
        }

        const wrapper = document.createElement('div');
        const div = document.createElement('div');
        div.className = 'damage-indicator';

        // If damage is negative, it's healing - show as positive green number
        const isHealing = damage < 0;
        if (isHealing) {
            div.textContent = `+${Math.abs(damage)}`;
            div.style.color = '#00ff00'; // Green for healing
        } else {
            div.textContent = `-${damage}`;
        }

        // Set direction variables for CSS
        div.style.setProperty('--dir-x', `${dirX}`);
        div.style.setProperty('--dir-y', `${dirY}`);

        wrapper.appendChild(div);

        // Randomize start position slightly
        const offsetX = (Math.random() - 0.5) * 0.5;

        const label = new CSS2DObject(wrapper);
        label.position.set(offsetX, yOffset, 0);
        mesh.add(label);

        this.damageIndicators.add({
            element: label,
            startTime: Date.now(),
            duration: 2000,
            mesh: mesh
        });
    }

    public update() {
        const now = Date.now();
        for (const [id, bubble] of this.chatBubbles) {
            if (now - bubble.startTime > bubble.duration) {
                let mesh = this.playerRenderer.getMesh(id);
                if (!mesh) {
                    mesh = this.monsterRenderer.getMesh(id);
                }
                if (mesh) {
                    mesh.remove(bubble.element);
                }
                this.chatBubbles.delete(id);
            }
        }

        for (const indicator of this.damageIndicators) {
            if (now - indicator.startTime > indicator.duration) {
                indicator.mesh.remove(indicator.element);
                this.damageIndicators.delete(indicator);
            }
        }
    }

    public render(scene: THREE.Scene, camera: THREE.Camera) {
        this.labelRenderer.render(scene, camera);
    }

    public resize(width: number, height: number) {
        this.labelRenderer.setSize(width, height);
    }
}
