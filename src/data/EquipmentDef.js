'use strict';

/**
 * ============================================================
 * src/data/EquipmentDef.js — 装备数据模型定义
 * 版本: 1.0
 * 职责: 定义装备类型、品质枚举及其结构
 * ============================================================
 */

/** @readonly @enum {string} */
const EquipmentType = Object.freeze({
  ROD:  'rod',
  REEL: 'reel',
  LINE: 'line',
  HOOK: 'hook',
});

/** @readonly @enum {string} */
const EquipmentQuality = Object.freeze({
  COMMON:    'COMMON',
  UNCOMMON:  'UNCOMMON',
  RARE:      'RARE',
  EPIC:      'EPIC',
  LEGENDARY: 'LEGENDARY',
});

/** @type {Object<string, {label:string, color:string, statMult:number}>} */
const QUALITY_CONFIG = Object.freeze({
  COMMON:    { label: '普通', color: '#d0d0d0', statMult: 1.0 },
  UNCOMMON:  { label: '优秀', color: '#40c060', statMult: 1.25 },
  RARE:      { label: '稀有', color: '#40a0e0', statMult: 1.5 },
  EPIC:      { label: '史诗', color: '#a060e0', statMult: 2.0 },
  LEGENDARY: { label: '传说', color: '#f0c040', statMult: 3.0 },
});

/**
 * 每类装备的属性维度
 */
const TYPE_STATS = Object.freeze({
  rod:  ['strength', 'precision', 'toughness', 'length', 'elasticity'],
  reel: ['gearRatio', 'dragPower', 'lineCapacity', 'durability'],
  line: ['tensile', 'sensitivity', 'stealth', 'abrasion'],
  hook: ['sharpness', 'strength', 'size', 'barb'],
});

/** 背包最大容量 */
const BACKPACK_LIMIT = 99;

export { EquipmentType, EquipmentQuality, QUALITY_CONFIG, TYPE_STATS, BACKPACK_LIMIT };
