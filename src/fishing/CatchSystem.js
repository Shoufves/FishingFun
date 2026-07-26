'use strict';

/**
 * ============================================================
 * src/fishing/CatchSystem.js — 收线搏鱼逻辑系统
 * 版本: 1.0
 * 职责: 双耐力管理、判定标记生成与移动、伤害计算、狂暴与连击
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

/** @type {number} 准备时间（ms），第一个标记开始移动前 */
const PREP_TIME = 1500;

/** @type {number} 判定后动画持续时间（ms） */
const HIT_ANIM_DURATION = 150;

/** @type {number} 狂暴触发阈值 */
const RAGE_THRESHOLD = 0.25;

/** @type {boolean} 调试模式 */
const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

import {
  calcFishStamina, calcPlayerStamina, calcBaseDamage,
  calcMarkerCount, calcMarkerSpeed, calcMarkerInterval,
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
   */
  constructor(id, expectedTime, speed) {
    this.id = id;
    this.expectedTime = expectedTime;
    this.speed = speed;
    this.hit = false;
    this.grade = null;
    this.animTimer = 0;
    this.missed = false;
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
  }

  /**
   * 开始搏鱼小游戏
   * @param {Object} fish - 鱼数据 { fishId, fishName, rarity, fightPower, ... }
   * @param {Object} [equip] - 装备属性，不传则用占位
   */
  start(fish, equip) {
    this._reset();
    this._fish = fish;
    const eq = equip || PLACEHOLDER_EQUIP;
    const fp = fish.fightPower || 1;
    const ra = fish.rarity || 1;

    // 耐力（FormulaSheet calcFishStamina / calcPlayerStamina）
    this._fishStamina.max = calcFishStamina(fp, ra);
    this._fishStamina.current = this._fishStamina.max;
    this._playerStamina.max = calcPlayerStamina(eq.rod.strength, eq.reel.dragPower, eq.line.tensile);
    this._playerStamina.current = this._playerStamina.max;

    // 基础伤害（FormulaSheet calcBaseDamage）
    this._baseDamage = calcBaseDamage(eq.rod.strength, eq.hook.sharpness, eq.reel.gearRatio, eq.line.tensile);

    // 标记参数（FormulaSheet calcMarkerCount/Speed/Interval）
    const noteCount = calcMarkerCount(fp, ra);
    this._noteInterval = calcMarkerInterval(fp, eq.reel.gearRatio);
    this._noteSpeed = calcMarkerSpeed(fp, ra, eq.reel.gearRatio);

    // 生成标记
    for (let i = 0; i < noteCount; i++) {
      const et = PREP_TIME + i * this._noteInterval;
      this._notes.push(new CatchNote(i, et, this._noteSpeed));
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
      console.log('[Catch] 开始, fish=' + fish.fishName +
        ', fishHP=' + this._fishStamina.max +
        ', playerHP=' + this._playerStamina.max +
        ', notes=' + noteCount +
        ', dmg=' + this._baseDamage.toFixed(1) +
        ', speed=' + this._noteSpeed.toFixed(0) + 'px/s');
    }
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

    // 自动 Miss：检查当前标记是否已通过
    this._checkAutoMiss();
    this._extendNotes();

    // 狂暴检测（spec 2.3.6）
    const ratio = this._fishStamina.current / this._fishStamina.max;
    if (!this._isRaging && ratio < RAGE_THRESHOLD) {
      this._isRaging = true;
      // 后续所有未处理的标记速度 +20%（不改变 expectedTime，避免了瞬移bug）
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
      if (this._elapsed > note.expectedTime + 150) {
        this._applyMiss(note);
        this._currentNoteIdx++;
      } else {
        break;
      }
    }
  }

  /**
   * 耐力未归零时持续补充标记
   */
  _extendNotes() {
    if (this._finished) return;
    const lastIdx = this._notes.length - 1;
    if (lastIdx < 0 || this._currentNoteIdx >= lastIdx - 2) {
      const baseIdx = this._notes.length;
      const nextTime = lastIdx >= 0
        ? Math.max(this._elapsed + 500, this._notes[lastIdx].expectedTime + this._noteInterval)
        : this._elapsed + 1000;
      const count = 5;
      for (let i = 0; i < count; i++) {
        this._notes.push(new CatchNote(baseIdx + i, nextTime + i * this._noteInterval, this._noteSpeed));
      }
      if (DEBUG) console.log('[Catch] 补充 ' + count + ' 个标记');
    }
  }

  /**
   * 处理玩家输入
   * @returns {{ grade: string, combo: number, damage: number }}
   */
  handleInput() {
    if (this._finished) return { grade: 'miss', combo: this._combo, damage: 0 };

    // 找到当前未处理的标记
    while (this._currentNoteIdx < this._notes.length) {
      const note = this._notes[this._currentNoteIdx];
      if (note.hit || note.missed) {
        this._currentNoteIdx++;
        continue;
      }

      const offset = note.getTimeOffset(this._elapsed);

      // 标记还远未到 → 太早，Miss
      if (this._elapsed < note.expectedTime - 150) {
        return { grade: 'miss', combo: this._combo, damage: 0 };
      }

      // 在判定窗口内
      if (offset <= 150) {
        const grade = this._judgeNote(note, offset);
        this._applyHit(note, grade);
        return { grade, combo: this._combo, damage: this._lastDamage || 0 };
      }

      // 标记已过 → Miss 并移动到下一个
      this._applyMiss(note);
      this._currentNoteIdx++;
    }

    this._extendNotes();
    return { grade: 'miss', combo: this._combo, damage: 0 };
  }

  /**
   * 判定单个标记等级
   * @param {CatchNote} note
   * @param {number} offset - ms 偏差
   * @returns {string}
   */
  _judgeNote(note, offset) {
    if (offset <= 25) return 'perfect';
    if (offset <= 60) return 'great';
    if (offset <= 100) return 'good';
    return 'miss';
  }

  /**
   * 应用命中效果
   * @param {CatchNote} note
   * @param {string} grade
   */
  _applyHit(note, grade) {
    note.hit = true;
    note.grade = grade;
    note.animTimer = HIT_ANIM_DURATION;

    this._lastGrade = grade;
    this._lastHitTime = this._elapsed;

    if (grade === 'perfect') {
      this._combo++;
      if (this._combo > this._maxCombo) this._maxCombo = this._combo;
    } else {
      this._combo = 0;
    }

    // 伤害计算（spec 2.3.4）
    const p = this._getProbCoeff(grade);
    let dmg = this._baseDamage * p;

    // 连击奖励（spec 2.3.6）
    if (grade === 'perfect' && this._combo >= 5) {
      dmg *= 2.0;
      this._flashWhite = true;
      this._flashTimer = 200;
    } else if (grade === 'perfect' && this._combo >= 3) {
      dmg *= 1.5;
      this._flashWhite = true;
      this._flashTimer = 150;
    }

    // 玩家耐力损失（spec 2.3.4）
    const playerDrain = this._getPlayerDrain(grade, this._playerStamina.max);
    this._playerStamina.current = Math.max(0, this._playerStamina.current - playerDrain);

    // 鱼耐力减少
    this._fishStamina.current = Math.max(0, this._fishStamina.current - dmg);

    // 屏幕抖动（spec 2.3.7）
    this._setShake(grade);

    this._lastDamage = dmg;

    if (DEBUG) {
      console.log('[Catch] hit #' + note.id + ' ' + grade +
        ' offset=' + (this._elapsed - note.expectedTime).toFixed(0) + 'ms' +
        ' dmg=' + dmg.toFixed(1) +
        ' fishHP=' + this._fishStamina.current.toFixed(0) +
        ' playerHP=' + this._playerStamina.current.toFixed(0) +
        ' combo=' + this._combo);
    }

    // 浮动伤害数字
    this._floatingTexts.push({
      text: (grade === 'perfect' && this._combo >= 3) ? '-' + Math.floor(dmg) + ' CRIT!' : '-' + Math.floor(dmg),
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
    this._playerStamina.current = Math.max(0, this._playerStamina.current - drain);
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
   * 玩家耐力消耗（spec 2.3.4）
   * @param {string} grade
   * @param {number} maxStamina
   * @returns {number}
   */
  _getPlayerDrain(grade, maxStamina) {
    switch (grade) {
      case 'perfect': return 0;
      case 'great': return maxStamina * 0.02;
      case 'good': return maxStamina * 0.05;
      case 'miss': return maxStamina * 0.12;
      default: return 0;
    }
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

  /** @returns {Object} 完整游戏状态 */
  getState() {
    return {
      fish: this._fish,
      fishStamina: {
        current: this._fishStamina.current,
        max: this._fishStamina.max,
        percent: this._fishStamina.max > 0
          ? this._fishStamina.current / this._fishStamina.max : 0,
      },
      playerStamina: {
        current: this._playerStamina.current,
        max: this._playerStamina.max,
        percent: this._playerStamina.max > 0
          ? this._playerStamina.current / this._playerStamina.max : 0,
      },
      notes: this._notes.map(n => ({
        id: n.id,
        expectedTime: n.expectedTime,
        speed: n.speed,
        hit: n.hit,
        missed: n.missed,
        grade: n.grade,
        animTimer: n.animTimer,
        offset: n.getOffset(this._elapsed),
        visible: n.isVisible(this._elapsed),
        renderX: n.getRenderX(this._elapsed, 0),
      })),
      currentNoteIdx: this._currentNoteIdx,
      combo: this._combo,
      maxCombo: this._maxCombo,
      isRaging: this._isRaging,
      isFinished: this._finished,
      result: this._result,
      elapsed: this._elapsed,
      lastGrade: this._lastGrade,
      shake: { ...this._shake },
      flashWhite: this._flashWhite,
      floatingTexts: this._floatingTexts.map(ft => ({ ...ft })),
    };
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

export { CatchSystem, TRACK_WIDTH, NOTE_TRAVEL_TIME };
