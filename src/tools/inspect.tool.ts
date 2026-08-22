/**
 * 工具：spine_inspect_json — 深度分析 JSON 层级，返回树形描述
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { getBoneTree } from "../spine/json-handler";
import { readJsonForExport } from "../spine/modify-service";
import { readJsonFile } from "../utils/file-utils";
import * as path from "path";

function boneTreeText(bone: any, depth: number, lines: string[]): void {
  const indent = "  ".repeat(depth);
  lines.push(`${indent}${bone.name}${bone.parent ? ` (父:${bone.parent})` : ""}`);
  for (const child of bone.children ?? []) {
    boneTreeText(child, depth + 1, lines);
  }
}

export class InspectJsonTool extends BaseTool {
  name = "spine_inspect_json";
  description = "深度分析 .spine/.json 的骨骼层级结构，返回树形描述文本与统计（骨骼/插槽/皮肤/约束/动画数）。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目或 .json 文件的绝对路径"),
  });

  async run(args: { projectPath: string }): Promise<any> {
    const { projectPath } = args;
    const isJson = path.extname(projectPath).toLowerCase() === ".json";
    const json = isJson ? readJsonFile(projectPath) : await readJsonForExport(projectPath);

    const roots = getBoneTree(json);
    const lines: string[] = [];
    for (const r of roots) {
      boneTreeText(r, 0, lines);
    }
    const treeText = lines.length ? lines.join("\n") : "（无骨骼）";

    const data = {
      bones: json.bones?.length ?? 0,
      slots: json.slots?.length ?? 0,
      skins: (json.skins ?? []).length,
      animations: Object.keys(json.animations ?? {}).length,
      ik: (json.ik ?? []).length,
      transform: (json.transform ?? []).length,
      path: (json.path ?? []).length,
      tree: treeText,
    };
    return {
      success: true,
      message: `解析完成：${data.bones} 骨骼 / ${data.slots} 插槽 / ${data.skins} 皮肤 / ${data.animations} 动画`,
      data,
    };
  }
}
