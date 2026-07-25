'use strict';

/**
 * ============================================================
 * src/render/Renderer.js — 主渲染管线
 * 版本: 1.0
 * 职责: 离屏 Canvas 320×180、图层管理、像素完美缩放
 * ============================================================
 */

/* ============================================================
   常量
   ============================================================ */

/** @type {number} 内部分辨率宽度 */
const WIDTH = 320;

/** @type {number} 内部分辨率高度 */
const HEIGHT = 180;

/* ============================================================
   Renderer 类
   ============================================================ */

class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas - 主显示 Canvas
   */
  constructor(canvas) {
    /** @type {HTMLCanvasElement} */
    this.canvas = canvas;

    /** @type {CanvasRenderingContext2D} */
    this.ctx = canvas.getContext('2d');

    // --- 离屏 Canvas（320×180 主绘制目标）---
    /** @type {HTMLCanvasElement} */
    this.offscreen = document.createElement('canvas');
    this.offscreen.width = WIDTH;
    this.offscreen.height = HEIGHT;

    /** @type {CanvasRenderingContext2D} */
    this.offscreenCtx = this.offscreen.getContext('2d');

    /** @type {number} */
    this.width = WIDTH;

    /** @type {number} */
    this.height = HEIGHT;

    /** @type {Array<{name:string, renderFn:Function}>} */
    this._layers = [];

    /** @type {number} 累计动画时间（ms） */
    this._elapsed = 0;
  }

  /* ============================================================
     图层管理
     ============================================================ */

  /**
   * 注册一个渲染层
   * @param {string} name - 层名称（用于调试）
   * @param {Function} renderFn - (ctx, dt, elapsed) => void
   */
  addLayer(name, renderFn) {
    this._layers.push({ name, renderFn });
  }

  /**
   * 清空所有层
   */
  clearLayers() {
    this._layers = [];
  }

  /* ============================================================
     渲染
     ============================================================ */

  /**
   * 执行一帧完整渲染（所有层）
   * @param {number} dt - 距上一帧的毫秒数
   */
  render(dt) {
    this._elapsed += dt;
    this.offscreenCtx.clearRect(0, 0, WIDTH, HEIGHT);
    for (let i = 0; i < this._layers.length; i++) {
      const layer = this._layers[i];
      try { layer.renderFn(this.offscreenCtx, dt, this._elapsed); }
      catch (err) { console.error('[Renderer] 图层 "' + layer.name + '" 异常:', err); }
    }
    this._blitToScreen();
  }

  /**
   * 仅渲染像素风格层（背景/水面），UI 文字不经过 320×180 管线
   * 供 main.js 调用：背景走像素管线 → UI 文字直接绘制在主 Canvas → 文字清晰
   * @param {number} dt - 距上一帧的毫秒数
   */
  renderBackground(dt) {
    this._elapsed += dt;
    this.offscreenCtx.clearRect(0, 0, WIDTH, HEIGHT);

    // 只渲染背景和水面层
    for (let i = 0; i < this._layers.length; i++) {
      const layer = this._layers[i];
      if (layer.name !== 'background' && layer.name !== 'water') continue;
      try { layer.renderFn(this.offscreenCtx, dt, this._elapsed); }
      catch (err) { console.error('[Renderer] 图层 "' + layer.name + '" 异常:', err); }
    }

    this._blitToScreen();
  }

  /**
   * 将离屏内容 blit 到主 Canvas
   * 使用 save/restore 保护 ctx 的 DPR 变换，确保后续 screen.render 仍可用 CSS 像素坐标
   */
  _blitToScreen() {
    const dpr = window.devicePixelRatio || 1;
    const displayW = window.innerWidth * dpr;
    const displayH = window.innerHeight * dpr;

    // 保存当前状态（含 DPR 变换），再重置为 1:1 物理像素坐标系
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    this.ctx.imageSmoothingEnabled = false;

    this.ctx.drawImage(
      this.offscreen,
      0, 0, WIDTH, HEIGHT,
      0, 0, displayW, displayH
    );

    // 恢复 DPR 变换 → 后续 screen.render 使用 CSS 像素坐标
    this.ctx.restore();
  }

  /**
   * 获取离屏 Canvas 上下文（供屏幕渲染使用）
   * @returns {CanvasRenderingContext2D}
   */
  getOffscreenCtx() {
    return this.offscreenCtx;
  }

  /**
   * 获取内部分辨率宽度
   * @returns {number}
   */
  getWidth() {
    return WIDTH;
  }

  /**
   * 获取内部分辨率高度
   * @returns {number}
   */
  getHeight() {
    return HEIGHT;
  }
}

export { Renderer, WIDTH, HEIGHT };
