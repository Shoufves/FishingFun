'use strict';

/**
 * ============================================================
 * src/ui/screens/SettingsScreen.js — 设置界面 (T-023 部分)
 * 版本: 1.0
 * 职责: 音量调节（BGM/SFX）、存档导出/删除
 * 来源: spec.md 8.1, task.md T-023
 * ============================================================
 */

import { Screen } from '../../core/ScreenRouter.js';
import {
  exportSave as exportSaveData,
  deleteSave as deleteSaveData,
  importSave as importSaveData,
} from '../../core/SaveManager.js';
import { MAX_LEVEL } from '../../systems/EconomyManager.js';

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/** 音量步进 */
const VOL_STEP = 0.1;

/** 开发者模式赠送金币 */
const DEV_MODE_GOLD = 99999;

class SettingsScreen extends Screen {
  constructor(router) {
    super(router);
    this._statusText = null;
    this._statusTimer = null;
    this._bgmVolume = 0.7;
    this._sfxVolume = 1.0;
  }

  /** @override */
  onEnter() {
    super.onEnter();
    this._statusText = null;
    this._readVolumes();
    if (DEBUG) console.log('[Settings] 进入设置界面');
  }

  /** @override */
  onExit() {
    if (this._statusTimer) {
      clearTimeout(this._statusTimer);
      this._statusTimer = null;
    }
    super.onExit();
  }

  /** 从存档/音频读取当前音量 */
  _readVolumes() {
    try {
      const s = window.GameState && window.GameState.settings;
      this._bgmVolume = (s && typeof s.musicVolume === 'number') ? s.musicVolume : 0.7;
      this._sfxVolume = (s && typeof s.sfxVolume === 'number') ? s.sfxVolume : 1.0;
    } catch (e) { /* 使用默认值 */ }
  }

  /**
   * 保存设置到存档
   * @private
   */
  _saveSettings() {
    try {
      const state = window.GameState;
      if (!state) return;
      if (!state.settings) state.settings = {};
      state.settings.musicVolume = this._bgmVolume;
      state.settings.sfxVolume = this._sfxVolume;
      if (window._persist) window._persist();
    } catch (e) { /* 静默 */ }
  }

  /** @override */
  render(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;

    ctx.fillStyle = 'rgba(10, 20, 35, 0.3)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 26px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText('设 置', cx, 40);

    // 音量行
    const rowY0 = 110;
    const rowH = 56;
    const rowGap = 16;
    this._drawVolumeRow(ctx, cx, rowY0, rowH, '音乐 (BGM)', this._bgmVolume);
    this._drawVolumeRow(ctx, cx, rowY0 + rowH + rowGap, rowH, '音效 (SFX)', this._sfxVolume);

    // 开发者模式按钮（宽度自适应，避免窄屏溢出）
    const devY = rowY0 + (rowH + rowGap) * 2 + 14;
    const devW = Math.min(320, w - 24);
    this._drawBtn(ctx, cx - devW / 2, devY, devW, 46,
      '⚡ 开发者模式（满级 + 99999 金币）', '#4a3a10', '#6a5518');

    // 存档管理（三按钮一行，宽度自适应）
    const btnY = devY + 46 + 22;
    const btnGap = 8;
    const btnW = Math.min(180, (w - 40 - btnGap * 2) / 3);
    const btnH = 44;
    const btnX0 = cx - (btnW * 3 + btnGap * 2) / 2;
    this._drawBtn(ctx, btnX0, btnY, btnW, btnH, '导入存档', '#2a4a5a', '#3a6a7a');
    this._drawBtn(ctx, btnX0 + btnW + btnGap, btnY, btnW, btnH, '导出存档', '#2a4a5a', '#3a6a7a');
    this._drawBtn(ctx, btnX0 + (btnW + btnGap) * 2, btnY, btnW, btnH, '删除存档', '#5a2a2a', '#7a3a3a');

    // 状态提示
    if (this._statusText) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#e0a040';
      ctx.fillText(this._statusText, cx, btnY + btnH + 26);
    }

