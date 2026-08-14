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

    // 大鱼（高稀有度/高挣扎强度）搏鱼时屏幕边缘红色光晕
    const fish = state.fish;
    const isBig = fish && (fish.rarity >= 7 || fish.fightPower >= 7);
    if (isBig) {
      const pulse = 0.05 + 0.04 * Math.sin(Date.now() / 350);
      ctx.fillStyle = 'rgba(200, 30, 30, ' + pulse.toFixed(3) + ')';
      ctx.fillRect(0, 0, w, 8);
      ctx.fillRect(0, h - 8, w, 8);
      ctx.fillRect(0, 0, 8, h);
      ctx.fillRect(w - 8, 0, 8, h);
    }

    const margin = 56;
    const barH = 26;
    const trackH = 28;
    const gap = 5;
    const isPortrait = h > w;

    // 轨道框：竖版占宽 86%（两侧留白），横版固定合理宽度并居中，
    // 保证"区域框"清晰，键从框右边缘出现
    const trackW = isPortrait
      ? Math.max(220, w * 0.86)
      : Math.min(420, Math.max(240, (w - 160) * 0.62));
    const trackX = (w - trackW) / 2;
    const playerBarY = h * 0.88;
    const trackY = playerBarY - barH - gap;
    const fishBarY = trackY - trackH - gap;

    this._drawStaminaBar(ctx, margin, playerBarY, w - margin * 2, barH,
      state.playerStamina, '#4080c0', '#103060', '\uD83C\uDFA3');
    this._drawTrack(ctx, trackX, trackY, trackW, trackH, state);
    this._drawStaminaBar(ctx, margin, fishBarY, w - margin * 2, barH,
      state.fishStamina, '#c04040', '#601010',
      this._fishIcon(state.fish, state.fishStamina.percent));

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

    // 低耐力红色脉冲边框
    if (isLow) {
      ctx.strokeStyle = warnFlash ? '#ff9090' : '#c04040';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText(label + ' ' + Math.floor(stamina.current) + '/' + stamina.max, x + 6, y + h / 2);
    ctx.textAlign = 'right';
    ctx.font = '13px Consolas,"Courier New",monospace';
    ctx.fillText(Math.floor(pct * 100) + '%', x + w - 6, y + h / 2);

    // 低耐力警告
    if (isLow && warnFlash) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 11px Consolas,"Courier New",monospace';
      ctx.fillStyle = '#ff8080';
      ctx.fillText('LOW!', x + w / 2, y - 10);
    }
  }

  /**
   * 鱼图标表情随耐力比例变化（T-009.2）
   * @param {Object} fish
   * @param {number} percent - 鱼耐力比例 0~1
   * @returns {string}
   * @private
   */
  _fishIcon(fish, percent) {
    if (!fish) return '\uD83D\uDC1F';
    if (fish.rarity >= 8) return '\uD83D\uDC1B\u2728';
    if (percent < 0.15) return '\uD83D\uDE35';   // 翻白眼
    if (percent < 0.35) return '\uD83D\uDE23';   // 皱眉
    if (percent < 0.6) return '\uD83D\uDE20';    // 生气
    return '\uD83D\uDC1F';                        // 平静
  }

  /**
   * 判定某个键是否应跳过渲染
   * 仅当键已命中/已 Miss 才跳过；头判后的 hold 长按键（holdActive 且未 hit）
   * 必须持续渲染到尾判结束或玩家松开
   * @param {Object} note - 来自 state.notes 的键
   * @returns {boolean}
   * @private
   */
  _shouldSkipNote(note) {
    return !!(note.hit || note.missed);
  }

  /** @private */
  _drawTrack(ctx, x, y, w, h, state) {
    const targetX = x + Math.min(64, w * 0.16);
    const visibleRange = (x + w) - targetX; // 目标区到轨道框右边缘的距离

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

    // 基于时间进度的键定位：键从轨道框右边缘（progress=0）到目标区（progress=1）
    // 注意: 不使用 note.visible（CatchSystem 基于 400px 虚拟轨道的判断）——
    // 它会让头判后的 hold 长按键在 offset<-100 时被跳过而提前消失；
    // 键的可见性完全由下方 UI 时间窗口（timeLeft 范围）控制。
    for (const note of state.notes) {
      if (this._shouldSkipNote(note)) continue;

      const timeLeft = note.expectedTime - state.elapsed;
      // clamp 下界 0：timeLeft>1500 的键贴右边缘等待，绝不超出轨道框
      const visualProgress = Math.max(0, 1 - timeLeft / NOTE_TRAVEL_VISUAL_MS);

      // 超出可视范围的不绘制
      if (timeLeft > NOTE_TRAVEL_VISUAL_MS + 100) continue;
      // hold 长按键例外：头部过目标区后长条仍须持续显示（尾部还在右侧），
      // 直到尾部也通过目标区 200ms 或尾判完成（hit）
      if (timeLeft < -200 && note.type !== 'hold') continue;
      if (note.type === 'hold') {
        const tailAbs = (note.holdActive ? note.holdStart : note.expectedTime) + note.duration;
        if (tailAbs - state.elapsed < -200) continue;
      }

      // 键从右边缘（progress=0）穿过目标区（progress=1）继续向左
      const noteX = targetX + (1 - visualProgress) * visibleRange;

      const barW = 5;
      const barPad = 4;
      const barH = h - barPad * 2;

      // hold 长按键：长条渲染，头部在当前 noteX，尾部向右延伸
      if (note.type === 'hold') {
        this._drawHoldNote(ctx, note, noteX, y, barPad, h, x, w,
          targetX, visibleRange, state.elapsed);
        continue;
      }

      const hasAnim = note.animTimer > 0;

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
   * 绘制 hold 长按键（双判定点设计）
   * - 未头判：长条从头部位置向右延伸至尾部，头部亮块随移动
   * - 头判后：头部亮块锁定在目标区（按住点），长条 [目标区 → 尾部] 随尾部收拢，
   *   按住期间持续显示，直到尾判完成（note.hit）后消失
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} note
   * @param {number} headX - 头部 X（未头判时随移动）
   * @param {number} y - 轨道 Y
   * @param {number} barPad - 上下内边距
   * @param {number} h - 轨道高
   * @param {number} trackX - 轨道左边缘
   * @param {number} trackW - 轨道宽
   * @param {number} targetX - 目标区 X
   * @param {number} visibleRange - 目标区到右边缘距离
   * @param {number} elapsed - 当前游戏时间
   * @private
   */
  _drawHoldNote(ctx, note, headX, y, barPad, h, trackX, trackW, targetX, visibleRange, elapsed) {
    const active = note.holdActive;
    // 尾部绝对时间：头判前=expectedTime+duration；头判后=holdStart+duration
    const tailAbs = (active ? note.holdStart : note.expectedTime) + note.duration;
    const tailTimeLeft = tailAbs - elapsed;
    const tailProgress = Math.max(0, 1 - tailTimeLeft / NOTE_TRAVEL_VISUAL_MS);
    const tailX = targetX + (1 - tailProgress) * visibleRange;

    // 长条范围：头判后左端锁定目标区（按住点），右端=尾部位置
    let startX = active ? targetX : headX;
    let endX = active ? tailX : Math.max(headX, tailX);
    startX = Math.max(startX, trackX + 2);
    endX = Math.min(endX, trackX + trackW - 2);

    const barH = h - barPad * 2;

    if (endX > startX + 2) {
      ctx.fillStyle = active ? '#1a4a4a' : '#122a3a';
      ctx.fillRect(startX, y + barPad, endX - startX, barH);
      ctx.strokeStyle = active ? '#40e0e0' : '#2a8ab0';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, y + barPad, endX - startX, barH);
    }

    // 头部亮块（按下点）：头判后锁定在目标区
    const headBlockX = Math.max(active ? targetX : headX, trackX + 2);
    ctx.fillStyle = active ? '#60f0f0' : '#40b0d0';
    ctx.fillRect(headBlockX - 2, y + barPad, 4, barH);

    // HOLD 文字（宽度足够时显示）
    if (endX - startX > 46) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 9px Consolas,"Courier New",monospace';
      ctx.fillStyle = active ? '#a0ffff' : '#5a9ab0';
      ctx.fillText('HOLD', (startX + endX) / 2, y + h / 2);
    }
  }

  /**
   * 大号伤害数字（在鱼耐力条右上方爆炸弹出）
   * 性能：最多同时渲染 4 个，降低阴影开销
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} margin
   * @param {number} fishBarY
   * @param {number} w
   * @param {Array} texts
   */
  _drawFloatingDamage(ctx, margin, fishBarY, w, texts) {
    const baseX = w - margin;
    const baseY = fishBarY;
    const visible = texts.filter(ft => ft.timer > 0).slice(0, 4);

    for (const ft of visible) {
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
      ctx.shadowBlur = 6;
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
    ctx.shadowBlur = 4;
    ctx.fillText(c.text, cx, cy);
    ctx.shadowBlur = 0;
  }
}

export { CatchUI };
