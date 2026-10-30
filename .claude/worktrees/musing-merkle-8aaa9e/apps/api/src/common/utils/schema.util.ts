/**
 * Mongoose's `id` virtual (a string alias for `_id`) exists on every
 * document by default but is NOT included in `res.json()` output unless
 * `toJSON.virtuals` is turned on — plain `@Schema({ timestamps: true })`
 * models in this codebase serialize `_id` only, and existing frontend code
 * that needs `.id` (e.g. UserAuthContext's `refreshUser`) works around it
 * ad-hoc with `data.id ?? data._id`. Spreading this into a model's
 * `@Schema()` options fixes it at the source instead, so every response
 * from that model genuinely has `.id`.
 */
export const WITH_ID_JSON = {
  toJSON: {
    virtuals: true,
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
};
