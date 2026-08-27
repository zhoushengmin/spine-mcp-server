/**
 * 项目体检服务：一次输出项目的健康报告，供 AI 动手前决策。
 * - 版本兼容（3.8.75）、引用完整性、atlas 是否存在
 * - 结构统计（骨骼/插槽/皮肤/动画/约束/事件/附件）
 * - 可动画角色覆盖：哪些骨骼能匹配角色、哪些模板在当前骨架上可用
 */
import * as fs from "fs";
import * as path from "path";
import { readJsonForExport } from "./modify-service";
import { validateJsonReferences } from "./validate-service";
import { detectRole, TEMPLATES } from "./animation-generate-service";

export interface CheckResult {
  valid: boolean;
  version: { spine: string; compatible: boolean };
  stats: { bones: number; slots: number; skins: number; animations: number; constraints: number; events: number; attachments: number };
  issues: string[];
  roleCoverage: { total: number; mapped: number; unmapped: string[]; usableTemplates: string[] };
  atlas: { found: boolean; atlasPath?: string; imagePath?: string };
}

/** 定位项目同名 atlas/png（同目录 + export 子目录） */
export function findProjectAtlas(project: string): { atlas: string; png: string } | null {
  const base = path.dirname(project);
  const nameBase = path.basename(project).replace(/\.spine$/i, "");
  const bare = nameBase.replace(/-(pro|ess|skeleton)$/i, "");
  const found: Array<{ atlas: string; png: string }> = [];
  for (const dir of [base, path.join(base, "export")]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".atlas")) continue;
      const b = f.replace(/\.atlas$/i, "").toLowerCase();
      if (b === nameBase.toLowerCase() || b === bare.toLowerCase() || nameBase.toLowerCase().includes(b) || b.includes(nameBase.toLowerCase())) {
        const png = path.join(dir, f.replace(/\.atlas$/i, ".png"));
        if (fs.existsSync(png)) found.push({ atlas: path.join(dir, f), png });
      }
    }
  }
  found.sort((a, b) => {
    const sc = (x: { atlas: string }) => {
      const b2 = path.basename(x.atlas).replace(/\.atlas$/i, "").toLowerCase();
      if (b2 === nameBase.toLowerCase()) return 100;
      if (b2 === bare.toLowerCase()) return 90;
      return 50;
    };
    return sc(b) - sc(a);
  });
  return found[0] ?? null;
}

export async function checkProject(projectPath: string): Promise<CheckResult> {
  const json = await readJsonForExport(projectPath);
  const issues = validateJsonReferences(json);
  const spine = json.skeleton?.spine ?? "unknown";
  const compatible = /^3\.8/.test(spine);

  const skins = Array.isArray(json.skins) ? json.skins : Object.values(json.skins ?? {});
  let attachments = 0;
  for (const s of skins) {
    for (const atts of Object.values<any>(s?.attachments ?? {})) attachments += Object.keys(atts ?? {}).length;
  }

  const bones = json.bones ?? [];
  const mapped: string[] = [];
  const unmapped: string[] = [];
  for (const b of bones) {
    if (detectRole(b.name)) mapped.push(b.name);
    else unmapped.push(b.name);
  }
  // 可用模板：能至少匹配到 1 根骨骼
  const usableTemplates = Object.keys(TEMPLATES).filter((tpl) => {
    return bones.some((b: any) => detectRole(b.name));
  });

  const atlas = findProjectAtlas(projectPath);
  return {
    valid: issues.length === 0,
    version: { spine, compatible },
    stats: {
      bones: bones.length,
      slots: (json.slots ?? []).length,
      skins: skins.length,
      animations: Object.keys(json.animations ?? {}).length,
      constraints: (json.ik ?? []).length + (json.transform ?? []).length + (json.path ?? []).length,
      events: Object.keys(json.events ?? {}).length,
      attachments,
    },
    issues,
    roleCoverage: { total: bones.length, mapped: mapped.length, unmapped, usableTemplates },
    atlas: atlas ? { found: true, atlasPath: atlas.atlas, imagePath: atlas.png } : { found: false },
  };
}
