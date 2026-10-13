/**
 * 题库管理与制度配置页
 *
 * I. 定位
 *
 * 1. 本页面是**本地配置管理工具**，不是服务器管理后台
 * 2. 纯前端项目不构成安全边界：熟悉开发者工具的使用者可以绕过本页面直接修改本地数据
 * 3. 本地管理模式开关只是界面便利功能，不提供任何真实权限控制
 *
 * II. 结构
 *
 * 1. 本地管理模式开关与安全边界声明
 * 2. 题库管理：导入、导出、校验、预览、统计、启用与恢复内置
 * 3. 考试规则：导入、导出、恢复内置与启用切换
 * 4. 数据管理：版本信息、操作历史与清除本地数据
 *
 * @module pages/AdminPage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { Settings2, ShieldOff } from 'lucide-react';
import * as React from 'react';

import { useConfig } from '@/app/config-context';
import { BankPanel } from '@/components/admin/bank-panel';
import { DataPanel } from '@/components/admin/data-panel';
import { RulesPanel } from '@/components/admin/rules-panel';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/choice';
import { Alert } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { setSetting } from '@/services/database';

/** 题库管理与制度配置页 */
export function AdminPage(): React.ReactElement {
  const { settings, banks, rulesConfig } = useConfig();
  const { toast } = useToast();

  const [enabled, setEnabled] = React.useState(settings.adminMode);

  // 设置从数据库读回后同步到本地开关，保证刷新后状态一致
  React.useEffect(() => {
    setEnabled(settings.adminMode);
  }, [settings.adminMode]);

  const handleToggle = async (checked: boolean): Promise<void> => {
    setEnabled(checked);
    await setSetting('adminMode', checked);
    toast({
      title: checked ? '已开启本地管理模式' : '已关闭本地管理模式',
      description: checked
        ? '管理功能已展开。请注意：该开关不构成任何安全边界。'
        : '管理功能已折叠为只读说明。',
      tone: 'info',
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="制度配置"
        title="题库管理与制度配置"
        description="本页面用于管理当前浏览器内的题库与考试制度配置。本系统为纯前端应用，全部配置均保存在本机，不涉及任何服务器。"
        actions={
          <>
            <Badge variant="neutral">{banks.length} 个题库</Badge>
            <Badge variant="outline">{rulesConfig.exams.length} 场考试</Badge>
          </>
        }
      />

      {/* I. 管理模式开关 */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <label
            htmlFor="admin-mode"
            className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-surface-muted px-3.5 py-3"
          >
            <Checkbox
              id="admin-mode"
              checked={enabled}
              onCheckedChange={(checked) => void handleToggle(checked === true)}
              className="mt-0.5"
              data-testid="admin-mode-toggle"
            />
            <span className="text-[13px] leading-relaxed text-ink">
              开启本地管理模式
              <span className="mt-0.5 block text-[12px] text-ink-faint">
                开启后可执行题库与规则的导入、导出、删除与清除数据等操作。
                该开关只是界面便利功能，不是权限边界。
              </span>
            </span>
          </label>

          <Alert tone="warning" title="安全边界声明">
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                本页面不是服务器管理后台，也不构成任何安全边界。本系统没有后端、没有账号体系，
                无法对使用者身份进行任何验证。
              </li>
              <li>
                熟悉浏览器开发者工具的使用者可以绕过本页面直接修改 IndexedDB 中的数据、
                修改前端代码或替换题库文件。本中心不对此作出安全承诺。
              </li>
              <li>
                因此，本机保存的成绩与证件记录不具备可被第三方信任的性质，
                仅适用于演示、教学与个人练习。
              </li>
            </ul>
          </Alert>
        </CardContent>
      </Card>

      {/* II. 管理功能 */}
      {enabled ? (
        <Tabs defaultValue="banks">
          <TabsList>
            <TabsTrigger value="banks">
              <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
              题库管理
            </TabsTrigger>
            <TabsTrigger value="rules">考试规则</TabsTrigger>
            <TabsTrigger value="data">数据管理</TabsTrigger>
          </TabsList>

          <TabsContent value="banks">
            <BankPanel />
          </TabsContent>

          <TabsContent value="rules">
            <RulesPanel />
          </TabsContent>

          <TabsContent value="data">
            <DataPanel />
          </TabsContent>
        </Tabs>
      ) : (
        <Alert tone="info" title="本地管理模式当前已关闭">
          <p className="mt-1 flex items-start gap-2">
            <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              勾选上方「开启本地管理模式」后，将显示题库导入导出、考试规则配置与本地数据管理功能。
              关闭状态下所有配置仍按当前启用值正常运行，考试不受影响。
            </span>
          </p>
        </Alert>
      )}

      <p className="text-[12px] leading-relaxed text-ink-faint">
        说明：题库与考试规则全部以 JSON 配置管理。新增、修改或删除题目只需替换题库文件，
        无需修改任何页面代码。题目分值合计与配置满分不一致时，评分引擎按配置的归一化规则折算，
        具体规则见「考试规则」标签页中的评分策略。
      </p>
    </div>
  );
}
