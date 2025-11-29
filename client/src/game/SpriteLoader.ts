import * as THREE from 'three';

export interface SpriteAnimation {
    name: string;
    frames: number[]; // Indices of frames
    frameRate: number;
    loop: boolean;
}

export interface SpriteData {
    id: string;
    name: string;
    type: string;
    texture: string;
    frameWidth: number;
    frameHeight: number;
    animations: Record<string, SpriteAnimation>;
    pivot?: { x: number; y: number };
    offsetX?: number;
    offsetY?: number;
    spacingX?: number;
    spacingY?: number;
}

export class SpriteLoader {
    private sprites: Map<string, SpriteData> = new Map();
    private textures: Map<string, THREE.Texture> = new Map();
    private textureLoader = new THREE.TextureLoader();

    async loadSprite(id: string, jsonPath: string, texturePath: string): Promise<void> {
        try {
            // Load JSON data
            const response = await fetch(jsonPath);
            const data: SpriteData = await response.json();
            this.loadSpriteFromData(data, texturePath);
        } catch (error) {
            console.error(`Failed to load sprite ${id}:`, error);
        }
    }

    async loadSpriteFromData(data: SpriteData, texturePath?: string): Promise<void> {
        try {
            this.sprites.set(data.id, data);

            // Use provided texture path or fallback to default if not present in data (though data.texture is string)
            // Actually, data.texture usually contains the filename. We need the full path.
            // If texturePath is provided, use it. Otherwise construct it.
            const path = texturePath || `/assets/sprites/${data.texture}`;

            // Load texture
            const texture = await this.loadTexture(path);
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.colorSpace = THREE.SRGBColorSpace;
            this.textures.set(data.id, texture);

            console.log(`Loaded sprite: ${data.id}`);
        } catch (error) {
            console.error(`Failed to load sprite data ${data.id}:`, error);
        }
    }

    private loadTexture(path: string): Promise<THREE.Texture> {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                path,
                (texture) => {
                    resolve(texture);
                },
                undefined,
                (error) => reject(error)
            );
        });
    }

    getSprite(id: string): SpriteData | undefined {
        return this.sprites.get(id);
    }

    getTexture(id: string): THREE.Texture | undefined {
        const texture = this.textures.get(id);
        if (!texture && this.textures.size > 0) {
            console.warn(`Texture not found for id: "${id}". Available keys:`, Array.from(this.textures.keys()));
        }
        return texture;
    }

    hasTextures(): boolean {
        return this.textures.size > 0;
    }

    // Calculate UVs for a specific frame index
    getFrameUVs(spriteId: string, frameIndex: number): number[] | undefined {
        const sprite = this.sprites.get(spriteId);
        const texture = this.textures.get(spriteId);
        if (!sprite || !texture || !texture.image) return undefined;

        const img = texture.image as HTMLImageElement;
        const imgWidth = img.width;
        const imgHeight = img.height;

        const offsetX = sprite.offsetX || 0;
        const offsetY = sprite.offsetY || 0;
        const spacingX = sprite.spacingX || 0;
        const spacingY = sprite.spacingY || 0;

        // Calculate effective grid size including spacing
        // Note: Spacing is usually between frames.
        // If we assume standard grid:
        // x = offsetX + col * (frameWidth + spacingX)
        // y = offsetY + row * (frameHeight + spacingY)

        const strideX = sprite.frameWidth + spacingX;
        const strideY = sprite.frameHeight + spacingY;

        // Calculate number of columns based on stride
        // Available width for columns = imgWidth - offsetX
        // cols = floor(available / strideX)
        // But be careful if spacing is only *between* frames.
        // Usually stride logic is safer: col = index % cols.
        // How many cols fit?
        const cols = Math.floor((imgWidth - offsetX + spacingX) / strideX);

        if (cols === 0) return undefined;

        const col = frameIndex % cols;
        const row = Math.floor(frameIndex / cols);

        const x = offsetX + col * strideX;
        const y = offsetY + row * strideY;

        // UV coordinates (0-1)
        // Texture coords are top-left (y=0 at top), UVs are bottom-left (v=0 at bottom).
        // So v = 1 - (y / height).

        const u1 = x / imgWidth;
        const u2 = (x + sprite.frameWidth) / imgWidth;

        // Top edge of frame (smaller y in image space -> larger v in UV space)
        const v2 = 1 - (y / imgHeight);
        // Bottom edge of frame (larger y in image space -> smaller v in UV space)
        const v1 = 1 - ((y + sprite.frameHeight) / imgHeight);

        return [
            u1, v2, // Top Left
            u2, v2, // Top Right
            u1, v1, // Bottom Left
            u2, v1  // Bottom Right
        ];
    }
}
