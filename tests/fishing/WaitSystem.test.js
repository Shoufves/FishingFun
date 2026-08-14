'use strict';

/**
 * WaitSystem 单元测试（T-008）
 * 覆盖: 鱼种加权选择 / 等待时间范围 / 浮漂状态迁移 / 超时判定
 * 说明: 在 Node 中以 globalThis.window 模拟 window.GameData
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WaitSystem } from '../../src/fishing/WaitSystem.js';

/** 构造最小可用的 GameData 模拟 */
function mockGameData() {
  globalThis.window = {
    __DEBUG__: false,
    GameData: {
      MapDefinition: [{ mapId: 1, difficulty: 1 }],
      MapFishSpawn: [
        { mapId: 1, fishId: 1, spawnWeight: 100 },
        { mapId: 1, fishId: 2, spawnWeight: 300 },
      ],
      FishTable: [
        { fishId: 1, fishName: '鲫鱼', rarity: 1, minLengthCm: 10, maxLengthCm: 40, fightPower: 1 },
        { fishId: 2, fishName: '鲤鱼', rarity: 2, minLengthCm: 20, maxLengthCm: 80, fightPower: 3 },
      ],
      BaitTable: [
        { baitId: 1, attractiveness: 40 },
        { baitId: 2, attractiveness: 0 },
      ],
    },
  };
}

test('鱼种选择遵循 SpawnWeight 加权随机', () => {
  mockGameData();
  const ws = new WaitSystem();
  const counts = {};
  for (let i = 0; i < 2000; i++) {
    const fish = ws._selectFish(1);
    counts[fish.fishId] = (counts[fish.fishId] || 0) + 1;
  }
  // 权重 100:300 → 鲤鱼(2) 应明显多于鲫鱼(1)
  assert.ok(counts[2] > counts[1]);
  assert.equal(counts[1] + counts[2], 2000);
});

test('等待时间落在有效范围内', () => {
  mockGameData();
  const ws = new WaitSystem();
  ws.start(1, 1, 'perfect', { reel: { gearRatio: 4 }, line: { sensitivity: 50 } });
  // 公式钳制 [3,30]s 之后乘抛竿乘数（perfect=0.85）→ 实际区间 [2.55, 25.5]s
  assert.ok(ws._remainingMs >= 2500 && ws._remainingMs <= 30000);
});

test('高吸引力饵料等待时间更短', () => {
  mockGameData();
  const origRandom = Math.random;
  Math.random = () => 0.5; // 固定随机因子，排除随机扰动干扰比较
  try {
    const wsA = new WaitSystem();
    wsA.start(1, 1, 'good', { reel: { gearRatio: 4 }, line: { sensitivity: 50 } });
    const waitA = wsA._remainingMs;
    const wsB = new WaitSystem();
    wsB.start(1, 2, 'good', { reel: { gearRatio: 4 }, line: { sensitivity: 50 } });
    const waitB = wsB._remainingMs;
    assert.ok(waitA < waitB);
  } finally {
    Math.random = origRandom;
  }
});

test('浮漂状态: idle → bobbing（进度 > 35%）', () => {
  mockGameData();
  const origRandom = Math.random;
  Math.random = () => 0.5; // 固定等待时长，避免随机扰动导致提前超时
  try {
    const ws = new WaitSystem();
    ws.start(1, 2, 'good', {});
    // 低吸引力(0)保证不会提前咬钩，可观察状态迁移
    for (let i = 0; i < 60; i++) ws.update(100);
    const state = ws.getFloaterState();
    assert.equal(state.state, 'bobbing');
    assert.ok(state.progress > 0.35);
  } finally {
    Math.random = origRandom;
  }
});

test('等待超时触发 onTimeout（吸引力为 0 不咬钩）', () => {
  mockGameData();
  const ws = new WaitSystem();
  let timedOut = false;
  let bit = false;
  ws.onTimeout(() => { timedOut = true; });
  ws.onBite(() => { bit = true; });
  ws.start(1, 2, 'good', {});
  for (let i = 0; i < 500 && !timedOut; i++) ws.update(100);
  assert.equal(timedOut, true);
  assert.equal(bit, false);
});
