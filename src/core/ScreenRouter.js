'use strict';

/**
 * ============================================================
 * src/core/ScreenRouter.js — 画面路由系统
 * 版本: 1.0
 * 职责: 栈式路由管理、Screen 基类（生命周期/点击区域/事件清理）
 * ============================================================
 */

/* ============================================================
   画面枚举
   ============================================================ */

/** @readonly @enum {string} */
const ScreenType = Object.freeze({
  TITLE:       'TITLE',
  MAP_SELECT:  'MAP_SELECT',
  FISHING:     'FISHING',
  RESULT:      'RESULT',
  SHOP:        'SHOP',
  EQUIPMENT:   'EQUIPMENT',
  FISH_DEX:    'FISH_DEX',
  AQUARIUM:    'AQUARIUM',
  SETTINGS:    'SETTINGS',
});

/* ============================================================
   Screen 基类
   ============================================================ */

class Screen {
  /**
   * @param {ScreenRouter} router - 所属路由实例
   */
  constructor(router) {
    /** @type {ScreenRouter} */
    this.router = router;

    /** @type {Array<{element:EventTarget, type:string, handler:Function}>} */
    this._listeners = [];

    /** @type {Array<{x:number, y:number, w:number, h:number, callback:Function}>} */
    this._clickRegions = [];
  }

  /* ============================================================
     事件监听管理（自动清理防泄漏）
     ============================================================ */

  /**
   * 注册一个受管理的 DOM 事件监听，onExit 时自动移除
   * @param {EventTarget} element - DOM 元素
   * @param {string} type - 事件类型
   * @param {Function} handler - 处理函数
   */
  _addListener(element, type, handler) {
    element.addEventListener(type, handler);
    this._listeners.push({ element, type, handler });
  }

  /** 移除所有受管理的事件监听 */
  _removeAllListeners() {
    for (const { element, type, handler } of this._listeners) {
      element.removeEventListener(type, handler);
    }
    this._listeners = [];
  }

  /* ============================================================
     点击区域管理
     ============================================================ */

  /**
   * 注册一个可点击区域（基于 CSS 像素坐标）
   * @param {number} x - 左上角 x
   * @param {number} y - 左上角 y
   * @param {number} w - 宽度
   * @param {number} h - 高度
   * @param {Function} callback - 回调
   */
  _addClickRegion(x, y, w, h, callback) {
    this._clickRegions.push({ x, y, w, h, callback });
  }

  /**
   * 默认的空 _setupRegions，子类可覆盖此方法定义点击区域
   * 每次 handleClick 时会重新调用，以响应窗口 resize
   */
  _setupRegions() {
    this._clickRegions = [];
  }

  /**
   * 处理点击/触摸事件
   * @param {number} mx - 鼠标/触摸 X（CSS 像素，相对于 Canvas 左上角）
   * @param {number} my - 鼠标/触摸 Y
   * @returns {boolean} 是否命中某个区域
   */
  handleClick(mx, my) {
    this._setupRegions();
    for (const region of this._clickRegions) {
      if (mx >= region.x && mx <= region.x + region.w &&
          my >= region.y && my <= region.y + region.h) {
        region.callback();
        return true;
      }
    }
    return false;
  }

  /* ============================================================
     生命周期（子类覆盖）
     ============================================================ */

  /**
   * 进入该画面时调用
   * @param {*} [params] - 传入的参数
   */
  onEnter(params) {
    // 子类覆盖
  }

  /** 离开该画面时调用（清理事件监听） */
  onExit() {
    this._removeAllListeners();
  }

  /**
   * 每帧更新
   * @param {number} dt - 距上一帧的毫秒数
   */
  update(dt) {
    // 子类覆盖
  }

