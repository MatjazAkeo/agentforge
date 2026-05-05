// src/config/virtual-models.ts
//
// "Virtual" model entries — selectable in the LLM Call / Agent dropdowns and
// the General-tab default-model picker, but NOT part of the user's saved
// model catalog (Settings → Models). They're hardcoded sentinels OpenRouter
// understands at request time, e.g. `openrouter/free` auto-routes to a
// free-tier model.

import type { ModelEntry } from '@/stores/settings';

export const VIRTUAL_MODELS: ModelEntry[] = [
  {
    id: 'openrouter/free',
    displayName: 'OpenRouter Free (auto)',
    supportsTools: true,
    supportsJsonMode: false,
    notes: 'OpenRouter routes the request to one of its free-tier models.',
  },
];

/** Combine virtual entries with the user's saved catalog for use in any
 *  "pick a model" dropdown. Virtual entries appear first so they're the
 *  default option for fresh installs. */
export function modelOptionsForDropdown(userModels: ModelEntry[]): ModelEntry[] {
  return [...VIRTUAL_MODELS, ...userModels];
}
