import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

/**
 * Registers the single shared MongoDB connection. Every feature module
 * imports its own schemas via MongooseModule.forFeature() — this module
 * only handles the connection, not the schemas, so adding a new module
 * never requires touching this file.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const uri = config.get<string>('MONGO_URI') ?? 'mongodb://127.0.0.1:27017/career-compass-dev';
        let safeTarget = 'configured MongoDB URI';
        try {
          const parsed = new URL(uri);
          safeTarget = `${parsed.hostname}:${parsed.port || '27017'}/${parsed.pathname.replace(/^\//, '')}`;
        } catch {
          throw new Error('MONGO_URI is invalid; refusing to start without a valid persistent MongoDB URI.');
        }

        return {
          uri,
          serverSelectionTimeoutMS: 5000,
          connectionFactory: (connection: { on: Function }) => {
            connection.on('connected', () => console.log(`Persistent MongoDB connected (${safeTarget})`));
            connection.on('error', (err: Error) => console.error(`Persistent MongoDB connection error (${safeTarget}):`, err.message));
            return connection;
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
