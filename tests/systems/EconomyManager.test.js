'use strict';

/**
 * EconomyManager 单元测试（T-015）
 * 覆盖: 升级曲线 / 升级溢出结转 / 金币 / 统计 / 称号 / 满级封顶
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EconomyManager, xpForLevel, MAX_LEVEL } from '../../src/systems/EconomyManager.js';

test('xpForLevel 遵循 floor(100 × 1.15^(N-1))', () => {
  assert.equal(xpForLevel(1), 100);
  assert.equal(xpForLevel(2), 115);
  assert.equal(xpForLevel(5), 174);
  assert.equal(xpForLevel(10), 351);
});

test('addXP 正确升级并结转溢出经验', () => {
  const eco = new EconomyManager();
  const res = eco.addXP(250); // 100 + 115 = 215 → Lv3，剩余 35
  assert.equal(res.leveledUp, true);
  assert.equal(res.levelsGained, 2);
  assert.equal(res.fromLevel, 1);
  assert.equal(res.newLevel, 3);
  assert.equal(eco.getLevel(), 3);
  assert.equal(eco.getXp(), 35);
});

test('升级回调按升级次数触发', () => {
  const eco = new EconomyManager();
  const seen = [];
  eco.onLevelUp((lv) => seen.push(lv));
  eco.addXP(600); // 100+115+132+152 = 499 → Lv5，剩余 101
  assert.deepEqual(seen, [2, 3, 4, 5]);
  assert.equal(eco.getLevel(), 5);
  assert.equal(eco.getXp(), 101);
});

test('满级后经验不再升级', () => {
  const eco = new EconomyManager();
  eco.restoreState({ level: MAX_LEVEL, xp: 0, gold: 0 });
  const res = eco.addXP(999999);
  assert.equal(res.leveledUp, false);
  assert.equal(eco.getLevel(), MAX_LEVEL);
  assert.ok(Number.isFinite(eco.getXp()) === false || eco.getXp() > 0);
});

test('金币增减与余额保护', () => {
  const eco = new EconomyManager();
  eco.addGold(100);
  assert.equal(eco.getGold(), 100);
  assert.equal(eco.spendGold(30), true);
  assert.equal(eco.getGold(), 70);
  assert.equal(eco.spendGold(999), false); // 余额不足
  assert.equal(eco.getGold(), 70);
  assert.equal(eco.spendGold(-5), false);
});

test('settleCatch 合并结算并累计统计', () => {
  const eco = new EconomyManager();
  eco.settleCatch(50, 120);
  eco.settleCatch(30, 60);
  assert.equal(eco.getGold(), 80);
  assert.equal(eco.getStats().totalCatches, 2);
  assert.equal(eco.getStats().totalGoldEarned, 80);
  assert.equal(eco.getStats().totalExpEarned, 180);
});

test('称号随等级变化', () => {
  const eco = new EconomyManager();
  assert.equal(eco.getTitle(), '新手');
  eco.restoreState({ level: 10, xp: 0, gold: 0 });
  assert.equal(eco.getTitle(), '渔夫');
  eco.restoreState({ level: 30, xp: 0, gold: 0 });
  assert.equal(eco.getTitle(), '钓鱼大师');
});

test('restoreState/exportState 往返一致', () => {
  const eco = new EconomyManager();
  eco.restoreState({ level: 7, xp: 42, gold: 1234, stats: { totalCatches: 9 } });
  const out = eco.exportState();
  assert.equal(out.level, 7);
  assert.equal(out.xp, 42);
  assert.equal(out.gold, 1234);
  assert.equal(out.stats.totalCatches, 9);
  assert.equal(out.stats.totalGoldEarned, 0);
});

test('getLevelProgress 进度比例正确', () => {
  const eco = new EconomyManager();
  eco.restoreState({ level: 3, xp: 66, gold: 0 });
  const prog = eco.getLevelProgress();
  assert.equal(prog.needed, 132); // floor(100*1.15^2)
  assert.equal(prog.current, 66);
  assert.equal(prog.ratio, 0.5);
});
