'use strict';

/**
 * CatchSystem 单元测试（T-009）
 * 覆盖: 耐力计算 / 判定伤害 / 玩家耐力消耗 / 胜负判定 / 连击暴击
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CatchSystem, CatchNote } from '../../src/fishing/CatchSystem.js';
import { calcMarkerInterval, calcMarkerCount } from '../../src/fishing/FormulaSheet.js';

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
  // 固定随机 → 生成纯 tap 序列（排除复杂键型干扰）
  const origRandom = Math.random;
  Math.random = () => 0.99;
  try {
    cs.start(FISH_HARD);
  } finally {
    Math.random = origRandom;
  }
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

/* ============================================================
   T-009.1 复杂键型测试
   ============================================================ */

/** 把第一个未处理的键替换为 hold（构造测试场景） */
function makeHoldNote(cs) {
  const n = cs._notes[0];
  n.type = 'hold';
  n.duration = 600;
  return n;
}

test('hold 完整长按: 伤害 ×1.5 且计入连击', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  const baseDmg = cs.getBaseDamage();
  const n = makeHoldNote(cs);

  // 头部按下 → 启动长按
  cs._elapsed = n.expectedTime;
  const startRes = cs.handleInput();
  assert.equal(startRes.grade, 'hold');
  assert.equal(startRes.holdActive, true);

  // 到尾部松开 → 完整长按
  cs._elapsed = n.expectedTime + n.duration;
  const relRes = cs.handleHoldRelease();
  assert.equal(relRes.grade, 'perfect');
  assert.ok(Math.abs(relRes.damage - baseDmg * 1.5) < 0.01);
  const s = cs.getState();
  assert.equal(s.combo, 1);
  assert.ok(s.fishStamina.current < s.fishStamina.max);
});

test('hold 提前松开: 部分伤害（×0.5），玩家耐力扣 2%', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  const baseDmg = cs.getBaseDamage();
  const n = makeHoldNote(cs);

  cs._elapsed = n.expectedTime;
  cs.handleInput(); // 启动
  cs._elapsed = n.expectedTime + n.duration * 0.5; // 半途松开
  const relRes = cs.handleHoldRelease();
  assert.equal(relRes.grade, 'great');
  assert.ok(Math.abs(relRes.damage - baseDmg * 0.5) < 0.01);

  const s = cs.getState();
  const drain = Math.round(s.playerStamina.max * 0.02);
  assert.ok(Math.abs((s.playerStamina.max - s.playerStamina.current) - drain) <= 1);
});

test('hold 未按下: 头部窗口过后自动 Miss', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  const n = makeHoldNote(cs);

  // 不按，直接推进超过头部窗口（elapsed 从 0 推进）
  advanceTo(cs, n.expectedTime + 200);
  assert.equal(n.missed, true);
  assert.equal(cs.getState().lastGrade, 'miss');
});

test('hold 进行中不会被自动 Miss（keyup 丢失时按完整长按结算）', () => {
  const cs = new CatchSystem();
  cs.start(FISH_HARD);
  const n = makeHoldNote(cs);

  cs._elapsed = n.expectedTime;
  cs.handleInput(); // 启动 hold
  // 继续推进远超尾部，无 keyup → 超时保护按完整长按结算
  advanceTo(cs, n.duration + 500);
  assert.equal(n.hit, true);
  assert.equal(n.grade, 'perfect');
});

test('double: 两个紧邻 tap 可连续命中（间隔 160ms）', () => {
  const cs = new CatchSystem();
  cs.start(FISH_HARD);
  // 构造 double 键：前两个 note 为紧邻 tap
  const n0 = cs._notes[0];
  n0.type = 'tap';
  const n1 = new CatchNote(cs._notes.length, n0.expectedTime + 160, cs.getNoteSpeed(), 'tap');
  cs._notes[1] = n1;

  cs._elapsed = n0.expectedTime;
  assert.equal(cs.handleInput().grade, 'perfect'); // 第一键
  cs._elapsed = n0.expectedTime + 160;
  assert.equal(cs.handleInput().grade, 'perfect'); // 第二键
  assert.equal(cs.getState().combo, 2);
});

test('高难度鱼会生成 hold 复杂键型且标记数达标', () => {
  // 固定随机数让生成逻辑稳定触发特殊键型（roll 小 → hold）
  const origRandom = Math.random;
  Math.random = () => 0.05;
  try {
    const cs = new CatchSystem();
    cs.start({ fishId: 9, fishName: '金枪鱼', rarity: 8, fightPower: 9 });
    const types = cs._notes.map(n => n.type);
    assert.ok(types.includes('hold'), '高难度应生成 hold 键，实际: ' + types.join(','));
    assert.ok(cs._notes.length >= calcMarkerCount(9, 8), '标记数应 ≥ 基础数量');
  } finally {
    Math.random = origRandom;
  }
});
