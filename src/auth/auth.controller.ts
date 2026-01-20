import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegisterUserDto } from './dto/register-user.dto';
import { LocalAuthUserDto } from './dto/local-auth-user.dto';
import { JwtAuthGuard } from './guards/jwt.guard';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { JwtPayloadInterface } from './interfaces/jwt-payload.interface';
import { VerifyOtpDto } from 'src/sms/dto/sms.dto';
import { ForgetPasswordDto, ResetForgottenPasswordDto, ResetPasswordDto } from './dto/password.dto';

@ApiTags('Auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Register a new user with email or phone. Either email or phone must be provided. If phone is provided, OTP will be sent for verification.',
  })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate email/phone' })
  async register(@Body() registerUserDto: RegisterUserDto) {
    const payload = await this.authService.signUp(registerUserDto);
    return { message: 'Registered successfully!', payload };
  }

  @Post('login')
  @ApiOperation({
    summary: 'Login user',
    description: 'Login using email or phone with password. Returns JWT token on success.',
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() localUser: LocalAuthUserDto) {
    const payload = await this.authService.validateLocalStrategyUser(localUser);
    return { message: 'Login successful!', payload };
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('verify-auth-guard')
  @ApiOperation({
    summary: 'Verify JWT token',
    description: 'Verify if the provided JWT token is valid. Returns the decoded payload.',
  })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async test(@UserPayload() jwtPayload: JwtPayloadInterface) {
    return { payload: jwtPayload };
  }

  @Post('verify-register-otp')
  @ApiOperation({
    summary: 'Verify phone OTP for registration',
    description: 'Verify the OTP sent during registration. Required for phone-based registrations.',
  })
  @ApiResponse({ status: 200, description: 'Phone verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid OTP or user not found' })
  async verifyPhone(@Body() verifyOtpDto: VerifyOtpDto) {
    const payload = await this.authService.verifyPhoneForRegistration(verifyOtpDto);
    return { message: 'Phone verified successfully', payload };
  }

  @Post('forget-password')
  @ApiOperation({
    summary: 'Request password reset OTP',
    description: 'Send OTP to registered phone number for password reset. Max 3 OTPs per hour.',
  })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 400, description: 'User not found or rate limit exceeded' })
  async forgetPassword(@Body() forgetPasswordDto: ForgetPasswordDto) {
    const payload = await this.authService.forgetPassword(forgetPasswordDto.phone);
    return { message: 'OTP sent to your phone number', payload };
  }

  @Post('reset-forgotten-password')
  @ApiOperation({
    summary: 'Reset password with OTP',
    description: 'Reset password using OTP received via forgot password flow. OTP expires in 5 minutes.',
  })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid OTP or passwords do not match' })
  async resetForgottenPassword(@Body() dto: ResetForgottenPasswordDto) {
    const payload = await this.authService.resetForgottenPassword(dto);
    return { message: 'Password reset successful', payload };
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset password when logged in',
    description: 'Change password for authenticated user. Requires current password verification.',
  })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 400, description: 'Incorrect current password or passwords do not match' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async resetPassword(
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @Body() dto: ResetPasswordDto
  ) {
    const payload = await this.authService.resetPassword(jwtPayload.id, dto);
    return { message: 'Password updated successfully', payload };
  }
}
