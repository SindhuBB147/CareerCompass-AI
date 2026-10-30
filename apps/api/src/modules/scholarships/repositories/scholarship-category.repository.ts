import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScholarshipCategory, ScholarshipCategoryDocument } from '../models/scholarship-category.model';

@Injectable()
export class ScholarshipCategoryRepository {
  constructor(@InjectModel(ScholarshipCategory.name) private readonly model: Model<ScholarshipCategoryDocument>) {}

  listAll() { return this.model.find().sort({ sortOrder: 1, name: 1 }).exec(); }
  findBySlug(slug: string) { return this.model.findOne({ slug }).exec(); }
  findById(id: string) { return this.model.findById(id).exec(); }
  create(data: Partial<ScholarshipCategory>) { return this.model.create(data); }
  update(id: string, data: Partial<ScholarshipCategory>) {
    return this.model.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
  }
  delete(id: string) { return this.model.findByIdAndDelete(id).exec(); }
  countAll() { return this.model.countDocuments().exec(); }
}
