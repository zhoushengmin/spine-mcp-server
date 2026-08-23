/**
 * .ccx 打包脚本：把 cocos-extension 打包为 Cocos 商店 .ccx 安装包。
 * .ccx 本质是一个 zip 压缩包（内含扩展全部文件）。
 * 用法：node scripts/package-ccx.js [输出路径]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EXT_DIR = path.join(ROOT, 'cocos-extension');

function main() {
  const outPath = process.argv[2] || path.join(ROOT, 'dist-ccx', 'spine-mcp-panel.ccx');
  if (!fs.existsSync(EXT_DIR)) {
    console.error('错误：cocos-extension 目录不存在。');
    process.exit(1);
  }
  // 校验 package.json
  const pkg = JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'package.json'), 'utf8'));
  console.log(`打包扩展: ${pkg.name}@${pkg.version}`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

  // 用 PowerShell Compress-Archive 打 zip（Windows 内置，最可靠）
  const staging = path.join(ROOT, 'dist-ccx', '_staging_' + pkg.name);
  if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  // 拷贝扩展内容到暂存目录
  const copyDir = (src, dst) => {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) {
      const s = path.join(src, f);
      const d = path.join(dst, f);
      if (fs.statSync(s).isDirectory()) copyDir(s, d);
      else fs.copyFileSync(s, d);
    }
  };
  copyDir(EXT_DIR, staging);

  // 附上说明文档
  const readme = path.join(ROOT, 'docs', 'cocos-extension-README.md');
  if (fs.existsSync(readme)) fs.copyFileSync(readme, path.join(staging, 'README.md'));

  // 打包 zip
  const zipPath = outPath.replace(/\.ccx$/i, '.zip');
  const ps = `Compress-Archive -Path "${path.join(staging, '*')}" -DestinationPath "${zipPath}" -Force`;
  execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
  fs.renameSync(zipPath, outPath);

  fs.rmSync(staging, { recursive: true, force: true });
  const size = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`✅ 已生成 .ccx: ${outPath}（${size} KB）`);
}

main();
