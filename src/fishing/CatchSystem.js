'use strict';

/**
 * ============================================================
 * src/fishing/CatchSystem.js — 收线搏鱼逻辑系统
 * 版本: 3.0 (Boss 模式支持)
 * 职责: 双耐力管理、判定标记生成与移动、伤害计算、狂暴与连击、Boss 特性/技能
 * 键型: tap(单点) / hold(长按) / double(双连击) / triplet(三连滚奏) / accel(变速段)
 * Boss 键型: 复杂键型库 BOSS_PATTERN_LIB（trill/burst4/stream6/dblStream/streamHold/mixed/stair）
 * 约定: 纯逻辑，不依赖 UI 或渲染代码
 * ============================================================
 */

/* ============================================================
   常量
   ============================================================ */

/** @type {number} 标记轨道宽度（用于计算移动位置的虚拟像素） */
const TRACK_WIDTH = 400;

/** @type {number} 每个标记到达目标区所需时间（ms） */
const NOTE_TRAVEL_TIME = 2000;

/** @type {number} 键从轨道起点到目标区的视觉旅行时间（ms），横竖屏统一（CatchUI 共用）
 *  2026-07-27 用户反馈：1500→1700，音符下落速度稍慢（约慢 13%） */
const NOTE_TRAVEL_VISUAL_MS = 1700;

/** @type {number} 准备时间（ms），第一个标记开始移动前
 *  与视觉旅行时间联动：保证第一个键恰好从轨道起点出现（不中途冒出） */
const PREP_TIME = NOTE_TRAVEL_VISUAL_MS;

/** @type {number} 判定后动画持续时间（ms） */
const HIT_ANIM_DURATION = 150;

/** @type {number} 狂暴触发阈值 */
const RAGE_THRESHOLD = 0.25;

/** @type {boolean} 调试模式 */
const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/**
 * 判定窗口配置（设置：困难/轻松，默认轻松）
 * 困难 = 原设计；轻松 = 更宽容
 */
const JUDGE_WINDOWS = Object.freeze({
  hard: { perfect: 25, great: 50, good: 80 },
  easy: { perfect: 40, great: 80, good: 120 },
});

/* ============================================================
   复杂键型常量（T-009.1）
   ============================================================ */

/** @type {number} hold 最短时长（ms） */
const HOLD_MIN_MS = 500;

/** @type {number} 挣扎强度每点增加的 hold 时长（ms） */
const HOLD_PER_FP_MS = 40;

/** @type {number} double 两键间隔（ms） */
const DOUBLE_GAP_MS = 160;

/** @type {number} triplet 三键间隔（ms） */
const TRIPLET_GAP_MS = 120;

/** @type {number} hold 头判/尾判判定窗口（ms） */
const HOLD_WINDOW_MS = 150;

/**
 * 尾判伤害倍率（按尾判精度）
 * 设计: hold 共两个判定点（头判+尾判），但只占 1 个物量(combo)。
 * 头判伤害 = 基础伤害 × 精度系数(同 tap)；尾判伤害 = 基础伤害 × 下表倍率。
 */
const TAIL_DMG_MULT = Object.freeze({
  perfect: 0.6,
  good: 0.3,
  miss: 0,
});

/* ============================================================
   Boss 复杂键型库（用户需求：参考 1K 音游如太鼓达人的时间结构）
   ============================================================ */

/**
 * 由间隔数组生成连续 tap 节拍
 * @param {number[]} gaps - gaps[i] = 第 i 个 tap 与第 i+1 个 tap 的间隔(ms)
 * @returns {Array<{gap:number,type:string}>}
 */
function makeTapBeats(gaps) {
  const beats = [{ gap: 0, type: 'tap' }];
  for (const gap of gaps) beats.push({ gap, type: 'tap' });
  return beats;
}

/**
 * Boss 键型库：每条 = { name, beats }，beats[i] = { gap, type, dur? }
 * gap = 距上一节拍开始的时间(ms)；type = 'tap'|'hold'；hold 键 dur = 时长(ms)
 * 用户示例: 'xx xx xx' 三组二连弹；'xxxxxx xxxxxx' 两组六连；'xx x xx x xxxxxx|-----' 组合+长按
 * 注: hold 只允许出现在键型末尾（单键输入下，长按期间无法再点按）
 */
const BOSS_PATTERN_LIB = Object.freeze([
  { name: 'trill',      beats: makeTapBeats([110, 240, 110, 240, 110]) }, // xx xx xx
  { name: 'burst4',     beats: makeTapBeats([115, 115, 115]) },           // xxxx
  { name: 'stream6',    beats: makeTapBeats([110, 110, 110, 110, 110]) }, // xxxxxx
  { name: 'dblStream',  beats: makeTapBeats([110, 110, 110, 110, 110, 320, 110, 110, 110, 110, 110]) }, // xxxxxx xxxxxx
  { name: 'streamHold', beats: makeTapBeats([110, 110, 110, 110, 110]).concat([{ gap: 260, type: 'hold', dur: 700 }]) }, // xxxxxx|-----
  { name: 'mixed',      beats: makeTapBeats([110, 240, 110, 240, 240, 115, 115, 115, 115, 115, 115]).concat([{ gap: 260, type: 'hold', dur: 750 }]) }, // xx x xx x xxxxxx|-----
  { name: 'stair',      beats: makeTapBeats([180, 120, 240, 110, 200, 130]) }, // 变速楼梯
]);

