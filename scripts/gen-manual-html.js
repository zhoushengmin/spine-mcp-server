/**
 * 生成手册打印版 HTML（浏览器打开后 Ctrl+P 存为 PDF）。
 * 用法：node scripts/gen-manual-html.js [源.md] [输出.html]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, 'docs', 'USER_MANUAL.md');
const OUT = process.argv[3] || path.join(ROOT, 'docs', 'USER_MANUAL.html');

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(md) {
  // 代码 `x`
  md = md.replace(/`([^`]+)`/g, '<code>$1</code>');
  // **加粗**
  md = md.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return md;
}

function convert(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  let inCode = false;
  let codeBuf = [];
  let inTable = false;
  let tableBuf = [];

  const flushCode = () => {
    if (codeBuf.length) {
      out.push('<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>');
      codeBuf = [];
    }
  };
  const flushTable = () => {
    if (tableBuf.length) {
      const rows = tableBuf;
      let html = '<table>';
      rows.forEach((r, idx) => {
        if (idx === 1 && r.every((c) => /^:?-{2,}:?$/.test(c.trim()))) return; // 分隔行
        html += '<tr>' + r.map((c) => (idx === 0 ? '<th>' : '<td>') + inline(c.trim()) + (idx === 0 ? '</th>' : '</td>')).join('') + '</tr>';
      });
      html += '</table>';
      out.push(html);
      tableBuf = [];
    }
  };

  for (i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      if (inCode) { flushCode(); inCode = false; }
      else { inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    if (/^\|/.test(line)) {
      tableBuf.push(line.split('|').slice(1, -1));
      inTable = true;
      continue;
    }
    if (inTable) { flushTable(); inTable = false; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
      continue;
    }
    if (/^\s*$/.test(line)) {
      out.push('</ul>');
      continue;
    }
    out.push(`<p>${inline(line)}</p>`);
  }
  flushCode();
  flushTable();
  return out.join('\n');
}

const md = fs.readFileSync(SRC, 'utf8');
const body = convert(md);
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>Spine MCP Server 用户手册</title>
<style>
  body { font-family: "Microsoft YaHei", "Segoe UI", sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #222; line-height: 1.7; }
  h1 { border-bottom: 3px solid #38bdf8; padding-bottom: 8px; }
  h2 { border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 32px; }
  h3 { margin-top: 24px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 14px; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #f1f5f9; }
  code { background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-family: Consolas, monospace; font-size: 13px; }
  pre { background: #0f172a; color: #e2e8f0; padding: 14px; border-radius: 6px; overflow: auto; }
  pre code { background: none; color: inherit; }
  li { margin: 4px 0; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
${body}
</body>
</html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(`✅ 已生成: ${OUT}`);
