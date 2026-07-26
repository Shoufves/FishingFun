'use strict';

/**
 * ============================================================
 * src/data/PlaceholderEquipment.js — 装备数据占位
 * 版本: 1.0
 * 职责: 提供默认装备数据（T-017 后替换为真实装备系统）
 * 约定: 属性均值约 50，范围 1-100
 * ============================================================
 */

/**
 * 默认装备数据
 * 渔轮速比 3.0-8.0，刹车力 1-30
 */
const DEFAULT_EQUIPMENT = Object.freeze({
  rod:   { strength: 50, precision: 50, toughness: 50, length: 5, elasticity: 50 },
  reel:  { gearRatio: 4.0, dragPower: 20, lineCapacity: 200, durability: 50 },
  line:  { tensile: 50, sensitivity: 50, stealth: 50, abrasion: 50 },
  hook:  { sharpness: 50, strength: 50, size: 5, barb: 1 },
});

/**
 * 获取默认装备的深拷贝（防止被意外修改）
 * @returns {Object}
 */
function getDefaultEquipment() {
  return JSON.parse(JSON.stringify(DEFAULT_EQUIPMENT));
}

/**
 * 获取各类装备的次要属性（低/中/高三档）
 * @returns {Object}
 */
function getEquipmentTiers() {
  return {
    low: {
      rod:   { strength: 15, precision: 15, toughness: 15, length: 2, elasticity: 15 },
      reel:  { gearRatio: 3.0, dragPower: 5, lineCapacity: 80, durability: 15 },
      line:  { tensile: 15, sensitivity: 15, stealth: 15, abrasion: 15 },
      hook:  { sharpness: 15, strength: 15, size: 2, barb: 0 },
    },
    mid: { ...DEFAULT_EQUIPMENT },
    high: {
      rod:   { strength: 85, precision: 85, toughness: 85, length: 9, elasticity: 85 },
      reel:  { gearRatio: 7.0, dragPower: 28, lineCapacity: 400, durability: 85 },
      line:  { tensile: 85, sensitivity: 85, stealth: 85, abrasion: 85 },
      hook:  { sharpness: 85, strength: 85, size: 9, barb: 1 },
    },
  };
}

export { DEFAULT_EQUIPMENT, getDefaultEquipment, getEquipmentTiers };
