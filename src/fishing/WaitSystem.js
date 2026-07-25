'use strict';

/**
 * ============================================================
 * src/fishing/WaitSystem.js — 等待咬钩逻辑系统
 * 版本: 1.0
 * 职责: 等待计时、鱼种选择、咬钩判定、浮漂状态管理
 * 约定: 纯逻辑，不依赖 UI 或渲染代码
 * ============================================================
 */

/* ============================================================
   常量
   ============================================================ */

/** @type {number} 基础咬钩率（spec.md 2.2.2） */
const BASE_BITE_RATE = 0.5;

/** @type {number} 咬钩检测间隔（ms） */
const BITE_CHECK_INTERVAL = 1000;

/** @type {number} 抖动触发进度阈值（0-1） */
const BOBBING_THRESHOLD = 0.35;

/** @type {number} 咬钩检测起始进度阈值 */
const BITE_CHECK_START = 0.50;

/** @type {boolean} 调试模式 */
const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/* ============================================================
   WaitSystem 类
   ============================================================ */

class WaitSystem {
  constructor() {
    /** @type {boolean} 是否正在等待 */
    this._isWaiting = false;

    /** @type {number} 剩余等待时间（ms） */
    this._remainingMs = 0;

    /** @type {number} 总等待时间（ms） */
    this._totalWaitMs = 0;

    /** @type {number} 已过去时间（ms） */
    this._elapsedMs = 0;

    /** @type {'idle'|'bobbing'|'sinking'} 浮漂状态 */
    this._floaterState = 'idle';

    /** @type {number} 浮漂正弦相位（累加用） */
    this._floaterPhase = 0;

    /** @type {Object|null} 选中的鱼数据 */
    this._selectedFish = null;

    /** @type {number} 当前饵料吸引力 */
    this._baitAttractiveness = 40;

    /** @type {number} 咬钩检测累积时间 */
    this._tickAccum = 0;

    /** @type {boolean} 是否已触发咬钩 */
    this._biteTriggered = false;

    /** @type {boolean} 是否已触发抖动 */
    this._bobblingTriggered = false;

    /** @type {number} 抖动偏移量（-2~2 px） */
    this._bobOffset = 0;

    /** @type {Function|null} 咬钩回调 */
    this._onBiteCallback = null;

    /** @type {Function|null} 超时回调 */
    this._onTimeoutCallback = null;

    /** @type {number|null} 当前钓场地形 ID */
    this._mapId = null;

    /** @type {number} 抛竿判定等级影响倍率 */
    this._gradeMultiplier = 1.0;
  }

  /**
   * 开始等待流程
   * @param {number} mapId - 地图 ID
   * @param {number} baitId - 饵料 ID
   * @param {string} castGrade - 抛竿判定等级
   */
  start(mapId, baitId, castGrade) {
    this._mapId = mapId;
    this._gradeMultiplier = this._getGradeMultiplier(castGrade);
    this._selectedFish = this._selectFish(mapId);
    this._baitAttractiveness = this._findBaitAttractiveness(baitId);

    const waitTimeMs = this._calculateWaitTime(this._selectedFish) * 1000;

    this._remainingMs = waitTimeMs;
    this._totalWaitMs = waitTimeMs;
    this._elapsedMs = 0;
    this._isWaiting = true;
    this._floaterState = 'idle';
    this._floaterPhase = 0;
    this._tickAccum = 0;
    this._biteTriggered = false;
    this._bobblingTriggered = false;

    if (DEBUG) {
      console.log('[Wait] 等待开始, fish=' + (this._selectedFish ? this._selectedFish.fishName : '?') +
        ', waitTime=' + (waitTimeMs / 1000).toFixed(1) + 's' +
        ', baitAttr=' + this._baitAttractiveness +
        ', gradeMult=' + this._gradeMultiplier.toFixed(2));
    }
  }

