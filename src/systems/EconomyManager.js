'use strict';

/**
 * ============================================================
 * src/systems/EconomyManager.js — 经济管理器 (T-015)
 * 版本: 1.0
 * 职责: 经验/等级/金币/统计/称号 管理
 * 来源: spec.md 第4章, plan.md 2.5, task.md T-015
 * 约定: 状态通过 restoreState/exportState 与存档同步；纯逻辑，不依赖 UI
 * ============================================================
 */

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/** 升级曲线基础经验（spec.md 4.1.1） */
const LEVEL_BASE = 100;

/** 升级曲线增长率（spec.md 4.1.1: 100 × 1.15^(N-1)） */
const LEVEL_GROWTH = 1.15;

/** 等级上限（task.md T-015） */
const MAX_LEVEL = 99;

/** 称号表（task.md T-015） */
const TITLE_TIERS = Object.freeze([
  { minLevel: 1,  title: '新手' },
  { minLevel: 10, title: '渔夫' },
  { minLevel: 20, title: '钓手' },
  { minLevel: 30, title: '钓鱼大师' },
  { minLevel: 50, title: '传奇钓者' },
  { minLevel: 70, title: '垂钓宗师' },
  { minLevel: 90, title: '神话钓神' },
]);

/**
 * 第 N 级升级所需经验（spec.md 4.1.1）
 * 加 1e-9 浮点保护，避免 100×1.15 类乘积因二进制误差被 floor 错误截断
 * @param {number} level - 当前等级（1 起）
 * @returns {number} 升级所需经验
 */
function xpForLevel(level) {
  return Math.floor(LEVEL_BASE * Math.pow(LEVEL_GROWTH, level - 1) + 1e-9);
}

class EconomyManager {
  constructor() {
    /** @type {{level:number, xp:number, gold:number, stats:Object}} */
    this._player = {
      level: 1,
      xp: 0,
      gold: 0,
      stats: { totalCatches: 0, totalGoldEarned: 0, totalExpEarned: 0 },
    };

    /** @type {Function|null} 任意变更回调 */
    this._onChangeCallback = null;

    /** @type {Function|null} 升级回调 (newLevel) => void */
    this._onLevelUpCallback = null;
  }

  /**
   * 从存档恢复玩家经济状态
   * @param {Object} player - 存档中的 player 对象
   */
  restoreState(player) {
    if (!player) return;
    this._player.level = Math.max(1, Math.min(MAX_LEVEL, player.level || 1));
    this._player.xp = player.xp || 0;
    this._player.gold = player.gold || 0;
    this._player.stats = Object.assign(
      { totalCatches: 0, totalGoldEarned: 0, totalExpEarned: 0 },
      player.stats || {}
    );
  }

  /**
   * 导出可序列化状态（兼容旧存档 player 结构）
   * @returns {Object}
   */
  exportState() {
    return {
      level: this._player.level,
      xp: this._player.xp,
      gold: this._player.gold,
      stats: { ...this._player.stats },
    };
  }

  /* ============================================================
     金币
     ============================================================ */

  /**
   * 增加金币
   * @param {number} amount - 增加数量（>0）
   */
  addGold(amount) {
    const r = this._gainGold(amount);
    this._notify();
    return r;
  }

  /**
   * 花费金币（余额不足时返回 false）
   * @param {number} amount - 花费数量（>0）
   * @returns {boolean} 是否成功扣款
   */
  spendGold(amount) {
    if (!(amount > 0) || this._player.gold < amount) return false;
    this._player.gold -= amount;
    this._notify();
    return true;
  }

  /* ============================================================
     经验与等级
     ============================================================ */

  /**
   * 增加经验，自动处理升级与溢出结转
   * @param {number} amount - 经验值（>0）
   * @returns {{leveledUp:boolean, fromLevel:number, newLevel:number, levelsGained:number}}
   */
  addXP(amount) {
    const r = this._gainXP(amount);
    this._notify();
    return r;
  }

  /**
   * 一次性结算一条鱼获（经验 + 金币 + 捕获统计）
   * @param {number} price - 售价金币
   * @param {number} exp - 经验值
   * @returns {{leveledUp:boolean, fromLevel:number, newLevel:number, levelsGained:number}}
   */
  settleCatch(price, exp) {
    const res = this._gainXP(exp);
    this._gainGold(price);
    this._player.stats.totalCatches += 1;
    this._notify();
    return res;
  }

  /* ============================================================
     查询
     ============================================================ */

  /** @returns {number} */
  getLevel() { return this._player.level; }

  /** @returns {number} */
  getXp() { return this._player.xp; }

  /** @returns {number} */
  getGold() { return this._player.gold; }

  /** @returns {Object} 统计信息副本 */
  getStats() { return { ...this._player.stats }; }

  /** @returns {string} 当前称号 */
  getTitle() {
    let title = TITLE_TIERS[0].title;
    for (const tier of TITLE_TIERS) {
      if (this._player.level >= tier.minLevel) title = tier.title;
    }
    return title;
  }

  /** @returns {number} 升到下一级所需经验（满级返回 Infinity） */
  getXpForNextLevel() {
    if (this._player.level >= MAX_LEVEL) return Infinity;
    return xpForLevel(this._player.level);
  }

  /**
   * 当前等级进度
   * @returns {{current:number, needed:number, ratio:number}}
   */
  getLevelProgress() {
    const needed = this.getXpForNextLevel();
    if (!isFinite(needed)) return { current: 0, needed: 0, ratio: 1 };
    const current = Math.min(this._player.xp, needed);
    return { current, needed, ratio: needed > 0 ? current / needed : 0 };
  }

  /* ============================================================
     回调
     ============================================================ */

  /**
   * 注册任意变更回调
   * @param {Function} cb - () => void
   */
  onChange(cb) { this._onChangeCallback = cb; }

  /**
   * 注册升级回调
   * @param {Function} cb - (newLevel:number) => void
   */
  onLevelUp(cb) { this._onLevelUpCallback = cb; }

  /* ============================================================
     内部方法（不触发通知，供 settleCatch 合并调用）
     ============================================================ */

  /**
   * 增加经验并处理升级（静默）
   * @param {number} amount
   * @returns {{leveledUp:boolean, fromLevel:number, newLevel:number, levelsGained:number}}
   */
  _gainXP(amount) {
    const fromLevel = this._player.level;
    if (amount > 0) {
      this._player.xp += amount;
      this._player.stats.totalExpEarned += amount;
    }
    let levelsGained = 0;
    while (this._player.level < MAX_LEVEL &&
           this._player.xp >= xpForLevel(this._player.level)) {
      this._player.xp -= xpForLevel(this._player.level);
      this._player.level += 1;
      levelsGained += 1;
      if (this._onLevelUpCallback) this._onLevelUpCallback(this._player.level);
    }
    return {
      leveledUp: levelsGained > 0,
      fromLevel,
      newLevel: this._player.level,
      levelsGained,
    };
  }

  /**
   * 增加金币（静默）
   * @param {number} amount
   * @returns {boolean} 是否生效
   */
  _gainGold(amount) {
    if (!(amount > 0)) return false;
    this._player.gold += amount;
    this._player.stats.totalGoldEarned += amount;
    return true;
  }

  /** 触发变更通知 */
  _notify() {
    if (this._onChangeCallback) this._onChangeCallback();
    if (DEBUG) console.log('[Economy] Lv.' + this._player.level +
      ' XP=' + this._player.xp +
      ' 金币=' + this._player.gold);
  }
}

export { EconomyManager, xpForLevel, MAX_LEVEL, TITLE_TIERS, LEVEL_BASE, LEVEL_GROWTH };
