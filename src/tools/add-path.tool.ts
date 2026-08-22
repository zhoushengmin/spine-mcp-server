/**
 * 工具：spine_add_path — 新增路径约束
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { addPath } from "../spine/json-handler";

export class AddPathTool extends BaseTool {
  name = "spine_add_path";
  description = "新增路径约束：让骨骼沿路径（path 附件）移动/朝向。";
  inputSchema = z.object({
    projectPath: z.string(),
    name: z.string().describe("约束名（唯一）"),
    bones: z.array(z.string()).describe("受约束骨骼列表"),
    target: z.string().describe("路径附件名"),
    positionMode: z.enum(["fixed", "percent"]).optional(),
    spacingMode: z.enum(["length", "fixed", "percent"]).optional(),
    rotateMode: z.enum(["tangent", "chain", "chainScale"]).optional(),
    position: z.number().optional(),
    spacing: z.number().optional(),
    rotate: z.number().optional(),
  });

  async run(args: any): Promise<any> {
    const result = await modifyProject(args.projectPath, (json) => {
      addPath(json, args.name, args.bones, args.target, {
        positionMode: args.positionMode, spacingMode: args.spacingMode, rotateMode: args.rotateMode,
        position: args.position, spacing: args.spacing, rotate: args.rotate,
      });
    });
    return { success: true, message: `路径约束 "${args.name}" 已创建`, data: { name: args.name, bones: args.bones, target: args.target, backupPath: result.backupPath } };
  }
}
