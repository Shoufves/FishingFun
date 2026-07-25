'use strict';

/**
 * ============================================================
 * src/ui/CastingUI.js — 蓄力条 UI 渲染
 * 版本: 1.2
 * 职责: 在 Canvas 上绘制蓄力条的视觉表现
 * 约定: 纯绘制，不包含业务逻辑
 * ============================================================
 */

class CastingUI {
  /**
   * 渲染蓄力条
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - 左上角 X（CSS 像素）
   * @param {number} y - 左上角 Y（CSS 像素）
   * @param {number} width - 条宽度
   * @param {number} height - 条高度
   * @param {Object} system - CastingSystem 实例
   * @param {string} [statusText] - 覆盖状态文字
   * @param {boolean} [showGhost] - true 时光标静止在起点（就绪态）
   */
  render(ctx, x, y, width, height, system, statusText, showGhost) {
    const perfectZone = system.getPerfectZone();
    const goodZone = system.getGoodZone();
    const progress = system.getProgress();
    const isActive = system.isActive();

    const goodStartPx = x + (goodZone.start / 100) * width;
    const goodEndPx = x + (goodZone.end / 100) * width;
    const goodW = Math.max(1, goodEndPx - goodStartPx);

    const perfStartPx = x + (perfectZone.start / 100) * width;
    const perfEndPx = x + (perfectZone.end / 100) * width;
    const perfW = Math.max(1, perfEndPx - perfStartPx);

    const cursorPx = showGhost ? x : (x + (progress / 100) * width);

    this._drawTrack(ctx, x, y, width, height);
    this._drawGoodZone(ctx, goodStartPx, y, goodW, height, isActive);
    this._drawPerfectZone(ctx, perfStartPx, y, perfW, height, isActive);
    this._drawZoneBoundaries(ctx, goodStartPx, goodEndPx, y, height);
    this._drawCursor(ctx, cursorPx, y, height, isActive && !showGhost);
    this._drawTicks(ctx, x, y, width, height);

    const text = (typeof statusText === 'string')
      ? statusText
      : this._getDefaultText(isActive, progress, perfectZone);

    this._drawStatusText(ctx, x, y, width, text);
  }

  /**
   * 绘制背景轨道
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  _drawTrack(ctx, x, y, w, h) {
    const r = 4;
    ctx.fillStyle = '#1a2a3a';
    this._roundRect(ctx, x, y, w, h, r);
    ctx.fill();

    ctx.strokeStyle = '#3a5a6a';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
  }

  /**
   * 绘制良好区间（蓝色背景）
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} zx - 区间左端 X
   * @param {number} y
   * @param {number} zw - 区间宽度
   * @param {number} h - 条高度
   * @param {boolean} isActive
   */
  _drawGoodZone(ctx, zx, y, zw, h, isActive) {
    ctx.fillStyle = isActive ? '#2a5a7a' : '#1a3a5a';
    this._roundRect(ctx, zx, y + 2, zw, h - 4, 2);
    ctx.fill();
  }

  /**
   * 绘制完美区间（绿色高亮，叠在蓝区之上）
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} zx - 区间左端 X
   * @param {number} y
   * @param {number} zw - 区间宽度
   * @param {number} h - 条高度
   * @param {boolean} isActive
   */
  _drawPerfectZone(ctx, zx, y, zw, h, isActive) {
    ctx.fillStyle = isActive ? '#2a9a4a' : '#1a6a2a';
    this._roundRect(ctx, zx, y + 2, zw, h - 4, 2);
    ctx.fill();

    if (isActive) {
      ctx.fillStyle = 'rgba(80, 220, 120, 0.3)';
      this._roundRect(ctx, zx + 2, y + 4, zw - 4, h - 8, 1);
      ctx.fill();
    }
  }

  /**
   * 绘制良好区间边界标记（白色虚线）
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} zx - 区间左端 X
   * @param {number} zx2 - 区间右端 X
   * @param {number} y
   * @param {number} h
   */
  _drawZoneBoundaries(ctx, zx, zx2, y, h) {
    ctx.strokeStyle = 'rgba(160, 200, 230, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(zx, y);
    ctx.lineTo(zx, y + h);
    ctx.moveTo(zx2, y);
    ctx.lineTo(zx2, y + h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * 绘制光标指示器
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx - 光标 X
   * @param {number} y
   * @param {number} h - 条高度
   * @param {boolean} glowing - true 时带发光效果（运行时）
   */
  _drawCursor(ctx, cx, y, h, glowing) {
    ctx.strokeStyle = '#f0e6c0';
    ctx.lineWidth = 2;
    ctx.shadowColor = glowing ? 'rgba(240, 230, 192, 0.4)' : 'transparent';
    ctx.shadowBlur = glowing ? 4 : 0;
    ctx.beginPath();
    ctx.moveTo(cx, y - 3);
    ctx.lineTo(cx, y + h + 3);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#f0e6c0';
    ctx.beginPath();
    ctx.moveTo(cx, y - 8);
    ctx.lineTo(cx - 4, y - 2);
    ctx.lineTo(cx + 4, y - 2);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * 绘制刻度标记
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  _drawTicks(ctx, x, y, w, h) {
    ctx.strokeStyle = '#2a4a5a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 100; i += 10) {
      const tickX = x + (i / 100) * w;
      ctx.beginPath();
      ctx.moveTo(tickX, y + h + 2);
      ctx.lineTo(tickX, y + h + 6);
      ctx.stroke();
    }
  }

  /**
   * 绘制状态文字
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {string} text
   */
  _drawStatusText(ctx, x, y, w, text) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold 20px Consolas, "Courier New", monospace';
    ctx.fillStyle = this._getTextColor(text);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(text, x + w / 2, y - 16);
    ctx.shadowBlur = 0;
  }

  /**
   * 绘制圆角矩形路径
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} r - 圆角半径
   */
  _roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /**
   * 获取默认状态文字
   * @param {boolean} isActive
   * @param {number} progress
   * @param {{start:number, end:number}} zone
   * @returns {string}
   */
  _getDefaultText(isActive, progress, zone) {
    if (!isActive) return 'STOP';
    return '';
  }

  /**
   * 根据文字内容返回合适颜色
   * @param {string} text
   * @returns {string}
   */
  _getTextColor(text) {
    if (text === 'Perfect!') return '#40d080';
    if (text === 'Good!') return '#60b0e0';
    if (text === 'Poor!' || text === 'Fail!') return '#e06050';
    return '#f0e6c0';
  }
}

export { CastingUI };
