/**
 * 模拟讨论区
 *
 * I. 定位
 *
 * 1. 演示公共讨论中的举证责任、来源标注与内容发布流程
 * 2. 全部内容仅存在于当前页面会话中，刷新后重置；不发布到任何真实平台
 *
 * II. 权限
 *
 * 1. 发表评论：post_comment（L2）
 * 2. 参与公共讨论：public_discussion（L2）
 * 3. 参与模拟投票：simulated_vote（L2）
 * 4. 发布原创内容：publish_content（L3）
 * 5. 发布含图片与附件的内容：publish_media（L3）
 *
 * III. 状态覆盖
 *
 * 1. 未解锁、空数据（全部评论被删除）、表单校验失败、发布成功均有对应界面
 *
 * @module pages/DiscussionSimulatorPage
 * @author zexuan.peng
 * @created 2026-10-14
 */

import { MessageSquarePlus, Send, ThumbsUp, Trash2, Upload, Vote } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';

import { PermissionDeniedState } from '@/components/common/states';
import { PageHeader, Section } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { Alert, Progress } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { usePermission } from '@/hooks/use-user-data';
import { cn } from '@/utils/cn';

/** 来源标注选项 */
const SOURCE_LABELS = [
  { value: 'primary', label: '一手来源（我已核对原始出处）' },
  { value: 'secondary', label: '二手转述（我引用了他人转述，已标注层级）' },
  { value: 'unverifiable', label: '无法追溯（我尚未找到可查来源）' },
] as const;

type SourceLabel = (typeof SOURCE_LABELS)[number]['value'];

/** 讨论区初始帖子（平台内置样例） */
const SEED_POSTS = [
  {
    postId: 'P1',
    author: '样例考生 A',
    postedAt: '09:12',
    sourceLabel: 'primary' as SourceLabel,
    body: '关于票价调整的公告我查到了原始文件，里面写的是「拟调整」并且有文件编号。转述版本把「拟」去掉了，这个差别挺关键。',
    likes: 3,
  },
  {
    postId: 'P2',
    author: '样例考生 B',
    postedAt: '09:20',
    sourceLabel: 'secondary' as SourceLabel,
    body: '我看到的那篇文章说「下月确定涨价」，但它没有给原始链接。按标注规范，这条应该算二手转述。',
    likes: 1,
  },
  {
    postId: 'P3',
    author: '样例考生 C',
    postedAt: '09:31',
    sourceLabel: 'unverifiable' as SourceLabel,
    body: '群里还有一张截图说要翻倍，我没找到出处，先标记为无法追溯。',
    likes: 0,
  },
];