  /**
   * 每帧绘制
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    // 子类覆盖
  }
}

/* ============================================================
   ScreenRouter（栈式路由）
   ============================================================ */

class ScreenRouter {
  /**
   * @param {CanvasRenderingContext2D} ctx - Canvas 渲染上下文
   */
  constructor(ctx) {
    /** @type {CanvasRenderingContext2D} */
    this.ctx = ctx;

    /** @type {Screen[]} 屏幕实例栈 */
    this._history = [];

    /** @type {Screen|null} 当前活跃屏幕 */
    this._current = null;

    /** @type {Object<string, Function>} 屏幕类型 → 工厂函数映射 */
    this._registry = {};

    /**
     * 屏幕切换回调（供外部设置 e.g. BGM 切换）
     * @type {Function|null} (screenType:string) => void
     */
    this.onScreenEnter = null;
  }

  /**
   * 注册一个屏幕类型的工厂函数
   * @param {string} type - ScreenType 枚举值
   * @param {Function} factory - () => Screen 实例
   */
  register(type, factory) {
    this._registry[type] = factory;
  }

  /**
   * 推入新屏幕
   * @param {string} type - ScreenType 枚举值
   * @param {*} [params] - 传入 onEnter 的参数
   */
  push(type, params) {
    const factory = this._registry[type];
    if (!factory) {
      console.error('[ScreenRouter] 未注册的屏幕类型:', type);
      return;
    }

    // 退出当前屏幕
    if (this._current) {
      this._current.onExit();
      this._history.push(this._current);
    }

    // 创建并进入新屏幕
    const screen = factory();
    screen._type = type;
    this._current = screen;
    screen.onEnter(params);

    if (this.onScreenEnter) this.onScreenEnter(type);

    console.log('[ScreenRouter] push → ' + type + ' (栈深: ' + (this._history.length + 1) + ')');
  }

  /**
   * 返回上一屏幕
   * - 若栈中有上一屏幕，恢复之
   * - 若栈为空但有当前屏幕（根节点），清空当前屏幕
   */
  pop() {
    // 情况1：栈中有历史，退回上一屏幕
    if (this._history.length > 0) {
      // 退出当前屏幕
      if (this._current) {
        this._current.onExit();
      }

      // 弹出上一屏幕
      const prev = this._history.pop();
      this._current = prev;
      prev.onEnter();

      if (this.onScreenEnter) this.onScreenEnter(prev._type);

      console.log('[ScreenRouter] pop ← (栈深: ' + this.getStackDepth() + ')');
      return;
    }

    // 情况2：栈空但有当前屏幕（根节点），清空
    if (this._current) {
      this._current.onExit();
      this._current = null;
      console.log('[ScreenRouter] pop ← (根节点清除，栈深: 0)');
      return;
    }

    // 情况3：完全空栈
    console.warn('[ScreenRouter] 栈空，无法 pop');
  }

  /**
   * 替换当前屏幕（不改变栈深）
   * @param {string} type - ScreenType 枚举值
   * @param {*} [params] - 传入 onEnter 的参数
   */
  replace(type, params) {
    const factory = this._registry[type];
    if (!factory) {
      console.error('[ScreenRouter] 未注册的屏幕类型:', type);
      return;
    }

    // 退出当前屏幕但不入栈
    if (this._current) {
      this._current.onExit();
    }

    // 创建并进入新屏幕
    const screen = factory();
    screen._type = type;
    this._current = screen;
    screen.onEnter(params);

    if (this.onScreenEnter) this.onScreenEnter(type);

    console.log('[ScreenRouter] replace → ' + type);
  }

  /**
   * 获取当前屏幕
   * @returns {Screen|null}
   */
  getCurrentScreen() {
    return this._current;
  }

