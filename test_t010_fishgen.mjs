'use strict';

/**
 * T-010 验收测试 — FishGenerator 单元测试
 * 运行: node test_t010_fishgen.mjs
 */

global.window = { __DEBUG__: false };

import { FishGenerator, MUTATION_RATE, QUALITY_THRESHOLDS } from './src/fishing/FishGenerator.js';

let pass = 0, fail = 0;
function assert(desc, cond) { if (cond) { pass++; console.log('  \u2705 ' + desc); } else { fail++; console.log('  \u274C ' + desc); } }

const g = new FishGenerator();

// 测试用鱼种（模拟 CSV 数据）
const CARP = {
  fishId: 2, fishName: '鲤鱼', scientificName: 'Cyprinus carpio',
  category: '淡水鱼', family: '鲤科 Cyprinidae',
  rarity: 2, minLengthCm: 20, maxLengthCm: 100,
  minWeightKg: 0.25, maxWeightKg: 30.0,
  habitatLayer: '底层', activeTime: '全天',
  fightPower: 6, basePriceGold: 40, expReward: 25,
};

const GOLDFISH = {
  fishId: 1, fishName: '鲫鱼', scientificName: 'Carassius auratus',
  category: '淡水鱼', family: '鲤科 Cyprinidae',
  rarity: 1, minLengthCm: 10, maxLengthCm: 35,
  minWeightKg: 0.03, maxWeightKg: 1.2,
  habitatLayer: '底层', activeTime: '全天',
  fightPower: 2, basePriceGold: 15, expReward: 10,
};

/* ============================================================
   1. 基础生成
   ============================================================ */
console.log('=== 1. 基础生成 ===');
for (let i = 0; i < 20; i++) {
  const fish = g.generate(CARP);
  assert('有 fishId', typeof fish.fishId === 'number');
  assert('有 name', typeof fish.name === 'string');
  assert('长度在范围内', fish.length >= CARP.minLengthCm && fish.length <= CARP.maxLengthCm);
  assert('体重大于0', fish.weight > 0);
  assert('品质有效', ['Common','Uncommon','Rare','Epic','Legendary'].includes(fish.quality));
  assert('变异等级0-3', fish.mutationLevel >= 0 && fish.mutationLevel <= 3);
}

/* ============================================================
   2. 体长分布右偏测试（50次生成，均值应在中段偏下）
   ============================================================ */
console.log('\n=== 2. 体长分布 ===');
const lengths = [];
for (let i = 0; i < 50; i++) {
  lengths.push(g.generate(CARP).length);
}
const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
const mid = (CARP.minLengthCm + CARP.maxLengthCm) / 2;
console.log('  平均长度:', avg.toFixed(1), 'cm (范围', CARP.minLengthCm + '-' + CARP.maxLengthCm + ')');
console.log('  中位点:', mid, 'cm');
assert('均值 < 中位点（右偏）', avg < mid);

/* ============================================================
   3. 品质分布测试
   ============================================================ */
console.log('\n=== 3. 品质分布 ===');
const qualities = { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0 };
for (let i = 0; i < 200; i++) {
  qualities[g.generate(CARP).quality]++;
}
console.log('  Common:', qualities.Common, '/ Uncommon:', qualities.Uncommon,
  '/ Rare:', qualities.Rare, '/ Epic:', qualities.Epic, '/ Legendary:', qualities.Legendary);
assert('Common 最多（占比第一）',
  qualities.Common > qualities.Uncommon && qualities.Common > qualities.Rare);
assert('Legendary 最少', qualities.Legendary < qualities.Rare && qualities.Legendary <= 10);

/* ============================================================
   4. 变异率测试（400次，±2%容差）
   ============================================================ */
