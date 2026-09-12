import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống' })
  @IsString()
  @MaxLength(4000, { message: 'Tin nhắn tối đa 4000 ký tự' })
  content: string;
}
