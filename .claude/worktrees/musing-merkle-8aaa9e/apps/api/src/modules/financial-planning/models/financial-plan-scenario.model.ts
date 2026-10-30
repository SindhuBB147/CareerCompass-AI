import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FinancialPlanScenarioDocument = FinancialPlanScenario & Document;

/**
 * Financial Planner Memory — the module had zero persistence before this
 * (every calculation was compute-and-discard). Only the two authenticated
 * endpoints (dashboard, comparison) can attach a userId here; the public
 * loan-calculator/budget-planner/fee-breakdown/hostel-living tools stay
 * anonymous/stateless by design (no auth on those routes to attach memory
 * to). Append-only, capped read (see FinancialPlanScenarioService), mirroring
 * SearchHistory's shape/index style.
 */
@Schema({ timestamps: true })
export class FinancialPlanScenario {
  @Prop({ required: true }) userId: string;
  @Prop({ enum: ['dashboard', 'comparison'], required: true }) type: string;
  @Prop({ type: Object, required: true }) input: Record<string, unknown>;
  @Prop({ type: Object, required: true }) resultSummary: Record<string, unknown>;
  @Prop({ default: false }) isSaved: boolean;
  @Prop() label?: string;
}

export const FinancialPlanScenarioSchema = SchemaFactory.createForClass(FinancialPlanScenario);
FinancialPlanScenarioSchema.index({ userId: 1, createdAt: -1 });
