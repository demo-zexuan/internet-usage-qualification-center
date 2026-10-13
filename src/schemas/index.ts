/**
 * Schema 统一出口
 *
 * @module schemas
 * @author zexuan.peng
 * @created 2026-10-14
 */

export {
  collectIssues,
  formatIssuePath,
  parseWithSchema,
  safeJsonParse,
  type ValidationFailure,
  type ValidationIssue,
} from './validation';

export {
  QUESTION_BANK_SCHEMA_VERSION,
  SUPPORTED_QUESTION_BANK_SCHEMA_VERSIONS,
  checkBankCapacity,
  computeQuestionBankStats,
  normalizeQuestionView,
  parseQuestionBankStrict,
  validateQuestionBank,
  type BankCapacityRequirement,
  type BankCapacityResult,
  type NormalizedQuestionView,
  type QuestionBankValidationOutcome,
} from './question-bank.schema';

export {
  EXAM_RULES_SCHEMA_VERSION,
  SUPPORTED_EXAM_RULES_SCHEMA_VERSIONS,
  findExamRule,
  parseExamRulesStrict,
  validateExamRules,
  type ExamRulesValidationOutcome,
} from './exam-rules.schema';

export {
  LEVEL_BADGE_TOKENS,
  LEVELS_SCHEMA_VERSION,
  SUPPORTED_LEVELS_SCHEMA_VERSIONS,
  parseLevelsStrict,
  validateLevels,
  type LevelsValidationOutcome,
} from './levels.schema';

export {
  PERMISSIONS_SCHEMA_VERSION,
  SUPPORTED_PERMISSIONS_SCHEMA_VERSIONS,
  parsePermissionsStrict,
  validatePermissions,
  type PermissionsValidationOutcome,
} from './permissions.schema';

export {
  CERTIFICATE_NUMBER_PATTERN,
  CERTIFICATE_RECORD_SCHEMA_VERSION,
  CERTIFICATE_TEMPLATE_SCHEMA_VERSION,
  SUPPORTED_CERTIFICATE_TEMPLATE_VERSIONS,
  validateCertificateRecord,
  validateCertificateTemplate,
} from './certificate.schema';

export {
  ANNOUNCEMENTS_SCHEMA_VERSION,
  STUDY_MATERIALS_SCHEMA_VERSION,
  validateAnnouncements,
  validateStudyMaterials,
} from './settings.schema';
