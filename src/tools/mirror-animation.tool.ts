/**
 * 工具：spine_mirror_animation — 动作时间轴左右镜像（复用角色出镜像动作）
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { mirrorAnimation } from "../spine/animation-mirror-service";

export class MirrorAnimationTool extends BaseTool {
  name = "spine_mirror_animation";
  description =
    "把已有动画的骨骼/插槽/绘制顺序时间轴镜像成新动画（右利手挥砍 → 左利手）。骨骼旋转取反、位移 x 取反。执行前自动备份。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目路径"),
    animationName: z.string().describe("源动画名"),
    outputName: z.string().optional().describe("新动画名（不填 mirror-<源名>）"),
  });

  async run(args: any): Promise<any> {
    let gen: any = null;
    const result = await modifyProject(args.projectPath, (json) => {
      gen = mirrorAnimation(json, args.animationName, { outputName: args.outputName });
    });
    return {
      success: true,
      message: `已镜像动画 "${args.animationName}" → "${gen.output}"（${gen.bones} 骨骼 / ${gen.slots} 插槽）`,
      data: { ...gen, backupPath: result.backupPath },
    };
  }
}
