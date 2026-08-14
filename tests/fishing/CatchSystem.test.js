'use strict';

/**
 * CatchSystem 单元测试（T-009）
 * 覆盖: 耐力计算 / 判定伤害 / 玩家耐力消耗 / 胜负判定 / 连击暴击
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CatchSystem, CatchNote, HOLD_WINDOW_MS } from '../../src/fishing/CatchSystem.js';
import { calcMarkerInterval, calcMarkerCount } from '../../src/fishing/FormulaSheet.js';

/** Boss 测试鱼（需求2） */
const BOSS_FISH = {
  fishId: 'boss_001', fishName: '深渊巨鳗', rarity: 9, fightPower: 10,
  stamina: 6000,
  noteDensityMult: 0.8,
  trait: { name: '痛击', playerDamageMult: 1.5 },
  skill: { name: '甲壳屏障', type: 'immuneGood', duration: 3000, cooldown: 10000 },
};

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
  assert.equal(state.fishStamina.max, 580);   // 3×60+2×150+100
  assert.equal(state.playerStamina.max, 235);  // 50×1.5+20×4+50×0.6+50
  assert.equal(state.notes.length, 9);         // 4+floor(4.5)+floor(1)
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
  cs._elapsed = cs._notes[0].expectedTime + 68; // 偏移 68ms → Good（窗口 ≤80ms）
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
  cs._elapsed = cs._notes[0].expectedTime + 68; // 偏移 68ms → Good
  cs.handleInput(); // Good 伤害 ≈ 7.5 > 1
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
  const expected = 760 - (baseDmg * 2 + baseDmg * 1.5); // 760 = 6×60+2×150+100
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

test('hold: 头判命中 + 尾判完成，两段伤害但物量只 +1', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  const baseDmg = cs.getBaseDamage();
  const n = makeHoldNote(cs);

  // 头判：头部到达目标区时按下（offset=0 → perfect），combo +1（占物量）
  cs._elapsed = n.expectedTime;
  const headRes = cs.handleInput();
  assert.equal(headRes.grade, 'perfect');
  assert.equal(headRes.holdActive, true);
  assert.equal(cs.getState().combo, 1);

  // 尾判：尾部到达时松开（offset=0 → perfect），combo 不增（物量已计）
  cs._elapsed = n.expectedTime + n.duration;
  const tailRes = cs.handleHoldRelease();
  assert.equal(tailRes.grade, 'perfect');
  assert.equal(cs.getState().combo, 1); // 关键：物量只占 1

  // 总伤害 = 头判 baseDmg + 尾判 baseDmg×0.6
  const s = cs.getState();
  const expected = 580 - baseDmg - baseDmg * 0.6; // 580 = 3×60+2×150+100
  assert.ok(Math.abs(s.fishStamina.current - expected) <= 1);
  assert.equal(n.hit, true, '尾判后键应消失');
});

test('hold: 头判 Good 进入长按但断连击', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  const n = makeHoldNote(cs);

  cs._elapsed = n.expectedTime + 80; // 偏移 80ms → Good
  const headRes = cs.handleInput();
  assert.equal(headRes.grade, 'good');
  assert.equal(headRes.holdActive, true);
  assert.equal(cs.getState().combo, 0); // 非 perfect 断连击

  cs._elapsed = n.expectedTime + n.duration;
  cs.handleHoldRelease();
  assert.equal(cs.getState().combo, 0); // 尾判不改变 combo
});

test('hold: 松得太早（>300ms）→ 尾判 Miss 断连击并扣 12% 耐力', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  const n = makeHoldNote(cs);

  cs._elapsed = n.expectedTime;
  cs.handleInput(); // 头判 perfect → combo 1
  assert.equal(cs.getState().combo, 1);

  cs._elapsed = n.expectedTime + n.duration * 0.4; // 提前松（偏移 -360ms < -300）
  const tailRes = cs.handleHoldRelease();
  assert.equal(tailRes.grade, 'miss');
  assert.equal(cs.getState().combo, 0); // 尾判 miss 断连击

  const s = cs.getState();
  const drain = Math.round(s.playerStamina.max * 0.12);
  assert.ok(Math.abs((s.playerStamina.max - s.playerStamina.current) - drain) <= 1);
});

