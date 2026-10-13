/**
 * 站点导航配置
 *
 * I. 单一来源
 *
 * 1. 顶部导航、侧边业务导航与移动端底部导航共用本文件的配置，避免三处各写一份
 * 2. 带 `permissionId` 的条目由权限引擎判定是否可进入，不使用页面隐藏代替权限判定
 *
 * @module app/navigation
 * @author zexuan.peng
 * @created 2026-10-14
 */

import {
  BookOpenCheck,
  Compass,
  FileBadge,
  Gauge,
  History,
  Home,
  IdCard,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** 导航条目 */
export interface NavItem {
  /** 路由路径 */
  to: string;
  /** 中文标签 */
  label: string;
  /** 一句话说明，用于侧边导航的辅助文字与移动端菜单 */
  description: string;
  icon: LucideIcon;
  /** 需要的权限 ID；为空表示所有状态均可进入 */
  permissionId?: string;
  /** 是否在移动端底部导航中展示 */
  mobile?: boolean;
  /** 是否在顶部主导航中展示 */
  primary?: boolean;
}

/** 顶部主导航 */
export const PRIMARY_NAV: NavItem[] = [
  {
    to: '/',
    label: '首页',
    description: '考试业务门户与资格状态总览',
    icon: Home,
    primary: true,
  },
  {
    to: '/exams',
    label: '考试报名',
    description: '查看可参加的考试并报名',
    icon: BookOpenCheck,
    primary: true,
  },
  {
    to: '/permissions',
    label: '权限中心',
    description: '查看当前等级对应的模拟互联网权限',
    icon: ShieldCheck,
    primary: true,
  },
  {
    to: '/history',
    label: '考试历史',
    description: '查询历次考试记录与历史证件',
    icon: History,
    primary: true,
  },
];

/** 侧边业务导航 */
export const BUSINESS_NAV: NavItem[] = [
  {
    to: '/',
    label: '业务首页',
    description: '资格状态与待办事项',
    icon: Home,
    mobile: true,
  },
  {
    to: '/profile',
    label: '我的档案',
    description: '考生信息与本地数据管理',
    icon: IdCard,
    mobile: true,
  },
  {
    to: '/exams',
    label: '考试报名',
    description: '报名条件与考试入口',
    icon: BookOpenCheck,
    mobile: true,
  },
  {
    to: '/exam',
    label: '在线考试',
    description: '进行中的考试入口',
    icon: Gauge,
  },
  {
    to: '/certificates',
    label: '电子证件',
    description: '证件展示、打印与下载',
    icon: FileBadge,
  },
  {
    to: '/permissions',
    label: '权限中心',
    description: '模拟权限清单与升级建议',
    icon: ShieldCheck,
    mobile: true,
  },
  {
    to: '/history',
    label: '考试历史',
    description: '历史成绩与答卷复核',
    icon: History,
    mobile: true,
  },
  {
    to: '/simulator',
    label: '模拟浏览专区',
    description: '本平台自建的模拟浏览与检索演示',
    icon: Compass,
    permissionId: 'simulated_browsing_trial',
  },
  {
    to: '/materials',
    label: '学习材料',
    description: '考前学习材料与自查问题',
    icon: Sparkles,
  },
  {
    to: '/admin',
    label: '题库管理',
    description: '题库与考试规则的本地管理',
    icon: Settings2,
  },
];

/** 移动端底部导航（最多五项，保证单手可点） */
export const MOBILE_NAV: NavItem[] = BUSINESS_NAV.filter((item) => item.mobile).slice(0, 5);
