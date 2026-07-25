'use strict';

/**
 * ============================================================
 * src/data/CsvLoader.js — 纯原生 JavaScript CSV 解析器
 * 版本: 1.0
 * 职责: fetch + 逐行解析、BOM 剥离、引号转义、类型推断
 * 兼容: UTF-8 BOM / CRLF / 引号内逗号 / 双引号转义
 * ============================================================
 */

class CsvLoader {
  /* ============================================================
     公开 API
     ============================================================ */

  /**
   * 抓取并解析一个 CSV 文件
   * @param {string} url - CSV 文件路径（相对于页面根目录）
   * @returns {Promise<Object[]>} 解析后的行对象数组
   */
  static async fetchAndParse(url) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: 无法加载 ${url}`);
    }

    const text = await response.text();
    return CsvLoader.parseCSV(text);
  }

  /**
   * 解析 CSV 文本字符串为结构化对象数组
   * @param {string} text - 原始 CSV 文本内容
   * @returns {Object[]} 解析后的行对象数组
   */
  static parseCSV(text) {
    // --- 1. 剥离 UTF-8 BOM ---
    let cleanText = text;
    if (cleanText.charCodeAt(0) === 0xFEFF) {
      cleanText = cleanText.slice(1);
    }

    // --- 2. 按行分割（兼容 CRLF / LF）---
    const rawLines = cleanText.split(/\r?\n/);

    // --- 3. 跳过首部空行，找到第一个非空行作为标题行 ---
    let headerIndex = 0;
    while (headerIndex < rawLines.length && rawLines[headerIndex].trim() === '') {
      headerIndex++;
    }

    if (headerIndex >= rawLines.length) {
      return []; // 空文件
    }

    // --- 4. 解析标题行 ---
    const headerFields = CsvLoader._parseCSVLine(rawLines[headerIndex]);
    const headers = headerFields.map(field => CsvLoader._toCamelCase(field));

    // --- 5. 逐行解析数据 ---
    const result = [];

    for (let i = headerIndex + 1; i < rawLines.length; i++) {
      const line = rawLines[i].trim();

      // 跳过空行
      if (line === '') {
        continue;
      }

      const fields = CsvLoader._parseCSVLine(rawLines[i]);
      const row = {};

      for (let j = 0; j < headers.length; j++) {
        const value = (j < fields.length) ? fields[j] : '';
        row[headers[j]] = CsvLoader._convertValue(value);
      }

      result.push(row);
    }

    return result;
  }

  /* ============================================================
     内部方法
     ============================================================ */

  /**
   * 解析一行 CSV 文本，正确处理引号内逗号和双引号转义
   * @param {string} line - 单行 CSV 文本
   * @returns {string[]} 解析后的字段数组
   */
  static _parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (inQuotes) {
        if (ch === '"') {
          // 连续两个双引号 => 转义后的单引号
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++; // 跳过下一个引号
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }

    // 最后一个字段
    fields.push(current);

    return fields;
  }

  /**
   * 将 snake_case 或 PascalCase 字段名转换为 camelCase
   * 例如: "MinLength_cm" -> "minLengthCm"
   *       "FishId"       -> "fishId"
   *       "BasePrice_Gold" -> "basePriceGold"
   * @param {string} str - 原始字段名
   * @returns {string} 驼峰式字段名
   */
  static _toCamelCase(str) {
    // Step 1: 在 小写/数字→大写 的边界处插入下划线
    // e.g. "FishId" → "Fish_Id", "BasePrice" → "Base_Price"
    const normalized = str.replace(/([a-z0-9])([A-Z])/g, '$1_$2');

    // Step 2: 按下划线分割，过滤空段，转换为 camelCase
    const segments = normalized.split('_').filter(part => part !== '');

    return segments
      .map((part, index) => {
        if (index === 0) {
          // 首段：首字母小写，其余保持原样（保留已有大写结构）
          return part.charAt(0).toLowerCase() + part.slice(1);
        }
        // 后续段：首字母大写，其余小写（标准化）
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join('');
  }

  /**
   * 推断并转换字段值类型
   * - 空字符串 → null
   * - 纯数字 → Number
   * - 其他 → 原样保留字符串
   * @param {string} value - 原始字符串值
   * @returns {number|string|null} 转换后的值
   */
  static _convertValue(value) {
    // 空字符串 → null
    if (value === '') {
      return null;
    }

    // 去除首尾空白
    const trimmed = value.trim();

    // 尝试转换为数字
    // 只有当整个字符串是有效数值时才转换（排除"001"、"3.14"等）
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return Number(trimmed);
    }

    // 保留字符串
    return trimmed;
  }
}

export { CsvLoader };
