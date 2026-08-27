/**
 * 工具：spine_pose_to_animation — 姿势序列 → 任意动作
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { poseToAnimation } from "../spine/pose-service";

const poseFrame = z.object({
  time: z.number().min(0),
  bones: z.record(z.string(), z.object({ rotation: z.number().optional(), x: z.number().optional(), y: z.number().optional(), scaleY: z.number().optional() })),
});

export class PoseAnimationTool extends BaseTool {
  name = "spine_pose_to_animation";
  description =
    "把一组姿势关键帧插值成平滑动画（AI/用户自由编动作，突破固定模板）。poses=[{time,bones:{骨骼名:{rotation,x,y,scaleY}}}]。示例：{ projectPath, poses:[{time:0,bones:{\"arm_r\":{rotation:10}}},{time:0.3,bones:{\"arm_r\":{rotation:-60}}}], loop:true }。执行前自动备份。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目路径"),
    poses: z.array(poseFrame).describe("姿势序列（至少 2 帧，按 time 升序）"),
    animationName: z.string().optional().describe("动画名（不填自动生成）"),
    loop: z.boolean().optional().describe("是否闭合循环（末帧=首帧），默认 false"),
  });

  async run(args: any): Promise<any> {
    let gen: any = null;
    const result = await modifyProject(args.projectPath, (json) => {
      gen = poseToAnimation(json, args.poses, { animationName: args.animationName, loop: args.loop });
    });
    return {
      success: true,
      message: `已生成姿势动画 "${gen.animationName}"（${gen.poses} 姿势 / ${gen.bones} 骨骼 / ${gen.keyframes} 关键帧）`,
      data: { ...gen, backupPath: result.backupPath },
    };
  }
}