  /**
   * 获取当前栈深
   * @returns {number}
   */
  getStackDepth() {
    return this._history.length + (this._current ? 1 : 0);
  }
}

/* ============================================================
   TitleScreen（标题画面 — 主 Canvas CSS 坐标）
   ============================================================ */

/** 标题页二级菜单项 */
const TITLE_MENU = [
  { label: '图鉴', type: 'FISH_DEX' },
  { label: '装备', type: 'EQUIPMENT' },
  { label: '商店', type: 'SHOP' },
  { label: '设置', type: 'SETTINGS' },
];

class TitleScreen extends Screen {
  /**
   * 绘制标题画面
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;

    // 半透明覆盖
    ctx.fillStyle = 'rgba(10, 26, 42, 0.2)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 主标题
    ctx.font = 'bold 56px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 12;
    ctx.fillText('🎣 钓趣', cx, h * 0.28);
    ctx.shadowBlur = 0;

    // 副标题
    ctx.font = '22px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#8ab0c0';
    ctx.fillText('Fishing Fun', cx, h * 0.28 + 56);

    // 版本
    ctx.font = '14px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#4a6a7a';
    ctx.fillText('v1.0 | HTML5 Canvas 2D', cx, h * 0.38);

    // 开始游戏按钮
    const btnW = 220;
    const btnH = 56;
    const btnX = cx - btnW / 2;
    const btnY = h * 0.46;

    ctx.shadowColor = 'rgba(100, 200, 240, 0.3)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#2a5a6a';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#3a7a8a';
    ctx.fillRect(btnX + 2, btnY + 2, btnW - 4, btnH - 4);

    ctx.font = '24px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText('开始游戏', cx, btnY + btnH / 2);

    // 二级菜单
    const menuY = btnY + btnH + 26;
    const menuW = Math.min(150, (w - 40 - 36) / 4);
    const menuH = 46;
    const menuGap = 12;
    const menuTotal = menuW * TITLE_MENU.length + menuGap * (TITLE_MENU.length - 1);
    let mx = cx - menuTotal / 2;
    for (const item of TITLE_MENU) {
      ctx.fillStyle = '#1a3a4a';
      ctx.fillRect(mx, menuY, menuW, menuH);
      ctx.fillStyle = '#224a5a';
      ctx.fillRect(mx + 2, menuY + 2, menuW - 4, menuH - 4);
      ctx.font = '16px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#a0c4e0';
      ctx.fillText(item.label, mx + menuW / 2, menuY + menuH / 2);
      mx += menuW + menuGap;
    }

    // 底部
    ctx.font = '12px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#4a6a7a';
    ctx.fillText('点击按钮开始你的钓鱼之旅', cx, h - 40);
  }

  /** @override */
  _setupRegions() {
    super._setupRegions();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    this._addClickRegion(
      cx - 110, h * 0.46, 220, 56,
      () => { this.router.push(ScreenType.MAP_SELECT); }
    );

    // 二级菜单
    const menuY = h * 0.46 + 56 + 26;
    const menuW = Math.min(150, (w - 40 - 36) / 4);
    const menuH = 46;
    const menuGap = 12;
    const menuTotal = menuW * TITLE_MENU.length + menuGap * (TITLE_MENU.length - 1);
    let mx = cx - menuTotal / 2;
    for (const item of TITLE_MENU) {
      this._addClickRegion(mx, menuY, menuW, menuH, () => {
        this.router.push(item.type);
      });
      mx += menuW + menuGap;
    }
  }
}

/* ============================================================
   MapSelectScreen（地图选择 — 主 Canvas CSS 坐标）
   版本 2.0 (T-018): 从 GameData.MapDefinition 加载全部地图，
   按玩家等级解锁，支持滚动浏览
   ============================================================ */

/** 上次进入地图选择时的玩家等级（用于新解锁高亮） */
let _lastSeenLevel = 1;

/** 地图行高与间距 */
const MAP_ITEM_H = 48;
const MAP_GAP = 6;

class MapSelectScreen extends Screen {
  /** @override */
  onEnter() {
    super.onEnter();
    this._scrollY = 0;
    this._statusText = null;
    this._statusTimer = null;
    this._maps = this._loadMaps();
    this._wheelHandler = (e) => {
      e.preventDefault();
      this._scrollY += e.deltaY;
      this._clampScroll();
    };
    this._addListener(document, 'wheel', this._wheelHandler);
    console.log('[MapSelectScreen] 进入地图选择, 地图数=' + this._maps.length);
  }

  /** @override */
  onExit() {
    if (this._statusTimer) {
      clearTimeout(this._statusTimer);
      this._statusTimer = null;
    }
    super.onExit();
  }

