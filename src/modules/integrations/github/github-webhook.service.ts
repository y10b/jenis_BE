import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { TaskStatus } from '@prisma/client';

interface PullRequestPayload {
  action: string;
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    state: string;
    merged: boolean;
    merged_at: string | null;
    html_url: string;
    head: {
      ref: string;
    };
    base: {
      ref: string;
    };
    user: {
      login: string;
    };
  };
  repository: {
    full_name: string;
    name: string;
    owner: {
      login: string;
    };
  };
}

interface IssuePayload {
  action: string;
  issue: {
    id: number;
    number: number;
    title: string;
    state: string;
    html_url: string;
    user: {
      login: string;
    };
  };
  repository: {
    full_name: string;
    name: string;
  };
}

interface PushPayload {
  ref: string;
  repository: {
    full_name: string;
    name: string;
  };
  commits: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
  }>;
}

@Injectable()
export class GithubWebhookService {
  private readonly logger = new Logger(GithubWebhookService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async handlePullRequest(payload: PullRequestPayload) {
    const { action, pull_request, repository } = payload;
    const repoFullName = repository.full_name;
    const prNumber = pull_request.number;
    const branchName = pull_request.head.ref;

    this.logger.log(`PR ${action}: ${repoFullName}#${prNumber} (${branchName})`);

    // Find tasks linked to this PR or branch
    const tasks = await this.prisma.task.findMany({
      where: {
        OR: [
          { githubRepo: repoFullName, githubPrNumber: prNumber },
          { githubRepo: repoFullName, githubBranch: branchName },
        ],
      },
      include: {
        creator: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    if (tasks.length === 0) {
      this.logger.debug(`No tasks linked to PR ${repoFullName}#${prNumber}`);
      return;
    }

    for (const task of tasks) {
      // Update task with PR number if not set
      if (!task.githubPrNumber) {
        await this.prisma.task.update({
          where: { id: task.id },
          data: { githubPrNumber: prNumber },
        });
      }

      switch (action) {
        case 'opened':
          await this.handlePrOpened(task, pull_request, repoFullName);
          break;
        case 'closed':
          if (pull_request.merged) {
            await this.handlePrMerged(task, pull_request, repoFullName);
          } else {
            await this.handlePrClosed(task, pull_request, repoFullName);
          }
          break;
        case 'reopened':
          await this.handlePrReopened(task, pull_request, repoFullName);
          break;
      }
    }
  }

  async handleIssue(payload: IssuePayload) {
    const { action, issue, repository } = payload;
    const repoFullName = repository.full_name;
    const issueNumber = issue.number;

    this.logger.log(`Issue ${action}: ${repoFullName}#${issueNumber}`);

    // Find tasks linked to this issue
    const tasks = await this.prisma.task.findMany({
      where: {
        githubRepo: repoFullName,
        githubIssueNumber: issueNumber,
      },
      include: {
        creator: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    if (tasks.length === 0) {
      this.logger.debug(`No tasks linked to issue ${repoFullName}#${issueNumber}`);
      return;
    }

    for (const task of tasks) {
      switch (action) {
        case 'closed':
          await this.handleIssueClosed(task, issue, repoFullName);
          break;
        case 'reopened':
          await this.handleIssueReopened(task, issue, repoFullName);
          break;
      }
    }
  }

  async handlePush(payload: PushPayload) {
    const { ref, repository, commits } = payload;
    const repoFullName = repository.full_name;
    const branchName = ref.replace('refs/heads/', '');

    this.logger.log(`Push to ${repoFullName}/${branchName}: ${commits.length} commits`);

    // Find tasks linked to this branch
    const tasks = await this.prisma.task.findMany({
      where: {
        githubRepo: repoFullName,
        githubBranch: branchName,
      },
      include: {
        creator: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    if (tasks.length === 0) {
      return;
    }

    // Update task status to IN_PROGRESS if it's still TODO
    for (const task of tasks) {
      if (task.status === TaskStatus.TODO) {
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.IN_PROGRESS,
            startedAt: new Date(),
          },
        });

        // Create history entry
        await this.prisma.taskHistory.create({
          data: {
            taskId: task.id,
            userId: task.assigneeId || task.creatorId,
            fieldName: 'status',
            newValue: `TODO → IN_PROGRESS (GitHub push)`,
          },
        });

        this.logger.log(`Task ${task.id} status updated to IN_PROGRESS due to push`);
      }
    }
  }

  private async handlePrOpened(task: any, pr: PullRequestPayload['pull_request'], repo: string) {
    // Update task status to REVIEW
    if (task.status === TaskStatus.IN_PROGRESS) {
      await this.prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.REVIEW },
      });

      await this.createTaskHistory(task.id, task.assigneeId || task.creatorId, 'status', 'IN_PROGRESS → REVIEW (PR opened)');
    }

    // Notify task creator
    if (task.creatorId && task.creatorId !== task.assigneeId) {
      await this.notificationsService.notifyTaskUpdated(
        task.id,
        task.title,
        task.creatorId,
        pr.user.login,
        `PR #${pr.number} 열림`,
      );
    }
  }

  private async handlePrMerged(task: any, pr: PullRequestPayload['pull_request'], repo: string) {
    // Update task status to DONE
    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.DONE,
        completedAt: new Date(),
      },
    });

    await this.createTaskHistory(task.id, task.assigneeId || task.creatorId, 'status', `${task.status} → DONE (PR merged)`);

    // Notify relevant users
    const notifyUserIds = new Set<string>();
    if (task.creatorId) notifyUserIds.add(task.creatorId);
    if (task.assigneeId) notifyUserIds.add(task.assigneeId);

    for (const userId of notifyUserIds) {
      await this.notificationsService.notifyTaskCompleted(
        task.id,
        task.title,
        userId,
        pr.user.login,
      );
    }

    this.logger.log(`Task ${task.id} completed due to PR merge`);
  }

  private async handlePrClosed(task: any, pr: PullRequestPayload['pull_request'], repo: string) {
    // PR closed without merge - move back to IN_PROGRESS
    if (task.status === TaskStatus.REVIEW) {
      await this.prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.IN_PROGRESS },
      });

