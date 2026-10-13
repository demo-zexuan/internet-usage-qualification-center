#!/usr/bin/env node
/**
 * 题库装配脚本
 *
 * I. 用途
 *
 * 1. 题库体量较大时，逐个题目对象写入单个 JSON 文件容易因单次写入过长而中断
 * 2. 本脚本允许将题目分批写入 `parts` 目录下的若干 JSON 数组文件，再合并为完整题库
 *
 * II. 用法
 *
 *   node scripts/assemble-bank.mjs \
 *     --meta  src/data/question-banks/_parts/demo-basic/meta.json \
 *     --parts src/data/question-banks/_parts/demo-basic \
 *     --out   src/data/question-banks/demo-basic.json
 *
 * III. 行为
 *
 * 1. parts 目录下的全部 *.json 按文件名排序后依次读取，每个文件必须是题目对象数组
 * 2. meta.json 提供 schemaVersion / bankId / title / description / language / version 等字段
 * 3. 输出为格式化的完整题库 JSON，并打印题目数量与各分类计数
 *
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** 解析命令行参数 */
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      args[token.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const metaPath = args.meta;
const partsDir = args.parts;
const outPath = args.out;

if (!metaPath || !partsDir || !outPath) {
  console.error('用法: node scripts/assemble-bank.mjs --meta <meta.json> --parts <dir> --out <out.json>');
  process.exit(1);
}

// I. 读取元信息
const meta = JSON.parse(readFileSync(metaPath, 'utf8'));

// II. 按文件名顺序合并题目片段
const partFiles = readdirSync(partsDir)
  .filter((name) => name.endsWith('.json') && name !== 'meta.json')
  .sort();

if (partFiles.length === 0) {
  console.error(`parts 目录中没有题目片段文件: ${partsDir}`);
  process.exit(1);
}

const questions = [];
for (const fileName of partFiles) {
  const filePath = path.join(partsDir, fileName);
  const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!Array.isArray(parsed)) {
    console.error(`片段文件必须是题目数组: ${filePath}`);
    process.exit(1);
  }
  questions.push(...parsed);
}

// III. 输出完整题库
const bank = { ...meta, questions };
writeFileSync(outPath, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');

// IV. 打印统计，便于人工确认
const byCategory = {};
const byType = {};
for (const question of questions) {
  byCategory[question.category] = (byCategory[question.category] ?? 0) + 1;
  byType[question.type] = (byType[question.type] ?? 0) + 1;
}

console.log(`已生成 ${path.relative(process.cwd(), outPath)}`);
console.log(`  题目总数: ${questions.length}`);
console.log(`  分类分布: ${JSON.stringify(byCategory)}`);
console.log(`  题型分布: ${JSON.stringify(byType)}`);
