'use strict';

/**
 * ============================================================
 * src/render/BackgroundLayer.js — 视差背景系统
 * 版本: 1.0
 * 职责: 纯 Canvas 绘制的三层视差背景（远景山峦+中景树影+近景水面线）
 * ============================================================ */

/** 天空渐变颜色 */
const SKY_TOP    = '#1a2a3a';
const SKY_BOTTOM = '#4a6a8a';

/** 远景山峦颜色 */
const MOUNTAIN_COLOR    = '#1e3a4a';
const MOUNTAIN_COLOR2   = '#162e3e';

/** 中景树影颜色 */
const TREE_COLOR        = '#0e1e2e';
const TREE_COLOR_LIGHT  = '#122432';

/** 水面颜色 */
const WATER_COLOR = '#1a3a5a';

class BackgroundLayer {
  constructor() {
    /** @type {number} 视差偏移量（像素） */
    this.parallaxOffset = 0;

    /** @type {number} 水面高度（相对于底部） */
    this.waterLevel = 56;

    // 预生成静态元素（避免每帧创建新对象）
    this._mountains = this._generateMountains();
    this._trees = this._generateTrees();
  }

  /**
   * 生成远景山峦轮廓
   * @returns {Array<{x:number, w:number, h:number}>}
   */
  _generateMountains() {
    const peaks = [];
    let x = -40;
    while (x < 360) {
      const w = 30 + Math.random() * 50;
      const h = 20 + Math.random() * 35;
      peaks.push({ x, w, h });
      x += w * 0.5 + Math.random() * 15;
    }
    return peaks;
  }

  /**
   * 生成中景树影
   * @returns {Array<{x:number, size:number}>}
   */
  _generateTrees() {
    const trees = [];
    let x = -20;
    while (x < 340) {
      const size = 8 + Math.random() * 16;
      trees.push({ x, size: Math.floor(size) });
      x += 10 + Math.random() * 25;
    }
    return trees;
  }

  /**
   * 渲染完整背景
   * @param {CanvasRenderingContext2D} ctx - 离屏 320×180 上下文
   * @param {number} dt - 距上一帧毫秒
   * @param {number} elapsed - 累计毫秒
   */
  render(ctx, dt, elapsed) {
    const W = 320;
    const H = 180;
    const offset = this.parallaxOffset;

    // ========== 1. 天空渐变 ==========
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H - this.waterLevel);
    skyGrad.addColorStop(0, SKY_TOP);
    skyGrad.addColorStop(1, SKY_BOTTOM);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H - this.waterLevel);

    // ========== 2. 远景山峦（parallax 0.1）==========
    const mountOffset = -((offset * 0.1) % W);
    ctx.fillStyle = MOUNTAIN_COLOR;
    for (const m of this._mountains) {
      const mx = m.x + mountOffset;
      // 循环：超出左边界则移到右侧
      const wrappedX = ((mx % 360) + 360) % 360 - 40;
      this._drawMountain(ctx, wrappedX, H - this.waterLevel, m.w, m.h);
    }

    // 第二层山峦（更浅、更远）
    ctx.fillStyle = MOUNTAIN_COLOR2;
    const mountOffset2 = -((offset * 0.08) % W);
    for (const m of this._mountains) {
      const mx = m.x + mountOffset2;
      const wrappedX = ((mx % 360) + 360) % 360 - 40;
      this._drawMountain(ctx, wrappedX, H - this.waterLevel, m.w * 0.8 + 10, m.h * 0.6 + 5);
    }

    // ========== 3. 中景树影（parallax 0.3）==========
    const treeOffset = -((offset * 0.3) % W);
    ctx.fillStyle = TREE_COLOR;
    for (const t of this._trees) {
      const tx = t.x + treeOffset;
      const wrappedX = ((tx % 360) + 360) % 360 - 20;
      this._drawTree(ctx, wrappedX, H - this.waterLevel, t.size);
    }

    // 第二层树影（浅色）
    ctx.fillStyle = TREE_COLOR_LIGHT;
    const treeOffset2 = -((offset * 0.25) % W);
    for (const t of this._trees) {
      const tx = t.x + 8 + treeOffset2;
      const wrappedX = ((tx % 360) + 360) % 360 - 20;
      this._drawTree(ctx, wrappedX, H - this.waterLevel, t.size * 0.6 + 3);
    }

    // ========== 4. 水面 ==========
    ctx.fillStyle = WATER_COLOR;
    ctx.fillRect(0, H - this.waterLevel, W, this.waterLevel);
  }

  /**
   * 绘制一座山
   */
  _drawMountain(ctx, x, baseY, w, h) {
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    const cp1x = x + w * 0.25;
    const cp1y = baseY - h;
    const cp2x = x + w * 0.75;
    const cp2y = baseY - h * 0.8;
    const endX = x + w;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, baseY);
    ctx.lineTo(endX, baseY);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * 绘制一棵树（圆冠 + 树干）
   */
  _drawTree(ctx, x, baseY, size) {
    // 树冠（圆形）
    const crownR = size * 0.5;
    ctx.beginPath();
    ctx.arc(x, baseY - size * 0.4, crownR, 0, Math.PI * 2);
    ctx.fill();

    // 树干（矩形）
    const trunkW = Math.max(2, size * 0.15);
    const trunkH = size * 0.3;
    ctx.fillRect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);
  }
}

export { BackgroundLayer };
