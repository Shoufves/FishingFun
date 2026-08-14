'use strict';

/**
 * BaitSystem 单元测试（基础饵/无限兜底机制）
 * 覆盖: 基础饵恒可装备/无限使用、耗尽回退、标签/吸引力、循环切换、存档恢复
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BaitSystem, BASE_BAIT_ID, BASE_BAIT_ATTRACTIVENESS } from '../../src/systems/BaitSystem.js';

/** 模拟 window.GameData.BaitTable（仅 BaitSystem 查询用） */
function mockGameData() {
  globalThis.window = {
    __DEBUG__: false,
    GameData: {
      BaitTable: [
        { baitId: 1, baitName: '红蚯蚓', baitType: '活饵', rarity: 1, attractiveness: 40, durability: 5 },
        { baitId: 2, baitName: '黑蚯蚓', baitType: '活饵', rarity: 2, attractiveness: 50, durability: 3 },
      ],
    },
  };
}

test('基础饵: 恒可装备且数量无限', () => {
  const bs = new BaitSystem();
  assert.equal(bs.equipBait(BASE_BAIT_ID), true);
  assert.equal(bs.getEquippedBait(), BASE_BAIT_ID);
  assert.equal(bs.getBaitCount(BASE_BAIT_ID), Infinity);
});

test('基础饵: consumeBait 不消耗数量且始终可用', () => {
  const bs = new BaitSystem();
  bs.equipBait(BASE_BAIT_ID);
  for (let i = 0; i < 100; i++) {
    assert.equal(bs.consumeBait(), true, '基础饵应始终可用');
  }
  assert.equal(bs.getEquippedBait(), BASE_BAIT_ID);
});

test('真饵料耗尽后自动回到基础饵（槽位不空）', () => {
  const bs = new BaitSystem();
  bs.addBait(1, 1);
  bs.equipBait(1);
  assert.equal(bs.getEquippedBait(), 1);
  bs.consumeBait(); // 唯一一个红蚯蚓消耗
  assert.equal(bs.getBaitCount(1), 0);
  assert.equal(bs.getEquippedBait(), BASE_BAIT_ID, '耗尽后应回到基础饵');
  assert.equal(bs.consumeBait(), true, '基础饵兜底仍可钓');
});

test('基础饵: 标签/吸引力/统计', () => {
  mockGameData();
  const bs = new BaitSystem();
  bs.equipBait(BASE_BAIT_ID);
  assert.equal(bs.getEquippedLabel(), '基础饵 ∞');
  assert.equal(bs.getCurrentAttractiveness(), BASE_BAIT_ATTRACTIVENESS);
  const stats = bs.getBaitStats();
  assert.equal(stats.baitId, BASE_BAIT_ID);
  assert.equal(stats.durability, Infinity);
});

test('循环切换包含基础饵', () => {
  mockGameData();
  const bs = new BaitSystem();
  bs.addBait(1, 3);
  bs.addBait(2, 2);
  bs.equipBait(BASE_BAIT_ID);
  bs.cycleBait();
  assert.equal(bs.getEquippedBait(), 1, '基础饵后应切到库存饵料');
  bs.cycleBait();
  assert.equal(bs.getEquippedBait(), 2);
  bs.cycleBait();
  assert.equal(bs.getEquippedBait(), BASE_BAIT_ID, '循环回基础饵');
});

test('存档恢复: 无饵料/已耗尽时回到基础饵', () => {
  const bs = new BaitSystem();
  bs.restoreState({}, null);
  assert.equal(bs.getEquippedBait(), BASE_BAIT_ID, '旧档无饵料应回基础饵');
  const bs2 = new BaitSystem();
  bs2.restoreState({}, 1); // 存档装备了红蚯蚓但库存为空（已耗尽）
  assert.equal(bs2.getEquippedBait(), BASE_BAIT_ID);
});

test('getOwnedBaits 只返回库存 > 0 的饵料', () => {
  mockGameData();
  const bs = new BaitSystem();
  bs.addBait(2, 2);
  const owned = bs.getOwnedBaits();
  assert.equal(owned.length, 1);
  assert.equal(owned[0].baitId, 2);
  assert.equal(owned[0].baitName, '黑蚯蚓');
  assert.equal(owned[0].count, 2);
});
