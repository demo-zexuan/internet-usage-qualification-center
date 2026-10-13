/**
 * 应用元信息与机构声明
 *
 * I. 集中管理
 *
 * 1. 机构名称、版本号与免责声明集中在此，页脚、证件与关于页面共用同一来源
 * 2. 版本号与 package.json 保持同步，构建说明中会要求同步更新
 *
 * II. 免责声明
 *
 * 1. 本项目为虚构的娱乐性质考试系统，所有等级、证件与网络权限均不具有现实法律效力
 * 2. 该声明必须在页脚与证件页面完整展示，不得省略或弱化
 *
 * @module app/app-meta
 * @author zexuan.peng
 * @created 2026-10-14
 */

/** 机构中文名称 */
export const APP_NAME_ZH = '互联网使用资格考试中心';

/** 机构英文名称 */
export const APP_NAME_EN = 'Internet Usage Qualification Authority';

/** 机构英文缩写 */
export const APP_ABBR = 'IUQA';

/** 应用版本号 */
export const APP_VERSION = '0.1.0';

/** 本地数据版本号 */
export const APP_DATA_VERSION = '1.0.0';

/** 机构使命说明 */
export const APP_MISSION =
  '本中心负责建立互联网使用能力的标准化考核与资格分级制度，通过统一的考试、评级与证件管理，为公众提供可参照的互联网使用素养基准。';

/** 机构理念 */
export const APP_MOTTO = '互联网不是没有交通规则的高速公路。';

/** 页脚机构声明 */
export const INSTITUTION_STATEMENT = [
  '互联网使用资格考试中心（IUQA）为虚构机构，本系统为演示与教学用途的纯前端应用。',
  '全部等级、证件、权限与模拟功能均为应用内设定，不具有现实法律效力，也不构成任何行政许可、职业资格或专业资质。',
  '本系统不收集、不上传任何个人数据，全部档案与考试记录仅保存在使用者本机浏览器中。',
];

/** 关于纯前端边界的完整声明 */
export const FRONTEND_BOUNDARY_STATEMENT =
  '本系统的全部权限均为应用内的模拟授权，只影响本站点的模拟页面、徽章、菜单与交互。IUQA 无法、也不会控制使用者设备的真实网络连接、系统代理设置或对任何真实网站的访问，亦不提供任何 VPN 客户端、配置或连接能力。';
