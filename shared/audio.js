// Audio manager using Web Audio API
class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.masterVolume = 0.5;
    this.muted = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.ctx.createGain();
    this.gainNode.connect(this.ctx.destination);
    this.gainNode.gain.value = this.masterVolume;
    this.initialized = true;
  }

  // Ensure audio context is running (call on first user interaction)
  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  async loadSound(key, url) {
    this.init();
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers[key] = audioBuffer;
    } catch (e) {
      console.warn(`Failed to load sound: ${key} from ${url}`);
    }
  }

  play(key, volume = 1, playbackRate = 1) {
    if (this.muted || !this.ctx || !this.buffers[key]) return;
    this.resume();
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = this.buffers[key];
    source.playbackRate.value = playbackRate;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.gainNode);
    source.start(0);
    return source;
  }

  // Generate a simple programmatic sound effect
  playTone(frequency = 440, duration = 0.1, type = "square", volume = 0.3) {
    if (this.muted || !this.ctx) return;
    this.init();
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = volume * this.masterVolume;
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.ctx.currentTime + duration,
    );
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // Common game sound presets
  playShoot() {
    this.playTone(800, 0.08, "square", 0.2);
  }
  playHit() {
    this.playTone(200, 0.15, "sawtooth", 0.3);
  }
  playExplosion() {
    this.playTone(100, 0.3, "sawtooth", 0.4);
    this.playTone(60, 0.4, "square", 0.3);
  }
  playPickup() {
    this.playTone(600, 0.05, "sine", 0.2);
    this.playTone(900, 0.1, "sine", 0.2);
  }
  playJump() {
    this.playTone(300, 0.1, "triangle", 0.2);
  }
  playDeath() {
    this.playTone(200, 0.1, "sawtooth", 0.3);
    this.playTone(100, 0.3, "sawtooth", 0.4);
  }

  setVolume(v) {
    this.masterVolume = v;
    if (this.gainNode) this.gainNode.gain.value = v;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}

// Global Audio compatibility layer for games that call Audio.playTone() directly
const Audio = new AudioManager();
Audio.init();
