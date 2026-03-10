import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { RegisterUserDto } from 'src/auth/dto/register-user.dto';

export class RegisterWithClassDto extends RegisterUserDto {
  @ApiPropertyOptional({
    description: 'Class invitation token (if registering via class invitation link)',
    example: 'invitation-token-uuid',
  })
  @IsOptional()
  @IsString({ message: 'Class invitation token must be a string' })
  classInvitationToken?: string;
}
