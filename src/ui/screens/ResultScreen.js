'use strict';

/**
 * ============================================================
 * src/ui/screens/ResultScreen.js — 结算画面
 * 版本: 1.2
 * 职责: 展示捕获鱼信息、售价/经验计算、纪录比较
 * ============================================================
 */

import { Screen } from '../../core/ScreenRouter.js';

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;
const SCROLL_TIME = 700;

const QUALITY_CFG = {
  Common:    { label: '普通',  color: '#d0d0d0', mult: 1.0 },
  Uncommon:  { label: '优秀',  color: '#40c060', mult: 1.5 },
  Rare:      { label: '稀有',  color: '#40a0e0', mult: 2.5 },
  Epic:      { label: '史诗',  color: '#a060e0', mult: 5.0 },
  Legendary: { label: '传说',  color: '#f0c040', mult: 12.0 },
};
const MUTATION_NAMES = ['无', '普通', '稀有', '传说'];

class ResultScreen extends Screen {
  constructor(router) {
    super(router);
    this._fish = null;
    this._result = { price: 0, exp: 0 };
    this._animTimer = 0;
    this._animDone = false;
    this._displayPrice = 0;
    this._displayExp = 0;
    this._isNewRecord = false;
    this._isFirstCatch = false;
    this._lenRecord = null;
    this._wgtRecord = null;
  }

  /** @override */
  onEnter(params) {
    super.onEnter(params);
    this._fish = (params && params.fish) || null;
    this._animTimer = 0;
    this._animDone = false;
    this._displayPrice = 0;
    this._displayExp = 0;
    if (!this._fish) { console.warn('[Result] 无鱼数据'); return; }
    this._calc();
    this._checkRecords();
    if (DEBUG) console.log('[Result] ' + this._fish.name +
      ' 售价=' + this._result.price + ' 经验=' + this._result.exp +
      ' 品质=' + this._fish.quality +
      (this._isNewRecord ? ' ★新纪录' : '') +
      (this._isFirstCatch ? ' ★首次' : ''));
  }

  /** @override */
  onExit() { this._animDone = true; super.onExit(); }

  /** @override */
  update(dt) {
    if (this._animDone) return;
    this._animTimer += dt;
    const p = Math.min(1, this._animTimer / SCROLL_TIME);
    const e = p * (2 - p);
    this._displayPrice = Math.floor(this._result.price * e);
    this._displayExp = Math.floor(this._result.exp * e);
    if (p >= 1) this._animDone = true;
  }

