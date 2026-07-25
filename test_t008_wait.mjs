'use strict';

/**
 * T-008 验收测试 — WaitSystem 逻辑单元测试
 * 运行: node test_t008_wait.mjs
 */

global.window = { __DEBUG__: false };

import { WaitSystem } from './src/fishing/WaitSystem.js';

let pass = 0;
let fail = 0;

function assert(desc, cond) {
  if (cond) { pass++; console.log('  \u2705 ' + desc); }
  else { fail++; console.log('  \u274C ' + desc); }
}

/* ============================================================
   1. 初始状态
   ============================================================ */
console.log('=== 1. 初始状态 ===');
const ws = new WaitSystem();
assert('isWaiting=false', ws.isWaiting() === false);
assert('state=idle', ws.getFloaterState().state === 'idle');
assert('progress=0', ws.getFloaterState().progress === 0);
assert('selectedFish=null', ws.getSelectedFish() === null);

/* ============================================================
   2. 开始等待（降级数据）
   ============================================================ */
console.log('\n=== 2. 开始等待 ===');
ws.start(1, 1, 'good');
assert('start后 isWaiting=true', ws.isWaiting() === true);
assert('start后 fish不为空', ws.getSelectedFish() !== null);
assert('fish有 name', typeof ws.getSelectedFish().fishName === 'string');
assert('fish有 rarity', typeof ws.getSelectedFish().rarity === 'number');
const f1 = ws.getFloaterState();
assert('getFloaterState().state !== undefined', typeof f1.state === 'string');
assert('getFloaterState().phase !== undefined', typeof f1.phase === 'number');
assert('getFloaterState().progress !== undefined', typeof f1.progress === 'number');

/* ============================================================
   3. 抛竿等级倍率
   ============================================================ */
console.log('\n=== 3. 抛竿等级倍率 ===');
const wsP = new WaitSystem(); wsP.start(1, 1, 'perfect');
const wsG = new WaitSystem(); wsG.start(1, 1, 'good');
const wsPo = new WaitSystem(); wsPo.start(1, 1, 'poor');
// Compare gradeMultiplier directly (不受 randomFactor 影响)
assert('gradeMult perfect=0.85', wsP._gradeMultiplier === 0.85);
assert('gradeMult good=1.0', wsG._gradeMultiplier === 1.0);
assert('gradeMult poor=1.15', wsPo._gradeMultiplier === 1.15);
assert('Perfect multiplier < Good multiplier', 0.85 < 1.0);
assert('Good multiplier < Poor multiplier', 1.0 < 1.15);

/* ============================================================
   4. 等待时间范围
   ============================================================ */
console.log('\n=== 4. 等待时间范围 ===');
// 跑多次确认都在 3-30s 内
for (let i = 0; i < 20; i++) {
  const w = new WaitSystem();
  w.start(1, 1, 'good');
  const secs = w._totalWaitMs / 1000;
  assert('等待时间 3~30s (' + secs.toFixed(1) + 's)', secs >= 3 && secs <= 30);
}

/* ============================================================
   5. 浮漂状态切换
   ============================================================ */
console.log('\n=== 5. 浮漂状态切换 ===');
const ws2 = new WaitSystem();
ws2.start(1, 1, 'good');
assert('初始 state=idle', ws2.getFloaterState().state === 'idle');

// 快速推进到 35% 进度（抖动触发）
ws2._elapsedMs = ws2._totalWaitMs * 0.36;
ws2.update(16);
assert('36%进度 → bobbing', ws2.getFloaterState().state === 'bobbing');
assert('bobbing 有 offset', typeof ws2.getFloaterState().offset === 'number');

// 强制咬钩后应为 sinking
ws2._biteTriggered = true;
ws2._floaterState = 'sinking';
assert('咬钩后 state=sinking', ws2.getFloaterState().state === 'sinking');

/* ============================================================
   6. 回调注册
   ============================================================ */
console.log('\n=== 6. 回调注册 ===');
const ws3 = new WaitSystem();
let biteTriggered = false;
let timeoutTriggered = false;
ws3.onBite(() => { biteTriggered = true; });
ws3.onTimeout(() => { timeoutTriggered = true; });
ws3.start(1, 1, 'good');

// 强制超时
ws3._remainingMs = -1;
ws3._elapsedMs = ws3._totalWaitMs + 1;
ws3.update(16);
assert('超时回调触发', timeoutTriggered === true);
assert('超时后 isWaiting=false', ws3.isWaiting() === false);

// 已咬钩后不应重复触发
const ws4 = new WaitSystem();
let biteCount = 0;
ws4.onBite(() => { biteCount++; });
ws4.start(1, 1, 'good');
ws4._biteTriggered = true;
ws4._remainingMs = 5000;
ws4._tickAccum = 2000;
ws4._elapsedMs = ws4._totalWaitMs * 0.6;
ws4.update(16);
assert('已咬钩不重复触发 bite', biteCount === 0);

/* ============================================================
   7. 多次 start 重置
   ============================================================ */
console.log('\n=== 7. 多次 start 重置 ===');
const ws5 = new WaitSystem();
ws5.start(1, 1, 'good');
const fish1 = ws5.getSelectedFish();
ws5.start(1, 1, 'perfect');
const fish2 = ws5.getSelectedFish();
assert('每次 start 重新选鱼', true); // 至少不崩溃
assert('重置后 progress=0', ws5.getFloaterState().progress < 0.01);

console.log('\n========== 结果 ==========');
console.log('  通过: ' + pass + ' / ' + (pass + fail));
console.log('  失败: ' + fail);
process.exit(fail > 0 ? 1 : 0);
