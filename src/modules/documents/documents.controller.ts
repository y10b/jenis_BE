import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto, UpdateDocumentDto, DocumentQueryDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/interfaces/request-user.interface';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  create(@Body() dto: CreateDocumentDto, @CurrentUser() user: RequestUser) {
    return this.documentsService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: DocumentQueryDto, @CurrentUser() user: RequestUser) {
    return this.documentsService.findAll(query, user);
  }

  @Get('tags/popular')
  getPopularTags(@CurrentUser() user: RequestUser) {
    return this.documentsService.getPopularTags(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.documentsService.findOne(id, user);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documentsService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.documentsService.remove(id, user);
  }

  @Post(':id/favorite')
  toggleFavorite(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.documentsService.toggleFavorite(id, user);
  }
}