    this._drawBackButton(ctx);
  }

  /**
   * 计算音量行自适应布局（渲染与点击区域共用，保证一致）
   * @param {number} w - 窗口宽
   * @param {number} cx - 中心 X
   * @returns {{rowX:number, rowW:number, labelW:number, barX:number, barW:number, btnMinusX:number, btnPlusX:number}}
   * @private
   */
  _volumeLayout(w, cx) {
    const rowW = Math.min(480, w - 24);
    const rowX = cx - rowW / 2;
    const labelW = Math.min(130, rowW * 0.32);
    const btnZone = 76; // 两个 26px 按钮 + 间距 + 边距
    const barX = rowX + labelW + 12;
    const barW = Math.max(60, rowX + rowW - 16 - btnZone - barX);
    return {
      rowX,
      rowW,
      labelW,
      barX,
      barW,
      btnMinusX: barX + barW + 10,
      btnPlusX: barX + barW + 44,
    };
  }

  /**
   * 绘制一行音量调节（宽度自适应，窄屏不溢出）
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} y
   * @param {number} h
   * @param {string} label
   * @param {number} value
   * @private
   */
  _drawVolumeRow(ctx, cx, y, h, label, value) {
    const w = window.innerWidth;
    const lay = this._volumeLayout(w, cx);

    ctx.fillStyle = '#1a3a4a';
    ctx.fillRect(lay.rowX, y, lay.rowW, h);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#c8d8d8';
    ctx.fillText(label, lay.rowX + 14, y + h / 2);

    // 进度条
    ctx.fillStyle = '#0e1e2e';
    ctx.fillRect(lay.barX, y + h / 2 - 6, lay.barW, 12);
    ctx.fillStyle = '#3a8ad0';
    ctx.fillRect(lay.barX + 1, y + h / 2 - 5, (lay.barW - 2) * value, 10);

    ctx.textAlign = 'center';
    ctx.font = 'bold 11px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#e0e8e8';
    ctx.fillText(Math.round(value * 100) + '%', lay.barX + lay.barW / 2, y + h / 2 + 1);

    // 减/加按钮
    const btnY = y + h / 2 - 13;
    this._drawMiniBtn(ctx, lay.btnMinusX, btnY, 26, 26, '-');
    this._drawMiniBtn(ctx, lay.btnPlusX, btnY, 26, 26, '+');
  }

  /**
   * 绘制小型按钮
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string} label
   * @private
   */
  _drawMiniBtn(ctx, x, y, w, h, label) {
    ctx.fillStyle = '#2a5a6a';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3a7a8a';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  /**
   * 绘制主按钮
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string} text
   * @param {string} dark
   * @param {string} light
   * @private
   */
  _drawBtn(ctx, x, y, w, h, text, dark, light) {
    ctx.fillStyle = dark;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = light;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText(text, x + w / 2, y + h / 2);
  }

  /**
   * 绘制返回按钮
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawBackButton(ctx) {
    const bw = 90, bh = 36, bx = 16, by = 12;
    ctx.fillStyle = '#3a5a6a';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#a0c4e0';
    ctx.fillText('\u2190 \u8FD4\u56DE', bx + bw / 2, by + bh / 2);
  }

  /* ============================================================
     交互
     ============================================================ */

  /** @override */
  _setupRegions() {
    super._setupRegions();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;

    this._addClickRegion(16, 12, 90, 36, () => { this.router.pop(); });

    // 音量行（与渲染共用 _volumeLayout，保证点击区域对齐）
    const rowY0 = 110;
    const rowH = 56;
    const rowGap = 16;
    const lay = this._volumeLayout(w, cx);
    // BGM
    this._addClickRegion(lay.btnMinusX, rowY0 + rowH / 2 - 13, 26, 26, () => this._changeVolume('bgm', -VOL_STEP));
    this._addClickRegion(lay.btnPlusX, rowY0 + rowH / 2 - 13, 26, 26, () => this._changeVolume('bgm', VOL_STEP));
    // SFX
    const sfxY = rowY0 + rowH + rowGap;
    this._addClickRegion(lay.btnMinusX, sfxY + rowH / 2 - 13, 26, 26, () => this._changeVolume('sfx', -VOL_STEP));
    this._addClickRegion(lay.btnPlusX, sfxY + rowH / 2 - 13, 26, 26, () => this._changeVolume('sfx', VOL_STEP));

    // 开发者模式按钮（宽度自适应）
    const devY = rowY0 + (rowH + rowGap) * 2 + 14;
    const devW = Math.min(320, w - 24);
    this._addClickRegion(cx - devW / 2, devY, devW, 46, () => this._doDevMode());

    // 存档管理按钮（三按钮一行）
    const btnY = devY + 46 + 22;
    const btnGap = 8;
    const btnW = Math.min(180, (w - 40 - btnGap * 2) / 3);
    const btnH = 44;
    const btnX0 = cx - (btnW * 3 + btnGap * 2) / 2;
    this._addClickRegion(btnX0, btnY, btnW, btnH, () => this._doImport());
    this._addClickRegion(btnX0 + btnW + btnGap, btnY, btnW, btnH, () => this._doExport());
    this._addClickRegion(btnX0 + (btnW + btnGap) * 2, btnY, btnW, btnH, () => this._doDelete());
  }

  /**
   * 开发者模式：一键升至满级并赠送 99999 金币
   * @private
   */
  _doDevMode() {
    const eco = window._economy;
    if (!eco) return;
    eco.restoreState({
      level: MAX_LEVEL,
      xp: 0,
      gold: DEV_MODE_GOLD,
      stats: eco.getStats(),
    });
    if (window._persist) window._persist();
    this._setStatus('开发者模式：已升至 Lv.' + MAX_LEVEL + '，金币 ' + DEV_MODE_GOLD);
    if (DEBUG) console.log('[Settings] 开发者模式已启用');
  }

  /**
   * 调节音量
   * @param {string} kind - 'bgm' | 'sfx'
   * @param {number} delta
   * @private
   */
  _changeVolume(kind, delta) {
    const v = (kind === 'bgm' ? this._bgmVolume : this._sfxVolume) + delta;
    const clamped = Math.max(0, Math.min(1, Math.round(v * 10) / 10));
    if (kind === 'bgm') {
      this._bgmVolume = clamped;
      if (window._audio) window._audio.setBGMVolume(clamped);
    } else {
      this._sfxVolume = clamped;
      if (window._audio) window._audio.setSFXVolume(clamped);
    }
    this._saveSettings();
  }

  /** 导出存档到剪贴板 */
  _doExport() {
    try {
      const json = exportSaveData();
      const ta = document.createElement('textarea');
      ta.value = json;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this._setStatus('存档已导出（JSON 已复制到剪贴板）');
    } catch (e) {
      this._setStatus('导出失败，请查看控制台');
      if (DEBUG) console.warn('[Settings] 导出失败:', e.message);
    }
  }

  /**
   * 导入存档：弹出 DOM 模态，粘贴 JSON 后校验并覆盖当前存档
   * @private
   */
  _doImport() {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.72);' +
      'display:flex;align-items:center;justify-content:center;z-index:100;';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    const panel = document.createElement('div');
    panel.style.cssText =
      'background:#1a2a3a;border:2px solid #3a5a6a;padding:16px;' +
      'width:min(92vw,440px);border-radius:4px;box-sizing:border-box;';

    const title = document.createElement('div');
    title.textContent = '\u5BFC\u5165\u5B58\u6863 \u2014 \u7C98\u8D34\u5B58\u6863 JSON';
    title.style.cssText =
      'color:#f0e6c0;font:bold 14px Consolas,monospace;margin-bottom:8px;';

    const ta = document.createElement('textarea');
    ta.style.cssText =
      'width:100%;height:150px;background:#0e1e2e;color:#c8d8d8;' +
      'font:12px Consolas,monospace;border:1px solid #3a5a6a;resize:vertical;' +
      'box-sizing:border-box;padding:6px;';
    ta.placeholder = '\u7C98\u8D34\u4ECE\u201C\u5BFC\u51FA\u5B58\u6863\u201D\u590D\u5236\u7684 JSON \u5185\u5BB9...';

    const err = document.createElement('div');
    err.style.cssText =
      'color:#e06050;font:12px Consolas,monospace;margin-top:8px;min-height:16px;';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'margin-top:10px;display:flex;gap:8px;justify-content:flex-end;';

    const btnImport = document.createElement('button');
    btnImport.textContent = '\u5BFC\u5165\u5E76\u8986\u76D6';
    const btnCancel = document.createElement('button');
    btnCancel.textContent = '\u53D6\u6D88';
    for (const b of [btnImport, btnCancel]) {
      b.style.cssText =
        'background:#2a5a6a;color:#f0e6c0;border:none;padding:8px 14px;' +
        'font:bold 13px Consolas,monospace;border-radius:3px;cursor:pointer;';
    }

    btnImport.addEventListener('click', () => {
      const text = ta.value.trim();
      if (!text) {
        err.textContent = '\u8BF7\u5148\u7C98\u8D34\u5B58\u6863\u5185\u5BB9';
        return;
      }
      const result = importSaveData(text);
      if (!result.ok) {
        err.textContent = result.error || '\u5BFC\u5165\u5931\u8D25';
        return;
      }
      overlay.remove();
      this._setStatus('\u5BFC\u5165\u6210\u529F\uFF0C\u6B63\u5728\u91CD\u65B0\u52A0\u8F7D...');
      setTimeout(() => { window.location.reload(); }, 800);
    });
    btnCancel.addEventListener('click', () => { overlay.remove(); });

    btnRow.append(btnImport, btnCancel);
    panel.append(title, ta, err, btnRow);
    overlay.append(panel);
    document.body.appendChild(overlay);
    ta.focus();
  }

  /** 删除存档 */
  _doDelete() {
    if (typeof window !== 'undefined' && !window.confirm('确定删除所有存档？此操作不可恢复！')) {
      return;
    }
    deleteSaveData();
    this._setStatus('存档已删除，正在重新加载...');
    setTimeout(() => { window.location.reload(); }, 800);
  }

  /**
   * 显示状态提示
   * @param {string} text
   * @private
   */
  _setStatus(text) {
    this._statusText = text;
    if (this._statusTimer) clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => {
      this._statusText = null;
      this._statusTimer = null;
    }, 2500);
  }
}

export { SettingsScreen };
