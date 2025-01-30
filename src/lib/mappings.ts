import { BILDUNGSSTUFE_MAPPING, FACH_MAPPING } from './constants';

export type BildungsstufeKey = keyof typeof BILDUNGSSTUFE_MAPPING;
export type FachKey = keyof typeof FACH_MAPPING;

export function getBildungsstufeUri(key: BildungsstufeKey): string {
  return BILDUNGSSTUFE_MAPPING[key];
}

export function getFachUri(key: FachKey): string {
  return FACH_MAPPING[key];
}

export function getBildungsstufeFromUri(uri: string): BildungsstufeKey | undefined {
  const entry = Object.entries(BILDUNGSSTUFE_MAPPING).find(([_, value]) => value === uri);
  return entry ? (entry[0] as BildungsstufeKey) : undefined;
}

export function getFachFromUri(uri: string): FachKey | undefined {
  const entry = Object.entries(FACH_MAPPING).find(([_, value]) => value === uri);
  return entry ? (entry[0] as FachKey) : undefined;
}