'use strict';

/**
 * ============================================================
 * src/core/AudioManager.js — Web Audio API 音频引擎
 * 版本: 1.0
 * 职责: 合成音效 + BGM + 音频池 + 三路独立音量控制
 * 依赖: 零外部音频文件，全部使用 OscillatorNode 合成
 * ============================================================
 */

/* ============================================================
   常量
   ============================================================ */

/** @type {number} 最大并发音频节点数 */
const MAX_CONCURRENT = 16;

/** @type {boolean} 调试模式 */
const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/* ============================================================
   AudioManager 类
   ============================================================ */

class AudioManager {
  constructor() {
    /** @type {AudioContext|null} */
    this._ctx = null;

    /** @type {GainNode|null} 总音量 */
    this._masterGain = null;

    /** @type {GainNode|null} 音效音量 */
    this._sfxGain = null;

    /** @type {GainNode|null} BGM 音量 */
    this._bgmGain = null;

    /** @type {number} 当前活跃音频节点数 */
    this._activeCount = 0;

    /** @type {Object} 内部状态（音量配置） */
    this._state = {
      masterVolume: 1.0,
      sfxVolume: 1.0,
      bgmVolume: 0.7,
    };

    /** @type {Object|null} 当前 BGM 播放状态 */
    this._bgmState = null;

    /** @type {number|null} BGM 切换淡入淡出定时器 */
    this._fadeTimer = null;
  }

  /* ============================================================
     AudioContext 生命周期
     ============================================================ */

  /**
   * 获取或创建 AudioContext（懒初始化）
   * @returns {AudioContext|null}
   */
  _ensureContext() {
    if (this._ctx) return this._ctx;

    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;

      this._ctx = new AC();

      // 创建增益链：SFX/BGM → Master → Destination
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this._state.masterVolume;
      this._masterGain.connect(this._ctx.destination);

      this._sfxGain = this._ctx.createGain();
      this._sfxGain.gain.value = this._state.sfxVolume;
      this._sfxGain.connect(this._masterGain);

      this._bgmGain = this._ctx.createGain();
      this._bgmGain.gain.value = this._state.bgmVolume;
      this._bgmGain.connect(this._masterGain);

      if (DEBUG) console.log('[Audio] AudioContext 已创建');
    } catch (e) {
      console.warn('[Audio] 无法创建 AudioContext:', e.message);
      this._ctx = null;
      return null;
    }

