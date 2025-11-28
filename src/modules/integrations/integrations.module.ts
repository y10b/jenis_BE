import { Module } from '@nestjs/common';
import { GithubService } from './github/github.service';
import { GithubController } from './github/github.controller';
import { GithubWebhookController } from './github/github-webhook.controller';
import { GithubWebhookService } from './github/github-webhook.service';
import { SlackService } from './slack/slack.service';
import { SlackController } from './slack/slack.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [GithubController, GithubWebhookController, SlackController],
  providers: [GithubService, GithubWebhookService, SlackService],
  exports: [GithubService, SlackService],
})
export class IntegrationsModule {}