import {
  calcFishStamina,
  calcPlayerStamina,
  calcBaseDamage,
  calcMarkerCount,
  calcMarkerSpeed,
  calcMarkerInterval,
} from './FormulaSheet.js';

/**
 * 占位装备属性（T-017 后替换，仅用于兜底）
 */
const PLACEHOLDER_EQUIP = {
  rod:   { strength: 50 },
  reel:  { gearRatio: 4.0, dragPower: 20 },
  line:  { tensile: 50 },
  hook:  { sharpness: 50 },
};

/* ============================================================
   Note 类
   ============================================================ */

class CatchNote {
  /**
   * @param {number} id
   * @param {number} expectedTime - 预计到达目标区的绝对游戏时间（ms）
   * @param {number} speed - 移动速度（px/s）
   * @param {string} [type='tap'] - 'tap' | 'hold'
   * @param {number} [duration=0] - hold 时长（ms）
   */
  constructor(id, expectedTime, speed, type = 'tap', duration = 0) {
    this.id = id;
    this.expectedTime = expectedTime;
    this.speed = speed;
    this.type = type;
    this.duration = duration;
    this.hit = false;
    this.grade = null;
    this.animTimer = 0;
    this.missed = false;
    this.holdActive = false;
    this.holdStart = 0;
    this.lastKeydownAt = 0; // 最近一次按住时间（卡顿鲁棒：防超时保护误触发）
  }

  /** @returns {number} 当前相对于目标区的偏移 px（负=已通过） */
  getOffset(currentTime) {
    return (this.expectedTime - currentTime) * this.speed / 1000;
  }

  /** @returns {number} 渲染用 X 坐标（相对于轨道左端） */
  getRenderX(currentTime, trackLeft) {
    const offset = this.getOffset(currentTime);
    return trackLeft + TRACK_WIDTH / 2 + offset;
  }

  /** @returns {boolean} 是否可见 */
  isVisible(currentTime) {
    const offset = this.getOffset(currentTime);
    return offset > -100 && offset < TRACK_WIDTH + 100;
  }

  /** @returns {number} |actual - expected| ms */
  getTimeOffset(currentTime) {
    return Math.abs(currentTime - this.expectedTime);
  }
}

/* ============================================================
   CatchSystem 类
   ============================================================ */

class CatchSystem {
  constructor() {
    /** @type {number} 游戏开始时的真实时间基准（performance.now） */
    this._gameStartReal = 0;

    /** @type {Array<Object>} note 视图对象池（复用，避免每帧 GC） */
    this._noteViews = [];

    /** @type {Array<Object>} 浮动文字视图对象池 */
    this._textViews = [];

    /** @type {Object|null} 状态视图单例（复用） */
    this._view = null;

    /** @type {CatchNote[]} 备用键池（预生成，_extendNotes 时取出复用，
     *  不 splice 主数组——避免破坏 _currentNoteIdx 索引导致判定卡死） */
    this._spareNotes = [];

    /** @type {string} 判定模式（默认轻松） */
    this._judgeMode = 'easy';

    /** @type {Object} 判定窗口（默认轻松模式；start 不会重置） */
    this._judgeWindows = JUDGE_WINDOWS.easy;

    this._reset();
  }

  /** 完全重置内部状态 */
  _reset() {
    /** @type {number} 游戏累积时间（ms） */
    this._elapsed = 0;

    /** @type {CatchNote[]} 判定标记列表 */
    this._notes = [];

    /** @type {number} 当前标记索引 */
    this._currentNoteIdx = 0;

    /** @type {{current:number, max:number}} 鱼耐力 */
    this._fishStamina = { current: 0, max: 0 };

    /** @type {{current:number, max:number}} 玩家耐力 */
    this._playerStamina = { current: 0, max: 0 };

    /** @type {number} 基础伤害 */
    this._baseDamage = 0;

    /** @type {boolean} 是否狂暴中 */
    this._isRaging = false;

    /** @type {number} 连击计数 */
    this._combo = 0;

    /** @type {number} 最大连击 */
    this._maxCombo = 0;

    /** @type {boolean} 是否已结束 */
    this._finished = false;

    /** @type {string|null} 最终结果 */
    this._result = null;

    /** @type {number} 标记间隔（ms） */
    this._noteInterval = 800;

    /** @type {number} 标记速度（px/s） */
    this._noteSpeed = 80;

    /** @type {Object|null} 当前鱼引用 */
    this._fish = null;

    /** @type {string|null} 最近一次判定等级 */
    this._lastGrade = null;

    /** @type {number} 最近一次判定时间 */
    this._lastHitTime = 0;

    /** @type {Object} 屏幕抖动 */
    this._shake = { x: 0, y: 0, remaining: 0 };

    /** @type {boolean} 屏幕闪白 */
    this._flashWhite = false;

    /** @type {number} 闪白计时 */
    this._flashTimer = 0;

    /** @type {Array} 浮动伤害数字 */
    this._floatingTexts = [];

    /** @type {Object|null} Boss 特性（需求2） */
    this._bossTrait = null;

    /** @type {Object|null} Boss 技能（需求2） */
    this._bossSkill = null;

    if (this._noteViews) this._noteViews.length = 0;
    if (this._textViews) this._textViews.length = 0;
    this._view = null;
    this._spareNotes.length = 0;
  }

