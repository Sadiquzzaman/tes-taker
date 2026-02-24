import { Controller, Post, Body, UseGuards, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { RegisterUserDto } from './dto/register-user.dto';
import { JwtAuthGuard } from './guards/jwt.guard';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { JwtPayloadInterface } from './interfaces/jwt-payload.interface';
import { VerifyOtpDto } from 'src/sms/dto/sms.dto';
import { RequestLoginOtpDto, VerifyLoginOtpDto } from './dto/login-otp.dto';

@ApiTags('Authentication')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Register a new user with phone number (required) and optional email. An OTP will be sent to the provided phone number for verification. The user must verify the OTP before they can login.',
  })
  @ApiBody({
    type: RegisterUserDto,
    description: 'User registration data. Phone number is required, email is optional.',
    examples: {
      withPhoneOnly: {
        value: {
          first_name: 'John',
          last_name: 'Doe',
          phone: '01734911480',
          role: 'STUDENT'
        }
      },
      withPhoneAndEmail: {
        value: {
          first_name: 'Jane',
          last_name: 'Smith',
          phone: '01712345678',
          email: 'jane@example.com',
          role: 'TEACHER'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'User registered successfully. OTP has been sent to the phone number.',
    schema: {
      example: {
        message: 'Registered successfully!',
        payload: {
          success: true,
          message: 'Registration successful. Please verify your phone number with the OTP sent.',
          data: {
            phone: '01734911480',
            email: 'user@example.com',
            otpSent: true,
            requiresPhoneVerification: true
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Validation error, duplicate email/phone, or failed to send OTP',
    schema: {
      example: {
        statusCode: 400,
        message: 'Phone number already exists!',
        error: 'Bad Request'
      }
    }
  })
  async register(@Body() registerUserDto: RegisterUserDto) {
    const payload = await this.authService.signUp(registerUserDto);
    return { message: 'Registered successfully!', payload };
  }

  @Post('register/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify registration OTP',
    description: 'Verify the OTP sent during registration. This endpoint completes the registration process by verifying the phone number. After successful verification, the user can login.',
  })
  @ApiBody({
    type: VerifyOtpDto,
    description: 'Phone number and OTP code received via SMS',
    examples: {
      verifyOtp: {
        value: {
          phone: '01734911480',
          otp: '123456'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Phone number verified successfully. User can now login.',
    schema: {
      example: {
        message: 'Phone verified successfully',
        payload: {
          success: true,
          message: 'Phone verified successfully. You can now login.',
          data: {
            phone: '01734911480',
            phoneVerified: true
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid OTP, expired OTP, or OTP not found',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid OTP. Please try again.',
        error: 'Bad Request'
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'User not found with the provided phone number',
    schema: {
      example: {
        statusCode: 404,
        message: 'No user found with this phone number',
        error: 'Not Found'
      }
    }
  })
  async verifyRegistrationOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const payload = await this.authService.verifyPhoneForRegistration(verifyOtpDto);
    return { message: 'Phone verified successfully', payload };
  }

  @Post('login/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request OTP for login',
    description: 'Request an OTP to be sent for login. Provide either phone number or email address. If email is provided, OTP will be sent to the registered phone number associated with that email. OTP expires in 5 minutes.',
  })
  @ApiBody({
    type: RequestLoginOtpDto,
    description: 'Phone number or email address for login',
    examples: {
      loginWithPhone: {
        value: {
          phone: '01734911480'
        }
      },
      loginWithEmail: {
        value: {
          email: 'user@example.com'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'OTP sent successfully to the phone number',
    schema: {
      example: {
        message: 'OTP sent successfully',
        payload: {
          success: true,
          message: 'OTP sent successfully to your phone number',
          data: {
            phone: '01734911480',
            otpSent: true
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Failed to send OTP, rate limit exceeded, or user has no phone number',
    schema: {
      example: {
        statusCode: 400,
        message: 'Failed to send OTP: Rate limit exceeded',
        error: 'Bad Request'
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'User not found with the provided phone number or email',
    schema: {
      example: {
        statusCode: 404,
        message: 'No user found with this phone number',
        error: 'Not Found'
      }
    }
  })
  async requestLoginOtp(@Body() requestLoginOtpDto: RequestLoginOtpDto) {
    const payload = await this.authService.requestLoginOtp(requestLoginOtpDto);
    return { message: 'OTP sent successfully', payload };
  }

  @Post('login/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and login',
    description: 'Verify the OTP received via SMS and complete the login process. On successful verification, returns a JWT access token that should be used for authenticated requests. The token expires in 30 minutes.',
  })
  @ApiBody({
    type: VerifyLoginOtpDto,
    description: 'Phone number or email, and OTP code',
    examples: {
      verifyLoginOtp: {
        value: {
          phone: '01734911480',
          otp: '123456'
        }
      },
      verifyLoginOtpWithEmail: {
        value: {
          email: 'user@example.com',
          otp: '123456'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful. Returns user data and JWT access token.',
    schema: {
      example: {
        message: 'Login successful!',
        payload: {
          id: 'user-uuid',
          first_name: 'John',
          last_name: 'Doe',
          email: 'user@example.com',
          phone: '01734911480',
          role: 'STUDENT',
          is_verified: true,
          access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid OTP, expired OTP, or user not verified',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid OTP. Please try again.',
        error: 'Bad Request'
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'User not found with the provided phone number or email',
    schema: {
      example: {
        statusCode: 404,
        message: 'No user found with this phone number',
        error: 'Not Found'
      }
    }
  })
  async verifyLoginOtp(@Body() verifyLoginOtpDto: VerifyLoginOtpDto) {
    const payload = await this.authService.verifyLoginOtp(verifyLoginOtpDto);
    return { message: 'Login successful!', payload };
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('verify-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify JWT token validity',
    description: 'Verify if the provided JWT token in the Authorization header is valid and not expired. Returns the decoded JWT payload containing user information. Use this endpoint to check token validity or get current user information.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token is valid. Returns the decoded JWT payload.',
    schema: {
      example: {
        payload: {
          id: 'user-uuid',
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          role: 'STUDENT',
          phone: '01734911480',
          iat: 1234567890,
          exp: 1234569690
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid, expired, or missing JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized'
      }
    }
  })
  async verifyToken(@UserPayload() jwtPayload: JwtPayloadInterface) {
    return { payload: jwtPayload };
  }
}
