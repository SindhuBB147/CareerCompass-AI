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
        let uri = config.get<string>('MONGO_URI');
        if (!uri) {
          try {
            const { MongoMemoryServer } = await import('mongodb-memory-server');
            const mongod = await MongoMemoryServer.create({ instance: { dbName: 'career-compass-dev' } });
            uri = mongod.getUri();
            console.log('Started in-memory MongoDB at', uri);
          } catch {
            uri = 'mongodb://localhost:27017/career-compass-dev';
          }
        }
        return {
          uri,
          connectionFactory: (connection: { on: Function }) => {
            connection.on('connected', () => console.log('MongoDB connected'));
            connection.on('error', (err: Error) => console.error('MongoDB error:', err.message));
            return connection;
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
