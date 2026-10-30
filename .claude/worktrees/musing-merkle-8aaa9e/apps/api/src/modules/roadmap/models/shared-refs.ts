import { Prop } from '@nestjs/mongoose';

// Shared Mongoose subdocument classes for the roadmap module — both
// CareerTemplate (the admin-managed source) and Roadmap (the per-student
// generated instance) embed the same resource/certification/project shape,
// so they're defined once here rather than duplicated in each schema file.

export class ResourceRefSchema {
  @Prop({ required: true }) title: string;
  @Prop() url?: string;
  @Prop({ required: true }) provider: string;
  @Prop({ enum: ['documentation', 'course', 'video', 'book', 'practice_platform', 'repository', 'paper', 'article'], required: true })
  type: string;
}

export class CertificationRefSchema {
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) provider: string;
  @Prop() url?: string;
}

export class ProjectRefSchema {
  @Prop({ required: true }) title: string;
  @Prop({ enum: ['beginner', 'intermediate', 'advanced', 'industry', 'open_source', 'research', 'portfolio', 'hackathon'], required: true })
  level: string;
  @Prop({ required: true }) description: string;
}