  /**
   * 设置判定模式（设置页：轻松/困难，默认轻松）
   * 轻松模式: 判定窗口更宽 + 非 miss 不扣玩家血、perfect 回血（+4%）
   * @param {string} mode - 'easy' | 'hard'
   */
  setJudgeMode(mode) {
    if (JUDGE_WINDOWS[mode]) {
      this._judgeMode = mode;
      this._judgeWindows = JUDGE_WINDOWS[mode];
    }
  }

  /**
   * 当前判定模式
   * @returns {string}
   */
  getJudgeMode() {
    return this._judgeMode || 'easy';
  }

  /**
   * 当前判定窗口（供 UI/测试读取）
   * @returns {Object}
   */
  getJudgeWindows() {
    return { ...this._judgeWindows };
  }

  /**
   * 开始搏鱼小游戏
   * @param {Object} fish - 鱼数据 { fishId, fishName, rarity, fightPower, stamina?, trait?, skill? }
   * @param {Object} [equip] - 装备属性，不传则用占位
   */
  start(fish, equip) {
    this._reset();
    this._fish = fish;
    const eq = equip || PLACEHOLDER_EQUIP;
    const fp = fish.fightPower || 1;
    const ra = fish.rarity || 1;

    // 真实时间基准（用于输入时刻精确判定，参考 osu：判定不依赖帧率）
    this._gameStartReal = (typeof performance !== 'undefined') ? performance.now() : 0;

    // 耐力（优先使用实例携带的 stamina——含地图/Boss 加成；否则按公式）
    this._fishStamina.max = (typeof fish.stamina === 'number' && fish.stamina > 0)
      ? fish.stamina
      : calcFishStamina(fp, ra);
    this._fishStamina.current = this._fishStamina.max;

    // Boss 特性/技能（需求2）
    this._bossTrait = fish.trait || null;
    this._bossSkill = fish.skill || null;

    // 玩家耐力（Boss 特性可能降低上限）
    let pMax = calcPlayerStamina(eq.rod.strength, eq.reel.dragPower, eq.line.tensile);
    if (this._bossTrait && this._bossTrait.playerStaminaMult) {
      pMax = Math.floor(pMax * this._bossTrait.playerStaminaMult);
    }
    this._playerStamina.max = pMax;
    this._playerStamina.current = pMax;

    // 基础伤害（FormulaSheet calcBaseDamage）
    this._baseDamage = calcBaseDamage(eq.rod.strength, eq.hook.sharpness, eq.reel.gearRatio, eq.line.tensile);

    // 标记参数（FormulaSheet calcMarkerCount/Speed/Interval；Boss 键型更密集）
    // 键表一次性覆盖整场战斗：按"所需命中次数"估算（75% 平均伤害效率 ×1.3 余量），
    // 避免战斗中途补充键在屏幕中间"突然冒出"（用户反馈 bug 5）
    const hitsNeeded = Math.ceil(this._fishStamina.max / Math.max(1, this._baseDamage * 0.75));
    const noteCount = Math.max(calcMarkerCount(fp, ra), Math.ceil(hitsNeeded * 1.3));
    this._noteInterval = calcMarkerInterval(fp, eq.reel.gearRatio);
    if (fish.noteDensityMult) {
      this._noteInterval = this._noteInterval * fish.noteDensityMult;
    }
    this._noteSpeed = calcMarkerSpeed(fp, ra, eq.reel.gearRatio);

    // 生成标记（含复杂键型；Boss 使用专用复杂键型库）
    this._notes = this._buildNotes(fp, ra, noteCount, !!fish.isBoss);

    // 预生成备用键池（_extendNotes 取用，避免运行期 new / splice 主数组）
    const spareCount = 40;
    for (let i = 0; i < spareCount; i++) {
      this._spareNotes.push(new CatchNote(-1, 0, this._noteSpeed));
    }

    this._currentNoteIdx = 0;
    this._elapsed = 0;
    this._finished = false;
    this._result = null;
    this._isRaging = false;
    this._combo = 0;
    this._maxCombo = 0;
    this._lastGrade = null;
    this._shake = { x: 0, y: 0, remaining: 0 };

    if (DEBUG) {
      const holdCount = this._notes.filter(n => n.type === 'hold').length;
      console.log('[Catch] 开始, fish=' + fish.fishName +
        ', fishHP=' + this._fishStamina.max +
        ', playerHP=' + this._playerStamina.max +
        ', notes=' + this._notes.length + '(hold=' + holdCount + ')' +
        ', dmg=' + this._baseDamage.toFixed(1) +
        ', speed=' + this._noteSpeed.toFixed(0) + 'px/s');
    }
  }