  /** @override */
  render(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    if (!this._fish) { this._renderError(ctx, w, h); return; }

    // 背景
    ctx.fillStyle = 'rgba(10, 26, 42, 0.2)';
    ctx.fillRect(0, 0, w, h);

    const qCfg = QUALITY_CFG[this._fish.quality] || QUALITY_CFG.Common;

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 32px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12;
    ctx.fillText('\u63D2\u9C7C\u6210\u529F!', cx, 38);
    ctx.shadowBlur = 0;

    // 鱼名
    ctx.font = 'bold 22px Consolas,"Courier New",monospace';
    ctx.fillStyle = qCfg.color;
    ctx.fillText(this._fish.name, cx, 72);

    // 学名小字
    ctx.font = '12px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#5a7a8a';
    ctx.fillText(this._fish.scientificName || '', cx, 94);

    // 品质标签
    ctx.font = 'bold 14px Consolas,"Courier New",monospace';
    ctx.fillStyle = qCfg.color;
    ctx.fillText(qCfg.label, cx, 112);

    // 纪录标记
    if (this._isFirstCatch) {
      ctx.font = 'bold 15px Consolas,"Courier New",monospace';
      ctx.fillStyle = '#60d0d0';
      ctx.shadowColor = 'rgba(80,200,200,0.4)'; ctx.shadowBlur = 8;
      ctx.fillText('\u2728 \u56FE\u9274\u65B0\u53D1\u73B0! \u2728', cx, 140);
      ctx.shadowBlur = 0;
    } else if (this._isNewRecord) {
      const f = Math.floor(Date.now() / 400) % 2 === 0;
      ctx.font = 'bold 16px Consolas,"Courier New",monospace';
      ctx.fillStyle = f ? '#f0d040' : '#d0a030';
      ctx.shadowColor = 'rgba(240,200,50,0.4)'; ctx.shadowBlur = 10;
      ctx.fillText('\u2605 \u65B0\u7EAA\u5F55! \u2605', cx, 140);
      ctx.shadowBlur = 0;
    }

    // 像素鱼图
    this._drawPixelFish(ctx, cx, 186, qCfg.color);

    // 分隔线
    const sepY = 268;
    ctx.strokeStyle = '#3a5a6a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20, sepY); ctx.lineTo(w - 20, sepY); ctx.stroke();

    // 信息区域：竖屏两列错开，横屏两列并排
    const isPortrait = h > w;
    const infoY = sepY + 10;
    const rowH = 26;
    const colW = isPortrait ? w * 0.42 : w * 0.35;
    const gap = isPortrait ? 8 : 20;
    const lx = isPortrait ? 16 : w * 0.12;
    const rx = lx + colW + gap;

    // 两列信息
    const infoRowY = infoY + 22;
    const stars = '\u2605'.repeat(Math.min(10, this._fish.rarity || 1));
    this._drawRow(ctx, lx, infoRowY, '\u4F53\u957F', this._fish.length.toFixed(1) + ' cm');
    const weightStr = this._fish.weight < 0.01 ? this._fish.weight.toFixed(4) + ' kg' : this._fish.weight.toFixed(2) + ' kg';
    this._drawRow(ctx, lx, infoRowY + rowH, '\u4F53\u91CD', weightStr);
    this._drawRow(ctx, lx, infoRowY + rowH * 2, '\u6210\u4F53\u8303\u56F4',
      (this._fish.minLengthCm || '?') + '~' + (this._fish.maxLengthCm || '?') + ' cm');

    this._drawRow(ctx, rx, infoRowY, '\u7A00\u6709\u5EA6', stars);
    this._drawRow(ctx, rx, infoRowY + rowH, '\u53D8\u5F02', MUTATION_NAMES[this._fish.mutationLevel] || '\u65E0');
    this._drawRow(ctx, rx, infoRowY + rowH * 2, '\u6C34\u5C42', this._fish.habitatLayer || '-');

    // 历史纪录：身长最长 / 体重最重
    const histY = infoRowY + rowH * 3 + 6;
    const wgtStr = (v) => v < 0.01 ? v.toFixed(4) : v.toFixed(2);

    // 身长最长：显示纪录值(当前-纪录的差值) - 对应体重
    if (this._lenRecord) {
      const recLen = Math.max(this._lenRecord.length, this._fish.length);
      const recWgt = this._lenRecord.length >= this._fish.length ? this._lenRecord.weight : this._fish.weight;
      const ld = this._fish.length - this._lenRecord.length;
      this._drawHistRow(ctx, lx, histY, '\u8EAB\u957F\u6700\u957F',
        recLen.toFixed(1) + 'cm(' + (ld >= 0 ? '+' : '') + ld.toFixed(1) + 'cm)',
        wgtStr(recWgt) + 'kg', ld >= 0);
    }

    // 体重最重：显示对应体长 - 纪录值(当前-纪录的差值)
    if (this._wgtRecord) {
      const recWgt = Math.max(this._wgtRecord.weight, this._fish.weight);
      const recLen = this._wgtRecord.weight >= this._fish.weight ? this._wgtRecord.length : this._fish.length;
      const wd = this._fish.weight - this._wgtRecord.weight;
      this._drawHistRow(ctx, lx, histY + 22, '\u4F53\u91CD\u6700\u91CD',
        recLen.toFixed(1) + 'cm',
        wgtStr(recWgt) + 'kg(' + (wd >= 0 ? '+' : '') + wd.toFixed(2) + 'kg)', wd >= 0);
    }

    // 分隔线
    const sep2Y = histY + 50;
    ctx.strokeStyle = '#3a5a6a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20, sep2Y); ctx.lineTo(w - 20, sep2Y); ctx.stroke();

    // 售价与经验
    const valY = sep2Y + 12;
    const labelColor = '#8a9aaa';
    const valW = Math.min(w - lx * 2, 320);

    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = 'bold 16px Consolas,"Courier New",monospace';
    ctx.fillStyle = labelColor;
    ctx.fillText('\u552E\u4EF7', lx, valY + 2);
    ctx.textAlign = 'right';
    ctx.font = 'bold 28px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#f0d060';
    ctx.shadowColor = 'rgba(240,200,80,0.3)'; ctx.shadowBlur = 6;
    ctx.fillText('+' + this._displayPrice + ' \u91D1\u5E01', lx + valW, valY);
    ctx.shadowBlur = 0;

    const expY = valY + 38;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = 'bold 16px Consolas,"Courier New",monospace';
    ctx.fillStyle = labelColor;
    ctx.fillText('\u7ECF\u9A8C', lx, expY + 2);
    ctx.textAlign = 'right';
    ctx.font = 'bold 24px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#60c0e0';
    ctx.shadowColor = 'rgba(80,180,220,0.3)'; ctx.shadowBlur = 6;
    ctx.fillText('+' + this._displayExp + ' EXP', lx + valW, expY);
    ctx.shadowBlur = 0;

    // 按钮
    const btnY = h - 72;
    const btnW = isPortrait ? 130 : 140;
    const btnGap = isPortrait ? 10 : 20;
    this._drawBtn(ctx, cx - btnW - btnGap / 2, btnY, btnW, 44, '\u7EE7\u7EED\u9493\u9C7C', '#2a5a4a', '#3a8a5a');
    this._drawBtn(ctx, cx + btnGap / 2, btnY, btnW, 44, '\u8FD4\u56DE\u5730\u56FE', '#4a3a5a', '#5a4a7a');
  }

