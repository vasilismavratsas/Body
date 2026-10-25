import type { PartResult } from '../core/model';
import type { PartId } from '../data/schemas';
import { PART_IDS } from '../data/schemas';
import bodyPolygons from './bodyPolygons.json';

type Props = {
  parts: PartResult[];
  selected: PartId | null;
  onSelect: (part: PartId) => void;
  mostlyAssumption: Record<PartId, boolean>;
};

function partResult(parts: PartResult[], id: PartId): PartResult | undefined {
  return parts.find((p) => p.part === id);
}

function View({
  name,
  polygons,
  parts,
  selected,
  onSelect,
  mostlyAssumption,
}: {
  name: string;
  polygons: Record<string, string[]>;
  parts: PartResult[];
  selected: PartId | null;
  onSelect: (part: PartId) => void;
  mostlyAssumption: Record<PartId, boolean>;
}) {
  return (
    <figure className="body-view">
      <figcaption>{name}</figcaption>
      <svg
        viewBox={bodyPolygons.viewBox}
        role="img"
        aria-label={`${name} body map`}
        className="body-svg"
      >
        <defs>
          <pattern
            id={`hatch-${name}`}
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="4"
              stroke="rgba(0,0,0,0.35)"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>
        {/* subtle silhouette backdrop */}
        <ellipse cx="50" cy="12" rx="10" ry="12" className="body-silhouette" />
        {PART_IDS.map((id) => {
          const polys = polygons[id] ?? [];
          if (polys.length === 0) return null;
          const r = partResult(parts, id);
          const fill = r?.color ?? '#2E7D32';
          const uncertain = Boolean(r?.highUncertainty) || mostlyAssumption[id];
          const hatch = r?.straddlesCutoff === true;
          const isSelected = selected === id;
          const label = `${id.replace('_', ' ')}, ${r?.band ?? 'green'}, about ${String(r?.median ?? 1)}×`;
          return (
            <g
              key={id}
              id={`${name}-${id}`}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={isSelected}
              className={`body-part${isSelected ? ' is-selected' : ''}${uncertain ? ' is-uncertain' : ''}`}
              onClick={() => {
                onSelect(id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(id);
                }
              }}
            >
              {polys.map((pts, i) => (
                <polygon
                  key={`${id}-${String(i)}`}
                  points={pts}
                  fill={fill}
                  stroke={uncertain ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.2)'}
                  strokeWidth={isSelected ? 1.4 : 0.6}
                  strokeDasharray={uncertain ? '2 1.5' : undefined}
                  className={uncertain ? 'desaturated' : undefined}
                />
              ))}
              {hatch
                ? polys.map((pts, i) => (
                    <polygon
                      key={`h-${id}-${String(i)}`}
                      points={pts}
                      fill={`url(#hatch-${name})`}
                      pointerEvents="none"
                    />
                  ))
                : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function BodyMap(props: Props) {
  const { parts, selected, onSelect, mostlyAssumption } = props;
  return (
    <section className="body-map" aria-labelledby="map-heading">
      <h2 id="map-heading">Today’s body map</h2>
      <p className="lede">
        Color is how much work each part did versus an average non-exerciser day. Green ≈
        1×.
      </p>
      <div className="body-views">
        <View
          name="Front"
          polygons={bodyPolygons.anterior}
          parts={parts}
          selected={selected}
          onSelect={onSelect}
          mostlyAssumption={mostlyAssumption}
        />
        <View
          name="Back"
          polygons={bodyPolygons.posterior}
          parts={parts}
          selected={selected}
          onSelect={onSelect}
          mostlyAssumption={mostlyAssumption}
        />
      </div>
      <Legend />
      <table className="sr-table">
        <caption>Text equivalent of the body map</caption>
        <thead>
          <tr>
            <th scope="col">Part</th>
            <th scope="col">Multiple</th>
            <th scope="col">Likely range</th>
            <th scope="col">Band</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.part}>
              <td>{p.part}</td>
              <td>{p.median}×</td>
              <td>
                {p.lo89}–{p.hi89}×
              </td>
              <td>{p.band}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Legend() {
  return (
    <ul className="legend" aria-label="Map legend">
      <li>
        <span className="swatch ramp" aria-hidden />
        Color ramp on log₂(multiple), full red at 2.5× (bands 1.15 / 1.4 / 1.8)
      </li>
      <li>
        <span className="swatch hatch" aria-hidden />
        Soft hatching: 89% range crosses two or more band edges
      </li>
      <li>
        <span className="swatch dotted" aria-hidden />
        Desaturated + dotted outline: high uncertainty or mostly ASSUMPTION shares
      </li>
    </ul>
  );
}
