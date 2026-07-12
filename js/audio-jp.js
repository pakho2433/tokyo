/**
 * Procedural Japanese street ambience (Web Audio API + SpeechSynthesis).
 * - 横断歩道 ピヨピヨ
 * - コンビニ入店チャイム（FamilyMart / 7-Eleven / Lawson 風・原創）
 * - 電車接近メロディ・到着音
 * - 駅アナウンス（日語語音合成）
 * No licensed audio assets.
 */

export class TokyoAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this.muted = false;
    this._started = false;
    this._ambientNodes = [];
    this._lastKonbini = 0;
    this._lastStationAnnounce = 0;
    this._lastTrainArrive = 0;
    this._walkPhase = 0;
    this._walkTimer = 0;
    this._walkGreenSec = 18;
    this._walkRedSec = 22;
    this._piyoAcc = 0;
    this._konbiniInside = false;
    this._inStation = false;
    this._trainApproachPlaying = false;
    this._speechReady = typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  async ensure() {
    if (this._started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.4;
      this.master.connect(this.ctx.destination);
      this._started = true;
      this.enabled = true;
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this._startAmbient();
      // Warm speech voices
      if (this._speechReady) {
        try {
          window.speechSynthesis.getVoices();
        } catch {
          /* ignore */
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.4;
    if (m && this._speechReady) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* */
      }
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _startAmbient() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.08;
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    noise.start();
    this._ambientNodes.push(noise, filter, g);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 58;
    const og = ctx.createGain();
    og.gain.value = 0.012;
    osc.connect(og);
    og.connect(this.master);
    osc.start();
    this._ambientNodes.push(osc, og);
  }

  _beep(freq, duration, when, gain = 0.12, type = 'sine') {
    if (!this.ctx || this.muted) return;
    const t0 = when ?? this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + Math.max(duration, 0.02));
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  _playPiyoBurst() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this._beep(1760, 0.09, t, 0.1, 'sine');
    this._beep(1397, 0.09, t + 0.12, 0.1, 'sine');
  }

  /**
   * Brand-flavoured enter chimes (original melodies inspired by JP konbini).
   * brand: 'familymart' | 'seven' | 'lawson'
   */
  playKonbiniEnter(brand = 'familymart') {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (now - this._lastKonbini < 3500) return;
    this._lastKonbini = now;
    const t = this.ctx.currentTime;

    if (brand === 'familymart') {
      // Bright rising electronic welcome (green-store vibe)
      const notes = [
        { f: 659.25, d: 0.1, o: 0, g: 0.13 },
        { f: 783.99, d: 0.1, o: 0.1, g: 0.13 },
        { f: 987.77, d: 0.12, o: 0.2, g: 0.14 },
        { f: 1174.66, d: 0.16, o: 0.34, g: 0.15 },
        { f: 1318.51, d: 0.22, o: 0.52, g: 0.12 },
        { f: 1567.98, d: 0.28, o: 0.72, g: 0.1 },
      ];
      notes.forEach((n) => {
        this._beep(n.f, n.d, t + n.o, n.g, 'triangle');
        this._beep(n.f * 2, n.d * 0.5, t + n.o, n.g * 0.25, 'sine');
      });
    } else if (brand === 'seven') {
      // Two-tone classic door sensor + sparkle
      this._beep(880, 0.18, t, 0.16, 'square');
      this._beep(1174.7, 0.22, t + 0.16, 0.14, 'square');
      this._beep(1318.5, 0.14, t + 0.38, 0.1, 'triangle');
      this._beep(1760, 0.2, t + 0.5, 0.08, 'sine');
      // Soft store bed
      this._beep(440, 0.6, t + 0.05, 0.04, 'sine');
    } else {
      // Lawson-ish cool blue arpeggio
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        this._beep(f, 0.14, t + i * 0.11, 0.12, 'triangle');
      });
      this._beep(1318.5, 0.3, t + 0.5, 0.09, 'sine');
    }

    // Door whoosh
    this._noiseBurst(0.12, 0.06, t, 1800);
  }

  /** @deprecated use playKonbiniEnter */
  playKonbiniChime() {
    this.playKonbiniEnter('familymart');
  }

  _noiseBurst(duration, gain, when, freq = 1200) {
    if (!this.ctx || this.muted) return;
    const t0 = when ?? this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  /** JR-style approach / arrival melody (original, Shibuya-flavoured) */
  playTrainApproach() {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (now - this._lastTrainArrive < 8000) return;
    this._lastTrainArrive = now;
    const t = this.ctx.currentTime;

    // Attention chimes
    const melody = [
      { f: 784, o: 0 },
      { f: 880, o: 0.18 },
      { f: 988, o: 0.36 },
      { f: 1175, o: 0.54 },
      { f: 988, o: 0.78 },
      { f: 880, o: 0.96 },
      { f: 784, o: 1.14 },
      { f: 659, o: 1.4 },
    ];
    melody.forEach((n) => {
      this._beep(n.f, 0.2, t + n.o, 0.11, 'sine');
      this._beep(n.f * 2, 0.12, t + n.o, 0.03, 'triangle');
    });

    // Low rumble of train
    setTimeout(() => this._trainRumble(1.8), 400);
  }

  playTrainArrival() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Door open ding-dong
    this._beep(1046.5, 0.25, t, 0.14, 'sine');
    this._beep(1318.5, 0.35, t + 0.28, 0.12, 'sine');
    this._noiseBurst(0.35, 0.05, t + 0.1, 600);
    this._trainRumble(0.8);
  }

  _trainRumble(duration = 1.5) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, t0);
    osc.frequency.linearRampToValueAtTime(40, t0 + duration);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 180;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.07, t0 + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(f);
    f.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  playAttentionChime() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [880, 1108, 1318].forEach((f, i) => {
      this._beep(f, 0.2, t + i * 0.15, 0.08, 'sine');
    });
  }

  /** Japanese station / konbini announcements via SpeechSynthesis */
  speakJapanese(text, opts = {}) {
    if (!this._speechReady || this.muted || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = opts.lang || 'ja-JP';
      u.rate = opts.rate ?? 0.95;
      u.pitch = opts.pitch ?? 1.05;
      u.volume = opts.volume ?? 0.85;
      const voices = window.speechSynthesis.getVoices();
      const ja = voices.find((v) => v.lang.startsWith('ja'));
      if (ja) u.voice = ja;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }

  announceTrainArrival(stationName = '渋谷') {
    const now = performance.now();
    if (now - this._lastStationAnnounce < 12000) return;
    this._lastStationAnnounce = now;
    this.playTrainArrival();
    // Familiar Japanese platform reminder style (generic wording)
    const lines = [
      `まもなく、1番線に、各駅停車、がまいります。危ないですから、黄色い線まで、お下がりください。`,
      `${stationName}、${stationName}。お出口は、左側です。`,
      `電車がまいります。ご注意ください。`,
    ];
    const line = lines[Math.floor(Math.random() * lines.length)];
    setTimeout(() => this.speakJapanese(line, { rate: 0.92 }), 600);
  }

  announceEnterStation(stationName = '渋谷') {
    this.playAttentionChime();
    this.speakJapanese(`${stationName}駅です。ご利用くださいまして、ありがとうございます。`, {
      rate: 0.95,
    });
  }

  announceKonbiniWelcome(brand = 'familymart') {
    const map = {
      familymart: 'いらっしゃいませ。',
      seven: 'いらっしゃいませ。',
      lawson: 'いらっしゃいませ。',
    };
    this.speakJapanese(map[brand] || map.familymart, { rate: 1.05, pitch: 1.1 });
  }

  /**
   * @param {number} dt
   * @param {{x:number,z:number}} pos
   * @param {object} worldHooks
   */
  update(dt, pos, worldHooks = {}, isNight = false) {
    if (!this.enabled || !this.ctx) return;

    const {
      konbiniPositions = [],
      stationZones = [],
      trainEvents = null,
      insideKonbini = null,
      insideStation = false,
    } = worldHooks;

    const distCenter = Math.hypot(pos.x, pos.z);
    this._walkTimer += dt;
    const cycle = this._walkGreenSec + this._walkRedSec;
    const phaseT = this._walkTimer % cycle;
    const isGreen = phaseT < this._walkGreenSec;
    this._walkPhase = isGreen ? 1 : 0;

    if (isGreen && distCenter < 45 && !insideStation && !insideKonbini) {
      this._piyoAcc += dt;
      const rate = isNight ? 0.48 : 0.55;
      if (this._piyoAcc >= rate) {
        this._piyoAcc = 0;
        const volScale = Math.max(0.15, 1 - distCenter / 45);
        if (volScale > 0.2) this._playPiyoBurst();
      }
    } else {
      this._piyoAcc = 0;
    }

    // Near konbini entrance (outside only)
    if (!insideKonbini) {
      for (const k of konbiniPositions) {
        const d = Math.hypot(pos.x - k.x, pos.z - k.z);
        if (d < 6.5) {
          // Don't auto-play enter here — main triggers on enter zone
          break;
        }
      }
    }

    // Station proximity ambient ping
    this._inStation = !!insideStation;
    for (const s of stationZones) {
      const d = Math.hypot(pos.x - s.x, pos.z - s.z);
      if (d < (s.radius || 12) && !insideStation) {
        // Soft waiting-room hum handled by ambient
        break;
      }
    }

    if (trainEvents?.justArrived) {
      this.announceTrainArrival(trainEvents.stationName || '渋谷');
    } else if (trainEvents?.approaching) {
      this.playTrainApproach();
    }

    if (this._ambientNodes[2] && this._ambientNodes[2].gain) {
      let g = isNight ? 0.11 : 0.07;
      if (insideKonbini) g = 0.04;
      if (insideStation) g = 0.09;
      this._ambientNodes[2].gain.value = g;
    }
  }

  get crosswalkGreen() {
    return this._walkPhase === 1;
  }
}