/** 模拟讨论区 */
export function DiscussionSimulatorPage(): React.ReactElement {
  const { toast } = useToast();

  const commentPermission = usePermission('post_comment');
  const discussionPermission = usePermission('public_discussion');
  const votePermission = usePermission('simulated_vote');
  const publishPermission = usePermission('publish_content');
  const mediaPermission = usePermission('publish_media');

  const [posts, setPosts] = React.useState(SEED_POSTS);
  const [likedIds, setLikedIds] = React.useState<string[]>([]);
  const [commentDraft, setCommentDraft] = React.useState('');
  const [commentSource, setCommentSource] = React.useState<SourceLabel>('secondary');
  const [commentError, setCommentError] = React.useState<string | null>(null);

  const [postTitle, setPostTitle] = React.useState('');
  const [postBody, setPostBody] = React.useState('');
  const [postSource, setPostSource] = React.useState<SourceLabel>('secondary');
  const [postError, setPostError] = React.useState<string | null>(null);
  const [attachmentName, setAttachmentName] = React.useState<string | null>(null);
  const [publishNotice, setPublishNotice] = React.useState<string | null>(null);

  const [votes, setVotes] = React.useState<{ agree: number; disagree: number; unsure: number }>({
    agree: 6,
    disagree: 2,
    unsure: 3,
  });
  const [myVote, setMyVote] = React.useState<'agree' | 'disagree' | 'unsure' | null>(null);

  const totalVotes = votes.agree + votes.disagree + votes.unsure;

  /** 发表评论 */
  const handleComment = (): void => {
    const trimmed = commentDraft.trim();

    if (trimmed.length === 0) {
      setCommentError('评论内容不能为空。');
      return;
    }
    if (trimmed.length < 5) {
      setCommentError('评论内容过短，请至少写 5 个字，以便说明你的依据。');
      return;
    }

    setCommentError(null);
    setPosts((current) => [
      ...current,
      {
        postId: `P${current.length + 1}-${Date.now().toString(36)}`,
        author: '我（本机考生）',
        postedAt: new Date().toTimeString().slice(0, 5),
        sourceLabel: commentSource,
        body: trimmed,
        likes: 0,
      },
    ]);
    setCommentDraft('');
    toast({
      title: '评论已发表到模拟讨论区',
      description: '内容仅存在于当前页面会话中，刷新后重置，不会发布到任何真实平台。',
      tone: 'success',
    });
  };

  /** 点赞 */
  const handleLike = (postId: string): void => {
    const alreadyLiked = likedIds.includes(postId);
    setLikedIds((current) =>
      alreadyLiked ? current.filter((id) => id !== postId) : [...current, postId],
    );
    setPosts((current) =>
      current.map((post) =>
        post.postId === postId ? { ...post, likes: post.likes + (alreadyLiked ? -1 : 1) } : post,
      ),
    );
  };

  /** 删除评论 */
  const handleDelete = (postId: string): void => {
    setPosts((current) => current.filter((post) => post.postId !== postId));
  };

  /** 投票 */
  const handleVote = (choice: 'agree' | 'disagree' | 'unsure'): void => {
    if (myVote) {
      toast({ title: '你已投过票', description: '模拟投票每人一次，用于演示投票结果分布。', tone: 'info' });
      return;
    }
    setMyVote(choice);
    setVotes((current) => ({ ...current, [choice]: current[choice] + 1 }));
    toast({ title: '投票已记录', description: '投票结果由内置样例数据生成，不代表任何真实民意调查。', tone: 'success' });
  };

  /** 发布内容 */
  const handlePublish = (): void => {
    if (postTitle.trim().length < 4) {
      setPostError('标题过短，请至少写 4 个字。');
      return;
    }
    if (postBody.trim().length < 20) {
      setPostError('正文过短，请至少写 20 个字，并说明你的依据。');
      return;
    }

    setPostError(null);
    setPublishNotice(
      `已生成内容草稿并完成来源标注：标题「${postTitle.trim()}」，来源标注为「${
        SOURCE_LABELS.find((item) => item.value === postSource)?.label ?? postSource
      }」${attachmentName ? `，附带素材「${attachmentName}」` : ''}。`,
    );
    setPostTitle('');
    setPostBody('');
    setAttachmentName(null);
    toast({
      title: '模拟内容已发布',
      description: '内容不会离开本机浏览器，本平台不提供任何真实的内容分发能力。',
      tone: 'success',
    });
  };

  if (!discussionPermission.unlocked) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="模拟讨论区" description="本功能区按资格等级逐级开放。" />
        <PermissionDeniedState
          title="「参与公共讨论」尚未解锁"
          reason={discussionPermission.state?.lockedReason}
          requirement={discussionPermission.state?.definition.unlockCondition}
          advice={discussionPermission.state?.definition.upgradeAdvice}
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/permissions">查看权限清单</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="模拟功能"
        title="模拟讨论区"
        description="用于演示公共讨论中的举证责任、来源标注与内容发布流程。全部内容仅存在于当前页面会话中，刷新后重置。"
        actions={<Badge variant="outline">会话内有效</Badge>}
      />

      <Alert tone="warning" title="边界说明">
        本讨论区的全部内容仅保存在当前页面内存中，不会写入数据库，不会发布到任何真实平台，
        也不会被任何第三方看到。参与人名称与议题均为平台内置样例。
      </Alert>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* I. 讨论列表 */}
        <div className="min-w-0 flex-1">
          <Section
            title="讨论议题：如何标注转述来源"
            description={`当前共 ${posts.length} 条发言。发表评论时必须选择来源标注，这是本平台模拟讨论的核心规则。`}
          >
            {posts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-[13px] font-medium text-ink">讨论区当前为空</p>
                  <p className="mt-1.5 text-[12px] text-ink-soft">
                    全部发言已被删除。可在下方发表新的评论恢复讨论。
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ul className="flex flex-col gap-3">
                {posts.map((post) => {
                  const liked = likedIds.includes(post.postId);
                  const isMine = post.author.startsWith('我');

                  return (
                    <li key={post.postId}>
                      <Card>
                        <CardContent className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[13px] font-medium text-ink">{post.author}</span>
                              <span className="tabular text-[11px] text-ink-faint">{post.postedAt}</span>
                              <Badge
                                variant={
                                  post.sourceLabel === 'primary'
                                    ? 'pass'
                                    : post.sourceLabel === 'secondary'
                                      ? 'warn'
                                      : 'fail'
                                }
                                size="sm"
                              >
                                {SOURCE_LABELS.find((item) => item.value === post.sourceLabel)?.label.split(
                                  '（',
                                )[0]}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant={liked ? 'subtle' : 'ghost'}
                                onClick={() => handleLike(post.postId)}
                                aria-pressed={liked}
                                aria-label={`${liked ? '取消赞同' : '赞同'}这条发言`}
                              >
                                <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                                {post.likes}
                              </Button>
                              {isMine ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(post.postId)}
                                  aria-label="删除我的这条发言"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                              ) : null}
                            </div>
                          </div>

                          <p className="text-[13px] leading-relaxed text-ink-soft">{post.body}</p>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* II. 发表评论 */}
          <Section
            title="发表评论"
            description="评论必须携带来源标注，用于演示举证责任的分配。"
            className="mt-6"
          >
            {commentPermission.unlocked ? (
              <Card>
                <CardContent className="flex flex-col gap-3">
                  <Field
                    label="来源标注"
                    htmlFor="comment-source"
                    required
                    hint="请如实选择。无法追溯并不违规，隐去标注才是问题。"
                  >
                    <Select
                      id="comment-source"
                      value={commentSource}
                      onChange={(event) => setCommentSource(event.target.value as SourceLabel)}
                    >
                      {SOURCE_LABELS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label="评论内容"
                    htmlFor="comment-body"
                    required
                    error={commentError}
                    hint="建议写明你的依据，而不仅是结论。"
                  >
                    <Textarea
                      id="comment-body"
                      value={commentDraft}
                      onChange={(event) => {
                        setCommentDraft(event.target.value);
                        if (commentError) {
                          setCommentError(null);
                        }
                      }}
                      rows={3}
                      maxLength={500}
                      aria-invalid={Boolean(commentError)}
                      placeholder="例如：我核对了原始公告，其中使用的是「拟调整」表述，并附有文件编号。"
                    />
                  </Field>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={handleComment} data-testid="post-comment">
                      <Send className="h-4 w-4" aria-hidden="true" />
                      发表评论
                    </Button>
                    <span className="text-[11px] text-ink-faint">{commentDraft.length} / 500 字</span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <PermissionDeniedState
                title="「发表评论」尚未解锁"
                reason={commentPermission.state?.lockedReason}
                requirement={commentPermission.state?.definition.unlockCondition}
                advice={commentPermission.state?.definition.upgradeAdvice}
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link to="/permissions">查看权限清单</Link>
                  </Button>
                }
              />
            )}
          </Section>
        </div>

        {/* III. 侧栏：投票与发布 */}
        <aside className="flex w-full flex-col gap-4 lg:w-80 lg:shrink-0">
          {/* 模拟投票 */}
          <Card>
            <CardContent className="flex flex-col gap-3">
              <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                <Vote className="h-4 w-4 text-brand" aria-hidden="true" />
                模拟投票
              </h3>
              <p className="text-[12px] leading-relaxed text-ink-soft">
                议题：转述他人内容时，是否应当强制标注来源层级？
              </p>

              {votePermission.unlocked ? (
                <>
                  <div className="flex flex-col gap-2">
                    {(
                      [
                        { key: 'agree', label: '应当强制标注' },
                        { key: 'disagree', label: '由发布者自行决定' },
                        { key: 'unsure', label: '暂不确定' },
                      ] as const
                    ).map((option) => (
                      <Button
                        key={option.key}
                        size="sm"
                        variant={myVote === option.key ? 'primary' : 'outline'}
                        onClick={() => handleVote(option.key)}
                        aria-pressed={myVote === option.key}
                        disabled={myVote !== null}
                      >
                        {option.label}
                        <span className="tabular ml-1 text-[11px] opacity-80">
                          {votes[option.key]} 票
                        </span>
                      </Button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Progress
                      value={totalVotes > 0 ? (votes.agree / totalVotes) * 100 : 0}
                      tone="brand"
                      aria-label={`赞成比例 ${totalVotes > 0 ? Math.round((votes.agree / totalVotes) * 100) : 0}%`}
                    />
                    <p className="text-[11px] text-ink-faint">
                      共 {totalVotes} 票。投票结果由内置样例数据生成，不代表任何真实民意调查。
                    </p>
                  </div>

                  {myVote ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setVotes((current) => ({ ...current, [myVote]: current[myVote] - 1 }));
                        setMyVote(null);
                      }}
                    >
                      撤回投票
                    </Button>
                  ) : null}
                </>
              ) : (
                <p className="text-[12px] leading-relaxed text-warn">
                  「参与模拟投票」尚未解锁。{votePermission.state?.definition.unlockCondition}
                </p>
              )}
            </CardContent>
          </Card>

          {/* 发布内容 */}
          <Card>
            <CardContent className="flex flex-col gap-3">
              <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                <MessageSquarePlus className="h-4 w-4 text-brand" aria-hidden="true" />
                模拟发布台
              </h3>

              {publishPermission.unlocked ? (
                <>
                  {publishNotice ? <Alert tone="success">{publishNotice}</Alert> : null}

                  <Field label="标题" htmlFor="post-title" required error={postError}>
                    <Input
                      id="post-title"
                      value={postTitle}
                      onChange={(event) => {
                        setPostTitle(event.target.value);
                        if (postError) {
                          setPostError(null);
                        }
                      }}
                      maxLength={80}
                      placeholder="例如：关于转述来源标注的三点观察"
                      aria-invalid={Boolean(postError)}
                    />
                  </Field>

                  <Field
                    label="正文"
                    htmlFor="post-body"
                    required
                    hint="至少 20 个字，并说明你的依据。"
                  >
                    <Textarea
                      id="post-body"
                      value={postBody}
                      onChange={(event) => {
                        setPostBody(event.target.value);
                        if (postError) {
                          setPostError(null);
                        }
                      }}
                      rows={4}
                      maxLength={800}
                      placeholder="写明你的观察、依据与结论边界。"
                      aria-invalid={Boolean(postError)}
                    />
                  </Field>

                  <Field label="来源标注" htmlFor="post-source" required>
                    <Select
                      id="post-source"
                      value={postSource}
                      onChange={(event) => setPostSource(event.target.value as SourceLabel)}
                    >
                      {SOURCE_LABELS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {/* 附件：需要 publish_media 权限 */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-ink">素材附件（可选）</span>
                    {mediaPermission.unlocked ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setAttachmentName((current) =>
                                current ? null : `示例素材-${Date.now().toString(36).slice(-4)}.png`,
                              )
                            }
                          >
                            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                            {attachmentName ? '移除素材' : '附加示例素材'}
                          </Button>
                          {attachmentName ? (
                            <span className="doc-code text-[11px] text-ink-soft">{attachmentName}</span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-ink-faint">
                          演示用途：此处仅生成素材文件名，不会读取或上传任何真实文件。
                        </p>
                      </>
                    ) : (
                      <p className="text-[12px] leading-relaxed text-warn">
                        「发布含图片与附件的内容」尚未解锁。
                        {mediaPermission.state?.definition.unlockCondition}
                      </p>
                    )}
                  </div>

                  <Button size="sm" onClick={handlePublish} data-testid="publish-content">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    发布到模拟讨论区
                  </Button>
                </>
              ) : (
                <PermissionDeniedState
                  title="「发布原创内容」尚未解锁"
                  reason={publishPermission.state?.lockedReason}
                  requirement={publishPermission.state?.definition.unlockCondition}
                  advice={publishPermission.state?.definition.upgradeAdvice}
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link to="/permissions">查看权限清单</Link>
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <p className={cn('text-[11px] leading-relaxed text-ink-faint')}>
        本讨论区不写入任何数据库表，全部内容随页面刷新而重置。这样做是为了避免把演示数据与真实考试记录混在一起。
      </p>
    </div>
  );
}
