import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class MongoChatHealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async ping(): Promise<boolean> {
    if (!this.connection?.db) {
      return false;
    }
    await this.connection.db.admin().command({ ping: 1 });
    return this.connection.readyState === 1;
  }
}
