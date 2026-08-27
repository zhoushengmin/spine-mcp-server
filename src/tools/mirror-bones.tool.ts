/**
 * 工具：spine_mirror_bones — 镜像补全对称骨骼/插槽/附件
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { mirrorSkeleton } from "../spine/mirror-service";

export class MirrorBonesTool extends BaseTool {
  name = "spine_mirror_bones";
  description =
    "把骨架的左/右半结构镜像复制到对侧（一键补全对称角色，如装配只做了左侧）。命名支持 _l/_r、-l/-r、left/right、armL/armR、数字1/2。镜像后可用 spine_generate_animation 自动匹配左右侧。执行前自动备份。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目路径"),
    direction: z.enum(["LtoR", "RtoL"]).optional().describe("LtoR=左补到右（默认）；RtoL=反之"),
    bones: z.array(z.string()).optional().describe("显式指定源骨骼名（缺省自动检测带侧向标记的骨骼）"),
    mirrorAttachments: z.boolean().optional().describe("是否同时镜像插槽与附件，默认 true"),
  });

  async run(args: any): Promise<any> {
    const result = await mirrorSkeleton(args.projectPath, {
      direction: args.direction,
      bones: args.bones,
      mirrorAttachments: args.mirrorAttachments,
    });
    return {
      success: true,
      message: `已镜像 ${result.bones} 骨骼 / ${result.slots} 插槽 / ${result.attachments} 附件${result.skipped.length ? `（跳过已存在 ${result.skipped.length}）` : ""}`,
      data: { ...result },
    };
  }
}