  /**
   * 生成标记序列（tap 为主，按复杂度插入 hold/double/triplet/accel）
   * @param {number} fp - 挣扎强度
   * @param {number} ra - 稀有度
   * @param {number} noteCount - 最少标记数
   * @param {boolean} [isBoss=false] - Boss 战使用复杂键型库
   * @returns {CatchNote[]}
   * @private
   */
  _buildNotes(fp, ra, noteCount, isBoss) {
    if (isBoss) return this._buildBossNotes(fp, ra, noteCount);
    const complexity = Math.min(1, (fp + ra) / 20);
    const notes = [];
    let t = PREP_TIME;
    let accelLeft = 0;

    for (let i = 0; i < noteCount; i++) {
      const accel = accelLeft > 0;
      if (accelLeft > 0) accelLeft--;

      let type = 'tap';
      if (!accel && complexity >= 0.35) {
        const roll = Math.random();
        if (roll < 0.08 + complexity * 0.05) {
          type = 'hold';
        } else if (roll < 0.20) {
          type = 'double';
        } else if (roll < 0.26) {
          type = 'triplet';
        } else if (roll < 0.34 && complexity >= 0.55) {
          type = 'accel';
          accelLeft = 4;
        }
      }

      const step = accel ? this._noteInterval * 0.6 : this._noteInterval;

      if (type === 'double') {
        notes.push(new CatchNote(notes.length, t, this._noteSpeed, 'tap'));
        notes.push(new CatchNote(notes.length, t + DOUBLE_GAP_MS, this._noteSpeed, 'tap'));
        t += DOUBLE_GAP_MS + step;
      } else if (type === 'triplet') {
        for (let k = 0; k < 3; k++) {
          notes.push(new CatchNote(notes.length, t + k * TRIPLET_GAP_MS, this._noteSpeed, 'tap'));
        }
        t += TRIPLET_GAP_MS * 2 + step;
      } else if (type === 'hold') {
        const dur = HOLD_MIN_MS + fp * HOLD_PER_FP_MS;
        notes.push(new CatchNote(notes.length, t, this._noteSpeed, 'hold', dur));
        t += dur + step * 0.7;
      } else {
        notes.push(new CatchNote(notes.length, t, this._noteSpeed, 'tap'));
        t += step;
      }
    }

    return notes;
  }

  /**
   * 生成 Boss 键表：轮换复杂键型（1K 音游式），直到覆盖所需标记数
   * 键型之间留呼吸间隔（间隔 ×1.2），避免连成一片
   * @param {number} fp - 挣扎强度
   * @param {number} ra - 稀有度
   * @param {number} noteCount - 最少标记数
   * @returns {CatchNote[]}
   * @private
   */
  _buildBossNotes(fp, ra, noteCount) {
    const notes = [];
    const lib = BOSS_PATTERN_LIB;
    let t = PREP_TIME;
    let lastIndex = -1;
    while (notes.length < noteCount) {
      // 随机选键型，且不与上一个重复（保证多样性）
      let idx = Math.floor(Math.random() * lib.length);
      if (idx === lastIndex && lib.length > 1) {
        idx = (idx + 1 + Math.floor(Math.random() * (lib.length - 1))) % lib.length;
      }
      lastIndex = idx;
      const pattern = lib[idx];
      for (const beat of pattern.beats) {
        const dur = (beat.type === 'hold')
          ? (beat.dur || HOLD_MIN_MS + fp * HOLD_PER_FP_MS)
          : 0;
        notes.push(new CatchNote(notes.length, t + beat.gap, this._noteSpeed, beat.type, dur));
      }
      const lastBeat = pattern.beats[pattern.beats.length - 1];
      const patternEnd = t + lastBeat.gap + (lastBeat.type === 'hold' ? lastBeat.dur : 0);
      t = patternEnd + this._noteInterval * 1.2;
    }
    return notes;
  }

