import type { SfxName } from '../engine/types'

export interface AudioSettings {
  master: number
  sfx: number
  music: number
}

type OscType = OscillatorType

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private noise: AudioBuffer | null = null
  private musicTimer: number | null = null
  private musicStep = 0
  private settings: AudioSettings

  constructor(settings: AudioSettings) {
    this.settings = { ...settings }
  }

  ensure(): AudioContext | null {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      const ctx = new Ctor()
      this.ctx = ctx
      this.master = ctx.createGain()
      this.master.connect(ctx.destination)
      this.sfxBus = ctx.createGain()
      this.sfxBus.connect(this.master)
      this.musicBus = ctx.createGain()
      this.musicBus.connect(this.master)
      this.noise = this.createNoise(ctx)
      this.applyVolumes()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setVolumes(settings: AudioSettings): void {
    this.settings = { ...settings }
    this.applyVolumes()
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus) return
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(Math.max(0, this.settings.master), t, 0.02)
    this.sfxBus.gain.setTargetAtTime(Math.max(0, this.settings.sfx), t, 0.02)
    this.musicBus.gain.setTargetAtTime(Math.max(0, this.settings.music) * 0.5, t, 0.05)
  }

  private createNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  private tone(
    freq: number,
    duration: number,
    type: OscType,
    gain: number,
    endFreq?: number,
    startAt = 0,
    bus: 'sfx' | 'music' = 'sfx',
  ): void {
    const ctx = this.ctx
    const destination = bus === 'sfx' ? this.sfxBus : this.musicBus
    if (!ctx || !destination) return
    const t0 = ctx.currentTime + startAt
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(Math.max(20, freq), t0)
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration)
    }
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    osc.connect(env)
    env.connect(destination)
    osc.start(t0)
    osc.stop(t0 + duration + 0.02)
  }

  private noiseBurst(
    duration: number,
    gain: number,
    filter: BiquadFilterType,
    freq: number,
    endFreq?: number,
    startAt = 0,
  ): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxBus || !this.noise) return
    const t0 = ctx.currentTime + startAt
    const source = ctx.createBufferSource()
    source.buffer = this.noise
    const biquad = ctx.createBiquadFilter()
    biquad.type = filter
    biquad.frequency.setValueAtTime(freq, t0)
    if (endFreq !== undefined) {
      biquad.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t0 + duration)
    }
    biquad.Q.value = 0.9
    const env = ctx.createGain()
    env.gain.setValueAtTime(Math.max(0.0002, gain), t0)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    source.connect(biquad)
    biquad.connect(env)
    env.connect(this.sfxBus)
    source.start(t0)
    source.stop(t0 + duration + 0.02)
  }

  play(name: SfxName): void {
    const ctx = this.ensure()
    if (!ctx) return
    switch (name) {
      case 'cannon':
        this.noiseBurst(0.2, 0.4, 'lowpass', 1100, 180)
        this.tone(150, 0.24, 'sine', 0.35, 45)
        break
      case 'mg':
        this.noiseBurst(0.055, 0.22, 'highpass', 1500)
        this.tone(340, 0.04, 'square', 0.08, 220)
        break
      case 'rocket':
        this.noiseBurst(0.42, 0.3, 'bandpass', 600, 1800)
        this.tone(210, 0.36, 'sawtooth', 0.12, 70)
        break
      case 'spread':
        this.noiseBurst(0.18, 0.32, 'bandpass', 1400, 500)
        this.tone(190, 0.16, 'square', 0.1, 90)
        break
      case 'explosion':
        this.noiseBurst(0.7, 0.5, 'lowpass', 900, 90)
        this.tone(95, 0.55, 'sine', 0.4, 28)
        break
      case 'hit':
        this.tone(880, 0.09, 'triangle', 0.16, 520)
        this.noiseBurst(0.06, 0.12, 'highpass', 2400)
        break
      case 'pickup':
        this.tone(520, 0.09, 'sine', 0.18, 780)
        this.tone(780, 0.12, 'sine', 0.14, 1040, 0.07)
        break
      case 'death':
        this.tone(180, 0.45, 'sawtooth', 0.28, 40)
        this.noiseBurst(0.5, 0.35, 'lowpass', 700, 80)
        break
      case 'overdrive':
        this.tone(170, 0.3, 'sawtooth', 0.16, 560)
        break
      case 'ui':
        this.tone(760, 0.045, 'square', 0.07, 620)
        break
      case 'win':
        ;[523, 659, 784, 1047].forEach((f, i) =>
          this.tone(f, 0.22, 'triangle', 0.2, undefined, i * 0.13),
        )
        break
      case 'lose':
        ;[392, 330, 262, 196].forEach((f, i) =>
          this.tone(f, 0.28, 'sawtooth', 0.16, undefined, i * 0.15),
        )
        break
      case 'wave':
        this.tone(440, 0.16, 'square', 0.12, 660)
        this.tone(660, 0.2, 'square', 0.1, 880, 0.16)
        break
    }
  }

  startMusic(): void {
    const ctx = this.ensure()
    if (!ctx || this.musicTimer !== null) return
    const notes = [110, 146.83, 130.81, 98]
    const tick = (): void => {
      if (!this.ctx) return
      const root = notes[this.musicStep % notes.length]
      this.tone(root / 2, 1.15, 'sine', 0.22, undefined, 0, 'music')
      this.tone(root * 2, 0.32, 'triangle', 0.06, undefined, 0.02, 'music')
      this.tone(root * 3, 0.24, 'triangle', 0.04, undefined, 0.62, 'music')
      if (this.musicStep % 4 === 2) {
        this.tone(root * 4, 0.18, 'sine', 0.035, undefined, 0.92, 'music')
      }
      this.musicStep++
    }
    tick()
    this.musicTimer = window.setInterval(tick, 1200)
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer)
      this.musicTimer = null
    }
  }

  destroy(): void {
    this.stopMusic()
    if (this.ctx) {
      void this.ctx.close()
      this.ctx = null
    }
    this.master = null
    this.sfxBus = null
    this.musicBus = null
    this.noise = null
  }
}