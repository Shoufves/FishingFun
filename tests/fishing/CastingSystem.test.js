'use strict';

/**
 * CastingSystem 单元测试（T-007）
 * 覆盖: 目标区计算 / Perfect/Good/Poor 判定 / 自动失败
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CastingSystem } from '../../src/fishing/CastingSystem.js';

/** 默认装备（与 T-017 一致的基础属性） */
const BASE_EQUIP = {
  rod: { precision: 50 },
  line: { sensitivity: 50 },
  hook: { sharpness: 50 },
};

function castAt(progress) {
  const cs = new CastingSystem();
  cs.start(BASE_EQUIP);
  cs._progress = progress; // 直接设定光标位置（测试用）
  return cs.stop().grade;
}

test('Perfect: 光标完全在目标区内', () => {
  assert.equal(castAt(50), 'perfect');
});

test('Good: 光标与目标区重叠 ≥ 50%', () => {
  assert.equal(castAt(40), 'good');
  assert.equal(castAt(60), 'good');
});

test('Poor: 光标与目标区重叠 < 50%', () => {
  assert.equal(castAt(30), 'poor');
  assert.equal(castAt(70), 'poor');
  assert.equal(castAt(5), 'poor');
});

test('装备越好目标区越宽（精度属性影响）', () => {
  const low = new CastingSystem();
  low.start({ rod: { precision: 0 }, line: { sensitivity: 0 }, hook: { sharpness: 0 } });
  const high = new CastingSystem();
  high.start({ rod: { precision: 100 }, line: { sensitivity: 100 }, hook: { sharpness: 100 } });
  const lowW = low.getPerfectZone().end - low.getPerfectZone().start;
  const highW = high.getPerfectZone().end - high.getPerfectZone().start;
  assert.ok(highW > lowW);
});

test('光标往返 3 次后自动失败', () => {
  const cs = new CastingSystem();
  cs.start(BASE_EQUIP);
  // 模拟持续运行：速度 83%/s，往返 3 次 ≈ 7.2s
  for (let i = 0; i < 1000 && cs.isActive(); i++) {
    cs.update(16);
  }
  assert.equal(cs.isActive(), false);
  assert.equal(cs.stop().grade, 'fail');
});
