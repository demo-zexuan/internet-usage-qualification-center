/**
 * 路由配置
 *
 * I. 路由表
 *
 * 1. 业务路由：首页、档案、报名、须知、答题、成绩、证件、权限、历史、题库管理
 * 2. 模拟路由：模拟浏览专区、模拟讨论区、跨域信息访问专区、VPN 知识专区、学习材料
 * 3. 兜底路由：非法地址与非法路由参数统一进入 404 页面
 *
 * II. 布局
 *
 * 1. 全部路由共用 AppLayout；答题页在布局内自动切换为专注模式
 *
 * @module app/router
 * @author zexuan.peng
 * @created 2026-10-14
 */

import * as React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { AdminPage } from '@/pages/AdminPage';
import { CertificateListPage } from '@/pages/CertificateListPage';
import { CertificatePage } from '@/pages/CertificatePage';
import { DiscussionSimulatorPage } from '@/pages/DiscussionSimulatorPage';
import { ExamInProgressPage } from '@/pages/ExamInProgressPage';
import { ExamInstructionsPage } from '@/pages/ExamInstructionsPage';
import { ExamListPage } from '@/pages/ExamListPage';
import { ExamResultPage } from '@/pages/ExamResultPage';
import { ExamTakingPage } from '@/pages/ExamTakingPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PermissionsPage } from '@/pages/PermissionsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SimulatorPage } from '@/pages/SimulatorPage';
import { StudyMaterialsPage } from '@/pages/StudyMaterialsPage';
import { ZonePage } from '@/pages/ZonePage';

/** 应用路由 */
export function AppRouter(): React.ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          {/* I. 业务路由 */}
          <Route index element={<HomePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="exams" element={<ExamListPage />} />
          <Route path="exams/:examId/instructions" element={<ExamInstructionsPage />} />

          <Route path="exam" element={<ExamInProgressPage />} />
          <Route path="exam/:attemptId" element={<ExamTakingPage />} />
          <Route path="results/:attemptId" element={<ExamResultPage />} />

          <Route path="certificates" element={<CertificateListPage />} />
          <Route path="certificate/:certificateId" element={<CertificatePage />} />

          <Route path="permissions" element={<PermissionsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="admin" element={<AdminPage />} />

          {/* II. 模拟功能路由 */}
          <Route path="simulator" element={<SimulatorPage />} />
          <Route path="simulator/discussion" element={<DiscussionSimulatorPage />} />
          <Route path="zone/overseas" element={<ZonePage kind="overseas" />} />
          <Route path="zone/vpn" element={<ZonePage kind="vpn" />} />
          <Route path="materials" element={<StudyMaterialsPage />} />

          {/* III. 兼容与兜底 */}
          <Route path="exams/:examId" element={<Navigate to="instructions" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
