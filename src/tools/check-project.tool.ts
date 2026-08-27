/**
 * 工具：spine_check_project — 项目体检报告
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { checkProject } from "../spine/check-service";

export class CheckProjectTool extends BaseTool {
  name = "spine_check_project";
  description =
    "一键输出项目体检报告：版本兼容、引用完整性、atlas 是否存在、骨骼/插槽/皮肤/动画/约束/事件统计、可动画角色覆盖（哪些模板可用）。适合 AI 动手前先体检。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目路径"),
  });

  async run(args: { projectPath: string }): Promise<any> {
    const r = await checkProject(args.projectPath);
    const summary = [
      `版本 ${r.version.spine}${r.version.compatible ? " ✓" : " ⚠️ 非 3.8"}`,
      `${r.stats.bones}骨骼/${r.stats.slots}插槽/${r.stats.skins}皮肤/${r.stats.animations}动画`,
      `atlas ${r.atlas.found ? "✓" : "✗ 缺失"}`,
      `角色匹配 ${r.roleCoverage.mapped}/${r.roleCoverage.total}`,
      r.issues.length ? `⚠️ ${r.issues.length} 个引用问题` : "引用完整 ✓",
    ].join(" · ");
    return {
      success: true,
      message: `项目体检：${summary}`,
      data: r,
    };
  }
}
