import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { ClassDiscussionService } from './class-discussion.service';
import { CreatePrivateConversationDto } from './dto/create-private-conversation.dto';
import {
  DiscussionCommentContentDto,
  DiscussionPostContentDto,
  PrivateMessageContentDto,
} from './dto/discussion-content.dto';
import { DiscussionPaginationQueryDto } from './dto/discussion-pagination-query.dto';

@ApiTags('Class Discussions')
@ApiHeader({
  name: 'X-Organization-Id',
  required: false,
  description: 'Organization workspace context. Empty = individual workspace.',
})
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
@Roles(RolesEnum.TEACHER, RolesEnum.STUDENT)
@Controller({
  path: 'classes/:classId',
  version: '1',
})
export class ClassDiscussionController {
  constructor(private readonly discussionService: ClassDiscussionService) {}

  @Get('discussion-subjects')
  @ApiOperation({ summary: 'List class subjects the current user may discuss' })
  @ApiParam({ name: 'classId' })
  @ApiResponse({ status: 200, description: 'Accessible class subjects' })
  async listDiscussionSubjects(
    @Param('classId', ParseUUIDPipe) classId: string,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    const payload = await this.discussionService.listDiscussionSubjects(classId, jwt);
    return { message: 'Discussion subjects retrieved successfully', payload };
  }

  @Get('subjects/:classSubjectId/discussions')
  @ApiOperation({ summary: 'List public discussion posts for a class subject' })
  async listPosts(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Query() query: DiscussionPaginationQueryDto,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    const payload = await this.discussionService.listPosts(
      classId,
      classSubjectId,
      jwt,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return { message: 'Discussions retrieved successfully', payload };
  }

  @Post('subjects/:classSubjectId/discussions')
  @ApiOperation({ summary: 'Create a public discussion post' })
  async createPost(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Body() dto: DiscussionPostContentDto,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    const payload = await this.discussionService.createPost(classId, classSubjectId, jwt, dto.content);
    return { message: 'Discussion posted successfully', payload };
  }

  @Get('subjects/:classSubjectId/discussions/:postId')
  @ApiOperation({ summary: 'Get a public discussion post' })
  async getPost(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    const payload = await this.discussionService.getPost(classId, classSubjectId, postId, jwt);
    return { message: 'Discussion retrieved successfully', payload };
  }

  @Patch('subjects/:classSubjectId/discussions/:postId')
  @ApiOperation({ summary: 'Update own discussion post' })
  async updatePost(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: DiscussionPostContentDto,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    const payload = await this.discussionService.updatePost(
      classId,
      classSubjectId,
      postId,
      jwt,
      dto.content,
    );
    return { message: 'Discussion updated successfully', payload };
  }

  @Delete('subjects/:classSubjectId/discussions/:postId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Soft-delete own discussion post' })
  async deletePost(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    await this.discussionService.deletePost(classId, classSubjectId, postId, jwt);
    return { message: 'Discussion deleted successfully' };
  }

  @Get('subjects/:classSubjectId/discussions/:postId/comments')
  @ApiOperation({ summary: 'List comments on a discussion post' })
  async listComments(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query() query: DiscussionPaginationQueryDto,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    const payload = await this.discussionService.listComments(
      classId,
      classSubjectId,
      postId,
      jwt,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return { message: 'Comments retrieved successfully', payload };
  }

  @Post('subjects/:classSubjectId/discussions/:postId/comments')
  @ApiOperation({ summary: 'Comment on a discussion post' })
  async createComment(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: DiscussionCommentContentDto,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    const payload = await this.discussionService.createComment(
      classId,
      classSubjectId,
      postId,
      jwt,
      dto.content,
    );
    return { message: 'Comment posted successfully', payload };
  }

  @Patch('subjects/:classSubjectId/discussions/:postId/comments/:commentId')
  @ApiOperation({ summary: 'Update own comment' })
  async updateComment(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: DiscussionCommentContentDto,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    const payload = await this.discussionService.updateComment(
      classId,
      classSubjectId,
      postId,
      commentId,
      jwt,
      dto.content,
    );
    return { message: 'Comment updated successfully', payload };
  }

  @Delete('subjects/:classSubjectId/discussions/:postId/comments/:commentId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Soft-delete own comment' })
  async deleteComment(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    await this.discussionService.deleteComment(classId, classSubjectId, postId, commentId, jwt);
    return { message: 'Comment deleted successfully' };
  }

  @Get('subjects/:classSubjectId/private-conversations')
  @ApiOperation({ summary: 'List private conversations for the current user' })
  async listConversations(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    const payload = await this.discussionService.listConversations(classId, classSubjectId, jwt);
    return { message: 'Conversations retrieved successfully', payload };
  }

  @Post('subjects/:classSubjectId/private-conversations')
  @ApiOperation({ summary: 'Start or reuse a private 1:1 conversation' })
  async createConversation(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Body() dto: CreatePrivateConversationDto,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    const payload = await this.discussionService.createConversation(classId, classSubjectId, jwt, dto);
    return { message: 'Conversation ready', payload };
  }

  @Get('subjects/:classSubjectId/private-conversations/:conversationId')
  @ApiOperation({ summary: 'Get a private conversation' })
  async getConversation(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    const payload = await this.discussionService.getConversation(
      classId,
      classSubjectId,
      conversationId,
      jwt,
    );
    return { message: 'Conversation retrieved successfully', payload };
  }

  @Get('subjects/:classSubjectId/private-conversations/:conversationId/messages')
  @ApiOperation({ summary: 'List private conversation messages' })
  async listMessages(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classSubjectId', ParseUUIDPipe) classIdSubject: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: DiscussionPaginationQueryDto,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    const payload = await this.discussionService.listMessages(
      classId,
      classIdSubject,
      conversationId,
      jwt,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return { message: 'Messages retrieved successfully', payload };
  }

  @Post('subjects/:classSubjectId/private-conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Send a private message' })
  async createMessage(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: PrivateMessageContentDto,
    @UserPayload() jwt: JwtPayloadInterface,
  ) {
    const payload = await this.discussionService.createMessage(
      classId,
      classSubjectId,
      conversationId,
      jwt,
      dto.content,
    );
    return { message: 'Message sent successfully', payload };
  }
}
