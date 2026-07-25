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
    this._current = screen;
    screen.onEnter(params);

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
    this._current = screen;
    screen.onEnter(params);

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
  }
}

/* ============================================================
   MapSelectScreen（地图选择 — 主 Canvas CSS 坐标）
   ============================================================ */

/** 硬编码地图列表（占位，后续从 GameData 加载） */
const PLACEHOLDER_MAPS = [
  { id: 1,  name: '乡村池塘',  difficulty: 1, desc: '新手入门的最佳选择' },
  { id: 2,  name: '大湖深水',  difficulty: 3, desc: '烟波浩渺，巨物藏身' },
  { id: 3,  name: '山间溪流',  difficulty: 3, desc: '清澈冰凉，鳟鱼之乡' },
  { id: 4,  name: '大河奔流',  difficulty: 4, desc: '滚滚东流，力量对决' },
  { id: 5,  name: '热带雨林河', difficulty: 6, desc: '丛林深处，怪物潜伏' },
];

class MapSelectScreen extends Screen {
  /** @override */
  onEnter() {
    super.onEnter();
    console.log('[MapSelectScreen] 进入地图选择');
  }

  /** @override */
  render(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;

    ctx.fillStyle = 'rgba(10, 20, 35, 0.3)';
    ctx.fillRect(0, 0, w, h);

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '28px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText('选择钓场', cx, 50);

    // 分隔线
    ctx.strokeStyle = '#3a5a6a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, 76);
    ctx.lineTo(w * 0.9, 76);
    ctx.stroke();

    // 地图列表
    const listW = Math.min(520, w * 0.75);
    const itemH = Math.min(56, h / 14);
    const gap = 6;
    const listStartY = 96;

    PLACEHOLDER_MAPS.forEach((map, index) => {
      const y = listStartY + index * (itemH + gap);

      ctx.fillStyle = (index % 2 === 0) ? '#1a3a4a' : '#1e3e4e';
      ctx.fillRect(cx - listW / 2, y, listW, itemH);

      const diffColors = ['#5a9a5a', '#8a9a4a', '#c0a040', '#c07030', '#c04040'];
      ctx.fillStyle = diffColors[map.difficulty - 1] || '#5a5a5a';
      ctx.fillRect(cx - listW / 2, y, 4, itemH);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '18px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#e0d8c0';
      ctx.fillText(map.name, cx - listW / 2 + 16, y + itemH / 2);

      ctx.textAlign = 'right';
      ctx.font = '13px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#5a7a8a';
      ctx.fillText('难度 ' + map.difficulty + '/10', cx + listW / 2 - 12, y + itemH / 2);
    });

    // 返回按钮
    const backW = 90, backH = 36;
    const bx = 16, by = 12;
    ctx.fillStyle = '#3a5a6a';
    ctx.fillRect(bx, by, backW, backH);
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(bx + 2, by + 2, backW - 4, backH - 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#a0c4e0';
    ctx.fillText('← 返回', bx + backW / 2, by + backH / 2);

    // 底部提示
    ctx.textAlign = 'center';
    ctx.font = '11px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#3a5a6a';
    ctx.fillText('点击地图进入钓鱼场景（占位）', cx, h - 24);
  }

  /** @override */
  _setupRegions() {
    super._setupRegions();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;

    // 返回按钮
    this._addClickRegion(16, 12, 90, 36, () => { this.router.pop(); });

    // 地图列表
    const listW = Math.min(520, w * 0.75);
    const itemH = Math.min(56, h / 14);
    const gap = 6;
    const listStartY = 96;
    PLACEHOLDER_MAPS.forEach((map, index) => {
      const y = listStartY + index * (itemH + gap);
      this._addClickRegion(cx - listW / 2, y, listW, itemH, () => {
        console.log('[MapSelect] 选中地图: ' + map.name + ' (ID=' + map.id + ')');
        this.router.push(ScreenType.FISHING, { mapId: map.id });
      });
    });
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
