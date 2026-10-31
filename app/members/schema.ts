/** zod schemas for member data that crosses a trust boundary: the data file. */
import { z } from "zod";
import { THEMES } from "~/theme/themes";
import type { Member } from "./types";

/** Discord IDs are 17 to 20 digits. */
export const discordIdSchema = z.string().regex(/^\d{17,20}$/, "Not a Discord user ID");

export const memberSchema: z.ZodType<Member> = z.object({
  discordId: discordIdSchema,
  name: z.string().max(100),
  username: z.string().max(100),
  status: z.enum(["pending", "approved"]),
  playerId: z.string().min(1).optional(),
  sessionKey: z.string().min(16),
  requestedAt: z.iso.datetime(),
  approvedAt: z.iso.datetime().optional(),
  lastSignInAt: z.iso.datetime(),
  // A look that's gone (or a typo) falls back to the default rather than refusing the file.
  theme: z.enum(THEMES).optional().catch(undefined),
  // Damaged dice settings fall back to the defaults (dice on), never refusing the file.
  dice: z
    .object({
      off: z.boolean().optional().catch(undefined),
      quiet: z.boolean().optional().catch(undefined),
      given: z.array(z.string().max(40)).max(50).optional().catch(undefined),
      set: z.string().max(40).optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
});