test('hold: 头判窗口内偏差过大（offset>100ms）→ 整体 Miss', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  const n = makeHoldNote(cs);

  cs._elapsed = n.expectedTime + 120; // 120ms > 80ms 精度窗口
  const res = cs.handleInput();
  assert.equal(res.grade, 'miss');
  assert.equal(n.missed, true);
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

test('hold 长按中重复 keydown 不会打掉进行中的 hold 键', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  const n = makeHoldNote(cs);
  n.duration = 600;
  // 单键场景：移除其余键（生成序列可能含 double/triplet 紧邻键，避免干扰）
  cs._notes = cs._notes.slice(0, 1);

  cs._elapsed = n.expectedTime;
  const head = cs.handleInput();
  assert.equal(head.grade, 'perfect');
  assert.equal(cs.getState().notes[0].holdActive, true);

  // 模拟按住空格触发的 keydown 自动重复（多次 handleInput）
  cs._elapsed = n.expectedTime + 100;
  const rep1 = cs.handleInput();
  assert.equal(rep1.holdActive, true, '重复 keydown 应返回 hold 状态');
  cs._elapsed = n.expectedTime + 200;
  cs.handleInput();
  cs._elapsed = n.expectedTime + 300;
  cs.handleInput();

  const mid = cs.getState().notes[0];
  assert.equal(mid.hit, false, '重复 keydown 不应把 hold 键打掉');
  assert.equal(mid.holdActive, true, 'hold 键应保持长按中');

  // 尾判仍能正常完成
  cs._elapsed = n.expectedTime + n.duration;
  const tail = cs.handleHoldRelease();
  assert.equal(tail.grade, 'perfect');
  assert.equal(cs.getState().notes[0].hit, true);
});

test('hold 卡顿鲁棒: 大 dt 帧 + 持续按住(保活) 不会被超时保护误杀', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  const n = makeHoldNote(cs);
  n.duration = 600;
  cs._notes = cs._notes.slice(0, 1);

  // 头判
  cs._elapsed = n.expectedTime;
  cs.handleInput();
  assert.equal(cs.getState().notes[0].holdActive, true);

  // 模拟 3 帧严重卡顿（每帧 300ms，elapsed 将越过尾部时间）
  for (let i = 0; i < 3; i++) {
    cs.update(300);
    cs.handleHoldKeepAlive(); // 卡顿期间玩家持续按住 → 保活刷新时间戳
  }
  const mid = cs.getState().notes[0];
  assert.equal(mid.hit, false, '卡顿 + 持续按住不应被超时保护误杀');
  assert.equal(mid.holdActive, true, 'hold 应保持长按中');

  // 玩家松开（keyup）→ 正常尾判
  cs._elapsed = n.expectedTime + n.duration;
  const tail = cs.handleHoldRelease();
  assert.equal(tail.grade, 'perfect');
  assert.equal(cs.getState().notes[0].hit, true);
});

test('低帧率输入精确判定: 判定基于输入事件时间戳而非帧时间', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  // 模拟帧率极低：_elapsed 几乎未推进(0ms)，但玩家在真实时间 1500ms 按下
  cs._gameStartReal = 100000;
  const r = cs.handleInput(100000 + 1500); // 事件时间戳 = 基准 + 1500
  assert.equal(r.grade, 'perfect', '应基于事件时间戳判定 Perfect');
  assert.equal(cs.getState().notes[0].hit, true);
});

test('低帧率下 hold 头判/尾判同样精确（事件时间戳）', () => {
  const cs = new CatchSystem();
  cs.start(FISH);
  const n = makeHoldNote(cs);
  n.duration = 600;
  cs._notes = cs._notes.slice(0, 1);
  cs._gameStartReal = 100000;

  const head = cs.handleInput(100000 + n.expectedTime);
  assert.equal(head.grade, 'perfect');
  assert.equal(head.holdActive, true);

  const tail = cs.handleHoldRelease(100000 + n.expectedTime + n.duration);
  assert.equal(tail.grade, 'perfect');
  assert.equal(cs.getState().notes[0].hit, true);
});

test('补充键后判定连续性: 多次补充不破坏键序列与索引（防卡死回归）', () => {
  const cs = new CatchSystem();
  // 固定随机 → 纯 tap 序列（避免 hold 干扰顺序判定）
  const origRandom = Math.random;
  Math.random = () => 0.99;
  try {
    cs.start(FISH_HARD);
  } finally {
    Math.random = origRandom;
  }
  // 高鱼耐力：确保 40 键打完战斗不提前结束（本测试只验证索引连续性）
  cs._fishStamina.max = 999999;
  cs._fishStamina.current = 999999;

  for (let k = 0; k < 40; k++) {
    const note = cs._notes.find(n => !n.hit && !n.missed);
    if (!note) break;
    cs._elapsed = note.expectedTime;
    const r = cs.handleInput();
    assert.notEqual(r.grade, 'miss', '第 ' + k + ' 键应命中，实际 ' + r.grade);
    cs.update(16); // 推进帧：触发 _checkAutoMiss / _extendNotes
    // 索引一致性：idx 之前不应存在被跳过的未处理键
    const skipped = cs._notes.slice(0, cs._currentNoteIdx)
      .filter(n => !n.hit && !n.missed);
    assert.equal(skipped.length, 0,
      '第 ' + k + ' 键后 idx=' + cs._currentNoteIdx + ' 前有被跳过的未处理键');
  }

  // 最终 expectedTime 单调（渲染顺序正确）
  for (let i = 1; i < cs._notes.length; i++) {
    assert.ok(cs._notes[i].expectedTime >= cs._notes[i - 1].expectedTime,
      'expectedTime 应单调');
  }
});