console.log('\n=== 4. 变异率 ===');
let mutationCount = 0;
const N = 600;
for (let i = 0; i < N; i++) {
  if (g.generate(CARP).mutationLevel > 0) mutationCount++;
}
const rate = mutationCount / N;
console.log('  变异率:', (rate * 100).toFixed(1) + '% (期望 5%)');
assert('变异率≈5%（±3%）', rate >= 0.02 && rate <= 0.08);

/* ============================================================
   5. 体重幂律验证（直接调用工具方法，确定性的）
   ============================================================ */
console.log('\n=== 5. 体重幂律 ===');
const w20 = g._calculateWeight(CARP, 20);
const w100 = g._calculateWeight(CARP, 100);
console.log('  20cm 体重:', w20.toFixed(4), 'kg');
console.log('  100cm 体重:', w100.toFixed(4), 'kg');
assert('100cm 比 20cm 重', w100 > w20);
// 验证幂律：体长5倍，体重应 > 5^2.5 ≈ 55 倍
assert('体重比例合理', w100 / w20 > 50);

/* ============================================================
   6. a/b 参数反推
   ============================================================ */
console.log('\n=== 6. 幂律参数 ===');
const ab = g._getAB(CARP);
console.log('  鲤鱼 a=' + ab.a.toFixed(6) + ', b=' + ab.b.toFixed(4));
assert('b 在合理范围 2.5~3.5', ab.b > 2.5 && ab.b < 3.5);
assert('a > 0', ab.a > 0);

// 验证边界一致性：Wmin = a * Lmin^b
const checkWmin = ab.a * Math.pow(CARP.minLengthCm, ab.b);
const checkWmax = ab.a * Math.pow(CARP.maxLengthCm, ab.b);
console.log('  验证: Wmin=' + checkWmin.toFixed(4) + ' (期望 ' + CARP.minWeightKg + ')');
console.log('  验证: Wmax=' + checkWmax.toFixed(4) + ' (期望 ' + CARP.maxWeightKg + ')');
assert('Wmin 匹配', Math.abs(checkWmin - CARP.minWeightKg) / CARP.minWeightKg < 0.01);
assert('Wmax 匹配', Math.abs(checkWmax - CARP.maxWeightKg) / CARP.maxWeightKg < 0.01);

/* ============================================================
   7. FishInstance 结构完整性
   ============================================================ */
console.log('\n=== 7. 数据结构 ===');
const fish = g.generate(CARP);
const requiredFields = [
  'fishId', 'name', 'scientificName', 'category', 'family',
  'length', 'weight', 'quality', 'mutationLevel',
  'rarity', 'fightPower', 'basePrice', 'expReward',
  'habitatLayer', 'activeTime',
];
for (const field of requiredFields) {
  assert('FishInstance.' + field + ' 存在', fish[field] !== undefined && fish[field] !== null);
}

/* ============================================================
   8. 边界情况
   ============================================================ */
console.log('\n=== 8. 边界情况 ===');
// 极小数据
const TINY = { ...CARP, minLengthCm: 0, maxLengthCm: 0, minWeightKg: 0, maxWeightKg: 0 };
const tinyFish = g.generate(TINY);
assert('零范围生成不崩溃', tinyFish.length >= 0);
assert('零范围品质=Common', tinyFish.quality === 'Common');

/* ============================================================
   9. Legendary 品质仅在 >97% 分位出现
   ============================================================ */
console.log('\n=== 9. Legendary 触发条件 ===');
const pct97 = CARP.minLengthCm + (CARP.maxLengthCm - CARP.minLengthCm) * 0.97;
const legendary = g._determineQuality(CARP, pct97 + 0.1);
assert('97%+ → Legendary', legendary === 'Legendary');
const epic = g._determineQuality(CARP, pct97 - 1);
assert('略低于97% → Epic', epic === 'Epic');

console.log('\n========== 结果 ==========');
console.log('  通过: ' + pass + ' / ' + (pass + fail));
console.log('  失败: ' + fail);
process.exit(fail > 0 ? 1 : 0);
