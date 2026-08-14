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
  constructor() {
    /** @type {HTMLCanvasElement|null} 轨道静态层缓存（背景/目标区/虚线） */
    this._trackCache = null;

    /** @type {CanvasRenderingContext2D|null} */
    this._trackCacheCtx = null;

    /** @type {string} 缓存 key（尺寸/狂暴状态变化时重建） */
    this._trackCacheKey = '';
  }

  /**
   * 预渲染轨道静态层（背景、目标区、虚线、狂暴覆盖）
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {boolean} isRaging
   * @private
   */
  _buildTrackCache(x, y, w, h, isRaging) {
    try {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w));
      c.height = Math.max(1, Math.ceil(h));
      const cc = c.getContext('2d');
      const targetX = Math.min(64, w * 0.16);

      cc.fillStyle = '#0a1a2a';
      cc.fillRect(0, 0, w, h);
      cc.strokeStyle = '#2a4a5a';
      cc.lineWidth = 1;
      cc.strokeRect(0, 0, w, h);

      cc.fillStyle = 'rgba(60, 180, 120, 0.3)';
      cc.fillRect(targetX - 16, 3, 32, h - 6);
      cc.strokeStyle = 'rgba(60, 180, 120, 0.7)';
      cc.lineWidth = 1;
      cc.strokeRect(targetX - 16, 3, 32, h - 6);

      cc.strokeStyle = 'rgba(60, 180, 120, 0.5)';
      cc.setLineDash([2, 3]);
      cc.beginPath();
      cc.moveTo(targetX, 2);
      cc.lineTo(targetX, h - 2);
      cc.stroke();
      cc.setLineDash([]);

      if (isRaging) {
        cc.fillStyle = 'rgba(255, 60, 60, 0.2)';
        cc.fillRect(0, 0, w, h);
      }

      this._trackCache = c;
      this._trackCacheCtx = cc;
    } catch (e) {
      // 预渲染失败时降级为每帧直接绘制
      this._trackCache = null;
      this._trackCacheCtx = null;
    }
  }

  /**
   * 渲染搏鱼界面
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w - 画布宽度
   * @param {number} h - 画布高度
   * @param {Object} state - CatchSystem.getState()
   * @param {string} [orientation='landscape'] - 'landscape' 横板 | 'portrait' 竖版
   */
  render(ctx, w, h, state, orientation) {
    if (orientation === 'portrait') {
      this._renderPortrait(ctx, w, h, state);
      return;
    }
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

  /**
   * 竖版渲染（设置：竖版模式）
   * 布局: 轨道垂直居中（键从上往下落，目标区在底部），双耐力条竖直立于两侧，
   *       血从顶部往下扣减；条与轨道大小与横板一致
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   * @param {Object} state
   * @private
   */
  _renderPortrait(ctx, w, h, state) {
    ctx.save();
    ctx.translate(state.shake.x || 0, state.shake.y || 0);
    if (state.flashWhite) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, 0, w, h);
    }

    // 布局：竖条宽=26（同横板条高），轨道宽=28（同横板轨道高），大小不变
    const barW = 26;
    const trackW = 28;
    const topY = 66;
    const bottomY = h - 48;
    const barH = bottomY - topY;
    const trackH = barH;

    const trackX = (w - trackW) / 2;
    const playerX = trackX - 8 - barW;
    const fishX = trackX + trackW + 8;
    const trackY = topY;

    // 目标区在轨道底部
    const targetY = trackY + trackH - 34;
    const visibleRange = Math.max(20, targetY - trackY);

    this._drawVerticalBar(ctx, playerX, topY, barW, barH,
      state.playerStamina, '#4080c0', '#103060', '\u73A9\u5BB6');
    this._drawVerticalBar(ctx, fishX, topY, barW, barH,
      state.fishStamina, '#c04040', '#601010',
      state.fish ? state.fish.fishName : '\u9C7C');

    // 轨道背景
    ctx.fillStyle = '#0a1a2a';
    ctx.fillRect(trackX, trackY, trackW, trackH);
    ctx.strokeStyle = '#2a4a5a';
    ctx.lineWidth = 1;
    ctx.strokeRect(trackX, trackY, trackW, trackH);

    // 目标区（底部高亮）
    ctx.fillStyle = 'rgba(60, 180, 120, 0.3)';
    ctx.fillRect(trackX + 1, targetY - 14, trackW - 2, 28);
    ctx.strokeStyle = 'rgba(60, 180, 120, 0.7)';
    ctx.strokeRect(trackX + 1, targetY - 14, trackW - 2, 28);

    // 中心虚线
    ctx.strokeStyle = 'rgba(60, 180, 120, 0.5)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(trackX + trackW / 2, trackY + 2);
    ctx.lineTo(trackX + trackW / 2, targetY - 16);
    ctx.stroke();
    ctx.setLineDash([]);

    // 狂暴提示
    if (state.isRaging) {
      ctx.fillStyle = 'rgba(255, 60, 60, 0.2)';
      ctx.fillRect(trackX, trackY, trackW, trackH);
      ctx.save();
      ctx.translate(trackX - 14, trackY + trackH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px Consolas,"Courier New",monospace';
      ctx.fillStyle = '#e04040';
      ctx.fillText('!! RAGE !!', 0, 0);
      ctx.restore();
    }

    // 键：从上往下落（progress 0=顶部 → 1=目标区）
    const barW2 = trackW - 8;
    for (const note of state.notes) {
      if (this._shouldSkipNote(note)) continue;
      const timeLeft = note.expectedTime - state.elapsed;
      const visualProgress = Math.max(0, 1 - timeLeft / NOTE_TRAVEL_VISUAL_MS);
      if (timeLeft > NOTE_TRAVEL_VISUAL_MS + 100) continue;
      if (timeLeft < -200 && note.type !== 'hold') continue;
      if (note.type === 'hold') {
        const tailAbs = (note.holdActive ? note.holdStart : note.expectedTime) + note.duration;
        if (tailAbs - state.elapsed < -200) continue;
      }

      const noteY = trackY + visualProgress * visibleRange;

      if (note.type === 'hold') {
        this._drawPortraitHold(ctx, note, noteY, trackX, trackY, trackW,
          targetY, visibleRange, state.elapsed, trackH);
        continue;
      }

      const active = note.holdActive;
      // 命中动画
      if (note.animTimer > 0) {
        const p = note.animTimer / 150;
        const expandH = 5 + (1 - p) * 18;
        ctx.globalAlpha = 0.3 + p * 0.5;
        ctx.fillStyle = '#fff8e0';
        ctx.fillRect(trackX + 3, noteY - expandH / 2, barW2, expandH);
        ctx.globalAlpha = (1 - p) * 0.3;
        ctx.fillStyle = '#80d0ff';
        ctx.fillRect(trackX + 3, noteY - (5 + (1 - p) * 30) / 2, barW2, 5 + (1 - p) * 30);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#e0d8c0';
      ctx.fillRect(trackX + 3, noteY - 2.5, barW2, 5);
    }

    // 判定文字（目标区左侧）
    if (state.lastGrade) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const cfg = {
        perfect: { text: 'Perfect!', color: '#40d080', size: 18 },
        great:   { text: 'Great!',   color: '#60b0e0', size: 15 },
        good:    { text: 'Good',     color: '#e0c060', size: 14 },
        miss:    { text: 'Miss',     color: '#e06050', size: 13 },
      };
      const c = cfg[state.lastGrade] || cfg.miss;
      ctx.font = 'bold ' + c.size + 'px Consolas,"Courier New",monospace';
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, trackX - 8, targetY);
    }

    // 连击（目标区右侧）
    if (state.combo >= 3) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 14px Consolas,"Courier New",monospace';
      ctx.fillStyle = state.lastGrade === 'perfect' ? '#f0d060' : '#c0c0c0';
      ctx.fillText(state.combo + 'x', trackX + trackW + 8, targetY);
    }

    // Boss 技能警告（顶部）
    if (state.bossSkill && state.bossSkill.active) {
      const flash = Math.floor(Date.now() / 200) % 2 === 0;
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px Consolas,"Courier New",monospace';
      ctx.fillStyle = flash ? '#ff5050' : '#c03030';
      ctx.fillText('\u26A0 ' + state.bossSkill.name, w / 2, trackY - 22);
    }

    ctx.restore();
  }

  /**
   * 绘制竖版血条（血从顶部往下扣减）
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {Object} stamina
   * @param {string} fillColor
   * @param {string} bgColor
   * @param {string} label
   * @private
   */
  _drawVerticalBar(ctx, x, y, w, h, stamina, fillColor, bgColor, label) {
    const pct = stamina.percent;
    const isLow = pct < 0.2;
    const warnFlash = isLow && (Math.floor(Date.now() / 200) % 2 === 0);

    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);
    // 血从顶部往下扣：填充从顶部开始，高度随剩余比例
    const fillH = Math.max(0, (h - 4) * pct);
    ctx.fillStyle = warnFlash ? '#ff6060' : fillColor;
    ctx.fillRect(x + 2, y + 2, w - 4, fillH);
    ctx.strokeStyle = isLow ? (warnFlash ? '#ff9090' : '#c04040') : '#3a5a6a';
    ctx.lineWidth = isLow ? 2 : 1;
    ctx.strokeRect(x, y, w, h);

    // 顶部标签（竖排）
    ctx.save();
    ctx.translate(x + w / 2, y + 8);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText(label, 0, 0);
    ctx.restore();

    // 底部百分比
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '10px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#8ab0c0';
    ctx.fillText(Math.floor(pct * 100) + '%', x + w / 2, y + h + 2);
  }

  /**
   * 竖版 hold 长按键（垂直长条：头部在按下点，尾部向下延伸/收拢）
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} note
   * @param {number} headY - 头部 Y
   * @param {number} trackX
   * @param {number} trackY
   * @param {number} trackW
   * @param {number} targetY
   * @param {number} visibleRange
   * @param {number} elapsed
   * @param {number} trackH
   * @private
   */
  _drawPortraitHold(ctx, note, headY, trackX, trackY, trackW, targetY, visibleRange, elapsed, trackH) {
    const active = note.holdActive;
    const tailAbs = (active ? note.holdStart : note.expectedTime) + note.duration;
    const tailTimeLeft = tailAbs - elapsed;
    const tailProgress = Math.max(0, 1 - tailTimeLeft / NOTE_TRAVEL_VISUAL_MS);
    const tailY = trackY + tailProgress * visibleRange;

    // 长条范围：头判后头部锁定目标区，尾部从上方收拢
    let startY = active ? targetY : headY;
    let endY = active ? tailY : Math.max(headY, tailY);
    startY = Math.max(startY, trackY + 2);
    endY = Math.min(endY, trackY + trackH - 2);

    const barX = trackX + 3;
    const barW = trackW - 6;
    if (endY > startY + 2) {
      ctx.fillStyle = active ? '#1a4a4a' : '#122a3a';
      ctx.fillRect(barX, startY, barW, endY - startY);
      ctx.strokeStyle = active ? '#40e0e0' : '#2a8ab0';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, startY, barW, endY - startY);
    }
    // 头部亮块
    const headBlockY = Math.max(active ? targetY : headY, trackY + 2);
    ctx.fillStyle = active ? '#60f0f0' : '#40b0d0';
    ctx.fillRect(barX, headBlockY - 2, barW, 4);
  }

  /** @private */
  _drawTrack(ctx, x, y, w, h, state) {
    const targetX = x + Math.min(64, w * 0.16);
    const visibleRange = (x + w) - targetX;

    // 静态层预渲染（osu 式：背景/目标区/虚线只画一次，每帧 drawImage）
    const cacheKey = Math.round(w) + 'x' + Math.round(h) + '|r' + (state.isRaging ? 1 : 0);
    if (!this._trackCacheCtx || this._trackCacheKey !== cacheKey) {
      this._trackCacheKey = cacheKey;
      this._buildTrackCache(0, 0, w, h, state.isRaging);
    }
    if (this._trackCacheCtx && this._trackCache) {
      ctx.drawImage(this._trackCache, x, y);
    } else {
      // 降级：直接绘制静态部分
      ctx.fillStyle = '#0a1a2a';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#2a4a5a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(60, 180, 120, 0.3)';
      ctx.fillRect(targetX - 16, y + 3, 32, h - 6);
      ctx.strokeStyle = 'rgba(60, 180, 120, 0.7)';
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
      }
    }

    // 狂暴提示文字（动态部分保留在主画布）
    if (state.isRaging) {
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
        // 命中动画（无 shadow，用亮色实心代替——shadow 在高分屏开销极大）
        const p = note.animTimer / 150;
        const expandW = barW + (1 - p) * 18;
        ctx.globalAlpha = 0.3 + p * 0.5;
        ctx.fillStyle = '#fff8e0';
        ctx.fillRect(noteX - expandW / 2, y + barPad, expandW, barH);
        ctx.globalAlpha = (1 - p) * 0.3;
        ctx.fillStyle = '#80d0ff';
        const ghostW = barW + (1 - p) * 30;
        ctx.fillRect(noteX - ghostW / 2, y + barPad, ghostW, barH);
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = '#e0d8c0';
      ctx.fillRect(noteX - barW / 2, y + barPad, barW, barH);
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
   * 性能：最多同时渲染 4 个，无每帧数组分配
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} margin
   * @param {number} fishBarY
   * @param {number} w
   * @param {Array} texts
   */
  _drawFloatingDamage(ctx, margin, fishBarY, w, texts) {
    const baseX = w - margin;
    const baseY = fishBarY;
    let count = 0;

    for (const ft of texts) {
      if (ft.timer <= 0) continue;
      if (count >= 4) break;
      count++;

      const alpha = Math.min(1, ft.timer / 350);

      // 弧线：从鱼条右端出发，先往左上飞升，到顶后往左下回落
      const t = 1 - ft.timer / 800;
      const arcX = baseX - t * 90;
      const arcY = baseY - Math.sin(t * Math.PI) * 60;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 32px Consolas,"Courier New",monospace';
      // 双层文字模拟阴影（避免 shadowBlur 的高分屏开销）
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillText(ft.text, arcX + 2, arcY + 2);
      ctx.fillStyle = ft.color || '#e06050';
      ctx.fillText(ft.text, arcX, arcY);
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
    ctx.fillText(combo + 'x COMBO', cx, cy);
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
    ctx.fillText(c.text, cx, cy);
  }
}

export { CatchUI };
