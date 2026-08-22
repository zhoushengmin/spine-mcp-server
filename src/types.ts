/**
 * 全局类型定义（Spine 3.8.75 数据结构）
 * 对应 FINAL_SPEC 第 6 节
 */

/** Spine 项目核心元数据 */
export interface SpineProjectInfo {
  /** Spine 版本（如 3.8.75），从 skeleton.spine 读取 */
  version: string;
  /** 骨架名称（来自 Info 命令，.spine 才有） */
  skeletonName?: string;
  bones: BoneInfo[];
  slots: SlotInfo[];
  skins: SkinInfo[];
  animations: AnimationInfo[];
  /** 事件名列表 */
  events: string[];
  /** 引用的纹理路径/目录 */
  images?: string;
  /** 项目尺寸（来自 Info 命令） */
  size?: { width: number; height: number };
  /** 帧率（来自 Info 命令） */
  fps?: number;
  /** 版本兼容性警告（非 3.8.75 时填充） */
  compatibilityWarning?: string;
}

export interface BoneInfo {
  name: string;
  parent?: string;
  length: number;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  shearX: number;
  shearY: number;
  /** 变换模式：normal|onlyTranslation|noRotationOrReflection|noScale|noScaleOrReflection */
  transform?: string;
  color?: string;
  /** 子骨骼（getBoneTree 填充） */
  children?: BoneInfo[];
}

export interface SlotInfo {
  name: string;
  bone: string;
  /** 默认附件 */
  attachment?: string;
  /** 颜色 RRGGBBAA */
  color?: string;
  /** 混合模式：normal|additive|multiply|screen */
  blend?: string;
}

export interface SkinInfo {
  name: string;
  /** 该皮肤下每个插槽的附件名列表 */
  attachments: Record<string, string[]>;
}

export interface AnimationInfo {
  name: string;
  /** 时长（秒，由最大关键帧时间推算） */
  duration: number;
  /** 关键帧总数（所有时间轴） */
  keyframeCount: number;
}

/** Info 命令结构化输出 */
export interface SpineInfoData {
  projectPath: string;
  /** 项目文件版本 */
  version: string;
  fps: number;
  skeletonName: string;
  size: { width: number; height: number };
  bones: string[];
  slots: string[];
  skins: string[];
  events: string[];
  animations: string[];
}

/** 导出格式 */
export type ExportFormat = "json" | "binary" | "texture" | "video";

/** 导出选项（对应 CLI 导出设置 JSON） */
export interface ExportOptions {
  format: ExportFormat;
  /** 是否包含非必要数据（默认 true） */
  nonessential?: boolean;
  /** 是否格式化（仅 json，默认 true） */
  prettyPrint?: boolean;
  /** 输出文件名扩展名，缺省按格式自动推断 */
  extension?: string;
  // ---- 图片/视频导出专用 ----
  fps?: number;
  frameCount?: number;
  width?: number;
  height?: number;
  loop?: boolean;
}

/** 导入选项 */
export interface ImportOptions {
  /** 骨架名（不填则从 Info 命令自动获取） */
  skeletonName?: string;
  /** 是否在导入前自动备份（默认 true） */
  backup?: boolean;
}

/** 骨骼关键帧修改内容 */
export interface BoneKeyframeChange {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  shearX?: number;
  shearY?: number;
}

/** MCP 工具调用的统一返回结构 */
export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
  warning?: string;
  errorCode?: string;
}
