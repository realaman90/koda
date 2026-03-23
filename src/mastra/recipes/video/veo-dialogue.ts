/**
 * Video Recipe: Veo Dialogue Scene
 *
 * Lip-sync conversation, problem/solution narrative, voiceover for Veo 3/3.1.
 * ~1.5K tokens when injected.
 */

export const VEO_DIALOGUE_RECIPE = `
<recipe name="veo-dialogue">
<title>Dialogue Scene (Veo)</title>
<description>Lip-sync conversations, problem/solution narratives, and voiceover narration optimized for Veo 3/3.1. Uses says: syntax (not quotes), SFX:/Ambient: audio prefixes, and (no subtitles) suffix.</description>

<dialogue-formatting>
CRITICAL: Use "says:" syntax, NOT quotation marks. Quotes trigger burned-in subtitles.
- Correct: The barista says: here is your order, enjoy
- Wrong: The barista says "here is your order, enjoy"
Always append (no subtitles) at the end of the prompt.
</dialogue-formatting>

<audio-formatting>
Use explicit prefixes for sound design:
- SFX: door creaks open, glass clinks
- Ambient: busy cafe chatter, rain on window
These go at the end of the scene description, before (no subtitles).
</audio-formatting>

<templates>
<template name="conversation-scene">
Two-person dialogue with natural lip-sync.

Prompt structure:
\`\`\`
Interior bright cafe, morning. A woman in a denim jacket sits across from a man in a gray sweater. The woman says: I think we should launch next week. The man nods and says: agreed, let us finalize the deck tonight. Medium two-shot, shallow DOF, warm natural light. Ambient: cafe chatter, espresso machine hiss. (no subtitles). 6s.
\`\`\`
</template>

<template name="problem-solution-narrative">
Short narrative arc: problem introduced, solution delivered.

Prompt structure:
\`\`\`
A frustrated man at a messy desk says: I cannot find anything in this chaos. He sighs. He opens a sleek app on his tablet, the screen glows. He smiles and says: now everything is organized in one place. SFX: notification chime. Medium close-up, office light. (no subtitles). 8s.
\`\`\`
</template>

<template name="voiceover-narration">
Visual narrative with off-screen narrator voice.

Prompt structure:
\`\`\`
Aerial drone shot of a coastal town at sunrise, waves lapping the shore. A narrator says: every morning, this town wakes to the sound of the sea. Cut to a fisherman walking along the dock, nets over his shoulder. Ambient: ocean waves, distant seagulls. (no subtitles). 8s.
\`\`\`
</template>
</templates>

<duration-guide>
- 4s: single line of dialogue, reaction shot
- 6s: short exchange (2-3 lines), standard conversation beat
- 8s: mini-narrative with setup and payoff, voiceover scenes
</duration-guide>

<character-consistency>
Use a scene bible approach: define character appearance in detail once,
then reference by name or description in subsequent shots.
Example first mention: "A tall woman with short red hair, wearing a navy blazer"
Subsequent: "The red-haired woman in the navy blazer says:..."
</character-consistency>

<tips>
- NEVER use quotation marks around dialogue; always use "says:" syntax
- Always end prompts with (no subtitles) to prevent burned-in text
- SFX: and Ambient: prefixes are parsed by Veo's audio model
- Keep dialogue natural and short; 1-2 sentences per character per shot
- Medium shots and close-ups work best for dialogue; avoid wide shots
- Veo handles 2 speakers well; 3+ speakers in one shot degrades lip-sync quality
- 6s is the sweet spot for conversational exchanges
</tips>
</recipe>
`;
