import * as THREE from 'three';

export class CursorGroundEffect {
    public group: THREE.Group;
    private particles: THREE.Points;
    private particleCount: number = 60; // more detail
    private startTime: number;
    private angle: number = 0;

    private band: THREE.Line;
    private bandPositions: Float32Array;
    private bandAlphas: Float32Array;

    constructor() {
        this.startTime = Date.now();
        this.group = new THREE.Group();
        this.group.position.set(0, 0, 0.1); // Just above ground

        // ---------- PARTICLE TRAIL (asteroid + tail) ----------
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const sizes = new Float32Array(this.particleCount);
        const alphas = new Float32Array(this.particleCount);
        const colors = new Float32Array(this.particleCount * 3);
        const kinds = new Float32Array(this.particleCount); // 0 = core, 1 = smoky tail, 2 = spark

        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            positions[i3] = 0;
            positions[i3 + 1] = 0;
            positions[i3 + 2] = 0;

            const t = i / (this.particleCount - 1);

            // Head big, tail small
            sizes[i] = THREE.MathUtils.lerp(0.35, 0.05, t);
            alphas[i] = 0.15 + 0.85 * (1.0 - t);

            // Base cyan-ish
            colors[i3] = 0.3;
            colors[i3 + 1] = 0.8;
            colors[i3 + 2] = 1.0;

            // Kinds: first = asteroid core, then mix of smoky + sparks
            if (i === 0) {
                kinds[i] = 0.0; // core
            } else if (i % 7 === 0) {
                kinds[i] = 2.0; // spark
            } else {
                kinds[i] = 1.0; // smoky / comet tail
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('kind', new THREE.BufferAttribute(kinds, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
            },
            vertexShader: `
                attribute float size;
                attribute float alpha;
                attribute vec3 color;
                attribute float kind;

                varying float vAlpha;
                varying vec3 vColor;
                varying float vKind;
                varying vec2 vUvPoint;

                void main() {
                    vAlpha = alpha;
                    vColor = color;
                    vKind = kind;

                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    float dist = max(-mvPosition.z, 0.1);

                    gl_PointSize = size * 150.0 / dist;
                    gl_Position = projectionMatrix * mvPosition;

                    // store fake UV; we'll reconstruct from gl_PointCoord in frag
                    vUvPoint = vec2(0.0);
                }
            `,
            fragmentShader: `
                precision highp float;

                uniform float uTime;

                varying float vAlpha;
                varying vec3 vColor;
                varying float vKind;

                // simple hash for sparkles
                float hash(vec2 p) {
                    p = fract(p * vec2(123.34, 456.21));
                    p += dot(p, p + 45.32);
                    return fract(p.x * p.y);
                }

                void main() {
                    vec2 uv = gl_PointCoord - 0.5;
                    float dist = length(uv);

                    // Shared shapes
                    float core = smoothstep(0.28, 0.0, dist);  // hard bright inner
                    float halo = smoothstep(0.7, 0.0, dist);   // softer halo

                    // Directional stretch for "tail" type
                    vec2 stretchedUv = vec2(uv.x * 0.4, uv.y * 1.8);
                    float streak = smoothstep(0.4, 0.0, length(stretchedUv));

                    // Star-like rays for core
                    float angle = atan(uv.y, uv.x);
                    float rayPattern = sin(angle * 10.0 + uTime * 4.0) * 0.5 + 0.5;
                    float rays = rayPattern * core * 0.7;

                    // Sparkle using hash + time
                    float sparkSeed = hash(uv * 40.0 + uTime * 3.0);
                    float spark = smoothstep(0.92, 1.0, sparkSeed) * core;

                    // Magic tint shifting over time
                    float hueShift = 0.5 + 0.5 * sin(uTime * 1.8 + angle * 2.0);
                    vec3 magicTint = mix(vec3(0.8, 0.5, 1.2), vec3(0.2, 1.0, 0.8), hueShift);

                    vec3 baseColor = vColor + magicTint * 0.45;

                    float brightness = 0.0;

                    // Different behavior per kind
                    if (vKind < 0.5) {
                        // Asteroid core: chunky, bright, ray-y
                        brightness = core * 1.8 + halo * 0.8 + rays * 1.0;
                        baseColor *= vec3(1.2, 1.1, 1.0);
                    } else if (vKind < 1.5) {
                        // Smoky tail
                        float noise = hash(uv * 20.0 + uTime);
                        float flicker = 0.8 + 0.2 * sin(uTime * 6.0 + noise * 10.0);
                        brightness = halo * 1.2 + streak * 1.3;
                        brightness *= flicker;
                        baseColor *= vec3(0.7, 0.9, 1.1);
                    } else {
                        // Spark particles
                        brightness = core * 0.4 + halo * 0.3 + spark * 2.5;
                        baseColor *= vec3(1.6, 1.5, 1.3);
                    }

                    float alpha = brightness * vAlpha;

                    if (dist > 0.55 || alpha < 0.02) {
                        discard;
                    }

                    vec3 color = baseColor * brightness;
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.particles = new THREE.Points(geometry, material);
        this.group.add(this.particles);

        // ---------- LIGHT BAND ORBIT ----------
        const bandGeometry = new THREE.BufferGeometry();
        this.bandPositions = new Float32Array(this.particleCount * 3);
        this.bandAlphas = new Float32Array(this.particleCount);

        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            this.bandPositions[i3] = 0;
            this.bandPositions[i3 + 1] = 0;
            this.bandPositions[i3 + 2] = 0;

            const t = i / (this.particleCount - 1);
            this.bandAlphas[i] = (1.0 - t) * 0.7; // fade into distance
        }

        bandGeometry.setAttribute('position', new THREE.BufferAttribute(this.bandPositions, 3));
        bandGeometry.setAttribute('alpha', new THREE.BufferAttribute(this.bandAlphas, 1));

        const bandMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
            },
            vertexShader: `
                attribute float alpha;
                varying float vAlpha;

                void main() {
                    vAlpha = alpha;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                precision highp float;
                varying float vAlpha;

                void main() {
                    // thin soft blue-white band
                    gl_FragColor = vec4(0.6, 0.9, 1.2, vAlpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.band = new THREE.Line(bandGeometry, bandMaterial);
        this.group.add(this.band);

        this.group.visible = true;
    }

    public update(worldX: number, worldY: number, visible: boolean = true) {
        const elapsed = (Date.now() - this.startTime) / 1000;

        // Orbit motion
        this.angle -= 0.08;

        // ---- PERSPECTIVE-LIKE ORBIT SHAPE ----
        // Think of this as a 3D circle tilted + squashed
        const baseRadius = 0.9;          // overall orbit radius
        const verticalSquash = 0.45;     // squash factor for "ellipse" in screen space
        const depthAmplitude = 0.35;     // how much it moves in Z
        const perspectiveStrength = 0.45; // how much the far side gets visually "smaller"

        const orbitAngle = this.angle;

        // Depth around the orbit (−1 = far, +1 = near)
        const depth = Math.sin(orbitAngle);

        // Scale orbit so far side looks tighter, near side more open
        const perspectiveScale = 1.0 - perspectiveStrength * depth;

        // Local orbit coordinates (before group offset)
        const localX = Math.cos(orbitAngle) * baseRadius * perspectiveScale;
        const localY = Math.sin(orbitAngle) * baseRadius * verticalSquash * perspectiveScale;

        // Move asteroid up/down in Z so far side is deeper into space
        const localZ = 0.05 + depth * depthAmplitude;

        // ---------- ASTEROID + TAIL PARTICLES ----------
        const geom = this.particles.geometry as THREE.BufferGeometry;
        const positions = geom.attributes.position.array as Float32Array;
        const sizes = geom.attributes.size.array as Float32Array;
        const colors = geom.attributes.color.array as Float32Array;

        // Shift trail particles back
        for (let i = this.particleCount - 1; i > 0; i--) {
            const i3 = i * 3;
            const j3 = (i - 1) * 3;
            positions[i3] = positions[j3];
            positions[i3 + 1] = positions[j3 + 1];
            positions[i3 + 2] = positions[j3 + 2];
        }

        // Head = asteroid (now on the perspective orbit)
        positions[0] = localX;
        positions[1] = localY;
        positions[2] = localZ;

        // Pulsing asteroid size
        const pulse = Math.sin(elapsed * 8) * 0.15 + 1.0;
        sizes[0] = 0.45 * pulse;

        // Head color: hot white with a slight warm tint
        colors[0] = 1.1;
        colors[1] = 1.0;
        colors[2] = 0.9;

        geom.attributes.position.needsUpdate = true;
        geom.attributes.size.needsUpdate = true;
        geom.attributes.color.needsUpdate = true;

        // Update shader time
        (this.particles.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;

        // ---------- LIGHT BAND (TRACE) ----------
        for (let i = this.particleCount - 1; i > 0; i--) {
            const i3 = i * 3;
            const j3 = (i - 1) * 3;
            this.bandPositions[i3] = this.bandPositions[j3];
            this.bandPositions[i3 + 1] = this.bandPositions[j3 + 1];
            this.bandPositions[i3 + 2] = this.bandPositions[j3 + 2];
        }

        // Newest band point follows orbit (slightly closer to ground than head)
        this.bandPositions[0] = localX;
        this.bandPositions[1] = localY;
        this.bandPositions[2] = localZ * 0.4; // flatter, so it feels like a ground-glow band

        (this.band.geometry as THREE.BufferGeometry).attributes.position.needsUpdate = true;
        ((this.band.material as THREE.ShaderMaterial).uniforms.uTime.value as number) = elapsed;

        // ---------- GROUP WORLD POSITION ----------
        this.group.position.x = worldX;
        this.group.position.y = worldY;
        this.group.visible = visible;
    }


    public dispose() {
        this.particles.geometry.dispose();
        (this.particles.material as THREE.Material).dispose();
        this.band.geometry.dispose();
        (this.band.material as THREE.Material).dispose();
    }
}
