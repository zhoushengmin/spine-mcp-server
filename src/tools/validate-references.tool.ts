/**
 * 工具：spine_validate_references — 校验项目引用完整性
 */
import { z } from "zod";
import * as path from "path";
import { BaseTool } from "./base.tool";
import { readJsonForExport } from "../spine/modify-service";
import { readJsonFile } from "../utils/file-utils";
import { validateJsonReferences } from "../spine/validate-service";

export class ValidateReferencesTool extends BaseTool {
  name = "spine_validate_references";
  description = "校验项目引用完整性：骨骼/插槽/皮肤/附件/约束/动画中的引用是否有效。在批量操作后跑一次，提前发现悬空引用。";
  inputSchema = z.object({
    projectPath: z.string(),
  });

  async run(args: { projectPath: string }): Promise<any> {
    const isJson = path.extname(args.projectPath).toLowerCase() === ".json";
    const json = isJson ? readJsonFile(args.projectPath) : await readJsonForExport(args.projectPath);
    const issues = validateJsonReferences(json);

    return {
      success: issues.length === 0,
      message: issues.length === 0 ? "项目引用完整，未发现问题。" : `发现 ${issues.length} 个引用问题`,
      data: { valid: issues.length === 0, issues },
    };
  }
}
