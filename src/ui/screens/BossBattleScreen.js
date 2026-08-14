'use strict';

/**
 * ============================================================
 * src/ui/screens/BossBattleScreen.js — Boss 战斗界面（需求2）
 * 版本: 1.0
 * 职责: 直接进入搏鱼战斗（复用 CatchSystem/CatchUI），展示 Boss 信息与技能状态
 * 胜利: 金币奖励 + 已击败标记；失败: 返回 Boss 列表
 * ============================================================
 */

import { Screen } from '../../core/ScreenRouter.js';
import { CatchSystem } from '../../fishing/CatchSystem.js';
import { CatchUI } from '../CatchUI.js';
import { getBossById } from '../../data/BossData.js';

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;
const END_DISPLAY_TIME = 2500;

class BossBattleScreen extends Screen {
  constructor(router) {
    super(router);
    this._boss = null;
    this._catchSystem = null;
    this._catchUI = null;
    this._statusText = null;
    this._endTimer = null;
    this._keyHandler = null;
    this._won = false;
  }

  /** @override */
  onEnter(params) {
    super.onEnter(params);
    const boss = (params && params.bossId) ? getBossById(params.bossId) : null;
    if (!boss) {
      this._statusText = 'Boss 不存在';
      this._endTimer = setTimeout(() => { this.router.pop(); }, 1200);
      return;
    }
    this._boss = boss;
    this._won = false;
    this._statusText = null;

    // Boss 鱼实例（血量/键型密度/特性/技能直接注入）
    const fish = {
      fishId: boss.id,
      fishName: boss.name,
      rarity: boss.rarity,
      fightPower: boss.fightPower,
      stamina: boss.baseStamina,
      noteDensityMult: boss.noteDensityMult,
      trait: boss.trait,
      skill: boss.skill,
    };
    const equip = window._equipmentManager ? window._equipmentManager.getTotalStats() : null;
    // 读取设置：难度模式（默认轻松）与显示模式（默认横板）
    const st = (window.GameState && window.GameState.settings) || {};
    this._difficulty = (st.difficulty === 'hard') ? 'hard' : 'easy';
    this._orientation = (st.orientation === 'portrait') ? 'portrait' : 'landscape';
    this._catchSystem = new CatchSystem();
    this._catchSystem.setJudgeMode(this._difficulty);
    this._catchUI = new CatchUI();
    this._catchSystem.start(fish, equip);

    this._keyHandler = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (e.type === 'keydown') {
          if (e.repeat) {
            if (!this._catchSystem.isFinished()) this._catchSystem.handleHoldKeepAlive();
            return;
          }
          const r = this._catchSystem.handleInput(e.timeStamp);
          if (r && r.grade !== 'miss') {
            this._playSound(r.grade === 'perfect' ? 'perfect' : 'click');
          }
        } else if (e.type === 'keyup' && !this._catchSystem.isFinished()) {
          const r = this._catchSystem.handleHoldRelease(e.timeStamp);
          if (r && r.hold) {
            this._playSound(r.grade === 'perfect' ? 'perfect' : (r.grade === 'miss' ? 'miss' : 'click'));
          }
        }
      }
    };
    this._addListener(document, 'keydown', this._keyHandler);
    this._addListener(document, 'keyup', this._keyHandler);

    if (DEBUG) console.log('[BossBattle] 挑战 ' + boss.name + ' HP=' + boss.baseStamina);
  }

  /** @override */
  onExit() {
    if (this._endTimer) {
      clearTimeout(this._endTimer);
      this._endTimer = null;
    }
    super.onExit();
  }

  /** @override */
  update(dt) {
    if (!this._catchSystem) return;
    if (this._catchSystem.isFinished()) {
      this._onEnd();
      return;
    }
    this._catchSystem.update(dt);
  }

  /** @override */
  handleClick(mx, my) {
    if (super.handleClick(mx, my)) return true;
    if (this._catchSystem && !this._catchSystem.isFinished()) {
      const r = this._catchSystem.handleInput();
      if (r && r.grade !== 'miss') {
        this._playSound(r.grade === 'perfect' ? 'perfect' : 'click');
      }
    }
    return true;
  }

  /** @override */
  render(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (!this._catchSystem || !this._boss) {
      ctx.fillStyle = 'rgba(10, 10, 20, 0.4)';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 22px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#f0c040';
      ctx.fillText(this._statusText || '...', w / 2, h / 2);
      return;
    }

    ctx.fillStyle = 'rgba(20, 8, 16, 0.4)';
    ctx.fillRect(0, 0, w, h);

    // 顶部 Boss 信息条
    const infoH = 44;
    ctx.fillStyle = 'rgba(16, 8, 16, 0.85)';
    ctx.fillRect(0, 0, w, infoH);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0c040';
    ctx.fillText('\u2694 ' + this._boss.name, 12, 14);
    ctx.font = '11px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#c8a878';
    ctx.fillText(this._boss.trait.name + ' / ' + this._boss.skill.name + ' / \u5956\u52B1 ' + this._boss.reward + '\u91D1', 12, 32);

    // 技能激活警告（右下角）
    const state = this._catchSystem.getState();
    if (state.bossSkill && state.bossSkill.active) {
      const flash = Math.floor(Date.now() / 200) % 2 === 0;
      ctx.textAlign = 'right';
      ctx.font = 'bold 14px Consolas, "Courier New", monospace';
      ctx.fillStyle = flash ? '#ff5050' : '#c03030';
      ctx.fillText('\u26A0 ' + state.bossSkill.name + ' \u6FC0\u6D3B\u4E2D\uFF01', w - 12, infoH + 20);
    }

    // 搏鱼界面（轨道/耐力条下移以避开信息条；支持竖版模式）
    this._catchUI.render(ctx, w, h, state, this._orientation);

    // 结束文字
    if (this._statusText && state.isFinished) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 34px Consolas, "Courier New", monospace';
      ctx.fillStyle = this._won ? '#40d080' : '#e06050';
      ctx.fillText(this._statusText, w / 2 + 2, h / 2 + 2);
      ctx.fillStyle = this._won ? '#40d080' : '#e06050';
      ctx.fillText(this._statusText, w / 2, h / 2);
      if (this._won) {
        ctx.font = '16px Consolas, "Courier New", monospace';
        ctx.fillStyle = '#f0d060';
        ctx.fillText('\u8D4F\u91D1 +' + this._boss.reward + ' \u91D1\u5E01', w / 2, h / 2 + 44);
      }
    }
  }

  /**
   * 战斗结束处理：胜利 → 金币奖励 + 已击败标记
   * @private
   */
  _onEnd() {
    if (this._endTimer) return;
    const result = this._catchSystem.getResult();
    if (result === 'win') {
      this._won = true;
      this._statusText = '\u5DF2\u51FB\u8D25\uFF01';
      // 金币奖励
      if (window._economy) window._economy.addGold(this._boss.reward);
      // 已击败标记
      try {
        const s = window.GameState;
        if (s) {
          if (!Array.isArray(s.bossDefeated)) s.bossDefeated = [];
          if (s.bossDefeated.indexOf(this._boss.id) === -1) {
            s.bossDefeated.push(this._boss.id);
          }
          if (window._persist) window._persist();
        }
      } catch (e) { /* 静默 */ }
      this._playSound('perfect');
    } else {
      this._won = false;
      this._statusText = '\u6311\u6218\u5931\u8D25';
      this._playSound('miss');
    }
    this._endTimer = setTimeout(() => {
      this.router.popTo('BOSS_SELECT');
    }, END_DISPLAY_TIME);
  }

  /** @private */
  _playSound(type) {
    try {
      const audio = window._audio;
      if (audio && typeof audio.playSFX === 'function') {
        audio.playSFX(type, 0.5);
      }
    } catch (e) { /* 静默降级 */ }
  }
}

export { BossBattleScreen };
