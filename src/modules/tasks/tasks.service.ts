import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  TaskQueryDto,
  CreateTaskRelationDto,
  CreateCommentDto,
} from './dto';
import { ErrorCodes } from '../../common/constants';
import { RequestUser } from '../../common/interfaces';
import { TaskStatus, TaskPriority, UserRole, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateTaskDto, user: RequestUser) {
    // If assigneeId is provided, verify the user exists
    if (dto.assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assigneeId },
      });
      if (!assignee) {
        throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
      }
    }

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status || TaskStatus.TODO,
        priority: dto.priority || TaskPriority.P2,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        creatorId: user.id,
        assigneeId: dto.assigneeId || null,
        teamId: dto.teamId || user.teamId || null,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create history entry
    await this.createHistory(task.id, user.id, 'created', null);

    // Send notification to assignee if task is assigned to someone else
    if (task.assigneeId && task.assigneeId !== user.id) {
      await this.notificationsService.notifyTaskAssigned(
        task.id,
        task.title,
        task.assigneeId,
        user.name,
      );
    }

    this.logger.log(`Task created: ${task.title} by ${user.email}`);

    return task;
  }

  async findAll(query: TaskQueryDto, user: RequestUser) {
    const {
      status,
      priority,
      assigneeId,
      teamId,
      creatorId,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.TaskWhereInput = {
      AND: [
        // Access control: user can see tasks they created, are assigned to, or in their team
        {
          OR: [
            { creatorId: user.id },
            { assigneeId: user.id },
            ...(user.teamId ? [{ teamId: user.teamId }] : []),
            ...(user.role === UserRole.OWNER ? [{}] : []),
          ],
        },
        // Additional filters
        ...(status ? [{ status }] : []),
        ...(priority ? [{ priority }] : []),
        ...(assigneeId ? [{ assigneeId }] : []),
        ...(teamId ? [{ teamId }] : []),
        ...(creatorId ? [{ creatorId }] : []),
        ...(search
          ? [
              {
                OR: [
                  { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
                  { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
                ],
              },
            ]
          : []),
      ],
    };

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImageUrl: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImageUrl: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              comments: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user: RequestUser) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImageUrl: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImageUrl: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        relationsFrom: {
          include: {
            relatedTask: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        relationsTo: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImageUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(ErrorCodes.TASK_NOT_FOUND);
    }

    // Check access
    if (!this.canAccessTask(task, user)) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    return task;
  }

  async update(id: string, dto: UpdateTaskDto, user: RequestUser) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException(ErrorCodes.TASK_NOT_FOUND);
    }

    if (!this.canModifyTask(task, user)) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    // Track changes for history
    const changes: { field: string; oldValue: any; newValue: any }[] = [];

    if (dto.title !== undefined && dto.title !== task.title) {
      changes.push({ field: 'title', oldValue: task.title, newValue: dto.title });
    }
    if (dto.status !== undefined && dto.status !== task.status) {
      changes.push({ field: 'status', oldValue: task.status, newValue: dto.status });
    }
    if (dto.priority !== undefined && dto.priority !== task.priority) {
      changes.push({ field: 'priority', oldValue: task.priority, newValue: dto.priority });
    }
    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      changes.push({ field: 'assigneeId', oldValue: task.assigneeId, newValue: dto.assigneeId });
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assigneeId: dto.assigneeId,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create history entries for changes
    for (const change of changes) {
      await this.createHistory(
        id,
        user.id,
        change.field,
        `${change.oldValue} → ${change.newValue}`,
      );
    }

    // Send notifications for task updates
    await this.sendTaskUpdateNotifications(task, updatedTask, changes, user);

    this.logger.log(`Task updated: ${updatedTask.title} by ${user.email}`);

    return updatedTask;
  }

  private async sendTaskUpdateNotifications(
    oldTask: any,
    updatedTask: any,
    changes: { field: string; oldValue: any; newValue: any }[],
    user: RequestUser,
  ) {
    const notifyTargets = new Set<string>();

    // Notify creator if not the one updating
    if (oldTask.creatorId !== user.id) {
      notifyTargets.add(oldTask.creatorId);
    }

    // Notify old assignee if changed
    if (oldTask.assigneeId && oldTask.assigneeId !== user.id) {
      notifyTargets.add(oldTask.assigneeId);
    }

    // Check for specific changes
    for (const change of changes) {
      // New assignee notification
      if (change.field === 'assigneeId' && change.newValue && change.newValue !== user.id) {
        await this.notificationsService.notifyTaskAssigned(
          updatedTask.id,
          updatedTask.title,
          change.newValue,
          user.name,
        );
        // Remove from general update targets as they got specific notification
        notifyTargets.delete(change.newValue);
      }

      // Task completed notification
      if (change.field === 'status' && change.newValue === TaskStatus.DONE) {
        // Notify creator that task is completed
        if (oldTask.creatorId !== user.id) {
          await this.notificationsService.notifyTaskCompleted(
            updatedTask.id,
            updatedTask.title,
            oldTask.creatorId,
            user.name,
          );
          notifyTargets.delete(oldTask.creatorId);
        }
      }
    }

    // Send general update notification to remaining targets
    if (notifyTargets.size > 0 && changes.length > 0) {
      const changesStr = changes.map(c => c.field).join(', ');
      for (const targetId of notifyTargets) {
        await this.notificationsService.notifyTaskUpdated(
          updatedTask.id,
          updatedTask.title,
          targetId,
          user.name,
          changesStr,
        );
      }
    }
  }

  async remove(id: string, user: RequestUser) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException(ErrorCodes.TASK_NOT_FOUND);
    }

    if (!this.canModifyTask(task, user)) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    await this.prisma.task.delete({
      where: { id },
    });

    this.logger.log(`Task deleted: ${task.title} by ${user.email}`);

    return { message: 'Task가 삭제되었습니다.' };
  }

  async getMyTasks(query: TaskQueryDto, user: RequestUser) {
    return this.findAll({ ...query, assigneeId: user.id }, user);
  }

  async getCreatedTasks(query: TaskQueryDto, user: RequestUser) {
    return this.findAll({ ...query, creatorId: user.id }, user);
  }

  // Task Relations
  async addRelation(taskId: string, dto: CreateTaskRelationDto, user: RequestUser) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(ErrorCodes.TASK_NOT_FOUND);
    }

    if (!this.canModifyTask(task, user)) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const targetTask = await this.prisma.task.findUnique({
      where: { id: dto.targetTaskId },
    });

    if (!targetTask) {
      throw new NotFoundException(ErrorCodes.TASK_NOT_FOUND);
    }

    const relation = await this.prisma.taskRelation.create({
      data: {
        taskId: taskId,
        relatedTaskId: dto.targetTaskId,
        relationType: dto.type,
      },
      include: {
        relatedTask: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    return relation;
  }

  async removeRelation(taskId: string, relationId: string, user: RequestUser) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(ErrorCodes.TASK_NOT_FOUND);
    }

    if (!this.canModifyTask(task, user)) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    await this.prisma.taskRelation.delete({
      where: { id: relationId },
    });

    return { message: '관계가 삭제되었습니다.' };
  }

  // Comments
  async addComment(taskId: string, dto: CreateCommentDto, user: RequestUser) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(ErrorCodes.TASK_NOT_FOUND);
    }

    if (!this.canAccessTask(task, user)) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        userId: user.id,
        content: dto.content,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImageUrl: true,
          },
        },
      },
    });

    // Send notifications for new comment
    const notifyTargets = new Set<string>();

    // Notify task creator
    if (task.creatorId !== user.id) {
      notifyTargets.add(task.creatorId);
    }

    // Notify task assignee
    if (task.assigneeId && task.assigneeId !== user.id) {
      notifyTargets.add(task.assigneeId);
    }

    const commentPreview = dto.content.length > 50
      ? dto.content.substring(0, 50) + '...'
      : dto.content;

    for (const targetId of notifyTargets) {
      await this.notificationsService.notifyTaskComment(
        task.id,
        task.title,
        targetId,
        user.name,
        commentPreview,
      );
    }

    return comment;
  }

  async removeComment(taskId: string, commentId: string, user: RequestUser) {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
      include: { task: true },
    });

    if (!comment) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    // Only comment author or task creator or OWNER can delete comments
    if (
      comment.userId !== user.id &&
      comment.task.creatorId !== user.id &&
      user.role !== UserRole.OWNER
    ) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    await this.prisma.taskComment.delete({
      where: { id: commentId },
    });

    return { message: '댓글이 삭제되었습니다.' };
  }

  async getComments(taskId: string, user: RequestUser) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(ErrorCodes.TASK_NOT_FOUND);
    }

    if (!this.canAccessTask(task, user)) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const comments = await this.prisma.taskComment.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments;
  }

  // History
  async getHistory(taskId: string, user: RequestUser) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(ErrorCodes.TASK_NOT_FOUND);
    }

    if (!this.canAccessTask(task, user)) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const history = await this.prisma.taskHistory.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return history;
  }

  // Helper methods
  private canAccessTask(task: any, user: RequestUser): boolean {
    if (user.role === UserRole.OWNER) return true;
    if (task.creatorId === user.id) return true;
    if (task.assigneeId === user.id) return true;
    if (task.teamId && task.teamId === user.teamId) return true;
    return false;
  }

  private canModifyTask(task: any, user: RequestUser): boolean {
    if (user.role === UserRole.OWNER) return true;
    if (task.creatorId === user.id) return true;
    if (task.assigneeId === user.id) return true;
    return false;
  }

  private async createHistory(
    taskId: string,
    userId: string,
    fieldName: string,
    newValue: string | null,
  ) {
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
