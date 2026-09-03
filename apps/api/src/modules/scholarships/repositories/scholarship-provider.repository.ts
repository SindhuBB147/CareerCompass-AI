import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScholarshipProvider, ScholarshipProviderDocument } from '../models/scholarship-provider.model';

@Injectable()
export class ScholarshipProviderRepository {
  constructor(@InjectModel(ScholarshipProvider.name) private readonly model: Model<ScholarshipProviderDocument>) {}

  listAll() { return this.model.find().sort({ name: 1 }).exec(); }
  findById(id: string) { return this.model.findById(id).exec(); }
  findByName(name: string) { return this.model.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } }).exec(); }
  create(data: Partial<ScholarshipProvider>) { return this.model.create(data); }
  update(id: string, data: Partial<ScholarshipProvider>) {
    return this.model.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
  }
  delete(id: string) { return this.model.findByIdAndDelete(id).exec(); }
}