      await this.createTaskHistory(task.id, task.assigneeId || task.creatorId, 'status', 'REVIEW → IN_PROGRESS (PR closed)');
    }
  }

  private async handlePrReopened(task: any, pr: PullRequestPayload['pull_request'], repo: string) {
    // PR reopened - move to REVIEW
    if (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.DONE) {
      const prevStatus = task.status;
      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.REVIEW,
          completedAt: null,
        },
      });

      await this.createTaskHistory(task.id, task.assigneeId || task.creatorId, 'status', `${prevStatus} → REVIEW (PR reopened)`);
    }
  }

  private async handleIssueClosed(task: any, issue: IssuePayload['issue'], repo: string) {
    // Issue closed - mark task as done if not already
    if (task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED) {
      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.DONE,
          completedAt: new Date(),
        },
      });

      await this.createTaskHistory(task.id, task.assigneeId || task.creatorId, 'status', `${task.status} → DONE (Issue closed)`);

      this.logger.log(`Task ${task.id} completed due to issue close`);
    }
  }

  private async handleIssueReopened(task: any, issue: IssuePayload['issue'], repo: string) {
    // Issue reopened - reopen task
    if (task.status === TaskStatus.DONE) {
      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.IN_PROGRESS,
          completedAt: null,
        },
      });

      await this.createTaskHistory(task.id, task.assigneeId || task.creatorId, 'status', 'DONE → IN_PROGRESS (Issue reopened)');
    }
  }

  private async createTaskHistory(taskId: string, userId: string, fieldName: string, newValue: string) {
    await this.prisma.taskHistory.create({
      data: {
        taskId,
        userId,
        fieldName,
        newValue,
      },
    });
  }
}
