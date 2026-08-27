/**
 * 镜像补全服务：把骨架的左/右半结构镜像复制到对侧（装配后一键补全对称角色）。
 * - 命名规则：_l/_r、-l/-r、left/right、armL/armR、数字 1/2（thigh1↔thigh2）
 * - 镜像：x 取反、rotation 取反（绕 Y 轴镜像）；插槽与附件一并镜像（附件 x 取反）
 * - 不镜像动画时间轴（镜像后执行 generate_animation 会自动匹配左右侧）
 * - 不镜像约束（IK/Transform/Path），避免复杂依赖
 */
import { ErrorCode, SpineError } from "../utils/error-codes";
import { modifyProject } from "./modify-service";
import { sideOf } from "./animation-generate-service";

export interface MirrorOptions {
  /** 镜像方向：LtoR=把左侧补到右侧（默认）；RtoL=反之 */
  direction?: "LtoR" | "RtoL";
  /** 显式指定源骨骼（缺省自动检测带侧向标记的骨骼） */
  bones?: string[];
  /** 是否同时镜像插槽与附件（默认 true） */
  mirrorAttachments?: boolean;
}

export interface MirrorResult {
  bones: number;
  slots: number;
  attachments: number;
  mirrored: string[];
  skipped: string[];
}

/** 骨骼名 → 对侧名（无侧向标记返回 null） */
export function mirrorName(name: string): string | null {
  if (/^l[-_]/i.test(name)) return "r" + name.slice(1);
  if (/^r[-_]/i.test(name)) return "l" + name.slice(1);
  if (/^left[-_]/i.test(name)) return "right" + name.slice(4);
  if (/^right[-_]/i.test(name)) return "left" + name.slice(5);
  if (/_l$/i.test(name)) return name.replace(/_l$/i, "_r");
  if (/_r$/i.test(name)) return name.replace(/_r$/i, "_l");
  if (/-l$/i.test(name)) return name.replace(/-l$/i, "-r");
  if (/-r$/i.test(name)) return name.replace(/-r$/i, "-l");
  if (/left$/i.test(name)) return name.replace(/left$/i, "right");
  if (/right$/i.test(name)) return name.replace(/right$/i, "left");
  if (/L$/.test(name)) return name.slice(0, -1) + "R";
  if (/R$/.test(name)) return name.slice(0, -1) + "L";
  if (/(\d+)$/.test(name)) {
    const n = parseInt(name.match(/(\d+)$/)![1], 10);
    return name.replace(/(\d+)$/, String(n % 2 === 1 ? n + 1 : n - 1));
  }
  return null;
}

/** 镜像骨架 JSON（原地修改） */
export function mirrorJson(json: any, options: MirrorOptions = {}): MirrorResult {
  const direction = options.direction ?? "LtoR";
  const srcSide = direction === "LtoR" ? "L" : "R";
  const bones = json.bones ?? [];
  const boneNames = new Set(bones.map((b: any) => b.name));

  const sourceNames = options.bones
    ? options.bones
    : bones.filter((b: any) => sideOf(b.name) === srcSide && mirrorName(b.name) && mirrorName(b.name) !== b.name).map((b: any) => b.name);

  const newNameSet = new Set(sourceNames.map((n: string) => mirrorName(n)!));
  const mirrored: string[] = [];
  const skipped: string[] = [];
  let slotsCount = 0, attCount = 0;

  for (const src of sourceNames) {
    const dst = mirrorName(src)!;
    if (boneNames.has(dst)) {
      skipped.push(dst);
      continue;
    }
    const sb = bones.find((b: any) => b.name === src);
    if (!sb) continue;

    // 父骨骼：若父骨骼有对侧且将被镜像，则指向对侧；否则保留原父（或无父则 root）
    let parent = sb.parent;
    if (parent) {
      const mp = mirrorName(parent);
      if (mp && mp !== parent && newNameSet.has(mp)) parent = mp;
      if (!boneNames.has(parent) && !newNameSet.has(parent)) parent = "root";
    }
    bones.push({
      name: dst,
      parent: parent ?? "root",
      length: sb.length ?? 0,
      x: -((sb.x ?? 0)),
      y: sb.y ?? 0,
      rotation: -((sb.rotation ?? 0)),
      scaleX: sb.scaleX ?? 1,
      scaleY: sb.scaleY ?? 1,
      shearX: sb.shearX ?? 0,
      shearY: sb.shearY ?? 0,
    });
    boneNames.add(dst);
    mirrored.push(dst);

    if (options.mirrorAttachments !== false) {
      const srcSlots = (json.slots ?? []).filter((s: any) => s.bone === src);
      for (const s of srcSlots) {
        const newSlotName = mirrorName(s.name) ?? `${dst}-slot`;
        if ((json.slots ?? []).some((x: any) => x.name === newSlotName)) continue;
        json.slots.push({
          name: newSlotName,
          bone: dst,
          order: s.order ?? 0,
          ...(s.attachment ? { attachment: mirrorName(s.attachment) ?? s.attachment } : {}),
        });
        slotsCount++;
        // 皮肤附件镜像
        const skins: any[] = Array.isArray(json.skins) ? json.skins : Object.entries(json.skins ?? {}).map(([name, v]) => ({ name, attachments: v }));
        for (const skin of skins) {
          const atts = skin.attachments?.[s.name];
          if (!atts) continue;
          const newAtts: Record<string, any> = {};
          for (const [attName, att] of Object.entries<any>(atts)) {
            if (!att || typeof att !== "object") continue;
            const newAttName = mirrorName(attName) ?? attName;
            newAtts[newAttName] = { ...att, x: -((att.x ?? 0)), y: att.y ?? 0 };
            attCount++;
          }
          skin.attachments ??= {};
          skin.attachments[newSlotName] = newAtts;
        }
      }
    }
  }

  if (!mirrored.length && !skipped.length) {
    throw new SpineError(
      ErrorCode.INVALID_ARGUMENT,
      "未找到可镜像的骨骼。",
      `请确认骨架使用侧向命名（如 arm_l/armL/thigh1），或用 bones 参数显式指定。当前检测侧：${srcSide}。`
    );
  }

  return { bones: mirrored.length, slots: slotsCount, attachments: attCount, mirrored, skipped };
}

/** 对 .spine 项目执行镜像（自动备份） */
export async function mirrorSkeleton(projectPath: string, options: MirrorOptions = {}): Promise<MirrorResult & { backupPath?: string }> {
  let result!: MirrorResult;
  const r = await modifyProject(projectPath, (json) => {
    result = mirrorJson(json, options);
  });
  return { ...result, backupPath: r.backupPath };
}
