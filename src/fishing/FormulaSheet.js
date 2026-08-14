'use strict';

/**
 * ============================================================
 * src/fishing/FormulaSheet.js — 公式配置中心
 * 版本: 1.0
 * 职责: 集中管理所有钓鱼公式，便于平衡调整
 * 约定: 所有公式为纯函数，标注 spec.md / plan.md 来源
 * ============================================================
 */

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/**
 * 抛竿目标区宽度
 * 来源：spec.md 2.1.2
 * @param {number} baseWidth - 基础目标区宽度百分比 (默认 20)
 * @param {number} rodPrecision - 钓竿精度 0-100
 * @param {number} lineSensitivity - 鱼线灵敏度 0-100
 * @param {number} hookSharpness - 鱼钩锋利度 0-100
 * @returns {number} 目标区宽度百分比
 */
function calcPerfectZoneWidth(baseWidth = 20, rodPrecision = 50, lineSensitivity = 50, hookSharpness = 50) {
  const p = rodPrecision / 100;
  const s = lineSensitivity / 100;
  const h = hookSharpness / 100;
  const width = baseWidth * (1 + p * 0.3 + s * 0.2 + h * 0.2);
  if (DEBUG) console.log('[Formula] calcPerfectZoneWidth:', { baseWidth, rodPrecision, lineSensitivity, hookSharpness, result: width });
  return Math.max(10, Math.min(50, width));
}

/**
 * 抛竿光标移动速度 (百分比/秒)
 * 来源：spec.md 2.1.1（精度越高光标越慢，越容易瞄准）
 * @param {number} rodPrecision - 钓竿精度 0-100
 * @returns {number} 光标速度 (百分比/秒，默认约 83)
 */
function calcCastSpeed(rodPrecision = 50) {
  const baseSpeed = 83;
  const factor = 1 - (rodPrecision / 100) * 0.3;
  const speed = baseSpeed * Math.max(0.7, factor);
  if (DEBUG) console.log('[Formula] calcCastSpeed:', { rodPrecision, result: speed });
  return speed;
}

/**
 * 等待时间（秒）
 * 来源：spec.md 2.2.1, plan.md 5.2
 * @param {number} baseWait - 地图基础等待时间 (5-30s)
 * @param {number} fishRarity - 鱼种稀有度 1-10
 * @param {number} baitAttract - 饵料吸引力 0-100
 * @param {number} reelGearRatio - 渔轮速比 3.0-8.0
 * @param {number} lineSensitivity - 鱼线灵敏度 0-100
 * @returns {number} 等待时间（秒）
 */
function calcWaitTime(baseWait, fishRarity, baitAttract, reelGearRatio = 4.0, lineSensitivity = 50) {
  const rarityFactor = 1.0 + (fishRarity - 1) * 0.06;
  const baitFactor = 1.0 - baitAttract / 500;
  const equipFactor = 1 - ((reelGearRatio - 3) / 5) * 0.1 - (lineSensitivity / 100) * 0.05;
  const randomFactor = 0.5 + Math.random() * 1.0;
  const time = baseWait * rarityFactor * baitFactor * Math.max(0.7, equipFactor) * randomFactor;
  if (DEBUG) console.log('[Formula] calcWaitTime:', { baseWait, fishRarity, baitAttract, reelGearRatio, lineSensitivity, result: time });
  return Math.max(3, Math.min(30, time));
}

/**
 * 判定标记数量（难度曲线更陡：挣扎强度权重提升）
 * 来源：spec.md 2.3.3（T-021 平衡调整：×1.2→×1.5、×0.4→×0.5）
 * @param {number} fightPower - 鱼挣扎强度 1-10
 * @param {number} rarity - 鱼稀有度 1-10
 * @returns {number} 标记数量
 */
function calcMarkerCount(fightPower, rarity) {
  const count = 4 + Math.floor(fightPower * 1.5) + Math.floor(rarity * 0.5);
  if (DEBUG) console.log('[Formula] calcMarkerCount:', { fightPower, rarity, result: count });
  return count;
}

