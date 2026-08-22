/**
 * 工具：spine_get_attachments — 列出插槽/皮肤可用附件
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { readJsonForExport } from "../spine/modify-service";
import { readJsonFile } from "../utils/file-utils";
import * as path from "path";

export class GetAttachmentsTool extends BaseTool {
  name = "spine_get_attachments";
  description = "列出指定插槽（或整个皮肤）可用的所有附件及类型。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目或 .json 文件的绝对路径"),
    slotName: z.string().optional().describe("指定插槽（不填则列出全部插槽）"),
    skinName: z.string().optional().describe("皮肤名，默认 default"),
  });

  async run(args: { projectPath: string; slotName?: string; skinName?: string }): Promise<any> {
    const { projectPath } = args;
    const isJson = path.extname(projectPath).toLowerCase() === ".json";
    const json = isJson ? readJsonFile(projectPath) : await readJsonForExport(projectPath);

    const skinName = args.skinName ?? "default";
    const skins: any[] = Array.isArray(json.skins) ? json.skins : Object.entries(json.skins ?? {}).map(([name, v]) => ({ name, attachments: v }));
    const skin = skins.find((s) => s.name === skinName) ?? skins[0];
    if (!skin) {
      return { success: true, message: "项目无皮肤数据", data: { attachments: [] } };
    }
    const attachments: Record<string, { type: string }[]> = {};
    for (const [slot, atts] of Object.entries<any>(skin.attachments ?? {})) {
      if (args.slotName && slot !== args.slotName) continue;
      attachments[slot] = Object.entries<any>(atts).map(([name, def]) => ({ name, type: def?.type ?? "region" }));
    }
    return { success: true, message: `皮肤 "${skinName}" 附件已读取`, data: { skinName, attachments } };
  }
}
