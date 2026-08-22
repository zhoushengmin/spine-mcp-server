/**
 * 工具注册表：集中实例化全部工具（Phase 3：21 个基础工具）
 */
import { ToolDefinition } from "./base.tool";
import { GetProjectInfoTool } from "./info.tool";
import { InspectJsonTool } from "./inspect.tool";
import { ListAnimationsTool } from "./list-animations.tool";
import { ExportAnimationTool } from "./export.tool";
import { ImportAnimationTool } from "./import.tool";
import { CleanAnimationTool } from "./clean.tool";
import { BonesControlTool } from "./bones-control.tool";
import { AddSimpleAnimationTool } from "./animation-generate.tool";
import { RenameSlotTool } from "./rename-slot.tool";
import { BatchRenameTool } from "./batch-rename.tool";
import { AddBoneTool } from "./add-bone.tool";
import { DeleteBoneTool } from "./delete-bone.tool";
import { AddSlotTool } from "./add-slot.tool";
import { DeleteSlotTool } from "./delete-slot.tool";
import { SetAttachmentTool } from "./set-attachment.tool";
import { SetSkinTool } from "./set-skin.tool";
import { DuplicateAnimationTool } from "./duplicate-animation.tool";
import { DeleteAnimationTool } from "./delete-animation.tool";
import { RenameAnimationTool } from "./rename-animation.tool";
import { RollbackTool } from "./rollback.tool";
import { RenderPreviewTool } from "./render-preview.tool";

/** 全部已注册工具（Phase 3） */
export const allTools: ToolDefinition[] = [
  new GetProjectInfoTool(),
  new InspectJsonTool(),
  new ListAnimationsTool(),
  new RenderPreviewTool(),
  new BonesControlTool(),
  new AddBoneTool(),
  new DeleteBoneTool(),
  new AddSlotTool(),
  new DeleteSlotTool(),
  new RenameSlotTool(),
  new BatchRenameTool(),
  new SetAttachmentTool(),
  new SetSkinTool(),
  new ExportAnimationTool(),
  new ImportAnimationTool(),
  new CleanAnimationTool(),
  new AddSimpleAnimationTool(),
  new DuplicateAnimationTool(),
  new DeleteAnimationTool(),
  new RenameAnimationTool(),
  new RollbackTool(),
];

/** 工具名 → 定义 映射（便于查找） */
export const toolMap: Record<string, ToolDefinition> = Object.fromEntries(allTools.map((t) => [t.name, t]));
