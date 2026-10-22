import { ConfigService } from '@nestjs/config';

export const getMongoUri = (config: ConfigService): string => {
  const uri = config.get<string>('MONGODB_URI')?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is required for class discussions. Example: mongodb://localhost:27017/tasktaker_chat');
  }
  return uri;
};
