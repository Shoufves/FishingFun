'use strict';

/**
 * ============================================================
 * src/render/Sprite.js — 轻量级精灵系统
 * 版本: 1.0
 * 职责: 精灵类（帧动画/翻转/透明度）+ 像素鱼占位绘制
 * ============================================================ */

class Sprite {
  /**
   * @param {Object} config
   * @param {number} config.width - 帧宽度
   * @param {number} config.height - 帧高度
   * @param {string} config.color - 主颜色
   * @param {Array<Array<Array<string>>>} [config.frames] - 帧动画数据（预留）
   */
  constructor(config) {
    /** @type {number} */
    this.width = config.width || 16;
    /** @type {number} */
    this.height = config.height || 16;
    /** @type {string} */
    this.color = config.color || '#88bbcc';
    /** @type {number} */
    this._currentFrame = 0;
    /** @type {boolean} */
    this._playing = false;
    /** @type {string|null} */
    this._animName = null;
    /** @type {boolean} */
    this._loop = false;
    /** @type {number} */
    this._animTimer = 0;
    /** @type {number} */
    this._frameInterval = 100; // ms
  }

  /* ============================================================
     动画控制
     ============================================================ */

  /**
   * 播放指定动画
   * @param {string} name - 动画名称
   * @param {boolean} [loop=false] - 是否循环
   */
  playAnim(name, loop = false) {
    this._animName = name;
    this._loop = loop;
    this._playing = true;
    this._currentFrame = 0;
    this._animTimer = 0;
    // TODO: 后续关联帧序列数据
  }

  /** 停止当前动画 */
  stop() {
    this._playing = false;
    this._animName = null;
  }

  /**
   * 设置当前帧索引
   * @param {number} index
   */
  setFrame(index) {
    this._currentFrame = index;
    this._playing = false;
  }

  /**
   * 更新动画状态（每帧调用）
   * @param {number} dt - 距上一帧毫秒
   */
  update(dt) {
    if (!this._playing) return;
    this._animTimer += dt;
    if (this._animTimer >= this._frameInterval) {
      this._animTimer -= this._frameInterval;
      this._currentFrame++;
      // TODO: 循环/结束逻辑需关联帧数
    }
  }

  /* ============================================================
     渲染
     ============================================================ */

  /**
   * 绘制精灵
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - 绘制位置 X
   * @param {number} y - 绘制位置 Y
   * @param {number} [scale=1] - 缩放倍率
   * @param {boolean} [flip=false] - 水平翻转
   */
  render(ctx, x, y, scale = 1, flip = false) {
    const w = this.width * scale;
    const h = this.height * scale;

    if (flip) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      this._draw(ctx, 0, 0, w, h);
      ctx.restore();
    } else {
      this._draw(ctx, x, y, w, h);
    }
  }

  /**
   * 实际绘制（子类可覆盖）
   */
  _draw(ctx, x, y, w, h) {
    ctx.fillStyle = this.color;
    ctx.fillRect(x, y, w, h);
  }
}

/* ============================================================
   像素鱼占位绘制（静态方法）
   ============================================================ */

/**
 * 用矩形块拼出一条简单像素鱼
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - 左上 X
 * @param {number} y - 左上 Y
 * @param {number} size - 鱼的逻辑尺寸（像素单位）
 * @param {string} color - 鱼身主色
 */
Sprite.drawPixelFish = function (ctx, x, y, size, color) {
  const s = Math.max(4, size);
  const bodyW = s * 0.5;
  const bodyH = s * 0.25;
  const cx = x + bodyW / 2;
  const cy = y + bodyH / 2;

  // --- 鱼身（椭圆） ---
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- 鱼身暗部（下半） ---
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + bodyH * 0.1, bodyW * 0.45, bodyH * 0.3, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // --- 尾巴（三角形） ---
  const tailX = x + bodyW + 2;
  const tailH = s * 0.2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tailX, cy - tailH);
  ctx.lineTo(tailX + s * 0.15, cy);
  ctx.lineTo(tailX, cy + tailH);
  ctx.closePath();
  ctx.fill();

  // --- 眼睛 ---
  const eyeX = cx + bodyW * 0.15;
  const eyeY = cy - bodyH * 0.1;
  const eyeR = Math.max(1, s * 0.04);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(eyeX + 0.5, eyeY - 0.3, eyeR * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // --- 背鳍 ---
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  const finY = cy - bodyH * 0.35;
  ctx.moveTo(cx - bodyW * 0.15, finY);
  ctx.lineTo(cx, finY - s * 0.1);
  ctx.lineTo(cx + bodyW * 0.15, finY);
  ctx.closePath();
  ctx.fill();
};

export { Sprite };
