import * as THREE from 'three';
import { UnrealBloomPass } from 'three-stdlib';

export class BloomEffect {
    public pass: UnrealBloomPass;

    constructor(width: number, height: number) {
        // resolution, strength, radius, threshold
        this.pass = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            1.5, // strength
            0.4, // radius
            0.85 // threshold
        );
    }

    public setSize(width: number, height: number) {
        this.pass.resolution.set(width, height);
    }
}
