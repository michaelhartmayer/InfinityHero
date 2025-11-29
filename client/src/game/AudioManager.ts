export class AudioManager {
    private static instance: AudioManager;
    private audio: HTMLAudioElement;
    private isMuted: boolean = false;
    private currentUrl: string | null = null;
    private baseVolume: number = 0.5;
    private wasPlayingBeforeBlur: boolean = false;
    private hasInteracted: boolean = false;

    private audioContext: AudioContext | null = null;
    private bufferCache: Map<string, AudioBuffer> = new Map();

    private constructor() {
        this.audio = new Audio();

        // Initialize AudioContext on interaction
        const initAudioContext = () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        };

        // Handle window focus/blur
        window.addEventListener('blur', () => {
            if (!this.audio.paused) {
                this.wasPlayingBeforeBlur = true;
                this.audio.pause();
            } else {
                this.wasPlayingBeforeBlur = false;
            }
            if (this.audioContext && this.audioContext.state === 'running') {
                this.audioContext.suspend();
            }
        });

        window.addEventListener('focus', () => {
            if (this.wasPlayingBeforeBlur && !this.isMuted) {
                this.tryPlay();
            }
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        });

        // Handle autoplay policy
        const unlockAudio = () => {
            initAudioContext();
            this.hasInteracted = true;
            if (this.currentUrl && this.audio.paused && !this.isMuted) {
                this.tryPlay();
            }
            // Remove listeners once interacted
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };

        window.addEventListener('click', unlockAudio);
        window.addEventListener('keydown', unlockAudio);
    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    private async tryPlay() {
        console.log('AudioManager: tryPlay called');
        try {
            await this.audio.play();
            console.log('AudioManager: Playback started successfully');
        } catch (e) {
            console.warn('AudioManager: Audio play failed (likely autoplay policy):', e);
        }
    }

    public playMusic(url: string, volume: number = 0.5, loop: boolean = true) {
        console.log(`AudioManager: playMusic called for ${url}, vol=${volume}, loop=${loop}`);
        if (this.currentUrl === url) {
            console.log('AudioManager: Already playing this track');
            return;
        }

        this.currentUrl = url;
        this.baseVolume = volume;
        this.audio.src = url;
        this.audio.volume = this.isMuted ? 0 : volume;
        this.audio.loop = loop;

        if (!this.isMuted) {
            this.tryPlay();
        } else {
            console.log('AudioManager: Muted, not playing yet');
        }
    }

    public stopMusic() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.currentUrl = null;
    }

    public setMuted(muted: boolean) {
        this.isMuted = muted;
        if (muted) {
            this.audio.volume = 0;
        } else {
            this.audio.volume = this.baseVolume;
            if (this.currentUrl && this.audio.paused) {
                this.tryPlay();
            }
        }
    }

    public toggleMute(): boolean {
        this.setMuted(!this.isMuted);
        return this.isMuted;
    }

    public isMusicMuted(): boolean {
        return this.isMuted;
    }

    private async loadBuffer(url: string): Promise<AudioBuffer | null> {
        if (this.bufferCache.has(url)) {
            return this.bufferCache.get(url)!;
        }

        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            if (!this.audioContext) return null;
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.bufferCache.set(url, audioBuffer);
            return audioBuffer;
        } catch (e) {
            console.warn(`Failed to load audio buffer: ${url}`, e);
            return null;
        }
    }

    public async playSFX(url: string, volume: number = 1.0) {
        if (this.isMuted || !this.audioContext) return;

        const buffer = await this.loadBuffer(url);
        if (!buffer) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;

        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        source.start(0);
    }

    public async playPositionalSFX(url: string, sourcePos: { x: number, y: number }, listenerPos: { x: number, y: number }, maxDistance: number = 20): Promise<{ source: AudioBufferSourceNode, gainNode: GainNode } | null> {
        console.log(`🔊 playPositionalSFX called: url=${url}, muted=${this.isMuted}, hasContext=${!!this.audioContext}`);

        if (this.isMuted || !this.audioContext) {
            console.log(`🔇 Skipping SFX: muted=${this.isMuted}, hasContext=${!!this.audioContext}`);
            return null;
        }

        const dx = sourcePos.x - listenerPos.x;
        const dy = sourcePos.y - listenerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        console.log(`📍 Distance: ${distance.toFixed(2)}, maxDistance: ${maxDistance}`);

        if (distance > maxDistance) {
            console.log(`🚫 Too far away, skipping`);
            return null;
        }

        const buffer = await this.loadBuffer(url);
        if (!buffer) {
            console.log(`❌ Failed to load buffer for ${url}`);
            return null;
        }

        console.log(`✅ Playing positional SFX at distance ${distance.toFixed(2)}`);

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;

        // Volume attenuation (Linear)
        const volume = Math.max(0, 1 - (distance / maxDistance));
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume;

        console.log(`🔉 Volume: ${volume.toFixed(2)}`);

        // Stereo Panning
        const panner = this.audioContext.createStereoPanner();
        // Simple panning: -1 (left) to 1 (right) based on X difference
        // Normalize x difference by some factor (e.g., 10 tiles = full pan)
        const pan = Math.max(-1, Math.min(1, dx / 10));
        panner.pan.value = pan;

        console.log(`🎚️ Pan: ${pan.toFixed(2)}`);

        source.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(this.audioContext.destination);

        source.start(0);

        return { source, gainNode };
    }

    public fadeOutSound(gainNode: GainNode, duration: number = 0.5) {
        if (!this.audioContext) return;

        const currentTime = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);
    }

    public async playLoopingSFX(url: string, volume: number = 1.0): Promise<{ source: AudioBufferSourceNode, gainNode: GainNode } | null> {
        if (this.isMuted || !this.audioContext) return null;

        const buffer = await this.loadBuffer(url);
        if (!buffer) return null;

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        source.start(0);

        return { source, gainNode };
    }
}
