import * as THREE from 'three';
import { EffectComposer, RenderPass } from 'three-stdlib';
// import { BloomEffect } from './effects/BloomEffect';

export class VFXLibrary {
    private composer: EffectComposer;
    private renderPass: RenderPass;
    // private bloomEffect: BloomEffect;

    constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
        // const width = renderer.domElement.width;
        // const height = renderer.domElement.height;

        this.composer = new EffectComposer(renderer);

        // Base Render Pass
        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);

        // Bloom Effect (Default)
        // this.bloomEffect = new BloomEffect(width, height);
        // this.composer.addPass(this.bloomEffect.pass);
    }

    public render(deltaTime: number) {
        this.composer.render(deltaTime);
    }

    public resize(width: number, height: number) {
        this.composer.setSize(width, height);
        // this.bloomEffect.setSize(width, height);
    }
}
