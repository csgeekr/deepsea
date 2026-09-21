const DEFAULT_AUDIO_URL = new URL('../../voice.m4a', import.meta.url).href;

export class AudioController {
  private ctx: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  
  private targetVolume = 0;
  private currentVolume = 0;

  constructor(private audioSourceUrl: string | null) {}

  async init() {
    this.ctx = new window.AudioContext();
    
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(this.ctx.destination);

    const audioUrl = this.audioSourceUrl || DEFAULT_AUDIO_URL;
    this.audioElement = new Audio(audioUrl);
    this.audioElement.loop = true;
    this.audioElement.crossOrigin = "anonymous";
    this.mediaSource = this.ctx.createMediaElementSource(this.audioElement);
    this.mediaSource.connect(this.gainNode);
    
    try {
      await this.audioElement.play();
    } catch (e) {
      console.warn("Autoplay prevented", e);
    }
  }

  updateSpeed(speed: number) {
    // Map speed to volume (0.0 to 1.0)
    const normalizedSpeed = Math.min(Math.max(speed / 30, 0.0), 1.0);
    
    // Smooth volume transition
    this.targetVolume = 0.1 + normalizedSpeed * 0.9;
    this.currentVolume += (this.targetVolume - this.currentVolume) * 0.1;

    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.1);
    }
  }

  dispose() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.removeAttribute('src');
    }
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
