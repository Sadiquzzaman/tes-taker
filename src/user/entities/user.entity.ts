import { Exclude } from "class-transformer";
import { IsEmail, IsNotEmpty } from "class-validator";
import { CustomBaseEntity } from "src/common/common-entities/custom-base.enity";
import { RolesEnum } from "src/common/enums/roles.enum";
import {
  Column,
  Entity,
  Index
} from "typeorm";

@Entity("users")
export class UserEntity extends CustomBaseEntity {
  @Column({ name: "full_name", type: "varchar", length: "100" })
  @IsNotEmpty()
  full_name: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  @Index({ unique: true })
  @IsEmail()
  email: string;

  @Column({
    type: "varchar",
    name: "password",
    length: 100,
  })
  @Exclude()
  password: string;

  @Column({
    type: "varchar",
    name: "phone",
    length: 15,
    nullable: false,
  })
  @Index({ unique: true })
  @IsNotEmpty()
  phone: string;

  @Column({
    type: "boolean",
    name: "is_otp_verified",
    default: false,
  })
  is_otp_verified: boolean;

  @Column({
    type: "boolean",
    name: "is_verified",
    default: false,
  })
  is_verified: boolean;

  @Column({
    type: "enum",
    enum: RolesEnum,
    default: RolesEnum.STUDENT,
  })
  role: RolesEnum;

  @Column({
    type: "varchar",
    name: "refresh_token",
    length: 1000,
    nullable: true,
  })
  @Index({ unique: true })
  refresh_token: string;

}
