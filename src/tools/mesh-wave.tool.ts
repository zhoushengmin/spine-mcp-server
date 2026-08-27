/**
 * 工具：spine_mesh_wave — 网格波动特效（FFD 正弦变形动画）
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { meshWave } from "../spine/mesh-wave-service";

export class MeshWaveTool extends BaseTool {
  name = "spine_mesh_wave";
  description =
    "给 mesh 网格附件生成波动动画（旗帜/布料/水波/触须摆动）：按正弦在网格上逐帧写入 FFD 顶点偏移。仅支持非加权网格。执行前自动备份。示例：{ projectPath, slotName:\"cape\", attachmentName:\"cape\", axis:\"y\", amplitude:8 }。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目路径"),
    slotName: z.string().describe("mesh 附件所在插槽"),
    attachmentName: z.string().describe("mesh 附件名"),
    animationName: z.string().optional().describe("生成的动画名（不填自动生成）"),
    duration: z.number().positive().optional().describe("动画时长（秒），默认 1.5"),
    amplitude: z.number().min(0).optional().describe("波动幅度（像素），默认 6"),
    wavelength: z.number().min(1).optional().describe("波长（像素），默认 48"),
    cycles: z.number().min(0.1).optional().describe("一个时长内的波动周期数，默认 1"),
    axis: z.enum(["x", "y"]).optional().describe("波动方向，默认 y"),
    phase: z.number().optional().describe("初始相位（弧度），默认 0"),
    fps: z.number().int().min(2).max(60).optional().describe("采样密度，默认 12"),
  });

  async run(args: any): Promise<any> {
    let gen: any = null;
    const result = await modifyProject(args.projectPath, (json) => {
      gen = meshWave(json, args.slotName, args.attachmentName, {
        animationName: args.animationName,
        duration: args.duration,
        amplitude: args.amplitude,
        wavelength: args.wavelength,
        cycles: args.cycles,
        axis: args.axis,
        phase: args.phase,
        fps: args.fps,
      });
    });
    return {
      success: true,
      message: `已生成波动动画 "${gen.animationName}"（${gen.vertexCount} 顶点 / ${gen.keyframes} 帧）`,
      data: { ...gen, backupPath: result.backupPath },
    };
  }
}