  /**
   * 从数据缓存加载地图列表
   * @returns {Array}
   * @private
   */
  _loadMaps() {
    try {
      const maps = window.GameData ? window.GameData.MapDefinition : null;
      if (maps && maps.length > 0) return maps;
      return [
        { mapId: 1, mapName: '乡村池塘', difficulty: 1, minLevel: 1, description: '新手入门的最佳选择' },
      ];
    } catch (e) {
      return [{ mapId: 1, mapName: '乡村池塘', difficulty: 1, minLevel: 1 }];
    }
  }

  /** @returns {number} 当前玩家等级 */
  _getLevel() {
    return window._economy ? window._economy.getLevel() : 1;
  }

  /** @returns {number} 当前金币 */
  _getGold() {
    return window._economy ? window._economy.getGold() : 0;
  }

  /**
   * 判断地图是否解锁
   * @param {Object} map
   * @returns {boolean}
   * @private
   */
  _isUnlocked(map) {
    return this._getLevel() >= (map.minLevel || 1);
  }

  /** 限制滚动范围 */
  _clampScroll() {
    const max = this._getScrollMax();
    this._scrollY = Math.max(0, Math.min(max, this._scrollY));
  }

  /** @returns {number} 最大可滚动量 */
  _getScrollMax() {
    const h = window.innerHeight;
    const avail = h - 96 - 44;
    const content = this._maps.length * (MAP_ITEM_H + MAP_GAP);
    return Math.max(0, content - avail);
  }

  /** @override */
  render(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const level = this._getLevel();

    ctx.fillStyle = 'rgba(10, 20, 35, 0.3)';
    ctx.fillRect(0, 0, w, h);

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '28px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText('选择钓场', cx, 44);

    // 玩家信息
    ctx.font = '13px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#8ab0c0';
    ctx.textAlign = 'left';
    ctx.fillText('Lv.' + level + ' ' + (window._economy ? window._economy.getTitle() : ''), 16, 44);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f0d060';
    ctx.fillText('💰 ' + this._getGold(), w - 16, 44);

    // 商店快捷入口
    ctx.fillStyle = '#2a4a3a';
    ctx.fillRect(w - 116, 12, 100, 36);
    ctx.fillStyle = '#3a6a4a';
    ctx.fillRect(w - 114, 14, 96, 32);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#c8e8d0';
    ctx.fillText('🛒 商店', w - 66, 30);

    // 分隔线
    ctx.strokeStyle = '#3a5a6a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, 70);
    ctx.lineTo(w * 0.9, 70);
    ctx.stroke();

    // 列表区域裁剪
    const listStartY = 82;
    const listEndY = h - 40;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listStartY - 4, w, listEndY - listStartY + 8);
    ctx.clip();

    const listW = Math.min(560, w * 0.8);
    this._maps.forEach((map, index) => {
      const y = listStartY - this._scrollY + index * (MAP_ITEM_H + MAP_GAP);
      if (y + MAP_ITEM_H < listStartY || y > listEndY) return; // 视口外跳过
      this._drawMapRow(ctx, map, index, y, cx, listW, level);
    });
    ctx.restore();

    // 滚动提示
    if (this._getScrollMax() > 0) {
      ctx.textAlign = 'center';
      ctx.font = '11px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#3a5a6a';
      ctx.fillText('↑↓ / 滚轮 滚动列表', cx, h - 22);
    }

    // 状态提示
    if (this._statusText) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#e0a040';
      ctx.fillText(this._statusText, cx, listEndY + 6);
    }