  /** @private */
  _calc() {
    const f = this._fish;
    const q = QUALITY_CFG[f.quality] || QUALITY_CFG.Common;
    const avg = f.avgLength || f.length;
    const size = Math.pow(f.length / avg, 1.5);
    const mut = f.mutationLevel > 0 ? 2.0 : 1.0;
    this._result = {
      price: Math.floor((f.basePrice || 10) * size * q.mult * mut),
      exp: Math.floor((f.expReward || 5) * size * (1 + q.mult * 0.5)),
    };
  }

  /** @private */
  _checkRecords() {
    this._isFirstCatch = false;
    this._isNewRecord = false;
    this._lenRecord = null;
    this._wgtRecord = null;
    try {
      const state = window.GameState;
      if (!state || !state.fishdex) return;
      const id = this._fish.fishId;
      const noPrior = !state.fishdex.totalPerSpecies || !state.fishdex.totalPerSpecies[id];
      // 从存档读取或初始化纪录
      let lenR, wgtR;
      if (state.fishdex.records && state.fishdex.records[id]) {
        const r = state.fishdex.records[id];
        lenR = { length: r.maxLength || 0, weight: r.maxLengthWeight || 0 };
        wgtR = { length: r.maxWeightLength || 0, weight: r.maxWeight || 0 };
      }
      if (!lenR || lenR.length <= 0) {
        lenR = { length: 0, weight: 0 };
      }
      if (!wgtR || wgtR.weight <= 0) {
        wgtR = { length: 0, weight: 0 };
      }
      this._lenRecord = lenR;
      this._wgtRecord = wgtR;
      if (noPrior) {
        this._isFirstCatch = true;
        this._isNewRecord = true;
        return;
      }
      if (this._fish.length > lenR.length || this._fish.weight > wgtR.weight) {
        this._isNewRecord = true;
      }
    } catch (e) { /* 静默 */ }
  }

