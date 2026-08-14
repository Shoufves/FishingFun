'use strict';

/**
 * CatchSystem 单元测试（T-009）
 * 覆盖: 耐力计算 / 判定伤害 / 玩家耐力消耗 / 胜负判定 / 连击暴击
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CatchSystem } from '../../src/fishing/CatchSystem.js';
import { calcMarkerInterval } from '../../src/fishing/FormulaSheet.js';

/** 低耐力鱼：鲤鱼（FP=3, R=2） */
const FISH = { fishId: 1, fishName: '鲤鱼', rarity: 2, fightPower: 3 };

/** 高耐力鱼：草鱼（FP=6, R=2），用于连击测试（可承受多次暴击） */
const FISH_HARD = { fishId: 2, fishName: '草鱼', rarity: 2, fightPower: 6 };

/** 推进模拟时间（每帧 16ms） */
function advanceTo(cs, ms) {
  for (let i = 0; i < ms / 16; i++) cs.update(16);
}

test('耐力与伤害基础值正确', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  const state = cs.getState();
  assert.equal(state.fishStamina.max, 68);    // 3×12+2×6+20
  assert.equal(state.playerStamina.max, 265);  // 50×1.5+20×5+50×0.8+50
  assert.equal(state.notes.length, 7);         // 4+floor(3.6)+floor(0.8)
});

test('Perfect 命中: 鱼耐力减全额伤害，玩家不掉耐', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  const fishHp0 = cs.getState().fishStamina.current;
  advanceTo(cs, 1500); // 第一个标记 expectedTime = 1500
  const r = cs.handleInput();
  assert.equal(r.grade, 'perfect');
  const s = cs.getState();
  assert.ok(s.fishStamina.current < fishHp0);
  assert.equal(s.playerStamina.current, s.playerStamina.max);
});

test('Good 命中: 玩家耐力损失约 5%', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  advanceTo(cs, 1580); // 偏离 80ms → Good
  const r = cs.handleInput();
  assert.equal(r.grade, 'good');
  const s = cs.getState();
  const drain = Math.round(s.playerStamina.max * 0.05);
  assert.ok(Math.abs((s.playerStamina.max - s.playerStamina.current) - drain) <= 1);
});

test('Miss 命中: 玩家耐力损失约 12%，鱼不掉血', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  const fishHp0 = cs.getState().fishStamina.current;
  advanceTo(cs, 1700); // 偏离 200ms → 自动 Miss
  const s = cs.getState();
  assert.equal(s.fishStamina.current, fishHp0);
  const drain = Math.round(s.playerStamina.max * 0.12);
  assert.ok(Math.abs((s.playerStamina.max - s.playerStamina.current) - drain) <= 1);
});

test('鱼耐力归零 → 捕获成功', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  cs._fishStamina.current = 1; // 压到临界
  advanceTo(cs, 1580);
  cs.handleInput(); // Good 伤害 ≈ 11.3 > 1
  assert.equal(cs.isFinished(), true);
  assert.equal(cs.getResult(), 'win');
});

test('玩家耐力归零 → 鱼逃脱', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  cs._playerStamina.current = 1;
  advanceTo(cs, 1700); // Miss 掉 12% → 归零
  assert.equal(cs.isFinished(), true);
  assert.equal(cs.getResult(), 'lose');
});

test('连击: 连续 3 次 Perfect 触发 ×1.5 暴击', () => {
  const cs = new CatchSystem();
  cs.start(FISH_HARD);
  const interval = calcMarkerInterval(6, 4.0); // 与 CatchSystem 内部一致
  const baseDmg = cs.getBaseDamage();

  // 直接设定时间轴，精确命中每个标记（offset=0 → Perfect）
  cs._elapsed = 1500;
  cs.handleInput(); // note0 perfect → combo 1
  cs._elapsed = 1500 + interval;
  cs.handleInput(); // note1 perfect → combo 2
  cs._elapsed = 1500 + interval * 2;
  cs.handleInput(); // note2 perfect → combo 3 → 暴击 ×1.5

  const s = cs.getState();
  assert.equal(s.combo, 3);
  const expected = 104 - (baseDmg * 2 + baseDmg * 1.5); // 104 = 6×12+2×6+20
  assert.ok(Math.abs(s.fishStamina.current - expected) <= 1);
});