  /**
   * 每帧更新等待逻辑
   * @param {number} deltaTime - 毫秒数
   */
  update(deltaTime) {
    if (!this._isWaiting) return;

    this._remainingMs -= deltaTime;
    this._elapsedMs += deltaTime;
    this._floaterPhase += deltaTime * 0.003;
    this._tickAccum += deltaTime;

    const progress = this._elapsedMs / this._totalWaitMs;

    // 抖动阶段
    if (!this._bobblingTriggered && progress >= BOBBING_THRESHOLD) {
      this._bobblingTriggered = true;
      this._floaterState = 'bobbing';
      if (DEBUG) console.log('[Wait] 浮漂开始抖动');
    }

    // 咬钩检测阶段
    if (progress >= BITE_CHECK_START && !this._biteTriggered && this._tickAccum >= BITE_CHECK_INTERVAL) {
      this._tickAccum -= BITE_CHECK_INTERVAL;
      if (this._checkBite()) {
        this._biteTriggered = true;
        this._floaterState = 'sinking';
        if (DEBUG) console.log('[Wait] 咬钩触发！');
        if (this._onBiteCallback) {
          this._onBiteCallback(this._selectedFish);
        }
        return;
      }
    }

    // 超时判定
    if (this._remainingMs <= 0 && !this._biteTriggered) {
      this._isWaiting = false;
      this._floaterState = 'idle';
      if (DEBUG) console.log('[Wait] 等待超时');
      if (this._onTimeoutCallback) {
        this._onTimeoutCallback();
      }
    }

    // 更新抖动偏移（仅 bobbing 状态）
    if (this._floaterState === 'bobbing') {
      this._bobOffset = (Math.random() - 0.5) * 4;
    }
  }

  /**
   * 获取浮漂当前状态
   * @returns {{ state: string, phase: number, offset: number, progress: number }}
   */
  getFloaterState() {
    return {
      state: this._floaterState,
      phase: this._floaterPhase,
      offset: this._bobOffset,
      progress: this._totalWaitMs > 0 ? this._elapsedMs / this._totalWaitMs : 0,
    };
  }

  /**
   * @returns {boolean}
   */
  isWaiting() {
    return this._isWaiting;
  }

  /**
   * @returns {Object|null} 选中的鱼数据
   */
  getSelectedFish() {
    return this._selectedFish;
  }

  /**
   * 注册咬钩回调
   * @param {Function} callback - (fishData) => void
   */
  onBite(callback) {
    this._onBiteCallback = callback;
  }

  /**
   * 注册超时回调
   * @param {Function} callback - () => void
   */
  onTimeout(callback) {
    this._onTimeoutCallback = callback;
  }

  /* ============================================================
     内部方法
     ============================================================ */

  /**
   * 抛竿等级对等待时间的倍率
   * Perfect → 稀有鱼概率↑，等待略短
   * @param {string} grade
   * @returns {number}
   */
  _getGradeMultiplier(grade) {
    switch (grade) {
      case 'perfect': return 0.85;
      case 'good':    return 1.0;
      case 'poor':    return 1.15;
      default:        return 1.0;
    }
  }

  /**
   * 计算等待时间（秒）
   * WaitTime(s) = BaseWait × FishRarityFactor × BaitAttractFactor × RandomRange
   * @param {Object} fish
   * @returns {number}
   */
  _calculateWaitTime(fish) {
    const baseWait = this._getBaseWait(this._mapId);
    const rarityFactor = 1.0 + (fish.rarity - 1) * 0.06;
    const baitFactor = 1.0 - this._baitAttractiveness / 500;
    const randomFactor = 0.5 + Math.random() * 1.0;
    const gradeFactor = this._gradeMultiplier;

    const waitTime = baseWait * rarityFactor * baitFactor * randomFactor * gradeFactor;
    return Math.max(3, Math.min(30, waitTime));
  }

