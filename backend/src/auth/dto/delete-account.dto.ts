import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

/** Deleting one's account (mobile-api #358): the current password, or the code sent to the phone. */
export class DeleteAccountDto {
  @ApiPropertyOptional({ description: 'The current password' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  password?: string;

  @ApiPropertyOptional({ description: 'The code from POST /me/account-deletion/otp', example: '123456' })
  @IsOptional()
  @IsString()
  @Length(4, 8)
  otp?: string;

  @ApiPropertyOptional({ description: 'Why the person is leaving (optional, kept for the team)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
