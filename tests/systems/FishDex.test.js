'use strict';

/**
 * FishDex 单元测试（T-019）
 * 覆盖: 首次捕获 / 新纪录判定 / 纪录持久化 / 计数 / 完成度
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FishDex } from '../../src/systems/FishDex.js';

function makeFish(id, length, weight) {
  return { fishId: id, name: '测试鱼' + id, length, weight };
}

test('首次捕获: isFirst=true, isNewRecord=true', () => {
  const dex = new FishDex();
  const info = dex.registerCatch(makeFish(1, 30, 0.5));
  assert.equal(info.isFirst, true);
  assert.equal(info.isNewRecord, true);
  assert.equal(dex.isCaught(1), true);
  assert.equal(dex.getCaughtCount(), 1);
});

test('再次捕获更小个体: 非首次、非新纪录', () => {
  const dex = new FishDex();
  dex.registerCatch(makeFish(1, 30, 0.5));
  const info = dex.registerCatch(makeFish(1, 25, 0.3));
  assert.equal(info.isFirst, false);
  assert.equal(info.isNewRecord, false);
});

test('更大个体触发新纪录并更新纪录值', () => {
  const dex = new FishDex();
  dex.registerCatch(makeFish(1, 30, 0.5));
  const info = dex.registerCatch(makeFish(1, 40, 0.9));
  assert.equal(info.isNewRecord, true);
  const rec = dex.getRecords(1);
  assert.equal(rec.maxLength, 40);
  assert.equal(rec.maxWeight, 0.9);
  assert.equal(rec.maxLengthWeight, 0.9);
  assert.equal(rec.maxWeightLength, 40);
});

test('不同维度纪录独立（长度破纪录但重量不破）', () => {
  const dex = new FishDex();
  dex.registerCatch(makeFish(1, 30, 2.0));
  const info = dex.registerCatch(makeFish(1, 35, 1.0));
  assert.equal(info.isNewRecord, true); // 长度破纪录
  const rec = dex.getRecords(1);
  assert.equal(rec.maxLength, 35);
  assert.equal(rec.maxWeight, 2.0); // 重量纪录保持
  assert.equal(rec.maxWeightLength, 30);
});

test('捕获计数与完成度', () => {
  const dex = new FishDex();
  dex.registerCatch(makeFish(1, 10, 0.1));
  dex.registerCatch(makeFish(1, 11, 0.1));
  dex.registerCatch(makeFish(2, 20, 0.2));
  assert.equal(dex.getTotalCaughtOf(1), 2);
  assert.equal(dex.getCaughtCount(), 2);
  assert.equal(dex.getCompletionRatio(305), 2 / 305);
  assert.equal(dex.getStats().totalCatchCount, 3);
});

test('restoreState/exportState 往返一致', () => {
  const dex = new FishDex();
  dex.registerCatch(makeFish(5, 50, 1.0));
  const out = dex.exportState();
  const dex2 = new FishDex();
  dex2.restoreState(out);
  assert.equal(dex2.isCaught(5), true);
  assert.equal(dex2.getRecords(5).maxLength, 50);
  assert.equal(dex2.getTotalCaughtOf(5), 1);
});
