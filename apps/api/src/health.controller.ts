import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from './common/decorators/auth.decorators';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly mongoConnection: Connection) {}

  @Get() @Public()
  check() {
    const connected = this.mongoConnection.readyState === 1;
    return {
      status: connected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      mongodb: {
        status: connected ? 'connected' : 'disconnected',
        mode: 'persistent',
        database: this.mongoConnection.db?.databaseName ?? null,
      },
    };
  }
}
