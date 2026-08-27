/**
 * 工具：spine_describe — AI 友好的结构化骨架总览
 * 输出骨骼层级树、插槽/附件/皮肤/动画/约束/事件，并给出每根骨骼的可动画角色建议
 * （直接喂给 spine_generate_animation 的 roleMap）。
 */
import { z } from "zod";
import * as fs from "fs";
import { BaseTool } from "./base.tool";
import { readJsonForExport } from "../spine/modify-service";
import { detectRole } from "../spine/animation-generate-service";

export class DescribeTool extends BaseTool {
  name = "spine_describe";
  description =
    "用 AI 友好的结构化格式总览骨架：骨骼层级树（含父子关系/位置/长度）、插槽与附件、皮肤、动画、约束、事件，并给出每根骨骼的可动画角色建议（如 armL/legR/torso），可直接用于 spine_generate_animation 的 roleMap。适合在生成动作或装配前先了解骨架结构。";
  inputSchema = z.object({
    projectPath: z.string().optional().describe(".spine 项目路径"),
    skeletonJson: z.string().optional().describe("导出的骨架 JSON 路径（替代 projectPath）"),
  });

  async run(args: any): Promise<any> {
    if (!args.projectPath && !args.skeletonJson) {
      return { success: false, message: "需要 projectPath 或 skeletonJson。", errorCode: "E_INVALID_ARGUMENT" };
    }
    let json: any;
    if (args.skeletonJson) {
      if (!fs.existsSync(args.skeletonJson)) {
        return { success: false, message: `骨架 JSON 不存在：${args.skeletonJson}`, errorCode: "E_INVALID_ARGUMENT" };
      }
      json = JSON.parse(fs.readFileSync(args.skeletonJson, "utf8"));
    } else {
      json = await readJsonForExport(args.projectPath);
    }

    const bones = json.bones ?? [];
    const childrenOf = new Map<string, string[]>();
    for (const b of bones) {
      const p = b.parent ?? "root";
      if (!childrenOf.has(p)) childrenOf.set(p, []);
      childrenOf.get(p)!.push(b.name);
    }
    const roots = bones.filter((b: any) => !b.parent || !bones.some((x: any) => x.name === b.parent)).map((b: any) => b.name);

    const roleSuggestion: Record<string, string | null> = {};
    const unmapped: string[] = [];
    for (const b of bones) {
      const role = detectRole(b.name);
      roleSuggestion[b.name] = role;
      if (!role) unmapped.push(b.name);
    }

    const slots = (json.slots ?? []).map((s: any) => ({
      name: s.name,
      bone: s.bone,
      order: s.order ?? 0,
      attachment: s.attachment ?? null,
    }));

    const skins = (Array.isArray(json.skins) ? json.skins : Object.values(json.skins ?? {}));
    const skinNames = skins.map((s: any) => s.name ?? "default");
    let attachmentCount = 0;
    for (const s of skins) {
      const atts = s.attachments ?? {};
      for (const slotAtts of Object.values<any>(atts)) attachmentCount += Object.keys(slotAtts ?? {}).length;
    }

    const animations = Object.entries<any>(json.animations ?? {}).map(([name, anim]) => {
      let keyframes = 0;
      const count = (obj: any): void => {
        if (Array.isArray(obj)) {
          for (const item of obj) {
            if (item && typeof item === "object") {
              keyframes += Array.isArray(item) ? item.length : 0;
              count(Object.values(item));
            }
          }
        } else if (obj && typeof obj === "object") {
          count(Object.values(obj));
        }
      };
      count(anim.bones ?? {});
      return { name, duration: anim.duration ?? 0, keyframes };
    });

    const constraints = {
      ik: (json.ik ?? []).map((c: any) => c.name),
      transform: (json.transform ?? []).map((c: any) => c.name),
      path: (json.path ?? []).map((c: any) => c.name),
    };

    return {
      success: true,
      message: `骨架概览：${bones.length} 骨骼 / ${slots.length} 插槽 / ${skinNames.length} 皮肤 / ${animations.length} 动画 / ${attachmentCount} 附件`,
      data: {
        skeleton: {
          name: json.skeleton?.name ?? "unknown",
          spine: json.skeleton?.spine ?? "unknown",
          width: json.skeleton?.width,
          height: json.skeleton?.height,
          images: json.skeleton?.images,
        },
        bones: {
          count: bones.length,
          roots,
          tree: bones.map((b: any) => ({ name: b.name, parent: b.parent ?? "root", children: childrenOf.get(b.name) ?? [], x: b.x ?? 0, y: b.y ?? 0, length: b.length ?? 0 })),
          roleSuggestions: roleSuggestion,
          unmapped,
        },
        slots,
        attachments: attachmentCount,
        skins: skinNames,
        animations,
        constraints,
        events: Object.keys(json.events ?? {}),
      },
    };
  }
}
