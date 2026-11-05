import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** The value as sent, so `null` (clear the pin) is not turned into 0 by implicit conversion. */
const raw = ({ obj, key }: { obj: Record<string, unknown>; key: string }) => obj[key];

/** A branch (ATT-15): a name, an optional address, a pin (latitude and longitude together) and a radius. */
export class CreateBranchDto {
  @ApiProperty({ example: 'Farmgate' })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'House 12, Road 3' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @ApiPropertyOptional({ example: 23.7577, description: 'Latitude of the pin; send with geo_lng' })
  @IsOptional()
  @Transform(raw)
  @IsLatitude()
  geo_lat?: number | null;

  @ApiPropertyOptional({ example: 90.3897, description: 'Longitude of the pin; send with geo_lat' })
  @IsOptional()
  @Transform(raw)
  @IsLongitude()
  geo_lng?: number | null;

  @ApiPropertyOptional({ example: 100, description: "Check-in radius in metres (25–1000); default: the main branch's radius" })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(1000)
  checkin_radius_m?: number;
}

/** Fields left out are unchanged; `null` clears the address or the pin (both coordinates together). */
export class UpdateBranchDto {
  @ApiPropertyOptional({ example: 'Farmgate', nullable: true, description: 'Only the main branch can have no name' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  name?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @ApiPropertyOptional({ example: 23.7577, nullable: true })
  @IsOptional()
  @Transform(raw)
  @IsLatitude()
  geo_lat?: number | null;

  @ApiPropertyOptional({ example: 90.3897, nullable: true })
  @IsOptional()
  @Transform(raw)
  @IsLongitude()
  geo_lng?: number | null;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(1000)
  checkin_radius_m?: number;
}
