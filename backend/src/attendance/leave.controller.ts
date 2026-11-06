import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { requireWorkspace } from './attendance-access';
import { ApplyLeaveDto, ApproveLeaveDto, LeaveApprovalsQueryDto, LeavePeopleQueryDto, RejectLeaveDto } from './dto/leave.dto';
import { LeaveService } from './leave.service';

/**
 * Leave requests and approvals (ATT-09, ATT-11) for students and teachers of the workspace: apply
 * (for yourself, or as staff for a student or teacher), the caller's own requests, the approvals
 * list, approve or reject with a comment, and withdraw. Errors carry a `code` (ATTENDANCE_LEAVE_*).
 * Needs `attendance`.
 */
@ApiTags('Attendance')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.ATTENDANCE)
@Controller({ path: 'attendance/leave', version: '1' })
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get('mine')
  @ApiOperation({ summary: "The caller's leave requests (and those they applied for), and what they may do on the leave page" })
  async mine(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Leave retrieved successfully', payload: await this.leave.mine(requireWorkspace(), user.id) };
  }

  @Get('approvals')
  @ApiOperation({ summary: 'Leave requests the caller approves: waiting (default), decided or all' })
  async approvals(@Query() query: LeaveApprovalsQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Leave requests retrieved successfully', payload: await this.leave.approvals(requireWorkspace(), user.id, query.status) };
  }

  @Get('people')
  @ApiOperation({ summary: 'Students (and, for owners and admins, staff) the caller may apply for, by name' })
  async people(@Query() query: LeavePeopleQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'People retrieved successfully', payload: await this.leave.people(requireWorkspace(), user.id, query.q ?? '') };
  }

  @Get(':id')
  @ApiOperation({ summary: 'One leave request (its person, applicant or approvers)' })
  async get(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Leave request retrieved successfully', payload: await this.leave.get(requireWorkspace(), user.id, id) };
  }

  @Post()
  @ApiOperation({
    summary: 'Apply for leave',
    description:
      'Whole days from from_date to to_date (at most 60, from 30 days back to a year ahead, with at least one school day, no overlap). Approved at once when the applicant approves it. Guardians get an SMS for a student when the organisation has it on.',
  })
  async apply(@Body() dto: ApplyLeaveDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Leave applied for', payload: await this.leave.apply(requireWorkspace(), user.id, dto) };
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve a waiting request; Absent already saved on those days becomes Leave' })
  async approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveLeaveDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Leave approved', payload: await this.leave.approve(requireWorkspace(), user.id, id, dto) };
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject a waiting request with a comment' })
  async reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectLeaveDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Leave rejected', payload: await this.leave.reject(requireWorkspace(), user.id, id, dto) };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Withdraw a request: waiting at any time, approved before it starts' })
  async cancel(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Leave withdrawn', payload: await this.leave.cancel(requireWorkspace(), user.id, id) };
  }
}