/**
 * 判定标记速度 (px/s)（整体更快，压迫感更强）
 * 来源：spec.md 2.3.5（T-021 平衡调整：80→84、×6→×8）
 * @param {number} fightPower - 鱼挣扎强度 1-10
 * @param {number} rarity - 鱼稀有度 1-10
 * @param {number} reelGearRatio - 渔轮速比 3.0-8.0 (高=收线快=标记慢)
 * @returns {number} 标记速度 (px/s)
 */
function calcMarkerSpeed(fightPower, rarity, reelGearRatio = 4.0) {
  let speed = 84 + fightPower * 8;
  if (rarity > 7) speed *= 1.15;
  // 渔轮速比越高，标记速度越慢(更容易)
  const equipFactor = 1 - ((reelGearRatio - 3) / 5) * 0.15;
  speed *= Math.max(0.7, equipFactor);
  if (DEBUG) console.log('[Formula] calcMarkerSpeed:', { fightPower, rarity, reelGearRatio, result: speed });
  return speed;
}

/**
 * 判定标记间隔 (ms)（高难鱼显著更密）
 * 来源：spec.md 2.3.3（T-021 平衡调整：800→760、×30→×40）
 * @param {number} fightPower - 鱼挣扎强度 1-10
 * @param {number} reelGearRatio - 渔轮速比 3.0-8.0
 * @returns {number} 标记间隔 (ms)
 */
function calcMarkerInterval(fightPower, reelGearRatio = 4.0) {
  let interval = 760 - fightPower * 40;
  // 渔轮速比越高，间隔越大(更轻松)
  const equipFactor = 1 + ((reelGearRatio - 3) / 5) * 0.15;
  interval *= Math.min(1.3, equipFactor);
  if (DEBUG) console.log('[Formula] calcMarkerInterval:', { fightPower, reelGearRatio, result: interval });
  return Math.max(300, interval);
}

/**
 * 鱼最大耐力（高难鱼更难磨死）
 * 来源：spec.md 2.3.2（T-021 平衡调整：×12→×14、×6→×8、+20→+24）
 * @param {number} fightPower - 挣扎强度 1-10
 * @param {number} rarity - 稀有度 1-10
 * @returns {number}
 */
function calcFishStamina(fightPower, rarity) {
  const stamina = fightPower * 14 + rarity * 8 + 24;
  if (DEBUG) console.log('[Formula] calcFishStamina:', { fightPower, rarity, result: stamina });
  return stamina;
}

/**
 * 玩家最大耐力
 * 来源：spec.md 2.3.2, plan.md 5.4.1
 * @param {number} rodStrength - 钓竿强度 0-100
 * @param {number} reelDrag - 渔轮刹车力 1-30
 * @param {number} lineTensile - 鱼线拉力 0-100
 * @returns {number}
 */
function calcPlayerStamina(rodStrength = 50, reelDrag = 20, lineTensile = 50) {
  const stamina = rodStrength * 1.5 + reelDrag * 5 + lineTensile * 0.8 + 50;
  if (DEBUG) console.log('[Formula] calcPlayerStamina:', { rodStrength, reelDrag, lineTensile, result: stamina });
  return Math.max(50, stamina);
}

/**
 * 基础伤害
 * 来源：spec.md 2.3.4, plan.md 5.4.2
 * @param {number} rodStrength - 钓竿强度 0-100
 * @param {number} hookSharpness - 鱼钩锋利度 0-100
 * @param {number} reelGearRatio - 渔轮速比 3.0-8.0
 * @param {number} lineTensile - 鱼线拉力 0-100
 * @returns {number}
 */
function calcBaseDamage(rodStrength = 50, hookSharpness = 50, reelGearRatio = 4.0, lineTensile = 50) {
  const damage = rodStrength / 15 + hookSharpness / 8 + reelGearRatio * 2 + lineTensile / 10;
  if (DEBUG) console.log('[Formula] calcBaseDamage:', { rodStrength, hookSharpness, reelGearRatio, lineTensile, result: damage });
  return Math.max(5, damage);
}

export {
  calcPerfectZoneWidth,
  calcCastSpeed,
  calcWaitTime,
  calcMarkerCount,
  calcMarkerSpeed,
  calcMarkerInterval,
  calcFishStamina,
  calcPlayerStamina,
  calcBaseDamage,
};