    return this._ctx;
  }

  /**
   * 恢复 AudioContext（必须在用户交互后调用以遵守自动播放策略）
   * @returns {boolean} 是否成功恢复
   */
  resume() {
    const ctx = this._ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      ctx.resume();
      if (DEBUG) console.log('[Audio] AudioContext 已恢复');
    }
    return true;
  }

  /* ============================================================
     音效合成预设
     ============================================================ */

  /**
   * 创建合成音效
   * @param {string} type - 音效名称
   * @param {number} volume - 音量倍率 (0-1)
   */
  playSFX(type, volume = 1.0) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    // 并发限制
    if (this._activeCount >= MAX_CONCURRENT) {
      if (DEBUG) console.warn('[Audio] SFX 并发数已达上限 (' + MAX_CONCURRENT + ')');
      return;
    }

    // 找预设
    const synth = this._getSynthPreset(type);
    if (!synth) {
      if (DEBUG) console.warn('[Audio] 未知音效类型:', type);
      return;
    }

    this._activeCount++;
    const cleanup = () => {
      this._activeCount = Math.max(0, this._activeCount - 1);
    };

    try {
      synth(ctx, this._sfxGain, volume, cleanup);
    } catch (e) {
      if (DEBUG) console.warn('[Audio] SFX 播放失败:', type, e.message);
      cleanup();
    }
  }

  /**
   * 获取音效合成函数
   * @param {string} type
   * @returns {Function|null}
   */
  _getSynthPreset(type) {
    const presets = {
      // ---- click: 短促方波 800Hz 50ms ----
      click: (ctx, dest, vol, done) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.3 * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); done(); };
      },

      // ---- cast: 白噪音 + 低通滤波 → 水花声 ----
      cast: (ctx, dest, vol, done) => {
        const bufferSize = ctx.sampleRate * 0.3;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.6 * vol, ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1500;
        source.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(dest);
        source.start(ctx.currentTime);
        source.stop(ctx.currentTime + 0.3);
        source.onended = () => { source.disconnect(); filter.disconnect(); noiseGain.disconnect(); done(); };
      },

      // ---- bite: 上升音调 300→800Hz ----
      bite: (ctx, dest, vol, done) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.5 * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); done(); };
      },

      // ---- perfect: 清脆叮声 1200Hz 150ms 衰减 ----
      perfect: (ctx, dest, vol, done) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 1200;
        gain.gain.setValueAtTime(0.5 * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); done(); };
      },

      // ---- great: 中音咚 600Hz 200ms ----
      great: (ctx, dest, vol, done) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 600;
        gain.gain.setValueAtTime(0.4 * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); done(); };
      },

      // ---- miss: 白噪音快速衰减 ----
      miss: (ctx, dest, vol, done) => {
        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3 * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        source.connect(gain);
        gain.connect(dest);
        source.start(ctx.currentTime);
        source.stop(ctx.currentTime + 0.15);
        source.onended = () => { source.disconnect(); gain.disconnect(); done(); };
      },
    };

    return presets[type] || null;
  }

  /* ============================================================
     BGM 系统
     使用交叉淡入淡出过渡，消除切换间隙
     ============================================================ */

  /**
   * 播放背景音乐（交叉淡入淡出）
   * @param {string} trackId - 'title' | 'fishing'
   */
  playBGM(trackId) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    // 同一首正在播放 → 不做任何事
    if (this._bgmState && this._bgmState.trackId === trackId && !this._bgmState._stopping) {
      return;
    }

    // 标记旧 BGM 为停止中，并快速淡出（100ms）
    if (this._bgmState) {
      this._bgmState._stopping = true;
      const oldState = this._bgmState;
      if (oldState._interval) clearInterval(oldState._interval);

      // 300ms 后清理旧状态
      setTimeout(() => {
        if (oldState._bgmNodes) {
          for (const n of oldState._bgmNodes) {
            try { n.osc.stop(); } catch (e) {}
            try { n.osc.disconnect(); } catch (e) {}
            try { n.gain.disconnect(); } catch (e) {}
          }
        }
        oldState._bgmNodes = [];
      }, 350);
    }

    // 立即启动新 BGM（与旧 BGM 重叠 300ms 实现交叉淡入淡出）
    this._startBGM(trackId);
  }

  /** 启动新 BGM — Minecraft 风格：高音钟琴旋律 + 极简和声 */
  _startBGM(trackId) {
    const ctx = this._ctx;
    if (!ctx) return;

    const isTitle = trackId === 'title';
    const bpm = isTitle ? 72 : 100;
    const beatDuration = 60 / bpm;

    const state = {
      trackId,
      beat: 0,
      _interval: null,
      _stopping: false,
      _bgmNodes: [],
    };

    // 高八度旋律音符（C5=523, D5=587, E5=659, G5=784, A5=880）
    // title: 悠扬的五声音阶循环，每个音 2 拍
    const titleMelody = [523, 659, 784, 880, 784, 659, 523, 587, 659, 784, 880, 784, 659, 587, 523, 523];
    const fishingMelody = [523, 659, 784, 880, 784, 659, 523, 587, 659, 784, 880, 1047, 880, 784, 659, 587];

    // 背景和弦（极轻，纯为增加温暖感）
    // title: C 大调持续和弦（C4-E4-G4），半音阶移动
    const chordPadFreqs = [262, 330, 392]; // C4 E4 G4

    const notesPerLoop = isTitle ? titleMelody.length : fishingMelody.length;
    const melodyDuration = beatDuration * 2; // 每个音符 2 拍

    const scheduleNote = () => {
      if (state._stopping) return;

      const notes = isTitle ? titleMelody : fishingMelody;
      const noteIdx = state.beat % notesPerLoop;
      const freq = notes[noteIdx];
      const startTime = ctx.currentTime + 0.02;

      const nodes = [];

      // ---- 主旋律（钟琴音色：正弦波 + 快速起振 + 缓慢衰减）----
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // 稍微 detune 制造"温暖"感（±3 cents 随机偏移）
      osc.detune.value = (Math.random() - 0.5) * 6;

      // 钟琴包络：sharp attack → sustain → release
      const vol = isTitle ? 0.06 : 0.08;
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.015);       // 极快起音
      gain.gain.linearRampToValueAtTime(vol * 0.6, startTime + 0.1);   // 衰减到 sustain
      gain.gain.setValueAtTime(vol * 0.6, startTime + melodyDuration - 0.15);
      gain.gain.linearRampToValueAtTime(0.001, startTime + melodyDuration + 0.05);

      osc.connect(gain);
      gain.connect(this._bgmGain);
      osc.start(startTime);
      osc.stop(startTime + melodyDuration + 0.08);
      nodes.push({ osc, gain });

      // ---- 背景和声垫（极轻，仅在 title 中使用）----
      if (isTitle) {
        // 每 4 个主旋律音换一次和声
        const chordIdx = Math.floor(noteIdx / 4) % 4;
        const chordRoots = [262, 294, 349, 392]; // C4 D4 F4 G4
        const root = chordRoots[chordIdx];
        const padOsc = ctx.createOscillator();
        const padGain = ctx.createGain();
        padOsc.type = 'sine';
        padOsc.frequency.value = root;
        // 和声音量极轻，只有主旋律的 1/3
        padGain.gain.setValueAtTime(0.001, startTime);
        padGain.gain.linearRampToValueAtTime(0.018, startTime + 0.5);
        padGain.gain.setValueAtTime(0.018, startTime + melodyDuration * 4 - 0.3);
        padGain.gain.linearRampToValueAtTime(0.001, startTime + melodyDuration * 4);
        padOsc.connect(padGain);
        padGain.connect(this._bgmGain);
        padOsc.start(startTime);
        padOsc.stop(startTime + melodyDuration * 4);
        nodes.push({ osc: padOsc, gain: padGain });
      }

      state._bgmNodes = state._bgmNodes.concat(nodes);

      // 延迟清理节点
      const cleanupDelay = (melodyDuration + 1) * 1000;
      setTimeout(() => {
        for (const n of nodes) {
          try { n.osc.disconnect(); } catch (e) {}
          try { n.gain.disconnect(); } catch (e) {}
        }
        state._bgmNodes = state._bgmNodes.filter(n => !nodes.includes(n));
      }, cleanupDelay);

      state.beat++;
    };

    scheduleNote();
    state._interval = setInterval(scheduleNote, melodyDuration * 1000);

    this._bgmState = state;
    if (DEBUG) console.log('[Audio] BGM 开始:', trackId);
  }

  /**
   * 停止 BGM
   */
  stopBGM() {
    if (!this._bgmState) return;
    this._bgmState._stopping = true;
    const state = this._bgmState;
    if (state._interval) clearInterval(state._interval);
    if (state._bgmNodes) {
      for (const n of state._bgmNodes) {
        try { n.osc.stop(); } catch (e) {}
        try { n.osc.disconnect(); } catch (e) {}
        try { n.gain.disconnect(); } catch (e) {}
      }
      state._bgmNodes = [];
    }
    this._bgmState = null;
  }

  /* ============================================================
     音量控制
     ============================================================ */

  /**
   * 设置总音量
   * @param {number} value 0-1
   */
  setMasterVolume(value) {
    const v = Math.max(0, Math.min(1, value));
    this._state.masterVolume = v;
    if (this._masterGain) this._masterGain.gain.value = v;
  }

  /**
   * 设置音效音量
   * @param {number} value 0-1
   */
  setSFXVolume(value) {
    const v = Math.max(0, Math.min(1, value));
    this._state.sfxVolume = v;
    if (this._sfxGain) this._sfxGain.gain.value = v;
  }

  /**
   * 设置 BGM 音量
   * @param {number} value 0-1
   */
  setBGMVolume(value) {
    const v = Math.max(0, Math.min(1, value));
    this._state.bgmVolume = v;
    if (this._bgmGain) this._bgmGain.gain.value = v;
  }

  /**
   * 获取当前音量配置（可用于存档保存）
   * @returns {{ masterVolume: number, sfxVolume: number, bgmVolume: number }}
   */
  getState() {
    return { ...this._state };
  }

  /**
   * 从存档恢复音量配置
   * @param {Object} state
   */
  restoreState(state) {
    if (!state) return;
    if (typeof state.masterVolume === 'number') this.setMasterVolume(state.masterVolume);
    if (typeof state.sfxVolume === 'number') this.setSFXVolume(state.sfxVolume);
    if (typeof state.bgmVolume === 'number') this.setBGMVolume(state.bgmVolume);
  }

  /* ============================================================
     预加载（预留接口）
     ============================================================ */

  /**
   * 预加载音频文件（当前阶段不加载外部文件，返回 resolved Promise）
   * @param {string} type - 音效类型
   * @param {string} url - 音频文件路径
   * @returns {Promise<void>}
   */
  preload(type, url) {
    // TODO: 后续实现真实音频文件加载
    return Promise.resolve();
  }
}

export { AudioManager };
