/**
 * 工具注册表：集中实例化全部工具（Phase 3 基础 + Phase 4 高级 = 50 个）
 * 剩余 Phase 5/6：split_atlas / repack_atlas / build_skeleton / list_cocos_assets / validate_references
 */
import { ToolDefinition } from "./base.tool";
import { GetProjectInfoTool } from "./info.tool";
import { InspectJsonTool } from "./inspect.tool";
import { ListAnimationsTool } from "./list-animations.tool";
import { ListEventsTool } from "./list-events.tool";
import { ListConstraintsTool } from "./list-constraints.tool";
import { GetAttachmentsTool } from "./get-attachments.tool";
import { GetAnimationDetailTool } from "./get-animation-detail.tool";
import { RenderPreviewTool } from "./render-preview.tool";
import { BonesControlTool } from "./bones-control.tool";
import { AddBoneTool } from "./add-bone.tool";
import { DeleteBoneTool } from "./delete-bone.tool";
import { SetBoneTool } from "./set-bone.tool";
import { AddSlotTool } from "./add-slot.tool";
import { DeleteSlotTool } from "./delete-slot.tool";
import { SetSlotTool } from "./set-slot.tool";
import { RenameSlotTool } from "./rename-slot.tool";
import { BatchRenameTool } from "./batch-rename.tool";
import { SetAttachmentTool } from "./set-attachment.tool";
import { AddAttachmentTool } from "./add-attachment.tool";
import { DeleteAttachmentTool } from "./delete-attachment.tool";
import { SetAttachmentTransformTool } from "./set-attachment-transform.tool";
import { EditMeshTool } from "./edit-mesh.tool";
import { SetSkinTool } from "./set-skin.tool";
import { AddIkTool } from "./add-ik.tool";
import { SetIkTool } from "./set-ik.tool";
import { DeleteIkTool } from "./delete-ik.tool";
import { AddTransformTool } from "./add-transform.tool";
import { SetTransformTool } from "./set-transform.tool";
import { DeleteTransformTool } from "./delete-transform.tool";
import { AddPathTool } from "./add-path.tool";
import { SetPathTool } from "./set-path.tool";
import { DeletePathTool } from "./delete-path.tool";
import { ExportAnimationTool } from "./export.tool";
import { ImportAnimationTool } from "./import.tool";
import { CleanAnimationTool } from "./clean.tool";
import { AddSimpleAnimationTool } from "./animation-generate.tool";
import { DuplicateAnimationTool } from "./duplicate-animation.tool";
import { DeleteAnimationTool } from "./delete-animation.tool";
import { RenameAnimationTool } from "./rename-animation.tool";
import { SetAnimationSettingsTool } from "./set-animation-settings.tool";
import { ControlSlotTool } from "./control-slot.tool";
import { ControlConstraintTool } from "./control-constraint.tool";
import { AddEventKeyframeTool } from "./add-event-keyframe.tool";
import { SetDrawOrderTool } from "./set-draw-order.tool";
import { SetCurveTool } from "./set-curve.tool";
import { CreateProjectTool } from "./create-project.tool";
import { ScaleProjectTool } from "./scale-project.tool";
import { ImportImageTool } from "./import-image.tool";
import { ExportVideoTool } from "./export-video.tool";
import { RollbackTool } from "./rollback.tool";

/** 全部已注册工具（Phase 3 + Phase 4 = 50 个） */
export const allTools: ToolDefinition[] = [
  // —— 信息查询 ——
  new GetProjectInfoTool(),
  new InspectJsonTool(),
  new ListAnimationsTool(),
  new ListEventsTool(),
  new ListConstraintsTool(),
  new GetAttachmentsTool(),
  new GetAnimationDetailTool(),
  new RenderPreviewTool(),
  // —— 骨架结构 ——
  new BonesControlTool(),
  new AddBoneTool(),
  new DeleteBoneTool(),
  new SetBoneTool(),
  new AddSlotTool(),
  new DeleteSlotTool(),
  new SetSlotTool(),
  new RenameSlotTool(),
  new BatchRenameTool(),
  // —— 附件与皮肤 ——
  new SetAttachmentTool(),
  new AddAttachmentTool(),
  new DeleteAttachmentTool(),
  new SetAttachmentTransformTool(),
  new EditMeshTool(),
  new SetSkinTool(),
  // —— 约束 ——
  new AddIkTool(),
  new SetIkTool(),
  new DeleteIkTool(),
  new AddTransformTool(),
  new SetTransformTool(),
  new DeleteTransformTool(),
  new AddPathTool(),
  new SetPathTool(),
  new DeletePathTool(),
  // —— 导入导出与项目 ——
  new ExportAnimationTool(),
  new ImportAnimationTool(),
  new CleanAnimationTool(),
  new CreateProjectTool(),
  new ScaleProjectTool(),
  // —— 动画 ——
  new AddSimpleAnimationTool(),
  new DuplicateAnimationTool(),
  new DeleteAnimationTool(),
  new RenameAnimationTool(),
  new SetAnimationSettingsTool(),
  new ControlSlotTool(),
  new ControlConstraintTool(),
  new AddEventKeyframeTool(),
  new SetDrawOrderTool(),
  new SetCurveTool(),
  // —— 图片与工具链 ——
  new ImportImageTool(),
  new ExportVideoTool(),
  new RollbackTool(),
];

/** 工具名 → 定义 映射（便于查找） */
export const toolMap: Record<string, ToolDefinition> = Object.fromEntries(allTools.map((t) => [t.name, t]));