  /**
   * 获取地图基础等待时间
   * 从 MapDefinition.Difficulty 推导（5-30s）
   * @param {number} mapId
   * @returns {number}
   */
  _getBaseWait(mapId) {
    try {
      const mapData = window.GameData ? window.GameData.MapDefinition : null;
      if (!mapData) return 10;
      const entry = mapData.find(m => m.mapId === mapId);
      if (entry && entry.difficulty) {
        return 5 + entry.difficulty * 2.5;
      }
      return 10;
    } catch (e) {
      return 10;
    }
  }

  /**
   * 查找饵料吸引力
   * @param {number} baitId
   * @returns {number}
   */
  _findBaitAttractiveness(baitId) {
    try {
      const baitData = window.GameData ? window.GameData.BaitTable : null;
      if (!baitData) return 40;
      const bait = baitData.find(b => b.baitId === baitId);
      return bait ? bait.attractiveness : 40;
    } catch (e) {
      return 40;
    }
  }

  /**
   * 从 MapFishSpawn 根据权重随机选择一条鱼
   * @param {number} mapId
   * @returns {Object|null} { fishId, fishName, rarity, ... }
   */
  _selectFish(mapId) {
    try {
      const spawnData = window.GameData ? window.GameData.MapFishSpawn : null;
      const fishData = window.GameData ? window.GameData.FishTable : null;
      if (!spawnData || !fishData) return this._fallbackFish();

      // 筛选当前地图的 Spawn 条目
      const entries = spawnData.filter(s => s.mapId === mapId);
      if (entries.length === 0) return this._fallbackFish();

      // 加权随机
      const totalWeight = entries.reduce((sum, e) => sum + e.spawnWeight, 0);
      if (totalWeight <= 0) return this._fallbackFish();

      let r = Math.random() * totalWeight;
      let cumulative = 0;
      let selectedSpawn = entries[entries.length - 1];

      for (const entry of entries) {
        cumulative += entry.spawnWeight;
        if (cumulative > r) {
          selectedSpawn = entry;
          break;
        }
      }

      // 查找鱼的定义
      const fish = fishData.find(f => f.fishId === selectedSpawn.fishId);
      if (!fish) return this._fallbackFish();

      return {
        fishId: fish.fishId,
        fishName: fish.fishName,
        rarity: fish.rarity,
        category: fish.category,
        habitatLayer: fish.habitatLayer,
        activeTime: fish.activeTime,
        fightPower: fish.fightPower,
        basePrice: fish.basePriceGold,
        expReward: fish.expReward,
      };
    } catch (e) {
      if (DEBUG) console.warn('[Wait] 鱼种选择异常:', e.message);
      return this._fallbackFish();
    }
  }

  /**
   * 降级备用鱼（当数据不可用时）
   * @returns {Object}
   */
  _fallbackFish() {
    const rarities = [1, 2, 2, 3, 1, 1, 2, 4, 3, 1];
    const names = [
      '鲫鱼', '鲤鱼', '草鱼', '鳊鱼', '白条',
      '麦穗鱼', '鲮鱼', '青鱼', '鳜鱼', '罗非鱼',
    ];
    const idx = Math.floor(Math.random() * rarities.length);
    return {
      fishId: idx + 1,
      fishName: names[idx],
      rarity: rarities[idx],
      category: '淡水鱼',
      habitatLayer: '底层',
      activeTime: '全天',
      fightPower: Math.floor(rarities[idx] * 2),
      basePrice: 20,
      expReward: 15,
    };
  }

  /**
   * 计算咬钩概率并判定
   * biteChance = BaseBiteRate × (Attractiveness/100) × waterLayerMod × timeMod
   * @returns {boolean}
   */
  _checkBite() {
    // 水层修正和时间修正暂时为 1.0（等装备系统和时段系统就绪后接入）
    const layerMod = 1.0;
    const timeMod = 1.0;

    const biteChance = BASE_BITE_RATE * (this._baitAttractiveness / 100) * layerMod * timeMod;

    // 每次检测用均匀随机判定
    return Math.random() < biteChance;
  }
}

export { WaitSystem, BASE_BITE_RATE };
