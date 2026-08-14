'use strict';

/**
 * ============================================================
 * src/render/WaterAnimation.js — 水面动画
 * 版本: 1.0
 * 职责: 半透明水面叠加层、多层正弦波、气泡光点
 * ============================================================ */

class WaterAnimation {
  constructor() {
    /** @type {number} 累计动画时间（ms） */
    this._elapsed = 0;

    /** @type {number} 质量档位：1=高，0=低（低帧率自适应） */
    this._quality = 1;

    /** @type {Array<{amp:number, freq:number, speed:number, phase:number}>} 波层参数 */
    this._waves = [
      { amp: 3,  freq: 0.04, speed: 1.5, phase: 0 },
      { amp: 2,  freq: 0.07, speed: 2.0, phase: 1.2 },
      { amp: 1.5, freq: 0.025, speed: 0.8, phase: 2.8 },
      { amp: 1,   freq: 0.09, speed: 2.5, phase: 0.7 },
    ];

    /** @type {Array<{x:number, y:number, r:number, speed:number, phase:number}>} 光点 */
    this._sparkles = [];
    this._initSparkles();

    /** @type {CanvasGradient|null} 水面渐变缓存（避免每帧 createLinearGradient） */
    this._waterGrad = null;
  }

  /**
   * 设置渲染质量（性能自适应）
   * @param {number} q - 1=高（4 波层+12 光点），0=低（2 波层+6 光点）
   */
  setQuality(q) {
    this._quality = q >= 1 ? 1 : 0;
  }

  /** @returns {Array} 当前生效的波层 */
  _activeWaves() {
    return this._quality >= 1 ? this._waves : this._waves.slice(0, 2);
  }

  /** @returns {Array} 当前生效的光点 */
  _activeSparkles() {
    return this._quality >= 1 ? this._sparkles.slice(0, 12) : this._sparkles.slice(0, 6);
  }

  /**
   * 初始化随机光点
   */
  _initSparkles() {
    for (let i = 0; i < 20; i++) {
      this._sparkles.push({
        x: Math.random() * 320,
        y: Math.random() * 180,
        r: 0.5 + Math.random() * 1.5,
        speed: 0.3 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * 更新波相
   * @param {number} dt - 距上一帧毫秒
   */
  update(dt) {
    this._elapsed += dt;
  }

  /**
   * 渲染水面叠加层
   * @param {CanvasRenderingContext2D} ctx - 离屏 320×180 上下文
   * @param {number} x - 起始 X
   * @param {number} y - 起始 Y
   * @param {number} w - 宽度
   * @param {number} h - 高度
   */
  render(ctx, x, y, w, h) {
    if (w === 0 || h === 0) return;

    const time = this._elapsed / 1000;

    // ========== 半透明蓝色渐变（缓存，避免每帧 createLinearGradient） ==========
    if (!this._waterGrad) {
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, 'rgba(30, 80, 120, 0.25)');
      grad.addColorStop(0.4, 'rgba(25, 70, 110, 0.35)');
      grad.addColorStop(1, 'rgba(15, 50, 80, 0.50)');
      this._waterGrad = grad;
    }
    ctx.fillStyle = this._waterGrad;
    ctx.fillRect(x, y, w, h);

    // ========== 多层正弦波 ==========
    const waves = this._activeWaves();
    for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
      const wave = waves[waveIdx];
      ctx.strokeStyle = 'rgba(120, 200, 240, ' + (0.08 + waveIdx * 0.03) + ')';
      ctx.lineWidth = 1;

      ctx.beginPath();
      for (let px = x; px <= x + w; px += 4) {
        const py = y + h * 0.5
          + Math.sin(px * wave.freq + time * wave.speed + wave.phase) * wave.amp
          + Math.sin(px * wave.freq * 1.7 + time * wave.speed * 0.6) * wave.amp * 0.5;
        px === x ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // ========== 光点闪烁 ==========
    for (const s of this._activeSparkles()) {
      const alpha = 0.3 + 0.4 * Math.sin(time * s.speed + s.phase);
      ctx.fillStyle = 'rgba(200, 235, 255, ' + alpha + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export { WaterAnimation };
