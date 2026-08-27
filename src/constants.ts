/**
 * 全局常量定义
 */

/** 本服务器锁定支持的 Spine 版本（开发基准） */
export const SUPPORTED_SPINE_VERSION = "3.8.75";

/** Spine 命令行工具文件名（Windows） */
export const SPINE_EXE_NAME = "Spine.com";

/** CLI 执行默认超时（毫秒） */
export const DEFAULT_CLI_TIMEOUT_MS = 60000;

/** 默认日志级别 */
export const DEFAULT_LOG_LEVEL = "info";

/** 备份保留数量 */
export const MAX_BACKUPS = 10;

/** 日志级别枚举 */
export const LOG_LEVELS = ["error", "warn", "info", "debug"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** MCP 工具名称常量（全部 55 个，按 FINAL_SPEC 7.x 分类） */
export const TOOL_NAMES = {
  // 7.1 信息查询
  GET_PROJECT_INFO: "spine_get_project_info",
  INSPECT_JSON: "spine_inspect_json",
  DESCRIBE: "spine_describe",
  LIST_ANIMATIONS: "spine_list_animations",
  LIST_EVENTS: "spine_list_events",
  LIST_CONSTRAINTS: "spine_list_constraints",
  GET_ATTACHMENTS: "spine_get_attachments",
  GET_ANIMATION_DETAIL: "spine_get_animation_detail",
  RENDER_PREVIEW: "spine_render_preview",
  // 7.2 骨架结构
  CONTROL_BONE: "spine_control_bone",
  ADD_BONE: "spine_add_bone",
  DELETE_BONE: "spine_delete_bone",
  SET_BONE: "spine_set_bone",
  ADD_SLOT: "spine_add_slot",
  DELETE_SLOT: "spine_delete_slot",
  SET_SLOT: "spine_set_slot",
  RENAME_SLOT: "spine_rename_slot",
  BATCH_RENAME: "spine_batch_rename",
  // 7.3 附件与皮肤
  SET_ATTACHMENT: "spine_set_attachment",
  ADD_ATTACHMENT: "spine_add_attachment",
  DELETE_ATTACHMENT: "spine_delete_attachment",
  SET_ATTACHMENT_TRANSFORM: "spine_set_attachment_transform",
  EDIT_MESH: "spine_edit_mesh",
  SET_SKIN: "spine_set_skin",
  // 7.4 约束
  ADD_IK: "spine_add_ik",
  SET_IK: "spine_set_ik",
  DELETE_IK: "spine_delete_ik",
  ADD_TRANSFORM: "spine_add_transform",
  SET_TRANSFORM: "spine_set_transform",
  DELETE_TRANSFORM: "spine_delete_transform",
  ADD_PATH: "spine_add_path",
  SET_PATH: "spine_set_path",
  DELETE_PATH: "spine_delete_path",
  // 7.5 动画
  ADD_SIMPLE_ANIMATION: "spine_add_simple_animation",
  DUPLICATE_ANIMATION: "spine_duplicate_animation",
  DELETE_ANIMATION: "spine_delete_animation",
  RENAME_ANIMATION: "spine_rename_animation",
  SET_ANIMATION_SETTINGS: "spine_set_animation_settings",
  CONTROL_SLOT: "spine_control_slot",
  CONTROL_CONSTRAINT: "spine_control_constraint",
  ADD_EVENT_KEYFRAME: "spine_add_event_keyframe",
  SET_DRAW_ORDER: "spine_set_draw_order",
  SET_CURVE: "spine_set_curve",
  // 7.6 图片与图集
  SPLIT_ATLAS: "spine_split_atlas",
  REPACK_ATLAS: "spine_repack_atlas",
  IMPORT_IMAGE: "spine_import_image",
  EXPORT_VIDEO: "spine_export_video",
  // 7.7 骨骼构建
  BUILD_SKELETON: "spine_build_skeleton",
  // 7.8 导入导出与项目
  EXPORT_ANIMATION: "spine_export_animation",
  IMPORT_ANIMATION: "spine_import_animation",
  CLEAN_ANIMATION: "spine_clean_animation",
  CREATE_PROJECT: "spine_create_project",
  SCALE_PROJECT: "spine_scale_project",
  // 7.9 Cocos 集成与工具链
  LIST_COCOS_ASSETS: "spine_list_cocos_assets",
  VALIDATE_REFERENCES: "spine_validate_references",
  CUT_PARTS: "spine_cut_parts",
  ASSEMBLE: "spine_assemble",
  GENERATE_ANIMATION: "spine_generate_animation",
  LIST_EFFECTS: "spine_list_effects",
  APPLY_EFFECT: "spine_apply_effect",
  MIRROR_BONES: "spine_mirror_bones",
  MESH_WAVE: "spine_mesh_wave",
  IMPORT_SKIN: "spine_import_skin",
  POSE_ANIMATION: "spine_pose_to_animation",
  MIRROR_ANIMATION: "spine_mirror_animation",
  MIX_ANIMATIONS: "spine_mix_animations",
  CHECK_PROJECT: "spine_check_project",
  EXPORT_SHEET: "spine_export_sheet",
  PIPELINE: "spine_pipeline",
  ROLLBACK: "spine_rollback",
} as const;
