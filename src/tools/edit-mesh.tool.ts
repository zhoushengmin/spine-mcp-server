/**
 * 工具：spine_edit_mesh — 编辑网格 Setup / FFD 变形关键帧
 * Spine 3.8 的 FFD 时间轴键名为 deform（实测），结构 deform.<皮肤名>.<插槽名>.<附件名>
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject, getFps } from "../spine/modify-service";
import { editMeshSetup, updateDeformKeyframe, frameToTime } from "../spine/json-handler";

export class EditMeshTool extends BaseTool {
  name = "spine_edit_mesh";
  description = "编辑网格附件：mode=setup 改顶点/UV/三角形；mode=deform 写动画 FFD 变形关键帧。";
  inputSchema = z.object({
    projectPath: z.string(),
    slotName: z.string(),
    attachmentName: z.string(),
    skinName: z.string().default("default"),
    mode: z.enum(["setup", "deform"]).default("setup"),
    // setup
    vertices: z.array(z.number()).optional(),
    uvs: z.array(z.number()).optional(),
    triangles: z.array(z.number()).optional(),
    hull: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    // deform
    animationName: z.string().optional(),
    frameIndex: z.number().optional(),
    deformVertices: z.array(z.number()).optional(),
  });

  async run(args: any): Promise<any> {
    const { projectPath, mode } = args;
    if (mode === "setup") {
      const data: Record<string, any> = {};
      for (const k of ["vertices", "uvs", "triangles", "hull", "width", "height"]) {
        if (args[k] !== undefined) data[k] = args[k];
      }
      const result = await modifyProject(projectPath, (json) => editMeshSetup(json, args.slotName, args.attachmentName, data, args.skinName ?? "default"));
      return { success: true, message: `网格 "${args.attachmentName}" Setup 已更新`, data: { mode: "setup", backupPath: result.backupPath } };
    }
    // deform 模式
    if (!args.animationName || args.frameIndex === undefined || !args.deformVertices) {
      return { success: false, message: "deform 模式需要 animationName / frameIndex / deformVertices。", errorCode: "E_INVALID_ARGUMENT" };
    }
    const fps = await getFps(projectPath);
    const time = frameToTime(args.frameIndex, fps);
    const result = await modifyProject(projectPath, (json) => {
      updateDeformKeyframe(json, args.animationName, args.skinName ?? "default", args.slotName, args.attachmentName, time, args.deformVertices);
    });
    return {
      success: true,
      message: `网格 "${args.attachmentName}" 动画 "${args.animationName}" 第 ${args.frameIndex} 帧 FFD 变形已写入`,
      data: { mode: "deform", animationName: args.animationName, frameIndex: args.frameIndex, backupPath: result.backupPath },
    };
  }
}
