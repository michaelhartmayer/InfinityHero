import * as THREE from 'three';

export interface EffectLayerConfig {
    id: string;
    name: string;
    type: 'points' | 'mesh' | 'line';
    geometryType: 'ring' | 'sphere' | 'box';
    count: number;
    blending: string;
    vertexShader: string;
    fragmentShader: string;
    attributeConfig?: {
        sizeStart?: number;
        sizeEnd?: number;
        kindPattern?: string;
    };
}

export interface EffectConfig {
    id: string;
    name: string;
    layers: EffectLayerConfig[];
    uniforms: Array<{ name: string, type: string, value: any }>;
}

export class VisualEffect {
    public group: THREE.Group;
    public config: EffectConfig;
    private materials: THREE.ShaderMaterial[] = [];
    private startTime: number;
    private duration: number = 2.0; // Default duration
    public isDead: boolean = false;

    constructor(config: EffectConfig) {
        this.config = config;
        this.group = new THREE.Group();
        this.startTime = Date.now();

        this.buildLayers();
    }

    private buildLayers() {
        for (const layer of this.config.layers) {
            let geometry: THREE.BufferGeometry;
            let material: THREE.ShaderMaterial;

            // 1. Geometry
            if (layer.type === 'points') {
                geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(layer.count * 3);
                const sizes = new Float32Array(layer.count);
                const angles = new Float32Array(layer.count);
                const alphas = new Float32Array(layer.count);

                const kindPattern = layer.attributeConfig?.kindPattern?.split(',').map(Number) || [0];

                for (let i = 0; i < layer.count; i++) {
                    positions[i * 3] = 0;
                    positions[i * 3 + 1] = 0;
                    positions[i * 3 + 2] = 0;

                    // Interpolate size
                    const t = i / (layer.count - 1 || 1);
                    const sizeStart = layer.attributeConfig?.sizeStart ?? 1.0;
                    const sizeEnd = layer.attributeConfig?.sizeEnd ?? 1.0;
                    sizes[i] = sizeStart * (1 - t) + sizeEnd * t;

                    angles[i] = (i / layer.count) * Math.PI * 2;
                    alphas[i] = 1.0;

                    // Kind
                    // @ts-ignore
                    const kind = kindPattern[i % kindPattern.length];
                    // We need to add 'kind' attribute if shader uses it
                }

                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
                geometry.setAttribute('angle', new THREE.BufferAttribute(angles, 1));
                geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

                // Add 'kind' attribute if it seems to be used (or just always add it)
                const kinds = new Float32Array(layer.count);
                for (let i = 0; i < layer.count; i++) {
                    kinds[i] = kindPattern[i % kindPattern.length];
                }
                geometry.setAttribute('kind', new THREE.BufferAttribute(kinds, 1));

            } else {
                // Mesh or Line
                switch (layer.geometryType) {
                    case 'ring':
                        geometry = new THREE.RingGeometry(0.5, 1, 32);
                        geometry.rotateX(-Math.PI / 2);
                        break;
                    case 'sphere':
                        geometry = new THREE.SphereGeometry(0.5, 16, 16);
                        break;
                    case 'box':
                    default:
                        geometry = new THREE.BoxGeometry(1, 1, 1);
                        break;
                }

                // For lines, we might need buffer geometry if it's a trail, 
                // but for now let's assume simple geometry for mesh/line types
                if (layer.type === 'line') {
                    // Convert to edges or wireframe if needed, or just use as is with LineBasicMaterial?
                    // The JSON defines shaders, so we use ShaderMaterial.
                    // But THREE.Line needs BufferGeometry.
                    // If geometryType is 'ring', RingGeometry is BufferGeometry.
                }
            }

            // 2. Material
            const uniforms: Record<string, any> = {};
            // Add global uniforms
            if (this.config.uniforms) {
                for (const u of this.config.uniforms) {
                    uniforms[u.name] = { value: u.value };
                }
            }
            // Ensure uTime exists
            if (!uniforms.uTime) uniforms.uTime = { value: 0 };

            let blending: THREE.Blending = THREE.NormalBlending;
            if (layer.blending === 'additive') blending = THREE.AdditiveBlending;

            material = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: layer.vertexShader,
                fragmentShader: layer.fragmentShader,
                transparent: true,
                blending: blending,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            this.materials.push(material);

            // 3. Object
            let object: THREE.Object3D;
            if (layer.type === 'points') {
                object = new THREE.Points(geometry, material);
            } else if (layer.type === 'line') {
                object = new THREE.Line(geometry, material);
            } else {
                object = new THREE.Mesh(geometry, material);
            }

            // Rotate flat geometries to lie on ground if needed?
            // Most effects seem to handle orientation in shader or assume billboard/volume.
            // But rings usually default to facing Z. In top-down (Z-up?) or Y-up?
            // Three.js is Y-up. Top-down camera looks along Y or Z?
            // GameRenderer camera: position (0,0,10), looking at (0,0,0). So Z-up view?
            // Wait, GameRenderer: camera.position.set(0, 0, 10).
            // MapRenderer: tiles are on XY plane?
            // Let's check MapRenderer.ts or Tile logic.
            // MapRenderer uses PlaneGeometry(1,1).
            // So the world is XY plane. Z is height/depth.
            // RingGeometry is in XY plane by default.

            this.group.add(object);
        }
    }

    public update(_dt: number) {
        const elapsed = (Date.now() - this.startTime) / 1000;

        if (elapsed > this.duration) {
            this.isDead = true;
            return;
        }

        for (const mat of this.materials) {
            if (mat.uniforms.uTime) {
                mat.uniforms.uTime.value = elapsed;
            }
        }
    }

    public dispose() {
        // Cleanup geometries and materials
        this.group.traverse((obj) => {
            if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
                obj.geometry.dispose();
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
    }
}