    this._drawBackButton(ctx);
  }

  /**
   * 绘制一行地图
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} map - 地图定义
   * @param {number} index - 行号
   * @param {number} y - 绘制 Y
   * @param {number} cx - 中心 X
   * @param {number} listW - 列表宽
   * @param {number} level - 玩家等级
   * @private
   */
  _drawMapRow(ctx, map, index, y, cx, listW, level) {
    const unlocked = this._isUnlocked(map);
    const isNew = this._isNewlyUnlocked(map);

    ctx.fillStyle = unlocked
      ? ((index % 2 === 0) ? '#1a3a4a' : '#1e3e4e')
      : '#152630';
    ctx.fillRect(cx - listW / 2, y, listW, MAP_ITEM_H);

    // 新解锁高亮描边
    if (isNew) {
      ctx.strokeStyle = '#f0d060';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - listW / 2 + 1, y + 1, listW - 2, MAP_ITEM_H - 2);
    }

    // 难度色条
    const diffColors = ['#5a9a5a', '#8a9a4a', '#c0a040', '#c07030', '#c04040'];
    const diff = Math.max(1, Math.min(5, map.difficulty || 1));
    ctx.fillStyle = diffColors[diff - 1];
    ctx.fillRect(cx - listW / 2, y, 4, MAP_ITEM_H);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 17px Consolas, "Courier New", monospace';
    ctx.fillStyle = unlocked ? '#e0d8c0' : '#5a6a7a';
    ctx.fillText(map.mapName, cx - listW / 2 + 16, y + MAP_ITEM_H / 2 - 5);

    ctx.font = '12px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#5a7a8a';
    ctx.fillText(map.description || map.regionHint || '', cx - listW / 2 + 16, y + MAP_ITEM_H / 2 + 13);

    ctx.textAlign = 'right';
    ctx.font = '12px Consolas, "Courier New", monospace';
    if (unlocked) {
      ctx.fillStyle = '#6a9a8a';
      ctx.fillText('难度 ' + (map.difficulty || 1) + '/10', cx + listW / 2 - 12, y + MAP_ITEM_H / 2);
    } else {
      ctx.fillStyle = '#8a5650';
      ctx.fillText('🔒 Lv.' + (map.minLevel || 1) + ' 解锁', cx + listW / 2 - 12, y + MAP_ITEM_H / 2);
    }
  }

  /**
   * 是否本次进入新解锁的地图（等级提升后）
   * @param {Object} map
   * @returns {boolean}
   * @private
   */
  _isNewlyUnlocked(map) {
    const level = this._getLevel();
    const min = map.minLevel || 1;
    return min <= level && min > _lastSeenLevel;
  }

  /**
   * 绘制返回按钮
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawBackButton(ctx) {
    const bw = 90, bh = 36, bx = 16, by = 12;
    ctx.fillStyle = '#3a5a6a';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#a0c4e0';
    ctx.fillText('← 返回', bx + bw / 2, by + bh / 2);
  }

  /** @override */
  _setupRegions() {
    super._setupRegions();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;

    // 返回按钮
    this._addClickRegion(16, 12, 90, 36, () => {
      _lastSeenLevel = this._getLevel();
      this.router.pop();
    });

    // 商店快捷入口
    this._addClickRegion(w - 116, 12, 100, 36, () => {
      this.router.push(ScreenType.SHOP);
    });

    // 地图列表
    const listW = Math.min(560, w * 0.8);
    const listStartY = 82;
    this._maps.forEach((map, index) => {
      const y = listStartY - this._scrollY + index * (MAP_ITEM_H + MAP_GAP);
      if (y + MAP_ITEM_H < 80 || y > h - 40) return;
      this._addClickRegion(cx - listW / 2, y, listW, MAP_ITEM_H, () => {
        if (!this._isUnlocked(map)) {
          this._statusText = '🔒 需要 Lv.' + (map.minLevel || 1) + ' 才能进入';
          this._flashStatus();
          return;
        }
        _lastSeenLevel = this._getLevel();
        this.router.push(ScreenType.FISHING, { mapId: map.mapId });
      });
    });
  }

  /** 状态提示定时消失 */
  _flashStatus() {
    if (this._statusTimer) clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => {
      this._statusText = null;
      this._statusTimer = null;
    }, 1800);
  }
}

/* ============================================================
   导出
   ============================================================ */

export {
  ScreenType,
  Screen,
  ScreenRouter,
  TitleScreen,
  MapSelectScreen,
};
