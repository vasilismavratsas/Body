import type { KeyboardEvent, MouseEvent } from 'react';
import type { PartResult } from '../core/model';
import type { PartId } from '../data/schemas';
import { PART_IDS } from '../data/schemas';
import bodyPolygons from './bodyPolygons.json';
import { displayInterval, displayMultiple, partLabel } from './displayLabels';

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
  /** One select handler for click, tap, Enter/Space (round-2 §A.1). */
  function selectPart(id: PartId) {
    onSelect(id);
  }

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
              className="decorative"
            />
          </pattern>
        </defs>
        {/* decorative silhouette — pointer-events: none */}
        <ellipse
          cx="50"
          cy="12"
          rx="10"
          ry="12"
          className="body-silhouette decorative"
          pointerEvents="none"
        />
        {PART_IDS.map((id) => {
          const polys = polygons[id] ?? [];
          if (polys.length === 0) return null;
          const r = partResult(parts, id);
          const fill = r?.color ?? '#2E7D32';
          const uncertain = Boolean(r?.highUncertainty) || mostlyAssumption[id];
          const hatch = r?.straddlesCutoff === true;
          const isSelected = selected === id;
          const label = `${partLabel(id)}, ${r?.band ?? 'green'}, about ${displayMultiple(r?.median ?? 1, r?.lo89 ?? 1, r?.hi89 ?? 1, r?.saturated ?? false)}`;
          return (
            <g
              key={id}
              id={`${name}-${id}`}
              data-testid={`region-${name}-${id}`}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={isSelected}
              className={`body-part${isSelected ? ' is-selected' : ''}${uncertain ? ' is-uncertain' : ''}`}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                selectPart(id);
              }}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectPart(id);
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
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                />
              ))}
              {/* hatching overlay — decorative, no pointer events (round-2 §A.1) */}
              {hatch
                ? polys.map((pts, i) => (
                    <polygon
                      key={`h-${id}-${String(i)}`}
                      points={pts}
                      fill={`url(#hatch-${name})`}
                      className="decorative"
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
      <table className="parts-table">
        <caption>Text equivalent of the body map</caption>
        <thead>
          <tr>
            <th scope="col">Part</th>
            <th scope="col">Multiple</th>
            <th scope="col">Likely range</th>
            <th scope="col">Band</th>
            <th scope="col">Chance of red</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.part}>
              <td>{partLabel(p.part)}</td>
              <td>{displayMultiple(p.median, p.lo89, p.hi89, p.saturated)}</td>
              <td>{displayInterval(p.lo89, p.hi89, p.saturated)}</td>
              <td>{p.band}</td>
              <td>{Math.round(p.pRed * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Legend() {
  // Swatches ≥ 24×24 px, 1 px contrasting border, text label (round-2 §A.3)
  return (
    <ul className="legend" aria-label="Map legend">
      <li>
        <span className="swatch ramp" aria-hidden />
        <span>
          Color ramp on log₂(multiple), full red at 2.5× (bands 1.15 / 1.4 / 1.8)
        </span>
      </li>
      <li>
        <span className="swatch hatch" aria-hidden />
        <span>Soft hatching: 89% range crosses two or more band edges</span>
      </li>
      <li>
        <span className="swatch dotted" aria-hidden />
        <span>
          Desaturated + dotted outline: high uncertainty or mostly ASSUMPTION shares
        </span>
      </li>
    </ul>
  );
}
