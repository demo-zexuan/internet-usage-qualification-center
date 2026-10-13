/**
 * 本地档案表单
 *
 * I. 字段设计
 *
 * 1. 仅收集昵称与可选头像，不收集身份证号、真实住址等无必要敏感信息
 * 2. 头像以 DataURL 形式保存在本机 IndexedDB，不上传任何服务器
 *
 * II. 校验
 *
 * 1. 昵称必填且长度受限，错误提示与控件通过 aria-describedby 关联
 * 2. 头像大小超限时给出明确提示，避免写入超大二进制数据
 *
 * @module components/forms/profile-form
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { ImagePlus, Trash2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import {
  AVATAR_MAX_BYTES,
  DISPLAY_NAME_MAX_LENGTH,
  validateDisplayName,
} from '@/features/profile/service';
import { formatFileSize } from '@/utils/format';

/** 档案表单属性 */
export interface ProfileFormProps {
  /** 初始昵称 */
  initialName?: string;
  /** 初始头像 */
  initialAvatar?: string | null;
  /** 提交按钮文案 */
  submitLabel?: string;
  /** 提交回调 */
  onSubmit: (values: { displayName: string; avatarDataUrl: string | null }) => void | Promise<void>;
  /** 是否处于提交中 */
  pending?: boolean;
  /** 提交失败的说明 */
  error?: string | null;
  /** 是否展示头像字段 */
  showAvatar?: boolean;
}

/** 读取图片文件为 DataURL */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取图片文件失败'));
    reader.readAsDataURL(file);
  });
}

/** 本地档案表单 */
export function ProfileForm({
  initialName = '',
  initialAvatar = null,
  submitLabel = '建立本地档案',
  onSubmit,
  pending = false,
  error = null,
  showAvatar = true,
}: ProfileFormProps): React.ReactElement {
  const [displayName, setDisplayName] = React.useState(initialName);
  const [avatarDataUrl, setAvatarDataUrl] = React.useState<string | null>(initialAvatar);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const validationError = validateDisplayName(displayName);
    setNameError(validationError);

    if (validationError) {
      return;
    }

    void onSubmit({ displayName: displayName.trim(), avatarDataUrl });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAvatarError('请选择图片文件（PNG / JPEG / WebP）。');
      return;
    }

    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError(`图片大小不能超过 ${formatFileSize(AVATAR_MAX_BYTES)}。`);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarDataUrl(dataUrl);
      setAvatarError(null);
    } catch {
      setAvatarError('图片读取失败，请更换文件后重试。');
    } finally {
      // 清空 input，保证同一文件可以重复选择
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Field
        label="考生姓名或昵称"
        htmlFor="displayName"
        required
        hint={`用于证件与成绩单展示，最多 ${DISPLAY_NAME_MAX_LENGTH} 个字符。可随时修改。`}
        error={nameError}
      >
        <Input
          id="displayName"
          name="displayName"
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
            if (nameError) {
              setNameError(null);
            }
          }}
          maxLength={DISPLAY_NAME_MAX_LENGTH + 8}
          autoComplete="nickname"
          placeholder="例如：张三"
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? 'displayName-error' : 'displayName-hint'}
        />
      </Field>

      {showAvatar ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">头像（可选）</span>

          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-muted">
              {avatarDataUrl ? (
                <img src={avatarDataUrl} alt="已选择的头像预览" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-6 w-6 text-ink-faint" aria-hidden="true" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                选择图片
              </Button>
              {avatarDataUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAvatarDataUrl(null)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  移除头像
                </Button>
              ) : null}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              void handleFileChange(event);
            }}
            aria-label="选择头像图片"
          />

          {avatarError ? (
            <p role="alert" className="text-xs font-medium text-fail">
              {avatarError}
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-ink-faint">
              头像仅保存在本机浏览器中，不会上传到任何服务器。建议使用 512×512 以内的图片。
            </p>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs font-medium text-fail">
          {error}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending} size="lg">
          {pending ? '正在写入本地数据库…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
