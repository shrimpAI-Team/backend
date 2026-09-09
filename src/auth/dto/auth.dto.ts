import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsEmail() email!: string;

  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu cần chữ hoa, chữ thường và số',
  })
  password!: string;

  @IsOptional() @IsString() name?: string;
}

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}

export class VerifyEmailOtpDto {
  @IsEmail() email!: string;
  @Length(6, 6) code!: string;
}

export class ResendOtpDto {
  @IsEmail() email!: string;
}

export class Verify2faDto {
  @IsString() challengeToken!: string;
  @Length(6, 6) code!: string;
}

export class Enable2faDto {
  @IsEnum(['EMAIL_OTP', 'TOTP']) method!: 'EMAIL_OTP' | 'TOTP';
}

export class ConfirmTotpDto {
  @Length(6, 6) code!: string;
}

export class Disable2faDto {
  @IsString() password!: string;
  @Length(6, 6) code!: string;
}
