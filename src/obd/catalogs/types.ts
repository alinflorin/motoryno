/**
 * Shape of the vendored Delphi-OBD catalog files (github.com/erdesigns-eu/Delphi-OBD),
 * trimmed to the fields this app actually reads. See `assets/obd-catalogs/` for the
 * bundled data and `registry.ts`/`wmiIndex.json` for how a catalog is located.
 */

export interface DidDecoder {
  kind: string;
  scale?: number;
  offset?: number;
  unit?: string;
}

export interface DidEntry {
  did: string;
  name: string;
  description?: string;
  source?: string;
  verified?: boolean;
  /** CAN header/ECU address this DID targets (e.g. "0x7E0"), if the request needs to be aimed at a specific module. */
  ecu_address?: string;
  decoder?: DidDecoder;
}

export interface EcuEntry {
  address: string;
  name: string;
  common_name?: string;
}

export interface ManufacturerCatalog {
  $schema?: string;
  version?: number;
  manufacturer_key: string;
  display_name: string;
  applicable_wmis?: string[];
  default_source?: string;
  ecus?: EcuEntry[];
  dids: DidEntry[];
}

export interface DtcEntry {
  code: string;
  severity?: string;
  description: string;
  possible_causes?: string[];
  symptoms?: string[];
  repair_guidance?: string[];
  verified?: boolean;
  monitor_type?: string;
  freeze_frame_relevant?: boolean;
  related_dids?: string[];
  related_routines?: string[];
}

export interface DtcCatalog {
  $schema?: string;
  version?: number;
  name: string;
  default_source?: string;
  dtcs: DtcEntry[];
}

export type Catalog = ManufacturerCatalog | DtcCatalog;

export function isDtcCatalog(catalog: Catalog): catalog is DtcCatalog {
  return Array.isArray((catalog as DtcCatalog).dtcs);
}
