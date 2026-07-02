import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { DashboardService } from './dashboard.service';
import { TeacherDashboardQueryDto } from './dto/teacher-dashboard-query.dto';

@ApiTags('Dashboard')
@Controller({
  path: 'dashboard',
  version: '1',
})
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('teacher')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get teacher dashboard data',
    description:
      'Returns aggregated metrics for all teacher dashboard widgets including grading, live tests, students, classes, activity, and calendar.',
  })
  @ApiResponse({ status: 200, description: 'Teacher dashboard data retrieved successfully' })
  async getTeacherDashboard(
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @Query() query: TeacherDashboardQueryDto,
  ) {
    const payload = await this.dashboardService.getTeacherDashboard(jwtPayload, query);
    return {
      message: 'Teacher dashboard data retrieved successfully',
      payload,
    };
  }
}
