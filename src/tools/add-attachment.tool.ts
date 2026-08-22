/**
 * 工具：spine_add_attachment — 新增附件
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { addAttachment } from "../spine/json-handler";

export class AddAttachmentTool extends BaseTool {
  name = "spine_add_attachment";
  description = "为插槽新增附件（region/mesh/boundingbox/path/point/clipping）。region/mesh 需提供纹理 path。";
  inputSchema = z.object({
    projectPath: z.string(),
    slotName: z.string(),
    name: z.string().describe("附件名（唯一）"),
    type: z.enum(["region", "mesh", "boundingbox", "path", "point", "clipping"]),
    skinName: z.string().default("default"),
    path: z.string().optional().describe("纹理路径（region/mesh 需要）"),
    width: z.number().optional(),
    height: z.number().optional(),
  });

  async run(args: any): Promise<any> {
    const { projectPath, slotName, name, type, skinName } = args;
    const data: Record<string, any> = {};
    if (args.path !== undefined) data.path = args.path;
    if (args.width !== undefined) data.width = args.width;
    if (args.height !== undefined) data.height = args.height;
    const result = await modifyProject(projectPath, (json) => addAttachment(json, slotName, name, type, data, skinName));
    return { success: true, message: `附件 "${name}"（${type}）已添加到插槽 "${slotName}"`, data: { name, type, slotName, backupPath: result.backupPath } };
  }
}
