import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three-stdlib';
import { PlayerRenderer } from './PlayerRenderer';

export class UIRenderer {
    private labelRenderer: CSS2DRenderer;
    private playerRenderer: PlayerRenderer;
    private chatBubbles: Map<string, { element: CSS2DObject, startTime: number, duration: number }> = new Map();

    constructor(canvas: HTMLCanvasElement, playerRenderer: PlayerRenderer) {
        this.playerRenderer = playerRenderer;

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

        const playerMesh = this.playerRenderer.getMesh(playerId);
        if (!playerMesh) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'chat-bubble-wrapper';

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.textContent = message;

        wrapper.appendChild(bubble);

        const label = new CSS2DObject(wrapper);
        label.position.set(0, 1.7, 0);
        playerMesh.add(label);

        this.chatBubbles.set(playerId, {
            element: label,
            startTime: Date.now(),
            duration: 5000
        });
    }

    public update() {
        const now = Date.now();
        for (const [id, bubble] of this.chatBubbles) {
            if (now - bubble.startTime > bubble.duration) {
                const mesh = this.playerRenderer.getMesh(id);
                if (mesh) {
                    mesh.remove(bubble.element);
                }
                this.chatBubbles.delete(id);
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
