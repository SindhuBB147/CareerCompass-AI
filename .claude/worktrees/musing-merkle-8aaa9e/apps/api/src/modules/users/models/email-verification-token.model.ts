import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmailVerificationTokenDocument = EmailVerificationToken & Document;

@Schema({ timestamps: true })
export class EmailVerificationToken {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true }) email: string;
  @Prop({ required: true }) tokenHash: string;
  @Prop({ required: true }) expiresAt: Date;
  @Prop({ default: false }) used: boolean;
}

export const EmailVerificationTokenSchema = SchemaFactory.createForClass(EmailVerificationToken);
EmailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
EmailVerificationTokenSchema.index({ userId: 1, tokenHash: 1 });
