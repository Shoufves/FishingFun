'use strict';

/**
 * ============================================================
 * src/data/EquipmentData.js — 初始装备库
 * 版本: 1.0
 * 职责: 提供至少 12 件初始装备（覆盖四类、不同品质）
 * 约定: 每件装备含唯一 id、名称、类型、品质、基础属性(baseStats)
 * ============================================================
 */

/**
 * 初始装备库
 * 属性说明：
 *   rod:    strength, precision, toughness, length, elasticity
 *   reel:   gearRatio, dragPower, lineCapacity, durability
 *   line:   tensile, sensitivity, stealth, abrasion
 *   hook:   sharpness, strength, size, barb
 */
const EQUIPMENT_LIBRARY = [
  // ===== 钓竿 (6件) =====
  { id: 'rod_001', name: '竹竿',       type: 'rod',  quality: 'COMMON',
    baseStats: { strength: 12, precision: 10, toughness: 8,  length: 3, elasticity: 10 } },
  { id: 'rod_002', name: '碳素竿',     type: 'rod',  quality: 'UNCOMMON',
    baseStats: { strength: 25, precision: 22, toughness: 20, length: 4, elasticity: 25 } },
  { id: 'rod_003', name: '玻璃钢竿',   type: 'rod',  quality: 'RARE',
    baseStats: { strength: 40, precision: 35, toughness: 38, length: 5, elasticity: 30 } },
  { id: 'rod_004', name: '钛合金竿',   type: 'rod',  quality: 'EPIC',
    baseStats: { strength: 60, precision: 55, toughness: 58, length: 6, elasticity: 50 } },
  { id: 'rod_005', name: '纳米竿',     type: 'rod',  quality: 'LEGENDARY',
    baseStats: { strength: 85, precision: 80, toughness: 82, length: 7, elasticity: 75 } },
  { id: 'rod_006', name: '旧木竿',     type: 'rod',  quality: 'COMMON',
    baseStats: { strength: 8,  precision: 6,  toughness: 5,  length: 2, elasticity: 8 } },

  // ===== 渔轮 (3件) =====
  { id: 'reel_001', name: '基础轮',    type: 'reel', quality: 'COMMON',
    baseStats: { gearRatio: 3.5, dragPower: 8,  lineCapacity: 80,  durability: 12 } },
  { id: 'reel_002', name: '变速轮',    type: 'reel', quality: 'UNCOMMON',
    baseStats: { gearRatio: 4.5, dragPower: 15, lineCapacity: 150, durability: 25 } },
  { id: 'reel_003', name: '磁力刹车轮',type: 'reel', quality: 'RARE',
    baseStats: { gearRatio: 5.5, dragPower: 22, lineCapacity: 250, durability: 40 } },

  // ===== 鱼线 (3件) =====
  { id: 'line_001', name: '尼龙线',    type: 'line', quality: 'COMMON',
    baseStats: { tensile: 10, sensitivity: 8,  stealth: 5,  abrasion: 6 } },
  { id: 'line_002', name: '编织线',    type: 'line', quality: 'UNCOMMON',
    baseStats: { tensile: 25, sensitivity: 18, stealth: 15, abrasion: 22 } },
  { id: 'line_003', name: '氟碳线',    type: 'line', quality: 'RARE',
    baseStats: { tensile: 40, sensitivity: 35, stealth: 40, abrasion: 35 } },

  // ===== 鱼钩 (3件) =====
  { id: 'hook_001', name: '普通钩',    type: 'hook', quality: 'COMMON',
    baseStats: { sharpness: 8,  strength: 10, size: 3, barb: 0 } },
  { id: 'hook_002', name: '锐利钩',    type: 'hook', quality: 'UNCOMMON',
    baseStats: { sharpness: 22, strength: 20, size: 4, barb: 1 } },
  { id: 'hook_003', name: '倒刺钩',    type: 'hook', quality: 'RARE',
    baseStats: { sharpness: 35, strength: 38, size: 5, barb: 1 } },
];

export { EQUIPMENT_LIBRARY };
