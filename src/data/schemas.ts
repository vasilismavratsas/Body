import { z } from 'zod';

/** Status labels per data-model v0.7. */
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

/** Shared display labels — map, table, detail panel (round-2 §A.2). */
export const PART_DISPLAY_LABELS: Record<PartId, string> = {
  arms: 'Arms',
  shoulders: 'Shoulders',
  chest: 'Chest',
  upper_back: 'Upper back',
  core: 'Core',
  lower_back: 'Lower back',
  hips_glutes: 'Hips & glutes',
  legs: 'Legs',
};

export const ACTIVITY_GROUPS = [
  'Cardio',
  'Sports',
  'Strength',
  'Outdoor',
  'Daily life',
] as const;
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number];
export const ActivityGroupSchema = z.enum(ACTIVITY_GROUPS);

export const INTENSITIES = ['light', 'moderate', 'vigorous'] as const;
export type Intensity = (typeof INTENSITIES)[number];
export const IntensitySchema = z.enum(INTENSITIES);

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
  index: z.record(PartIdSchema, NumberValuedSchema).optional(),
  mass: z.record(PartIdSchema, NumberValuedSchema).optional(),
  sourceRefs: z.array(z.string()),
});
export type ShareRow = z.infer<typeof ShareRowSchema>;

export const LiftChildSchema = z.object({
  exerciseId: z.string().min(1),
  name: z.string().min(1),
  shares: z.object({
    index: z.record(PartIdSchema, NumberValuedSchema),
    mass: z.record(PartIdSchema, NumberValuedSchema),
  }),
  shareRowId: z.string().min(1),
  metByIntensity: z.object({
    light: z.object({ code: StringValuedSchema, MET: NumberValuedSchema }),
    moderate: z.object({ code: StringValuedSchema, MET: NumberValuedSchema }),
    vigorous: z.object({ code: StringValuedSchema, MET: NumberValuedSchema }),
  }),
  defaultIntensity: IntensitySchema,
  sourceRefs: z.array(z.string()),
});
export type LiftChild = z.infer<typeof LiftChildSchema>;

export const ActivitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['activity', 'liftParent']),
  group: ActivityGroupSchema,
  searchTerms: z.array(z.string()),
  compendiumCode: StringValuedSchema,
  met: z.object({
    median: NumberValuedSchema,
    sigmaLog: NumberValuedSchema,
    sigmaSource: z.enum(['cv0.20', 'range89']),
    cv: NumberValuedSchema.optional(),
  }),
  shareRow: z.string().min(1),
  shareRowId: z.string().min(1),
  catalogActivityId: z.string().min(1),
  metId: z.string().min(1),
  lowN: z.boolean(),
  activityToSharePairing: StringValuedSchema,
  children: z.array(LiftChildSchema).optional(),
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
  shareRule: z.object({
    assumedIndexScale: NumberValuedSchema,
  }),
  colorScale: z.object({
    bandEdges: NumberArrayValuedSchema,
    bandNames: StringArrayValuedSchema,
    mCap: NumberValuedSchema,
    rampStops: StringArrayValuedSchema,
  }),
  highUncertaintyLog2Width: NumberValuedSchema,
  massSex: StringValuedSchema,
  seedDefault: NumberValuedSchema,
  lowNThreshold: NumberValuedSchema,
  swapFrom: StringValuedSchema,
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

export const BodyPartsFileSchema = z.array(BodyPartSchema).length(8);
export const ShareRowsFileSchema = z.record(z.string(), ShareRowSchema);
export const ActivitiesFileSchema = z.array(ActivitySchema).length(25);

/** Format a multiple for display: ">2.5×" when saturated; "1×" when lo≈hi. */
export function formatMultiple(
  median: number,
  lo: number,
  hi: number,
  saturated: boolean,
  mCap = 2.5,
): string {
  if (saturated || median >= mCap) return `>${String(mCap)}×`;
  const rMed = Math.round(median * 100) / 100;
  const rLo = Math.round(lo * 100) / 100;
  const rHi = Math.round(hi * 100) / 100;
  if (rLo === rHi) return `${String(rLo)}×`;
  return `${String(rMed)}×`;
}

export function formatInterval(
  lo: number,
  hi: number,
  saturated: boolean,
  mCap = 2.5,
): string {
  const rLo = Math.round(lo * 100) / 100;
  const rHi = Math.round(hi * 100) / 100;
  if (rLo === rHi) return `${String(rLo)}×`;
  if (saturated) return `${String(rLo)}–>${String(mCap)}×`;
  return `${String(rLo)}–${String(rHi)}×`;
}
