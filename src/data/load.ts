import activitiesJson from './activities.json';
import baselineJson from './baseline.json';
import bodyPartsJson from './bodyParts.json';
import modelConfigJson from './modelConfig.json';
import shareRowsJson from './shareRows.json';
import {
  ActivitiesFileSchema,
  BaselineSchema,
  BodyPartsFileSchema,
  ModelConfigSchema,
  ShareRowsFileSchema,
  type Activity,
  type Baseline,
  type BodyPart,
  type ModelConfig,
  type ShareRow,
} from './schemas';

export const bodyParts: BodyPart[] = BodyPartsFileSchema.parse(bodyPartsJson);
export const shareRows: Record<string, ShareRow> =
  ShareRowsFileSchema.parse(shareRowsJson);
export const activities: Activity[] = ActivitiesFileSchema.parse(activitiesJson);
export const baseline: Baseline = BaselineSchema.parse(baselineJson);
export const modelConfig: ModelConfig = ModelConfigSchema.parse(modelConfigJson);

export function getActivity(id: string): Activity {
  const a = activities.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown activity: ${id}`);
  return a;
}

export function getShareRow(id: string): ShareRow {
  const row = shareRows[id];
  if (!row) throw new Error(`Unknown share row: ${id}`);
  return row;
}

export function getLiftParent(): Activity {
  const a = activities.find((x) => x.kind === 'liftParent');
  if (!a) throw new Error('No liftParent activity in catalog');
  return a;
}
