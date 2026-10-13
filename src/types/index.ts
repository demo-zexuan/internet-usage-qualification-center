/**
 * 类型统一出口
 *
 * 各模块统一从 `@/types` 导入类型，避免出现深路径引用散落各处。
 *
 * @module types
 * @author zexuan.peng
 * @created 2026-10-14
 */

export type {
  AppError,
  AppErrorCode,
  DataSource,
  PageQuery,
  PageResult,
  Result,
  VersionedRecord,
} from './common';
export { err, ok } from './common';

export type {
  AnswerSpec,
  Difficulty,
  KeyAnswerSpec,
  PartialCreditSpec,
  PointsAnswerSpec,
  QuestionBank,
  QuestionBankMeta,
  QuestionBankRecord,
  QuestionBankStats,
  QuestionCategory,
  QuestionOption,
  QuestionScoringSpec,
  QuestionType,
  RawQuestion,
  SelectionMode,
} from './question';
export {
  DIFFICULTY_LABELS,
  QUESTION_CATEGORIES,
  QUESTION_CATEGORY_LABELS,
  QUESTION_TYPES,
  QUESTION_TYPE_HINTS,
  QUESTION_TYPE_LABELS,
} from './question';

export type {
  AnswerVisibility,
  AttemptStatus,
  EligibilityResult,
  ExamAttempt,
  ExamCatalogItem,
  ExamCategory,
  ExamEligibility,
  ExamMode,
  ExamPaper,
  ExamResult,
  ExamRule,
  ExamRulesConfig,
  ExamRulesRecord,
  ExamRuleSnapshot,
  PaperBankRef,
  PaperGenerationMode,
  PaperGenerationSpec,
  PaperOption,
  PaperQuestion,
  PaperQuota,
  QuestionResult,
  ResolvedQuestionScoring,
  ResolvedScoringMode,
  RoundingMode,
  ScoringPolicy,
  SubmitReason,
} from './exam';
export {
  ANSWER_VISIBILITY_LABELS,
  EXAM_CATEGORIES,
  EXAM_CATEGORY_LABELS,
  EXAM_MODE_LABELS,
  ROUNDING_LABELS,
  SUBMIT_REASON_LABELS,
} from './exam';

export type { LevelDefinition, LevelsConfig, LevelsRecord } from './level';

export type {
  PermissionContext,
  PermissionDefinition,
  PermissionGroup,
  PermissionState,
  PermissionsConfig,
  PermissionsRecord,
} from './permission';
export { PERMISSION_GROUPS, PERMISSION_GROUP_LABELS } from './permission';

export type {
  CertificateNumberParts,
  CertificateRecord,
  CertificateStatus,
  CertificateTemplate,
  CertificateVerificationGraphic,
} from './certificate';
export { CERTIFICATE_STATUSES, CERTIFICATE_STATUS_LABELS } from './certificate';

export type {
  NextLevelRequirement,
  UserProfileRecord,
  UserProfileSummary,
} from './user';

export type { AuditEventRecord, AuditEventType, AuditQuery } from './audit';
export { AUDIT_EVENT_LABELS, AUDIT_EVENT_TYPES } from './audit';

export type {
  AnnouncementDefinition,
  AnnouncementsConfig,
  AppSettingKey,
  AppSettingRecord,
  AppSettingValueMap,
  StudyMaterialDefinition,
  StudyMaterialsConfig,
} from './settings';
