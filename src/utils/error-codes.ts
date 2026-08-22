/**
 * 错误码枚举与统一错误类
 * 所有工具抛出的错误都应转换为 SpineError，携带错误码 + 人类可读的中文提示 + 建议。
 */

/** 错误码枚举（对应 FINAL_SPEC 10.1） */
export enum ErrorCode {
  /** 未找到 Spine.com */
  SPINE_NOT_FOUND = "E_SPINE_NOT_FOUND",
  /** 版本不匹配（作为 warning，非致命） */
  VERSION_MISMATCH = "E_VERSION_MISMATCH",
  /** CLI 执行超时 */
  CLI_TIMEOUT = "E_CLI_TIMEOUT",
  /** JSON 解析失败 */
  JSON_PARSE = "E_JSON_PARSE",
  /** 骨骼不存在 */
  BONE_NOT_FOUND = "E_BONE_NOT_FOUND",
  /** 帧索引超出范围 */
  FRAME_OUT_OF_RANGE = "E_FRAME_OUT_OF_RANGE",
  /** 图片读取失败 */
  IMAGE_READ_FAILED = "E_IMAGE_READ_FAILED",
  /** 图片无透明通道 */
  IMAGE_NO_ALPHA = "E_IMAGE_NO_ALPHA",
  /** Cocos 项目路径无效 */
  COCOS_PATH_INVALID = "E_COCOS_PATH_INVALID",
  /** CLI 执行失败（非零退出码） */
  CLI_EXEC_FAILED = "E_CLI_EXEC_FAILED",
  /** 插槽不存在 */
  SLOT_NOT_FOUND = "E_SLOT_NOT_FOUND",
  /** 附件不存在 */
  ATTACHMENT_NOT_FOUND = "E_ATTACHMENT_NOT_FOUND",
  /** 约束不存在 */
  CONSTRAINT_NOT_FOUND = "E_CONSTRAINT_NOT_FOUND",
  /** 部件类型无效 */
  PART_TYPE_INVALID = "E_PART_TYPE_INVALID",
  /** 参数校验失败 */
  INVALID_ARGUMENT = "E_INVALID_ARGUMENT",
  /** 内部未知错误 */
  UNKNOWN = "E_UNKNOWN",
}

/**
 * 统一错误类。message 为用户可读的中文描述，suggestion 为可选建议。
 * 用法示例：
 *   throw new SpineError(ErrorCode.BONE_NOT_FOUND, "未找到骨骼", "请检查名称拼写");
 */
export class SpineError extends Error {
  readonly code: ErrorCode;
  readonly suggestion?: string;

  constructor(code: ErrorCode, message: string, suggestion?: string) {
    super(message);
    this.name = "SpineError";
    this.code = code;
    this.suggestion = suggestion;
  }

  /** 格式化为用户友好的多行文本 */
  toFriendlyString(): string {
    let out = `❌ 操作失败 (错误码: ${this.code})\n原因：${this.message}`;
    if (this.suggestion) {
      out += `\n建议：${this.suggestion}`;
    }
    return out;
  }
}

/** 将任意异常包装为 SpineError（保留已有 code） */
export function toSpineError(err: unknown): SpineError {
  if (err instanceof SpineError) {
    return err;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return new SpineError(ErrorCode.UNKNOWN, msg);
}
