'use strict';

/**
 * ============================================================
 * src/fishing/FishGenerator.js — 鱼生成器
 * 版本: 1.0
 * 职责: 根据鱼种定义生成具体个体（体长、体重、品质、变异）
 * 约定: 纯函数，无副作用
 * ============================================================
 */

/* ============================================================
   常量
   ============================================================ */

/** @type {number} 变异触发概率 */
const MUTATION_RATE = 0.05;

/** @type {number[]} 变异等级分布权重 [Lv1, Lv2, Lv3] */
const MUTATION_LEVEL_WEIGHTS = [0.70, 0.25, 0.05];

/** @type {number[]} 变异等级体长上限倍率 */
const MUTATION_LIMITS = [1.15, 1.30, 1.50];

/** @type {number} 品质分位阈值 [Common, Uncommon, Rare, Epic, Legendary) */
const QUALITY_THRESHOLDS = [
  { max: 0.40, name: 'Common' },
  { max: 0.65, name: 'Uncommon' },
  { max: 0.85, name: 'Rare' },
  { max: 0.97, name: 'Epic' },
  { max: 1.00, name: 'Legendary' },
];

/** @type {boolean} */
const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

import { calcFishStamina } from './FormulaSheet.js';

/* ============================================================
   FishGenerator 类
   ============================================================ */

/* ============================================================
   FishGenerator 类
   ============================================================ */

class FishGenerator {
  /**
   * 生成一条完整的鱼实例
   * @param {Object} fishDef - 鱼种定义（来自 FishTable）
   * @param {number} [playerLevel=1] - 玩家等级
   * @param {number} [mapBonus=1.0] - 地图加成（高级钓场血量/体型加成，1=无加成）
   * @param {number} [baitSizeBonus=0] - 饵料体型加成（0~1，高级饵料钓更大鱼）
   * @returns {Object} FishInstance
   */
  generate(fishDef, playerLevel = 1, mapBonus = 1.0, baitSizeBonus = 0) {
    let length = this._generateLength(fishDef);
    let mutationLevel = 0;
    let finalLength = length;

    // 变异判定
    if (Math.random() < MUTATION_RATE) {
      mutationLevel = this._rollMutationLevel();
      finalLength = this._applyMutation(fishDef, length, mutationLevel);
      if (finalLength > fishDef.maxLengthCm) {
        length = finalLength;
      }
    }

    // 地图 + 饵料体型加成（高级钓场/高级饵料 → 体型更大）
    const sizeBonus = (mapBonus - 1) * 0.33 + (baitSizeBonus || 0);
    length = length * (1 + sizeBonus);

    const weight = this._calculateWeight(fishDef, length);
    const quality = this._determineQuality(fishDef, length);

    const avgLength = (fishDef.minLengthCm + fishDef.maxLengthCm) / 2;
    const instance = {
      fishId: fishDef.fishId,
      name: fishDef.fishName,
      scientificName: fishDef.scientificName || '',
      category: fishDef.category || '',
      family: fishDef.family || '',
      length: Math.round(length * 100) / 100,
      weight: Math.round(weight * 1000) / 1000,
      avgLength: Math.round(avgLength * 100) / 100,
      minLengthCm: fishDef.minLengthCm,
      maxLengthCm: fishDef.maxLengthCm,
      quality,
      mutationLevel,
      rarity: fishDef.rarity || 1,
      fightPower: fishDef.fightPower || 1,
      basePrice: fishDef.basePriceGold || 10,
      expReward: fishDef.expReward || 5,
      habitatLayer: fishDef.habitatLayer || '底层',
      activeTime: fishDef.activeTime || '全天',
      caughtAt: Date.now(), // T-011.1: 捕获时间戳
      // 血量（地图加成后；CatchSystem 优先使用此值）
      stamina: Math.round(calcFishStamina(fishDef.fightPower || 1, fishDef.rarity || 1) * mapBonus),
    };

    if (DEBUG) {
      console.log('[FishGen] ' + instance.name +
        ' L=' + instance.length.toFixed(1) + 'cm' +
        ' W=' + instance.weight.toFixed(3) + 'kg' +
        ' [' + quality + ']' +
        (mutationLevel > 0 ? ' MUTATION Lv' + mutationLevel : ''));
    }

    return instance;
  }