  /**
   * 每帧更新
   * @param {number} dt - ms
   */
  update(dt) {
    if (this._finished) return;

    this._elapsed += dt;

    // 更新抖动
    if (this._shake.remaining > 0) {
      this._shake.remaining -= dt;
      if (this._shake.remaining <= 0) {
        this._shake.x = 0;
        this._shake.y = 0;
        this._shake.remaining = 0;
      }
    }

    // 更新闪白
    if (this._flashWhite) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) {
        this._flashWhite = false;
        this._flashTimer = 0;
      }
    }

    // 更新标记动画计时器
    for (const note of this._notes) {
      if (note.hit && note.animTimer > 0) {
        note.animTimer -= dt;
        if (note.animTimer <= 0) note.animTimer = 0;
      }
    }

    // 更新浮动文字
    for (let i = this._floatingTexts.length - 1; i >= 0; i--) {
      const ft = this._floatingTexts[i];
      ft.timer -= dt;
      ft.y -= dt * 0.03;
      if (ft.timer <= 0) this._floatingTexts.splice(i, 1);
    }

    // hold 超时保护：keyup 丢失时按尾判完成结算
    // 卡顿鲁棒：仅当"尾部已过 150ms 且 300ms 内无按键活动"才触发
    for (const note of this._notes) {
      if (!note.holdActive) continue;
      const tailPassed = this._elapsed > note.holdStart + note.duration + HOLD_WINDOW_MS;
      const noRecentKey = this._elapsed > (note.lastKeydownAt || 0) + HOLD_WINDOW_MS * 2;
      if (tailPassed && noRecentKey) {
        this._applyHoldTail(note, 'perfect');
      }
    }

    // 自动 Miss：检查当前标记是否已通过
    this._checkAutoMiss();
    this._extendNotes();

    // 狂暴检测（spec 2.3.6）
    const ratio = this._fishStamina.current / this._fishStamina.max;
    if (!this._isRaging && ratio < RAGE_THRESHOLD) {
      this._isRaging = true;
      for (let i = this._currentNoteIdx; i < this._notes.length; i++) {
        const note = this._notes[i];
        if (!note.hit && !note.missed) {
          note.speed *= 1.2;
        }
      }
      if (DEBUG) console.log('[Catch] 狂暴触发！速度x1.2, 间隔x0.75');
    }
  }

  /**
   * 自动检测错过的标记
   */
  _checkAutoMiss() {
    while (this._currentNoteIdx < this._notes.length) {
      const note = this._notes[this._currentNoteIdx];
      if (note.hit || note.missed) {
        this._currentNoteIdx++;
        continue;
      }
      if (note.holdActive) {
        break; // 长按进行中，不自动 miss
      }
      if (this._elapsed > note.expectedTime + 150) {
        this._applyMiss(note);
        this._currentNoteIdx++;
      } else {
        break;
      }
    }
  }

  /**
   * 耐力未归零时持续补充标记（从备用键池取键，只 push 不 splice）
   */
  _extendNotes() {
    if (this._finished) return;
    const lastIdx = this._notes.length - 1;
    if (lastIdx < 0 || this._currentNoteIdx >= lastIdx - 2) {
      const baseIdx = this._notes.length;
      // 新键必须从轨道起点进入（timeLeft ≥ 视觉旅行时间+缓冲），
      // 否则补充键会在屏幕中间"突然冒出"（用户反馈 bug 5）
      const minNext = this._elapsed + NOTE_TRAVEL_VISUAL_MS + 50;
      const nextTime = lastIdx >= 0
        ? Math.max(minNext, this._notes[lastIdx].expectedTime + this._noteInterval)
        : minNext;
      // 狂暴阶段补充键更密集（spec 2.3.6: 狂暴间隔缩短 25%）
      const step = this._isRaging ? this._noteInterval * 0.75 : this._noteInterval;
      const count = 5;
      for (let i = 0; i < count; i++) {
        const note = this._spareNotes.pop() || new CatchNote(-1, 0, this._noteSpeed);
        note.id = baseIdx + i;
        note.expectedTime = nextTime + i * step;
        note.speed = this._noteSpeed;
        note.type = 'tap';
        note.duration = 0;
        note.hit = false;
        note.missed = false;
        note.grade = null;
        note.animTimer = 0;
        note.holdActive = false;
        note.holdStart = 0;
        note.lastKeydownAt = 0;
        this._notes.push(note);
      }
      if (DEBUG) console.log('[Catch] 补充 ' + count + ' 个标记');
    }
  }

  /**
   * 解析判定时刻（osu 式：输入优先用事件时间戳，不依赖帧率）
   * @param {number|undefined} eventStamp - 输入事件时间戳（performance.now 同源）
   * @returns {number} 判定用游戏时间（ms）
   * @private
   */
  _resolveJudgeTime(eventStamp) {
    if (typeof eventStamp === 'number' && this._gameStartReal > 0) {
      return eventStamp - this._gameStartReal;
    }
    return this._elapsed;
  }

  /**
   * 处理玩家按下（keydown）
   * - tap/double/triplet：命中判定（用输入事件时刻，帧率无关）
   * - hold：头判（头部到达目标区时的按下精度，计入 combo 物量）
   * @param {number} [eventStamp] - 输入事件时间戳（可选）
   * @returns {{ grade: string, combo: number, damage: number, holdActive?: boolean }}
   */
  handleInput(eventStamp) {
    if (this._finished) return { grade: 'miss', combo: this._combo, damage: 0 };
    const judgeTime = this._resolveJudgeTime(eventStamp);

    while (this._currentNoteIdx < this._notes.length) {
      const note = this._notes[this._currentNoteIdx];
      if (note.hit || note.missed) {
        this._currentNoteIdx++;
        continue;
      }

      // hold 长按进行中：忽略重复 keydown（等待 keyup 尾判）
      if (note.type === 'hold' && note.holdActive) {
        note.lastKeydownAt = judgeTime;
        return { grade: 'hold', combo: this._combo, damage: 0, holdActive: true };
      }

      // hold 键：头判
      if (note.type === 'hold' && !note.holdActive) {
        if (judgeTime < note.expectedTime - HOLD_WINDOW_MS) {
          return { grade: 'miss', combo: this._combo, damage: 0 };
        }
        if (judgeTime <= note.expectedTime + HOLD_WINDOW_MS) {
          const offset = note.getTimeOffset(judgeTime);
          const grade = this._judgeNote(note, offset);
          if (grade === 'miss') {
            this._applyMiss(note);
            this._currentNoteIdx++;
            return { grade: 'miss', combo: this._combo, damage: 0 };
          }
          this._applyHoldHead(note, grade, judgeTime);
          return { grade, combo: this._combo, damage: this._lastDamage || 0, holdActive: true };
        }
        this._applyMiss(note);
        this._currentNoteIdx++;
        continue;
      }

      const offset = note.getTimeOffset(judgeTime);
      if (judgeTime < note.expectedTime - 150) {
        return { grade: 'miss', combo: this._combo, damage: 0 };
      }
      if (offset <= 150) {
        const grade = this._judgeNote(note, offset);
        this._applyHit(note, grade, undefined, judgeTime);
        return { grade, combo: this._combo, damage: this._lastDamage || 0 };
      }
      this._applyMiss(note);
      this._currentNoteIdx++;
    }

    this._extendNotes();
    return { grade: 'miss', combo: this._combo, damage: 0 };
  }

  /**
   * 处理玩家松开（keyup）——hold 尾判（不改变 combo 物量）
   * @param {number} [eventStamp] - 输入事件时间戳（可选）
   * @returns {{ grade: string, combo: number, damage: number, hold?: boolean }}
   */
  handleHoldRelease(eventStamp) {
    if (this._finished) return { grade: 'miss', combo: this._combo, damage: 0 };
    const judgeTime = this._resolveJudgeTime(eventStamp);

    for (const note of this._notes) {
      if (!note.holdActive) continue;
      const tailOffset = judgeTime - (note.holdStart + note.duration);
      if (Math.abs(tailOffset) <= HOLD_WINDOW_MS) {
        this._applyHoldTail(note, 'perfect', judgeTime);
        return { grade: 'perfect', combo: this._combo, damage: this._lastDamage || 0, hold: true };
      }
      if (tailOffset < -HOLD_WINDOW_MS * 2) {
        this._applyHoldTail(note, 'miss', judgeTime);
        return { grade: 'miss', combo: this._combo, damage: 0, hold: true };
      }
      this._applyHoldTail(note, 'good', judgeTime);
      return { grade: 'good', combo: this._combo, damage: this._lastDamage || 0, hold: true };
    }
    return { grade: 'miss', combo: this._combo, damage: 0 };
  }

  /**
   * hold 长按保活：长按重复 keydown（e.repeat）时调用
   */
  handleHoldKeepAlive() {
    for (const note of this._notes) {
      if (note.holdActive) note.lastKeydownAt = this._elapsed;
    }
  }

  /**
   * hold 头判：命中后进入长按状态，伤害/连击与普通 tap 一致（物量 +1）
   * @param {CatchNote} note
   * @param {string} grade - 头判精度
   * @param {number} [judgeTime] - 判定时刻
   * @private
   */
  _applyHoldHead(note, grade, judgeTime) {
    const t = (typeof judgeTime === 'number') ? judgeTime : this._elapsed;
    note.holdActive = true;
    note.holdStart = t;
    this._lastGrade = grade;
    this._lastHitTime = t;

    if (grade === 'perfect') {
      this._combo++;
      if (this._combo > this._maxCombo) this._maxCombo = this._combo;
    } else {
      this._combo = 0;
    }

    // 伤害（同 tap：精度系数 + 连击暴击）
    const p = this._getProbCoeff(grade);
    let dmg = this._baseDamage * p;
    if (grade === 'perfect' && this._combo >= 5) {
      dmg *= 2.0;
      this._flashWhite = true;
      this._flashTimer = 200;
    } else if (grade === 'perfect' && this._combo >= 3) {
      dmg *= 1.5;
      this._flashWhite = true;
      this._flashTimer = 150;
    }

    // 玩家耐力损失（Boss 特性可能提高）
    const playerDrain = this._getPlayerDrain(grade, this._playerStamina.max);
    this._applyPlayerDrain(playerDrain);

    // Boss 技能免疫（需求2）
    if (this._skillBlocksGrade(grade)) dmg = 0;
    // 鱼耐力减少
    this._fishStamina.current = Math.max(0, this._fishStamina.current - dmg);

    this._setShake(grade);
    this._lastDamage = dmg;

    this._floatingTexts.push({
      text: '-' + Math.floor(dmg) + ' HOLD!',
      color: grade === 'perfect' ? '#40d080' : '#e0c060',
      timer: 800,
      y: 0,
    });

    this._checkWinLose();
  }

  /**
   * hold 尾判：松开精度判定，只加伤害不改 combo（物量已在头判计入）
   * @param {CatchNote} note
   * @param {string} grade - 尾判精度（perfect/good/miss）
   * @param {number} [judgeTime] - 判定时刻
   * @private
   */
  _applyHoldTail(note, grade, judgeTime) {
    const t = (typeof judgeTime === 'number') ? judgeTime : this._elapsed;
    note.hit = true;
    note.grade = grade;
    note.animTimer = HIT_ANIM_DURATION;
    note.holdActive = false;
    this._lastGrade = grade;
    this._lastHitTime = t;

    let dmg = this._baseDamage * (TAIL_DMG_MULT[grade] || 0);
    if (grade === 'miss') {
      this._combo = 0;
      const drain = this._getPlayerDrain('miss', this._playerStamina.max);
      this._applyPlayerDrain(drain);
    }
    // Boss 技能免疫（需求2）
    if (this._skillBlocksGrade(grade)) dmg = 0;
    // 鱼耐力减少
    this._fishStamina.current = Math.max(0, this._fishStamina.current - dmg);

    this._setShake(grade);
    this._lastDamage = dmg;

    this._floatingTexts.push({
      text: grade === 'miss' ? 'HOLD Miss' : '-' + Math.floor(dmg) + ' HOLD!',
      color: grade === 'perfect' ? '#40d080' : grade === 'good' ? '#e0c060' : '#e06050',
      timer: 700,
      y: 0,
    });

    this._checkWinLose();
  }

  /**
   * 判定单个标记等级（窗口随设置：轻松/困难）
   * @param {CatchNote} note
   * @param {number} offset - ms 偏差
   * @returns {string}
   */
  _judgeNote(note, offset) {
    const w = this._judgeWindows;
    if (offset <= w.perfect) return 'perfect';
    if (offset <= w.great) return 'great';
    if (offset <= w.good) return 'good';
    return 'miss';
  }

  /**
   * 应用命中效果
   * @param {CatchNote} note
   * @param {string} grade
   * @param {number} [dmgOverride] - 自定义伤害（hold 使用）；缺省按 grade 系数
   * @param {number} [judgeTime] - 判定时刻
   */
  _applyHit(note, grade, dmgOverride, judgeTime) {
    const t = (typeof judgeTime === 'number') ? judgeTime : this._elapsed;
    note.hit = true;
    note.grade = grade;
    note.animTimer = HIT_ANIM_DURATION;

    this._lastGrade = grade;
    this._lastHitTime = t;

    if (grade === 'perfect') {
      this._combo++;
      if (this._combo > this._maxCombo) this._maxCombo = this._combo;
    } else {
      this._combo = 0;
    }

    // 伤害计算（spec 2.3.4）
    const p = this._getProbCoeff(grade);
    let dmg = (typeof dmgOverride === 'number') ? dmgOverride : this._baseDamage * p;

    // 连击奖励（spec 2.3.6；hold 自带倍率不叠加）
    if (typeof dmgOverride !== 'number') {
      if (grade === 'perfect' && this._combo >= 5) {
        dmg *= 2.0;
        this._flashWhite = true;
        this._flashTimer = 200;
      } else if (grade === 'perfect' && this._combo >= 3) {
        dmg *= 1.5;
        this._flashWhite = true;
        this._flashTimer = 150;
      }
    }

    // 玩家耐力损失（Boss 特性可能提高）
    const playerDrain = this._getPlayerDrain(grade, this._playerStamina.max);
    this._applyPlayerDrain(playerDrain);

    // Boss 技能免疫（需求2）：技能激活期间对应等级伤害无效
    if (this._skillBlocksGrade(grade)) dmg = 0;
    // 鱼耐力减少
    this._fishStamina.current = Math.max(0, this._fishStamina.current - dmg);

    // 屏幕抖动（spec 2.3.7）
    this._setShake(grade);

    this._lastDamage = dmg;

    if (DEBUG) {
      console.log('[Catch] hit #' + note.id + ' ' + grade +
        (note.type === 'hold' ? '(HOLD)' : '') +
        ' dmg=' + dmg.toFixed(1) +
        ' fishHP=' + this._fishStamina.current.toFixed(0) +
        ' playerHP=' + this._playerStamina.current.toFixed(0) +
        ' combo=' + this._combo);
    }

    // 浮动伤害数字
    const isCrit = grade === 'perfect' && this._combo >= 3;
    const isHold = typeof dmgOverride === 'number';
    this._floatingTexts.push({
      text: isHold ? '-' + Math.floor(dmg) + ' HOLD!' : (isCrit ? '-' + Math.floor(dmg) + ' CRIT!' : '-' + Math.floor(dmg)),
      color: grade === 'perfect' ? '#40d080' : grade === 'great' ? '#60b0e0' : '#e0c060',
      timer: 800,
      y: 0,
    });

    // 胜负判定
    this._checkWinLose();
  }

  /**
   * 应用 Miss
   * @param {CatchNote} note
   */
  _applyMiss(note) {
    note.missed = true;
    note.grade = 'miss';
    this._combo = 0;
    this._lastGrade = 'miss';

    const drain = this._getPlayerDrain('miss', this._playerStamina.max);
    this._applyPlayerDrain(drain);
    this._lastDamage = 0;

    this._setShake('miss');

    this._floatingTexts.push({
      text: 'Miss',
      color: '#e06050',
      timer: 600,
      y: 0,
    });

    if (DEBUG) {
      console.log('[Catch] miss #' + note.id +
        ' playerHP=' + this._playerStamina.current.toFixed(0));
    }

    this._checkWinLose();
  }

  /**
   * 概率系数 p（spec 2.3.4）
   * @param {string} grade
   * @returns {number}
   */
  _getProbCoeff(grade) {
    switch (grade) {
      case 'perfect': return 1.0;
      case 'great': return 0.75;
      case 'good': return 0.50;
      default: return 0.0;
    }
  }

  /**
   * Boss 技能是否激活（需求2）：周期 = 激活 + 冷却
   * @returns {boolean}
   */
  _isSkillActive() {
    if (!this._bossSkill) return false;
    const period = this._bossSkill.duration + this._bossSkill.cooldown;
    return (this._elapsed % period) < this._bossSkill.duration;
  }

  /**
   * 当前技能是否免疫该判定等级（需求2）
   * @param {string} grade
   * @returns {boolean}
   */
  _skillBlocksGrade(grade) {
    if (!this._bossSkill || !this._isSkillActive()) return false;
    switch (this._bossSkill.type) {
      case 'immuneGood': return grade === 'good';
      case 'immuneGreat': return grade === 'great';
      case 'immunePerfectOnly': return grade !== 'perfect';
      default: return false;
    }
  }

  /**
   * 玩家耐力消耗（轻松模式：非 miss 不扣血、perfect 回血 +4%；Boss 特性放大受到的伤害）
   * @param {string} grade
   * @param {number} maxStamina
   * @returns {number} 正=扣血，负=回血
   */
  _getPlayerDrain(grade, maxStamina) {
    let drain;
    if (this._judgeMode === 'easy') {
      // 轻松模式：miss 扣血，great/good 不扣，perfect 回血 4%
      switch (grade) {
        case 'perfect': drain = -maxStamina * 0.04; break;
        case 'great':
        case 'good': drain = 0; break;
        case 'miss': drain = maxStamina * 0.12; break;
        default: drain = 0; break;
      }
    } else {
      switch (grade) {
        case 'perfect': drain = 0; break;
        case 'great': drain = maxStamina * 0.02; break;
        case 'good': drain = maxStamina * 0.05; break;
        case 'miss': drain = maxStamina * 0.12; break;
        default: drain = 0; break;
      }
    }
    // Boss 特性只放大"受到的伤害"（正数），回血不受影响
    if (drain > 0 && this._bossTrait && this._bossTrait.playerDamageMult) {
      drain *= this._bossTrait.playerDamageMult;
    }
    return drain;
  }

  /**
   * 应用玩家耐力变化（扣血/回血，钳制到 [0, max]）
   * @param {number} drain - 正=扣血，负=回血
   * @private
   */
  _applyPlayerDrain(drain) {
    this._playerStamina.current = Math.min(this._playerStamina.max,
      Math.max(0, this._playerStamina.current - drain));
  }

  /**
   * 设置屏幕抖动（spec 2.3.7）
   * @param {string} grade
   */
  _setShake(grade) {
    let intensity = 0;
    switch (grade) {
      case 'perfect': intensity = 2; break;
      case 'great':   intensity = 3; break;
      case 'good':    intensity = 5; break;
      case 'miss':    intensity = 8; break;
    }
    this._shake.x = (Math.random() - 0.5) * intensity * 2;
    this._shake.y = (Math.random() - 0.5) * intensity * 2;
    this._shake.remaining = 100;
  }

  /** 胜负判定 */
  _checkWinLose() {
    if (this._fishStamina.current <= 0) {
      this._finished = true;
      this._result = 'win';
      if (DEBUG) console.log('[Catch] 成功钓获！');
      return;
    }
    if (this._playerStamina.current <= 0) {
      this._finished = true;
      this._result = 'lose';
      if (DEBUG) console.log('[Catch] 鱼逃脱！');
    }
  }

  /* ============================================================
     公开访问器
     ============================================================ */

  /**
   * 更新 note 视图池（复用对象，避免每帧 GC 分配）
   * @returns {Array<Object>}
   * @private
   */
  _updateNoteViews() {
    const notes = this._notes;
    const views = this._noteViews;
    while (views.length < notes.length) views.push({});
    if (views.length > notes.length) views.length = notes.length;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const v = views[i];
      v.id = n.id;
      v.expectedTime = n.expectedTime;
      v.speed = n.speed;
      v.type = n.type;
      v.duration = n.duration;
      v.holdActive = n.holdActive;
      v.holdStart = n.holdStart;
      v.hit = n.hit;
      v.missed = n.missed;
      v.grade = n.grade;
      v.animTimer = n.animTimer;
      v.offset = n.getOffset(this._elapsed);
      v.visible = n.isVisible(this._elapsed);
      v.renderX = n.getRenderX(this._elapsed, 0);
    }
    return views;
  }

  /**
   * 更新浮动文字视图池（复用对象）
   * @returns {Array<Object>}
   * @private
   */
  _updateTextViews() {
    const src = this._floatingTexts;
    const views = this._textViews;
    while (views.length < src.length) views.push({});
    if (views.length > src.length) views.length = src.length;
    for (let i = 0; i < src.length; i++) {
      const ft = src[i];
      const v = views[i];
      v.text = ft.text;
      v.color = ft.color;
      v.timer = ft.timer;
      v.y = ft.y;
    }
    return views;
  }

  /** @returns {Object} 完整游戏状态（单例复用，每帧零分配） */
  getState() {
    const v = this._view || (this._view = {});

    v.fish = this._fish;
    const fs = v.fishStamina || (v.fishStamina = {});
    fs.current = this._fishStamina.current;
    fs.max = this._fishStamina.max;
    fs.percent = fs.max > 0 ? fs.current / fs.max : 0;

    const ps = v.playerStamina || (v.playerStamina = {});
    ps.current = this._playerStamina.current;
    ps.max = this._playerStamina.max;
    ps.percent = ps.max > 0 ? ps.current / ps.max : 0;

    v.notes = this._updateNoteViews();
    v.currentNoteIdx = this._currentNoteIdx;
    v.combo = this._combo;
    v.maxCombo = this._maxCombo;
    v.isRaging = this._isRaging;
    v.isFinished = this._finished;
    v.result = this._result;
    v.elapsed = this._elapsed;
    v.lastGrade = this._lastGrade;

    const sh = v.shake || (v.shake = {});
    sh.x = this._shake.x;
    sh.y = this._shake.y;
    sh.remaining = this._shake.remaining;
    v.flashWhite = this._flashWhite;
    v.floatingTexts = this._updateTextViews();

    // Boss 技能状态（需求2，供 UI 显示）
    if (this._bossSkill) {
      const bs = v.bossSkill || (v.bossSkill = {});
      bs.active = this._isSkillActive();
      bs.name = this._bossSkill.name;
    } else if (v.bossSkill) {
      v.bossSkill = null;
    }
    return v;
  }

  /** @returns {boolean} */
  isFinished() { return this._finished; }

  /** @returns {string|null} */
  getResult() { return this._result; }

  /** @returns {Object|null} */
  getFish() { return this._fish; }

  /** @returns {number} */
  getNoteSpeed() { return this._noteSpeed; }

  /** @returns {number} */
  getNoteInterval() { return this._noteInterval; }

  /** @returns {number} */
  getBaseDamage() { return this._baseDamage; }
}

export {
  CatchSystem,
  CatchNote,
  TRACK_WIDTH,
  NOTE_TRAVEL_TIME,
  NOTE_TRAVEL_VISUAL_MS,
  HOLD_MIN_MS,
  HOLD_WINDOW_MS,
  TAIL_DMG_MULT,
  BOSS_PATTERN_LIB,
};
