'use strict';

/**
 * 浏览器端快速验收脚本
 * 粘贴到 Console 中执行
 */
(async function() {
  try {
    const mod = await import('/src/systems/EquipmentManager.js');
    const data = await import('/src/data/EquipmentData.js');
    console.log('✅ EquipmentManager 加载成功');
    console.log('✅ EquipmentData 加载成功，共', data.EQUIPMENT_LIBRARY.length, '件装备');
    
    if (window._equipmentManager) {
      console.log('✅ EquipmentManager 已初始化');
      console.log('   已装备:', window._equipmentManager.getEquipped());
      console.log('   总属性:', window._equipmentManager.getTotalStats());
    } else {
      console.log('❌ window._equipmentManager 不存在');
    }
  } catch(e) {
    console.log('❌ 加载失败:', e.message);
  }
})();
