'use strict';

/**
 * ============================================================
 * src/ui/WaitingUI.js — 等待浮漂 UI 渲染
 * 版本: 1.0
 * 职责: 在 Canvas 上绘制浮漂和等待进度
 * 约定: 纯绘制，不包含业务逻辑
 * ============================================================
 */

class WaitingUI {
  /**
   * 渲染浮漂和等待指示器
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx - 浮漂中心 X
   * @param {number} cy - 浮漂基准 Y
   * @param {Object} floaterState - 来自 WaitSystem.getFloaterState()
   * @param {string} [statusOverride] - 覆盖状态文字
   */
  render(ctx, cx, cy, floaterState, statusOverride, rippleColor) {
    const { state, phase, offset, progress } = floaterState;
    const baseY = cy;

    // 根据状态计算 Y 偏移
    let yOffset = 0;
    if (state === 'sinking') {
      // 下沉：随 progress 加深
      yOffset = progress * 40 + 10;
    } else {
      // idle / bobbing：正弦波上下浮动
      yOffset = Math.sin(phase) * 4;
      if (state === 'bobbing') {
        yOffset += offset * 0.5;
      }
    }

    const floaterY = baseY + yOffset;
    const r = 8;

    // ---- 水波纹（浮漂下方） ----
    ctx.strokeStyle = rippleColor || 'rgba(160, 200, 230, 0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const wavePhase = phase + i * 1.2;
      const waveR = r + 6 + i * 5 + Math.sin(wavePhase) * 2;
      ctx.beginPath();
      ctx.arc(cx, floaterY + 2, waveR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ---- 浮漂本体（红色/橙色小球） ----
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 4;

    if (state === 'sinking') {
      ctx.fillStyle = '#d04030';
    } else if (state === 'bobbing') {
      ctx.fillStyle = '#e08040';
    } else {
      ctx.fillStyle = '#e06040';
    }

    ctx.beginPath();
    ctx.arc(cx, floaterY, r, 0, Math.PI * 2);
    ctx.fill();

    // 浮漂高光
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(cx - 2, floaterY - 2, r * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // ---- 浮漂杆（竖线） ----
    ctx.strokeStyle = '#4a3a2a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, floaterY - r - 4);
    ctx.lineTo(cx, floaterY - r - 16);
    ctx.stroke();

    // 杆顶小点
    ctx.fillStyle = '#f0e6c0';
    ctx.beginPath();
    ctx.arc(cx, floaterY - r - 16, 2, 0, Math.PI * 2);
    ctx.fill();

    // ---- 等待进度环形条 ----
    const arcR = r + 14;
    ctx.strokeStyle = 'rgba(60, 90, 110, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, floaterY, arcR, 0, Math.PI * 2);
    ctx.stroke();

    // 进度弧
    ctx.strokeStyle = state === 'sinking' ? '#d04030' : '#60b0d0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2 * Math.min(1, progress);
    ctx.arc(cx, floaterY, arcR, startAngle, endAngle);
    ctx.stroke();

    // ---- 状态文字 ----
    const text = (typeof statusOverride === 'string')
      ? statusOverride
      : this._getDefaultText(state);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '14px Consolas, "Courier New", monospace';
    ctx.fillStyle = this._getTextColor(state);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(text, cx, floaterY + r + 24);
    ctx.shadowBlur = 0;
  }

  /**
   * 获取默认状态文字
   * @param {string} state
   * @returns {string}
   */
  _getDefaultText(state) {
    switch (state) {
      case 'idle':    return 'Waiting...';
      case 'bobbing': return 'Fish is near!';
      case 'sinking': return 'Bite!';
      default:        return 'Waiting...';
    }
  }

  /**
   * 根据状态返回文字颜色
   * @param {string} state
   * @returns {string}
   */
  _getTextColor(state) {
    switch (state) {
      case 'idle':    return '#8ab0c0';
      case 'bobbing': return '#e0c060';
      case 'sinking': return '#e06050';
      default:        return '#8ab0c0';
    }
  }
}

export { WaitingUI };
