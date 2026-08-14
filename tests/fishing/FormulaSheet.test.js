'use strict';

/**
 * FormulaSheet 单元测试（T-012 公式中心）
 * 覆盖: 抛竿 / 等待 / 搏鱼 / 耐力 / 伤害 各公式（来源 spec.md / plan.md）
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcPerfectZoneWidth,
  calcCastSpeed,
  calcWaitTime,
  calcMarkerCount,
  calcMarkerSpeed,
  calcMarkerInterval,
  calcFishStamina,
  calcPlayerStamina,
  calcBaseDamage,
} from '../../src/fishing/FormulaSheet.js';

test('calcPerfectZoneWidth: 属性越高目标区越宽（上限50）', () => {
  assert.equal(calcPerfectZoneWidth(20, 50, 50, 50), 27);
  assert.equal(calcPerfectZoneWidth(20, 100, 100, 100), 34);
  assert.equal(calcPerfectZoneWidth(20, 0, 0, 0), 20);
  assert.ok(calcPerfectZoneWidth(20, 100, 100, 100) <= 50);
});

test('calcCastSpeed: 精度越高光标越慢', () => {
  const slow = calcCastSpeed(100);
  const fast = calcCastSpeed(0);
  assert.ok(slow < fast);
  assert.equal(calcCastSpeed(0), 50);
  assert.ok(Math.abs(calcCastSpeed(100) - 35) < 1e-9); // 50 × 0.7
});

test('calcWaitTime: 范围与方向正确（高吸引力更快）', () => {
  const origRandom = Math.random;
  Math.random = () => 0.5; // 固定随机因子，保证可比较
  try {
    const base = 10;
    const tHigh = calcWaitTime(base, 3, 100, 4.0, 50);
    const tLow = calcWaitTime(base, 3, 0, 4.0, 50);
    assert.ok(tHigh < tLow);
    assert.ok(tHigh >= 3 && tHigh <= 30);
    assert.ok(tLow >= 3 && tLow <= 30);
  } finally {
    Math.random = origRandom;
  }
});

test('calcMarkerCount: 4 + floor(FP×1.2) + floor(R×0.4)', () => {
  assert.equal(calcMarkerCount(3, 2), 9);
  assert.equal(calcMarkerCount(1, 1), 5);
  assert.equal(calcMarkerCount(10, 10), 24);
});

test('calcMarkerSpeed: 挣扎强度越高越快，稀有度>7加速', () => {
  const base = calcMarkerSpeed(3, 2, 3.0);
  const hard = calcMarkerSpeed(8, 8, 3.0);
  assert.equal(calcMarkerSpeed(3, 2, 3.0), 108); // (84+24) × 1.0
  assert.ok(hard > base);
});

test('calcMarkerInterval: 间隔随挣扎强度缩短且不小于300ms', () => {
  assert.equal(calcMarkerInterval(3, 3.0), 550); // (700-150) × 1.0
  assert.ok(calcMarkerInterval(10, 4.0) >= 260);
  assert.ok(calcMarkerInterval(3, 4.0) > calcMarkerInterval(6, 4.0));
});

test('calcFishStamina: FP×12 + R×6 + 20', () => {
  assert.equal(calcFishStamina(3, 2), 120);
  assert.equal(calcFishStamina(1, 1), 68);
  assert.equal(calcFishStamina(10, 10), 356);
});

test('calcPlayerStamina: 装备线性组合 + 50', () => {
  assert.equal(calcPlayerStamina(50, 20, 50), 170);
  assert.equal(calcPlayerStamina(0, 0, 0), 50); // 下限保护
});

test('calcBaseDamage: 四类装备贡献之和', () => {
  const dmg = calcBaseDamage(40, 30, 4.0, 20);
  assert.ok(Math.abs(dmg - 10.94) < 0.1); // 1.90+2.50+5.2+1.33
  assert.ok(calcBaseDamage(80, 60, 6.0, 40) > dmg);
});
