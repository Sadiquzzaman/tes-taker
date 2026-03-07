import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SmsService } from './sms.service';
import { SendOtpDto, VerifyOtpDto, ResetSmsCacheDto } from './dto/sms.dto';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guard/roles.guard';

@ApiTags('SMS')
@Controller({
  path: 'sms',
  version: '1',
})
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Post('send-otp')
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    const result = await this.smsService.sendOtp(sendOtpDto.phone);
    return {
      success: result.success,
      message: result.message,
    };
  }

  @Post('verify-otp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const result = await this.smsService.verifyOtp(verifyOtpDto.phone, verifyOtpDto.otp);
    return {
      success: result.success,
      message: result.message,
    };
  }

  @Get('status/:phoneNumber')
  async getSmsStatus(@Param('phoneNumber') phoneNumber: string) {
    const status = await this.smsService.getSmsStatus(phoneNumber);
    return {
      success: true,
      data: status,
    };
  }

  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN)
  @Post('reset-cache')
  async resetSmsCache(@Query() resetSmsCacheDto: ResetSmsCacheDto): Promise<{ success: boolean; message: string; }> {
    const result = await this.smsService.resetSmsCache(resetSmsCacheDto.phone);
    return {
      success: result.success,
      message: result.message,
    };
  }
} 
