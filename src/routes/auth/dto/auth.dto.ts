import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength,
  Matches,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email!: string;

  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu cần chữ hoa, chữ thường và số',
  })
  password!: string;

  @IsOptional()
  @IsString({ message: 'Họ tên phải là chuỗi ký tự' })
  name?: string;
}

export class LoginDto {
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email!: string;

  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString({ message: 'Mật khẩu không hợp lệ' })
  password!: string;
}

export class VerifyEmailOtpDto {
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email!: string;

  @Length(6, 6, { message: 'Mã OTP gồm 6 chữ số' })
  code!: string;
}

export class ResendOtpDto {
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email!: string;
}

export class Verify2faDto {
  @IsString({ message: 'Token xác thực không hợp lệ' })
  challengeToken!: string;

  @Length(6, 6, { message: 'Mã 2FA gồm 6 chữ số' })
  code!: string;
}

export class Enable2faDto {
  @IsEnum(['EMAIL_OTP', 'TOTP'], { message: 'Phương thức 2FA không hợp lệ' })
  method!: 'EMAIL_OTP' | 'TOTP';
}

export class ConfirmTotpDto {
  @Length(6, 6, { message: 'Mã TOTP gồm 6 chữ số' })
  code!: string;
}

export class Disable2faDto {
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString({ message: 'Mật khẩu không hợp lệ' })
  password!: string;

  @Length(6, 6, { message: 'Mã xác thực gồm 6 chữ số' })
  code!: string;
}
