'use strict';

/**
 * ============================================================
 * src/data/BossData.js — Boss 挑战数据（需求 2）
 * 职责: 定义 Boss 鱼的完整信息（血量/体型/键型/特性/技能/奖励）
 * 说明: Boss 直接进入搏鱼战斗（跳过抛竿/等待），信息全部写入介绍
 * ============================================================
 */

/**
 * Boss 定义
 * trait: 常驻特性（playerDamageMult=对玩家伤害倍率；playerStaminaMult=玩家耐力上限倍率）
 * skill: 周期技能（type: immuneGood/immuneGreat/immunePerfectOnly；
 *        duration=激活时长 ms；cooldown=冷却时长 ms；周期=激活+冷却）
 * reward: 击败奖励金币
 */
const BOSS_DATA = Object.freeze([
  {
    id: 'boss_001',
    name: '深渊巨鳗',
    enName: 'Abyssal Eel',
    description: '栖息于深海海沟的远古巨鳗，体长近两米，鳞片在黑暗中泛着幽蓝荧光，尾部缠绕着深海高压的残留气息。传闻它是通往深海深渊的守门者，只有真正的钓手才能将其拖出海面。',
    rarity: 9,
    fightPower: 10,
    minLengthCm: 160,
    maxLengthCm: 200,
    minWeightKg: 30,
    maxWeightKg: 45,
    baseStamina: 9000,
    noteDensityMult: 0.8,
    trait: {
      name: '痛击',
      desc: '对玩家造成的耐力伤害提高 20%',
      playerDamageMult: 1.2,
    },
    skill: {
      name: '甲壳屏障',
      desc: '每 13 秒开启 3 秒，期间免疫 Good 伤害（冷却 10 秒）',
      type: 'immuneGood',
      duration: 3000,
      cooldown: 10000,
    },
    reward: 3000,
  },
  {
    id: 'boss_002',
    name: '熔岩鲶',
    enName: 'Lava Catfish',
    description: '活动于火山口热泉中的异变鲶鱼，皮肤如熔岩般赤红滚烫，触须末端燃着火星。它以炽热的岩浆为巢，越靠近火山核心，它的力量就越狂暴。',
    rarity: 9,
    fightPower: 10,
    minLengthCm: 130,
    maxLengthCm: 170,
    minWeightKg: 22,
    maxWeightKg: 32,
    baseStamina: 7500,
    noteDensityMult: 0.85,
    trait: {
      name: '炽热威压',
      desc: '战斗开始时玩家耐力上限降低 10%',
      playerStaminaMult: 0.9,
    },
    skill: {
      name: '熔岩护甲',
      desc: '每 13 秒开启 3 秒，期间免疫 Great 伤害（冷却 10 秒）',
      type: 'immuneGreat',
      duration: 3000,
      cooldown: 10000,
    },
    reward: 2500,
  },
  {
    id: 'boss_003',
    name: '极光龙鲤',
    enName: 'Aurora Dragon Carp',
    description: '传说中跃过龙门化龙失败的锦鲤，鳞片映着极光的七色流光，每一次甩尾都会搅动整片湖水。它的存在本身就是传说，能钓到它的人将被写入垂钓史册。',
    rarity: 10,
    fightPower: 10,
    minLengthCm: 200,
    maxLengthCm: 260,
    minWeightKg: 50,
    maxWeightKg: 70,
    baseStamina: 12000,
    noteDensityMult: 0.75,
    trait: {
      name: '龙威',
      desc: '对玩家造成的耐力伤害提高 50%',
      playerDamageMult: 1.5,
    },
    skill: {
      name: '神鳞护体',
      desc: '每 13 秒开启 3 秒，期间仅 Perfect 伤害有效（冷却 10 秒）',
      type: 'immunePerfectOnly',
      duration: 3000,
      cooldown: 10000,
    },
    reward: 5000,
  },
]);

/**
 * 按 ID 获取 Boss
 * @param {string} id
 * @returns {Object|undefined}
 */
function getBossById(id) {
  return BOSS_DATA.find(b => b.id === id);
}

export { BOSS_DATA, getBossById };
