/** Minimal GeoJSON types for pour-point responses (RFC 7946 subset). */

export interface GeoJsonObject {
  type: string;
  bbox?: number[];
}

export interface Geometry extends GeoJsonObject {
  coordinates?: unknown;
  geometries?: Geometry[];
}

export interface Feature<G extends Geometry = Geometry> extends GeoJsonObject {
  type: "Feature";
  geometry: G | null;
  properties: Record<string, unknown> | null;
  id?: string | number;
}

export interface FeatureCollection<G extends Geometry = Geometry> extends GeoJsonObject {
  type: "FeatureCollection";
  features: Array<Feature<G>>;
}