test('hold keyup 丢失: 超时自动按尾判完成结算', () => {
  const cs = new CatchSystem();
  cs.start(FISH_HARD);
  const baseDmg = cs.getBaseDamage();
  const n = makeHoldNote(cs);
  // 单键场景：推进的 elapsed 会让相邻键自动 Miss，干扰 combo 断言
  cs._notes = cs._notes.slice(0, 1);

  cs._elapsed = n.expectedTime;
  cs.handleInput(); // 头判 perfect → combo 1
  assert.equal(cs.getState().combo, 1);

  // 推进到尾部窗口之后，触发一帧 update → 超时保护自动尾判 perfect（不改变 combo）
  // 注: 结算后的键可能被 _obtainNote 复用为补充键（对象池优化），
  //     故用伤害/combo 验证而非键对象引用
  cs._elapsed = n.expectedTime + n.duration + HOLD_WINDOW_MS + 1;
  cs.update(0);
  const s = cs.getState();
  assert.equal(s.combo, 1);
  // 总伤害 = 头判 baseDmg + 尾判 baseDmg×0.6
  const expected = 760 - baseDmg - baseDmg * 0.6; // 760 = 6×60+2×150+100
  assert.ok(Math.abs(s.fishStamina.current - expected) <= 1);
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

/* ============================================================
   Boss 模式测试（需求2）
   ============================================================ */

test('Boss 血量与键密度生效', () => {
  const cs = new CatchSystem();
  cs.start(BOSS_FISH);
  assert.equal(cs.getState().fishStamina.max, 6000, 'Boss 使用定义血量');
  const base = calcMarkerInterval(10, 4.0);
  assert.ok(cs.getNoteInterval() < base, 'Boss 键间隔应比普通传说鱼更密');
});

test('Boss 特性: 对玩家伤害提高（miss 扣 12% × 1.5）', () => {
  const cs = new CatchSystem();
  cs.start(BOSS_FISH);
  cs._notes = cs._notes.slice(0, 1);
  const playerMax = cs.getState().playerStamina.max;
  cs._elapsed = cs._notes[0].expectedTime + 200; // 超过判定窗口
  cs.update(0); // 触发自动 Miss
  const s = cs.getState();
  const expectedDrain = playerMax * 0.12 * 1.5;
  assert.ok(Math.abs((playerMax - s.playerStamina.current) - expectedDrain) <= 1,
    'Boss 特性应提高玩家受到的耐力伤害');
});

test('Boss 技能: 激活期间免疫 Good 伤害', () => {
  const cs = new CatchSystem();
  cs.start(BOSS_FISH);
  cs._notes = cs._notes.slice(0, 1);
  const n = cs._notes[0];
  // 技能周期 13000ms，elapsed ∈ [0, 3000) 为激活期
  cs._elapsed = n.expectedTime + 68; // Good（偏移 68ms ≤ 80）
  const fishHpBefore = cs._fishStamina.current;
  const r = cs.handleInput();
  assert.equal(r.grade, 'good');
  assert.equal(cs._fishStamina.current, fishHpBefore, '激活期间 Good 伤害应为 0');
});

test('Boss 技能: 冷却期 Good 伤害正常', () => {
  const cs = new CatchSystem();
  cs.start(BOSS_FISH);
  cs._notes = cs._notes.slice(0, 1);
  const n = cs._notes[0];
  // 把键的预期时间放到冷却期（elapsed ∈ [3000, 13000)）
  n.expectedTime = 4000;
  cs._elapsed = 4000 + 68; // Good，elapsed=4068 处于冷却期
  const fishHpBefore = cs._fishStamina.current;
  const r = cs.handleInput();
  assert.equal(r.grade, 'good');
  assert.ok(cs._fishStamina.current < fishHpBefore, '冷却期 Good 伤害应正常');
});

test('Boss 技能判定逻辑（immuneGood / immunePerfectOnly）', () => {
  const cs = new CatchSystem();
  cs.start(BOSS_FISH);
  cs._elapsed = 1000; // 激活期
  assert.equal(cs._skillBlocksGrade('good'), true);
  assert.equal(cs._skillBlocksGrade('perfect'), false);
  cs._elapsed = 5000; // 冷却期
  assert.equal(cs._skillBlocksGrade('good'), false);

  // immunePerfectOnly：激活期仅 Perfect 有效
  const cs3 = new CatchSystem();
  cs3.start({
    fishId: 'boss_003', fishName: '极光龙鲤', rarity: 10, fightPower: 10,
    stamina: 8000,
    trait: { playerDamageMult: 2.0 },
    skill: { type: 'immunePerfectOnly', duration: 3000, cooldown: 10000 },
  });
  cs3._elapsed = 1000;
  assert.equal(cs3._skillBlocksGrade('perfect'), false);
  assert.equal(cs3._skillBlocksGrade('great'), true);
  assert.equal(cs3._skillBlocksGrade('good'), true);
});
