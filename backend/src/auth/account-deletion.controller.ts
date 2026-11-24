import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { AccountDeletionService } from './account-deletion.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from './guards/jwt.guard';
import { JwtPayloadInterface } from './interfaces/jwt-payload.interface';

/** Deleting one's own account from the apps or the website (mobile-api #358). */
@ApiTags('Account')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'me/account-deletion', version: '1' })
export class AccountDeletionController {
  constructor(private readonly accountDeletion: AccountDeletionService) {}

  @Get()
  @ApiOperation({
    summary: 'Can I delete my account?',
    description: '`{ canDelete: true }`, or `{ canDelete: false, code: "OWNER_MUST_TRANSFER", organizations }` for an organisation owner.',
  })
  async status(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Account deletion status', payload: await this.accountDeletion.status(user.id) };
  }

  @Post('otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a code to my phone to confirm deleting my account', description: 'Valid for 5 minutes. 429 OTP_SEND_FAILED after 3 codes in an hour.' })
  async sendCode(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Code sent', payload: await this.accountDeletion.sendCode(user.id) };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete my account',
    description:
      'With `password` or `otp`. The account is deactivated and anonymised and every device is signed out; marks, attendance and messages stay ' +
      'with the school under "Deleted user". 400 INVALID_PASSWORD / OTP_INVALID / OTP_EXPIRED, 409 OWNER_MUST_TRANSFER, 429 OTP_LOCKED after 5 wrong tries.',
  })
  async delete(@UserPayload() user: JwtPayloadInterface, @Body() dto: DeleteAccountDto) {
    return { message: 'Your account has been deleted', payload: await this.accountDeletion.delete(user.id, dto) };
  }
}
