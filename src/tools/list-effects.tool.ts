/**
 * 工具：spine_list_effects — 效果配方目录
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { listEffects } from "../spine/effect-service";

export class ListEffectsTool extends BaseTool {
  name = "spine_list_effects";
  description = "列出所有可用效果（效果配方目录）：动作类(idle/breath/walk/run/wave/attack/jump)、皮肤类(switch-skin)、组合类(attack-impact/jump-land)及参数说明。供 spine_apply_effect 使用。";
  inputSchema = z.object({});

  async run(): Promise<any> {
    const effects = listEffects();
    return {
      success: true,
      message: `共 ${effects.length} 个可用效果`,
      data: { count: effects.length, effects },
    };
  }
}