  /** @private */
  _drawRow(ctx, x, y, label, value) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = '14px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#7a9aaa';
    ctx.fillText(label, x, y);
    ctx.textAlign = 'right';
    ctx.font = 'bold 14px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#d8e8e8';
    ctx.fillText(value, x + 170, y);
  }

  /** @private */
  _drawHistRow(ctx, x, y, label, left, right, isNew) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = 'bold 12px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#c0a060';
    ctx.fillText(label, x, y);
    ctx.textAlign = 'left';
    ctx.font = '12px Consolas,"Courier New",monospace';
    ctx.fillStyle = isNew ? '#f0d060' : '#7a9aaa';
    ctx.fillText(left + ' - ' + right, x + 80, y);
  }

  /** @private */
  _drawPixelFish(ctx, cx, cy, color) {
    const ps = 7;
    const darkColor = this._fish.mutationLevel >= 3 ? '#b08020' : '#2a3a4a';
    // 不同鱼种不同体型
    const shapeIdx = (this._fish.fishId || 1) % 3;
    let grid;
    if (shapeIdx === 0) {
      // 圆体鱼（鲤科类）
      grid = [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
        [0,0,0,0,0,1,1,1,1,1,1,1,1,3,3,3,0],
        [0,0,2,2,0,1,1,1,4,1,1,1,1,3,3,3,3],
        [0,0,0,2,0,1,1,1,1,4,1,1,1,1,3,3,0],
        [0,0,0,0,0,0,1,1,1,1,1,1,1,3,3,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      ];
    } else if (shapeIdx === 1) {
      // 长体鱼（鳅科、鲶科类）
      grid = [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,3,3,0],
        [0,0,2,2,0,1,1,1,1,4,1,1,1,1,1,1,3,3,3],
        [0,0,0,2,0,1,1,1,1,1,4,1,1,1,1,1,3,3,0],
        [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      ];
    } else {
      // 扁体鱼（鲈科、蝶鱼科类）
      grid = [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,1,1,1,1,1,1,1,3,3,3,0,0],
        [0,0,2,0,1,1,1,1,4,1,1,1,1,3,3,3,0],
        [0,2,2,2,1,1,1,1,1,4,1,1,1,1,3,3,3],
        [0,0,2,0,1,1,1,1,1,1,1,1,1,3,3,0,0],
        [0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      ];
    }
    const ox = cx - (grid[0].length * ps) / 2;
    const oy = cy - (grid.length * ps) / 2;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const v = grid[r][c]; if (v === 0) continue;
        const px = ox + c * ps, py = oy + r * ps;
        if (v === 1) { ctx.fillStyle = color; ctx.fillRect(px, py, ps, ps); }
        else if (v === 3) { ctx.fillStyle = darkColor; ctx.fillRect(px, py, ps, ps); }
        else if (v === 2) { ctx.fillStyle = darkColor; ctx.fillRect(px, py, ps, ps); }
        else if (v === 4) {
          ctx.fillStyle = '#f0f0f0'; ctx.fillRect(px, py, ps, ps);
          ctx.fillStyle = '#1a1a2a'; ctx.fillRect(px + 1, py + 1, ps - 2, ps - 2);
        }
      }
    }
    if (this._fish.mutationLevel >= 2) {
      ctx.shadowColor = color; ctx.shadowBlur = 18;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.strokeRect(ox - 4, oy - 4, grid[0].length * ps + 8, grid.length * ps + 8);
      ctx.shadowBlur = 0;
    }
  }

  /** @private */
  _drawBtn(ctx, x, y, w, h, text, dark, light) {
    ctx.shadowColor = 'rgba(100,200,240,0.2)'; ctx.shadowBlur = 12;
    ctx.fillStyle = dark; ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = light; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText(text, x + w / 2, y + h / 2);
  }

  /** @private */
  _renderError(ctx, w, h) {
    ctx.fillStyle = 'rgba(10, 26, 42, 0.2)'; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '18px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#e06050';
    ctx.fillText('\u6CA1\u6709\u9C7C\u6570\u636E', w / 2, h / 2);
  }

  /** @override */
  handleClick(mx, my) { if (super.handleClick(mx, my)) return true; return true; }

  /** @override */
  _setupRegions() {
    super._setupRegions();
    const w = window.innerWidth, h = window.innerHeight, cx = w / 2;
    const isPortrait = h > w;
    const btnW = isPortrait ? 130 : 140;
    const btnGap = isPortrait ? 10 : 20;
    const btnY = h - 72;
    this._addClickRegion(cx - btnW - btnGap / 2, btnY, btnW, 44, () => {
      this.router.replace('FISHING', { mapId: 1 });
    });
    this._addClickRegion(cx + btnGap / 2, btnY, btnW, 44, () => {
      this.router.pop();
      this.router.pop();
    });
  }
}

export { ResultScreen };
