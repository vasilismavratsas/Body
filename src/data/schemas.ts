import { z } from 'zod';

/** Status labels per data-model v0.6.1. */
export const StatusSchema = z.enum([
  'cited',
  'stand-in',
  'ASSUMPTION',
  'GAP',
  'PLACEHOLDER',
]);
export type Status = z.infer<typeof StatusSchema>;

export const PART_IDS = [
  'arms',
  'shoulders',
  'chest',
  'upper_back',
  'core',
  'lower_back',
  'hips_glutes',
  'legs',
] as const;
export type PartId = (typeof PART_IDS)[number];
export const PartIdSchema = z.enum(PART_IDS);

/** Every number is {value, status, sourceRefs}. */
export function valuedSchema<T extends z.ZodType>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    status: StatusSchema,
    sourceRefs: z.array(z.string()).min(1),
  });
}

export const NumberValuedSchema = valuedSchema(z.number());
export const StringValuedSchema = valuedSchema(z.string().min(1));
export const NumberArrayValuedSchema = valuedSchema(z.array(z.number()).min(1));
export const StringArrayValuedSchema = valuedSchema(z.array(z.string().min(1)).min(1));

export const BodyPartSchema = z.object({
  id: PartIdSchema,
  label: z.string().min(1),
  muscleMassFraction: NumberValuedSchema,
});
export type BodyPart = z.infer<typeof BodyPartSchema>;

export const ShareRowSchema = z.object({
  id: z.string().min(1),
  sbar: z.record(PartIdSchema, NumberValuedSchema),
  kappa: z.record(PartIdSchema, NumberValuedSchema),
  cellStatus: z.record(PartIdSchema, StatusSchema),
  sourceRefs: z.array(z.string()),
});
export type ShareRow = z.infer<typeof ShareRowSchema>;

export const ActivitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  top10Rank: z.number().int().positive(),
  compendiumCode: StringValuedSchema,
  met: z.object({
    median: NumberValuedSchema,
    sigmaLog: NumberValuedSchema,
    cv: NumberValuedSchema,
  }),
  shareRowId: z.string().min(1),
  activityToSharePairing: StringValuedSchema,
  prevalencePct: NumberValuedSchema.optional(),
  sourceRefs: z.array(z.string()).min(1),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const BaselineGroupSchema = z.object({
  activityId: z.string().min(1),
  atusCode: StringValuedSchema,
  compendiumCode: StringValuedSchema,
  met: NumberValuedSchema,
  minutes: z.object({
    mean: NumberValuedSchema,
    sd: NumberValuedSchema,
    median: NumberValuedSchema,
    p10: NumberValuedSchema,
    p90: NumberValuedSchema,
  }),
  participationRate: NumberValuedSchema,
  n: NumberValuedSchema,
  shareRowId: StringValuedSchema,
  mappingRationale: z.string(),
  status: StatusSchema,
  sourceRefs: z.array(z.string()).min(1),
});

export const BaselineSchema = z.object({
  population: StringValuedSchema,
  designEffect: NumberValuedSchema,
  perPersonGross: z.object({
    sd: NumberValuedSchema,
    p10: NumberValuedSchema,
    p50: NumberValuedSchema,
    p90: NumberValuedSchema,
  }),
  totalNetMetH: NumberValuedSchema,
  totalGrossMetH: NumberValuedSchema,
  groups: z.array(BaselineGroupSchema).min(1),
});
export type Baseline = z.infer<typeof BaselineSchema>;

export const ModelConfigSchema = z.object({
  version: z.string().min(1),
  energyMode: StringValuedSchema,
  nDraws: NumberValuedSchema,
  intervalProb: NumberValuedSchema,
  offset: z.object({
    phi: NumberValuedSchema,
  }),
  metCv: NumberValuedSchema,
  metSigmaLog: NumberValuedSchema,
  designEffect: NumberValuedSchema,
  colorScale: z.object({
    bandEdges: NumberArrayValuedSchema,
    bandNames: StringArrayValuedSchema,
    mCap: NumberValuedSchema,
    rampStops: StringArrayValuedSchema,
  }),
  highUncertaintyLog2Width: NumberValuedSchema,
  massSex: StringValuedSchema,
  seedDefault: NumberValuedSchema,
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

export const BodyPartsFileSchema = z.array(BodyPartSchema).length(8);
export const ShareRowsFileSchema = z.record(z.string(), ShareRowSchema);
export const ActivitiesFileSchema = z.array(ActivitySchema).length(10);
