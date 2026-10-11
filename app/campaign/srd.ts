/**
 * The SRDs whose monsters and spells are bundled with Guildhall: SRD 5.1 (the 2014 rules) and
 * SRD 5.2.1 (2024). Isomorphic.
 */
export const SRD_SOURCES = ["srd-5.1", "srd-5.2"] as const;
export type SrdSource = (typeof SRD_SOURCES)[number];

/** Each SRD's name, as its licence asks it to be credited. */
export const SRD_DOCUMENTS: Record<SrdSource, string> = {
  "srd-5.1": "SRD 5.1",
  "srd-5.2": "SRD 5.2.1",
};

/** The rules each SRD is for, as the table knows them. */
export const SRD_RULES: Record<SrdSource, "2014" | "2024"> = {
  "srd-5.1": "2014",
  "srd-5.2": "2024",
};
