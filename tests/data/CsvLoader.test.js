'use strict';

/**
 * CsvLoader 单元测试（T-002）
 * 覆盖: BOM 剥离 / CRLF 与 LF / 引号内逗号 / 双引号转义 / 空行跳过 / 类型推断
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CsvLoader } from '../../src/data/CsvLoader.js';

test('解析 BOM + CRLF + 引号内逗号 + 数字类型推断', () => {
  const csv = '\uFEFFFishId,FishName,Note\r\n' +
    '1,\u9CA4\u9C7C,"\u597D\u5403, \u5927\u8865"\r\n' +
    '2,\u9CA4\u9C7C,\r\n';
  const rows = CsvLoader.parseCSV(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].fishId, 1);          // 数字自动转换
  assert.equal(rows[0].fishName, '\u9CA4\u9C7C');
  assert.equal(rows[0].note, '\u597D\u5403, \u5927\u8865'); // 引号内逗号保留
  assert.equal(rows[1].note, null);          // 空值 → null
});

test('PascalCase 与 snake_case 字段名统一转 camelCase', () => {
  const csv = 'FishId,MinLength_cm,BasePrice_Gold\n1,10.5,99\n';
  const rows = CsvLoader.parseCSV(csv);
  assert.equal(rows[0].fishId, 1);
  assert.equal(rows[0].minLengthCm, 10.5);
  assert.equal(rows[0].basePriceGold, 99);
});

test('双引号转义（"" → 单个 "）', () => {
  const csv = 'Name,Desc\nA,"He said ""hi"""\n';
  const rows = CsvLoader.parseCSV(csv);
  assert.equal(rows[0].desc, 'He said "hi"');
});

test('跳过空行与首部空行', () => {
  const csv = '\n\nHead,Val\n1,2\n\n3,4\n\n';
  const rows = CsvLoader.parseCSV(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].head, 3);
});

test('LF 换行（无 CR）同样兼容', () => {
  const csv = 'A,B\n1,2\n3,4\n';
  const rows = CsvLoader.parseCSV(csv);
  assert.equal(rows.length, 2);
});

test('字符串保留原样（非纯数字不转换）', () => {
  const csv = 'Name,Code\nA,001\nB,3.14x\n';
  const rows = CsvLoader.parseCSV(csv);
  assert.equal(rows[0].code, 1);    // "001" 是有效数值 → Number(1)
  assert.equal(rows[1].code, '3.14x'); // 含字母 → 保留字符串
});