  /**
   * 使用 Gamma 分布生成体长
   * @param {Object} fishDef
   * @returns {number}
   */
  _generateLength(fishDef) {
    const minL = fishDef.minLengthCm;
    const maxL = fishDef.maxLengthCm;
    const range = maxL - minL;
    const rarity = fishDef.rarity || 1;

    // k: 常见鱼偏小（右偏），稀有鱼更均匀
    const k = Math.max(2, Math.min(5, 3.0 + rarity * 0.3));
    // θ: 大部分个体落在中低位（右偏），但仍有一定比例的大鱼
    const theta = range / (k * 3);

    let length = minL + this._gammaRandom(k) * theta;
    length = Math.max(minL, Math.min(maxL, length));
    return length;
  }

  /**
   * 幂律计算体重 W = a × L^b
   * @param {Object} fishDef
   * @param {number} lengthCm
   * @returns {number}
   */
  _calculateWeight(fishDef, lengthCm) {
    const { a, b } = this._getAB(fishDef);
    return a * Math.pow(lengthCm, b);
  }

  /**
   * 从 FishTable 的 Min/Max 边界反推 a、b 参数
   * @param {Object} fishDef
   * @returns {{ a: number, b: number }}
   */
  _getAB(fishDef) {
    const Lmin = fishDef.minLengthCm;
    const Lmax = fishDef.maxLengthCm;
    const Wmin = fishDef.minWeightKg;
    const Wmax = fishDef.maxWeightKg;

    if (!Lmin || !Lmax || !Wmin || !Wmax || Lmin === Lmax) {
      return { a: 0.01, b: 3.0 };
    }

    const b = Math.log(Wmax / Wmin) / Math.log(Lmax / Lmin);
    const a = Wmin / Math.pow(Lmin, b);
    return { a, b };
  }

  /**
   * 根据体长在物种范围内的百分比确定品质
   * @param {Object} fishDef
   * @param {number} lengthCm
   * @returns {string}
   */
  _determineQuality(fishDef, lengthCm) {
    const range = fishDef.maxLengthCm - fishDef.minLengthCm;
    if (range <= 0) return 'Common';
    const pct = (lengthCm - fishDef.minLengthCm) / range;

    for (const tier of QUALITY_THRESHOLDS) {
      if (pct <= tier.max) return tier.name;
    }
    return 'Legendary';
  }

  /**
   * 掷变异等级
   * @returns {number} 0-3
   */
  _rollMutationLevel() {
    const r = Math.random();
    let cumulative = 0;
    for (let i = 0; i < MUTATION_LEVEL_WEIGHTS.length; i++) {
      cumulative += MUTATION_LEVEL_WEIGHTS[i];
      if (r < cumulative) return i + 1;
    }
    return 3;
  }

  /**
   * 应用变异体长突破
   * @param {Object} fishDef
   * @param {number} lengthCm
   * @param {number} level - 1-3
   * @returns {number}
   */
  _applyMutation(fishDef, lengthCm, level) {
    const limit = fishDef.maxLengthCm * MUTATION_LIMITS[level - 1];
    // 在原始长度和上限之间均匀随机
    return Math.min(limit, lengthCm + Math.random() * (limit - lengthCm));
  }

  /* ============================================================
     随机数工具
     ============================================================ */

  /**
   * Box-Muller 生成标准正态分布 N(0,1)
   * @returns {number}
   */
  _normalRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Marsaglia & Tsang 方法生成 Gamma(k, 1)  (k >= 1)
   * @param {number} k - 形状参数 (>= 1)
   * @returns {number}
   */
  _gammaRandom(k) {
    if (k < 1) k = 1;
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    let x, v, u;

    for (let i = 0; i < 100; i++) {
      x = this._normalRandom();
      v = 1 + c * x;
      if (v <= 0) continue;

      v = v * v * v;
      u = Math.random();

      if (u < 1 - 0.033 * x * x * x * x) break;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) break;
    }

    return d * v;
  }
}

export { FishGenerator, MUTATION_RATE, QUALITY_THRESHOLDS };
