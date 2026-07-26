'use strict';

/**
 * ============================================================
 * src/ui/CatchUI.js — 收线搏鱼 UI 渲染
 * 版本: 1.3
 * 职责: 绘制双耐力条、判定轨道、标记、反馈特效
 * 约定: 纯绘制，不包含业务逻辑
 * ============================================================
 */

/** @type {number} 键从右边缘到目标区的视觉旅行时间（ms），横竖屏统一 */
const NOTE_TRAVEL_VISUAL_MS = 1500;

class CatchUI {
  /**
   * 渲染搏鱼界面
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w - 画布宽度
   * @param {number} h - 画布高度
   * @param {Object} state - CatchSystem.getState()
   */
  render(ctx, w, h, state) {
    ctx.save();
    ctx.translate(state.shake.x || 0, state.shake.y || 0);

    if (state.flashWhite) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, 0, w, h);
    }

    const margin = 56;
    const barH = 26;
    const trackH = 28;
    const gap = 5;
    const isPortrait = h > w;

    const trackW = isPortrait
      ? w - margin * 2
      : Math.min(360, (w - margin * 2) * 0.6);
    const trackX = (w - trackW) / 2;
    const playerBarY = h * 0.88;
    const trackY = playerBarY - barH - gap;
    const fishBarY = trackY - trackH - gap;

    this._drawStaminaBar(ctx, margin, playerBarY, w - margin * 2, barH,
      state.playerStamina, '#4080c0', '#103060', '\uD83C\uDFA3');
    this._drawTrack(ctx, trackX, trackY, trackW, trackH, state);
    this._drawStaminaBar(ctx, margin, fishBarY, w - margin * 2, barH,
      state.fishStamina, '#c04040', '#601010', this._fishIcon(state.fish));

    const targetZoneX = trackX + 56;
    if (state.lastGrade) {
      this._drawGradeText(ctx, targetZoneX, trackY - 4, state.lastGrade, state.lastGrade !== 'miss');
    }
    if (state.combo >= 3) {
      this._drawCombo(ctx, trackX + trackW - 10, trackY - 4, state.combo, state.lastGrade);
    }

    if (state.floatingTexts && state.floatingTexts.length > 0) {
      this._drawFloatingDamage(ctx, margin, fishBarY, w, state.floatingTexts);
    }

    ctx.restore();
  }

  /** @private */
  _drawStaminaBar(ctx, x, y, w, h, stamina, fillColor, bgColor, label) {
    const pct = stamina.percent;
    const isLow = pct < 0.2;
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);
    const warnFlash = isLow && (Math.floor(Date.now() / 200) % 2 === 0);
    ctx.fillStyle = warnFlash ? '#ff6060' : fillColor;
    ctx.fillRect(x + 2, y + 2, (w - 4) * pct, h - 4);
    ctx.strokeStyle = '#3a5a6a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText(label + ' ' + Math.floor(stamina.current) + '/' + stamina.max, x + 6, y + h / 2);
    ctx.textAlign = 'right';
    ctx.font = '13px Consolas,"Courier New",monospace';
    ctx.fillText(Math.floor(pct * 100) + '%', x + w - 6, y + h / 2);
  }

  /** @private */
  _fishIcon(fish) {
    if (!fish) return '\uD83D\uDC1F';
    if (fish.rarity >= 8) return '\uD83D\uDC1B\u2728';
    if (fish.rarity >= 5) return '\uD83D\uDC20';
    return '\uD83D\uDC1F';
  }

  /** @private */
  _drawTrack(ctx, x, y, w, h, state) {
    const targetX = x + 56;
    const visibleRange = w - 56; // 从目标区到右边缘的像素距离

    ctx.fillStyle = '#0a1a2a';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#2a4a5a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = 'rgba(60, 180, 120, 0.3)';
    ctx.fillRect(targetX - 16, y + 3, 32, h - 6);
    ctx.strokeStyle = 'rgba(60, 180, 120, 0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(targetX - 16, y + 3, 32, h - 6);

    ctx.strokeStyle = 'rgba(60, 180, 120, 0.5)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(targetX, y + 2);
    ctx.lineTo(targetX, y + h - 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (state.isRaging) {
      ctx.fillStyle = 'rgba(255, 60, 60, 0.2)';
      ctx.fillRect(x, y, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 12px Consolas,"Courier New",monospace';
      ctx.fillStyle = '#e04040';
      ctx.fillText('!! RAGE !!', x + w / 2, y + 2);
    }

    // 基于时间进度的键定位：所有键从右边缘到目标区固定走 NOTE_TRAVEL_VISUAL_MS 毫秒
    for (const note of state.notes) {
      if (!note.visible || note.hit || note.missed) continue;

      const timeLeft = note.expectedTime - state.elapsed;
      const visualProgress = 1 - timeLeft / NOTE_TRAVEL_VISUAL_MS;

      // 超出可视范围的不绘制
      if (timeLeft > NOTE_TRAVEL_VISUAL_MS + 100) continue;
      if (timeLeft < -200) continue;

      // 键从右边缘（progress=0）穿过目标区（progress=1）继续向左
      const noteX = targetX + (1 - visualProgress) * visibleRange;

      const hasAnim = note.animTimer > 0;
      const barW = 5;
      const barPad = 4;
      const barH = h - barPad * 2;

      if (hasAnim) {
        const p = note.animTimer / 150;
        const expandW = barW + (1 - p) * 18;
        ctx.save();
        ctx.shadowColor = 'rgba(240, 230, 200, 0.8)';
        ctx.shadowBlur = 16;
        ctx.globalAlpha = 0.3 + p * 0.5;
        ctx.fillStyle = '#fff8e0';
        ctx.fillRect(noteX - expandW / 2, y + barPad, expandW, barH);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = (1 - p) * 0.3;
        ctx.fillStyle = '#80d0ff';
        const ghostW = barW + (1 - p) * 30;
        ctx.fillRect(noteX - ghostW / 2, y + barPad, ghostW, barH);
        ctx.restore();
      }

      ctx.fillStyle = '#e0d8c0';
      ctx.shadowColor = 'rgba(200, 200, 200, 0.3)';
      ctx.shadowBlur = 4;
      ctx.fillRect(noteX - barW / 2, y + barPad, barW, barH);
      ctx.shadowBlur = 0;
    }
  }

  /**
   * 大号伤害数字（在鱼耐力条右上方爆炸弹出）
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} margin
   * @param {number} fishBarY
   * @param {number} w
   * @param {Array} texts
   */
  _drawFloatingDamage(ctx, margin, fishBarY, w, texts) {
    const baseX = w - margin;
    const baseY = fishBarY;

    for (const ft of texts) {
      const alpha = Math.min(1, ft.timer / 350);
      if (alpha <= 0) continue;

      // 弧线：从鱼条右端出发，先往左上飞升，到顶后往左下回落
      const t = 1 - ft.timer / 800;
      const arcX = baseX - t * 90;
      const arcY = baseY - Math.sin(t * Math.PI) * 60;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 32px Consolas,"Courier New",monospace';
      ctx.fillStyle = ft.color || '#e06050';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 12;
      ctx.fillText(ft.text, arcX, arcY);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  /** @private */
  _drawCombo(ctx, cx, cy, combo, lastGrade) {
    const isPerfect = lastGrade === 'perfect';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold 16px Consolas,"Courier New",monospace';
    ctx.fillStyle = isPerfect ? '#f0d060' : '#c0c0c0';
    ctx.shadowColor = isPerfect ? 'rgba(240, 200, 60, 0.5)' : 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.fillText(combo + 'x COMBO', cx, cy);
    ctx.shadowBlur = 0;
    if (combo >= 5) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.font = '11px Consolas,"Courier New",monospace';
      ctx.fillStyle = '#f0d060';
      ctx.fillText('CRITICAL!', cx, cy - 18);
    }
  }

  /** @private */
  _drawGradeText(ctx, cx, cy, grade, isHit) {
    const cfg = {
      perfect: { text: 'Perfect!', color: '#40d080', size: 24 },
      great:   { text: 'Great!',   color: '#60b0e0', size: 20 },
      good:    { text: 'Good',     color: '#e0c060', size: 18 },
      miss:    { text: 'Miss',     color: '#e06050', size: 16 },
    };
    const c = cfg[grade] || cfg.miss;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold ' + c.size + 'px Consolas,"Courier New",monospace';
    ctx.fillStyle = c.color;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    ctx.fillText(c.text, cx, cy);
    ctx.shadowBlur = 0;
  }
}

export { CatchUI };
