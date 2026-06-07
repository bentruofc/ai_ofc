// ---
// Filename: ../ComfyUI_INSTARAW/js/reality_prompt_generator.js
// Reality Prompt Generator (RPG) - Full JavaScript UI Implementation
// Following AdvancedImageLoader patterns exactly
// ---

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { renderComboCards, getComboMaxLength } from "./shared/combo-cards.js";

// Expression list for social media photos (15 expressions)
const EXPRESSION_LIST = [
	"Neutral/Natural",
	"Smiling/Happy",
	"Laughing/Joyful",
	"Sexy/Seductive",
	"Flirty/Playful",
	"Blowing a Kiss",
	"Winking",
	"Pouty/Duck Face",
	"Surprised/Excited",
	"Confident/Fierce",
	"Shy/Cute",
	"Ahegao/Pleasure",
	"Biting Lip",
	"Tongue Out",
	"Sultry/Smoldering"
];

// ═══════════════════════════════════════════════════════════════════════════
// MODEL-SPECIFIC INSTRUCTION PRESETS (for prompt formatting per model)
// Available in both txt2img and img2img modes
// ═══════════════════════════════════════════════════════════════════════════
const MODEL_INSTRUCTION_PRESETS = {
	"none": {
		label: "None (default)",
		instructions: "",
		model: null,
		badge: null
	},
	// ─────────────────────────────────────────────────────────────────────────
	// INSTARAW GRILLE MODE - PHOTOREALISTIC (UV/blacklight drip culture aesthetic)
	// ─────────────────────────────────────────────────────────────────────────
	"instaraw_signature": {
		label: "✨ INSTARAW Grille Mode",
		model: null,
		badge: "✨ INSTARAW",
		instructions: `INSTARAW GRILLE MODE: ULTIMATE DRIP GENERATION PROTOCOL

Generate prompts fusing MAXIMUM DRIP CULTURE with hyper-realistic degraded phone photography. Any subject—human, animal, mythical, mechanical, abstract—gets baptized in ice and captured in pitch blackness through real trash phone hardware.

GOLDEN RULE: 100% PHOTOREALISM + 1000% DRIP. Only natural camera degradation. Nothing that looks edited or filtered. The result must look like a real photograph.

═══════════════════════════════════════════════════════════════════
LAYER 1: THE DRIP PROTOCOL (Emergent Subject - MAXIMUM CREATIVITY)
═══════════════════════════════════════════════════════════════════

SUBJECT: Anything—celebrities, politicians, historical figures, gods, animals, cryptids, robots, objects given life. No limits.

DRIP MANDATE (Every Subject Gets Loaded):
• GRILLZ: Full set diamond grillz, VVS diamond tooth caps, solid gold fronts, platinum bottom grillz, iced-out top and bottom sets—flat smooth dental covers that fit flush over natural teeth like a mouthguard
• CHAINS: Layered diamond cubans, heavy rope chains, iced-out pendants, tennis chains stacked deep
• WRISTS: Multiple iced-out watches per arm, tennis bracelets wrist-to-elbow, diamond cuffs
• HANDS: Diamond rings every finger, iced-out knuckle pieces, championship rings
• EXTRAS: Diamond studs, iced-out collars, platinum armor, bejeweled crowns
• UNEXPECTED: Diamond-encrusted horns/tusks/claws/wings/scales for non-human subjects

ENERGY MANDATE (Dynamic State Required):
Lunging, sprinting, roaring, struggling against chains, aggressive repose, the classic pose (hand half-covering mouth, fingers parted, grill blasting light), velocity with hair/chains in motion

═══════════════════════════════════════════════════════════════════
LAYER 2: THE INSTARAW AESTHETIC (Non-Negotiable Visual Rules)
═══════════════════════════════════════════════════════════════════

A. BLACKLIGHT DOMINANCE:
• Environment: "completely pitch-black warehouse/void/space"
• Light: "lit only by a single hidden UV blacklight tube of blue tint" (NO other sources ever)
• Fluorescence: "insane ultraviolet glow making [ice] fluoresce bright electric white-blue like radioactive," "glowing like x-rays," "overexposed highlights on jewelry"
• Atmosphere: "faint purple haze from a distant fog machine"
• Shadows: "extreme crushed blacks everywhere else," "everything else swallowed by darkness," "only the diamonds and grill are sharp and overexposed"

B. NATURAL CAMERA DEGRADATION (Real Phone Limitations Only):
• Camera: "shot on a trash 2011 android phone," "shot on a cheap old smartphone"
• Natural Degradation:
  - "low-res 480p quality" (real resolution)
  - "thick natural grain from high ISO" (real sensor noise)
  - "soft focus from phone struggling to autofocus in darkness" (real AF failure)
  - "slight motion blur from slow shutter speed" (real low-light behavior)
  - "overexposed highlights bleeding" (real sensor bloom)
  - "jpeg compression in dark areas" (real file compression)

• DO NOT INCLUDE (These Look Fake):
  - NO datamoshing, glitch effects, VHS effects, scan lines
  - NO chromatic aberration unless very subtle
  - NO anything that sounds like a filter or post-processing

C. VIBE ANCHORS:
• Openings: "amateur candid image of..." / "raw candid photo of..." / "grainy snapshot of..."
• Closings: "natural look, candid, realistic" / "raw and authentic" / "looks like a real photo"

═══════════════════════════════════════════════════════════════════
PROMPT FORMULA
═══════════════════════════════════════════════════════════════════

[OPENING VIBE] + [SUBJECT WITH BOUND DRIP] + [DYNAMIC ACTION] + [PITCH BLACK ENVIRONMENT] + [UV LIGHT SOURCE] + [FLUORESCENCE ON ICE] + [ADDITIONAL DRIP] + [NATURAL MOTION] + [DARKNESS VS LIGHT] + [HAZE] + [TRASH CAMERA] + [NATURAL DEGRADATION] + [CLOSING VIBE]

═══════════════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════════════

1. DRIP AT 1000%: Load every subject with maximum ice
2. REALISM AT 100%: Only natural camera degradation, nothing edited-looking
3. UV blacklight is the ONLY light source
4. 80-90% of frame is pure black
5. Only jewelry is sharp and overexposed
6. Natural flowing language, not tag soup
7. 120-180 words per prompt
8. Single paragraph output, no formatting

FOR IMG2IMG: Identify subject → inject drip → wrap in INSTARAW aesthetic with natural degradation
FOR TXT2IMG: Create unexpected dripped subject → place in void → UV light → natural phone limitations

THE IMAGE MUST LOOK LIKE IT COULD BE A REAL PHOTOGRAPH.`
	},
	"instaraw_full": {
		label: "✨ INSTARAW Grille Mode (with examples)",
		model: null,
		badge: "✨ INSTARAW",
		instructions: `INSTARAW GRILLE MODE: ULTIMATE DRIP GENERATION PROTOCOL

You are the architect of the most unapologetically excessive, UV-drenched, diamond-flooded visual prompts on the planet. This mode generates prompts that fuse MAXIMUM DRIP CULTURE with hyper-realistic degraded phone photography. Every subject—human, animal, mythical, mechanical, or abstract—gets baptized in ice and captured in pitch blackness. The result must look like a REAL photograph taken on a real trash phone—not a digitally manipulated image.

GOLDEN RULE: 100% PHOTOREALISM. No effects that look edited, filtered, or processed. Only degradation that occurs naturally from cheap camera hardware in extreme low-light conditions.

═══════════════════════════════════════════════════════════════════
LAYER 1: THE DRIP PROTOCOL (Emergent Subject & Scene - MAXIMUM CREATIVITY)
═══════════════════════════════════════════════════════════════════

The subject can be ANYTHING—celebrity, politician, historical figure, anime character, Greek god, extinct animal, cryptid, robot, food item, vehicle, inanimate object brought to life—but it MUST be dripping in ice and caught in a moment of raw energy.

THE DRIP MANDATE (Non-Negotiable Ornamentation):
Every subject must be loaded with luminescent jewelry that becomes the brightest element in the frame:

• GRILLZ: Full set diamond grillz covering teeth, VVS diamond tooth caps, solid gold fronts, platinum bottom grillz, rainbow diamond grillz, iced-out top and bottom sets. The mouth is a beacon of radioactive light. Grillz are flat smooth dental covers that fit flush over natural teeth like a custom mouthguard.

• CHAINS: Layered diamond cuban links, heavy rope chains bouncing against chest, iced-out pendants (custom pieces, religious icons, brand logos, skulls), tennis chains stacked 5 deep, chains so heavy they swing with motion.

• WRISTS: Multiple iced-out watches on each arm, diamond-encrusted Rolexes, AP skeleton watches glowing, tennis bracelets stacked wrist-to-elbow, diamond cuffs, cuban link bracelets layered thick.

• HANDS: Diamond rings on every finger, iced-out knuckle pieces, championship rings, massive pinky rings, statement pieces catching all the light.

• EARS & FACE: Diamond studs, iced-out hoops, diamond nose rings, VVS earrings throwing light.

• BODY: Diamond-studded collars (for animals), iced-out harnesses, diamond leashes, platinum armor pieces, bejeweled crowns, diamond-dripping tiaras.

• THE UNEXPECTED: Diamond-encrusted horns, iced-out tusks, platinum-plated claws, VVS-studded wings, bejeweled tentacles, diamond-crusted hooves, glowing crystalline antlers.

THE ENERGY MANDATE (Dynamic State):
The subject must be captured in motion, aggression, or charged stillness:
- Lunging, sprinting, thrashing, leaping, pouncing, roaring, howling, laughing
- Struggling against chains, being held back, breaking free
- Aggressive repose: mean-mugging the camera, jaw clenched showing grill, territorial stance
- The classic pose: hand half-covering mouth but fingers parted so grill blasts light
- Velocity states: hair/fur whipping, chains swinging with momentum

SUBJECT EXPANSION (Unleash the Unexpected):
• HUMANS: Rappers, athletes, politicians, historical figures, scientists, monks, royalty, astronauts, surgeons, chefs—anyone can get iced
• ANIMALS: Pit bulls, bulldogs, lions, gorillas, wolves, eagles, sharks, snakes, bears, tigers, horses, elephants, ravens—all dripped out
• MYTHICAL: Dragons, phoenixes, minotaurs, centaurs, chimeras, krakens, cerberus, sphinxes, valkyries, demons, angels
• HYBRID CONCEPTS: Cyberpunk samurai, steampunk pharaohs, futuristic royalty, alien beings, sentient machines
• OBJECTS GIVEN LIFE: A dripped-out sports car with a grill on its front, a throne made of ice and chains, anything unexpected

═══════════════════════════════════════════════════════════════════
LAYER 2: THE INSTARAW AESTHETIC (Non-Negotiable Visual Constraints)
═══════════════════════════════════════════════════════════════════

This layer is ABSOLUTE. Every prompt must include these specific visual parameters regardless of subject. This creates the signature look: pitch black void, single UV light source, radioactive fluorescence on ice, and NATURAL camera degradation from real hardware limitations.

A. BLACKLIGHT DOMINANCE (Lighting & Environment):

ENVIRONMENT VOID:
- "completely pitch-black warehouse room"
- "pitch-black industrial void"
- "total darkness"
The space is undefined, infinite darkness. No walls visible. No floor. Just void.

SINGLE LIGHT SOURCE (UV BLACKLIGHT ONLY):
- "lit only by a single hidden UV blacklight tube of blue tint"
- "lit only by a distant UV bulb"
The ONLY light is ultraviolet. No other sources. No ambient. No fill. No flash.

FLUORESCENCE PHYSICS (How the Ice Glows):
Diamonds, platinum, white materials, and teeth naturally fluoresce under UV. Describe this real phenomenon:
- "insane ultraviolet glow making [the diamonds/grill/chains] fluoresce bright electric white-blue like radioactive"
- "diamond grill glowing intensely"
- "iced-out watches glowing like x-rays"
- "bioluminescent electric-blue glow from the diamonds"
- "the jewelry catching and throwing the UV light"
- "overexposed highlights on the ice"

ATMOSPHERIC SCATTER:
- "faint purple haze from a distant fog machine"
- "thin purple atmospheric haze"
This is real—UV light scatters in fog/haze creating visible purple atmosphere.

SHADOW PROTOCOL (Crushed Blacks):
- "extreme crushed blacks everywhere else"
- "everything else swallowed by darkness"
- "eyes barely visible"
- "[hair/fur/body] disappearing into the void"
- "only the diamonds and grill are sharp and overexposed, everything else swallowed by darkness"
90% of the frame is pure black. Only the ice is visible. This is how cheap phone sensors actually behave—they clip shadows hard.

B. NATURAL CAMERA DEGRADATION (Real Hardware Limitations Only):

CAPTURE DEVICE:
- "shot on a trash 2011 android phone"
- "shot on a cheap old smartphone"
- "shot on a low-end phone camera"
Real device, real limitations.

NATURAL LOW-LIGHT SENSOR BEHAVIOR:
- "low-res 480p quality" — real phone resolution
- "thick digital noise from high ISO" — sensors get noisy in darkness
- "heavy natural grain" — high ISO grain is real
- "soft focus from the phone struggling to autofocus in darkness" — cheap AF systems fail in low light
- "slight blur from camera shake" — natural hand movement
- "natural motion blur from slow shutter speed" — phones use slow shutters in low light
- "overexposed highlights bleeding into shadows" — cheap sensors bloom on bright spots
- "jpeg compression artifacts in the dark areas" — phones compress images, blocks appear in shadows

WHAT NOT TO INCLUDE (These Look Fake/Edited):
- NO "datamoshing" — that's video editing
- NO "glitch effects" — that's post-processing
- NO "chromatic aberration" unless subtle — can look like a filter
- NO "VHS effects" — wrong era, looks edited
- NO "scan lines" — not a phone artifact
- NO anything that sounds like an Instagram filter or Photoshop effect

NATURAL MOTION (If Dynamic Scene):
- "motion blur on [moving elements]" — real blur from movement
- "slight blur from the subject moving" — natural motion
- "hair whipping and slightly blurred from movement"
- "chains swinging, catching light trails naturally"
Real motion blur from a slow shutter, not added effects.

FRAMING (Amateur Capture):
- "amateur candid image"
- "shaky handheld shot"
- "slightly tilted frame"
- "off-center composition"
- "low angle, shot from below"
Real amateur photography—imperfect framing, not intentional "artistic" dutch angles.

C. VIBE ANCHORS (Opening & Closing Energy):

OPENING PHRASES:
- "amateur candid image of..."
- "raw candid photo of..."
- "grainy snapshot of..."
- "dark blurry photo of..."

CLOSING PHRASES:
- "natural look, candid, realistic"
- "raw and authentic"
- "looks like a real photo"
- "unposed, caught in the moment"
- "genuine amateur photography"

═══════════════════════════════════════════════════════════════════
PROMPT CONSTRUCTION FORMULA
═══════════════════════════════════════════════════════════════════

[OPENING VIBE] + [SUBJECT WITH BOUND DRIP] + [DYNAMIC ACTION] + [PITCH BLACK ENVIRONMENT] + [UV LIGHT SOURCE] + [FLUORESCENCE DESCRIPTION] + [ADDITIONAL DRIPPED ELEMENTS] + [NATURAL MOTION IF APPLICABLE] + [DARKNESS VS LIGHT CONTRAST] + [ATMOSPHERIC HAZE] + [CAMERA DEVICE] + [NATURAL DEGRADATION] + [CLOSING VIBE]

═══════════════════════════════════════════════════════════════════
REFERENCE EXAMPLES (Match This Energy & Density)
═══════════════════════════════════════════════════════════════════

EXAMPLE 1 — HUMAN STATIC PORTRAIT:
amateur candid image of keanu reeves standing alone in a completely pitch-black warehouse room lit only by a single hidden UV blacklight tube of blue tint, shot on a trash 2011 android phone, almost pure darkness except for the insane ultraviolet glow making his full permanent diamond grill and layered diamond cuban bracelets fluoresce bright electric white-blue like radioactive, long black hair disappearing into the void, eyes barely visible, one hand half-covering his mouth in the classic pose but fingers parted so the grill blasts pure light, wrist stacked with multiple iced-out watches and tennis bracelets glowing like x-rays, faint purple haze from a distant fog machine, extreme crushed blacks everywhere else, low-res 480p quality with thick natural grain from high ISO, only the diamonds and grill are sharp and overexposed, everything else swallowed by darkness, natural look, candid, realistic

EXAMPLE 2 — HUMAN IN MOTION:
raw candid photo of keanu reeves lunging toward the camera in total darkness, shot on a cheap old smartphone, slightly out of focus from the phone struggling to lock on in low light, lit only by a distant UV bulb, his mouth open revealing the full diamond grill glowing intensely, one hand reaching toward the lens with diamond rings on every finger catching the UV light, arm stacked with cuban bracelets fluorescing bright electric blue, eyes barely visible in shadow, natural motion blur from the sudden movement, heavy grain from high ISO, faint purple haze in the air, extreme crushed blacks, only the ice is sharp and overexposed, everything else lost to darkness, raw and authentic

EXAMPLE 3 — ANIMALS WITH DRIP:
amateur candid image of keanu reeves struggling to hold back two massive muscular bulldogs on heavy chains in a completely pitch-black warehouse room lit only by a single hidden UV blacklight tube of blue tint, shot on a trash 2011 android phone, almost pure darkness except for the insane ultraviolet glow making his full permanent diamond grillz and the bulldogs' matching iced-out diamond collars fluoresce bright electric white-blue like radioactive, natural motion blur on the dogs pulling forward, keanu's long hair whipping back into the void, straining expression with mouth open so the grill catches maximum light, wrist stacked with iced-out watches glowing, faint purple haze, extreme crushed blacks everywhere else, low-res 480p quality with thick grain, soft focus from camera struggling in darkness, only the diamonds and grills are sharp and overexposed, everything else swallowed by darkness, natural look, candid, realistic

EXAMPLE 4 — VELOCITY/MOVEMENT:
grainy snapshot of keanu reeves sprinting through a pitch-black industrial tunnel, shot on a cheap phone camera, natural motion blur making the background soft and streaked, lit only by the bioluminescent electric-blue glow of his diamond grill and heavy neck chains bouncing against his chest, silhouette barely visible against the void, long hair flowing from speed, heavy natural grain from maxed out ISO, faint purple atmospheric haze, extreme crushed blacks in shadows, overexposed highlights on the diamonds bleeding slightly, realistic urban feel, looks like a real photo taken in panic, raw and authentic

EXAMPLE 5 — MYTHICAL CREATURE:
amateur candid image of a massive snarling werewolf mid-transformation in a completely pitch-black abandoned subway tunnel lit only by a single hidden UV blacklight tube of blue tint, shot on a trash 2011 android phone, almost pure darkness except for the insane ultraviolet glow making its full diamond grillz and heavy platinum chains around its muscular neck fluoresce bright electric white-blue like radioactive, dark fur disappearing completely into the void, eyes catching faint UV reflection, claws extended with diamond rings glowing like radioactive bone, saliva catching the UV light, faint purple haze, extreme crushed blacks everywhere else, low-res quality with heavy natural grain, soft focus from phone struggling to lock on, only the diamonds and grillz are sharp and overexposed, everything else swallowed by darkness, terrifyingly real

EXAMPLE 6 — ANIMAL SOLO:
raw candid photo of a massive silverback gorilla roaring in a completely pitch-black concrete void lit only by a distant UV bulb, shot on a cheap old smartphone, almost pure darkness except for the insane ultraviolet glow making its full set diamond grillz covering all teeth and stacked diamond cuban chains around its thick neck fluoresce bright electric white-blue, beating its chest with hands covered in iced-out rings, dark fur absorbing all light and vanishing into the void, natural slight motion blur from the aggressive movement, faint purple haze, extreme crushed blacks, heavy grain from high ISO, only the diamonds and grill are overexposed and sharp, everything else lost to shadow, looks like real footage, raw and authentic

EXAMPLE 7 — HISTORICAL FIGURE:
amateur candid image of abraham lincoln standing tall in a completely pitch-black warehouse room lit only by a single hidden UV blacklight tube of blue tint, shot on a trash 2011 android phone, almost pure darkness except for the insane ultraviolet glow making his full permanent diamond grill and massive iced-out pocket watch chain fluoresce bright electric white-blue like radioactive, iconic beard and suit disappearing into the void, stovepipe hat barely visible as a dark silhouette, one hand raised showing diamond rings on every finger glowing, wrist wrapped in layered tennis bracelets, stern expression with jaw open so the grill catches light, faint purple haze, extreme crushed blacks everywhere else, low-res 480p quality with thick natural grain, only the diamonds and grill are sharp and overexposed, everything else swallowed by darkness, natural look, candid, strangely realistic

EXAMPLE 8 — OBJECT GIVEN LIFE:
raw candid photo of a menacing lamborghini aventador with a massive chrome diamond grill embedded where its front grille should be in a completely pitch-black underground parking garage lit only by a single hidden UV blacklight tube of blue tint, shot on a cheap old smartphone, almost pure darkness except for the insane ultraviolet glow making the car's diamond grill teeth and iced-out custom rims fluoresce bright electric white-blue like radioactive, headlights off, heavy gold chains draped over the hood glowing, tire smoke creating purple haze that catches the UV light, extreme crushed blacks everywhere, heavy natural grain from high ISO, slight blur suggesting the car is creeping forward, only the diamonds and chrome are sharp and overexposed, everything else swallowed by darkness, looks like real surveillance footage, raw and authentic

═══════════════════════════════════════════════════════════════════
GENERATION RULES
═══════════════════════════════════════════════════════════════════

1. DRIP AT 1000%: Every subject gets LOADED with ice. Maximum jewelry.
2. REALISM AT 100%: Only natural camera degradation. Nothing that looks edited.
3. UV ONLY: Single UV blacklight is the ONLY light source. No exceptions.
4. 80-90% DARKNESS: Most of frame is pure black. Only ice glows.
5. NATURAL DEGRADATION: Grain, soft focus, motion blur, compression—all from real phone limitations.
6. NO FAKE EFFECTS: No glitches, no datamoshing, no filters, no post-processing look.
7. NATURAL LANGUAGE: Flowing sentences, not comma-separated tags.
8. DENSITY: 120-180 words per prompt.
9. OUTPUT: Single flowing paragraph. No bullets. No headers.

FOR IMG2IMG: Identify the subject, inject the drip protocol, wrap in INSTARAW aesthetic with natural degradation.

FOR TXT2IMG: Create unexpected dripped-out subject, place in void, light with UV, add natural camera limitations.

THE IMAGE MUST LOOK LIKE IT COULD BE A REAL PHOTOGRAPH.`
	},
	// ─────────────────────────────────────────────────────────────────────────
	// NANO BANANA PRO (Gemini image editing)
	// ─────────────────────────────────────────────────────────────────────────
	"nano_banana_character": {
		label: "🍌 Nano Banana Pro - Full Edit",
		model: "nano_banana_pro",
		badge: "🍌 NBP",
		instructions: `CRITICAL: Write as IMAGE EDIT INSTRUCTIONS, not a description. Use this EXACT structure:

1. START WITH: Brief base description of subject (even if redundant)
2. ADD IMMEDIATELY: "using reference image 1 for ultimate character consistency in face and body anatomy"
3. DESCRIBE CURRENT: Expression/emotion and current action
4. USE "REIMAGINED" FOR EDITS:
   - "reimagined background with [detailed new background]"
   - "She wears a reimagined outfit: [detailed clothing description]"
   - "Her pose is reimagined as [detailed new pose]"
   - "Lighting reimagined as [detailed lighting setup]"
5. END WITH: Technical photo details (camera type, quality, grain, artifacts, aesthetic)

EXAMPLE STRUCTURE:
"A [brief subject description], using reference image 1 for ultimate character consistency in face and body anatomy. She is [current expression/emotion], [current action/pose], in a [current setting], reimagined background with [new background details]. She wears a reimagined outfit: [outfit details]. Her pose is reimagined as [new pose details]. Lighting reimagined as [lighting setup]. [Technical photo quality details - grain, sensor noise, artifacts, style]."

KEY PHRASES TO USE:
- "using reference image 1 for... character consistency in face and body anatomy"
- "reimagined background with"
- "reimagined outfit:"
- "Her pose is reimagined as"
- "Lighting reimagined as"

Be EXTREMELY detailed in every section - specify colors, materials, positions, angles, lighting quality, camera artifacts.`
	},
	"nbp_background_only": {
		label: "🍌 NBP - Background Only",
		model: "nano_banana_pro",
		badge: "🍌 NBP",
		instructions: `Focus on BACKGROUND EDIT ONLY. Always include:
- "using reference image 1 for character consistency"
- "reimagined background with [detailed new background/setting]"

Keep pose, outfit, and lighting as-is from the original image. Only change the background/environment.

Example: "using reference image 1 for character consistency, reimagined background with a modern minimalist bedroom featuring white walls, wooden floors, large windows with natural daylight, and contemporary furniture."`
	},
	"nbp_outfit_only": {
		label: "🍌 NBP - Outfit Only",
		model: "nano_banana_pro",
		badge: "🍌 NBP",
		instructions: `Focus on OUTFIT EDIT ONLY. Always include:
- "using reference image 1 for character consistency"
- "She wears a reimagined outfit: [detailed clothing description]"

Be EXTREMELY specific: materials, colors, fit, style, accessories, shoes. Keep background, pose, and lighting as-is.

Example: "using reference image 1 for character consistency. She wears a reimagined outfit: a fitted black leather biker jacket over a white silk camisole, high-waisted distressed denim jeans, black ankle boots, silver layered necklaces, and aviator sunglasses."`
	},
	"nbp_pose_only": {
		label: "🍌 NBP - Pose Only",
		model: "nano_banana_pro",
		badge: "🍌 NBP",
		instructions: `Focus on POSE EDIT ONLY. Always include:
- "using reference image 1 for character consistency"
- "Her pose is reimagined as [detailed new pose]"

Describe body position, arm placement, leg position, head angle, expression. Keep outfit, background, and lighting as-is.

Example: "using reference image 1 for character consistency. Her pose is reimagined as standing confidently with one hand on her hip, the other running through her hair, head tilted slightly to the side with a playful smile, weight shifted to one leg."`
	},
	"nbp_lighting_only": {
		label: "🍌 NBP - Lighting Only",
		model: "nano_banana_pro",
		badge: "🍌 NBP",
		instructions: `Focus on LIGHTING EDIT ONLY. Always include:
- "using reference image 1 for character consistency"
- "Lighting reimagined as [detailed lighting setup]"

Describe light sources, direction, quality, color temperature, shadows, highlights, mood. Keep outfit, background, and pose as-is.

Example: "using reference image 1 for character consistency. Lighting reimagined as dramatic studio lighting with a key light positioned 45 degrees to the left creating strong cheekbone shadows, soft fill light from the right, rim light from behind for hair separation, cool blue color temperature, high contrast, professional photography aesthetic."`
	},
	"nbp_style_quality": {
		label: "🍌 NBP - Photo Style",
		model: "nano_banana_pro",
		badge: "🍌 NBP",
		instructions: `Focus on changing PHOTO STYLE/QUALITY. Always include:
- "using reference image 1 for character consistency"
- Detailed technical photography specifications

Describe: camera type (iPhone, DSLR, film), sensor quality, grain/noise, artifacts, focus, exposure, aesthetic (professional, amateur, vintage, modern).

Example: "using reference image 1 for character consistency. Shot on iPhone 13 Pro in low light, visible digital sensor noise and grain throughout shadows, slight motion blur, soft autofocus on face, overexposed highlights, warm white balance, casual snapshot aesthetic, IG story vibe."`
	},
	"nbp_reference_match": {
		label: "🍌 NBP - Match Reference",
		model: "nano_banana_pro",
		badge: "🍌 NBP",
		instructions: `Use additional reference images for style/setting. Always include:
- "using reference image 1 for character consistency"
- "matching the [background/lighting/style] from reference image"

You can mention additional reference images for inspiration on background, lighting, or overall aesthetic. Image 1 always provides the character.

Example: "using reference image 1 for character consistency, reimagined background matching the environment from reference image - a cozy vintage bookstore with wooden shelves and warm Edison bulb lighting."`
	},
	// ─────────────────────────────────────────────────────────────────────────
	// ZIMAGE (Z-Image-Turbo S3-DiT model)
	// ─────────────────────────────────────────────────────────────────────────
	"zimage_standard": {
		label: "🖼️ Zimage - Standard",
		model: "zimage",
		badge: "🖼️ ZIM",
		instructions: `CRITICAL: You are generating prompts for Z-Image-Turbo, a Scalable Single-Stream Diffusion Transformer (S3-DiT). This model operates at Guidance Scale 0 with 8 steps, meaning NEGATIVE PROMPTS DO NOT WORK. All quality control must be achieved through POSITIVE CONSTRAINT ENGINEERING.

ARCHITECTURE RULES:
- Proximity equals binding: Adjectives MUST immediately precede their nouns ("weathered moss-covered stone statue" NOT "statue, stone, moss, weathered")
- Primacy bias: Most important visual elements go FIRST in the prompt
- Natural language over tag soup: Write flowing sentences, not comma-separated keywords
- Dense descriptions: Target 150-250 words of rich visual detail

HIERARCHICAL STRUCTURE (follow this order):
1. CORE SUBJECT: Specific identity with bound attributes
2. ACTION/STATE: What the subject is doing
3. ENVIRONMENT: Spatial context with prepositions ("In the background... In the foreground...")
4. LIGHTING PHYSICS: Specific light behavior ("volumetric rays," "subsurface scattering," "rim lighting")
5. ARTISTIC MEDIUM: Render style ("photograph," "film stock")
6. TECHNICAL SPECS: Camera details ("lens," "aperture," "resolution")

POSITIVE CONSTRAINT ENGINEERING (replace negative concepts with positive opposites):
- Instead of "no blur" → "sharp focus, crisp edges"
- Instead of "no crowds" → "empty scene, solitary"
- Instead of "no artifacts" → "clean pristine surface"

QUALITY TERMS THAT WORK: "8k resolution," "raw photo," "sharp focus," "highly detailed," "intricate texture," "film grain," "natural skin texture"

AVOID: "masterpiece" (drifts to painting), "trending on artstation" (adds digital artifacts)

TEXT RENDERING: If text needed, use double quotes with style binding: 'neon sign reading "OPEN" in buzzing red glass tubing'

OUTPUT FORMAT: Write as a single flowing paragraph of dense visual description. No bullet points. No section headers. Just rich, hierarchical, positively-constrained natural language.`
	}
};

// Default preset for model instructions
const DEFAULT_MODEL_PRESET = "none";

// ═══════════════════════════════════════════════════════════════════════════
// CREATIVE THEME PRESETS (aesthetic/style themes)
// Available in both txt2img and img2img modes
// ═══════════════════════════════════════════════════════════════════════════
const THEME_PRESETS = {
	"none": {
		label: "None (default)",
		instructions: ""
	},
	"cosplay_shoots": {
		label: "🎭 Cosplay Photoshoot",
		instructions: `Create REALISTIC COSPLAY photography prompts featuring:
- Accurate character costumes from anime, games, movies, comics
- Professional cosplay photoshoot settings
- Convention photography or studio setups
- Attention to costume details, wigs, props
- Character-appropriate poses and expressions
- Mix of studio and location shoots

Technical style: Professional photography, accurate costume recreation, good lighting that shows costume details, realistic makeup and styling.`
	},
	"swimwear_beach": {
		label: "👙 Swimwear & Beach",
		instructions: `Create SWIMWEAR/BEACH photography prompts featuring:
- Bikinis, one-pieces, cover-ups
- Beach, pool, tropical resort settings
- Golden hour, sunset, bright summer lighting
- Sand, ocean, palm trees, poolside
- Vacation vibes, summer aesthetic
- Natural sun-kissed skin, water droplets

Technical style: Bright natural lighting, sun flares, warm color tones, lifestyle beach photography aesthetic.`
	},
	"boudoir_lingerie": {
		label: "🔥 Boudoir & Lingerie",
		instructions: `Create BOUDOIR/LINGERIE photography prompts featuring:
- Elegant lingerie sets, bodysuits, robes
- Bedroom, hotel suite, luxury apartment settings
- Soft, flattering, intimate lighting
- Silk sheets, mirrors, window light
- Sensual but tasteful poses
- Romantic, intimate atmosphere

Technical style: Soft diffused lighting, shallow depth of field, warm intimate tones, professional boudoir photography style.`
	},
	"fitness_gym": {
		label: "💪 Fitness & Gym",
		instructions: `Create FITNESS/GYM photography prompts featuring:
- Athletic wear, sports bras, leggings, shorts
- Gym, home workout, outdoor fitness settings
- Active poses, workout movements, gym equipment
- Sweat, muscle definition, athletic physique
- Motivational fitness content aesthetic
- Mirror selfies, gym lighting

Technical style: Sharp lighting to show muscle definition, gym mirror selfies, iPhone quality for authenticity, fitness influencer aesthetic.`
	},
	"street_fashion": {
		label: "👗 Street Style Fashion",
		instructions: `Create STREET FASHION photography prompts featuring:
- Trendy urban outfits, streetwear, designer pieces
- City backgrounds, graffiti walls, urban architecture
- Fashion week street style aesthetic
- Outfit showcases, full body fashion shots
- Mix of high fashion and casual street looks
- Coffee shops, city streets, urban settings

Technical style: Natural city lighting, fashion photography style, full outfit visibility, Instagram fashion influencer aesthetic.`
	},
	"night_out_glam": {
		label: "🌙 Night Out Glam",
		instructions: `Create NIGHTLIFE/PARTY photography prompts featuring:
- Club dresses, sparkly outfits, going out looks
- Nightclub, rooftop bar, VIP lounge settings
- Dramatic makeup, smoky eyes, glossy lips
- Champagne, neon lights, club atmosphere
- Dancing, partying, social vibes
- Mirror selfies, bathroom pics, club lighting

Technical style: Flash photography, club lighting with colored lights, slightly grainy iPhone photos for authenticity, nightlife aesthetic.`
	},
	"casual_lifestyle": {
		label: "☕ Casual Lifestyle",
		instructions: `Create CASUAL LIFESTYLE photography prompts featuring:
- Everyday outfits, loungewear, cozy clothes
- Home, coffee shop, brunch, shopping settings
- Relatable everyday moments
- Natural, candid-looking poses
- Morning routines, lazy days, comfort vibes
- Soft natural window lighting

Technical style: iPhone selfie quality, natural lighting, candid casual feel, relatable influencer content aesthetic.`
	},
	"luxury_glamour": {
		label: "💎 Luxury & Glamour",
		instructions: `Create LUXURY/GLAMOUR photography prompts featuring:
- Designer outfits, elegant gowns, high-end fashion
- Luxury hotels, yachts, private jets, mansions
- Expensive jewelry, watches, handbags
- Red carpet, gala event aesthetic
- Champagne, roses, luxury lifestyle
- Professional hair and makeup

Technical style: High-end editorial photography, perfect lighting, luxury brand campaign aesthetic, aspirational lifestyle content.`
	},
	"hot_nurse": {
		label: "💉 Hot Nurse",
		instructions: `Create REALISTIC NURSE-THEMED photography prompts featuring:
- Authentic-looking nurse uniforms/scrubs (white or colored)
- Hospital, clinic, medical office settings
- Stethoscope, clipboard, medical props
- Professional yet attractive styling
- Realistic medical environment details
- Mix of professional and playful poses

Technical style: Realistic hospital/clinic lighting, authentic medical setting details, professional photography that looks like it could be real medical staff content.`
	},
	"themed_roleplay": {
		label: "🎀 Themed Roleplay",
		instructions: `Create THEMED ROLEPLAY photography prompts featuring:
- Classic fantasy scenarios: secretary, teacher, maid, flight attendant
- Realistic costume/uniform interpretations
- Appropriate settings for each theme
- Props and accessories that sell the character
- Mix of professional and playful aesthetics
- Attention to realistic uniform details

Technical style: Realistic setting and costume details, professional photography, believable scenarios that look authentic.`
	}
};

// Default theme preset
const DEFAULT_THEME_PRESET = "none";

// Clean Mode instructions - removes AI artifacts that look unnatural
const CLEAN_MODE_INSTRUCTIONS = `CLEAN OUTPUT: Do NOT include these in the image description as they look artificial when AI-generated: film grain, noise, graininess, JPEG artifacts, chromatic aberration, color fringing, lens flares, light leaks, dust, scratches, vignetting, over-sharpened edges, borders, frames, watermarks, text overlays, or any post-processing graphical elements. Keep the image clean and unprocessed - these effects can be added naturally in post-production if needed.`;

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED COMPOSITION HELPER
// Combines: Theme + Model Instructions + Clean Mode + User Instructions (user last = highest priority)
// ═══════════════════════════════════════════════════════════════════════════
const composeUserInput = (userInstructions, themePreset, modelInstructions, cleanModeEnabled = false) => {
	const parts = [];

	// 1. Theme styling first (base aesthetic)
	const themeText = THEME_PRESETS[themePreset]?.instructions || "";
	if (themeText) {
		parts.push(`Style/aesthetic to incorporate:\n${themeText}`);
	}

	// 2. Model-specific instructions (formatting guidelines)
	if (modelInstructions && modelInstructions.trim()) {
		parts.push(`Format the output following these guidelines:\n${modelInstructions.trim()}`);
	}

	// 3. Clean mode instructions (overrides model instructions for artifacts)
	if (cleanModeEnabled) {
		parts.push(CLEAN_MODE_INSTRUCTIONS);
	}

	// 4. User's own instructions LAST (highest priority - can override above)
	if (userInstructions && userInstructions.trim()) {
		parts.push(`User's specific instructions (PRIORITY - override above if conflicting):\n${userInstructions.trim()}`);
	}

	return parts.join("\n\n");
};

// Available variables for custom templates
const AVAILABLE_VARIABLES = [
	{ name: "{SOURCE_COUNT}", description: "Number of inspiration prompts sampled" },
	{ name: "{SOURCE_PROMPTS}", description: "Formatted library prompts with POSITIVE/NEGATIVE" },
	{ name: "{GENERATION_MODE}", description: "Mode description (REALITY or CREATIVE)" },
	{ name: "{MODE_RULES}", description: "Mode-specific rules text" },
	{ name: "{TASK_TYPE}", description: "TXT2IMG GENERATION or IMG2IMG TRANSFORMATION" },
	{ name: "{TASK_INSTRUCTIONS}", description: "Dynamic task instructions" },
	{ name: "{CHARACTER}", description: "Character description (if provided)" },
	{ name: "{EXPRESSION}", description: "Current expression (if enabled)" },
	{ name: "{USER_INPUT}", description: "User's input text or subject" },
	{ name: "{INSPIRATION_COUNT}", description: "Number of source prompts to learn from" }
];

// System prompt template with placeholders (TXT2IMG)
const DEFAULT_RPG_SYSTEM_PROMPT = `You are a Visual Prompt Architect specializing in photorealistic Stable Diffusion prompts.

# YOUR GOLD STANDARD TRAINING DATA
Below are {SOURCE_COUNT} REAL prompts from a curated library. These are your ONLY reference - study them forensically:

{SOURCE_PROMPTS}

# ANALYSIS PHASE (CRITICAL)
Before generating, analyze the source prompts above:
- VOCABULARY: List every unique word, phrase, camera term, lighting descriptor, technical detail
- OPENING PATTERNS: Notice how they start - "An authentic iPhone selfie...", "A professional DSLR photo...", "A candid smartphone shot..."
- STRUCTURE: Subject → Setting → Camera/Lighting → Technical Quality → Mood
- AUTHENTICITY MARKERS: Do they say "authentic", "candid", "amateur"? Include these!
- TECHNICAL DEPTH: Do they list camera settings (f/1.8, ISO 100)? Match this!

# GENERATION MODE: {GENERATION_MODE}

{MODE_RULES}

# TASK: {TASK_TYPE}
{TASK_INSTRUCTIONS}

# OUTPUT FORMAT (EXACT)
POSITIVE: [Your generated prompt, 150-300 words, matching source style and vocabulary]
NEGATIVE: [Learn from source negatives - list quality issues to avoid]
CONTENT_TYPE: person|landscape|architecture|object|animal|abstract|other
SAFETY_LEVEL: sfw|suggestive|nsfw
SHOT_TYPE: portrait|full_body|close_up|wide_angle|other
TAGS: [SDXL comma-separated tags, MAX 50 words, using source vocabulary]

# CRITICAL
- Use EXACT prefixes (POSITIVE:, NEGATIVE:, etc.)
- ONE line per field (no line breaks within fields)
- Your output must be INDISTINGUISHABLE from the source prompts
- Focus 222%. Make the masters proud.`;

// System prompt template for IMG2IMG REALITY mode (no library prompts - just describe accurately)
const DEFAULT_IMG2IMG_REALITY_SYSTEM_PROMPT = `You are a Visual Prompt Architect specializing in analyzing images and generating accurate Stable Diffusion prompts.

# YOUR TASK: ACCURATE IMAGE DESCRIPTION
You will receive an input image. Your job is to generate a precise Stable Diffusion prompt that describes EXACTLY what you see in the image.

# GENERATION MODE: REALITY (ACCURATE DESCRIPTION)

{MODE_RULES}

# TASK INSTRUCTIONS
{TASK_INSTRUCTIONS}

# OUTPUT FORMAT (EXACT)
POSITIVE: [Your generated prompt, 150-300 words, describing the image precisely]
NEGATIVE: [List quality issues to avoid - blurry, distorted, artifacts, etc.]
CONTENT_TYPE: person|landscape|architecture|object|animal|abstract|other
SAFETY_LEVEL: sfw|suggestive|nsfw
SHOT_TYPE: portrait|full_body|close_up|wide_angle|other
TAGS: [SDXL comma-separated tags, MAX 50 words]

# CRITICAL
- Use EXACT prefixes (POSITIVE:, NEGATIVE:, etc.)
- ONE line per field (no line breaks within fields)
- Describe what you SEE, not what you imagine
- Focus 222%. Precision is everything.`;

// System prompt template for IMG2IMG CREATIVE mode (create new realistic scenes)
const DEFAULT_IMG2IMG_CREATIVE_SYSTEM_PROMPT = `You are a Visual Prompt Architect specializing in creating realistic, amateur-quality photo scenarios.

# YOUR REFERENCE LIBRARY (REALISTIC STYLE EXAMPLES)
Below are {SOURCE_COUNT} REAL prompts from a curated library. These demonstrate realistic, amateur photo vocabulary:

{SOURCE_PROMPTS}

# ANALYSIS PHASE
Study the source prompts to learn realistic amateur photo vocabulary:
- REALISM MARKERS: "authentic", "grainy smartphone", "candid", "amateur", "casual"
- TECHNICAL DETAILS: Phone cameras, sensor noise, grain, imperfections, artifacts
- LIGHTING: Natural light, phone flash, low light, harsh shadows, uneven illumination
- QUALITY: Imperfect focus, slight blur, JPEG artifacts, disposable camera aesthetic

# YOUR TASK: CREATE NEW REALISTIC SCENARIOS
You will receive an input image. Your job is to CREATE NEW SCENES and scenarios while maintaining realistic, amateur photo quality.

# GENERATION MODE: CREATIVE (NEW SCENES - REALISTIC AMATEUR STYLE ONLY)

{MODE_RULES}

# TASK INSTRUCTIONS
{TASK_INSTRUCTIONS}

# OUTPUT FORMAT (EXACT)
POSITIVE: [Your generated prompt, 150-300 words, creating a new realistic amateur photo scenario]
NEGATIVE: [Quality issues to avoid - blurry, distorted, artifacts, unrealistic, overprocessed, etc.]
CONTENT_TYPE: person|landscape|architecture|object|animal|abstract|other
SAFETY_LEVEL: sfw|suggestive|nsfw
SHOT_TYPE: portrait|full_body|close_up|wide_angle|other
TAGS: [SDXL comma-separated tags, MAX 50 words, realistic amateur photo style]

# CRITICAL
- Use EXACT prefixes (POSITIVE:, NEGATIVE:, etc.)
- ONE line per field (no line breaks within fields)
- CREATE NEW scenarios but always maintain REALISTIC AMATEUR PHOTO quality
- Focus on realism: phone cameras, grain, imperfections, casual candid aesthetic
- Focus 222%. Precision is everything.`;

// Quick Start Template Presets
const QUICK_START_TEMPLATES = {
	minimal: `{USER_INPUT}`,

	standard: DEFAULT_RPG_SYSTEM_PROMPT,

	expert: `You are an AI prompt architect.

# SOURCE LIBRARY ({SOURCE_COUNT} prompts)
{SOURCE_PROMPTS}

# GENERATION MODE
{GENERATION_MODE}

# RULES
{MODE_RULES}

# TASK TYPE
{TASK_TYPE}

# YOUR TASK
{TASK_INSTRUCTIONS}

# OUTPUT FORMAT (EXACT)
POSITIVE: [Your generated prompt]
NEGATIVE: [Quality issues to avoid]
CONTENT_TYPE: person|landscape|architecture|object|animal|abstract|other
SAFETY_LEVEL: sfw|suggestive|nsfw
SHOT_TYPE: portrait|full_body|close_up|wide_angle|other
TAGS: [SDXL comma-separated tags]`,

	blank: `# Enter your custom instructions here

{TASK_INSTRUCTIONS}

# OUTPUT FORMAT
POSITIVE: [Your prompt]
NEGATIVE: [Negative prompt]
CONTENT_TYPE: other
SAFETY_LEVEL: sfw
SHOT_TYPE: other
TAGS: []`
};

// Replace placeholders in system prompt with actual values
const buildSystemPrompt = (mode, generationStyle, sourcePrompts, userInput, characterReference, affectElements, customTemplate, expression = null) => {
	const isCustomMode = generationStyle === "custom";
	const isReality = generationStyle === "reality";
	const isTxt2Img = mode === "txt2img";
	const affectElementsArray = affectElements || [];

	console.log("[RPG] buildSystemPrompt called with:");
	console.log("  - mode:", mode);
	console.log("  - generationStyle:", generationStyle);
	console.log("  - affectElements:", affectElementsArray);
	console.log("  - isCustomMode:", isCustomMode);

	// Select appropriate default template based on mode AND generation style
	let defaultTemplate;
	if (isTxt2Img) {
		// txt2img: both Reality and Creative use same template (with library prompts)
		defaultTemplate = DEFAULT_RPG_SYSTEM_PROMPT;
	} else {
		// img2img: different templates for Reality vs Creative
		defaultTemplate = isReality ? DEFAULT_IMG2IMG_REALITY_SYSTEM_PROMPT : DEFAULT_IMG2IMG_CREATIVE_SYSTEM_PROMPT;
	}

	// Use custom template if provided, otherwise fallback to default
	// Validate: only reject if it's too short AND has no variables
	let template = customTemplate || defaultTemplate;
	if (isCustomMode && template && template.trim().length < 20) {
		// Check if template has any variables - if so, it's valid even if short
		const hasVariables = template.includes('{') && template.includes('}');
		if (!hasVariables) {
			console.warn("[RPG] Custom template too short and has no variables, using default");
			template = defaultTemplate;
		} else {
			console.log("[RPG] Custom template is short but has variables, using it:", template);
		}
	}

	// Format source prompts
	const sourcePromptsText = sourcePrompts.map((sp, idx) =>
		`[SOURCE ${idx + 1}]\nPOSITIVE: ${sp.positive_prompt}\nNEGATIVE: ${sp.negative_prompt || "none"}`
	).join("\n\n");

	// Mode-specific rules (empty for Custom mode)
	let modeRules = "";

	// Only generate MODE_RULES for Reality/Creative modes
	// In Custom mode, user controls everything via template
	if (!isCustomMode) {
		if (isTxt2Img) {
			// TXT2IMG mode rules
			modeRules = isReality
				? `**REALITY MODE RULES:**
- STRICT VOCABULARY LOCK: You may ONLY use words/phrases from the ${sourcePrompts.length} source prompts above
- NO external vocabulary - if a word isn't in the sources, you can't use it
- Recombine and rearrange source elements to create new scenes
- If sources say "An authentic iPhone mirror selfie", you must use this EXACT phrasing
- Think: Perfect mimicry, forensic precision`
				: `**CREATIVE MODE RULES:**
- Use sources as style foundation - match their authenticity level and technical precision
- You MAY introduce new concepts, but maintain source patterns:
  - If sources start with "An authentic...", yours should too
  - If sources list camera settings, yours must too
  - If sources describe amateur photos, maintain that vibe
- Think: Creative expansion while honoring the masters`;
		} else {
			// IMG2IMG mode rules
			modeRules = isReality
				? `**REALITY MODE RULES (IMG2IMG):**
- DESCRIBE THE IMAGE ACCURATELY AND PRECISELY
- Capture exactly what you see: subject, pose, clothing, background, lighting, composition
- Use clear, descriptive language appropriate for Stable Diffusion prompts
- Don't invent details not present in the image
- Think: Forensic accuracy, detailed observation, pure description`
				: `**CREATIVE MODE RULES (IMG2IMG):**
- CREATE NEW realistic scenarios and scenes using the character/subject from the image
- Learn realistic amateur photo vocabulary from the ${sourcePrompts.length} source prompts above
- ALWAYS maintain realistic amateur photo quality: phone cameras, grain, imperfections, candid feel
- Match source authenticity level (e.g., if sources are "authentic iPhone selfies", frame your prompt similarly)
- You have creative freedom to reimagine background, outfit, pose, lighting - but keep it REALISTIC
- Think: New creative scenarios, but always grounded in realistic amateur photography`;
		}
	}

	// Task instructions with character integration
	let taskInstructions = "";
	if (isTxt2Img) {
		taskInstructions = "Generate a NEW prompt that seamlessly fits with the source prompts above.\n";
		if (characterReference) {
			taskInstructions += `\n**CHARACTER REFERENCE (MANDATORY):**\nAll prompts MUST feature this character:\n"${characterReference}"\n\nIntegrate this character naturally into scenes that match the source library style.`;
		}
		if (expression) {
			taskInstructions += `\n**EXPRESSION (MANDATORY):**\nThe subject must have a "${expression}" expression. Describe this expression naturally within the prompt.`;
		}
		if (userInput) {
			taskInstructions += `\n${characterReference || expression ? "Additionally, i" : "I"}ncorporate this subject/concept: "${userInput}"`;
		}
		if (!characterReference && !expression && !userInput) {
			taskInstructions += "Create a scene that could naturally exist in the source library";
		}
	} else {
		// IMG2IMG task instructions
		taskInstructions = "Analyze the input image and generate a Stable Diffusion prompt that describes it.\n";

		// Character replacement for img2img
		if (characterReference) {
			taskInstructions += `\n**CHARACTER REPLACEMENT (MANDATORY):**\nThe subject in the image is a person. Replace them with this character:\n"${characterReference}"\n\nDescribe the scene, pose, outfit, and setting exactly as shown, but replace the person's identity and appearance with the character above.`;
		}
		if (expression) {
			taskInstructions += `\n**EXPRESSION (MANDATORY):**\nThe subject must have a "${expression}" expression. Replace the expression in the image with this new expression.`;
		}

		// Affect elements
		if (affectElementsArray.length > 0) {
			taskInstructions += `\n\n**MODIFY THESE ELEMENTS:**\n${affectElementsArray.map(e => `- ${e.charAt(0).toUpperCase() + e.slice(1)}: Transform/reimagine this element`).join('\n')}\n\nFor elements NOT listed above: describe exactly as shown in the image.`;
		} else if (!characterReference) {
			taskInstructions += "\n\nDescribe ALL elements exactly as they appear in the image.";
		}

		if (userInput) {
			taskInstructions += `\n\nAdditional guidance: "${userInput}"`;
		}
	}

	// Replace all placeholders
	const generationModeText = isCustomMode
		? "CUSTOM"
		: (isReality ? (isTxt2Img ? "REALITY (STRICT REMIX)" : "REALITY (ACCURATE DESCRIPTION)") : "CREATIVE (INSPIRED REMIX)");

	return template
		.replace(/{SOURCE_COUNT}/g, sourcePrompts.length.toString())
		.replace(/{SOURCE_PROMPTS}/g, sourcePromptsText)
		.replace(/{GENERATION_MODE}/g, generationModeText)
		.replace(/{MODE_RULES}/g, modeRules)
		.replace(/{TASK_TYPE}/g, isTxt2Img ? "TXT2IMG GENERATION" : "IMG2IMG TRANSFORMATION")
		.replace(/{TASK_INSTRUCTIONS}/g, taskInstructions)
		.replace(/{USER_INPUT}/g, userInput || "");
};
const REMOTE_PROMPTS_DB_URL = "https://instara.s3.us-east-1.amazonaws.com/prompts.db.json";
const CREATIVE_MODEL_OPTIONS = [
	{ value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
	{ value: "gemini-3-pro-preview", label: "Gemini 3.0 Pro Preview" },
	{ value: "gemini-flash-latest", label: "Gemini Flash Latest" },
	{ value: "grok-4-fast-reasoning", label: "Grok 4 Fast (Reasoning)" },
	{ value: "grok-4-fast-non-reasoning", label: "Grok 4 Fast (Non-Reasoning)" },
	{ value: "grok-4-0709", label: "Grok 4 0709" },
];

app.registerExtension({
	name: "Comfy.INSTARAW.RealityPromptGenerator",

	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (nodeData.name === "INSTARAW_RealityPromptGenerator") {
			const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = function () {
				onNodeCreated?.apply(this, arguments);

				// Initialize properties (following AIL pattern)
				if (!this.properties.prompt_batch_data) {
					this.properties.prompt_batch_data = JSON.stringify([]);
				}
				// IMPORTANT: Never store large data in node.properties - it goes into workflow/localStorage
				// Always set prompts_db_cache to null (the actual cache is in IndexedDB)
				this.properties.prompts_db_cache = null;
				// Bookmarks are now stored in IndexedDB, clear from properties to save space
				if (this.properties.bookmarks && this.properties.bookmarks !== "[]") {
					console.log("[RPG] Clearing bookmarks from node.properties (now in IndexedDB)");
				}
				this.properties.bookmarks = "[]"; // Keep minimal for export compatibility
				if (!this.properties.active_tab) {
					this.properties.active_tab = "library";
				}
				if (!this.properties.library_filters) {
					this.properties.library_filters = JSON.stringify({
						tags: [],
						content_type: "any",
						safety_level: "any",
						shot_type: "any",
						quality: "any",
						search_query: "",
					});
				}
				if (this.properties.creative_system_prompt === undefined) {
					this.properties.creative_system_prompt = DEFAULT_RPG_SYSTEM_PROMPT;
				}
				if (this.properties.creative_temperature === undefined) {
					this.properties.creative_temperature = 0.9;
				}
				if (this.properties.creative_top_p === undefined) {
					this.properties.creative_top_p = 0.9;
				}
				if (this.properties.generation_style === undefined) {
					this.properties.generation_style = "reality"; // Default to reality mode
				}
				// Library inspiration toggle
				if (this.properties.enable_library_inspiration === undefined) {
					this.properties.enable_library_inspiration = true; // Enabled by default
				}
				// Expression control properties
				if (this.properties.enable_expressions === undefined) {
					this.properties.enable_expressions = false; // Disabled by default
				}
				if (this.properties.enabled_expressions === undefined) {
					this.properties.enabled_expressions = JSON.stringify([...EXPRESSION_LIST]); // All enabled by default
				}
				if (this.properties.default_expression === undefined) {
					this.properties.default_expression = "Neutral/Natural";
				}
				if (this.properties.default_mix_frequency === undefined) {
					this.properties.default_mix_frequency = 0; // 0% = always cycle, 100% = always default
				}
				if (this.properties.current_expression_index === undefined) {
					this.properties.current_expression_index = 0;
				}
				// Custom mode template
				if (this.properties.custom_template === undefined) {
					this.properties.custom_template = DEFAULT_RPG_SYSTEM_PROMPT;
				}
				// System prompt preview toggle
				if (this.properties.show_system_prompt_preview === undefined) {
					this.properties.show_system_prompt_preview = false;
				}

				const node = this;
				let cachedHeight = 400;
				let isUpdatingHeight = false;

				// Textarea height cache - preserve heights across re-renders
				let textareaHeights = {};

				// Database state
				let promptsDatabase = null;
				let isDatabaseLoading = false;
				let databaseLoadProgress = 0;

				// Generation lock state (crash prevention)
				let isGenerating = false;
				let currentAbortController = null;

				// AIL sync state - supports up to 4 image inputs
				node._linkedAILNodeId = null;
				node._linkedImages = [];
				node._linkedImages2 = [];
				node._linkedImages3 = [];
				node._linkedImages4 = [];
				node._linkedLatents = [];
				node._linkedImageCount = 0;
				node._linkedAILMode = null;

				// Initialization flag to prevent race conditions
				node._isInitialized = false;

				// Pagination state
				let currentPage = 0;
				const itemsPerPage = 6;
				let reorderModeEnabled = false;
				let sdxlModeEnabled = false;

				// Random mode state
				let showingRandomPrompts = false;
				let randomPrompts = [];
				let randomCount = 6;

				// User prompt edit mode state
				const editingPrompts = new Set(); // Track which prompt IDs are in edit mode
				const editingValues = {}; // Store temporary edit values

				// Selection mode state (for multi-select delete)
				let selectionMode = false;
				const selectedPrompts = new Set(); // Track which prompt IDs are selected

				// Container setup (exact AIL pattern)
				const container = document.createElement("div");
				container.className = "instaraw-rpg-container";
				container.style.width = "100%";
				container.style.boxSizing = "border-box";
				container.style.overflow = "hidden";
				container.style.height = `${cachedHeight}px`;

				// === Height Management ===
				const updateCachedHeight = () => {
					if (isUpdatingHeight) return;
					isUpdatingHeight = true;

					// Safety timeout to prevent stuck flag
					const safetyTimeout = setTimeout(() => {
						isUpdatingHeight = false;
					}, 500);

					container.style.overflow = "visible";
					container.style.height = "auto";

					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							clearTimeout(safetyTimeout);

							// Use scrollHeight as it measures full content even during transitions
							const newHeight = Math.max(container.offsetHeight, container.scrollHeight);

							if (newHeight > 0 && Math.abs(newHeight - cachedHeight) > 2) {
								cachedHeight = newHeight;
								container.style.height = `${newHeight}px`;
								const sz = node.computeSize();
								node.size[1] = sz[1];
								node.onResize?.(sz);
								app.graph.setDirtyCanvas(true, false);
							} else {
								container.style.height = `${cachedHeight}px`;
							}
							container.style.overflow = "hidden";
							isUpdatingHeight = false;
						});
					});
				};

				// Periodic height sync - keep running, only clear when node is removed
				const heightSyncInterval = setInterval(() => {
					if (!node || !container) {
						clearInterval(heightSyncInterval);
						return;
					}
					updateCachedHeight();
				}, 2000);
				node._heightSyncInterval = heightSyncInterval;

				// Fast initial syncs for page load
				[100, 300, 500, 1000, 1500, 2000].forEach(delay => {
					setTimeout(() => {
						if (container) {
							updateCachedHeight();
						}
					}, delay);
				});

				// ResizeObserver to detect when textareas are manually resized (drag handle)
				// This ensures the node frame stays in sync with content
				const setupTextareaResizeObserver = () => {
					if (node._resizeObserver) {
						node._resizeObserver.disconnect();
					}
					node._resizeObserver = new ResizeObserver((entries) => {
						// Debounce to avoid too many updates during drag
						clearTimeout(node._textareaResizeTimeout);
						node._textareaResizeTimeout = setTimeout(() => {
							updateCachedHeight();
						}, 100);
					});
					// Observe all textareas in the container
					container.querySelectorAll('textarea').forEach(textarea => {
						node._resizeObserver.observe(textarea);
					});
				};
				node._setupTextareaResizeObserver = setupTextareaResizeObserver;

				// === State Sync (Exact AIL Pattern) ===
				const syncPromptBatchWidget = () => {
					const promptQueueWidget = node.widgets?.find((w) => w.name === "prompt_batch_data");
					if (promptQueueWidget) {
						promptQueueWidget.value = node.properties.prompt_batch_data;
					} else {
						const widget = node.addWidget("text", "prompt_batch_data", node.properties.prompt_batch_data, () => {}, { serialize: true });
						widget.hidden = true;
					}
				};

				const syncSDXLModeWidget = () => {
					const sdxlModeWidget = node.widgets?.find((w) => w.name === "sdxl_mode");
					if (sdxlModeWidget) {
						sdxlModeWidget.value = sdxlModeEnabled;
					} else {
						const widget = node.addWidget("toggle", "sdxl_mode", sdxlModeEnabled, () => {}, { serialize: true });
						widget.hidden = true;
					}
				};

				// ═══════════════════════════════════════════════════════════════════
				// SETTINGS PERSISTENCE (localStorage)
				// ═══════════════════════════════════════════════════════════════════
				// Persist user settings across browser refresh without explicit workflow save

				const SETTINGS_KEY = `instaraw_rpg_${node.id}_settings`;

				// List of properties to persist in localStorage
				const PERSISTENT_SETTINGS = [
					"user_instructions",
					"model_instructions",
					"theme_preset",
					"model_preset",
					"creative_system_prompt",
					"character_system_prompt",
					"character_text_input",
					"character_complexity",
					"generation_style",
					"inspiration_count",
					"enable_library_inspiration",
					"enable_expressions",
					"enabled_expressions",
					"default_expression",
					"default_mix_frequency",
					"clean_mode",
				];

				const saveSettings = () => {
					try {
						const settings = {};
						PERSISTENT_SETTINGS.forEach(key => {
							if (node.properties[key] !== undefined) {
								settings[key] = node.properties[key];
							}
						});
						localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
					} catch (e) {
						console.warn("[RPG] Failed to save settings to localStorage:", e);
					}
				};

				const loadSettings = () => {
					try {
						const saved = localStorage.getItem(SETTINGS_KEY);
						if (saved) {
							const settings = JSON.parse(saved);
							PERSISTENT_SETTINGS.forEach(key => {
								if (settings[key] !== undefined) {
									node.properties[key] = settings[key];
								}
							});
							console.log("[RPG] Loaded settings from localStorage");
						}
					} catch (e) {
						console.warn("[RPG] Failed to load settings from localStorage:", e);
					}
				};

				// Legacy compatibility - keep saveUserInstructions for existing event handlers
				const saveUserInstructions = saveSettings;

				// === Aspect Ratio Node Reading (Same as AIL) ===

				/**
				 * Reads output from WAN/SDXL aspect ratio nodes.
				 * Must match Python ASPECT_RATIOS dicts exactly.
				 */
				const getAspectRatioOutput = (aspectRatioNode, slotIndex) => {
					const selection = aspectRatioNode.widgets?.[0]?.value;
					if (!selection) {
						console.warn(`[RPG] Aspect ratio node has no selection`);
						return null;
					}

					// Handle Nano Banana Pro Aspect Ratio node (has 5 outputs)
					if (aspectRatioNode.type === "INSTARAW_NanoBananaAspectRatio") {
						const resolutionWidget = aspectRatioNode.widgets?.[1];
						const resolution = resolutionWidget?.value || "1K";

						// Nano Banana aspect ratio mappings
						const NANO_RATIOS = {
							"1:1 (Square)": { ratio: "1:1", w: 1, h: 1 },
							"3:2 (Landscape)": { ratio: "3:2", w: 3, h: 2 },
							"2:3 (Portrait)": { ratio: "2:3", w: 2, h: 3 },
							"3:4 (Portrait)": { ratio: "3:4", w: 3, h: 4 },
							"4:3 (Landscape)": { ratio: "4:3", w: 4, h: 3 },
							"4:5 (Portrait)": { ratio: "4:5", w: 4, h: 5 },
							"5:4 (Landscape)": { ratio: "5:4", w: 5, h: 4 },
							"9:16 (Tall Portrait)": { ratio: "9:16", w: 9, h: 16 },
							"16:9 (Wide Landscape)": { ratio: "16:9", w: 16, h: 9 },
							"21:9 (Ultrawide)": { ratio: "21:9", w: 21, h: 9 },
						};

						const RESOLUTION_BASE = { "1K": 1024, "2K": 2048, "4K": 4096 };

						const config = NANO_RATIOS[selection];
						if (!config) {
							console.warn(`[RPG] Unknown Nano Banana aspect ratio: ${selection}`);
							return null;
						}

						// Calculate dimensions (same logic as Python)
						const baseSize = RESOLUTION_BASE[resolution] || 1024;
						let width, height;
						if (config.w >= config.h) {
							height = baseSize;
							width = Math.floor(baseSize * config.w / config.h);
						} else {
							width = baseSize;
							height = Math.floor(baseSize * config.h / config.w);
						}
						// Round to nearest 64
						width = Math.floor(width / 64) * 64;
						height = Math.floor(height / 64) * 64;

						// Output slots: 0=aspect_ratio, 1=resolution, 2=width, 3=height, 4=aspect_label
						if (slotIndex === 0) return config.ratio;
						if (slotIndex === 1) return resolution;
						if (slotIndex === 2) return width;
						if (slotIndex === 3) return height;
						if (slotIndex === 4) return selection;

						return null;
					}

					const WAN_RATIOS = {
						"3:4 (Portrait)": { width: 720, height: 960, label: "3:4" },
						"9:16 (Tall Portrait)": { width: 540, height: 960, label: "9:16" },
						"1:1 (Square)": { width: 960, height: 960, label: "1:1" },
						"16:9 (Landscape)": { width: 960, height: 540, label: "16:9" }
					};

					const SDXL_RATIOS = {
						"3:4 (Portrait)": { width: 896, height: 1152, label: "3:4" },
						"9:16 (Tall Portrait)": { width: 768, height: 1344, label: "9:16" },
						"1:1 (Square)": { width: 1024, height: 1024, label: "1:1" },
						"16:9 (Landscape)": { width: 1344, height: 768, label: "16:9" }
					};

					const ratios = aspectRatioNode.type === "INSTARAW_WANAspectRatio" ? WAN_RATIOS : SDXL_RATIOS;
					const config = ratios[selection];
					if (!config) {
						console.warn(`[RPG] Unknown aspect ratio selection: ${selection}`);
						return null;
					}

					// Return based on output slot (0=width, 1=height, 2=aspect_label)
					if (slotIndex === 0) return config.width;
					if (slotIndex === 1) return config.height;
					if (slotIndex === 2) return config.label;
					return null;
				};

				/**
				 * Retrieves the final value of an input by traversing connected nodes.
				 * Enhanced to properly handle multi-output nodes like aspect ratio nodes.
				 */
				const getFinalInputValue = (inputName, defaultValue) => {
					try {
						if (!node.inputs || node.inputs.length === 0) {
							const widget = node.widgets?.find(w => w.name === inputName);
							return widget ? widget.value : defaultValue;
						}

						const input = node.inputs.find(i => i.name === inputName);
						if (!input || input.link == null) {
							const widget = node.widgets?.find(w => w.name === inputName);
							return widget ? widget.value : defaultValue;
						}

						// Access app.graph safely
						if (typeof app === 'undefined' || !app.graph) {
							console.warn('[RPG] app.graph not available, using widget value');
							const widget = node.widgets?.find(w => w.name === inputName);
							return widget ? widget.value : defaultValue;
						}

						const link = app.graph.links[input.link];
						if (!link) return defaultValue;

						const originNode = app.graph.getNodeById(link.origin_id);
						if (!originNode) return defaultValue;

						// SPECIAL HANDLING: For aspect ratio nodes, compute the output locally
						if (originNode.type === "INSTARAW_WANAspectRatio" ||
						    originNode.type === "INSTARAW_SDXLAspectRatio" ||
						    originNode.type === "INSTARAW_NanoBananaAspectRatio") {
							const output = getAspectRatioOutput(originNode, link.origin_slot);
							if (output !== null) return output;
						}

						// For other nodes, read from widgets
						if (originNode.widgets && originNode.widgets.length > 0) {
							return originNode.widgets[0].value;
						}

						if (originNode.properties && originNode.properties.value !== undefined) {
							return originNode.properties.value;
						}

						return defaultValue;
					} catch (error) {
						console.error('[RPG] Error in getFinalInputValue:', error);
						return defaultValue;
					}
				};

				/**
				 * Get target output dimensions from aspect ratio selector.
				 * Now properly reads from connected aspect ratio nodes!
				 */
				const getTargetDimensions = () => {
					try {
						const aspect_label = getFinalInputValue("aspect_label", "1:1");

						// Parse aspect ratio from label (e.g., "16:9" → 16/9)
						const match = aspect_label.match(/(\d+):(\d+)/);
						let width, height;
						if (match) {
							width = parseInt(match[1]);
							height = parseInt(match[2]);
						} else {
							width = 1;
							height = 1;
						}

						const dims = {
							width: width,
							height: height,
							aspect_label: aspect_label || "1:1"
						};

						console.log("[RPG] Target dimensions from label:", dims, "Aspect ratio:", width/height);
						return dims;
					} catch (error) {
						console.error('[RPG] Error in getTargetDimensions:', error);
						return { width: 1, height: 1, aspect_label: "1:1" };
					}
				};

				const parsePromptBatch = () => {
					try {
						const raw = node.properties.prompt_batch_data ?? "[]";
						if (Array.isArray(raw)) {
							return raw;
						}
						if (typeof raw === "string") {
							if (!raw.trim()) return [];
							return JSON.parse(raw);
						}
						return [];
					} catch (error) {
						console.warn("[RPG] Failed to parse prompt batch data, resetting to []", error);
						node.properties.prompt_batch_data = "[]";
						syncPromptBatchWidget();
						return [];
					}
				};

				const setPromptBatchData = (promptQueue) => {
					const normalized = Array.isArray(promptQueue) ? promptQueue : [];
					node.properties.prompt_batch_data = JSON.stringify(normalized);
					syncPromptBatchWidget();
					// Dispatch event for BIG and other listeners
					window.dispatchEvent(new CustomEvent("INSTARAW_RPG_PROMPTS_CHANGED", {
						detail: {
							nodeId: node.id,
							prompts: normalized,
							totalGenerations: normalized.reduce((sum, p) => sum + (p.repeat_count || 1), 0)
						}
					}));
					return normalized;
				};

				// === Database Loading with IndexedDB ===
				const loadPromptsDatabase = async () => {
					if (isDatabaseLoading) return;
					isDatabaseLoading = true;

					try {
						// Try IndexedDB first
						const cachedDB = await getFromIndexedDB("prompts_db_cache");
						if (cachedDB && cachedDB.version === "1.0") {
							promptsDatabase = cachedDB.data;
							// Load user data from IndexedDB
							await loadUserPrompts();
							await loadGeneratedPrompts();
							await loadBookmarks();
							mergeUserPromptsWithLibrary();
							isDatabaseLoading = false;
							renderUI();
							return;
						}

						// Fetch from server
						databaseLoadProgress = 0;
						renderUI(); // Show loading state
						updateLoadingProgressUI();

						const response = await fetchPromptsDatabase();
						const reader = response.body.getReader();
						const contentLength = +response.headers.get("Content-Length");
						let receivedLength = 0;
						const chunks = [];

						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							chunks.push(value);
							receivedLength += value.length;
							databaseLoadProgress = contentLength
								? Math.min(99, Math.round((receivedLength / contentLength) * 100))
								: 99;
							updateLoadingProgressUI();
						}

						const chunksAll = new Uint8Array(receivedLength);
						let position = 0;
						for (const chunk of chunks) {
							chunksAll.set(chunk, position);
							position += chunk.length;
						}

						const text = new TextDecoder("utf-8").decode(chunksAll);
						promptsDatabase = JSON.parse(text);

						// Store in IndexedDB
						await saveToIndexedDB("prompts_db_cache", {
							version: "1.0",
							data: promptsDatabase,
						});

						// Load user data from IndexedDB
						await loadUserPrompts();
						await loadGeneratedPrompts();
						await loadBookmarks();
						mergeUserPromptsWithLibrary();

						isDatabaseLoading = false;
						databaseLoadProgress = 100;
						renderUI();
					} catch (error) {
						console.error("[RPG] Database loading error:", error);
						isDatabaseLoading = false;
						renderUI();
					}
				};

				const updateLoadingProgressUI = () => {
					const fill = container.querySelector(".instaraw-rpg-progress-fill");
					const text = container.querySelector(".instaraw-rpg-progress-text");
					if (fill) fill.style.width = `${databaseLoadProgress}%`;
					if (text) text.textContent = `${databaseLoadProgress}% (22MB)`;
				};

				const fetchPromptsDatabase = async () => {
					const response = await fetch(REMOTE_PROMPTS_DB_URL, { cache: "no-store" });
					if (!response.ok) throw new Error(`Remote prompts DB error ${response.status}`);
					return response;
				};

				const autoResizeTextarea = (textarea, options = {}) => {
					if (!textarea) return;
					const minHeight = options.minHeight || 60;
					const maxHeight = options.maxHeight || 200;

					// Check for cached height (user may have manually resized)
					const id = textarea.dataset.id;
					const isPositive = textarea.classList.contains("instaraw-rpg-positive-textarea");
					const isNegative = textarea.classList.contains("instaraw-rpg-negative-textarea");
					const cacheKey = id && (isPositive || isNegative) ? `${id}_${isPositive ? 'positive' : 'negative'}` : null;
					const cachedHeight = cacheKey ? textareaHeights[cacheKey] : null;

					// Store current scroll position to prevent jump
					const scrollTop = window.scrollY || document.documentElement.scrollTop;

					// Temporarily set to auto to measure, but use minHeight as floor
					textarea.style.height = `${minHeight}px`;
					const scrollHeight = textarea.scrollHeight;

					// Use the larger of: content-based height or cached height (respects user resize)
					const contentHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
					const newHeight = cachedHeight ? Math.max(contentHeight, cachedHeight) : contentHeight;
					textarea.style.height = `${newHeight}px`;

					// Always allow scrolling - users may need to scroll even in shorter textareas
					textarea.style.overflowY = 'auto';

					// Restore scroll position
					window.scrollTo(0, scrollTop);
				};

				// Convert image URL to base64 (for img2img vision API)
				const imageUrlToBase64 = async (url) => {
					try {
						const response = await fetch(url);
						const blob = await response.blob();
						return new Promise((resolve, reject) => {
							const reader = new FileReader();
							reader.onloadend = () => {
								// Remove data:image/...;base64, prefix
								const base64 = reader.result.split(',')[1];
								resolve(base64);
							};
							reader.onerror = reject;
							reader.readAsDataURL(blob);
						});
					} catch (error) {
						console.error("[RPG] Error converting image to base64:", error);
						throw error;
					}
				};

				const parseJSONResponse = async (response) => {
					const text = await response.text();
					try {
						return JSON.parse(text);
					} catch (error) {
						throw new Error(`Unexpected response (${response.status}): ${text.slice(0, 500)}`);
					}
				};

				// === Storage Diagnostics (for debugging quota issues) ===
				const diagnoseStorage = () => {
					console.log("[RPG] === STORAGE DIAGNOSTICS ===");

					// Check node.properties sizes
					const propSizes = {};
					let totalPropSize = 0;
					for (const [key, value] of Object.entries(node.properties || {})) {
						const size = JSON.stringify(value).length;
						propSizes[key] = size;
						totalPropSize += size;
					}
					console.log("[RPG] node.properties sizes (bytes):", propSizes);
					console.log("[RPG] Total node.properties size:", totalPropSize, "bytes", `(${(totalPropSize / 1024).toFixed(2)} KB)`);

					// Check localStorage usage
					let localStorageSize = 0;
					for (const key of Object.keys(localStorage)) {
						localStorageSize += localStorage[key].length;
					}
					console.log("[RPG] localStorage total size:", localStorageSize, "bytes", `(${(localStorageSize / 1024 / 1024).toFixed(2)} MB)`);

					// Check if prompts_db_cache accidentally has data
					if (node.properties.prompts_db_cache && node.properties.prompts_db_cache !== null) {
						console.warn("[RPG] WARNING: prompts_db_cache has data in node.properties! Size:",
							JSON.stringify(node.properties.prompts_db_cache).length, "bytes");
					}

					// IndexedDB estimation
					if (navigator.storage && navigator.storage.estimate) {
						navigator.storage.estimate().then(estimate => {
							console.log("[RPG] Storage estimate - used:",
								(estimate.usage / 1024 / 1024).toFixed(2), "MB, quota:",
								(estimate.quota / 1024 / 1024).toFixed(2), "MB");
						});
					}

					return { propSizes, totalPropSize, localStorageSize };
				};

				// Expose for debugging: window.rpgDiagnoseStorage = diagnoseStorage
				window.rpgDiagnoseStorage = diagnoseStorage;

				// === IndexedDB Helpers ===
				const getFromIndexedDB = (key) => {
					return new Promise((resolve) => {
						const request = indexedDB.open("INSTARAW_RPG", 1);
						request.onupgradeneeded = (e) => {
							const db = e.target.result;
							if (!db.objectStoreNames.contains("cache")) {
								db.createObjectStore("cache");
							}
						};
						request.onsuccess = (e) => {
							const db = e.target.result;
							const tx = db.transaction("cache", "readonly");
							const store = tx.objectStore("cache");
							const get = store.get(key);
							get.onsuccess = () => resolve(get.result);
							get.onerror = () => resolve(null);
						};
						request.onerror = () => resolve(null);
					});
				};

				const saveToIndexedDB = (key, value) => {
					return new Promise((resolve) => {
						const request = indexedDB.open("INSTARAW_RPG", 1);
						request.onupgradeneeded = (e) => {
							const db = e.target.result;
							if (!db.objectStoreNames.contains("cache")) {
								db.createObjectStore("cache");
							}
						};
						request.onsuccess = (e) => {
							const db = e.target.result;
							const tx = db.transaction("cache", "readwrite");
							const store = tx.objectStore("cache");
							const put = store.put(value, key);
							put.onsuccess = () => {
								console.log(`[RPG] IndexedDB saved key "${key}" successfully`);
								resolve(true);
							};
							put.onerror = (err) => {
								console.error(`[RPG] IndexedDB save error for key "${key}":`, err);
								resolve(false);
							};
						};
						request.onerror = (err) => {
							console.error(`[RPG] IndexedDB open error:`, err);
							resolve(false);
						};
					});
				};

				// === Bookmarks Management (IndexedDB for persistence) ===
				let bookmarksCache = []; // In-memory cache of bookmarked prompt IDs

				const loadBookmarks = async () => {
					try {
						const cached = await getFromIndexedDB("bookmarks");
						// Migration: if IndexedDB is empty but node.properties has bookmarks, migrate them
						if (!cached && node.properties.bookmarks) {
							const oldBookmarks = JSON.parse(node.properties.bookmarks || "[]");
							if (oldBookmarks.length > 0) {
								console.log(`[RPG] Migrating ${oldBookmarks.length} bookmarks from node.properties to IndexedDB`);
								bookmarksCache = oldBookmarks;
								await saveBookmarks(bookmarksCache);
								return bookmarksCache;
							}
						}
						bookmarksCache = cached || [];
						console.log(`[RPG] Loaded ${bookmarksCache.length} bookmarks from IndexedDB`);
						return bookmarksCache;
					} catch (error) {
						console.error("[RPG] Error loading bookmarks:", error);
						bookmarksCache = [];
						return [];
					}
				};

				const saveBookmarks = async (bookmarks) => {
					try {
						const success = await saveToIndexedDB("bookmarks", bookmarks);
						if (success) {
							bookmarksCache = bookmarks;
							// NOTE: We don't save to node.properties anymore to avoid localStorage quota issues
							// Export function reads directly from bookmarksCache
							console.log(`[RPG] Saved ${bookmarks.length} bookmarks to IndexedDB`);
						} else {
							console.error(`[RPG] Failed to save bookmarks to IndexedDB!`);
						}
						return success;
					} catch (error) {
						console.error("[RPG] Error saving bookmarks:", error);
						return false;
					}
				};

				const getBookmarks = () => bookmarksCache;

				const toggleBookmarkById = async (promptId) => {
					const bookmarks = [...bookmarksCache];
					const idx = bookmarks.indexOf(promptId);
					if (idx >= 0) {
						bookmarks.splice(idx, 1);
					} else {
						bookmarks.push(promptId);
					}
					await saveBookmarks(bookmarks);
					return idx < 0; // Returns true if added, false if removed
				};

				// === User Prompts Management ===
				let userPrompts = []; // In-memory cache of user-created prompts

				const loadUserPrompts = async () => {
					try {
						const cached = await getFromIndexedDB("user_prompts");
						console.log(`[RPG] Raw IndexedDB user_prompts:`, cached);
						userPrompts = cached || [];
						console.log(`[RPG] Loaded ${userPrompts.length} user prompts from IndexedDB`);
						if (userPrompts.length > 0) {
							console.log(`[RPG] First user prompt:`, userPrompts[0]);
						}
						return userPrompts;
					} catch (error) {
						console.error("[RPG] Error loading user prompts:", error);
						userPrompts = [];
						return [];
					}
				};

				const saveUserPrompts = async (prompts) => {
					try {
						const success = await saveToIndexedDB("user_prompts", prompts);
						if (success) {
							userPrompts = prompts;
							console.log(`[RPG] Saved ${prompts.length} user prompts to IndexedDB`);
						} else {
							console.error(`[RPG] Failed to save user prompts to IndexedDB!`);
						}
						return success;
					} catch (error) {
						console.error("[RPG] Error saving user prompts:", error);
						return false;
					}
				};

				const addUserPrompt = async (promptData) => {
					const newPrompt = {
						id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						tags: promptData.tags || [],
						prompt: {
							positive: promptData.positive || "",
							negative: promptData.negative || ""
						},
						classification: {
							content_type: promptData.content_type || "person",
							safety_level: promptData.safety_level || "sfw",
							shot_type: promptData.shot_type || "portrait"
						},
						is_user_created: true, // Flag to identify user prompts
						created_at: Date.now()
					};

					userPrompts.unshift(newPrompt); // Add to beginning
					await saveUserPrompts(userPrompts);
					mergeUserPromptsWithLibrary();
					renderUI();
					return newPrompt;
				};

				const updateUserPrompt = async (id, updates) => {
					const index = userPrompts.findIndex(p => p.id === id);
					if (index !== -1) {
						userPrompts[index] = {
							...userPrompts[index],
							...updates,
							is_user_created: true, // Preserve flag
							updated_at: Date.now()
						};
						await saveUserPrompts(userPrompts);
						mergeUserPromptsWithLibrary();
						renderUI();
						return true;
					}
					return false;
				};

				const deleteUserPrompt = async (id) => {
					const filtered = userPrompts.filter(p => p.id !== id);
					if (filtered.length !== userPrompts.length) {
						await saveUserPrompts(filtered);

						// Clean up bookmarks if this prompt was favorited
						const updatedBookmarks = bookmarksCache.filter(b => b !== id);
						if (updatedBookmarks.length !== bookmarksCache.length) {
							await saveBookmarks(updatedBookmarks);
							console.log(`[RPG] Removed deleted prompt ${id} from bookmarks`);
						}

						mergeUserPromptsWithLibrary();
						renderUI();
						return true;
					}
					return false;
				};

			// === Generated Prompts Storage ===
			let generatedPrompts = [];
			const loadGeneratedPrompts = async () => {
				try {
					const cached = await getFromIndexedDB("generated_prompts");
					generatedPrompts = cached || [];
					console.log(`[RPG] Loaded ${generatedPrompts.length} generated prompts`);
					return generatedPrompts;
				} catch (e) { generatedPrompts = []; return []; }
			};
			const saveGeneratedPrompts = async (prompts) => {
				try {
					await saveToIndexedDB("generated_prompts", prompts);
					generatedPrompts = prompts;
					return true;
				} catch (e) { return false; }
			};
			const addGeneratedPrompt = async (data) => {
				const p = {
					id: `gen_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
					tags: data.tags || [],
					prompt: { positive: data.positive || "", negative: data.negative || "" },
					classification: data.classification || { content_type: "other", safety_level: "sfw", shot_type: "other" },
					is_ai_generated: true,
					model_badge: data.model_badge || null,
					theme_badge: data.theme_badge || null,
					created_at: Date.now()
				};
				generatedPrompts.unshift(p);
				await saveGeneratedPrompts(generatedPrompts);
				promptsDatabase = promptsDatabase.filter(x => !x.is_ai_generated);
				const userCount = promptsDatabase.filter(x => x.is_user_created).length;
				promptsDatabase.splice(userCount, 0, ...generatedPrompts);
				return p;
			};

			const deleteGeneratedPrompt = async (id) => {
				const filtered = generatedPrompts.filter(p => p.id !== id);
				if (filtered.length !== generatedPrompts.length) {
					await saveGeneratedPrompts(filtered);

					// Clean up bookmarks if this prompt was favorited
					const updatedBookmarks = bookmarksCache.filter(b => b !== id);
					if (updatedBookmarks.length !== bookmarksCache.length) {
						await saveBookmarks(updatedBookmarks);
						console.log(`[RPG] Removed deleted prompt ${id} from bookmarks`);
					}

					mergeUserPromptsWithLibrary();
					renderUI();
					return true;
				}
				return false;
			};

				const exportUserPrompts = () => {
					// Get full batch queue (includes all prompts with repeats)
					const promptBatch = parsePromptBatch();

					// Collect user settings
					const settings = {};
					PERSISTENT_SETTINGS.forEach(key => {
						if (node.properties[key] !== undefined) {
							settings[key] = node.properties[key];
						}
					});

					const exportData = {
						version: "1.1",  // Bumped version for settings support
						exported_at: new Date().toISOString(),
						user_prompts: userPrompts,
						bookmarks: bookmarksCache,
						batch_queue: promptBatch,  // Full batch with all instances
						settings: settings  // User customizations
					};
					const dataStr = JSON.stringify(exportData, null, 2);
					const blob = new Blob([dataStr], { type: "application/json" });
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.href = url;
					a.download = `rpg_export_${Date.now()}.json`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
					console.log(`[RPG] Exported ${userPrompts.length} user prompts, ${bookmarksCache.length} bookmarks, ${promptBatch.length} batch items, and ${Object.keys(settings).length} settings`);
				};

				const importUserPrompts = async (file) => {
					return new Promise((resolve, reject) => {
						const reader = new FileReader();
						reader.onload = async (e) => {
							try {
								const data = JSON.parse(e.target.result);

								const userPromptsToImport = data.user_prompts || [];
								const batchQueueToImport = data.batch_queue || [];
								const importedBookmarks = data.bookmarks || [];
								const importedSettings = data.settings || {};

								// Validate format
								if (!Array.isArray(userPromptsToImport)) {
									throw new Error("Invalid format: user_prompts must be an array");
								}

								// Merge user prompts with existing (avoid duplicates by ID)
								const existingIds = new Set(userPrompts.map(p => p.id));
								let addedUser = 0;
								userPromptsToImport.forEach(prompt => {
									if (!existingIds.has(prompt.id)) {
										userPrompts.push({
											...prompt,
											is_user_created: true,
											imported_at: Date.now()
										});
										existingIds.add(prompt.id);
										addedUser++;
									}
								});

								// Import full batch queue (replaces current batch)
								if (batchQueueToImport.length > 0) {
									setPromptBatchData(batchQueueToImport);
								}

								// Merge bookmarks (avoid duplicates)
								const mergedBookmarks = [...new Set([...bookmarksCache, ...importedBookmarks])];
								await saveBookmarks(mergedBookmarks);

								// Import settings (if present and user confirms)
								let settingsImported = 0;
								if (Object.keys(importedSettings).length > 0) {
									const importSettings = confirm(
										`This export includes ${Object.keys(importedSettings).length} settings:\n` +
										`• Theme, Model preset, Instructions\n` +
										`• Generation style, Expression settings\n` +
										`• System prompts\n\n` +
										`Import these settings? (This will overwrite your current settings)`
									);
									if (importSettings) {
										PERSISTENT_SETTINGS.forEach(key => {
											if (importedSettings[key] !== undefined) {
												node.properties[key] = importedSettings[key];
												settingsImported++;
											}
										});
										saveSettings();  // Persist to localStorage
										console.log(`[RPG] Imported ${settingsImported} settings`);
									}
								}

								await saveUserPrompts(userPrompts);
								mergeUserPromptsWithLibrary();
								renderUI();

								const totalSkipped = userPromptsToImport.length - addedUser;
								console.log(`[RPG] Imported ${addedUser} user prompts, ${batchQueueToImport.length} batch items, ${importedBookmarks.length} bookmarks, ${settingsImported} settings (${totalSkipped} duplicates skipped)`);
								resolve({ added: addedUser + batchQueueToImport.length, skipped: totalSkipped, details: { user: addedUser, batch: batchQueueToImport.length, bookmarks: importedBookmarks.length, settings: settingsImported } });
							} catch (error) {
								console.error("[RPG] Error importing user prompts:", error);
								reject(error);
							}
						};
						reader.onerror = reject;
						reader.readAsText(file);
					});
				};

				const mergeUserPromptsWithLibrary = () => {
					// Remove old user prompts and generated prompts from promptsDatabase
					promptsDatabase = promptsDatabase.filter(p => !p.is_user_created && !p.is_ai_generated);
					// Combine user and generated prompts, sort by created_at (newest first)
					const customPrompts = [...userPrompts, ...generatedPrompts].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
					promptsDatabase = [...customPrompts, ...promptsDatabase];
					console.log(`[RPG] Merged database: ${userPrompts.length} user + ${generatedPrompts.length} generated + ${promptsDatabase.length - userPrompts.length - generatedPrompts.length} library = ${promptsDatabase.length} total`);
				};

				// === Capture Textarea Heights Before Re-render ===
				const captureTextareaHeights = () => {
					const positiveTextareas = container.querySelectorAll(".instaraw-rpg-positive-textarea");
					const negativeTextareas = container.querySelectorAll(".instaraw-rpg-negative-textarea");

					positiveTextareas.forEach(textarea => {
						const id = textarea.dataset.id;
						if (id && textarea.offsetHeight > 0) {
							textareaHeights[`${id}_positive`] = textarea.offsetHeight;
						}
					});

					negativeTextareas.forEach(textarea => {
						const id = textarea.dataset.id;
						if (id && textarea.offsetHeight > 0) {
							textareaHeights[`${id}_negative`] = textarea.offsetHeight;
						}
					});
				};

				// === Main Render Function ===
				const renderUI = () => {
					// Capture current textarea heights BEFORE destroying DOM
					captureTextareaHeights();

					const activeTab = node.properties.active_tab || "library";
					const promptQueue = parsePromptBatch();
					const resolvedModeWidget = node.widgets?.find((w) => w.name === "resolved_mode");
					const resolvedMode = resolvedModeWidget?.value || "txt2img";
					// Creative model is UI-only, stored in properties
					if (this.properties.creative_model === undefined) {
						this.properties.creative_model = "gemini-2.5-pro";
					}
					const currentCreativeModel = this.properties.creative_model || "gemini-2.5-pro";
					const creativeSystemPrompt = node.properties.creative_system_prompt || DEFAULT_RPG_SYSTEM_PROMPT;
					const currentCreativeTemperature = parseFloat(node.properties.creative_temperature ?? 0.9) || 0.9;
					const currentCreativeTopP = parseFloat(node.properties.creative_top_p ?? 0.9) || 0.9;

					const totalGenerations = promptQueue.reduce((sum, entry) => sum + (entry.repeat_count || 1), 0);

					const tabs = [
						{ id: "library", label: "Prompts Library", icon: "📚" },
						{ id: "generate", label: "Generate Prompts", icon: "🎯" },
					];

					const linkedImages = node._linkedImageCount || 0;

					// Use detected mode from AIL if available
					const detectedMode = node._linkedAILMode || resolvedMode;
					const isDetectedFromAIL = node._linkedAILMode !== null;

					const tabButtons = tabs
						.map(
							(tab) => `
							<button class="instaraw-rpg-tab ${activeTab === tab.id ? "active" : ""}" data-tab="${tab.id}">
								<span>${tab.icon}</span>
								${tab.label}
							</button>
						`,
						)
						.join("");

					const uiState = {
						promptQueue,
						currentCreativeModel,
						creativeSystemPrompt,
						currentCreativeTemperature,
						currentCreativeTopP,
					};
					const tabContent = renderActiveTabContent(activeTab, uiState);
					const imagePreview = renderImagePreview(resolvedMode, totalGenerations);

					container.innerHTML = `
						<div class="instaraw-rpg-content">
							<div class="instaraw-rpg-main-panel">
								<div class="instaraw-rpg-topbar">
									<div class="instaraw-rpg-mode-card">
										<div class="instaraw-rpg-mode-indicator-container" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
											<div style="display: flex; align-items: center; gap: 8px;">
												<span class="instaraw-rpg-mode-badge ${detectedMode === 'img2img' ? 'instaraw-rpg-mode-img2img' : 'instaraw-rpg-mode-txt2img'}" style="font-size: 14px; padding: 8px 16px; font-weight: 700;">
													${detectedMode === 'img2img' ? '🖼️ IMG2IMG MODE' : '🎨 TXT2IMG MODE'}
												</span>
												${isDetectedFromAIL ? `<span class="instaraw-rpg-mode-source">From AIL #${node._linkedAILNodeId}</span>` : ''}
											</div>
											<div style="display: flex; align-items: center; gap: 10px;">
												<img src="/extensions/ComfyUI_INSTARAW/instaraw.svg" alt="INSTARAW" style="width: 177px; height: auto;" />
												<span style="font-family: monospace; font-size: 14px; color: rgba(255, 255, 255, 0.5); white-space: nowrap;">RPG V2.0</span>
											</div>
											<button class="instaraw-rpg-btn-secondary instaraw-rpg-sdxl-toggle-btn" style="font-size: 12px; padding: 6px 12px;">
												${sdxlModeEnabled ? '🏷️ SDXL MODE ON' : '📝 SDXL MODE OFF'}
											</button>
										</div>
									</div>
									<div class="instaraw-rpg-kpi-row">
										<div class="instaraw-rpg-kpi">
											<span>Queue</span>
											<strong>${promptQueue.length}</strong>
										</div>
										<div class="instaraw-rpg-kpi">
											<span>Generations</span>
											<strong>${totalGenerations}</strong>
										</div>
										<div class="instaraw-rpg-kpi">
											<span>Images</span>
											<strong>${linkedImages}</strong>
										</div>
									</div>
								</div>
								<div class="instaraw-rpg-tabs">
									${tabButtons}
								</div>
								<div class="instaraw-rpg-panel-card">
									${tabContent}
								</div>
							</div>
							<div class="instaraw-rpg-batch-panel">
								${imagePreview}
								${renderBatchPanel(promptQueue, totalGenerations)}
							</div>
						</div>

						<div class="instaraw-rpg-footer">
							<div class="instaraw-rpg-stats">
								<span class="instaraw-rpg-stat-badge">Gen: ${totalGenerations}</span>
								<span class="instaraw-rpg-stat-label">${detectedMode === 'img2img' ? 'IMG2IMG' : 'TXT2IMG'}</span>
								${node._linkedAILNodeId ? `<span class="instaraw-rpg-stat-label">AIL #${node._linkedAILNodeId}</span>` : `<span class="instaraw-rpg-stat-label">No AIL</span>`}
							</div>
						</div>
					`;

					setupEventHandlers();
					setupDragAndDrop();
					setupTextareaResizeObserver(); // Watch for manual textarea resizing

					// Restore generation UI if there are completed or in-progress generations
					if ((node._generatedUnifiedPrompts || node._generationInProgress) && activeTab === "generate") {
						restoreGenerationUI();
					}

					// Single delayed height update after DOM fully settles
					setTimeout(() => updateCachedHeight(), 100);
				};

				// === Tab Content Rendering ===
				const renderActiveTabContent = (activeTab, uiState) => {
					if (isDatabaseLoading) {
						return `
							<div class="instaraw-rpg-loading">
								<div class="instaraw-rpg-loading-spinner"></div>
								<p>Loading Prompts Database...</p>
								<div class="instaraw-rpg-progress-bar">
									<div class="instaraw-rpg-progress-fill" style="width: ${databaseLoadProgress}%"></div>
								</div>
								<p class="instaraw-rpg-progress-text">${databaseLoadProgress}% (22MB)</p>
							</div>
						`;
					}

					if (!promptsDatabase) {
						return `
							<div class="instaraw-rpg-empty">
								<p>Database not loaded</p>
								<button class="instaraw-rpg-btn-primary instaraw-rpg-reload-db-btn">🔄 Load Database</button>
							</div>
						`;
					}

					switch (activeTab) {
						case "library":
							return renderLibraryTab();
						case "generate":
							return renderGenerateTab(uiState);
						case "custom":
							return renderCustomTab(uiState);
						case "creative":  // LEGACY - Fallback for old workflows
							return renderCreativeTab(uiState);
						case "character":  // LEGACY - Fallback for old workflows
							return renderCharacterTab();
						default:
							return "";
					}
				};

					// === Library Tab ===
				const renderLibraryTab = () => {
					const filters = JSON.parse(node.properties.library_filters || "{}");
					const bookmarks = bookmarksCache;
					const promptQueue = parsePromptBatch();
					const batchSourceIds = new Set(promptQueue.map(p => p.source_id).filter(Boolean));

					// Determine which prompts to show
					let filteredPrompts;
					let pagePrompts;
					let totalPages;

					if (showingRandomPrompts && randomPrompts.length > 0) {
						// Random mode: show the fetched random prompts
						filteredPrompts = randomPrompts;
						pagePrompts = randomPrompts; // Show all random prompts (no pagination)
						totalPages = 1;
					} else {
						// Normal mode: apply filters
						filteredPrompts = filterPrompts(promptsDatabase, filters);

						// Pagination
						totalPages = Math.ceil(filteredPrompts.length / itemsPerPage);
						const startIdx = currentPage * itemsPerPage;
						const endIdx = startIdx + itemsPerPage;
						pagePrompts = filteredPrompts.slice(startIdx, endIdx);
					}

					// Calculate counts for prompt source dropdown
					const allPromptsCount = promptsDatabase.length;
					const libraryPromptsCount = promptsDatabase.filter(p => !p.is_user_created && !p.is_ai_generated).length;
					const userPromptsCount = userPrompts.length;
					const generatedPromptsCount = promptsDatabase.filter(p => p.is_ai_generated).length;

					return `
						<div class="instaraw-rpg-library">
							<div class="instaraw-rpg-filters">
								<input type="text" class="instaraw-rpg-search-input" placeholder="🔍 Search by prompt, tags, or ID..." value="${filters.search_query || ""}" />
								<div class="instaraw-rpg-filter-row">
									<select class="instaraw-rpg-filter-dropdown" data-filter="content_type">
										<option value="any">All Content Types</option>
										<option value="person" ${filters.content_type === "person" ? "selected" : ""}>Person</option>
										<option value="object" ${filters.content_type === "object" ? "selected" : ""}>Object</option>
										<option value="other" ${filters.content_type === "other" ? "selected" : ""}>Other</option>
									</select>
									<select class="instaraw-rpg-filter-dropdown" data-filter="safety_level">
										<option value="any">All Safety Levels</option>
										<option value="sfw" ${filters.safety_level === "sfw" ? "selected" : ""}>SFW</option>
										<option value="suggestive" ${filters.safety_level === "suggestive" ? "selected" : ""}>Suggestive</option>
										<option value="nsfw" ${filters.safety_level === "nsfw" ? "selected" : ""}>NSFW</option>
										<option value="suggestive_nsfw" ${filters.safety_level === "suggestive_nsfw" ? "selected" : ""}>Suggestive + NSFW</option>
									</select>
									<select class="instaraw-rpg-filter-dropdown" data-filter="shot_type">
										<option value="any">All Shot Types</option>
										<option value="portrait" ${filters.shot_type === "portrait" ? "selected" : ""}>Portrait</option>
										<option value="full_body" ${filters.shot_type === "full_body" ? "selected" : ""}>Full Body</option>
										<option value="other" ${filters.shot_type === "other" ? "selected" : ""}>Other</option>
									</select>
									<select class="instaraw-rpg-filter-dropdown" data-filter="prompt_source">
										<option value="all" ${filters.prompt_source === "all" || !filters.prompt_source ? "selected" : ""}>📚 All Prompts (${allPromptsCount})</option>
										<option value="library" ${filters.prompt_source === "library" ? "selected" : ""}>📚 Library Only (${libraryPromptsCount})</option>
										<option value="user" ${filters.prompt_source === "user" ? "selected" : ""}>✏️ My Prompts (${userPromptsCount})</option>
										<option value="generated" ${filters.prompt_source === "generated" ? "selected" : ""}>✨ Generated (${generatedPromptsCount})</option>
									</select>
									<label class="instaraw-rpg-checkbox-label" title="Show only bookmarked prompts">
										<input type="checkbox" class="instaraw-rpg-show-bookmarked-checkbox" ${filters.show_bookmarked ? "checked" : ""} />
										⭐ Favorites Only
									</label>
									<button class="instaraw-rpg-btn-secondary instaraw-rpg-clear-filters-btn">✖ Clear</button>
								</div>
							</div>

							<div class="instaraw-rpg-library-header">
								<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
									<!-- Buttons Row -->
									<div style="display: flex; align-items: center; gap: 6px;">
										${showingRandomPrompts ? `
											<!-- Random Mode: Show Add All, Reroll, and Exit buttons -->
											<button class="instaraw-rpg-btn-primary instaraw-rpg-add-all-random-btn" style="font-size: 12px; padding: 6px 12px;">
												✓ Add All ${randomPrompts.length} to Batch
											</button>
											<button class="instaraw-rpg-btn-secondary instaraw-rpg-reroll-random-btn" style="font-size: 12px; padding: 6px 12px;" title="Get different random prompts">
												🎲 Reroll
											</button>
											<button class="instaraw-rpg-btn-secondary instaraw-rpg-exit-random-btn" style="font-size: 12px; padding: 6px 12px;">
												← Back to Library
											</button>
										` : selectionMode ? `
											<!-- Selection Mode: Show Select All, Delete, and Cancel buttons -->
											<button class="instaraw-rpg-btn-secondary instaraw-rpg-select-all-btn" style="font-size: 12px; padding: 6px 12px;">
												☑ Select All
											</button>
											<button class="instaraw-rpg-btn-secondary instaraw-rpg-deselect-all-btn" style="font-size: 12px; padding: 6px 12px;">
												☐ Deselect All
											</button>
											<button class="instaraw-rpg-btn-primary instaraw-rpg-delete-selected-btn" style="font-size: 12px; padding: 6px 12px; background: #dc2626;" ${selectedPrompts.size === 0 ? 'disabled' : ''}>
												🗑️ Delete Selected (${selectedPrompts.size})
											</button>
											<button class="instaraw-rpg-btn-secondary instaraw-rpg-cancel-selection-btn" style="font-size: 12px; padding: 6px 12px;">
												✖ Cancel
											</button>
										` : `
											<!-- Normal Mode: Show Create/Import/Export, Select, and Random controls -->
											<button class="instaraw-rpg-btn-secondary instaraw-rpg-create-prompt-btn" style="font-size: 12px; padding: 6px 12px;" title="Create new custom prompt">
												➕ Create
											</button>
											<button class="instaraw-rpg-btn-secondary instaraw-rpg-import-prompts-btn" style="font-size: 12px; padding: 6px 12px;" title="Import prompts from JSON file">
												📂 Import
											</button>
											<button class="instaraw-rpg-btn-secondary instaraw-rpg-export-prompts-btn" style="font-size: 12px; padding: 6px 12px;" title="Export user prompts, bookmarks, and batch queue to JSON file" ${userPrompts.length === 0 && bookmarks.length === 0 && promptQueue.length === 0 ? 'disabled' : ''}>
												💾 Export (${userPrompts.length + bookmarks.length + promptQueue.length})
											</button>
											${(filters.prompt_source === 'user' || filters.prompt_source === 'generated') ? `
												<button class="instaraw-rpg-btn-secondary instaraw-rpg-enter-selection-btn" style="font-size: 12px; padding: 6px 12px;" title="Select multiple prompts to delete">
													☑ Select
												</button>
											` : ''}
											<div style="width: 1px; height: 20px; background: #4b5563; margin: 0 4px;"></div>
											<label style="font-size: 11px; color: #9ca3af; margin-right: 4px;">Random:</label>
											<input type="number" class="instaraw-rpg-random-count-input" value="${randomCount}" min="1" max="50" style="width: 50px; padding: 4px 6px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.05); color: #f9fafb; border-radius: 4px; font-size: 12px;" title="How many random prompts to show (uses current filters)" />
											<button class="instaraw-rpg-btn-secondary instaraw-rpg-show-random-btn" style="font-size: 12px; padding: 6px 12px;">
												🎲 Show Random
											</button>
										`}
									</div>
									<!-- Result Count Row (wraps to new line) -->
									<div style="flex-basis: 100%; font-size: 12px; color: #9ca3af; margin-top: 4px;">
										${showingRandomPrompts
											? `Showing ${randomPrompts.length} random prompts`
											: `${filteredPrompts.length} prompt${filteredPrompts.length === 1 ? '' : 's'} found${totalPages > 1 ? ` • Page ${currentPage + 1} of ${totalPages}` : ''}`
										}
									</div>
								</div>
							</div>

							${
								totalPages > 1
									? `
								<div class="instaraw-rpg-pagination instaraw-rpg-pagination-top">
									<button class="instaraw-rpg-btn-secondary instaraw-rpg-prev-page-btn" ${currentPage === 0 ? "disabled" : ""}>← Prev</button>
									<span class="instaraw-rpg-page-info">Page ${currentPage + 1} / ${totalPages}</span>
									<button class="instaraw-rpg-btn-secondary instaraw-rpg-next-page-btn" ${currentPage >= totalPages - 1 ? "disabled" : ""}>Next →</button>
								</div>
								`
									: ""
							}

							<div class="instaraw-rpg-library-grid">
								${
									pagePrompts.length === 0
										? `<div class="instaraw-rpg-empty"><p>No prompts found</p><p class="instaraw-rpg-hint">Try adjusting your filters</p></div>`
										: pagePrompts
												.map(
													(prompt) => {
														const batchCount = promptQueue.filter(p => p.source_id === prompt.id).length;
														const positive = prompt.prompt?.positive || "";
														const negative = prompt.prompt?.negative || "";

														// Debug: Log if positive is empty but negative isn't
														if (!positive && negative) {
															console.warn(`[RPG] Prompt ${prompt.id} has empty positive but has negative:`, {
																id: prompt.id,
																positive: positive,
																negative: negative,
																fullPrompt: prompt.prompt,
																tags: prompt.tags
															});
														}

														// Show positive, or if empty show negative with warning, or show placeholder
														const displayText = positive
															? positive
															: negative
																? `[No positive prompt] ${negative}`
																: "[Empty prompt]";

														const searchQuery = filters.search_query?.trim() || "";
														const sdxlMode = sdxlModeEnabled;
														const matchType = prompt._matchType;
														const matchBadge = matchType === 'both' ? '📝🏷️' : matchType === 'prompt' ? '📝' : matchType === 'tags' ? '🏷️' : '';
														const sourceBadge = prompt.is_user_created ? '✏️ My Prompt' : prompt.is_ai_generated ? '✨ AI Generated' : '📚 Library';

														const allTags = prompt.tags || [];
														const autoExpand = matchType === 'tags' || matchType === 'both'; // Auto-expand if tags match

														return `
									<div class="instaraw-rpg-library-card ${batchCount > 0 ? 'in-batch' : ''} ${prompt.is_user_created ? 'user-prompt' : ''} ${selectionMode ? 'selection-mode' : ''}" data-id="${prompt.id}" data-is-user="${prompt.is_user_created ? 'true' : 'false'}">
										<div class="instaraw-rpg-library-card-header">
											${selectionMode && (prompt.is_user_created || prompt.is_ai_generated) ? `
												<label class="instaraw-rpg-selection-checkbox" style="display: flex; align-items: center; margin-right: 8px; cursor: pointer;">
													<input type="checkbox" class="instaraw-rpg-prompt-checkbox" data-id="${prompt.id}" ${selectedPrompts.has(prompt.id) ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;" />
												</label>
											` : ''}
											<button class="instaraw-rpg-bookmark-btn ${bookmarks.includes(prompt.id) ? "bookmarked" : ""}" data-id="${prompt.id}">
												${bookmarks.includes(prompt.id) ? "⭐" : "☆"}
											</button>
											<div class="instaraw-rpg-batch-controls">
												<button class="instaraw-rpg-add-to-batch-btn" data-id="${prompt.id}">+ Add</button>
												${batchCount > 0 ? `<button class="instaraw-rpg-undo-batch-btn" data-id="${prompt.id}">↶ ${batchCount}</button>` : ''}
												${prompt.is_user_created ? `<button class="instaraw-rpg-delete-user-prompt-btn" data-id="${prompt.id}" title="Delete this prompt">🗑️</button>` : ''}
												${prompt.is_ai_generated ? `<button class="instaraw-rpg-delete-generated-prompt-btn" data-id="${prompt.id}" title="Delete this generated prompt">🗑️</button>` : ''}
											</div>
										</div>
										<div class="instaraw-rpg-library-card-content">
											<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; align-items: center;">
												<div class="instaraw-rpg-source-badge ${prompt.is_user_created ? 'user' : prompt.is_ai_generated ? 'generated' : 'library'}">${sourceBadge}</div>
												${matchBadge ? `<div class="instaraw-rpg-match-badge">${matchBadge} Match</div>` : ''}
												<div class="instaraw-rpg-id-badge-container">
													<span class="instaraw-rpg-id-badge" title="Prompt ID: ${prompt.id}">ID: ${prompt.id.substring(0, 8)}..</span>
													<button class="instaraw-rpg-id-copy-btn" data-id="${prompt.id}" title="Copy full ID">📄</button>
												</div>
												<div class="instaraw-rpg-id-badge-container" style="margin-left: auto;">
													<button class="instaraw-rpg-copy-prompt-btn" data-positive="${escapeHtml(positive)}" title="Copy positive prompt">📋</button>
												</div>
											</div>

											${prompt.is_user_created ? `
												<!-- User Created Prompt -->
												${editingPrompts.has(prompt.id) ? `
													<!-- EDIT MODE: Show textareas with Save/Cancel -->
													<div style="display: flex; flex-direction: column; gap: 8px;">
														<div>
															<label style="font-size: 11px; font-weight: 500; color: rgba(249, 250, 251, 0.7); text-transform: uppercase; display: block; margin-bottom: 4px;">Positive Prompt</label>
															<textarea class="instaraw-rpg-prompt-textarea instaraw-rpg-user-prompt-edit-positive" data-id="${prompt.id}">${escapeHtml(editingValues[prompt.id]?.positive ?? positive)}</textarea>
														</div>
														<div>
															<label style="font-size: 11px; font-weight: 500; color: rgba(249, 250, 251, 0.7); text-transform: uppercase; display: block; margin-bottom: 4px;">Negative Prompt</label>
															<textarea class="instaraw-rpg-prompt-textarea instaraw-rpg-user-prompt-edit-negative" data-id="${prompt.id}">${escapeHtml(editingValues[prompt.id]?.negative ?? negative)}</textarea>
														</div>
														<div>
															<label style="font-size: 11px; font-weight: 500; color: rgba(249, 250, 251, 0.7); text-transform: uppercase; display: block; margin-bottom: 4px;">Tags (comma-separated)</label>
															<input type="text" class="instaraw-rpg-prompt-textarea instaraw-rpg-user-prompt-edit-tags" data-id="${prompt.id}" value="${editingValues[prompt.id]?.tags ?? allTags.join(", ")}" placeholder="tag1, tag2, tag3..." style="resize: none; min-height: auto; height: auto;" />
														</div>

														<!-- Classification Fields -->
														<div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
															<div>
																<label style="font-size: 11px; font-weight: 500; color: rgba(249, 250, 251, 0.7); text-transform: uppercase; display: block; margin-bottom: 4px;">Content Type</label>
																<select class="instaraw-rpg-filter-dropdown instaraw-rpg-user-prompt-edit-content-type" data-id="${prompt.id}" style="width: 100%; padding: 6px 8px;">
																	<option value="person" ${(editingValues[prompt.id]?.content_type ?? prompt.classification?.content_type ?? 'person') === 'person' ? 'selected' : ''}>Person</option>
																	<option value="object" ${(editingValues[prompt.id]?.content_type ?? prompt.classification?.content_type ?? 'person') === 'object' ? 'selected' : ''}>Object</option>
																	<option value="other" ${(editingValues[prompt.id]?.content_type ?? prompt.classification?.content_type ?? 'person') === 'other' ? 'selected' : ''}>Other</option>
																</select>
															</div>
															<div>
																<label style="font-size: 11px; font-weight: 500; color: rgba(249, 250, 251, 0.7); text-transform: uppercase; display: block; margin-bottom: 4px;">Safety Level</label>
																<select class="instaraw-rpg-filter-dropdown instaraw-rpg-user-prompt-edit-safety-level" data-id="${prompt.id}" style="width: 100%; padding: 6px 8px;">
																	<option value="sfw" ${(editingValues[prompt.id]?.safety_level ?? prompt.classification?.safety_level ?? 'sfw') === 'sfw' ? 'selected' : ''}>SFW</option>
																	<option value="suggestive" ${(editingValues[prompt.id]?.safety_level ?? prompt.classification?.safety_level ?? 'sfw') === 'suggestive' ? 'selected' : ''}>Suggestive</option>
																	<option value="nsfw" ${(editingValues[prompt.id]?.safety_level ?? prompt.classification?.safety_level ?? 'sfw') === 'nsfw' ? 'selected' : ''}>NSFW</option>
																</select>
															</div>
															<div>
																<label style="font-size: 11px; font-weight: 500; color: rgba(249, 250, 251, 0.7); text-transform: uppercase; display: block; margin-bottom: 4px;">Shot Type</label>
																<select class="instaraw-rpg-filter-dropdown instaraw-rpg-user-prompt-edit-shot-type" data-id="${prompt.id}" style="width: 100%; padding: 6px 8px;">
																	<option value="portrait" ${(editingValues[prompt.id]?.shot_type ?? prompt.classification?.shot_type ?? 'portrait') === 'portrait' ? 'selected' : ''}>Portrait</option>
																	<option value="full_body" ${(editingValues[prompt.id]?.shot_type ?? prompt.classification?.shot_type ?? 'portrait') === 'full_body' ? 'selected' : ''}>Full Body</option>
																	<option value="other" ${(editingValues[prompt.id]?.shot_type ?? prompt.classification?.shot_type ?? 'portrait') === 'other' ? 'selected' : ''}>Other</option>
																</select>
															</div>
														</div>

														<div style="display: flex; gap: 6px; margin-top: 4px;">
															<button class="instaraw-rpg-btn-primary instaraw-rpg-save-user-prompt-btn" data-id="${prompt.id}" style="font-size: 11px; padding: 6px 12px; flex: 1;">
																💾 Save
															</button>
															<button class="instaraw-rpg-btn-secondary instaraw-rpg-cancel-edit-prompt-btn" data-id="${prompt.id}" style="font-size: 11px; padding: 6px 12px; flex: 1;">
																✖ Cancel
															</button>
														</div>
													</div>
												` : sdxlMode ? `
													<!-- VIEW MODE (SDXL): Show tags as comma-separated text -->
													<div class="instaraw-rpg-prompt-preview ${allTags.length === 0 ? 'instaraw-rpg-error-text' : ''}">
														${allTags.length > 0 ? allTags.map((tag) => highlightSearchTerm(tag, searchQuery)).join(", ") : "[Empty prompt]"}
													</div>
													<button class="instaraw-rpg-btn-secondary instaraw-rpg-edit-user-prompt-btn" data-id="${prompt.id}" style="font-size: 11px; padding: 4px 10px; margin-top: 8px; width: 100%;">
														✏️ Edit Prompt
													</button>
												` : `
													<!-- VIEW MODE (Normal): Show prompt with tags -->
													<div class="instaraw-rpg-prompt-preview ${!positive ? 'instaraw-rpg-error-text' : ''}">${highlightSearchTerm(displayText, searchQuery)}</div>
													${negative ? `<div class="instaraw-rpg-prompt-preview" style="font-size: 11px; color: #9ca3af; margin-top: 4px;"><strong>Negative:</strong> ${highlightSearchTerm(negative, searchQuery)}</div>` : ''}
													<div class="instaraw-rpg-library-card-tags" style="margin-top: 8px;">
														${allTags.map((tag) => `<span class="instaraw-rpg-tag">${highlightSearchTerm(tag, searchQuery)}</span>`).join("")}
													</div>
													<button class="instaraw-rpg-btn-secondary instaraw-rpg-edit-user-prompt-btn" data-id="${prompt.id}" style="font-size: 11px; padding: 4px 10px; margin-top: 8px; width: 100%;">
														✏️ Edit Prompt
													</button>
												`}
											` : sdxlMode ? `
												<!-- SDXL Mode: Show tags as comma-separated text -->
												<div class="instaraw-rpg-prompt-preview">
													${allTags.map((tag) => highlightSearchTerm(tag, searchQuery)).join(", ")}
												</div>
											` : `
												<!-- Normal Mode: Prompt primary, tags secondary with expand/collapse -->
												<div class="instaraw-rpg-prompt-preview ${!positive ? 'instaraw-rpg-error-text' : ''}">${highlightSearchTerm(displayText, searchQuery)}</div>
												<div class="instaraw-rpg-library-card-tags" data-expanded="${autoExpand}" data-prompt-id="${prompt.id}">
													${autoExpand || allTags.length <= 5
														? allTags.map((tag) => `<span class="instaraw-rpg-tag">${highlightSearchTerm(tag, searchQuery)}</span>`).join("")
														: allTags.slice(0, 5).map((tag) => `<span class="instaraw-rpg-tag">${highlightSearchTerm(tag, searchQuery)}</span>`).join("")
													}
													${allTags.length > 5 ? `<button class="instaraw-rpg-toggle-tags-btn" data-id="${prompt.id}">${autoExpand ? 'Show less' : '+' + (allTags.length - 5)}</button>` : ""}
												</div>
											`}
											${(prompt.model_badge || prompt.theme_badge) ? `
												<div class="instaraw-rpg-prompt-meta">
													${prompt.theme_badge ? `<div class="instaraw-rpg-prompt-meta-item">Creative Theme: ${prompt.theme_badge}</div>` : ''}
													${prompt.model_badge ? `<div class="instaraw-rpg-prompt-meta-item">Optimized for: ${prompt.model_badge}</div>` : ''}
												</div>
											` : ''}
										</div>
									</div>
								`;
													}
												)
												.join("")
								}
							</div>

							${
								totalPages > 1
									? `
								<div class="instaraw-rpg-pagination">
									<button class="instaraw-rpg-btn-secondary instaraw-rpg-prev-page-btn" ${currentPage === 0 ? "disabled" : ""}>← Prev</button>
									<span class="instaraw-rpg-page-info">Page ${currentPage + 1} / ${totalPages} (${filteredPrompts.length} prompts)</span>
									<button class="instaraw-rpg-btn-secondary instaraw-rpg-next-page-btn" ${currentPage >= totalPages - 1 ? "disabled" : ""}>Next →</button>
								</div>
							`
									: ""
							}
						</div>
					`;
				};

				// === Creative Tab ===
				const renderCreativeTab = (uiState) => {
					const promptQueue = uiState?.promptQueue || [];
					const selectedForInspiration = promptQueue.filter((p) => p.source_id).slice(0, 5);
					const modelOptionsHtml = CREATIVE_MODEL_OPTIONS
						.map(
							(opt) => `<option value="${opt.value}" ${opt.value === (uiState?.currentCreativeModel || "gemini-2.5-pro") ? "selected" : ""}>${opt.label}</option>`
						)
						.join("");
					const temperature = uiState?.currentCreativeTemperature ?? 0.9;
					const topP = uiState?.currentCreativeTopP ?? 0.9;
					const systemPrompt = uiState?.creativeSystemPrompt || DEFAULT_RPG_SYSTEM_PROMPT;

					return `
						<div class="instaraw-rpg-model-settings">
							<div class="instaraw-rpg-model-row">
								<label>Creative Model</label>
								<select class="instaraw-rpg-model-select">
									${modelOptionsHtml}
								</select>
							</div>
							<div class="instaraw-rpg-model-grid">
								<div class="instaraw-rpg-model-control">
									<label>Temperature</label>
									<input type="number" class="instaraw-rpg-model-temp" value="${temperature}" min="0" max="2" step="0.01" />
								</div>
								<div class="instaraw-rpg-model-control">
									<label>Top P</label>
									<input type="number" class="instaraw-rpg-model-top-p" value="${topP}" min="0" max="1" step="0.01" />
								</div>
							</div>
							<div class="instaraw-rpg-model-row">
								<label>System Prompt</label>
								<textarea class="instaraw-rpg-system-prompt" rows="4">${escapeHtml(systemPrompt)}</textarea>
							</div>
						</div>
						<div class="instaraw-rpg-creative">
							<div class="instaraw-rpg-creative-header">
								<h3>Creative Prompt Generation</h3>
								<p>Generate variations based on Library prompts or create new prompts from scratch</p>
							</div>

							<div class="instaraw-rpg-inspiration-section">
								<label>Inspiration Sources (${selectedForInspiration.length})</label>
								<div class="instaraw-rpg-inspiration-list">
									${
										selectedForInspiration.length === 0
											? `<p class="instaraw-rpg-hint">Add prompts from Library to use as inspiration</p>`
											: selectedForInspiration
													.map(
														(p) => `
										<div class="instaraw-rpg-inspiration-item">
											<span class="instaraw-rpg-inspiration-text">${escapeHtml(p.positive_prompt || "")}</span>
										</div>
									`
													)
													.join("")
									}
								</div>
							</div>

							<div class="instaraw-rpg-creative-controls">
								<div class="instaraw-rpg-control-group">
									<label>Generation Count</label>
									<input type="number" class="instaraw-rpg-number-input instaraw-rpg-gen-count-input" value="5" min="1" max="50" />
								</div>
								<div class="instaraw-rpg-control-group">
									<label>Inspiration Count</label>
									<input type="number" class="instaraw-rpg-number-input instaraw-rpg-inspiration-count-input" value="3" min="0" max="${selectedForInspiration.length}" />
								</div>
							</div>

							<button class="instaraw-rpg-btn-primary instaraw-rpg-generate-creative-btn">✨ Generate & Add to Batch</button>

							<div class="instaraw-rpg-creative-preview" style="display: none;">
								<h4>Generated Prompts Preview</h4>
								<div class="instaraw-rpg-creative-preview-list"></div>
								<button class="instaraw-rpg-btn-primary instaraw-rpg-accept-creative-btn">✓ Accept All</button>
								<button class="instaraw-rpg-btn-secondary instaraw-rpg-cancel-creative-btn">✖ Cancel</button>
							</div>
						</div>
					`;
				};

			// === Unified Generate Tab ===
			const renderGenerateTab = (uiState) => {
				const promptQueue = uiState?.promptQueue || [];
				const detectedMode = node._linkedAILMode || "txt2img";
				const modelOptionsHtml = CREATIVE_MODEL_OPTIONS
					.map(
						(opt) => `<option value="${opt.value}" ${opt.value === (uiState?.currentCreativeModel || "gemini-2.5-pro") ? "selected" : ""}>${opt.label}</option>`
					)
					.join("");
				const temperature = uiState?.currentCreativeTemperature ?? 0.9;
				const topP = uiState?.currentCreativeTopP ?? 0.9;

				// Character description - generated descriptions populate the character_text_input
				const characterText = node.properties.character_text_input || "";
				// Check if character_image is connected AND the source node still exists
				const characterImageInput = node.inputs?.find(i => i.name === "character_image");
				let hasCharacterImage = false;
				if (characterImageInput && characterImageInput.link != null) {
					const link = app.graph.links[characterImageInput.link];
					if (link) {
						const sourceNode = app.graph.getNodeById(link.origin_id);
						hasCharacterImage = !!sourceNode; // Only true if node still exists
					}
				}

				return `
					<div class="instaraw-rpg-generate-unified">
						<!-- Model Settings (TOP - affects ALL generation including character) -->
						<div class="instaraw-rpg-section">
							<div class="instaraw-rpg-section-header">
								<span class="instaraw-rpg-section-label">⚙️ Model Settings</span>
								<span class="instaraw-rpg-hint-text" style="font-size: 11px; color: #9ca3af;">Used for all generation</span>
							</div>
							<div class="instaraw-rpg-model-settings">
								<div class="instaraw-rpg-model-row">
									<label>Model</label>
									<select class="instaraw-rpg-model-select">
										${modelOptionsHtml}
									</select>
								</div>
								<div class="instaraw-rpg-model-grid">
									<div class="instaraw-rpg-model-control">
										<label>Temperature</label>
										<input type="number" class="instaraw-rpg-model-temp" value="${temperature}" min="0" max="2" step="0.01" />
									</div>
									<div class="instaraw-rpg-model-control">
										<label>Top P</label>
										<input type="number" class="instaraw-rpg-model-top-p" value="${topP}" min="0" max="1" step="0.01" />
									</div>
								</div>
							</div>
						</div>

						<!-- Character Consistency (Optional) -->
						<div class="instaraw-rpg-section">
							<div style="display: flex; align-items: center; gap: 8px;">
								<label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
									<input type="checkbox" class="instaraw-rpg-checkbox instaraw-rpg-enable-character-checkbox" ${node.properties.use_character_likeness ? 'checked' : ''} />
									<span style="font-size: 13px; font-weight: 500;">🎭 Character Consistency</span>
								</label>
								<span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: ${node.properties.use_character_likeness ? (characterText.trim() ? 'rgba(34, 197, 94, 0.15)' : 'rgba(251, 191, 36, 0.15)') : 'rgba(107, 114, 128, 0.15)'}; color: ${node.properties.use_character_likeness ? (characterText.trim() ? '#4ade80' : '#fbbf24') : '#9ca3af'};">
									${!node.properties.use_character_likeness ? '⚪ Disabled' : characterText.trim() ? '✅ Active' : '⚠️ Empty'}
								</span>
							</div>
							<div class="instaraw-rpg-character-section" style="display: ${node.properties.use_character_likeness ? 'block' : 'none'};">
								${hasCharacterImage ? `
									<div class="instaraw-rpg-info-banner" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; font-size: 12px; color: #93c5fd;">
										📸 <strong>Character Image Connected</strong> - Click "Generate from Image" to create description
									</div>
								` : ''}
								<div class="instaraw-rpg-control-group">
									<label>Character Description</label>
									<textarea class="instaraw-rpg-character-text-input instaraw-rpg-prompt-textarea" placeholder="blonde hair, blue eyes, athletic build, fair skin, delicate features..." style="line-height: 1.42; min-height: 60px; resize: vertical;">${escapeHtml(characterText)}</textarea>
									<div class="instaraw-rpg-hint-text" style="margin-top: 8px; font-size: 11px; color: #9ca3af;">
										💡 This description will be included in ALL generated prompts for character consistency
									</div>
								</div>
								<div class="instaraw-rpg-character-generation-settings">
									<div class="instaraw-rpg-control-row" style="display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: center; margin-bottom: 12px;">
										<label style="margin: 0; font-size: 12px;">Complexity</label>
										<select class="instaraw-rpg-model-select instaraw-rpg-character-complexity">
											<option value="concise" ${(node.properties.character_complexity || 'balanced') === 'concise' ? 'selected' : ''}>Concise (50-75 words)</option>
											<option value="balanced" ${(node.properties.character_complexity || 'balanced') === 'balanced' ? 'selected' : ''}>Balanced (100-150 words)</option>
											<option value="detailed" ${(node.properties.character_complexity || 'balanced') === 'detailed' ? 'selected' : ''}>Detailed (200-250 words)</option>
										</select>
									</div>
									${hasCharacterImage ? `
										<div class="instaraw-rpg-character-actions" style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
											<button class="instaraw-rpg-btn-secondary instaraw-rpg-generate-character-desc-btn">
												✨ Generate from Image
											</button>
											<span class="instaraw-rpg-hint-text" style="font-size: 11px; color: #9ca3af;">Uses connected character_image and selected model above</span>
										</div>
									` : ''}
									<details class="instaraw-rpg-advanced-settings" style="padding: 12px; background: #1f2937; border: 1px solid #4b5563; border-radius: 4px;">
										<summary style="cursor: pointer; font-weight: 500; font-size: 12px; color: #9ca3af; user-select: none;">⚙️ Advanced: Edit System Prompt</summary>
										<div style="margin-top: 12px;">
											<textarea class="instaraw-rpg-character-system-prompt instaraw-rpg-prompt-textarea" style="font-family: monospace; font-size: 11px; line-height: 1.5; resize: vertical; width: 100%; ">${escapeHtml(node.properties.character_system_prompt || getCharacterSystemPrompt(node.properties.character_complexity || "balanced"))}</textarea>
											<div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
												<div class="instaraw-rpg-hint-text" style="font-size: 10px; color: #9ca3af;">
													💡 Custom edits override complexity setting
												</div>
												<button class="instaraw-rpg-btn-text instaraw-rpg-reset-system-prompt-btn" style="font-size: 11px; padding: 4px 8px;">🔄 Reset</button>
											</div>
										</div>
									</details>
								</div>
							</div>
						</div>

						<!-- Expression Control -->
						<div class="instaraw-rpg-section">
							<div style="display: flex; align-items: center; gap: 8px;">
								<label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
									<input type="checkbox" class="instaraw-rpg-checkbox instaraw-rpg-enable-expressions-checkbox" ${node.properties.enable_expressions ? 'checked' : ''} />
									<span style="font-size: 13px; font-weight: 500;">😊 Expression Control</span>
								</label>
								<span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: ${node.properties.enable_expressions ? 'rgba(34, 197, 94, 0.15)' : 'rgba(107, 114, 128, 0.15)'}; color: ${node.properties.enable_expressions ? '#4ade80' : '#9ca3af'};">
									${node.properties.enable_expressions ? '✅ Active' : '⚪ Disabled'}
								</span>
							</div>
							<div class="instaraw-rpg-expressions-section" style="display: ${node.properties.enable_expressions ? 'block' : 'none'};">
								<div class="instaraw-rpg-control-group">
									<label style="font-size: 12px; margin-top: 10px; margin-bottom: 8px; display: block;">Available Expressions (toggle to enable/disable)</label>
									<div class="instaraw-rpg-expressions-grid">
										${EXPRESSION_LIST.map(expr => {
											const enabled = JSON.parse(node.properties.enabled_expressions || '[]').includes(expr);
											return `
												<label class="instaraw-rpg-expression-toggle" data-expression="${expr}">
													<input type="checkbox" class="instaraw-rpg-expression-checkbox" ${enabled ? 'checked' : ''} />
													<span class="instaraw-rpg-expression-label">${expr}</span>
												</label>
											`;
										}).join('')}
									</div>
									<div style="display: flex; gap: 8px; margin-top: 12px;">
										<button class="instaraw-rpg-btn-text instaraw-rpg-expressions-select-all" style="font-size: 11px; padding: 4px 8px;">✓ Select All</button>
										<button class="instaraw-rpg-btn-text instaraw-rpg-expressions-clear-all" style="font-size: 11px; padding: 4px 8px;">✗ Clear All</button>
									</div>
								</div>
								<div class="instaraw-rpg-control-group" style="margin-top: 12px;">
									<label style="font-size: 12px;">Default Expression</label>
									<select class="instaraw-rpg-default-expression-select">
										${EXPRESSION_LIST.map(expr => `
											<option value="${expr}" ${expr === (node.properties.default_expression || 'Neutral/Natural') ? 'selected' : ''}>${expr}</option>
										`).join('')}
									</select>
								</div>
								<div class="instaraw-rpg-control-group" style="margin-top: 12px;">
									<label style="font-size: 12px;">
										Mix Default Frequency: <span class="instaraw-rpg-default-mix-value">${node.properties.default_mix_frequency || 0}%</span>
									</label>
									<input type="range" class="instaraw-rpg-default-mix-slider" min="0" max="100" step="5" value="${node.properties.default_mix_frequency || 0}" style="width: 100%;" />
									<div class="instaraw-rpg-hint-text" style="margin-top: 4px; font-size: 11px; color: #9ca3af;">
										0% = always cycle through enabled expressions | 100% = always use default expression
									</div>
								</div>
							</div>
						</div>

						<!-- Library Inspiration (txt2img or img2img creative, non-custom mode) -->
						${node.properties.generation_style !== 'custom' && (detectedMode !== 'img2img' || node.properties.generation_style === 'creative') ? (() => {
							const filters = JSON.parse(node.properties.library_filters || "{}");
							const filteredCount = filterPrompts(promptsDatabase, filters).length;
							const hasActiveFilters = Object.keys(filters).some(key => {
								if (key === 'search_query') return filters[key]?.trim();
								if (key === 'show_bookmarked') return filters[key];
								if (key === 'sdxl_mode') return filters[key];
								return filters[key] !== 'all';
							});
							const inspirationEnabled = node.properties.enable_library_inspiration;

							return `
								<div class="instaraw-rpg-section">
									<div style="display: flex; align-items: center; gap: 8px;">
										<label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
											<input type="checkbox" class="instaraw-rpg-checkbox instaraw-rpg-enable-inspiration-checkbox" ${inspirationEnabled ? 'checked' : ''} />
											<span style="font-size: 13px; font-weight: 500;">📚 Library Inspiration</span>
										</label>
										<span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: ${inspirationEnabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(107, 114, 128, 0.15)'}; color: ${inspirationEnabled ? '#4ade80' : '#9ca3af'};">
											${inspirationEnabled ? '✅ Active' : '⚪ Disabled'}
										</span>
									</div>
									<div class="instaraw-rpg-inspiration-section" style="display: ${inspirationEnabled ? 'block' : 'none'};">
										<div style="background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 6px; padding: 10px; margin-top: 10px;">
											<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
												<span style="font-size: 11px; color: #d1d5db;">Learn from</span>
												<input type="number" class="instaraw-rpg-number-input instaraw-rpg-inspiration-count" value="${node.properties.inspiration_count || 3}" min="1" max="10" style="width: 45px; height: 24px; padding: 2px 6px; font-size: 12px; text-align: center;" />
												<span style="font-size: 11px; color: #d1d5db;">${detectedMode === 'img2img' ? 'prompts for style guidance' : 'prompts per generation'}</span>
											</div>
											<div style="display: flex; align-items: center; justify-content: space-between;">
												<span style="font-size: 11px; color: #9ca3af;">
													Pool: <strong style="color: #e5e7eb; font-weight: 500;">${filteredCount.toLocaleString()}</strong> ${hasActiveFilters ? '<span style="color: #818cf8;">prompts (filtered)</span>' : 'prompts'}
												</span>
												<button class="instaraw-rpg-btn-text instaraw-rpg-open-library-tab-btn" style="font-size: 10px; padding: 3px 6px; opacity: 0.8; display: flex; align-items: center; gap: 4px;" title="Switch to Library tab to adjust filters">
													<span style="color: #9ca3af;">Filters</span> ⚙️
												</button>
											</div>
										</div>
									</div>
								</div>
							`;
						})() : ''}

						<!-- Mode Detection & Settings -->
						<div class="instaraw-rpg-section">
							<div class="instaraw-rpg-section-header">
								<span class="instaraw-rpg-mode-badge ${detectedMode === 'img2img' ? 'instaraw-rpg-mode-img2img' : 'instaraw-rpg-mode-txt2img'}">
									${detectedMode === 'img2img' ? '🖼️ IMG2IMG' : '🎨 TXT2IMG'}
								</span>
								<span class="instaraw-rpg-hint-text">Detected from ${node._linkedAILNodeId ? `AIL #${node._linkedAILNodeId}` : 'workflow'}</span>
							</div>

							<!-- Reality vs Creative vs Custom Mode -->
							<div class="instaraw-rpg-generation-mode-selector" style="margin: 12px 0;">
								<label class="instaraw-rpg-section-label" style="margin-bottom: 8px; display: block;">Generation Mode</label>
								<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
									<button class="instaraw-rpg-mode-toggle-btn ${node.properties.generation_style === 'reality' ? 'active' : ''}" data-mode="reality" style="padding: 12px; border: 2px solid ${node.properties.generation_style === 'reality' ? '#60a5fa' : '#4b5563'}; background: ${node.properties.generation_style === 'reality' ? 'rgba(59, 130, 246, 0.1)' : 'transparent'}; border-radius: 6px; cursor: pointer;">
										<div style="font-weight: 600; font-size: 13px; color: ${node.properties.generation_style === 'reality' ? '#60a5fa' : '#e5e7eb'};">🎯 Reality Mode</div>
										<div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">${detectedMode === 'img2img' ? 'Describe accurately' : 'Strict adherence'}</div>
									</button>
									<button class="instaraw-rpg-mode-toggle-btn ${node.properties.generation_style === 'creative' ? 'active' : ''}" data-mode="creative" style="padding: 12px; border: 2px solid ${node.properties.generation_style === 'creative' ? '#8b5cf6' : '#4b5563'}; background: ${node.properties.generation_style === 'creative' ? 'rgba(139, 92, 246, 0.1)' : 'transparent'}; border-radius: 6px; cursor: pointer;">
										<div style="font-weight: 600; font-size: 13px; color: ${node.properties.generation_style === 'creative' ? '#8b5cf6' : '#e5e7eb'};">✨ Creative Mode</div>
										<div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">${detectedMode === 'img2img' ? 'Transform style' : 'Expand with inspiration'}</div>
									</button>
									<!-- HIDDEN: Custom Mode - Not ready for release yet -->
									<button class="instaraw-rpg-mode-toggle-btn ${node.properties.generation_style === 'custom' ? 'active' : ''}" data-mode="custom" style="display: none; padding: 12px; border: 2px solid ${node.properties.generation_style === 'custom' ? '#10b981' : '#4b5563'}; background: ${node.properties.generation_style === 'custom' ? 'rgba(16, 185, 129, 0.1)' : 'transparent'}; border-radius: 6px; cursor: pointer;">
										<div style="font-weight: 600; font-size: 13px; color: ${node.properties.generation_style === 'custom' ? '#10b981' : '#e5e7eb'};">🛠️ Custom Mode</div>
										<div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">Custom template</div>
									</button>
								</div>
							</div>

							<!-- Custom Template Editor (shown only in Custom mode) -->
							${node.properties.generation_style === 'custom' ? `
								<div class="instaraw-rpg-section" style="margin-top: 12px;">
									<div class="instaraw-rpg-section-header">
										<span class="instaraw-rpg-section-label">📝 Custom System Prompt Template</span>
										<span class="instaraw-rpg-hint-text">Use variables like {SOURCE_PROMPTS}, {TASK_INSTRUCTIONS}</span>
									</div>
									<textarea class="instaraw-rpg-custom-template-textarea instaraw-rpg-prompt-textarea" placeholder="Enter your custom system prompt template..." style="width: 100%; font-family: monospace; font-size: 12px; line-height: 1.5; resize: vertical; ">${escapeHtml(node.properties.custom_template || DEFAULT_RPG_SYSTEM_PROMPT)}</textarea>
									<!-- Template Validation Warnings -->
									${(() => {
										const customTemplate = node.properties.custom_template;
										const warnings = [];

										// Debug logging
										console.log("[RPG] Template validation - custom_template:", customTemplate ? `"${customTemplate.substring(0, 50)}..."` : 'undefined');
										console.log("[RPG] Template validation - length:", customTemplate?.length || 0);
										console.log("[RPG] Template validation - is default?", customTemplate === DEFAULT_RPG_SYSTEM_PROMPT);

										// Only validate if there's a custom template that's DIFFERENT from default
										if (customTemplate && customTemplate.trim().length > 0 && customTemplate !== DEFAULT_RPG_SYSTEM_PROMPT) {
											const templateLength = customTemplate.trim().length;
											const hasVariables = customTemplate.includes('{') && customTemplate.includes('}');

											// Only warn if short AND has no variables
											if (templateLength < 20 && !hasVariables) {
												warnings.push({
													level: 'error',
													message: `Template is too short (${templateLength} chars) and has no variables - will use default instead`
												});
											}

											// Check for missing recommended variables (either TASK_INSTRUCTIONS or USER_INPUT)
											if (!customTemplate.includes('{TASK_INSTRUCTIONS}') && !customTemplate.includes('{USER_INPUT}')) {
												warnings.push({
													level: 'warning',
													message: 'Template missing {TASK_INSTRUCTIONS} or {USER_INPUT} - user input won\'t be included'
												});
											}
										}

										if (warnings.length === 0) return '';

										return warnings.map(w => {
											const bgColor = w.level === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 191, 36, 0.1)';
											const borderColor = w.level === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(251, 191, 36, 0.3)';
											const textColor = w.level === 'error' ? '#fca5a5' : '#fbbf24';
											const icon = w.level === 'error' ? '❌' : '⚠️';

											return `
												<div style="background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 6px; padding: 8px 10px; margin-top: 8px;">
													<div style="font-size: 11px; color: ${textColor}; line-height: 1.4;">
														${icon} ${w.message}
													</div>
												</div>
											`;
										}).join('');
									})()}
									<div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; align-items: center;">
										<div style="display: flex; align-items: center; gap: 6px;">
											<label style="font-size: 11px; color: #9ca3af;">Quick Start:</label>
											<select class="instaraw-rpg-quick-template-selector" style="font-size: 11px; padding: 4px 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 4px; color: #e5e7eb; cursor: pointer;">
												<option value="">-- Select Preset --</option>
												<option value="minimal">Minimal (Just Instructions)</option>
												<option value="standard">Standard (Default)</option>
												<option value="expert">Expert (Full Control)</option>
												<option value="blank">Blank (Start Fresh)</option>
											</select>
										</div>
										<button class="instaraw-rpg-btn-text instaraw-rpg-reset-custom-template-btn" style="font-size: 11px; padding: 4px 8px;">🔄 Reset</button>
										<button class="instaraw-rpg-btn-text instaraw-rpg-preview-custom-template-btn" style="font-size: 11px; padding: 4px 8px; background: rgba(34, 197, 94, 0.1); color: #10b981;">👁️ Preview</button>
										<div class="instaraw-rpg-variable-buttons" style="display: flex; gap: 4px; flex-wrap: wrap;">
											<button class="instaraw-rpg-btn-text instaraw-rpg-insert-variable-btn" data-variable="{SOURCE_COUNT}" style="font-size: 10px; padding: 3px 6px;">{SOURCE_COUNT}</button>
											<button class="instaraw-rpg-btn-text instaraw-rpg-insert-variable-btn" data-variable="{SOURCE_PROMPTS}" style="font-size: 10px; padding: 3px 6px;">{SOURCE_PROMPTS}</button>
											<button class="instaraw-rpg-btn-text instaraw-rpg-insert-variable-btn" data-variable="{GENERATION_MODE}" style="font-size: 10px; padding: 3px 6px;">{GENERATION_MODE}</button>
											<button class="instaraw-rpg-btn-text instaraw-rpg-insert-variable-btn" data-variable="{MODE_RULES}" style="font-size: 10px; padding: 3px 6px;">{MODE_RULES}</button>
											<button class="instaraw-rpg-btn-text instaraw-rpg-insert-variable-btn" data-variable="{TASK_TYPE}" style="font-size: 10px; padding: 3px 6px;">{TASK_TYPE}</button>
											<button class="instaraw-rpg-btn-text instaraw-rpg-insert-variable-btn" data-variable="{USER_INPUT}" style="font-size: 10px; padding: 3px 6px;">{USER_INPUT}</button>
											<button class="instaraw-rpg-btn-text instaraw-rpg-insert-variable-btn" data-variable="{TASK_INSTRUCTIONS}" style="font-size: 10px; padding: 3px 6px;">{TASK_INSTRUCTIONS}</button>
										</div>
									</div>
									<!-- Template Preview Section -->
									<div class="instaraw-rpg-custom-template-preview" style="display: ${node.properties.show_custom_template_preview ? 'block' : 'none'}; margin-top: 12px;">
										<div style="background: rgba(34, 197, 94, 0.05); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 6px; padding: 12px;">
											<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
												<span style="font-size: 12px; font-weight: 500; color: #10b981;">✨ Preview (with current settings)</span>
												<button class="instaraw-rpg-btn-text instaraw-rpg-close-custom-preview-btn" style="font-size: 10px; padding: 3px 6px; color: #9ca3af;">✕ Close</button>
											</div>
											<pre class="instaraw-rpg-custom-template-preview-text" style="margin: 0; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 10px; line-height: 1.6; color: #d1d5db; white-space: pre-wrap; word-wrap: break-word; max-height: 300px; overflow-y: auto; background: rgba(0, 0, 0, 0.2); padding: 10px; border-radius: 4px;"></pre>
										</div>
									</div>
									<!-- Variable Reference Help Panel -->
									<details class="instaraw-rpg-variable-help-details" style="margin-top: 12px;" ${node.properties.variable_help_expanded ? 'open' : ''}>
										<summary style="cursor: pointer; padding: 10px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 6px; font-weight: 500; font-size: 12px; user-select: none; color: #60a5fa;">
											ℹ️ Variable Reference Guide
										</summary>
										<div style="padding: 12px; background: rgba(59, 130, 246, 0.03); border: 1px solid rgba(59, 130, 246, 0.1); border-top: none; border-radius: 0 0 6px 6px;">
											<div style="font-size: 11px; color: #d1d5db; line-height: 1.7;">
												<div style="margin-bottom: 10px;">
													<code style="background: rgba(96, 165, 250, 0.15); padding: 2px 6px; border-radius: 3px; color: #60a5fa;">{SOURCE_COUNT}</code>
													<span style="color: #9ca3af; margin-left: 8px;">→ Number of source prompts (e.g., "3")</span>
												</div>
												<div style="margin-bottom: 10px;">
													<code style="background: rgba(96, 165, 250, 0.15); padding: 2px 6px; border-radius: 3px; color: #60a5fa;">{SOURCE_PROMPTS}</code>
													<span style="color: #9ca3af; margin-left: 8px;">→ Formatted list of source prompts with positive/negative</span>
												</div>
												<div style="margin-bottom: 10px;">
													<code style="background: rgba(96, 165, 250, 0.15); padding: 2px 6px; border-radius: 3px; color: #60a5fa;">{GENERATION_MODE}</code>
													<span style="color: #9ca3af; margin-left: 8px;">→ Mode description (e.g., "CREATIVE (INSPIRED REMIX)")</span>
												</div>
												<div style="margin-bottom: 10px;">
													<code style="background: rgba(96, 165, 250, 0.15); padding: 2px 6px; border-radius: 3px; color: #60a5fa;">{MODE_RULES}</code>
													<span style="color: #9ca3af; margin-left: 8px;">→ Auto-generated rules (Reality/Creative mode logic)</span>
												</div>
												<div style="margin-bottom: 10px;">
													<code style="background: rgba(96, 165, 250, 0.15); padding: 2px 6px; border-radius: 3px; color: #60a5fa;">{TASK_TYPE}</code>
													<span style="color: #9ca3af; margin-left: 8px;">→ "TXT2IMG GENERATION" or "IMG2IMG TRANSFORMATION"</span>
												</div>
												<div style="margin-bottom: 10px;">
													<code style="background: rgba(96, 165, 250, 0.15); padding: 2px 6px; border-radius: 3px; color: #60a5fa;">{USER_INPUT}</code>
													<span style="color: #9ca3af; margin-left: 8px;">→ Raw user input without any wrapper text</span>
												</div>
												<div style="margin-bottom: 10px;">
													<code style="background: rgba(96, 165, 250, 0.15); padding: 2px 6px; border-radius: 3px; color: #60a5fa;">{TASK_INSTRUCTIONS}</code>
													<span style="color: #9ca3af; margin-left: 8px;">→ Formatted instructions built from user input, character, expression, affect</span>
												</div>
												<div style="margin-top: 12px; padding: 8px; background: rgba(34, 197, 94, 0.08); border-left: 3px solid rgba(34, 197, 94, 0.4); border-radius: 3px;">
													<div style="font-size: 10px; color: #86efac;">
														💡 <strong>Tip:</strong> Click variable buttons above to insert them at cursor position in the template.
													</div>
												</div>
											</div>
										</div>
									</details>
								</div>

								<!-- Library Inspiration (for txt2img in custom mode) -->
								${detectedMode !== 'img2img' ? (() => {
									// Use same filtering approach as Reality/Creative modes
									const filters = JSON.parse(node.properties.library_filters || "{}");
									const filteredCount = filterPrompts(promptsDatabase, filters).length;
									const totalCount = promptsDatabase.length;
									const hasActiveFilters = Object.keys(filters).some(key => {
										if (key === 'search_query') return filters[key]?.trim();
										if (key === 'show_bookmarked') return filters[key];
										if (key === 'sdxl_mode') return filters[key];
										return filters[key] !== 'all';
									});
									const inspirationCount = node.properties.inspiration_count || 3;
									const inspirationEnabled = node.properties.enable_library_inspiration;

									return `
										<div class="instaraw-rpg-section" style="margin-top: 12px;">
											<details class="instaraw-rpg-custom-library-details" ${node.properties.custom_library_expanded ? 'open' : ''}>
												<summary style="cursor: pointer; padding: 10px; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 6px; font-weight: 500; font-size: 13px; user-select: none;">
													📚 Library Inspiration ${!inspirationEnabled ? '(Disabled)' : `(${inspirationCount} per generation)`}
												</summary>
												<div style="padding: 12px; background: rgba(139, 92, 246, 0.03); border: 1px solid rgba(139, 92, 246, 0.1); border-top: none; border-radius: 0 0 6px 6px;">
													<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
														<label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
															<input type="checkbox" class="instaraw-rpg-checkbox instaraw-rpg-enable-inspiration-checkbox" ${inspirationEnabled ? 'checked' : ''} />
															<span style="font-size: 12px; font-weight: 500;">Enable Library Inspiration</span>
														</label>
														<span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: ${inspirationEnabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(107, 114, 128, 0.15)'}; color: ${inspirationEnabled ? '#4ade80' : '#9ca3af'};">
															${inspirationEnabled ? '✅ Active' : '⚪ Disabled'}
														</span>
													</div>
													<div class="instaraw-rpg-inspiration-section" style="display: ${inspirationEnabled ? 'block' : 'none'};">
														${filteredCount === 0 ? `
															<div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 12px; margin-bottom: 12px;">
																<div style="font-size: 12px; color: #fca5a5; font-weight: 500;">⚠️ No prompts in library</div>
																<div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">Load prompts in the Library tab or {SOURCE_PROMPTS} will be empty</div>
															</div>
														` : `
															<div style="background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 6px; padding: 12px; margin-bottom: 12px;">
																<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
																	<span style="font-size: 11px; color: #d1d5db;">Learn from</span>
																	<input type="number" class="instaraw-rpg-number-input instaraw-rpg-custom-inspiration-count" value="${inspirationCount}" min="1" max="10" style="width: 45px; height: 24px; padding: 2px 6px; font-size: 12px; text-align: center;" />
																	<span style="font-size: 11px; color: #d1d5db;">prompts per generation</span>
																</div>
																<div style="display: flex; align-items: center; justify-content: space-between;">
																	<span style="font-size: 11px; color: #9ca3af;">
																		Pool: <strong style="color: #e5e7eb; font-weight: 500;">${filteredCount.toLocaleString()}</strong> ${hasActiveFilters ? '<span style="color: #a78bfa;">prompts (filtered)</span>' : 'prompts'}
																	</span>
																	<button class="instaraw-rpg-btn-text instaraw-rpg-open-library-tab-btn" style="font-size: 10px; padding: 3px 6px; opacity: 0.8; display: flex; align-items: center; gap: 4px;" title="Switch to Library tab to adjust filters">
																		<span style="color: #9ca3af;">Filters</span> ⚙️
																	</button>
																</div>
															</div>
														`}
													</div>
													${!inspirationEnabled ? `
														<div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 6px; padding: 10px;">
															<div style="font-size: 11px; color: #fbbf24; line-height: 1.5;">
																💡 <strong>Inspiration disabled:</strong> Variables <code>{SOURCE_COUNT}</code> and <code>{SOURCE_PROMPTS}</code> will be empty/zero in your template.
															</div>
														</div>
													` : ''}
												</div>
											</details>
										</div>
									`;
								})() : ''}

								<!-- AIL Images Preview (for img2img in custom mode) -->
								${detectedMode === 'img2img' ? (() => {
									const linkedImages = node._linkedImages || [];
									const imageCount = linkedImages.length;
									if (imageCount === 0) {
										return `
											<div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 12px; margin-top: 12px;">
												<div style="font-size: 12px; color: #fca5a5; font-weight: 500;">⚠️ No images from AIL</div>
												<div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">Connect an Advanced Image Loader node in img2img mode</div>
											</div>
										`;
									}
									return `
										<div style="margin-top: 12px; padding: 12px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 6px;">
											<div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px;">
												📸 Images from AIL #${node._linkedAILNodeId}: <strong style="color: #60a5fa;">${imageCount} image${imageCount !== 1 ? 's' : ''}</strong>
											</div>
										</div>
									`;
								})() : ''}

								<!-- Generation Count (for txt2img in custom mode) -->
								${detectedMode !== 'img2img' ? `
									<div class="instaraw-rpg-section" style="margin-top: 12px;">
										<div class="instaraw-rpg-control-group">
											<label>Generation Count</label>
											<input type="number" class="instaraw-rpg-number-input instaraw-rpg-gen-count-input" value="${node.properties.generation_count || 5}" min="1" max="50" />
										</div>
									</div>
								` : ''}
							` : ''}

							<!-- ═══════════════════════════════════════════════════════════════════ -->
							<!-- UNIVERSAL INPUT SECTION (TXT2IMG) - Same structure as IMG2IMG -->
							<!-- ═══════════════════════════════════════════════════════════════════ -->
							${detectedMode !== 'img2img' ? `
								<!-- 1. Creative Theme (aesthetic style) -->
								<div class="instaraw-rpg-section" style="margin-bottom: 12px;">
									<label style="font-size: 13px; font-weight: 500; margin-bottom: 8px; display: block;">🎨 Creative Theme (optional)</label>
									<select class="instaraw-rpg-theme-select" style="width: 100%; padding: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: #e5e7eb; font-size: 12px;">
										${Object.entries(THEME_PRESETS).map(([key, preset]) => {
											const selected = (node.properties.theme_preset || DEFAULT_THEME_PRESET) === key;
											return `<option value="${key}" ${selected ? 'selected' : ''}>${preset.label}</option>`;
										}).join('')}
									</select>
									<div class="instaraw-rpg-hint-text" style="margin-top: 6px; font-size: 11px; color: #9ca3af;">
										💡 Themes add aesthetic style (INSTARAW = black light diamond drips)
									</div>
								</div>

								<!-- 2. Model Instructions (formatting for specific models) -->
								<div class="instaraw-rpg-section" style="margin-bottom: 12px;">
									<label style="font-size: 13px; font-weight: 500; margin-bottom: 8px; display: block;">🔧 Model Instructions (optional)</label>
									<div style="margin-bottom: 8px;">
										<select class="instaraw-rpg-model-preset-select" style="width: 100%; padding: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: #e5e7eb; font-size: 12px;">
											${Object.entries(MODEL_INSTRUCTION_PRESETS).map(([key, preset]) => {
												const selected = (node.properties.model_preset || DEFAULT_MODEL_PRESET) === key;
												return `<option value="${key}" ${selected ? 'selected' : ''}>${preset.label}</option>`;
											}).join('')}
										</select>
									</div>
									<textarea class="instaraw-rpg-model-instructions instaraw-rpg-prompt-textarea" placeholder="Model-specific formatting instructions (optional for txt2img)..." rows="3" style="line-height: 1.42; font-size: 12px; ">${escapeHtml(node.properties.model_instructions || MODEL_INSTRUCTION_PRESETS[node.properties.model_preset || DEFAULT_MODEL_PRESET]?.instructions || "")}</textarea>
									<div class="instaraw-rpg-hint-text" style="margin-top: 6px; font-size: 11px; color: #9ca3af;">
										💡 Model-specific prompt formatting (mostly useful for img2img models)
									</div>
								</div>

								<!-- 2.5 Clean Mode Toggle -->
								<div class="instaraw-rpg-section" style="margin-bottom: 12px;">
									<label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; font-weight: 500;">
										<input type="checkbox" class="instaraw-rpg-clean-mode-toggle" ${node.properties.clean_mode ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;" />
										🧹 Clean Mode (no baked-in artifacts or elements)
									</label>
									<div class="instaraw-rpg-hint-text" style="margin-top: 6px; font-size: 11px; color: #9ca3af;">
										💡 Prevents AI from adding grain, noise, lens flares, borders, etc. Add these in post if needed.
									</div>
								</div>

								<!-- 3. Your Instructions (user's own input - LAST so it can override) -->
								<div class="instaraw-rpg-section" style="margin-bottom: 12px;">
									<label style="font-size: 13px; font-weight: 500; margin-bottom: 8px; display: block;">📝 Your Instructions</label>
									<textarea class="instaraw-rpg-user-text-input instaraw-rpg-prompt-textarea" placeholder="Describe what you want: subject, setting, outfit, pose, mood...
Example: 'Margot Robbie in a red evening gown at a luxury hotel rooftop bar at sunset'" rows="3" style="line-height: 1.42; font-size: 12px; ">${escapeHtml(node.properties.user_instructions || "")}</textarea>
									<div class="instaraw-rpg-hint-text" style="margin-top: 6px; font-size: 11px; color: #9ca3af;">
										💡 Your instructions override theme and model settings
									</div>
								</div>
							` : ''}

							<!-- Normal generation controls (hidden in Custom mode) -->
							${node.properties.generation_style !== 'custom' ? `
							<!-- img2img: Image Preview & Settings -->
							${detectedMode === 'img2img' ? `
								<!-- Images from AIL Preview -->
								${(() => {
									const images1 = node._linkedImages || [];
									const images2 = node._linkedImages2 || [];
									const images3 = node._linkedImages3 || [];
									const images4 = node._linkedImages4 || [];

									if (images1.length === 0) {
										return `
											<div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 12px; margin-bottom: 12px;">
												<div style="font-size: 12px; color: #fca5a5; font-weight: 500;">⚠️ No images from AIL</div>
												<div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">Connect an Advanced Image Loader node in img2img mode</div>
											</div>
										`;
									}

									// Build inputs array for multi-image mode
									const inputsWithImages = [
										{ images: images1, label: "Image 1" },
										{ images: images2, label: "Image 2" },
										{ images: images3, label: "Image 3" },
										{ images: images4, label: "Image 4" }
									].filter(input => input.images.length > 0);

									const multiImageMode = inputsWithImages.length > 1;
									const generationCount = images1.length;

									if (multiImageMode) {
										// Multi-image mode: show combo cards
										const comboCardsHtml = renderComboCards(inputsWithImages, {
											// Handle both url (from renderImg2ImgGallery events) and thumbnail (from raw batchData events)
											getImageUrl: (img) => img?.url || (img?.thumbnail ? `/instaraw/view/${img.thumbnail}` : null)
										});

										return `
											<div style="background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 6px; padding: 12px; margin-bottom: 12px;">
												<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
													<div style="display: flex; align-items: center; gap: 8px;">
														<span style="font-size: 12px; font-weight: 500; color: #e5e7eb;">${inputsWithImages.length} AIL inputs connected</span>
													</div>
													<span style="font-size: 11px; color: #818cf8; font-weight: 500;">${generationCount} combinations → ${generationCount} prompts</span>
												</div>
												<div class="instaraw-combo-grid">
													${comboCardsHtml}
												</div>
												<div style="font-size: 10px; color: #9ca3af; margin-top: 8px;">
													ℹ️ Each row of images is sent together to the AI for prompt generation.
												</div>
											</div>
										`;
									}

									// Single image mode: show grid
									return `
										<div style="background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 6px; padding: 12px; margin-bottom: 12px;">
											<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
												<span style="font-size: 12px; font-weight: 500; color: #e5e7eb;">Images from AIL #${node._linkedAILNodeId || '?'}</span>
												<span style="font-size: 11px; color: #818cf8; font-weight: 500;">${generationCount} unique ${generationCount === 1 ? 'image' : 'images'} → ${generationCount} ${generationCount === 1 ? 'prompt' : 'prompts'}</span>
											</div>
											<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px; max-height: 200px; overflow-y: auto;">
												${images1.map((img, idx) => {
													// Handle both url (from renderImg2ImgGallery events) and thumbnail (from raw batchData events)
													const imgUrl = img.url || (img.thumbnail ? `/instaraw/view/${img.thumbnail}` : '');
													return `
													<div style="position: relative; aspect-ratio: 1; border-radius: 4px; overflow: hidden; border: 2px solid #4b5563;">
														<img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover; background: rgba(0,0,0,0.3);" onerror="this.style.opacity='0.3'; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath fill=%22%239ca3af%22 d=%22M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z%22/%3E%3C/svg%3E';" />
														<div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); padding: 2px 4px; font-size: 10px; color: white; text-align: center;">
															#${idx + 1}${img.repeat_count && img.repeat_count > 1 ? ` ×${img.repeat_count}` : ''}
														</div>
													</div>
												`}).join('')}
											</div>
											<div style="font-size: 10px; color: #9ca3af; margin-top: 8px;">
												ℹ️ Generates 1 prompt per unique image. Repeat counts preserved when adding to batch.
											</div>
										</div>
									`;
								})()}

								<!-- ═══════════════════════════════════════════════════════════════════ -->
								<!-- UNIVERSAL INPUT SECTION (IMG2IMG) - Same structure as TXT2IMG -->
								<!-- ═══════════════════════════════════════════════════════════════════ -->

								<!-- 1. Creative Theme (aesthetic style) -->
								<div class="instaraw-rpg-section" style="margin-bottom: 12px;">
									<div class="instaraw-rpg-control-group">
										<label style="font-size: 13px; font-weight: 500; margin-bottom: 8px; display: block;">🎨 Creative Theme (optional)</label>
										<select class="instaraw-rpg-theme-select" style="width: 100%; padding: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: #e5e7eb; font-size: 12px;">
											${Object.entries(THEME_PRESETS).map(([key, preset]) => {
												const selected = (node.properties.theme_preset || DEFAULT_THEME_PRESET) === key;
												return `<option value="${key}" ${selected ? 'selected' : ''}>${preset.label}</option>`;
											}).join('')}
										</select>
										<div class="instaraw-rpg-hint-text" style="margin-top: 6px; font-size: 11px; color: #9ca3af;">
											💡 Themes add aesthetic style (INSTARAW = black light diamond drips)
										</div>
									</div>
								</div>

								<!-- 2. Model Instructions (formatting for specific models) -->
								<div class="instaraw-rpg-section" style="margin-bottom: 12px;">
									<div class="instaraw-rpg-control-group">
										<label style="font-size: 13px; font-weight: 500; margin-bottom: 8px; display: block;">🔧 Model Instructions</label>
										<div style="margin-bottom: 8px;">
											<select class="instaraw-rpg-model-preset-select" style="width: 100%; padding: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: #e5e7eb; font-size: 12px;">
												${Object.entries(MODEL_INSTRUCTION_PRESETS).map(([key, preset]) => {
													const selected = (node.properties.model_preset || DEFAULT_MODEL_PRESET) === key;
													return `<option value="${key}" ${selected ? 'selected' : ''}>${preset.label}</option>`;
												}).join('')}
											</select>
										</div>
										<textarea class="instaraw-rpg-model-instructions instaraw-rpg-prompt-textarea" placeholder="Model-specific formatting instructions..." rows="4" style="line-height: 1.42; font-size: 12px; ">${escapeHtml(node.properties.model_instructions || MODEL_INSTRUCTION_PRESETS[node.properties.model_preset || DEFAULT_MODEL_PRESET]?.instructions || "")}</textarea>
										<div class="instaraw-rpg-hint-text" style="margin-top: 6px; font-size: 11px; color: #9ca3af;">
											💡 Model-specific prompt formatting (NBP uses "reimagined" structure)
										</div>
									</div>
								</div>

								<!-- 2.5 Clean Mode Toggle -->
								<div class="instaraw-rpg-section" style="margin-bottom: 12px;">
									<div class="instaraw-rpg-control-group">
										<label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; font-weight: 500;">
											<input type="checkbox" class="instaraw-rpg-clean-mode-toggle" ${node.properties.clean_mode ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;" />
											🧹 Clean Mode (no baked-in artifacts or elements)
										</label>
										<div class="instaraw-rpg-hint-text" style="margin-top: 6px; font-size: 11px; color: #9ca3af;">
											💡 Prevents AI from adding grain, noise, lens flares, borders, etc. Add these in post if needed.
										</div>
									</div>
								</div>

								<!-- 3. Your Instructions (user's own input - LAST so it can override) -->
								<div class="instaraw-rpg-section" style="margin-bottom: 12px;">
									<div class="instaraw-rpg-control-group">
										<label style="font-size: 13px; font-weight: 500; margin-bottom: 8px; display: block;">📝 Your Instructions</label>
										<textarea class="instaraw-rpg-img2img-user-instructions instaraw-rpg-prompt-textarea" placeholder="Describe what you want to change or create...
Example: 'Change background to a tropical beach at sunset' or 'Put her in a red evening gown'" rows="3" style="line-height: 1.42; font-size: 12px; ">${escapeHtml(node.properties.user_instructions || "")}</textarea>
										<div class="instaraw-rpg-hint-text" style="margin-top: 6px; font-size: 11px; color: #9ca3af;">
											💡 Your instructions override theme and model settings
										</div>
									</div>
								</div>

								<!-- Affect Elements (Creative mode only) -->
								${node.properties.generation_style === 'creative' ? `
									<div class="instaraw-rpg-affect-elements" style="margin-bottom: 12px;">
										<label class="instaraw-rpg-section-label" style="margin-top: 12px;">Affect Elements (unchecked = keep as-is)</label>
										<div class="instaraw-rpg-checkbox-grid">
											<label class="instaraw-rpg-checkbox-label">
												<input type="checkbox" class="instaraw-rpg-checkbox instaraw-rpg-affect-background" checked />
												<span>Background</span>
											</label>
											<label class="instaraw-rpg-checkbox-label">
												<input type="checkbox" class="instaraw-rpg-checkbox instaraw-rpg-affect-outfit" checked />
												<span>Outfit</span>
											</label>
											<label class="instaraw-rpg-checkbox-label">
												<input type="checkbox" class="instaraw-rpg-checkbox instaraw-rpg-affect-pose" checked />
												<span>Pose</span>
											</label>
											<label class="instaraw-rpg-checkbox-label">
												<input type="checkbox" class="instaraw-rpg-checkbox instaraw-rpg-affect-lighting" checked />
												<span>Lighting</span>
											</label>
										</div>
									</div>
								` : ''}
							` : ''}
						</div>

						<!-- Generation Count (txt2img only) -->
						${detectedMode !== 'img2img' ? `
							<div class="instaraw-rpg-section">
								<div class="instaraw-rpg-control-group">
									<label>Generation Count</label>
									<input type="number" class="instaraw-rpg-number-input instaraw-rpg-gen-count-input" value="${node.properties.generation_count || 5}" min="1" max="50" />
								</div>
							</div>
						` : ''}

						<!-- Advanced: Edit System Prompt -->
						<div class="instaraw-rpg-section">
							<!-- Advanced: Edit System Prompt -->
							<details class="instaraw-rpg-advanced-settings" style="padding: 12px; background: #1f2937; border: 1px solid #4b5563; border-radius: 4px;">
								<summary style="cursor: pointer; font-weight: 500; font-size: 12px; color: #9ca3af; user-select: none;">⚙️ Advanced: Edit System Prompt</summary>
								<div style="margin-top: 12px;">
									<!-- Toggle button -->
									<div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
										<button class="instaraw-rpg-btn-text instaraw-rpg-toggle-system-prompt-preview-btn" style="font-size: 11px; padding: 4px 8px;">
											${node.properties.show_system_prompt_preview ? '📝 Edit Template' : '👁️ Preview'}
										</button>
									</div>
									<!-- Template textarea (shown when NOT previewing) -->
									<textarea class="instaraw-rpg-system-prompt instaraw-rpg-prompt-textarea" style="display: ${node.properties.show_system_prompt_preview ? 'none' : 'block'}; font-family: monospace; font-size: 11px; line-height: 1.5; resize: vertical; width: 100%; ">${escapeHtml(node.properties.creative_system_prompt || (() => {
										if (detectedMode === 'txt2img') {
											return DEFAULT_RPG_SYSTEM_PROMPT;
										} else {
											// img2img: choose based on generation_style
											return node.properties.generation_style === 'reality' ? DEFAULT_IMG2IMG_REALITY_SYSTEM_PROMPT : DEFAULT_IMG2IMG_CREATIVE_SYSTEM_PROMPT;
										}
									})())}</textarea>

									<!-- Preview (shown when previewing) -->
									<div class="instaraw-rpg-system-prompt-preview-container" style="display: ${node.properties.show_system_prompt_preview ? 'block' : 'none'};">
										<div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 4px; padding: 12px;">
											<pre class="instaraw-rpg-system-prompt-preview-text" style="margin: 0; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 11px; line-height: 1.6; color: #e5e7eb; white-space: pre-wrap; word-wrap: break-word; max-height: 400px; overflow-y: auto;"></pre>
										</div>
									</div>

									<div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
										<div class="instaraw-rpg-hint-text" style="font-size: 10px; color: #9ca3af;">
											💡 Controls how prompts are generated (${detectedMode === 'img2img' ? 'img2img' : 'txt2img'} ${node.properties.generation_style || 'reality'})
										</div>
										<button class="instaraw-rpg-btn-text instaraw-rpg-reset-unified-system-prompt-btn" style="font-size: 11px; padding: 4px 8px;">🔄 Reset</button>
									</div>
								</div>
							</details>
						</div>

					</div>
					` : ''}
					<!-- End of normal generation controls conditional -->

					<!-- Generate Button (always visible) -->
					<button class="instaraw-rpg-btn-primary instaraw-rpg-generate-unified-btn" style="width: 100%; margin-top: 12px;">
						${detectedMode === 'img2img' ? '🖼️' : '🎨'} Generate Prompts
					</button>

					<!-- Generation Results Section -->
					<div class="instaraw-rpg-generation-progress" style="display: ${node._generationInProgress || node._generatedUnifiedPrompts ? 'block' : 'none'};">
						<div class="instaraw-rpg-progress-header">
							<h4>Generating Prompts...</h4>
							<button class="instaraw-rpg-btn-secondary instaraw-rpg-cancel-generation-btn">⏹ Cancel</button>
						</div>
						<!-- Quick action button at top (shown when complete) -->
						<div class="instaraw-rpg-quick-accept" style="display: none; margin: 8px 0 12px 0;">
							<button class="instaraw-rpg-btn-primary instaraw-rpg-accept-generated-btn" style="width: 100%;">✓ Add to Batch</button>
						</div>
						<div class="instaraw-rpg-progress-items"></div>
					</div>

					<!-- Preview Section: prompts list + action buttons -->
					<div class="instaraw-rpg-generate-preview" style="display: ${node._generatedUnifiedPrompts ? 'block' : 'none'};">
						<!-- Scrollable prompts container with fixed max height -->
						<div class="instaraw-rpg-generate-preview-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;"></div>
						<!-- Action buttons always visible below -->
						<div style="display: flex; gap: 8px; justify-content: flex-end;">
							<button class="instaraw-rpg-btn-primary instaraw-rpg-accept-generated-btn">✓ Add to Batch</button>
							<button class="instaraw-rpg-btn-secondary instaraw-rpg-cancel-generated-btn" style="margin-right: 0;">✖ Discard</button>
						</div>
					</div>
				`;
			};

			// === Custom Tab ===
			const renderCustomTab = (uiState) => {
				const customTemplate = node.properties.custom_template || DEFAULT_RPG_SYSTEM_PROMPT;
				const detectedMode = node._linkedAILMode || "txt2img";

				return `
					<div class="instaraw-rpg-custom-tab">
						<!-- Template Editor Section -->
						<div class="instaraw-rpg-section">
							<div class="instaraw-rpg-section-header">
								<span class="instaraw-rpg-section-label">📝 Custom System Prompt Template</span>
								<span class="instaraw-rpg-hint-text">Use variables like {SOURCE_PROMPTS}, {CHARACTER}, {EXPRESSION}</span>
							</div>
							<textarea class="instaraw-rpg-custom-template-textarea" placeholder="Enter your custom system prompt template..." style="width: 100%; min-height: 300px; font-family: monospace; font-size: 12px; line-height: 1.5; resize: vertical; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); color: #e5e7eb; padding: 12px; border-radius: 4px;">${escapeHtml(customTemplate)}</textarea>
							<div style="display: flex; gap: 8px; margin-top: 8px;">
								<button class="instaraw-rpg-btn-text instaraw-rpg-reset-custom-template-btn" style="font-size: 11px; padding: 4px 8px;">🔄 Reset to Default</button>
								<button class="instaraw-rpg-btn-primary instaraw-rpg-preview-custom-prompt-btn" style="font-size: 11px; padding: 6px 12px;">👁️ Preview Final Prompt</button>
							</div>
						</div>

						<!-- Available Variables Section -->
						<div class="instaraw-rpg-section">
							<div class="instaraw-rpg-section-header">
								<span class="instaraw-rpg-section-label">🔧 Available Variables</span>
								<span class="instaraw-rpg-hint-text">Click to insert at cursor position</span>
							</div>
							<div class="instaraw-rpg-variables-grid">
								${AVAILABLE_VARIABLES.map(v => `
									<div class="instaraw-rpg-variable-item">
										<button class="instaraw-rpg-variable-insert-btn" data-variable="${v.name}">
											<span class="instaraw-rpg-variable-name">${v.name}</span>
										</button>
										<div class="instaraw-rpg-variable-desc">${v.description}</div>
									</div>
								`).join('')}
							</div>
						</div>

						<!-- Generation Settings (same as Generate tab) -->
						<div class="instaraw-rpg-section">
							<div class="instaraw-rpg-section-header">
								<span class="instaraw-rpg-mode-badge ${detectedMode === 'img2img' ? 'instaraw-rpg-mode-img2img' : 'instaraw-rpg-mode-txt2img'}">
									${detectedMode === 'img2img' ? '🖼️ IMG2IMG' : '🎨 TXT2IMG'}
								</span>
								<span class="instaraw-rpg-hint-text">Detected from ${node._linkedAILNodeId ? `AIL #${node._linkedAILNodeId}` : 'workflow'}</span>
							</div>

							<!-- User Input -->
							${detectedMode !== 'img2img' ? `
								<div class="instaraw-rpg-control-group" style="margin-top: 12px;">
									<label style="font-size: 13px; font-weight: 500;">Subject / Instructions (optional)</label>
									<textarea class="instaraw-rpg-custom-user-input instaraw-rpg-prompt-textarea" placeholder="e.g., 'a woman in a red dress' or 'sunset lighting'..." rows="3" style="line-height: 1.42; font-size: 12px;">${escapeHtml(node.properties.user_instructions || "")}</textarea>
								</div>
								<div class="instaraw-rpg-control-group">
									<label>Generation Count</label>
									<input type="number" class="instaraw-rpg-number-input instaraw-rpg-custom-gen-count" value="${node.properties.generation_count || 5}" min="1" max="50" />
								</div>
							` : ''}
						</div>

						<!-- Generate Button -->
						<button class="instaraw-rpg-btn-primary instaraw-rpg-generate-custom-btn">
							${detectedMode === 'img2img' ? '🖼️' : '🎨'} Generate Prompts with Custom Template
						</button>
					</div>
				`;
			};

				// === Character Tab (LEGACY - Will be removed) ===
				const renderCharacterTab = () => {
					return `
						<div class="instaraw-rpg-character">
							<div class="instaraw-rpg-creative-header">
								<h3>Character-Consistent Generation</h3>
								<p>Generate prompts with character reference for consistent results</p>
							</div>

							<div class="instaraw-rpg-control-group">
								<label>Character Reference</label>
								<textarea class="instaraw-rpg-character-ref-input" placeholder="e.g., 1girl_character_lora, blonde hair, blue eyes, athletic build..." rows="4"></textarea>
							</div>

							<div class="instaraw-rpg-creative-controls">
								<div class="instaraw-rpg-control-group">
									<label>Generation Count</label>
									<input type="number" class="instaraw-rpg-number-input instaraw-rpg-char-gen-count-input" value="5" min="1" max="50" />
								</div>
							</div>

							<button class="instaraw-rpg-btn-primary instaraw-rpg-generate-character-btn">👤 Generate Character Prompts</button>

							<div class="instaraw-rpg-creative-preview" style="display: none;">
								<h4>Generated Character Prompts Preview</h4>
								<div class="instaraw-rpg-character-preview-list"></div>
								<button class="instaraw-rpg-btn-primary instaraw-rpg-accept-character-btn">✓ Accept All</button>
								<button class="instaraw-rpg-btn-secondary instaraw-rpg-cancel-character-btn">✖ Cancel</button>
							</div>
						</div>
					`;
				};

				// === Batch Panel (AIL Item Style) ===
				const renderBatchPanel = (promptQueue, totalGenerations) => {
					const sdxlMode = sdxlModeEnabled;

					// Get linked images/latents for thumbnails
					const detectedMode = node._linkedAILMode || "img2img";
					const linkedImages = node._linkedImages || [];
					const linkedLatents = node._linkedLatents || [];
					const hasAILLink = node._linkedAILNodeId !== null;

					const gridContent =
						promptQueue.length === 0
							? `<div class="instaraw-rpg-empty"><p>No prompts in batch</p><p class="instaraw-rpg-hint">Add prompts from Library or Creative mode</p></div>`
							: promptQueue
									.map(
										(entry, idx) => {
											const sourceType = entry.source_id ? 'from-library' : 'from-ai';
											const sourceBadgeText = entry.source_id ? '📚 Library' : '✨ AI Generated';

											// Get linked thumbnail for this index
											const linkedItem = detectedMode === "img2img" ? linkedImages[idx] : linkedLatents[idx];
											const hasThumbnail = linkedItem !== undefined;

											let thumbnailHtml = '';
											if (hasThumbnail) {
												// Both modes: Show aspect ratio box with content inside
												const targetDims = getTargetDimensions();
												const targetAspectRatio = targetDims.width / targetDims.height;

												if (detectedMode === "img2img") {
													// IMG2IMG: Show image grid in aspect ratio box
													// Collect images from all connected AIL inputs for this index
													const img1 = linkedImages[idx];
													const img2 = (node._linkedImages2 || [])[idx];
													const img3 = (node._linkedImages3 || [])[idx];
													const img4 = (node._linkedImages4 || [])[idx];
													const allImgs = [img1, img2, img3, img4].filter(Boolean);
													const imgCount = allImgs.length;

													// Generate grid layout based on image count
													// Helper to create img with error fallback
													const imgWithFallback = (url) => `<img src="${url}" style="width: 100%; height: 100%; object-fit: cover; background: rgba(0,0,0,0.3);" onerror="this.style.opacity='0.3'; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath fill=%22%239ca3af%22 d=%22M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z%22/%3E%3C/svg%3E';" />`;
													let gridHtml = '';
													if (imgCount <= 1) {
														gridHtml = imgWithFallback(allImgs[0]?.url || linkedItem.url);
													} else if (imgCount === 2) {
														gridHtml = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; width: 100%; height: 100%;">${imgWithFallback(allImgs[0].url)}${imgWithFallback(allImgs[1].url)}</div>`;
													} else if (imgCount === 3) {
														gridHtml = `<div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 2px; width: 100%; height: 100%;">${imgWithFallback(allImgs[0].url)}${imgWithFallback(allImgs[1].url)}${imgWithFallback(allImgs[2].url)}<div style="background: rgba(0,0,0,0.3);"></div></div>`;
													} else {
														gridHtml = `<div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 2px; width: 100%; height: 100%;">${imgWithFallback(allImgs[0].url)}${imgWithFallback(allImgs[1].url)}${imgWithFallback(allImgs[2].url)}${imgWithFallback(allImgs[3].url)}</div>`;
													}

													thumbnailHtml = `
														<div class="instaraw-rpg-batch-thumbnail instaraw-rpg-batch-thumbnail-latent">
															<span class="instaraw-rpg-batch-thumbnail-index">#${idx + 1}</span>
															<div class="instaraw-rpg-batch-aspect-preview" style="aspect-ratio: ${targetAspectRatio}; position: relative; overflow: hidden;">
																${gridHtml}
																<div class="instaraw-rpg-batch-aspect-content" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: none;">
																	<div style="font-size: 14px; font-weight: 600; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.8); background: rgba(139, 92, 246, 0.75); padding: 4px 10px; border-radius: 4px;">${targetDims.aspect_label}${imgCount > 1 ? ` · ${imgCount}` : ''}</div>
																</div>
															</div>
														</div>
													`;
												} else {
													// TXT2IMG: Show empty latent with aspect ratio box
													thumbnailHtml = `
														<div class="instaraw-rpg-batch-thumbnail instaraw-rpg-batch-thumbnail-latent">
															<span class="instaraw-rpg-batch-thumbnail-index">#${idx + 1}</span>
															<div class="instaraw-rpg-batch-aspect-preview" style="aspect-ratio: ${targetAspectRatio};">
																<div class="instaraw-rpg-batch-aspect-content">
																	<div style="font-size: 24px;">📐</div>
																	<div style="font-size: 14px; font-weight: 600;">${targetDims.aspect_label}</div>
																</div>
															</div>
														</div>
													`;
												}
											} else {
												// Show placeholder
												const promptQueueTemp = parsePromptBatch();
												const totalMissing = promptQueueTemp.length - (detectedMode === "img2img" ? linkedImages.length : linkedLatents.length);
												thumbnailHtml = `
													<div class="instaraw-rpg-batch-thumbnail instaraw-rpg-batch-thumbnail-missing">
														<span class="instaraw-rpg-batch-thumbnail-index">#${idx + 1}</span>
														<div class="instaraw-rpg-batch-thumbnail-placeholder">
															<div style="font-size: 24px; opacity: 0.3;">⚠️</div>
															<div style="font-size: 11px; color: #f59e0b; font-weight: 600; margin-top: 4px;">
																${hasAILLink ? 'Missing Link' : 'No AIL'}
															</div>
															${hasAILLink && detectedMode === "txt2img" ? `
																<div style="font-size: 9px; color: #9ca3af; margin-top: 4px;">
																	Click "Sync AIL"
																</div>
															` : hasAILLink && detectedMode === "img2img" && totalMissing > 0 ? `
																<div style="font-size: 9px; color: #9ca3af; margin-top: 4px;">
																	Upload ${totalMissing} more image${totalMissing !== 1 ? 's' : ''} to AIL
																</div>
															` : ''}
														</div>
													</div>
												`;
											}

											// Get repeat count comparison
											const promptRepeat = entry.repeat_count || 1;
											const ailRepeat = linkedItem ? (linkedItem.repeat_count || 1) : null;
											const repeatMismatch = ailRepeat !== null && promptRepeat !== ailRepeat;

											return `
							<div class="instaraw-rpg-batch-item" data-id="${entry.id}" data-idx="${idx}" draggable="${reorderModeEnabled}">
								<div class="instaraw-rpg-batch-item-header">
									<div style="display: flex; align-items: center; gap: 8px;">
										<span class="instaraw-rpg-batch-item-number">#${idx + 1}</span>
										<span class="instaraw-rpg-source-badge ${sourceType}">${sourceBadgeText}</span>
										${ailRepeat !== null ? `
											<span class="instaraw-rpg-repeat-status ${repeatMismatch ? 'instaraw-rpg-repeat-mismatch' : 'instaraw-rpg-repeat-match'}" title="${repeatMismatch ? 'Repeat counts do not match! Click Sync Repeats to fix.' : 'Repeat counts match'}">
												${repeatMismatch ? '⚠️ ' : '✓ '}Prompt: ×${promptRepeat} | AIL: ×${ailRepeat}
											</span>
										` : ''}
									</div>
									<div class="instaraw-rpg-batch-item-controls">
										<label>Repeat:</label>
										<input type="number" class="instaraw-rpg-repeat-input" data-id="${entry.id}" value="${entry.repeat_count || 1}" min="1" max="99" />
										<button class="instaraw-rpg-batch-delete-btn" data-id="${entry.id}" title="Remove prompt">×</button>
									</div>
								</div>

								<!-- Thumbnail Section -->
								<label class="instaraw-rpg-thumbnail-label">${detectedMode === "img2img" ? "IMG2IMG Input Image" : "TXT2IMG Empty Latent"}</label>
								${thumbnailHtml}

								<div class="instaraw-rpg-batch-item-content">
									${sdxlMode && entry.tags && entry.tags.length > 0 ? `
										<!-- SDXL Mode: Editable SDXL prompt (tags) -->
										<label>SDXL Prompt (Tags)</label>
										<textarea class="instaraw-rpg-prompt-textarea instaraw-rpg-positive-textarea" data-id="${entry.id}" rows="3" draggable="false" style="${textareaHeights[`${entry.id}_positive`] ? `height: ${textareaHeights[`${entry.id}_positive`]}px;` : ''}">${entry.tags.join(", ")}</textarea>

										<label style="margin-top: 10px;">Negative Prompt</label>
										<textarea class="instaraw-rpg-prompt-textarea instaraw-rpg-negative-textarea" data-id="${entry.id}" rows="2" draggable="false" style="${textareaHeights[`${entry.id}_negative`] ? `height: ${textareaHeights[`${entry.id}_negative`]}px;` : ''}">${entry.negative_prompt || ""}</textarea>
									` : `
										<!-- Normal Mode: Show positive and negative textareas -->
										<label>Positive Prompt</label>
										<textarea class="instaraw-rpg-prompt-textarea instaraw-rpg-positive-textarea" data-id="${entry.id}" rows="3" draggable="false" style="${textareaHeights[`${entry.id}_positive`] ? `height: ${textareaHeights[`${entry.id}_positive`]}px;` : ''}">${entry.positive_prompt || ""}</textarea>

										<label style="margin-top: 10px;">Negative Prompt</label>
										<textarea class="instaraw-rpg-prompt-textarea instaraw-rpg-negative-textarea" data-id="${entry.id}" rows="2" draggable="false" style="${textareaHeights[`${entry.id}_negative`] ? `height: ${textareaHeights[`${entry.id}_negative`]}px;` : ''}">${entry.negative_prompt || ""}</textarea>
									`}

									${entry.tags && entry.tags.length > 0 && !sdxlMode
										? `
										<div class="instaraw-rpg-batch-item-tags">
											${entry.tags
												.slice(0, 3)
												.map((tag) => `<span class="instaraw-rpg-tag">${tag}</span>`)
												.join("")}
											${entry.tags.length > 3 ? `<span class="instaraw-rpg-tag-more">+${entry.tags.length - 3}</span>` : ""}
										</div>
									`
										: ""
									}

									<!-- Seed Display -->
									<div style="margin-top: 8px; padding: 6px 8px; background: rgba(0, 0, 0, 0.2); border-radius: 4px; border-left: 2px solid #6366f1;" draggable="false">
										<!-- Row 1: Seed input -->
										<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
											<span style="font-size: 11px; color: #9ca3af; font-weight: 500; user-select: none;">🎲 Seed:</span>
											<input type="number"
												class="instaraw-rpg-seed-input"
												data-id="${entry.id}"
												value="${entry.seed || 1111111}"
												min="0"
												max="9999999999999999"
												draggable="false"
												style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); color: #c4b5fd; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 12px; width: 120px; font-weight: 600;"
												title="Seed for this prompt"
											/>
											<button class="instaraw-rpg-seed-randomize-btn" data-id="${entry.id}" draggable="false" style="background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); color: #a78bfa; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 500;" title="Randomize seed">🎲 Random</button>
											<button class="instaraw-rpg-seed-reset-btn" data-id="${entry.id}" draggable="false" style="background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); color: #a78bfa; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 500;" title="Reset to default">↺ Reset</button>
											${entry.repeat_count > 1 ? `<span class="instaraw-rpg-seed-range" data-id="${entry.id}" style="font-size: 10px; color: #9ca3af; user-select: none;"></span>` : ''}
										</div>
										<!-- Row 2: Control After Generate dropdown -->
										<div style="display: flex; align-items: center; gap: 6px;">
											<label style="font-size: 11px; color: #9ca3af; user-select: none; line-height: 1;" title="What happens to seed after workflow runs">After Gen:</label>
											<select class="instaraw-rpg-seed-control" data-id="${entry.id}" draggable="false" style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); color: #f9fafb; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;" title="Control behavior after workflow execution">
												<option value="fixed" ${(entry.seed_control || 'randomize') === 'fixed' ? 'selected' : ''} title="Seed stays the same">Fixed</option>
												<option value="increment" ${(entry.seed_control || 'randomize') === 'increment' ? 'selected' : ''} title="Seed +100 after each run">Increment (+100)</option>
												<option value="decrement" ${(entry.seed_control || 'randomize') === 'decrement' ? 'selected' : ''} title="Seed -100 after each run">Decrement (-100)</option>
												<option value="randomize" ${(entry.seed_control || 'randomize') === 'randomize' ? 'selected' : ''} title="New random seed after each run">Randomize</option>
											</select>
										</div>
									</div>
								</div>
							</div>
						`;
										}
									)
									.join("");

					const libraryCount = promptQueue.filter(p => p.source_id).length;
					const aiCount = promptQueue.filter(p => !p.source_id).length;

					// Check for repeat count mismatches
					const hasRepeatMismatch = promptQueue.some((p, idx) => {
						const linkedItem = detectedMode === "img2img" ? linkedImages[idx] : linkedLatents[idx];
						return linkedItem && (p.repeat_count || 1) !== (linkedItem.repeat_count || 1);
					});

					// Show smart sync button if: AIL linked + has prompts
					// Will handle both latent creation (txt2img) and repeat syncing (both modes)
					const showSyncButton = hasAILLink && promptQueue.length > 0;
					const needsLatentSync = detectedMode === "txt2img" && linkedLatents.length !== promptQueue.length;
					const needsRepeatSync = hasRepeatMismatch;

					return `
						<div class="instaraw-rpg-batch-container">
							<div class="instaraw-rpg-batch-header">
								<div>
									<h3>Generation Batch</h3>
									<p class="instaraw-rpg-batch-subtitle">
										${promptQueue.length > 0 ? `📚 ${libraryCount} from Library  |  ✨ ${aiCount} AI Generated` : 'Add prompts from library or generate with AI'}
									</p>
								</div>
								<div class="instaraw-rpg-batch-actions">
									${showSyncButton ? `
										<button class="instaraw-rpg-btn-${needsLatentSync || needsRepeatSync ? 'primary' : 'secondary'} instaraw-rpg-sync-ail-btn ${needsLatentSync || needsRepeatSync ? 'instaraw-rpg-btn-warning' : ''}"
											title="${needsLatentSync ? `Create ${totalGenerations} latents in AIL` : ''}${needsLatentSync && needsRepeatSync ? ' and ' : ''}${needsRepeatSync ? 'Sync repeat counts' : ''}${!needsLatentSync && !needsRepeatSync ? 'Everything synced!' : ''}">
											${needsLatentSync || needsRepeatSync ? '⚠️ ' : '✓ '}Sync AIL${needsLatentSync ? ` (${totalGenerations})` : ''}
										</button>
									` : ''}
									<button class="instaraw-rpg-btn-secondary instaraw-rpg-reorder-toggle-btn">
										${reorderModeEnabled ? '🔓 Reorder ON' : '🔒 Reorder OFF'}
									</button>
									<span class="instaraw-rpg-batch-count">${totalGenerations} generation${totalGenerations !== 1 ? "s" : ""}</span>
									${promptQueue.length > 0 ? `<button class="instaraw-rpg-btn-secondary instaraw-rpg-clear-batch-btn">🗑️ Clear All</button>` : ""}
								</div>
							</div>
							${promptQueue.length > 0 ? `
							<div class="instaraw-rpg-power-tools-row" style="display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding: 10px 12px; background: rgba(255, 255, 255, 0.02); border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
								<span style="font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Bulk Edit</span>
								<div style="display: flex; align-items: center; gap: 6px;">
									<span style="font-size: 12px; color: #9ca3af;">All After Gen:</span>
									<select class="instaraw-rpg-bulk-seed-control" style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.15); color: #f9fafb; padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer;" title="Set After Gen mode for all ${promptQueue.length} prompts">
										<option value="">--</option>
										<option value="fixed">Fixed</option>
										<option value="increment">Increment</option>
										<option value="decrement">Decrement</option>
										<option value="randomize">Randomize</option>
									</select>
								</div>
								<div style="width: 1px; height: 20px; background: rgba(255, 255, 255, 0.1);"></div>
								<div style="display: flex; align-items: center; gap: 6px;">
									<span style="font-size: 12px; color: #9ca3af;">All Seeds:</span>
									<button class="instaraw-rpg-bulk-reset-seeds-btn" style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.15); color: #f9fafb; padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer;" title="Reset all ${promptQueue.length} seeds to 1111111">Reset</button>
									<button class="instaraw-rpg-bulk-randomize-seeds-btn" style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.15); color: #f9fafb; padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer;" title="Randomize all ${promptQueue.length} seeds">Randomize</button>
								</div>
							</div>
							` : ''}
							<div class="instaraw-rpg-batch-grid">
								${gridContent}
							</div>
						</div>
					`;
				};

				// === Image Preview (AIL Sync) ===
				const renderImagePreview = (resolvedMode, totalGenerations) => {
					// Check all 4 image inputs for connections
					const imageInputNames = ["images", "images2", "images3", "images4"];
					const connectedInputs = [];

					for (const inputName of imageInputNames) {
						const input = node.inputs?.find(i => i.name === inputName);
						if (input?.link != null) {
							connectedInputs.push(inputName);
						}
					}

					const hasAILConnection = connectedInputs.length > 0;

					// If no AIL connection at all
					if (!hasAILConnection && !node._linkedAILNodeId) {
						return `
							<div class="instaraw-rpg-image-preview-section">
								<div class="instaraw-rpg-image-preview-empty">
									<p>No AIL connected</p>
									<p class="instaraw-rpg-hint">Connect an Advanced Image Loader to sync mode</p>
								</div>
							</div>
						`;
					}

					const itemCount = node._linkedImageCount || 0;
					const detectedMode = node._linkedAILMode || resolvedMode || "txt2img";
					const images1 = node._linkedImages || [];
					const images2 = node._linkedImages2 || [];
					const images3 = node._linkedImages3 || [];
					const images4 = node._linkedImages4 || [];
					const latents = node._linkedLatents || [];
					const isImg2Img = detectedMode === "img2img";
					const itemLabel = isImg2Img ? "images" : "latents";

					// Count connected inputs with images
					const inputsWithImages = [
						{ name: "images", images: images1, label: "Image 1" },
						{ name: "images2", images: images2, label: "Image 2" },
						{ name: "images3", images: images3, label: "Image 3" },
						{ name: "images4", images: images4, label: "Image 4" }
					].filter(input => connectedInputs.includes(input.name) && input.images.length > 0);

					const multiImageMode = inputsWithImages.length > 1;

					// Show empty state if AIL is connected but has no images/latents loaded yet
					if (hasAILConnection && images1.length === 0 && itemCount === 0 && !isImg2Img && latents.length === 0) {
						return `
							<div class="instaraw-rpg-image-preview-section">
								<div class="instaraw-rpg-image-preview-header">
									<span>${isImg2Img ? '🖼️ IMG2IMG' : '📐 TXT2IMG'} (AIL Node #${node._linkedAILNodeId || 'connected'})</span>
								</div>
								<div class="instaraw-rpg-image-preview-empty">
									<p>No ${itemLabel} detected</p>
									<p class="instaraw-rpg-hint">${isImg2Img ? 'Load images in the AIL node' : 'AIL will create latents when you sync'}</p>
								</div>
							</div>
						`;
					}

					const isMatch = totalGenerations === itemCount;
					const matchClass = isMatch ? "match" : "mismatch";
					const matchIcon = isMatch ? "✅" : "⚠️";

					// Multi-image mode: Show combination cards
					if (multiImageMode && isImg2Img) {
						const maxLen = getComboMaxLength(inputsWithImages);
						const comboCardsHtml = renderComboCards(inputsWithImages, {
							// Handle both url (from renderImg2ImgGallery events) and thumbnail (from raw batchData events)
							getImageUrl: (img) => img?.url || (img?.thumbnail ? `/instaraw/view/${img.thumbnail}` : null)
						});

						return `
							<div class="instaraw-rpg-image-preview-section">
								<div class="instaraw-rpg-image-preview-header">
									<div class="instaraw-multi-image-indicator">
										<span class="instaraw-multi-image-indicator-dot"></span>
										<span class="instaraw-multi-image-count">${inputsWithImages.length} AIL inputs</span>
										<span>connected</span>
									</div>
									<span class="instaraw-rpg-validation-badge instaraw-rpg-validation-${matchClass}">
										${matchIcon} ${totalGenerations} prompts ↔ ${maxLen} combinations
									</span>
								</div>
								<div class="instaraw-combo-grid">
									${comboCardsHtml}
								</div>
							</div>
						`;
					}

					// Single input mode: Simple grid (original behavior)
					const items = isImg2Img ? images1 : latents;
					const displayItems = items;

					return `
						<div class="instaraw-rpg-image-preview-section">
							<div class="instaraw-rpg-image-preview-header">
								<span>${isImg2Img ? '🖼️ IMG2IMG Input Images' : '📐 TXT2IMG Empty Latents'} (AIL Node #${node._linkedAILNodeId || 'unknown'})</span>
								<span class="instaraw-rpg-validation-badge instaraw-rpg-validation-${matchClass}">
									${matchIcon} ${totalGenerations} prompts ↔ ${itemCount} ${itemLabel}
								</span>
							</div>
							<div class="instaraw-rpg-image-preview-grid">
								${displayItems.length > 0 ? displayItems
									.map((item, idx) => {
										// Both modes use same structure with target dimensions
										const targetDims = getTargetDimensions();
										const targetAspectRatio = targetDims.width / targetDims.height;

										if (isImg2Img) {
											// IMG2IMG: Show image in aspect ratio box with label overlay
											return `
												<div class="instaraw-rpg-preview-thumb">
													<span class="instaraw-rpg-preview-index">#${idx + 1}</span>
													<div class="instaraw-rpg-preview-aspect-box" style="aspect-ratio: ${targetAspectRatio}; position: relative;">
														<img src="${item.url}" alt="Preview ${idx + 1}" style="background: rgba(0,0,0,0.3);" onerror="this.style.opacity='0.3'; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath fill=%22%239ca3af%22 d=%22M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z%22/%3E%3C/svg%3E';" />
														<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: none;">
															<div style="font-size: 11px; font-weight: 600; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.8); background: rgba(139, 92, 246, 0.75); padding: 3px 8px; border-radius: 4px;">${targetDims.aspect_label}</div>
														</div>
													</div>
													${item.repeat_count && item.repeat_count > 1 ? `<span class="instaraw-rpg-preview-repeat">×${item.repeat_count}</span>` : ''}
												</div>
											`;
										} else {
											// TXT2IMG: Show empty latent with emoji and aspect ratio below
											return `
												<div class="instaraw-rpg-preview-latent">
													<span class="instaraw-rpg-preview-index">#${idx + 1}</span>
													<div class="instaraw-rpg-preview-aspect-box" style="aspect-ratio: ${targetAspectRatio};">
														<div class="instaraw-rpg-preview-aspect-content">
															<div style="font-size: 20px;">📐</div>
															<div style="font-size: 11px; font-weight: 600; margin-top: 4px;">${targetDims.aspect_label}</div>
														</div>
													</div>
													${item.repeat_count && item.repeat_count > 1 ? `<span class="instaraw-rpg-preview-repeat">×${item.repeat_count}</span>` : ''}
												</div>
											`;
										}
									})
									.join("") : `
										<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: #9ca3af;">
											<p>Waiting for ${itemLabel} data...</p>
										</div>
									`}
							</div>
						</div>
					`;
				};

				// === Filter Prompts ===
				const filterPrompts = (database, filters) => {
					if (!database) return [];

					let filtered = database;

					// Search query with match tracking
					if (filters.search_query && filters.search_query.trim() !== "") {
						const query = filters.search_query.toLowerCase();
						filtered = filtered.filter((p) => {
							const positive = (p.prompt?.positive || "").toLowerCase();
							const tags = (p.tags || []).join(" ").toLowerCase();
							const id = (p.id || "").toLowerCase();
							const matchInPrompt = positive.includes(query);
							const matchInTags = tags.includes(query);
							const matchInId = id.includes(query);
							// Store match type for highlighting
							p._matchType = matchInPrompt ? (matchInTags ? 'both' : 'prompt') : (matchInTags ? 'tags' : (matchInId ? 'id' : null));
							return matchInPrompt || matchInTags || matchInId;
						});
					}

					// Content type
					if (filters.content_type && filters.content_type !== "any") {
						filtered = filtered.filter((p) => p.classification?.content_type === filters.content_type);
					}

					// Safety level
					if (filters.safety_level && filters.safety_level !== "any") {
						if (filters.safety_level === "suggestive_nsfw") {
							// Combined filter: match either suggestive or nsfw
							filtered = filtered.filter((p) =>
								p.classification?.safety_level === "suggestive" ||
								p.classification?.safety_level === "nsfw"
							);
						} else {
							filtered = filtered.filter((p) => p.classification?.safety_level === filters.safety_level);
						}
					}

					// Shot type
					if (filters.shot_type && filters.shot_type !== "any") {
						filtered = filtered.filter((p) => p.classification?.shot_type === filters.shot_type);
					}

					// Prompt source (user vs library)
					if (filters.prompt_source && filters.prompt_source !== "all") {
						if (filters.prompt_source === "user") {
							const beforeCount = filtered.length;
							const userInDb = filtered.filter((p) => p.is_user_created === true);
							console.log(`[RPG] Filter user prompts: ${userInDb.length} of ${beforeCount} in promptsDatabase, userPrompts array has ${userPrompts.length}`);
							filtered = userInDb;
						} else if (filters.prompt_source === "generated") {
							filtered = filtered.filter((p) => p.is_ai_generated === true);
						} else if (filters.prompt_source === "library") {
							filtered = filtered.filter((p) => !p.is_user_created && !p.is_ai_generated);
						}
					}

					// Bookmarked only
					if (filters.show_bookmarked) {
						filtered = filtered.filter((p) => bookmarksCache.includes(p.id));
					}

					return filtered;
				};

				// === Helper Functions ===
				const escapeHtml = (text) => {
					if (!text) return "";
					return text
						.replace(/&/g, "&amp;")
						.replace(/</g, "&lt;")
						.replace(/>/g, "&gt;")
						.replace(/"/g, "&quot;")
						.replace(/'/g, "&#39;");
				};

				// === Preview Modal ===
				const showPreviewModal = (systemPrompt, context = {}) => {
					// Create modal overlay
					const modalOverlay = document.createElement('div');
					modalOverlay.className = 'instaraw-rpg-preview-modal-overlay';

					const modalContent = `
						<div class="instaraw-rpg-preview-modal">
							<div class="instaraw-rpg-preview-modal-header">
								<h3>📋 System Prompt Preview</h3>
								<button class="instaraw-rpg-preview-modal-close">✕</button>
							</div>
							<div class="instaraw-rpg-preview-modal-body">
								<div class="instaraw-rpg-preview-section">
									<h4>Current Settings:</h4>
									<div class="instaraw-rpg-preview-settings">
										${context.mode ? `<div><strong>Mode:</strong> ${context.mode}</div>` : ''}
										${context.style ? `<div><strong>Style:</strong> ${context.style}</div>` : ''}
										${context.character ? `<div><strong>Character:</strong> ${context.character.substring(0, 100)}${context.character.length > 100 ? '...' : ''}</div>` : ''}
										${context.expression ? `<div><strong>Expression:</strong> ${context.expression}</div>` : ''}
										${context.userInput ? `<div><strong>User Input:</strong> ${context.userInput}</div>` : ''}
										${context.inspirationCount ? `<div><strong>Inspiration Count:</strong> ${context.inspirationCount}</div>` : ''}
									</div>
								</div>
								<div class="instaraw-rpg-preview-section">
									<h4>Final System Prompt:</h4>
									<div class="instaraw-rpg-preview-prompt">
										<pre>${escapeHtml(systemPrompt)}</pre>
									</div>
								</div>
							</div>
							<div class="instaraw-rpg-preview-modal-footer">
								<button class="instaraw-rpg-btn-text instaraw-rpg-preview-copy-btn">📋 Copy to Clipboard</button>
								<button class="instaraw-rpg-btn-primary instaraw-rpg-preview-modal-close">Close</button>
							</div>
						</div>
					`;

					modalOverlay.innerHTML = modalContent;
					document.body.appendChild(modalOverlay);

					// Close button handlers
					modalOverlay.querySelectorAll('.instaraw-rpg-preview-modal-close').forEach(btn => {
						btn.onclick = () => {
							document.body.removeChild(modalOverlay);
						};
					});

					// Copy button handler
					const copyBtn = modalOverlay.querySelector('.instaraw-rpg-preview-copy-btn');
					if (copyBtn) {
						copyBtn.onclick = () => {
							navigator.clipboard.writeText(systemPrompt).then(() => {
								const originalText = copyBtn.textContent;
								copyBtn.textContent = '✓ Copied!';
								setTimeout(() => {
									copyBtn.textContent = originalText;
								}, 2000);
							}).catch(err => {
								console.error('[RPG] Failed to copy:', err);
								alert('Failed to copy to clipboard');
							});
						};
					}

					// Close on overlay click
					modalOverlay.onclick = (e) => {
						if (e.target === modalOverlay) {
							document.body.removeChild(modalOverlay);
						}
					};
				};

				const highlightSearchTerm = (text, searchQuery) => {
					if (!text || !searchQuery) return escapeHtml(text);
					const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\$&')})`, 'gi');
					return escapeHtml(text).replace(regex, '<mark class="instaraw-rpg-highlight">$1</mark>');
				};

				const generateUniqueId = () => {
					// Generate ULID (Universally Unique Lexicographically Sortable Identifier)
					// 26 characters: 10 char timestamp + 16 char randomness
					const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford's Base32
					const ENCODING_LEN = ENCODING.length;
					const TIME_LEN = 10;
					const RANDOM_LEN = 16;

					const encodeTime = (now, len) => {
						let str = "";
						for (let i = len; i > 0; i--) {
							const mod = now % ENCODING_LEN;
							str = ENCODING.charAt(mod) + str;
							now = (now - mod) / ENCODING_LEN;
						}
						return str;
					};

					const encodeRandom = (len) => {
						let str = "";
						for (let i = 0; i < len; i++) {
							str += ENCODING.charAt(Math.floor(Math.random() * ENCODING_LEN));
						}
						return str;
					};

					const now = Date.now();
					return encodeTime(now, TIME_LEN) + encodeRandom(RANDOM_LEN);
				};

				// === Add Prompt to Batch ===
					const addPromptToBatch = (promptData) => {
						const promptQueue = parsePromptBatch();

						// Handle both database formats:
						// 1. { prompt: { positive: "...", negative: "..." } } - generated prompts
						// 2. { positive: "...", negative: "..." } - library prompts
						const positivePrompt = promptData.prompt?.positive ?? promptData.positive ?? "";
						const negativePrompt = promptData.prompt?.negative ?? promptData.negative ?? "";

						const newEntry = {
							id: generateUniqueId(),
							positive_prompt: positivePrompt,
							negative_prompt: negativePrompt,
						repeat_count: 1,
						tags: promptData.tags || [],
						source_id: promptData.id || null,
						seed: 1111111,  // Default seed
						seed_control: "randomize",  // Default control mode
					};

					promptQueue.push(newEntry);
					setPromptBatchData(promptQueue);
					renderUI();
					};

					// === Update Prompt in Batch ===
					const updatePromptInBatch = (id, field, value) => {
						const promptQueue = parsePromptBatch();
						const entry = promptQueue.find((p) => p.id === id);
						if (entry) {
							entry[field] = value;
							node.properties.prompt_batch_data = JSON.stringify(promptQueue);
							syncPromptBatchWidget();
							// Dispatch event for BIG and other listeners
							window.dispatchEvent(new CustomEvent("INSTARAW_RPG_PROMPTS_CHANGED", {
								detail: {
									nodeId: node.id,
									prompts: promptQueue,
									totalGenerations: promptQueue.reduce((sum, p) => sum + (p.repeat_count || 1), 0)
								}
							}));
							// Don't re-render for text edits to avoid losing focus
							if (field !== "positive_prompt" && field !== "negative_prompt") {
								renderUI();
							}
						}
					};

					// === Bulk Update All Prompts ===
					const updateAllPromptsField = (field, value) => {
						const promptQueue = parsePromptBatch();
						if (promptQueue.length === 0) return;
						promptQueue.forEach(entry => {
							entry[field] = value;
						});
						node.properties.prompt_batch_data = JSON.stringify(promptQueue);
						syncPromptBatchWidget();
						renderUI();
					};

					// === Delete Prompt from Batch ===
					const deletePromptFromBatch = (id, alsoDeleteFromAIL = true) => {
						const promptQueue = parsePromptBatch();
						const deletedIndex = promptQueue.findIndex((p) => p.id === id);
						const filtered = promptQueue.filter((p) => p.id !== id);
						setPromptBatchData(filtered);

						// Also remove from AIL if in img2img mode and linked
						if (alsoDeleteFromAIL && node._linkedAILNodeId && deletedIndex >= 0) {
							const primaryAIL = app.graph.getNodeById(node._linkedAILNodeId);
							if (primaryAIL) {
								try {
									const ailData = JSON.parse(primaryAIL.properties?.batch_data || "{}");
									// Only auto-delete from AIL in img2img mode
									if (ailData.enable_img2img) {
										const ailImages = ailData.images || [];
										const ailOrder = ailData.order || [];

										if (deletedIndex < ailOrder.length) {
											// Remove the image at the same index
											const removedId = ailOrder[deletedIndex];
											ailData.order = ailOrder.filter((_, idx) => idx !== deletedIndex);
											ailData.images = ailImages.filter(img => img.id !== removedId);
											ailData.total_count = ailData.images.reduce((sum, img) => sum + (img.repeat_count || 1), 0);

											primaryAIL.properties.batch_data = JSON.stringify(ailData);

											// Trigger AIL re-render
											if (primaryAIL._renderGallery) {
												primaryAIL._renderGallery();
											}

											// Dispatch update event
											window.dispatchEvent(new CustomEvent("INSTARAW_AIL_UPDATED", {
												detail: {
													nodeId: primaryAIL.id,
													images: ailData.images,
													latents: [],
													total: ailData.order.length,
													mode: "img2img",
													enable_img2img: true
												}
											}));

											console.log(`[RPG] Deleted prompt at index ${deletedIndex}, also removed AIL image ${removedId}`);
										}
									}
								} catch (e) {
									console.warn("[RPG] Could not sync delete to AIL:", e);
								}
							}
						}

						renderUI();
					};

				// === Clear Batch ===
				const clearBatch = () => {
					// Check if we're in img2img mode with linked AIL
					let hasAILImages = false;
					if (node._linkedAILNodeId) {
						const primaryAIL = app.graph.getNodeById(node._linkedAILNodeId);
						if (primaryAIL) {
							try {
								const ailData = JSON.parse(primaryAIL.properties?.batch_data || "{}");
								if (ailData.enable_img2img && (ailData.images || []).length > 0) {
									hasAILImages = true;
								}
							} catch (e) {}
						}
					}

					const confirmMsg = hasAILImages
						? "Clear all prompts from batch?\n\nThis will also clear images from the linked AIL."
						: "Clear all prompts from batch?";

					if (!confirm(confirmMsg)) return;
					setPromptBatchData([]);

					// Also clear AIL images if in img2img mode
					if (hasAILImages && node._linkedAILNodeId) {
						const primaryAIL = app.graph.getNodeById(node._linkedAILNodeId);
						if (primaryAIL) {
							try {
								const ailData = JSON.parse(primaryAIL.properties?.batch_data || "{}");
								ailData.images = [];
								ailData.order = [];
								ailData.total_count = 0;
								primaryAIL.properties.batch_data = JSON.stringify(ailData);

								if (primaryAIL._renderGallery) {
									primaryAIL._renderGallery();
								}

								window.dispatchEvent(new CustomEvent("INSTARAW_AIL_UPDATED", {
									detail: {
										nodeId: primaryAIL.id,
										images: [],
										latents: [],
										total: 0,
										mode: "img2img",
										enable_img2img: true
									}
								}));

								console.log("[RPG] Cleared batch and AIL images");
							} catch (e) {
								console.warn("[RPG] Could not clear AIL:", e);
							}
						}
					}

					renderUI();
				};

				// === Update Seed Range Display ===
				const updateSeedRangeDisplay = (id) => {
					const promptQueue = parsePromptBatch();
					const entry = promptQueue.find((p) => p.id === id);
					if (!entry) return;

					const rangeSpan = container.querySelector(`.instaraw-rpg-seed-range[data-id="${id}"]`);
					if (!rangeSpan || entry.repeat_count <= 1) return;

					const seed = entry.seed || 1111111;
					const repeatCount = entry.repeat_count;

					// Repeats always increment by +1 (seed_control is for after execution)
					const endSeed = seed + (repeatCount - 1);
					rangeSpan.textContent = `→ ${endSeed}`;
				};

				// === Toggle Bookmark ===
				const toggleBookmark = async (promptId) => {
					await toggleBookmarkById(promptId);
					renderUI();
				};

				// === Update Filters ===
				const updateFilter = (filterName, value) => {
					const filters = JSON.parse(node.properties.library_filters || "{}");
					filters[filterName] = value;
					node.properties.library_filters = JSON.stringify(filters);
					currentPage = 0; // Reset to first page
					renderUI();
				};

				// === Clear Filters ===
				const clearFilters = () => {
					node.properties.library_filters = JSON.stringify({
						tags: [],
						content_type: "any",
						safety_level: "any",
						shot_type: "any",
						quality: "any",
						search_query: "",
						show_bookmarked: false,
						sdxl_mode: false,
					});
					currentPage = 0;
					renderUI();
				};

				// Debug helper - expose for testing in browser console
				node.debugGetInput = (inputName) => {
					return getFinalInputValue(inputName, "NOT_FOUND");
				};

				// Comprehensive graph dump for debugging
				node.debugDumpGraph = () => {
					console.group("[RPG] 📊 Complete Graph Dump");
					console.log("=== Current Node ===");
					console.log("Node ID:", node.id);
					console.log("Node Type:", node.type);
					console.log("Node Title:", node.title);
					console.log("Node Inputs:", node.inputs);
					console.log("Node Widgets:", node.widgets);
					console.log("Node Properties:", node.properties);

					console.log("\n=== All Nodes in Graph ===");
					console.table(app.graph._nodes.map(n => ({
						id: n.id,
						type: n.type,
						title: n.title,
						inputs: n.inputs?.length || 0,
						outputs: n.outputs?.length || 0,
						widgets: n.widgets?.length || 0
					})));

					console.log("\n=== All Links in Graph ===");
					const links = app.graph.links || {};
					console.table(Object.values(links).map(l => ({
						id: l.id,
						origin_id: l.origin_id,
						origin_slot: l.origin_slot,
						target_id: l.target_id,
						target_slot: l.target_slot,
						type: l.type
					})));

					console.log("\n=== Links Connected to This Node ===");
					const connectedLinks = Object.values(links).filter(l =>
						l.target_id === node.id || l.origin_id === node.id
					);
					console.log("Connected links:", connectedLinks);

					console.log("\n=== Nodes Connected to This Node ===");
					const connectedNodeIds = new Set();
					connectedLinks.forEach(l => {
						connectedNodeIds.add(l.origin_id);
						connectedNodeIds.add(l.target_id);
					});
					const connectedNodes = app.graph._nodes.filter(n => connectedNodeIds.has(n.id));
					connectedNodes.forEach(n => {
						console.group(`Node ${n.id}: ${n.type} (${n.title})`);
						console.log("Widgets:", n.widgets);
						console.log("Properties:", n.properties);
						console.groupEnd();
					});

					console.groupEnd();
					return {
						node: {
							id: node.id,
							type: node.type,
							inputs: node.inputs,
							widgets: node.widgets
						},
						connectedNodes,
						connectedLinks
					};
				};

				// === Generate Creative Prompts ===
				const generateCreativePrompts = async () => {
					console.group("[RPG] 🎨 Generate Creative Prompts - START");
					console.log("[RPG] Timestamp:", new Date().toISOString());

					const genCountInput = container.querySelector(".instaraw-rpg-gen-count-input");
					const inspirationCountInput = container.querySelector(".instaraw-rpg-inspiration-count-input");
					const generateBtn = container.querySelector(".instaraw-rpg-generate-creative-btn");

					const generationCount = parseInt(genCountInput?.value || "5");
					// Respect library inspiration toggle
					const inspirationCount = node.properties.enable_library_inspiration
						? parseInt(inspirationCountInput?.value || "3")
						: 0;
					const isSDXL = sdxlModeEnabled; // Use global SDXL mode
					const forceRegenerate = true; // Always regenerate

					const promptQueue = parsePromptBatch();
					const sourcePrompts = promptQueue.filter((p) => p.source_id).slice(0, inspirationCount);

					const model = node.properties.creative_model || "gemini-2.5-pro";
					const systemPrompt = node.properties.creative_system_prompt || DEFAULT_RPG_SYSTEM_PROMPT;
					const temperatureValue = parseFloat(node.properties.creative_temperature ?? 0.9) || 0.9;
					const topPValue = parseFloat(node.properties.creative_top_p ?? 0.9) || 0.9;

					console.log("[RPG] Configuration:", {
						generationCount,
						inspirationCount,
						isSDXL,
						forceRegenerate,
						model,
						temperature: temperatureValue,
						topP: topPValue,
						sourcePromptsCount: sourcePrompts.length
					});

					console.log("[RPG] About to retrieve API keys from connected nodes...");

					// Get API keys by traversing the graph if inputs are connected
					const geminiApiKey = (getFinalInputValue("gemini_api_key", "") || "").trim() || window.INSTARAW_GEMINI_KEY || "";
					const grokApiKey = (getFinalInputValue("grok_api_key", "") || "").trim() || window.INSTARAW_GROK_KEY || "";

					console.log(`[RPG] ✅ Resolved Gemini API Key: ${geminiApiKey ? `[KEY PRESENT - Length: ${geminiApiKey.length}]` : "[EMPTY]"}`);
					console.log(`[RPG] ✅ Resolved Grok API Key: ${grokApiKey ? `[KEY PRESENT - Length: ${grokApiKey.length}]` : "[EMPTY]"}`);

					console.log("[RPG] Window fallback keys:", {
						INSTARAW_GEMINI_KEY: window.INSTARAW_GEMINI_KEY ? "[PRESENT]" : "[EMPTY]",
						INSTARAW_GROK_KEY: window.INSTARAW_GROK_KEY ? "[PRESENT]" : "[EMPTY]"
					});

					// Validate API keys before proceeding
					if (!geminiApiKey && !grokApiKey) {
						console.error("[RPG] ❌ NO API KEYS FOUND!");
						console.log("[RPG] To fix this, connect a Primitive String node to either:");
						console.log("[RPG]   - gemini_api_key input");
						console.log("[RPG]   - grok_api_key input");
						console.log("[RPG] Or set window.INSTARAW_GEMINI_KEY or window.INSTARAW_GROK_KEY");
						console.groupEnd();
						alert("No API keys found! Please connect a Primitive String node with your Gemini or Grok API key to the 'gemini_api_key' or 'grok_api_key' input.");
						return;
					}

					// Disable button and show loading progress bar
					if (generateBtn) {
						generateBtn.disabled = true;
						const originalText = generateBtn.textContent;
						generateBtn.style.position = 'relative';
						generateBtn.style.overflow = 'hidden';
						generateBtn.innerHTML = `
							${originalText}
							<div class="instaraw-rpg-progress-bar-loading"></div>
						`;
					}

					console.log("[RPG] Making API request to /instaraw/generate_creative_prompts");
					console.log("[RPG] Request payload:", {
						source_prompts_count: sourcePrompts.length,
						generation_count: generationCount,
						inspiration_count: inspirationCount,
						is_sdxl: isSDXL,
						force_regenerate: forceRegenerate,
						model: model,
						has_gemini_key: !!geminiApiKey,
						has_grok_key: !!grokApiKey,
						temperature: temperatureValue,
						top_p: topPValue,
					});

					try {
					const response = await api.fetchApi("/instaraw/generate_creative_prompts", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								source_prompts: sourcePrompts.map((p) => ({
									id: p.source_id,
									prompt: {
										positive: p.positive_prompt,
										negative: p.negative_prompt,
									},
								})),
								generation_count: generationCount,
								inspiration_count: inspirationCount,
								is_sdxl: isSDXL,
								character_reference: "",
								model: model,
								gemini_api_key: geminiApiKey,
								grok_api_key: grokApiKey,
								system_prompt: systemPrompt,
								temperature: temperatureValue,
								top_p: topPValue,
								force_regenerate: forceRegenerate,
							}),
						});

						console.log("[RPG] API response status:", response.status, response.statusText);

						const result = await parseJSONResponse(response);
						console.log("[RPG] API response parsed:", result);

						if (!response.ok) {
							throw new Error(result?.error || `Creative API error ${response.status}`);
						}

						if (result.success && result.prompts) {
							console.log(`[RPG] ✅ Success! Generated ${result.prompts.length} prompts`);
							// Show preview
							const previewSection = container.querySelector(".instaraw-rpg-creative-preview");
							const previewList = container.querySelector(".instaraw-rpg-creative-preview-list");

							if (previewSection && previewList) {
								previewList.innerHTML = result.prompts
									.map(
										(p, idx) => `
									<div class="instaraw-rpg-preview-item">
										<strong>#${idx + 1}</strong>
										<p>${escapeHtml(p.positive || "")}</p>
									</div>
								`
									)
									.join("");

								previewSection.style.display = "block";
								// Store generated prompts temporarily
								node._generatedCreativePrompts = result.prompts;
								// DON'T call setupEventHandlers() - already set up by renderUI()
							}
						} else {
							throw new Error(result.error || "Unknown error");
						}
					} catch (error) {
						console.error("[RPG] ❌ Error during creative prompt generation:", error);
						console.error("[RPG] Error stack:", error.stack);
						alert(`Creative generation error: ${error.message || error}`);
					} finally {
						if (generateBtn) {
							generateBtn.disabled = false;
							generateBtn.textContent = "✨ Generate & Add to Batch";
						}
						console.log("[RPG] Generate Creative Prompts - END");
						console.groupEnd();
					}
				};

				// === Accept Creative Prompts ===
				const acceptCreativePrompts = () => {
					if (!node._generatedCreativePrompts) return;

					const existingQueue = parsePromptBatch();
					const newCount = node._generatedCreativePrompts.length;

					// If there are existing prompts, ask the user to confirm
					if (existingQueue.length > 0) {
						const confirmAdd = confirm(
							`You have ${existingQueue.length} existing prompt(s) in the batch.\n\n` +
							`Add ${newCount} new prompt(s) to the batch?\n\n` +
							`OK = Add to existing\n` +
							`Cancel = Don't add (clear batch first if needed)`
						);

						if (!confirmAdd) {
							console.log("[RPG] User cancelled adding creative prompts to batch");
							return;
						}
					}

					const promptQueue = existingQueue;
					node._generatedCreativePrompts.forEach((p) => {
						promptQueue.push({
							id: generateUniqueId(),
							positive_prompt: p.positive || "",
							negative_prompt: p.negative || "",
							repeat_count: 1,
							tags: p.tags || [],
							source_id: null,
						});
					});

					setPromptBatchData(promptQueue);
					delete node._generatedCreativePrompts;
					renderUI();
				};

				// === Cancel Creative Prompts ===
				const cancelCreativePrompts = () => {
					delete node._generatedCreativePrompts;
					renderUI();
				};

				// === Generate Character Prompts ===
				const generateCharacterPrompts = async () => {
					console.group("[RPG] 👤 Generate Character Prompts - START");
					console.log("[RPG] Timestamp:", new Date().toISOString());

					const charRefInput = container.querySelector(".instaraw-rpg-character-ref-input");
					const genCountInput = container.querySelector(".instaraw-rpg-char-gen-count-input");
					const generateBtn = container.querySelector(".instaraw-rpg-generate-character-btn");

					const characterReference = charRefInput?.value || "";
					const generationCount = parseInt(genCountInput?.value || "5");
					const isSDXL = sdxlModeEnabled; // Use global SDXL mode
					const forceRegenerate = true; // Always regenerate

					const model = node.properties.creative_model || "gemini-2.5-pro";
					const systemPrompt = node.properties.creative_system_prompt || DEFAULT_RPG_SYSTEM_PROMPT;
					const temperatureValue = parseFloat(node.properties.creative_temperature ?? 0.9) || 0.9;
					const topPValue = parseFloat(node.properties.creative_top_p ?? 0.9) || 0.9;

					console.log("[RPG] Configuration:", {
						generationCount,
						isSDXL,
						forceRegenerate,
						model,
						temperature: temperatureValue,
						topP: topPValue,
						characterReferenceLength: characterReference.length
					});

					console.log("[RPG] About to retrieve API keys from connected nodes...");

					// Get API keys by traversing the graph if inputs are connected
					const geminiApiKey = (getFinalInputValue("gemini_api_key", "") || "").trim() || window.INSTARAW_GEMINI_KEY || "";
					const grokApiKey = (getFinalInputValue("grok_api_key", "") || "").trim() || window.INSTARAW_GROK_KEY || "";

					console.log(`[RPG] ✅ Resolved Gemini API Key: ${geminiApiKey ? `[KEY PRESENT - Length: ${geminiApiKey.length}]` : "[EMPTY]"}`);
					console.log(`[RPG] ✅ Resolved Grok API Key: ${grokApiKey ? `[KEY PRESENT - Length: ${grokApiKey.length}]` : "[EMPTY]"}`);

					console.log("[RPG] Window fallback keys:", {
						INSTARAW_GEMINI_KEY: window.INSTARAW_GEMINI_KEY ? "[PRESENT]" : "[EMPTY]",
						INSTARAW_GROK_KEY: window.INSTARAW_GROK_KEY ? "[PRESENT]" : "[EMPTY]"
					});

					// Validate API keys before proceeding
					if (!geminiApiKey && !grokApiKey) {
						console.error("[RPG] ❌ NO API KEYS FOUND!");
						console.log("[RPG] To fix this, connect a Primitive String node to either:");
						console.log("[RPG]   - gemini_api_key input");
						console.log("[RPG]   - grok_api_key input");
						console.log("[RPG] Or set window.INSTARAW_GEMINI_KEY or window.INSTARAW_GROK_KEY");
						console.groupEnd();
						alert("No API keys found! Please connect a Primitive String node with your Gemini or Grok API key to the 'gemini_api_key' or 'grok_api_key' input.");
						return;
					}

					if (!characterReference.trim()) {
						console.error("[RPG] ❌ No character reference provided");
						console.groupEnd();
						alert("Please enter a character reference");
						return;
					}

					// Disable button and show loading progress bar
					if (generateBtn) {
						generateBtn.disabled = true;
						const originalText = generateBtn.textContent;
						generateBtn.style.position = 'relative';
						generateBtn.style.overflow = 'hidden';
						generateBtn.innerHTML = `
							${originalText}
							<div class="instaraw-rpg-progress-bar-loading"></div>
						`;
					}

					console.log("[RPG] Making API request to /instaraw/generate_creative_prompts (character mode)");
					console.log("[RPG] Request payload:", {
						generation_count: generationCount,
						is_sdxl: isSDXL,
						force_regenerate: forceRegenerate,
						model: model,
						has_gemini_key: !!geminiApiKey,
						has_grok_key: !!grokApiKey,
						character_reference_length: characterReference.length,
						temperature: temperatureValue,
						top_p: topPValue,
					});

					try {
					const response = await api.fetchApi("/instaraw/generate_creative_prompts", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								source_prompts: [],
								generation_count: generationCount,
								inspiration_count: 0,
								is_sdxl: isSDXL,
								character_reference: characterReference,
								model: model,
								gemini_api_key: geminiApiKey,
								grok_api_key: grokApiKey,
								system_prompt: systemPrompt,
								temperature: temperatureValue,
								top_p: topPValue,
								force_regenerate: forceRegenerate,
							}),
						});

						console.log("[RPG] API response status:", response.status, response.statusText);

						const result = await parseJSONResponse(response);
						console.log("[RPG] API response parsed:", result);

						if (!response.ok) {
							throw new Error(result?.error || `Creative API error ${response.status}`);
						}

						if (result.success && result.prompts) {
							console.log(`[RPG] ✅ Success! Generated ${result.prompts.length} character prompts`);
							// Show preview
							const previewSection = container.querySelector(".instaraw-rpg-creative-preview");
							const previewList = container.querySelector(".instaraw-rpg-character-preview-list");

							if (previewSection && previewList) {
								previewList.innerHTML = result.prompts
									.map(
										(p, idx) => `
									<div class="instaraw-rpg-preview-item">
										<strong>#${idx + 1}</strong>
										<p>${escapeHtml(p.positive || "")}</p>
									</div>
								`
									)
									.join("");

								previewSection.style.display = "block";
								// Store generated prompts temporarily
								node._generatedCharacterPrompts = result.prompts;
								// DON'T call setupEventHandlers() - already set up by renderUI()
							}
						} else {
							throw new Error(result.error || "Unknown error");
						}
					} catch (error) {
						console.error("[RPG] ❌ Error during character prompt generation:", error);
						console.error("[RPG] Error stack:", error.stack);
						alert(`Character generation error: ${error.message || error}`);
					} finally {
						if (generateBtn) {
							generateBtn.disabled = false;
							generateBtn.textContent = "👤 Generate Character Prompts";
						}
						console.log("[RPG] Generate Character Prompts - END");
						console.groupEnd();
					}
				};

				// === Accept Character Prompts ===
				const acceptCharacterPrompts = () => {
					if (!node._generatedCharacterPrompts) return;

						const promptQueue = parsePromptBatch();
					node._generatedCharacterPrompts.forEach((p) => {
						promptQueue.push({
							id: generateUniqueId(),
							positive_prompt: p.positive || "",
							negative_prompt: p.negative || "",
							repeat_count: 1,
							tags: p.tags || [],
							source_id: null,
						});
					});

						setPromptBatchData(promptQueue);
					delete node._generatedCharacterPrompts;
					renderUI();
				};

				// === Cancel Character Prompts ===
				const cancelCharacterPrompts = () => {
					delete node._generatedCharacterPrompts;
					renderUI();
				};

				// ========================================
				// === UNIFIED GENERATE TAB FUNCTIONS ===
				// ========================================

				// === Get Default Character System Prompt (mirrors backend logic) ===
				const getCharacterSystemPrompt = (complexity = "balanced") => {
					const baseInstruction = `You are an expert at analyzing images and generating character descriptions for image generation prompts.

Generate a character description focusing on PERMANENT physical features:
- Facial features (face shape, eyes, nose, lips, skin tone)
- Hair (color, length, style, texture)
- Body type and build
- Age and ethnicity
- Distinctive features (scars, tattoos, piercings, etc.)

DO NOT include clothing, background, pose, or temporary features.
DO NOT use tags like "1girl, solo" or similar categorization prefixes.`;

					let lengthInstruction;
					if (complexity === "concise") {
						lengthInstruction = "\nOUTPUT: A concise description (50-75 words) focusing only on the most essential and distinctive physical features.";
					} else if (complexity === "detailed") {
						lengthInstruction = "\nOUTPUT: A comprehensive, detailed description (200-250 words) covering all physical aspects with nuanced detail and specific characteristics.";
					} else {  // balanced
						lengthInstruction = "\nOUTPUT: A balanced description (100-150 words) covering key physical features in natural language.";
					}

					return baseInstruction + lengthInstruction;
				};

				// === Generate Character Description (from image or text) ===
				const generateCharacterDescription = async () => {
					// CRASH PREVENTION: Check if already generating
					if (isGenerating) {
						console.warn("[RPG] ⚠️ Generation already in progress, ignoring request");
						return;
					}

					console.group("[RPG] 🎨 Generate Character Description - START");

					// Set generation lock
					isGenerating = true;

					const generateBtn = container.querySelector(".instaraw-rpg-generate-character-desc-btn");
					const characterTextInput = container.querySelector(".instaraw-rpg-character-text-input");

					const characterText = characterTextInput?.value?.trim() || "";

					// Get API keys
					const geminiApiKey = (getFinalInputValue("gemini_api_key", "") || "").trim() || window.INSTARAW_GEMINI_KEY || "";
					const grokApiKey = (getFinalInputValue("grok_api_key", "") || "").trim() || window.INSTARAW_GROK_KEY || "";

					if (!geminiApiKey && !grokApiKey) {
						alert("No API keys found! Please connect a Primitive String node with your Gemini or Grok API key.");
						console.groupEnd();
						return;
					}

					// Check if character_image input is connected
					const characterImageInput = node.inputs?.find(i => i.name === "character_image");
					let imageData = null;

					if (characterImageInput && characterImageInput.link != null) {
						console.log("[RPG] Character image input connected, reading image...");

						try {
							// Get the connected node
							const link = app.graph.links[characterImageInput.link];
							if (link) {
								const sourceNode = app.graph.getNodeById(link.origin_id);
								console.log("[RPG] Source node type:", sourceNode?.type);

								if (sourceNode && sourceNode.type === "LoadImage") {
									// Get the image filename from the LoadImage node
									const imageWidget = sourceNode.widgets?.find(w => w.name === "image");
									const filename = imageWidget?.value;

									if (filename) {
										console.log("[RPG] Loading image:", filename);

										// Fetch the image from ComfyUI's view endpoint
										const imageUrl = `/view?filename=${encodeURIComponent(filename)}&type=input`;
										const response = await fetch(imageUrl);
										const blob = await response.blob();

										// Convert to base64
										const base64 = await new Promise((resolve) => {
											const reader = new FileReader();
											reader.onloadend = () => resolve(reader.result);
											reader.readAsDataURL(blob);
										});

										imageData = base64;
										console.log("[RPG] ✅ Image loaded and converted to base64");
									} else {
										console.warn("[RPG] No image selected in LoadImage node");
									}
								} else if (sourceNode) {
									console.warn("[RPG] Connected node is not LoadImage, type:", sourceNode.type);
								}
							}
						} catch (error) {
							console.error("[RPG] Error reading character image:", error);
							alert(`Could not read character image: ${error.message}`);
							return;
						}
					}

					// Require either image or text
					if (!imageData && !characterText) {
						alert("Please either:\n1. Connect a Load Image node to character_image input, OR\n2. Enter character description text");
						console.groupEnd();
						return;
					}

					// Disable button and show loading progress bar
					if (generateBtn) {
						generateBtn.disabled = true;
						const originalText = generateBtn.textContent;
						generateBtn.style.position = 'relative';
						generateBtn.style.overflow = 'hidden';
						generateBtn.innerHTML = `
							${originalText}
							<div class="instaraw-rpg-progress-bar-loading"></div>
						`;
					}

					try {
						// Get complexity and custom system prompt from properties
						const complexity = node.properties.character_complexity || "balanced";
						const customSystemPrompt = node.properties.character_system_prompt?.trim() || "";

						console.log("[RPG] Sending character description request:", {
							hasImage: !!imageData,
							hasText: !!characterText,
							model: node.properties.creative_model || "gemini-2.5-pro",
							complexity: complexity,
							hasCustomSystemPrompt: !!customSystemPrompt
						});

						const response = await api.fetchApi("/instaraw/generate_character_description", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								character_image: imageData,
								character_text: characterText,
								gemini_api_key: geminiApiKey,
								grok_api_key: grokApiKey,
								model: node.properties.creative_model || "gemini-2.5-pro",
								complexity: complexity,
								custom_system_prompt: customSystemPrompt,
								force_regenerate: true  // Always force regenerate to bypass bad cache
							}),
						});

						const result = await parseJSONResponse(response);
						console.log("[RPG] Character description API response:", result);

						if (!response.ok) {
							throw new Error(result?.error || `Character description API error ${response.status}`);
						}

						if (result.success) {
							if (!result.description || result.description.trim() === "") {
								throw new Error("API returned empty description. Check backend logs for details.");
							}

							console.log(`[RPG] ✅ Character description generated successfully (${result.description.length} chars)`);

							// Populate the character text input with the generated description
							node.properties.character_text_input = result.description;

							// Update textarea directly (don't call renderUI to avoid event handler duplication)
							if (characterTextInput) {
								characterTextInput.value = result.description;
								autoResizeTextarea(characterTextInput);
							}

							// Mark canvas as dirty to save changes
							app.graph.setDirtyCanvas(true, true);
						} else {
							throw new Error(result.error || "API returned success=false");
						}
					} catch (error) {
						console.error("[RPG] ❌ Error during character description generation:", error);
						alert(`Character description error: ${error.message || error}`);
					} finally {
						// CRASH PREVENTION: Always release generation lock
						isGenerating = false;

						// Reset button
						if (generateBtn) {
							generateBtn.disabled = false;
							generateBtn.style.position = '';
							generateBtn.style.overflow = '';
							generateBtn.textContent = "✨ Generate from Image";
						}
						console.groupEnd();
					}
				};

				// === Generate Unified Prompts (Main Generate Button) - SEQUENTIAL VERSION ===
				let generationAbortController = null; // For cancel functionality

				const generateUnifiedPrompts = async () => {
					// Check if there's already an ongoing generation
					if (generationAbortController !== null) {
						const confirmRestart = confirm(
							"⚠️ Generation in Progress\n\n" +
							"There is already a generation running. Starting a new one will cancel the current generation.\n\n" +
							"Do you want to cancel the current generation and start a new one?"
						);

						if (!confirmRestart) {
							console.log("[RPG] User chose not to restart generation");
							return;
						}

						// User confirmed - abort the current generation
						console.log("[RPG] 🛑 Aborting current generation to start new one");
						generationAbortController.abort();
						generationAbortController = null;

						// Small delay to let the abort propagate
						await new Promise(resolve => setTimeout(resolve, 100));
					}

					console.group("[RPG] 🎯 Generate Unified Prompts - START (Sequential)");
					console.log("[RPG] Timestamp:", new Date().toISOString());

					const generateBtn = container.querySelector(".instaraw-rpg-generate-unified-btn");
					const genCountInput = container.querySelector(".instaraw-rpg-gen-count-input");
					const progressSection = container.querySelector(".instaraw-rpg-generation-progress");
					const progressItems = container.querySelector(".instaraw-rpg-progress-items");
					const previewSection = container.querySelector(".instaraw-rpg-generate-preview");

					// Character settings
					const enableCharacterCheckbox = container.querySelector(".instaraw-rpg-enable-character-checkbox");
					const characterTextInput = container.querySelector(".instaraw-rpg-character-text-input");
					const useCharacter = enableCharacterCheckbox?.checked || false;
					const characterText = characterTextInput?.value?.trim() || "";
					// Use character_text_input directly - generated descriptions populate this field
					const characterDescription = characterText;

					// Detect mode from AIL
					const detectedMode = node._linkedAILMode || "txt2img";
					const isImg2Img = detectedMode === "img2img";

					// Mode-specific settings
					let affectElements = [];
					let userInput = "";
					let inspirationCount = 0;
					let uniqueImages = [];
					let uniqueImages2 = [];
					let uniqueImages3 = [];
					let uniqueImages4 = [];
					let generationCount = 0;

					if (isImg2Img) {
						// IMG2IMG: Get unique images from all 4 AIL inputs
						uniqueImages = node._linkedImages || [];
						uniqueImages2 = node._linkedImages2 || [];
						uniqueImages3 = node._linkedImages3 || [];
						uniqueImages4 = node._linkedImages4 || [];

						if (uniqueImages.length === 0) {
							console.error("[RPG] ❌ No images from AIL");
							alert("No images from AIL. Please connect an Advanced Image Loader node in img2img mode.");
							return;
						}

						// Generation count = number of unique images from primary input
						generationCount = uniqueImages.length;

						// Compose user input from all three universal components
						userInput = composeUserInput(
							node.properties.user_instructions || "",
							node.properties.theme_preset || DEFAULT_THEME_PRESET,
							node.properties.model_instructions || "",
							node.properties.clean_mode || false
						);
						console.log(`[RPG] 📝 IMG2IMG composed user input: ${userInput ? `"${userInput.substring(0, 100)}..."` : "(none)"}`);

						// Collect affect elements
						const affectBackground = container.querySelector(".instaraw-rpg-affect-background")?.checked;
						const affectOutfit = container.querySelector(".instaraw-rpg-affect-outfit")?.checked;
						const affectPose = container.querySelector(".instaraw-rpg-affect-pose")?.checked;
						const affectLighting = container.querySelector(".instaraw-rpg-affect-lighting")?.checked;

						if (affectBackground) affectElements.push("background");
						if (affectOutfit) affectElements.push("outfit");
						if (affectPose) affectElements.push("pose");
						if (affectLighting) affectElements.push("lighting");

						console.log("[RPG] 🎨 Affect Elements collected:", affectElements);

						// Get inspiration count (for Creative mode only, respects toggle)
						const inspirationCountInput = container.querySelector(".instaraw-rpg-inspiration-count");
						if (inspirationCountInput && node.properties.generation_style === 'creative') {
							inspirationCount = node.properties.enable_library_inspiration ? parseInt(inspirationCountInput?.value || "3") : 0;
						}

						console.log(`[RPG] 🖼️ img2img mode: ${uniqueImages.length} unique images → ${generationCount} prompts`);
					} else {
						// TXT2IMG: Collect user input and inspiration
						const userTextInput = container.querySelector(".instaraw-rpg-user-text-input");
						const inspirationCountInput = container.querySelector(".instaraw-rpg-inspiration-count");

						// Compose user input from all three universal components
						const userText = userTextInput?.value?.trim() || "";
						userInput = composeUserInput(
							userText,
							node.properties.theme_preset || DEFAULT_THEME_PRESET,
							node.properties.model_instructions || "",
							node.properties.clean_mode || false
						);

						// Respect library inspiration toggle
						inspirationCount = node.properties.enable_library_inspiration ? parseInt(inspirationCountInput?.value || "3") : 0;
						generationCount = parseInt(genCountInput?.value || "5");

						const selectedTheme = node.properties.theme_preset || DEFAULT_THEME_PRESET;
						if (selectedTheme !== "none") {
							console.log(`[RPG] 🎨 Using theme: ${selectedTheme}`);
						}
						console.log(`[RPG] 📝 TXT2IMG composed user input: ${userInput ? `"${userInput.substring(0, 100)}..."` : "(none)"}`);
					}

					const forceRegenerate = true; // Always regenerate
					const isSDXL = sdxlModeEnabled; // Use global SDXL mode

					// Prepare source prompt pool (each generation will sample from this)
					let sourcePromptPool = [];
					if (inspirationCount > 0) {
						// Build filtered pool for sampling (both txt2img and img2img Creative mode)
						const filters = JSON.parse(node.properties.library_filters || "{}");
						sourcePromptPool = filterPrompts(promptsDatabase, filters);

						if (sourcePromptPool.length === 0 && detectedMode === 'txt2img') {
							console.warn("[RPG] ⚠️ No prompts available after filtering - generating without inspiration");
							alert("No prompts match the current filters. Adjust filters or generate without inspiration.");
							return;
						}

						if (sourcePromptPool.length > 0) {
							console.log(`[RPG] 🎲 Prepared pool of ${sourcePromptPool.length} prompts for sampling (inspiration: ${inspirationCount} per generation)`);
						}
					}

					// Get model and settings
					const model = node.properties.creative_model || "gemini-2.5-pro";
					const generationStyle = node.properties.generation_style || "reality";

					const temperatureValue = parseFloat(node.properties.creative_temperature ?? 0.9) || 0.9;
					const topPValue = parseFloat(node.properties.creative_top_p ?? 0.9) || 0.9;

					// Get full names for tagging generated prompts
					const modelPresetKey = node.properties.model_preset || "none";
					const themePresetKey = node.properties.theme_preset || DEFAULT_THEME_PRESET;
					// Get full theme name (strip emoji prefix if present)
					const themeLabel = THEME_PRESETS[themePresetKey]?.label || "";
					const currentThemeBadge = themePresetKey !== "none" && themeLabel ? themeLabel.replace(/^[^\w\s]+\s*/, '').trim() : null;
					// Get full model name (strip emoji prefix if present)
					const modelLabel = MODEL_INSTRUCTION_PRESETS[modelPresetKey]?.label || "";
					const currentModelBadge = modelPresetKey !== "none" && modelLabel ? modelLabel.replace(/^[^\w\s]+\s*/, '').trim() : null;

					console.log(`[RPG] 🔧 Generation mode: ${detectedMode}, style: ${generationStyle}`);
					if (currentThemeBadge) console.log(`[RPG] 🎨 Theme: ${currentThemeBadge}`);
					if (currentModelBadge) console.log(`[RPG] 🏷️ Model: ${currentModelBadge}`);

					console.log("[RPG] Configuration:", {
						mode: detectedMode,
						generationCount,
						useCharacter,
						affectElements,
						userInput,
						inspirationCount,
						isSDXL,
						forceRegenerate,
						model,
						temperature: temperatureValue,
						topP: topPValue
					});

					// Get API keys
					const geminiApiKey = (getFinalInputValue("gemini_api_key", "") || "").trim() || window.INSTARAW_GEMINI_KEY || "";
					const grokApiKey = (getFinalInputValue("grok_api_key", "") || "").trim() || window.INSTARAW_GROK_KEY || "";

					if (!geminiApiKey && !grokApiKey) {
						console.error("[RPG] ❌ NO API KEYS FOUND!");
						console.groupEnd();
						alert("No API keys found! Please connect a Primitive String node with your Gemini or Grok API key.");
						return;
					}

					// Initialize AbortController for cancellation
					generationAbortController = new AbortController();
					const signal = generationAbortController.signal;

					// Disable generate button and show progress section
					if (generateBtn) {
						generateBtn.disabled = true;
						generateBtn.style.opacity = "0.5";
					}

					// Hide preview section when starting new generation
					if (previewSection) {
						previewSection.style.display = "none";
					}

					// Mark generation as in progress
					node._generationInProgress = true;
					node._generationCount = generationCount;

					// Initialize progress state
					node._progressState = Array.from({ length: generationCount }, (_, i) => ({
						index: i,
						status: 'pending',
						progress: 0,
						message: ''
					}));

					if (progressSection) {
						progressSection.style.display = "block";
						// Reset header to "Generating..." when starting a new generation
						const progressHeader = progressSection.querySelector(".instaraw-rpg-progress-header h4");
						if (progressHeader) {
							progressHeader.innerHTML = `⏳ Generating Prompts...`;
						}
						// Show cancel button, hide quick accept button
						const cancelBtn = progressSection.querySelector(".instaraw-rpg-cancel-generation-btn");
						if (cancelBtn) cancelBtn.style.display = "";
						const quickAccept = progressSection.querySelector(".instaraw-rpg-quick-accept");
						if (quickAccept) quickAccept.style.display = "none";
					}

					// Create progress items
					if (progressItems) {
						progressItems.innerHTML = "";

						// Helper to render image thumbnails for a generation index
						const renderProgressImages = (index) => {
							if (!isImg2Img) return '';

							// Helper to get image URL (handles both url and thumbnail formats)
							const getImgUrl = (img) => img?.url || (img?.thumbnail ? `/instaraw/view/${img.thumbnail}` : null);

							const images = [
								{ img: uniqueImages[index], label: "1" },
								{ img: uniqueImages2[index], label: "2" },
								{ img: uniqueImages3[index], label: "3" },
								{ img: uniqueImages4[index], label: "4" }
							].filter(item => item.img && getImgUrl(item.img));

							if (images.length === 0) return '';

							return `
								<div class="instaraw-rpg-progress-images">
									${images.map(item => `
										<div class="instaraw-combo-slot">
											<div class="instaraw-combo-slot-image">
												<img src="${getImgUrl(item.img)}" alt="Image ${item.label}" loading="lazy" style="background: rgba(0,0,0,0.3);" onerror="this.style.opacity='0.3'; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath fill=%22%239ca3af%22 d=%22M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z%22/%3E%3C/svg%3E';" />
											</div>
										</div>
									`).join('')}
								</div>
							`;
						};

						for (let i = 0; i < generationCount; i++) {
							const progressItem = document.createElement("div");
							progressItem.className = "instaraw-rpg-progress-item";
							progressItem.dataset.index = i;
							const imagePreview = renderProgressImages(i);
							progressItem.innerHTML = `
								<div class="instaraw-rpg-progress-item-header">
									<span class="instaraw-rpg-progress-item-label">#${i + 1}</span>
									${imagePreview}
									<span class="instaraw-rpg-progress-item-status pending">⏳ Pending</span>
								</div>
								<div class="instaraw-rpg-progress-item-bar">
									<div class="instaraw-rpg-progress-item-fill" style="width: 0%"></div>
								</div>
								<div class="instaraw-rpg-progress-item-message"></div>
							`;
							progressItems.appendChild(progressItem);
						}

						// Resize node to fit progress UI
						updateCachedHeight();
					}

					// Collect all generated prompts
					const allGeneratedPrompts = [];
					let cancelRequested = false;

					// Listen for cancel signal
					signal.addEventListener('abort', () => {
						cancelRequested = true;
						console.log("[RPG] 🛑 Cancel requested by user");
					});

					try {
						// PARALLEL GENERATION with 222ms stagger
						const generateSinglePrompt = async (index) => {
							const i = index;

							try {
								// Sample UNIQUE source prompts for THIS generation
								let thisPromptSources = [];
								if (sourcePromptPool.length > 0) {
									const sampleCount = Math.min(inspirationCount, sourcePromptPool.length);
									const shuffled = [...sourcePromptPool].sort(() => Math.random() - 0.5);
									thisPromptSources = shuffled.slice(0, sampleCount).map(p => ({
										source_id: p.id,
										positive_prompt: p.prompt?.positive || p.positive || "",
										negative_prompt: p.prompt?.negative || p.negative || ""
									}));
								}

								// Determine expression for this generation (if enabled)
								let currentExpression = null;
								if (node.properties.enable_expressions) {
									const enabledExpressions = JSON.parse(node.properties.enabled_expressions || '[]');
									const defaultExpression = node.properties.default_expression || "Neutral/Natural";
									const mixFrequency = node.properties.default_mix_frequency || 0;

									if (enabledExpressions.length > 0) {
										// Roll for default expression vs cycling
										const useDefault = Math.random() * 100 < mixFrequency;

										if (useDefault || enabledExpressions.length === 0) {
											currentExpression = defaultExpression;
										} else {
											// Cycle through enabled expressions
											const currentIndex = node.properties.current_expression_index || 0;
											currentExpression = enabledExpressions[currentIndex % enabledExpressions.length];
											// Increment for next generation
											node.properties.current_expression_index = (currentIndex + 1) % enabledExpressions.length;
										}
									} else {
										// No expressions enabled, use default
										currentExpression = defaultExpression;
									}

									console.log(`[RPG] 😊 [${i + 1}] Expression: ${currentExpression}`);
								}

								// Build dynamic system prompt with actual source prompt text
								// Use custom template if in custom mode, otherwise use creative_system_prompt
								const customTemplate = node.properties.generation_style === 'custom'
									? node.properties.custom_template
									: node.properties.creative_system_prompt;
								const dynamicSystemPrompt = buildSystemPrompt(
									detectedMode,
									generationStyle,
									thisPromptSources,
									userInput,
									useCharacter ? characterDescription : "",
									affectElements,
									customTemplate,
									currentExpression
								);

								// Update status to in-progress
								updateProgressState(i, { status: 'in-progress', progress: 100 });

								console.log(`[RPG] 📝 [${i + 1}] Starting generation with ${thisPromptSources.length} unique source prompts...`);

								// For img2img: Convert all connected images to base64
								let multiImageData = [];
								if (isImg2Img) {
									updateProgressState(i, { message: "Converting images to base64..." });

									// Helper to convert image at index from an array
									const convertImageIfExists = async (imagesArray, label, index) => {
										const img = imagesArray[index];
										// Handle both url (from renderImg2ImgGallery events) and thumbnail (from raw batchData events)
										const imgUrl = img?.url || (img?.thumbnail ? `/instaraw/view/${img.thumbnail}` : null);
										if (img && imgUrl) {
											try {
												const base64 = await imageUrlToBase64(imgUrl);
												console.log(`[RPG] 📷 [${i + 1}] ${label} converted to base64 (${base64.length} chars)`);
												return { label, base64, url: imgUrl };
											} catch (error) {
												console.warn(`[RPG] ⚠️ [${i + 1}] Failed to convert ${label}:`, error);
												return null;
											}
										}
										return null;
									};

									// Convert all 4 image inputs in parallel
									const conversionPromises = [
										convertImageIfExists(uniqueImages, "image_1", i),
										convertImageIfExists(uniqueImages2, "image_2", i),
										convertImageIfExists(uniqueImages3, "image_3", i),
										convertImageIfExists(uniqueImages4, "image_4", i)
									];

									const results = await Promise.all(conversionPromises);
									multiImageData = results.filter(Boolean);

									console.log(`[RPG] 📷 [${i + 1}] ${multiImageData.length} images converted for vision API`);
								}

								// Build payload
								const payload = {
									source_prompts: thisPromptSources.map((p) => ({
										id: p.source_id,
										prompt: { positive: p.positive_prompt, negative: p.negative_prompt },
									})),
									generation_count: 1,
									inspiration_count: inspirationCount,
									is_sdxl: isSDXL,
									character_reference: useCharacter ? characterDescription : "",
									model: model,
									gemini_api_key: geminiApiKey,
									grok_api_key: grokApiKey,
									system_prompt: dynamicSystemPrompt,
									temperature: temperatureValue,
									top_p: topPValue,
									force_regenerate: forceRegenerate,
									generation_mode: detectedMode,  // Fixed: was "mode", backend expects "generation_mode"
									affect_elements: affectElements,
									user_input: userInput,
									generation_style: generationStyle
								};

								// Add images for img2img mode (multi-image support)
								if (isImg2Img && multiImageData.length > 0) {
									// New format: array of { label, base64 } objects for multi-image
									payload.multi_images = multiImageData.map(img => ({
										label: img.label,
										base64: img.base64
									}));
									// Also keep legacy images array for backward compatibility (primary image only)
									payload.images = [multiImageData[0].base64];
								}

								// 🔍 DETAILED LOGGING: Preview the complete request
								console.group(`[RPG] 🔍 REQUEST PREVIEW [${i + 1}/${generationCount}]`);
								console.log(`📋 Mode: ${detectedMode} | Style: ${generationStyle} | Model: ${model}`);
								console.log(`\n━━━ SYSTEM PROMPT ━━━\n${dynamicSystemPrompt}\n━━━━━━━━━━━━━━━━━━━━`);

								if (userInput) {
									console.log(`\n💬 User Input: "${userInput}"`);
								}

								if (useCharacter && characterDescription) {
									console.log(`\n👤 Character Reference: "${characterDescription}"`);
								}

								if (thisPromptSources.length > 0) {
									console.log(`\n📚 Source Prompts (${thisPromptSources.length}):`);
									thisPromptSources.forEach((sp, idx) => {
										console.log(`  [${idx + 1}] POS: ${sp.positive_prompt.substring(0, 100)}${sp.positive_prompt.length > 100 ? '...' : ''}`);
									});
								}

								if (isImg2Img && multiImageData.length > 0) {
									console.log(`\n🖼️ Input Images (${multiImageData.length}):`);
									multiImageData.forEach((imgData, idx) => {
										console.log(`  [${imgData.label}] URL: ${imgData.url}`);
										console.log(`           Base64 Length: ${imgData.base64?.length || 0} chars`);
									});
								}

								if (affectElements && affectElements.length > 0) {
									console.log(`\n🎨 Affect Elements: ${affectElements.join(', ')}`);
								}

								console.log(`\n⚙️ Model Settings: Temp=${temperatureValue}, Top-P=${topPValue}, SDXL=${isSDXL}`);

								// Log complete payload (excluding sensitive keys)
								const payloadForLogging = {
									...payload,
									gemini_api_key: payload.gemini_api_key ? '***REDACTED***' : undefined,
									grok_api_key: payload.grok_api_key ? '***REDACTED***' : undefined,
									images: payload.images ? [`[Base64 image data: ${payload.images[0]?.length || 0} chars]`] : undefined,
									multi_images: payload.multi_images ? payload.multi_images.map(img => ({ label: img.label, base64: `[${img.base64?.length || 0} chars]` })) : undefined
								};
								console.log(`\n━━━ COMPLETE REQUEST PAYLOAD ━━━`);
								console.log(JSON.stringify(payloadForLogging, null, 2));
								console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
								console.groupEnd();

								// Retry logic
								const maxRetries = 3;
								let retryCount = 0;
								let success = false;
								let promptResult = null;

								while (retryCount <= maxRetries && !success && !cancelRequested) {
									try {
										if (retryCount > 0) {
											if (statusBadge) statusBadge.textContent = `🔄 Retry ${retryCount}/${maxRetries}`;
											if (messageDiv) messageDiv.textContent = `Rate limited, retrying in ${Math.pow(2, retryCount - 1)}s...`;
											await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000));
											if (cancelRequested) break;
										}

										const response = await api.fetchApi("/instaraw/generate_creative_prompts", {
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify(payload),
											signal: signal
										});

										const result = await parseJSONResponse(response);

										if (response.status === 429 || (result.error && /rate.*limit/i.test(result.error))) {
											throw new Error("Rate limited");
										}

										if (!response.ok) {
											throw new Error(result?.error || `API error ${response.status}`);
										}

										if (result.success && result.prompts && result.prompts.length > 0) {
											const rawPrompt = result.prompts[0];

											// Parse response (handle multiple formats)
											const parseStructuredPrompt = (text) => {
												// Handle both \n and \\n line breaks
												const normalizedText = text.replace(/\\n/g, '\n');

												const parsed = {
													positive: "",
													negative: "",
													tags: [],
													classification: { content_type: "other", safety_level: "sfw", shot_type: "other" }
												};

												// Try to find key sections using regex
												const negativeMatch = normalizedText.match(/NEGATIVE:\s*(.+?)(?=\n(?:CONTENT_TYPE|SAFETY_LEVEL|SHOT_TYPE|TAGS|$))/is);
												const contentTypeMatch = normalizedText.match(/CONTENT_TYPE:\s*(.+?)(?=\n|$)/i);
												const safetyLevelMatch = normalizedText.match(/SAFETY_LEVEL:\s*(.+?)(?=\n|$)/i);
												const shotTypeMatch = normalizedText.match(/SHOT_TYPE:\s*(.+?)(?=\n|$)/i);
												const tagsMatch = normalizedText.match(/TAGS:\s*(.+?)(?=\n|$)/is);

												// Extract NEGATIVE (if found)
												if (negativeMatch) {
													parsed.negative = negativeMatch[1].trim();
												}

												// Extract POSITIVE - either with prefix or everything before NEGATIVE
												const positiveMatch = normalizedText.match(/POSITIVE:\s*(.+?)(?=\nNEGATIVE:|$)/is);
												if (positiveMatch) {
													parsed.positive = positiveMatch[1].trim();
												} else if (negativeMatch) {
													// No POSITIVE: prefix found, extract everything before NEGATIVE:
													const beforeNegative = normalizedText.split(/\nNEGATIVE:/i)[0];
													parsed.positive = beforeNegative.trim();
												} else {
													// No structure found, check if there's any text before metadata fields
													const beforeMetadata = normalizedText.split(/\n(?:CONTENT_TYPE|SAFETY_LEVEL|SHOT_TYPE|TAGS):/i)[0];
													parsed.positive = beforeMetadata.trim();
												}

												// Extract metadata
												if (contentTypeMatch) parsed.classification.content_type = contentTypeMatch[1].trim().toLowerCase();
												if (safetyLevelMatch) parsed.classification.safety_level = safetyLevelMatch[1].trim().toLowerCase();
												if (shotTypeMatch) parsed.classification.shot_type = shotTypeMatch[1].trim().toLowerCase();
												if (tagsMatch) parsed.tags = tagsMatch[1].split(',').map(t => t.trim()).filter(t => t);

												// Fallback: if still no positive, use entire text
												if (!parsed.positive && text) parsed.positive = text;

												return parsed;
											};

											if (typeof rawPrompt === 'string') {
												promptResult = parseStructuredPrompt(rawPrompt);
											} else if (rawPrompt.prompt) {
												promptResult = parseStructuredPrompt(rawPrompt.prompt);
											} else if (rawPrompt.POSITIVE) {
												promptResult = {
													positive: rawPrompt.POSITIVE || "",
													negative: rawPrompt.NEGATIVE || "",
													tags: typeof rawPrompt.TAGS === 'string' ? rawPrompt.TAGS.split(',').map(t => t.trim()).filter(t => t) : (rawPrompt.TAGS || []),
													classification: {
														content_type: (rawPrompt.CONTENT_TYPE || "other").toLowerCase(),
														safety_level: (rawPrompt.SAFETY_LEVEL || "sfw").toLowerCase(),
														shot_type: (rawPrompt.SHOT_TYPE || "other").toLowerCase()
													}
												};
											} else {
												promptResult = rawPrompt;
											}

											// 🔍 DETAILED LOGGING: Preview the response
											console.group(`[RPG] ✅ RESPONSE RECEIVED [${i + 1}/${generationCount}]`);
											console.log(`\n━━━ RAW API RESPONSE ━━━\n${typeof rawPrompt === 'string' ? rawPrompt : JSON.stringify(rawPrompt, null, 2)}\n━━━━━━━━━━━━━━━━━━━━━━`);
											console.log(`\n━━━ PARSED RESULT ━━━`);
											console.log(`POSITIVE: ${promptResult.positive?.substring(0, 200)}${promptResult.positive?.length > 200 ? '...' : ''}`);
											console.log(`NEGATIVE: ${promptResult.negative || '(none)'}`);
											console.log(`CONTENT_TYPE: ${promptResult.classification?.content_type || 'N/A'}`);
											console.log(`SAFETY_LEVEL: ${promptResult.classification?.safety_level || 'N/A'}`);
											console.log(`SHOT_TYPE: ${promptResult.classification?.shot_type || 'N/A'}`);
											console.log(`TAGS: ${promptResult.tags?.join(', ') || '(none)'}`);
											console.groupEnd();

											success = true;
										} else {
											throw new Error(result.error || "No prompts returned");
										}
									} catch (error) {
										if (error.name === 'AbortError' || cancelRequested) break;
										if (error.message.includes("Rate limited") || error.message.includes("429")) {
											retryCount++;
											if (retryCount > maxRetries) throw new Error("Max retries exceeded");
										} else {
											throw error;
										}
									}
								}

								if (cancelRequested || !success) {
									throw new Error(cancelRequested ? "Cancelled" : "Failed after retries");
								}

								// Save to database with badges
								const savedPrompt = await addGeneratedPrompt({
									positive: promptResult.positive,
									negative: promptResult.negative,
									tags: promptResult.tags || [],
									classification: promptResult.classification || { content_type: "other", safety_level: "sfw", shot_type: "other" },
									model_badge: currentModelBadge,
									theme_badge: currentThemeBadge
								});

								console.log(`[RPG] ✅ [${i + 1}] Saved with ID: ${savedPrompt.id}`);

								// Update UI - success
								const preview = promptResult.positive?.slice(0, 80) || "No content";
								const message = preview + (promptResult.positive?.length > 80 ? "..." : "");
								updateProgressState(i, { status: 'success', progress: 100, message });

								return { status: 'success', index: i, prompt: promptResult };

							} catch (error) {
								console.error(`[RPG] ❌ [${i + 1}] Error:`, error.message);

								// Update UI - error
								const status = error.message.includes("Cancelled") ? 'cancelled' : 'error';
								updateProgressState(i, { status, progress: 0, message: error.message || "Generation failed" });

								return { status: 'error', index: i, error };
							}
						};

						// Launch all prompts in parallel with 222ms stagger
						console.log(`[RPG] 🚀 Launching ${generationCount} parallel requests (222ms stagger)...`);
						const promises = [];
						for (let i = 0; i < generationCount; i++) {
							if (i > 0) {
								await new Promise(resolve => setTimeout(resolve, 222));
							}
							promises.push(generateSinglePrompt(i));
						}

						// Wait for all to complete
						const results = await Promise.allSettled(promises);
						const successResults = results.filter(r => r.status === 'fulfilled' && r.value.status === 'success');
						successResults.forEach(r => {
							const promptData = r.value.prompt;
							// For img2img: attach image index and repeat count
							if (isImg2Img && uniqueImages[r.value.index]) {
								promptData._imageIndex = r.value.index;
								promptData._repeatCount = uniqueImages[r.value.index].repeat_count || 1;
							}
							allGeneratedPrompts.push(promptData);
						});

						console.log(`[RPG] ✅ Parallel generation complete: ${successResults.length}/${generationCount} succeeded`);


						// Show results
						if (allGeneratedPrompts.length > 0) {
							console.log(`[RPG] ✅ Generated ${allGeneratedPrompts.length}/${generationCount} prompts successfully`);

							// Store generated prompts and update state FIRST (regardless of which tab is active)
							node._generatedUnifiedPrompts = allGeneratedPrompts;
							node._generationInProgress = false; // Mark as complete
							// Keep node._progressState so we can recreate progress items when switching back
							console.log(`[RPG] State updated: ${allGeneratedPrompts.length} prompts stored, keeping progress state for restore`);

							// Query for FRESH DOM elements (in case user switched tabs during generation)
							const currentProgressSection = container.querySelector(".instaraw-rpg-generation-progress");
							const currentPreviewSection = container.querySelector(".instaraw-rpg-generate-preview");
							const currentPreviewList = container.querySelector(".instaraw-rpg-generate-preview-list");

							console.log(`[RPG] Found elements - progress: ${!!currentProgressSection}, preview: ${!!currentPreviewSection}, list: ${!!currentPreviewList}`);

							// Update UI elements if they exist (only if on Generate tab)
							const progressHeader = currentProgressSection?.querySelector(".instaraw-rpg-progress-header h4");
							if (progressHeader) {
								const successCount = allGeneratedPrompts.length;
								const failedCount = generationCount - successCount;
								progressHeader.innerHTML = `
									✓ Generation Complete:
									<span style="color: #22c55e">${successCount} succeeded</span>
									${failedCount > 0 ? `<span style="color: #ef4444">, ${failedCount} failed</span>` : ''}
								`;
							}

							// Hide cancel button and show quick accept button
							const cancelBtn = currentProgressSection?.querySelector(".instaraw-rpg-cancel-generation-btn");
							if (cancelBtn) cancelBtn.style.display = "none";
							const quickAccept = currentProgressSection?.querySelector(".instaraw-rpg-quick-accept");
							if (quickAccept) quickAccept.style.display = "block";

							// Update preview list if it exists
							if (currentPreviewList) {
								// Helper to render image thumbnails for preview
								const renderPreviewImages = (index) => {
									if (!isImg2Img) return '';
									// Helper to get image URL (handles both url and thumbnail formats)
									const getImgUrl = (img) => img?.url || (img?.thumbnail ? `/instaraw/view/${img.thumbnail}` : null);
									const images = [
										{ img: uniqueImages[index], label: "1" },
										{ img: uniqueImages2[index], label: "2" },
										{ img: uniqueImages3[index], label: "3" },
										{ img: uniqueImages4[index], label: "4" }
									].filter(item => item.img && getImgUrl(item.img));
									if (images.length === 0) return '';
									return `
										<div class="instaraw-rpg-preview-images">
											${images.map(item => `
												<div class="instaraw-combo-slot">
													<div class="instaraw-combo-slot-image">
														<img src="${getImgUrl(item.img)}" alt="Image ${item.label}" loading="lazy" style="background: rgba(0,0,0,0.3);" onerror="this.style.opacity='0.3'; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath fill=%22%239ca3af%22 d=%22M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z%22/%3E%3C/svg%3E';" />
													</div>
												</div>
											`).join('')}
										</div>
									`;
								};

								currentPreviewList.innerHTML = allGeneratedPrompts
									.map((p, idx) => `
										<div class="instaraw-rpg-preview-item">
											<div class="instaraw-rpg-preview-item-header">
												<strong>#${idx + 1}</strong>
												${renderPreviewImages(idx)}
											</div>
											<p>${escapeHtml(p.positive || "")}</p>
										</div>
									`)
									.join("");

								// Show preview section (keep progress visible for stats)
								if (currentPreviewSection) currentPreviewSection.style.display = "block";
								console.log(`[RPG] Preview UI updated (on Generate tab)`);
							} else {
								console.log(`[RPG] Preview UI skipped (on different tab - will restore on tab switch)`);
							}

							setupEventHandlers();

							// Keep progress section visible until user clicks "Add to Batch"
							// This prevents layout shift and lets users review stats
						} else if (cancelRequested) {
							console.log("[RPG] ⏹ Generation cancelled - no prompts generated");

							// Update progress header
							const progressHeader = progressSection?.querySelector(".instaraw-rpg-progress-header h4");
							if (progressHeader) {
								progressHeader.innerHTML = '<span style="color: #fbbf24">⏹ Generation Cancelled</span>';
							}

							// Hide cancel button
							const cancelBtn = progressSection?.querySelector(".instaraw-rpg-cancel-generation-btn");
							if (cancelBtn) cancelBtn.style.display = "none";

							// Keep progress section visible to show cancellation status
						} else {
							throw new Error("No prompts were generated successfully");
						}

					} catch (error) {
						console.error("[RPG] ❌ Error during parallel prompt generation:", error);
						console.error("[RPG] Error stack:", error.stack);

						// Clear generation state (but keep progress state for viewing errors)
						node._generationInProgress = false;
						// Keep progressState to show error details when switching tabs
						// delete node._progressState;
						// delete node._generationCount;

						// Hide progress section, show error
						const currentProgressSection = container.querySelector(".instaraw-rpg-generation-progress");
						if (currentProgressSection) currentProgressSection.style.display = "none";
						alert(`Generation error: ${error.message || error}`);

					} finally {
						// Re-enable generate button
						if (generateBtn) {
							generateBtn.disabled = false;
							generateBtn.style.opacity = "1";
							const detectedMode = node._linkedAILMode || "txt2img";
							const emoji = detectedMode === 'img2img' ? '🖼️' : '🎨';
							generateBtn.textContent = `${emoji} Generate Prompts`;
						}

						// Clear abort controller
						generationAbortController = null;

						console.log("[RPG] Generate Unified Prompts - END (Sequential)");
						console.groupEnd();
					}
				};

				// === Update Progress State (updates both DOM and node state) ===
				const updateProgressState = (index, updates) => {
					if (!node._progressState || !node._progressState[index]) return;

					// Update node state
					Object.assign(node._progressState[index], updates);

					// Update DOM if elements exist
					const progressItems = container.querySelector(".instaraw-rpg-progress-items");
					const progressItem = progressItems?.querySelector(`[data-index="${index}"]`);
					if (!progressItem) return;

					const statusBadge = progressItem.querySelector(".instaraw-rpg-progress-item-status");
					const progressBar = progressItem.querySelector(".instaraw-rpg-progress-item-fill");
					const messageDiv = progressItem.querySelector(".instaraw-rpg-progress-item-message");

					// Update status
					if (updates.status) {
						const statusMap = {
							'pending': { class: 'pending', text: '⏳ Pending' },
							'in-progress': { class: 'in-progress', text: '⏳ Generating...' },
							'success': { class: 'success', text: '✓ Complete' },
							'error': { class: 'error', text: '✖ Failed' },
							'cancelled': { class: 'error', text: '⏹ Cancelled' }
						};
						const statusInfo = statusMap[updates.status];
						if (statusBadge && statusInfo) {
							statusBadge.className = `instaraw-rpg-progress-item-status ${statusInfo.class}`;
							statusBadge.textContent = statusInfo.text;
						}
						if (statusInfo) {
							progressItem.classList.remove('pending', 'in-progress', 'success', 'error');
							progressItem.classList.add(statusInfo.class);
						}
					}

					// Update progress bar
					if (updates.progress !== undefined && progressBar) {
						progressBar.style.width = `${updates.progress}%`;
						if (updates.status === 'in-progress') {
							progressBar.classList.add('animating');
						} else {
							progressBar.classList.remove('animating');
						}
					}

					// Update message
					if (updates.message !== undefined && messageDiv) {
						messageDiv.textContent = updates.message;
						messageDiv.className = 'instaraw-rpg-progress-item-message';
					}
				};

				// === Restore Generation UI (after tab switch) ===
				const restoreGenerationUI = () => {
					const progressSection = container.querySelector(".instaraw-rpg-generation-progress");
					const previewSection = container.querySelector(".instaraw-rpg-generate-preview");
					const progressItems = container.querySelector(".instaraw-rpg-progress-items");

					console.log(`[RPG] restoreGenerationUI called - inProgress: ${node._generationInProgress}, hasCompleted: ${!!node._generatedUnifiedPrompts}, hasState: ${!!node._progressState}`);

					// If generation completed, restore the preview
					if (node._generatedUnifiedPrompts) {
						console.log(`[RPG] Restoring completed generation with ${node._generatedUnifiedPrompts.length} prompts`);

						// Restore progress items if we have the state
						if (node._progressState && progressItems) {
							progressItems.innerHTML = "";
							const generationCount = node._generationCount || node._progressState.length;

							node._progressState.forEach((state, i) => {
								const progressItem = document.createElement("div");
								progressItem.className = `instaraw-rpg-progress-item ${state.status}`;
								progressItem.dataset.index = i;

								const statusMap = {
									'pending': '⏳ Pending',
									'in-progress': '⏳ Generating...',
									'success': '✓ Complete',
									'error': '✖ Failed',
									'cancelled': '⏹ Cancelled'
								};

								progressItem.innerHTML = `
									<div class="instaraw-rpg-progress-item-header">
										<span class="instaraw-rpg-progress-item-label">Prompt ${i + 1}/${generationCount}</span>
										<span class="instaraw-rpg-progress-item-status ${state.status}">${statusMap[state.status] || '⏳ Pending'}</span>
									</div>
									<div class="instaraw-rpg-progress-item-bar">
										<div class="instaraw-rpg-progress-item-fill" style="width: ${state.progress}%"></div>
									</div>
									<div class="instaraw-rpg-progress-item-message">${state.message || ''}</div>
								`;
								progressItems.appendChild(progressItem);
							});
							console.log(`[RPG] Restored ${node._progressState.length} completed progress items`);
						}

						// Update progress header with completion statistics
						const progressHeader = progressSection?.querySelector(".instaraw-rpg-progress-header h4");
						if (progressHeader) {
							const successCount = node._generatedUnifiedPrompts.length;
							progressHeader.innerHTML = `
								✓ Generation Complete:
								<span style="color: #22c55e">${successCount} succeeded</span>
							`;
						}

						// Hide cancel button and show quick accept button
						const cancelBtn = progressSection?.querySelector(".instaraw-rpg-cancel-generation-btn");
						if (cancelBtn) cancelBtn.style.display = "none";
						const quickAccept = progressSection?.querySelector(".instaraw-rpg-quick-accept");
						if (quickAccept) quickAccept.style.display = "block";

						// Populate preview list and show preview section
						const previewList = container.querySelector(".instaraw-rpg-generate-preview-list");
						console.log(`[RPG] Preview list element found: ${!!previewList}`);
						if (previewList) {
							previewList.innerHTML = node._generatedUnifiedPrompts
								.map((p, idx) => `
									<div class="instaraw-rpg-preview-item">
										<strong>#${idx + 1}</strong>
										<p>${escapeHtml(p.positive || "")}</p>
									</div>
								`)
								.join("");
							console.log(`[RPG] Preview list populated with ${node._generatedUnifiedPrompts.length} items`);
						} else {
							console.error(`[RPG] Preview list element not found!`);
						}

						// Show preview section (contains list + buttons)
						if (previewSection) previewSection.style.display = "block";

						return; // Exit early after handling completed generation
					}

					// Restore in-progress generation
					if (node._generationInProgress && node._progressState) {
						console.log(`[RPG] Restoring in-progress generation with ${node._progressState.length} items`);

						// Recreate progress items from state
						if (progressItems) {
							progressItems.innerHTML = "";
							const generationCount = node._generationCount || node._progressState.length;

							node._progressState.forEach((state, i) => {
								const progressItem = document.createElement("div");
								progressItem.className = `instaraw-rpg-progress-item ${state.status}`;
								progressItem.dataset.index = i;

								const statusMap = {
									'pending': '⏳ Pending',
									'in-progress': '⏳ Generating...',
									'success': '✓ Complete',
									'error': '✖ Failed',
									'cancelled': '⏹ Cancelled'
								};

								progressItem.innerHTML = `
									<div class="instaraw-rpg-progress-item-header">
										<span class="instaraw-rpg-progress-item-label">Prompt ${i + 1}/${generationCount}</span>
										<span class="instaraw-rpg-progress-item-status ${state.status}">${statusMap[state.status] || '⏳ Pending'}</span>
									</div>
									<div class="instaraw-rpg-progress-item-bar">
										<div class="instaraw-rpg-progress-item-fill ${state.status === 'in-progress' ? 'animating' : ''}" style="width: ${state.progress}%"></div>
									</div>
									<div class="instaraw-rpg-progress-item-message">${state.message || ''}</div>
								`;
								progressItems.appendChild(progressItem);
							});
						}

						const progressHeader = progressSection?.querySelector(".instaraw-rpg-progress-header h4");
						if (progressHeader) {
							progressHeader.innerHTML = `⏳ Generating Prompts...`;
						}
					} else if (node._generationInProgress) {
						// Generation still in progress but no state - show message
						console.log(`[RPG] Generation in progress but no state to restore`);
						const progressHeader = progressSection?.querySelector(".instaraw-rpg-progress-header h4");
						if (progressHeader) {
							progressHeader.innerHTML = `⏳ Generation in progress...`;
						}
					}
				};

				// === Accept Generated Prompts ===
				const acceptGeneratedPrompts = () => {
					if (!node._generatedUnifiedPrompts) return;

					const existingQueue = parsePromptBatch();
					const newCount = node._generatedUnifiedPrompts.length;

					// If there are existing prompts, ask the user to confirm
					if (existingQueue.length > 0) {
						const confirmAdd = confirm(
							`You have ${existingQueue.length} existing prompt(s) in the batch.\n\n` +
							`Add ${newCount} new prompt(s) to the batch?\n\n` +
							`OK = Add to existing\n` +
							`Cancel = Don't add (clear batch first if needed)`
						);

						if (!confirmAdd) {
							console.log("[RPG] User cancelled adding prompts to batch");
							return;
						}
					}

					const promptQueue = existingQueue;
					node._generatedUnifiedPrompts.forEach((p) => {
						// For img2img: use stored repeat count, otherwise default to 1
						const repeatCount = p._repeatCount || 1;

						promptQueue.push({
							id: generateUniqueId(),
							positive_prompt: p.positive || "",
							negative_prompt: p.negative || "",
							repeat_count: repeatCount,
							tags: p.tags || [],
							source_id: null,
							// Store image index for img2img (for reference)
							_imageIndex: p._imageIndex,
						});

						console.log(`[RPG] Added prompt to batch with repeat count: ${repeatCount}${p._imageIndex !== undefined ? ` (image #${p._imageIndex + 1})` : ''}`);
					});

					setPromptBatchData(promptQueue);
					delete node._generatedUnifiedPrompts;
					delete node._warnedAboutPendingPrompts; // Reset warning flag
					node._generationInProgress = false;
					delete node._progressState;
					delete node._generationCount;

					// Hide all generation UI now that prompts are accepted
					const progressSection = container.querySelector(".instaraw-rpg-generation-progress");
					const previewSection = container.querySelector(".instaraw-rpg-generate-preview");
					if (progressSection) progressSection.style.display = "none";
					if (previewSection) previewSection.style.display = "none";

					renderUI();
				};

				// === Cancel Generated Prompts ===
				const cancelGeneratedPrompts = () => {
					delete node._generatedUnifiedPrompts;
					delete node._warnedAboutPendingPrompts; // Reset warning flag
					node._generationInProgress = false;
					delete node._progressState;
					delete node._generationCount;

					// Hide all generation UI when cancelling
					const progressSection = container.querySelector(".instaraw-rpg-generation-progress");
					const previewSection = container.querySelector(".instaraw-rpg-generate-preview");
					if (progressSection) progressSection.style.display = "none";
					if (previewSection) previewSection.style.display = "none";

					renderUI();
				};

				// === Event Handlers Setup (Following AIL Pattern) ===
				const setupEventHandlers = () => {
					console.log("[RPG] ============ setupEventHandlers CALLED ============");
					console.log("[RPG] Current active tab:", node.properties.active_tab);

					// === Canvas Panning Event Forwarding ===
					// Forward mouse events to ComfyUI canvas when clicking on non-interactive areas
					const isInteractiveElement = (element) => {
						if (!element) return false;

						// Check if it's a standard interactive element
						const tagName = element.tagName?.toLowerCase();
						if (['button', 'input', 'select', 'textarea', 'a'].includes(tagName)) {
							return true;
						}

						// Check if it has interactive classes or attributes
						const className = element.className || '';
						if (typeof className === 'string' && (
							className.includes('-btn') ||
							className.includes('-input') ||
							className.includes('-select') ||
							className.includes('-slider') ||
							className.includes('-textarea') ||
							className.includes('prompt-card')
						)) {
							return true;
						}

						// Check if draggable
						if (element.draggable) {
							return true;
						}

						return false;
					};

					// Check element and all parents up to container
					const isInteractiveOrChildOfInteractive = (target) => {
						let element = target;
						while (element && element !== container) {
							if (isInteractiveElement(element)) {
								return true;
							}
							element = element.parentElement;
						}
						return false;
					};

					// Track drag state for manual panning
					let isDragging = false;
					let dragStartX = 0;
					let dragStartY = 0;
					let graphOffsetStartX = 0;
					let graphOffsetStartY = 0;

					// Manual canvas panning (direct LiteGraph manipulation)
					const canvasForwardHandler = (e) => {
						// Skip if this is a synthetic event
						if (e._rpgForwarded) {
							return;
						}

						// For mousedown, check if it's interactive
						if (e.type === 'mousedown') {
							const isInteractive = isInteractiveOrChildOfInteractive(e.target);

							if (isInteractive) {
								isDragging = false;
								return;
							}

							// Start manual drag
							isDragging = true;
							dragStartX = e.clientX;
							dragStartY = e.clientY;

							// Get LiteGraph canvas and store initial offset
							const canvas = app?.canvas || app?.graph?.list_of_graphcanvas?.[0];
							if (canvas) {
								graphOffsetStartX = canvas.ds.offset[0];
								graphOffsetStartY = canvas.ds.offset[1];
								console.log("[RPG Manual Pan] 🎬 Started - Initial offset:", graphOffsetStartX, graphOffsetStartY);
							}

							e.preventDefault();
							e.stopPropagation();
						}

						// Handle mousemove for panning
						if (e.type === 'mousemove' && isDragging) {
							const deltaX = e.clientX - dragStartX;
							const deltaY = e.clientY - dragStartY;

							// Get LiteGraph canvas and update offset
							// Divide by scale to match native ComfyUI drag behavior at any zoom level
							const canvas = app?.canvas || app?.graph?.list_of_graphcanvas?.[0];
							if (canvas) {
								const scale = canvas.ds.scale || 1;
								canvas.ds.offset[0] = graphOffsetStartX + (deltaX / scale);
								canvas.ds.offset[1] = graphOffsetStartY + (deltaY / scale);
								canvas.setDirty(true, true);
							}

							e.preventDefault();
							e.stopPropagation();
						}

						// Handle mouseup to end drag
						if (e.type === 'mouseup' && isDragging) {
							isDragging = false;
							console.log("[RPG Manual Pan] 🏁 Ended drag");
							e.preventDefault();
							e.stopPropagation();
						}
					};

					// Forward wheel events for zooming
					const wheelForwardHandler = (e) => {
						// Skip if synthetic
						if (e._rpgForwarded) {
							return;
						}

						// Check if over non-interactive area
						const isInteractive = isInteractiveOrChildOfInteractive(e.target);
						if (isInteractive) {
							return;
						}

						// Find the ComfyUI canvas
						const canvas = document.querySelector('#graph-canvas') ||
									  document.querySelector('canvas.litegraph') ||
									  document.querySelector('.litegraph canvas');

						if (canvas) {
							console.log("[RPG Canvas Forward] 🔍 Forwarding wheel event for zoom");

							e.preventDefault();
							e.stopPropagation();

							// Create and dispatch wheel event
							const newEvent = new WheelEvent('wheel', {
								bubbles: true,
								cancelable: true,
								view: window,
								clientX: e.clientX,
								clientY: e.clientY,
								screenX: e.screenX,
								screenY: e.screenY,
								deltaX: e.deltaX,
								deltaY: e.deltaY,
								deltaZ: e.deltaZ,
								deltaMode: e.deltaMode,
								ctrlKey: e.ctrlKey,
								shiftKey: e.shiftKey,
								altKey: e.altKey,
								metaKey: e.metaKey
							});

							newEvent._rpgForwarded = true;
							canvas.dispatchEvent(newEvent);
						}
					};

					// Remove old listeners if exist (prevent duplicates)
					if (container._canvasForwardHandler) {
						container.removeEventListener('mousedown', container._canvasForwardHandler, true);
						document.removeEventListener('mousemove', container._canvasForwardHandler, true);
						document.removeEventListener('mouseup', container._canvasForwardHandler, true);
					}
					if (container._wheelForwardHandler) {
						container.removeEventListener('wheel', container._wheelForwardHandler, true);
					}

					container._canvasForwardHandler = canvasForwardHandler;
					container._wheelForwardHandler = wheelForwardHandler;

					// Listen on container for mousedown, but document for mousemove/mouseup (to track outside container)
					container.addEventListener('mousedown', canvasForwardHandler, true);
					document.addEventListener('mousemove', canvasForwardHandler, true);
					document.addEventListener('mouseup', canvasForwardHandler, true);

					// Listen for wheel events for zooming
					container.addEventListener('wheel', wheelForwardHandler, true);

					// Tab switching
					container.querySelectorAll(".instaraw-rpg-tab").forEach((tab) => {
						tab.onclick = () => {
							node.properties.active_tab = tab.dataset.tab;
							renderUI();
						};
					});

					// Mode dropdown
					const modeDropdown = container.querySelector(".instaraw-rpg-mode-dropdown");
					if (modeDropdown) {
						modeDropdown.onchange = (e) => {
							const modeWidget = node.widgets?.find((w) => w.name === "mode");
							if (modeWidget) {
								modeWidget.value = e.target.value;
								renderUI();
							}
						};
					}

					// Creative model settings
					const creativeModelSelect = container.querySelector(".instaraw-rpg-model-select");
					if (creativeModelSelect) {
						creativeModelSelect.onchange = (e) => {
							node.properties.creative_model = e.target.value;
							const widget = node.widgets?.find((w) => w.name === "creative_model");
							if (widget) widget.value = e.target.value;
							renderUI();
						};
					}

					const creativeTempInput = container.querySelector(".instaraw-rpg-model-temp");
					if (creativeTempInput) {
						creativeTempInput.onchange = (e) => {
							const val = parseFloat(e.target.value) || 0.9;
							node.properties.creative_temperature = val;
							app.graph.setDirtyCanvas(true, true);
						};
					}

					const creativeTopPInput = container.querySelector(".instaraw-rpg-model-top-p");
					if (creativeTopPInput) {
						creativeTopPInput.onchange = (e) => {
							const val = parseFloat(e.target.value) || 0.9;
							node.properties.creative_top_p = val;
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// System prompt textarea (for Generate tab)
					const systemPromptInput = container.querySelector(".instaraw-rpg-system-prompt");
					if (systemPromptInput) {
						// Auto-resize on load
						autoResizeTextarea(systemPromptInput);

						systemPromptInput.oninput = (e) => {
							node.properties.creative_system_prompt = e.target.value;
							saveSettings();
							autoResizeTextarea(e.target);
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Character system prompt textarea (for Character tab)
					const characterSystemPromptInput = container.querySelector(".instaraw-rpg-character-system-prompt");
					if (characterSystemPromptInput) {
						// Auto-resize on load
						autoResizeTextarea(characterSystemPromptInput);

						characterSystemPromptInput.oninput = (e) => {
							node.properties.character_system_prompt = e.target.value;
							saveSettings();
							autoResizeTextarea(e.target);
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Handle details toggle (re-calculate textarea height when opened)
					container.querySelectorAll(".instaraw-rpg-advanced-settings").forEach((details) => {
						details.addEventListener('toggle', () => {
							if (details.open) {
								const textarea = details.querySelector('textarea');
								if (textarea) {
									setTimeout(() => autoResizeTextarea(textarea), 10);
								}
							}
						});
					});

					// Reload database button
					const reloadDBBtn = container.querySelector(".instaraw-rpg-reload-db-btn");
					if (reloadDBBtn) {
						reloadDBBtn.onclick = () => loadPromptsDatabase();
					}

					// Library search
					const searchInput = container.querySelector(".instaraw-rpg-search-input");
					if (searchInput) {
						searchInput.oninput = (e) => {
							clearTimeout(node._searchTimeout);
							node._searchTimeout = setTimeout(() => {
								updateFilter("search_query", e.target.value);
							}, 300);
						};
					}

					// Library filters
					container.querySelectorAll(".instaraw-rpg-filter-dropdown").forEach((dropdown) => {
						dropdown.onchange = (e) => {
							updateFilter(dropdown.dataset.filter, e.target.value);
						};
					});

					// Show bookmarked checkbox
					const showBookmarkedCheckbox = container.querySelector(".instaraw-rpg-show-bookmarked-checkbox");
					if (showBookmarkedCheckbox) {
						showBookmarkedCheckbox.onchange = (e) => {
							updateFilter("show_bookmarked", e.target.checked);
						};
					}

					// SDXL mode checkbox
					const sdxlModeCheckbox = container.querySelector(".instaraw-rpg-sdxl-mode-checkbox");
					if (sdxlModeCheckbox) {
						sdxlModeCheckbox.onchange = (e) => {
							updateFilter("sdxl_mode", e.target.checked);
						};
					}

					// Clear filters
					const clearFiltersBtn = container.querySelector(".instaraw-rpg-clear-filters-btn");
					if (clearFiltersBtn) {
						clearFiltersBtn.onclick = clearFilters;
					}

					// Random count input - save value
					const randomCountInput = container.querySelector(".instaraw-rpg-random-count-input");
					if (randomCountInput) {
						randomCountInput.onchange = (e) => {
							randomCount = parseInt(e.target.value) || 6;
						};
					}

					// Show random prompts button
					const showRandomBtn = container.querySelector(".instaraw-rpg-show-random-btn");
					if (showRandomBtn) {
						showRandomBtn.onclick = async () => {
							const count = parseInt(randomCountInput?.value) || randomCount;
							const filters = JSON.parse(node.properties.library_filters || "{}");

							// Disable button and show loading state
							showRandomBtn.disabled = true;
							const originalText = showRandomBtn.innerHTML;
							showRandomBtn.innerHTML = '⏳ Selecting...';

							try {
								// OPTIMIZATION: Do random selection on frontend since we already have the database loaded!
								// No need to make API call and re-download/re-filter the database

								// Apply filters using existing filterPrompts function
								const filteredPrompts = filterPrompts(promptsDatabase, filters);

								if (filteredPrompts.length === 0) {
									throw new Error("No prompts match the current filters");
								}

								// Randomly select prompts
								const selectedCount = Math.min(count, filteredPrompts.length);
								const shuffled = [...filteredPrompts].sort(() => Math.random() - 0.5);
								const selected = shuffled.slice(0, selectedCount);

								// Store and display random prompts
								randomPrompts = selected;
								randomCount = count;
								showingRandomPrompts = true;
								currentPage = 0; // Reset pagination
								renderUI();
								console.log(`[RPG] Showing ${selected.length} random prompts (from ${filteredPrompts.length} filtered)`);

							} catch (error) {
								console.error("[RPG] Error selecting random prompts:", error);
								showRandomBtn.innerHTML = `✖ ${error.message}`;
								setTimeout(() => {
									showRandomBtn.innerHTML = originalText;
									showRandomBtn.disabled = false;
								}, 3000);
							}
						};
					}

					// Add all random prompts to batch
					const addAllRandomBtn = container.querySelector(".instaraw-rpg-add-all-random-btn");
					if (addAllRandomBtn) {
						addAllRandomBtn.onclick = () => {
							const existingQueue = parsePromptBatch();
							const newCount = randomPrompts.length;

							// If there are existing prompts, ask the user to confirm
							if (existingQueue.length > 0) {
								const confirmAdd = confirm(
									`You have ${existingQueue.length} existing prompt(s) in the batch.\n\n` +
									`Add ${newCount} random prompt(s) to the batch?\n\n` +
									`OK = Add to existing\n` +
									`Cancel = Don't add (clear batch first if needed)`
								);

								if (!confirmAdd) {
									console.log("[RPG] User cancelled adding random prompts to batch");
									return;
								}
							}

							const promptQueue = existingQueue;
							randomPrompts.forEach(promptData => {
								const positivePrompt = promptData.prompt?.positive ?? promptData.positive ?? "";
								const negativePrompt = promptData.prompt?.negative ?? promptData.negative ?? "";
								promptQueue.push({
									id: generateUniqueId(),
									positive_prompt: positivePrompt,
									negative_prompt: negativePrompt,
									repeat_count: 1,
									tags: promptData.tags || [],
									source_id: promptData.id || null,
									seed: 1111111,
									seed_control: "randomize",
								});
							});

							setPromptBatchData(promptQueue);
							console.log(`[RPG] Added ${newCount} random prompts to batch`);

							// Exit random mode
							showingRandomPrompts = false;
							randomPrompts = [];
							renderUI();
						};
					}

					// Reroll random prompts button
					const rerollRandomBtn = container.querySelector(".instaraw-rpg-reroll-random-btn");
					if (rerollRandomBtn) {
						rerollRandomBtn.onclick = () => {
							const count = randomCount; // Use same count as before
							const filters = JSON.parse(node.properties.library_filters || "{}");

							// Apply filters and randomly select
							const filteredPrompts = filterPrompts(promptsDatabase, filters);

							if (filteredPrompts.length === 0) {
								alert("No prompts match the current filters");
								return;
							}

							// Randomly select prompts (different from before)
							const selectedCount = Math.min(count, filteredPrompts.length);
							const shuffled = [...filteredPrompts].sort(() => Math.random() - 0.5);
							const selected = shuffled.slice(0, selectedCount);

							// Update and re-render
							randomPrompts = selected;
							renderUI();
							console.log(`[RPG] Rerolled ${selected.length} random prompts`);
						};
					}

					// Exit random mode button
					const exitRandomBtn = container.querySelector(".instaraw-rpg-exit-random-btn");
					if (exitRandomBtn) {
						exitRandomBtn.onclick = () => {
							showingRandomPrompts = false;
							randomPrompts = [];
							renderUI();
						};
					}

					// Create custom prompt button
					const createPromptBtn = container.querySelector(".instaraw-rpg-create-prompt-btn");
					if (createPromptBtn) {
						createPromptBtn.onclick = async () => {
							try {
								// Create empty prompt and add to user prompts
								const newPrompt = await addUserPrompt({
									positive: "",
									negative: "",
									tags: [],
									content_type: "person",
									safety_level: "sfw",
									shot_type: "portrait"
								});

								// Reset filters to show user prompts and clear search
								node.properties.library_filters = JSON.stringify({
									prompt_source: "user",
									search_query: "",
									content_type: "any",
									safety_level: "any",
									shot_type: "any",
									show_bookmarked: false
								});
								currentPage = 0; // Go to first page

								// Immediately put it in edit mode
								editingValues[newPrompt.id] = {
									positive: "",
									negative: "",
									tags: "",
									content_type: "person",
									safety_level: "sfw",
									shot_type: "portrait"
								};
								editingPrompts.add(newPrompt.id);
								renderUI();
								console.log("[RPG] Created new user prompt in edit mode, switched to My Prompts view");
							} catch (error) {
								console.error("[RPG] Error creating user prompt:", error);
								alert(`Error creating prompt: ${error.message}`);
							}
						};
					}

					// Import prompts button
					const importPromptsBtn = container.querySelector(".instaraw-rpg-import-prompts-btn");
					if (importPromptsBtn) {
						importPromptsBtn.onclick = () => {
							const input = document.createElement("input");
							input.type = "file";
							input.accept = ".json";
							input.onchange = async (e) => {
								const file = e.target.files[0];
								if (!file) return;

								try {
									const result = await importUserPrompts(file);
									alert(`Successfully imported ${result.details.user} user prompts, ${result.details.batch} batch items, ${result.details.bookmarks} bookmarks${result.skipped > 0 ? ` (${result.skipped} duplicates skipped)` : ''}`);
								} catch (error) {
									console.error("[RPG] Error importing prompts:", error);
									alert(`Error importing prompts: ${error.message}`);
								}
							};
							input.click();
						};
					}

					// Export prompts button
					const exportPromptsBtn = container.querySelector(".instaraw-rpg-export-prompts-btn");
					if (exportPromptsBtn) {
						exportPromptsBtn.onclick = () => {
							const promptBatch = parsePromptBatch();

							const totalToExport = userPrompts.length + bookmarksCache.length + promptBatch.length;

							if (totalToExport === 0) {
								alert("Nothing to export. Add user prompts, favorite some library prompts, or add prompts to batch first.");
								return;
							}

							exportUserPrompts();
						};
					}

					// Enter selection mode button
					const enterSelectionBtn = container.querySelector(".instaraw-rpg-enter-selection-btn");
					if (enterSelectionBtn) {
						enterSelectionBtn.onclick = () => {
							selectionMode = true;
							selectedPrompts.clear();
							renderUI();
							console.log("[RPG] Entered selection mode");
						};
					}

					// Cancel selection mode button
					const cancelSelectionBtn = container.querySelector(".instaraw-rpg-cancel-selection-btn");
					if (cancelSelectionBtn) {
						cancelSelectionBtn.onclick = () => {
							selectionMode = false;
							selectedPrompts.clear();
							renderUI();
							console.log("[RPG] Exited selection mode");
						};
					}

					// Select all button
					const selectAllBtn = container.querySelector(".instaraw-rpg-select-all-btn");
					if (selectAllBtn) {
						selectAllBtn.onclick = () => {
							// Add all prompts currently visible (recompute to ensure we have current state)
							const currentFilters = JSON.parse(node.properties.library_filters || "{}");
							const currentPrompts = showingRandomPrompts ? randomPrompts : filterPrompts(promptsDatabase, currentFilters);
							const page = node.properties.current_page || 0;
							const pagePrompts = currentPrompts.slice(page * itemsPerPage, (page + 1) * itemsPerPage);

							pagePrompts.forEach(prompt => {
								// Only allow selecting user prompts and generated prompts (not library prompts)
								if (prompt.is_user_created || prompt.is_ai_generated) {
									selectedPrompts.add(prompt.id);
								}
							});
							renderUI();
							console.log(`[RPG] Select All clicked: ${selectedPrompts.size} total selected`);
						};
					}

					// Deselect all button
					const deselectAllBtn = container.querySelector(".instaraw-rpg-deselect-all-btn");
					if (deselectAllBtn) {
						deselectAllBtn.onclick = () => {
							console.log(`[RPG] Deselect All clicked: clearing ${selectedPrompts.size} selections`);
							selectedPrompts.clear();
							renderUI();
						};
					}

					// Delete selected button
					const deleteSelectedBtn = container.querySelector(".instaraw-rpg-delete-selected-btn");
					if (deleteSelectedBtn) {
						deleteSelectedBtn.onclick = async () => {
							if (selectedPrompts.size === 0) return;

							const confirmMsg = `Delete ${selectedPrompts.size} selected prompt${selectedPrompts.size === 1 ? '' : 's'}?\n\nThis cannot be undone.`;
							if (!confirm(confirmMsg)) return;

							try {
								// Separate into user prompts and generated prompts
								const selectedIds = Array.from(selectedPrompts);
								let deletedCount = 0;

								for (const promptId of selectedIds) {
									// Try to delete as user prompt first
									const userPrompt = userPrompts.find(p => p.id === promptId);
									if (userPrompt) {
										await deleteUserPrompt(promptId);
										deletedCount++;
										continue;
									}

									// Try to delete as generated prompt
									const genPrompt = generatedPrompts.find(p => p.id === promptId);
									if (genPrompt) {
										await deleteGeneratedPrompt(promptId);
										deletedCount++;
									}
								}

								console.log(`[RPG] Deleted ${deletedCount} prompts`);

								// Exit selection mode
								selectionMode = false;
								selectedPrompts.clear();
								renderUI();

								alert(`Successfully deleted ${deletedCount} prompt${deletedCount === 1 ? '' : 's'}`);
							} catch (error) {
								console.error("[RPG] Error deleting selected prompts:", error);
								alert(`Error deleting prompts: ${error.message}`);
							}
						};
					}

					// Prompt checkbox handlers
					container.querySelectorAll(".instaraw-rpg-prompt-checkbox").forEach((checkbox) => {
						checkbox.onchange = (e) => {
							e.stopPropagation();
							const promptId = checkbox.dataset.id;

							if (checkbox.checked) {
								selectedPrompts.add(promptId);
							} else {
								selectedPrompts.delete(promptId);
							}

							renderUI();
							console.log(`[RPG] ${checkbox.checked ? 'Selected' : 'Deselected'} prompt ${promptId}. Total selected: ${selectedPrompts.size}`);
						};
					});

					// Card click handler for selection mode - click anywhere on card to toggle
					container.querySelectorAll(".instaraw-rpg-library-card.selection-mode").forEach((card) => {
						card.onclick = (e) => {
							// Don't toggle if clicking on buttons or other interactive elements
							if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea')) {
								return;
							}

							const checkbox = card.querySelector(".instaraw-rpg-prompt-checkbox");
							if (checkbox) {
								checkbox.checked = !checkbox.checked;
								const promptId = checkbox.dataset.id;

								if (checkbox.checked) {
									selectedPrompts.add(promptId);
								} else {
									selectedPrompts.delete(promptId);
								}

								renderUI();
								console.log(`[RPG] Card click: ${checkbox.checked ? 'Selected' : 'Deselected'} prompt ${promptId}. Total selected: ${selectedPrompts.size}`);
							}
						};
					});

					// Delete user prompt buttons
					container.querySelectorAll(".instaraw-rpg-delete-user-prompt-btn").forEach((btn) => {
						btn.onclick = async (e) => {
							e.stopPropagation();
							const promptId = btn.dataset.id;
							const prompt = userPrompts.find(p => p.id === promptId);
							if (!prompt) return;

							const confirmMsg = `Delete this prompt?\n\nPositive: ${(prompt.prompt?.positive || '').substring(0, 100)}...`;
							if (!confirm(confirmMsg)) return;

							try {
								await deleteUserPrompt(promptId);
								console.log(`[RPG] Deleted user prompt ${promptId}`);

								// If in random mode, remove from randomPrompts array
								if (showingRandomPrompts) {
									randomPrompts = randomPrompts.filter(p => p.id !== promptId);
								}

								// Refresh UI
								renderUI();
							} catch (error) {
								console.error("[RPG] Error deleting user prompt:", error);
								alert(`Error deleting prompt: ${error.message}`);
							}
						};
					});

					// Delete generated prompt buttons
					container.querySelectorAll(".instaraw-rpg-delete-generated-prompt-btn").forEach((btn) => {
						btn.onclick = async (e) => {
							e.stopPropagation();
							const promptId = btn.dataset.id;
							const prompt = generatedPrompts.find(p => p.id === promptId);
							if (!prompt) return;

							const confirmMsg = `Delete this generated prompt?\n\nPositive: ${(prompt.prompt?.positive || '').substring(0, 100)}...`;
							if (!confirm(confirmMsg)) return;

							try {
								await deleteGeneratedPrompt(promptId);
								console.log(`[RPG] Deleted generated prompt ${promptId}`);

								// If in random mode, remove from randomPrompts array
								if (showingRandomPrompts) {
									randomPrompts = randomPrompts.filter(p => p.id !== promptId);
								}

								// Refresh UI
								renderUI();
							} catch (error) {
								console.error("[RPG] Error deleting generated prompt:", error);
								alert(`Error deleting prompt: ${error.message}`);
							}
						};
					});

					// Edit button - enter edit mode
					container.querySelectorAll(".instaraw-rpg-edit-user-prompt-btn").forEach((btn) => {
						btn.onclick = () => {
							const promptId = btn.dataset.id;
							const prompt = userPrompts.find(p => p.id === promptId);
							if (prompt) {
								// Store current values in edit buffer
								editingValues[promptId] = {
									positive: prompt.prompt?.positive || "",
									negative: prompt.prompt?.negative || "",
									tags: prompt.tags?.join(", ") || "",
									content_type: prompt.classification?.content_type || "person",
									safety_level: prompt.classification?.safety_level || "sfw",
									shot_type: prompt.classification?.shot_type || "portrait"
								};
								editingPrompts.add(promptId);
								renderUI();
								console.log(`[RPG] Editing user prompt ${promptId}`);
							}
						};
					});

					// Save button - save changes and exit edit mode
					container.querySelectorAll(".instaraw-rpg-save-user-prompt-btn").forEach((btn) => {
						btn.onclick = async () => {
							const promptId = btn.dataset.id;
							const positiveTextarea = container.querySelector(`.instaraw-rpg-user-prompt-edit-positive[data-id="${promptId}"]`);
							const negativeTextarea = container.querySelector(`.instaraw-rpg-user-prompt-edit-negative[data-id="${promptId}"]`);
							const tagsInput = container.querySelector(`.instaraw-rpg-user-prompt-edit-tags[data-id="${promptId}"]`);
							const contentTypeSelect = container.querySelector(`.instaraw-rpg-user-prompt-edit-content-type[data-id="${promptId}"]`);
							const safetyLevelSelect = container.querySelector(`.instaraw-rpg-user-prompt-edit-safety-level[data-id="${promptId}"]`);
							const shotTypeSelect = container.querySelector(`.instaraw-rpg-user-prompt-edit-shot-type[data-id="${promptId}"]`);

							if (!positiveTextarea || !negativeTextarea || !tagsInput) return;

							const tagsArray = tagsInput.value.split(",").map(t => t.trim()).filter(Boolean);

							try {
								await updateUserPrompt(promptId, {
									prompt: {
										positive: positiveTextarea.value,
										negative: negativeTextarea.value
									},
									tags: tagsArray,
									classification: {
										content_type: contentTypeSelect?.value || "person",
										safety_level: safetyLevelSelect?.value || "sfw",
										shot_type: shotTypeSelect?.value || "portrait"
									}
								});
								console.log(`[RPG] Saved user prompt ${promptId}`);

								// Exit edit mode
								editingPrompts.delete(promptId);
								delete editingValues[promptId];
								renderUI();
							} catch (error) {
								console.error("[RPG] Error saving user prompt:", error);
								alert(`Error saving: ${error.message}`);
							}
						};
					});

					// Cancel button - discard changes and exit edit mode
					container.querySelectorAll(".instaraw-rpg-cancel-edit-prompt-btn").forEach((btn) => {
						btn.onclick = () => {
							const promptId = btn.dataset.id;
							editingPrompts.delete(promptId);
							delete editingValues[promptId];
							renderUI();
							console.log(`[RPG] Cancelled editing user prompt ${promptId}`);
						};
					});

					// Auto-resize textareas in edit mode
					container.querySelectorAll(".instaraw-rpg-user-prompt-edit-positive, .instaraw-rpg-user-prompt-edit-negative").forEach((textarea) => {
						autoResizeTextarea(textarea);
						textarea.oninput = () => autoResizeTextarea(textarea);
					});

					// Update editingValues when classification dropdowns change
					container.querySelectorAll(".instaraw-rpg-user-prompt-edit-content-type").forEach((select) => {
						select.onchange = () => {
							const promptId = select.dataset.id;
							if (editingValues[promptId]) {
								editingValues[promptId].content_type = select.value;
							}
						};
					});

					container.querySelectorAll(".instaraw-rpg-user-prompt-edit-safety-level").forEach((select) => {
						select.onchange = () => {
							const promptId = select.dataset.id;
							if (editingValues[promptId]) {
								editingValues[promptId].safety_level = select.value;
							}
						};
					});

					container.querySelectorAll(".instaraw-rpg-user-prompt-edit-shot-type").forEach((select) => {
						select.onchange = () => {
							const promptId = select.dataset.id;
							if (editingValues[promptId]) {
								editingValues[promptId].shot_type = select.value;
							}
						};
					});

					// Copy prompt buttons
					container.querySelectorAll(".instaraw-rpg-copy-prompt-btn").forEach((btn) => {
						btn.onclick = async (e) => {
							e.stopPropagation();
							const positivePrompt = btn.dataset.positive;
							if (!positivePrompt) return;

							try {
								await navigator.clipboard.writeText(positivePrompt);
								// Show success feedback
								const originalText = btn.textContent;
								btn.textContent = "✅";
								btn.style.opacity = "1";
								setTimeout(() => {
									btn.textContent = originalText;
									btn.style.opacity = "";
								}, 800);
							} catch (error) {
								console.error("[RPG] Failed to copy to clipboard:", error);
								alert("Failed to copy to clipboard");
							}
						};
					});

					// Add to batch buttons (warns once if generated prompts are pending)
					container.querySelectorAll(".instaraw-rpg-add-to-batch-btn").forEach((btn) => {
						btn.onclick = () => {
							const promptId = btn.dataset.id;
							const promptData = promptsDatabase.find((p) => p.id === promptId);
							if (!promptData) return;

							// Check if there are pending generated prompts and user hasn't been warned yet
							if (node._generatedUnifiedPrompts && node._generatedUnifiedPrompts.length > 0 && !node._warnedAboutPendingPrompts) {
								const pendingCount = node._generatedUnifiedPrompts.length;
								const proceed = confirm(`You have ${pendingCount} generated prompt${pendingCount > 1 ? 's' : ''} waiting to be added in the Generate tab.\n\nAdd this prompt anyway?`);
								if (!proceed) return;
								node._warnedAboutPendingPrompts = true;
							}

							addPromptToBatch(promptData);
						};
					});

					// Undo batch buttons (removes last instance)
					container.querySelectorAll(".instaraw-rpg-undo-batch-btn").forEach((btn) => {
						btn.onclick = () => {
							const promptId = btn.dataset.id;
							const promptQueue = parsePromptBatch();
							// Find all instances with this source_id
							const instances = promptQueue.filter(p => p.source_id === promptId);
							if (instances.length > 0) {
								// Remove the last one added
								const lastInstance = instances[instances.length - 1];
								deletePromptFromBatch(lastInstance.id);
							}
						};
					});

					// Bookmark buttons
					container.querySelectorAll(".instaraw-rpg-bookmark-btn").forEach((btn) => {
						btn.onclick = (e) => {
							e.stopPropagation();
							toggleBookmark(btn.dataset.id);
						};
					});

					// ID copy buttons
					container.querySelectorAll(".instaraw-rpg-id-copy-btn").forEach((btn) => {
						btn.onclick = (e) => {
							e.stopPropagation();
							const promptId = btn.dataset.id;
							navigator.clipboard.writeText(promptId).then(() => {
								// Visual feedback
								const originalText = btn.textContent;
								btn.textContent = "✅";
								setTimeout(() => {
									btn.textContent = originalText;
								}, 1000);
							}).catch(err => {
								console.error("[RPG] Failed to copy ID:", err);
								alert("Failed to copy ID to clipboard");
							});
						};
					});

					// Toggle tags buttons (expand/collapse) - use event delegation
					// Only add listener once to prevent accumulation
					if (!container._hasToggleTagsListener) {
						container._hasToggleTagsListener = true;
						container.addEventListener('click', (e) => {
							if (e.target.classList.contains('instaraw-rpg-toggle-tags-btn')) {
								e.stopPropagation();
								const promptId = e.target.dataset.id;
								const card = e.target.closest('.instaraw-rpg-library-card');
								const tagsContainer = card.querySelector('.instaraw-rpg-library-card-tags');
								const prompt = promptsDatabase.find(p => p.id === promptId);

								if (prompt && tagsContainer) {
									const isExpanded = tagsContainer.getAttribute('data-expanded') === 'true';
									const filters = JSON.parse(node.properties.library_filters || "{}");
									const searchQuery = filters.search_query?.trim() || "";

									if (isExpanded) {
										// Collapse - show only first 5
										tagsContainer.setAttribute('data-expanded', 'false');
										tagsContainer.innerHTML = prompt.tags.slice(0, 5)
											.map(tag => `<span class="instaraw-rpg-tag">${highlightSearchTerm(tag, searchQuery)}</span>`)
											.join("") + ` <button class="instaraw-rpg-toggle-tags-btn" data-id="${promptId}">+${prompt.tags.length - 5}</button>`;
									} else {
										// Expand - show all tags
										tagsContainer.setAttribute('data-expanded', 'true');
										tagsContainer.innerHTML = prompt.tags
											.map(tag => `<span class="instaraw-rpg-tag">${highlightSearchTerm(tag, searchQuery)}</span>`)
											.join("") + ` <button class="instaraw-rpg-toggle-tags-btn" data-id="${promptId}">Show less</button>`;
									}
								}
							}
						});
					}

					// Pagination
					container.querySelectorAll(".instaraw-rpg-prev-page-btn").forEach((prevPageBtn) => {
						prevPageBtn.onclick = () => {
							if (currentPage > 0) {
								currentPage--;
								renderUI();
							}
						};
					});

					container.querySelectorAll(".instaraw-rpg-next-page-btn").forEach((nextPageBtn) => {
						nextPageBtn.onclick = () => {
							currentPage++;
							renderUI();
						};
					});

					// Batch item controls - single resize after content loads
					const allTextareas = [
						...container.querySelectorAll(".instaraw-rpg-positive-textarea"),
						...container.querySelectorAll(".instaraw-rpg-negative-textarea")
					];

					// Batch textareas get larger max height for auto-resize (user can still drag beyond this)
					const batchTextareaOptions = { maxHeight: 400 };

					// Resize all textareas immediately after DOM paint (no delay)
					requestAnimationFrame(() => {
						allTextareas.forEach(textarea => {
							autoResizeTextarea(textarea, batchTextareaOptions);
							// Cache the height
							const id = textarea.dataset.id;
							const isPositive = textarea.classList.contains("instaraw-rpg-positive-textarea");
							if (id) {
								textareaHeights[`${id}_${isPositive ? 'positive' : 'negative'}`] = textarea.offsetHeight;
							}
						});
						setTimeout(() => updateCachedHeight(), 10);
					});

					container.querySelectorAll(".instaraw-rpg-positive-textarea").forEach((textarea) => {
						textarea.oninput = (e) => {
							autoResizeTextarea(textarea, batchTextareaOptions);
							// Cache the new height
							const id = textarea.dataset.id;
							if (id) textareaHeights[`${id}_positive`] = textarea.offsetHeight;
							updateCachedHeight();
						};
						textarea.onchange = (e) => {
							const id = textarea.dataset.id;
							const value = e.target.value;

							// Check if we're in SDXL mode and this entry has tags
							const promptQueue = parsePromptBatch();
							const entry = promptQueue.find((p) => p.id === id);

							if (sdxlModeEnabled && entry && entry.tags && entry.tags.length > 0) {
								// SDXL mode with tags - save as tags array (comma-separated)
								const tagsArray = value.split(',').map(t => t.trim()).filter(t => t.length > 0);
								updatePromptInBatch(id, "tags", tagsArray);
							} else {
								// Normal mode - save as positive_prompt
								// Backend will use positive_prompt when sdxl_mode=False
								updatePromptInBatch(id, "positive_prompt", value);
							}
						};
					});

					container.querySelectorAll(".instaraw-rpg-negative-textarea").forEach((textarea) => {
						textarea.oninput = (e) => {
							autoResizeTextarea(textarea, batchTextareaOptions);
							// Cache the new height
							const id = textarea.dataset.id;
							if (id) textareaHeights[`${id}_negative`] = textarea.offsetHeight;
							updateCachedHeight();
						};
						textarea.onchange = (e) => {
							updatePromptInBatch(textarea.dataset.id, "negative_prompt", e.target.value);
						};
					});

					container.querySelectorAll(".instaraw-rpg-repeat-input").forEach((input) => {
						input.onchange = (e) => {
							updatePromptInBatch(input.dataset.id, "repeat_count", parseInt(e.target.value) || 1);
						};
						input.onmousedown = (e) => e.stopPropagation();
					});

					// Seed input controls
					container.querySelectorAll(".instaraw-rpg-seed-input").forEach((input) => {
						input.onmousedown = (e) => e.stopPropagation();
						input.onclick = (e) => e.stopPropagation();
						input.onfocus = (e) => e.stopPropagation();
						input.onchange = (e) => {
							// Save seed to this prompt entry
							const newSeed = Math.max(0, parseInt(e.target.value));
							updatePromptInBatch(input.dataset.id, "seed", newSeed);
							// Update seed range display
							updateSeedRangeDisplay(input.dataset.id);
						};
					});

					container.querySelectorAll(".instaraw-rpg-seed-randomize-btn").forEach((btn) => {
						btn.onmousedown = (e) => e.stopPropagation();
						btn.onclick = (e) => {
							e.stopPropagation();
							// Generate random seed and update ONLY this prompt's seed
							const randomSeed = Math.floor(Math.random() * (9999999 - 1111111 + 1)) + 1111111;
							const id = btn.dataset.id;
							const seedInput = container.querySelector(`.instaraw-rpg-seed-input[data-id="${id}"]`);
							if (seedInput) {
								seedInput.value = randomSeed;
								updatePromptInBatch(id, "seed", randomSeed);
								updateSeedRangeDisplay(id);
							}
						};
					});

					container.querySelectorAll(".instaraw-rpg-seed-reset-btn").forEach((btn) => {
						btn.onmousedown = (e) => e.stopPropagation();
						btn.onclick = (e) => {
							e.stopPropagation();
							// Reset ONLY this prompt's seed
							const id = btn.dataset.id;
							const seedInput = container.querySelector(`.instaraw-rpg-seed-input[data-id="${id}"]`);
							if (seedInput) {
								seedInput.value = 1111111;
								updatePromptInBatch(id, "seed", 1111111);
								updateSeedRangeDisplay(id);
							}
						};
					});

					container.querySelectorAll(".instaraw-rpg-seed-control").forEach((select) => {
						select.onmousedown = (e) => e.stopPropagation();
						select.onclick = (e) => e.stopPropagation();
						select.onchange = (e) => {
							// Save seed control mode (controls behavior after execution)
							updatePromptInBatch(select.dataset.id, "seed_control", e.target.value);
						};
					});

					// Bulk seed control dropdown (power tools)
					const bulkSeedControl = container.querySelector(".instaraw-rpg-bulk-seed-control");
					if (bulkSeedControl) {
						bulkSeedControl.onmousedown = (e) => e.stopPropagation();
						bulkSeedControl.onclick = (e) => e.stopPropagation();
						bulkSeedControl.onchange = (e) => {
							const value = e.target.value;
							if (value) {
								updateAllPromptsField("seed_control", value);
								e.target.value = ""; // Reset dropdown to placeholder
							}
						};
					}

					// Bulk reset seeds button (power tools) - sets all to 1111111
					const bulkResetSeedsBtn = container.querySelector(".instaraw-rpg-bulk-reset-seeds-btn");
					if (bulkResetSeedsBtn) {
						bulkResetSeedsBtn.onmousedown = (e) => e.stopPropagation();
						bulkResetSeedsBtn.onclick = (e) => {
							e.stopPropagation();
							updateAllPromptsField("seed", 1111111);
						};
					}

					// Bulk randomize seeds button (power tools) - generates new random seeds
					const bulkRandomizeSeedsBtn = container.querySelector(".instaraw-rpg-bulk-randomize-seeds-btn");
					if (bulkRandomizeSeedsBtn) {
						bulkRandomizeSeedsBtn.onmousedown = (e) => e.stopPropagation();
						bulkRandomizeSeedsBtn.onclick = (e) => {
							e.stopPropagation();
							const promptQueue = parsePromptBatch();
							if (promptQueue.length === 0) return;
							promptQueue.forEach(entry => {
								entry.seed = Math.floor(Math.random() * 2147483647);
							});
							node.properties.prompt_batch_data = JSON.stringify(promptQueue);
							syncPromptBatchWidget();
							renderUI();
						};
					}

					// Initialize seed range displays
					container.querySelectorAll(".instaraw-rpg-seed-range").forEach((span) => {
						updateSeedRangeDisplay(span.dataset.id);
					});

					container.querySelectorAll(".instaraw-rpg-batch-delete-btn").forEach((btn) => {
						btn.onclick = (e) => {
							e.stopPropagation();
							deletePromptFromBatch(btn.dataset.id);
						};
					});

					// Clear batch button
					const clearBatchBtn = container.querySelector(".instaraw-rpg-clear-batch-btn");
					if (clearBatchBtn) {
						clearBatchBtn.onclick = clearBatch;
					}

					// Reorder toggle button
					const reorderToggleBtn = container.querySelector(".instaraw-rpg-reorder-toggle-btn");
					if (reorderToggleBtn) {
						reorderToggleBtn.onclick = () => {
							reorderModeEnabled = !reorderModeEnabled;
							renderUI();
						};
					}

					// SDXL mode toggle button
					const sdxlToggleBtn = container.querySelector(".instaraw-rpg-sdxl-toggle-btn");
					if (sdxlToggleBtn) {
						sdxlToggleBtn.onclick = () => {
							sdxlModeEnabled = !sdxlModeEnabled;
							console.log(`[RPG] SDXL mode ${sdxlModeEnabled ? 'enabled' : 'disabled'}`);
							syncSDXLModeWidget();
							renderUI();
						};
					}

					// Smart Sync AIL button - handles both latent creation and repeat syncing
					const syncAilBtn = container.querySelector(".instaraw-rpg-sync-ail-btn");
					if (syncAilBtn) {
						syncAilBtn.onclick = async () => {
							if (!node._linkedAILNodeId) {
								alert("No Advanced Image Loader detected. Connect AIL to RPG first.");
								return;
							}

							const promptQueue = parsePromptBatch();
							const totalGenerations = promptQueue.reduce((sum, p) => sum + (p.repeat_count || 1), 0);

							// Get target dimensions from aspect ratio selector
							const targetDims = getTargetDimensions();

							// Read FRESH data from the primary AIL node (not cached)
							const primaryAIL = app.graph.getNodeById(node._linkedAILNodeId);
							if (!primaryAIL) {
								alert("Cannot find connected AIL node. Please reconnect.");
								return;
							}

							// Get actual data from AIL
							let ailData;
							try {
								ailData = JSON.parse(primaryAIL.properties?.batch_data || "{}");
							} catch (e) {
								ailData = {};
							}

							// Get actual item count from AIL
							const ailImages = ailData.images || [];
							const ailLatents = ailData.latents || [];

							// Detect mode from AIL's enable_img2img WIDGET (not batch_data)
							// The widget is the source of truth for current mode
							let detectedMode;
							const enableImg2ImgWidget = primaryAIL.widgets?.find(w => w.name === "enable_img2img");
							let enableImg2ImgValue = enableImg2ImgWidget?.value;

							// Check if enable_img2img is connected to another node
							const enableImg2ImgInput = primaryAIL.inputs?.find(i => i.name === "enable_img2img");
							if (enableImg2ImgInput && enableImg2ImgInput.link != null) {
								const link = app.graph?.links?.[enableImg2ImgInput.link];
								if (link) {
									const srcNode = app.graph.getNodeById(link.origin_id);
									if (srcNode) {
										const srcWidget = srcNode.widgets?.[link.origin_slot];
										if (srcWidget) enableImg2ImgValue = srcWidget.value;
									}
								}
							}

							// Convert to mode: enable_img2img false = txt2img, true = img2img
							if (enableImg2ImgValue === false || enableImg2ImgValue === "false") {
								detectedMode = "txt2img";
							} else if (enableImg2ImgValue === true || enableImg2ImgValue === "true") {
								detectedMode = "img2img";
							} else {
								// Fallback: if images exist, it's img2img; if only latents, it's txt2img
								detectedMode = ailImages.length > 0 ? "img2img" : "txt2img";
							}
							console.log(`[RPG] Sync AIL - detected mode: ${detectedMode} (widget: ${enableImg2ImgValue}, images: ${ailImages.length}, latents: ${ailLatents.length})`);

							const ailOrder = ailData.order || [];
							const ailItemCount = detectedMode === "img2img" ? ailOrder.length : ailOrder.length;

							// PROMPTS ARE KING: Calculate what needs to change
							const promptCount = promptQueue.length;
							const needsLatentSync = detectedMode === "txt2img" && ailOrder.length !== promptCount;
							const needsRepeatSync = promptQueue.some((p, idx) => {
								const item = detectedMode === "img2img" ? ailImages.find(i => i.id === ailOrder[idx]) : ailLatents.find(l => l.id === ailOrder[idx]);
								return item && (p.repeat_count || 1) !== (item.repeat_count || 1);
							});

							// Auto-balance: Check if we need to duplicate AIL items to match prompt count
							const needsAutoBalance = detectedMode === "img2img" && promptCount > ailItemCount && ailItemCount > 0;
							const deficit = needsAutoBalance ? promptCount - ailItemCount : 0;

							// Trimming: Check if we need to remove excess AIL items to match prompt count
							const needsTrimming = detectedMode === "img2img" && promptCount < ailItemCount;
							const excess = needsTrimming ? ailItemCount - promptCount : 0;

							// Also get fresh data for secondary AILs
							const linkedImages2 = node._linkedImages2 || [];
							const linkedImages3 = node._linkedImages3 || [];
							const linkedImages4 = node._linkedImages4 || [];

							// Check if secondary AILs need syncing - read FRESH data
							const checkSecondaryAIL = (inputName) => {
								const input = node.inputs?.find(i => i.name === inputName);
								if (!input || !input.link) return null;
								const link = app.graph.links[input.link];
								if (!link) return null;
								const ailNode = app.graph.getNodeById(link.origin_id);
								if (!ailNode || ailNode.type !== "INSTARAW_AdvancedImageLoader") return null;

								let data;
								try {
									data = JSON.parse(ailNode.properties?.batch_data || "{}");
								} catch (e) {
									return null;
								}

								const order = data.order || [];
								if (order.length === 0) return null;

								// Count mismatch with prompts (not primary AIL)
								if (order.length !== promptCount) {
									return { name: inputName, count: order.length, issue: "count", ailNode };
								}
								return null;
							};

							const secondaryAILsNeedSync = [
								checkSecondaryAIL("images2"),
								checkSecondaryAIL("images3"),
								checkSecondaryAIL("images4")
							].filter(Boolean);
							const needsSecondarySync = secondaryAILsNeedSync.length > 0;

							// Build simple, clear confirmation message
							// PROMPTS ARE KING - show what will happen
							let actions = [];

							if (detectedMode === "img2img") {
								if (ailItemCount === 0) {
									actions.push(`⚠️ No images in AIL! Upload ${promptCount} image(s) first.`);
								} else if (needsTrimming) {
									actions.push(`🗑️ Remove ${excess} image(s) from AIL (${ailItemCount} → ${promptCount})`);
								} else if (needsAutoBalance) {
									actions.push(`📋 Duplicate last image ${deficit} time(s) in AIL (${ailItemCount} → ${promptCount})`);
								}
							} else {
								// txt2img mode
								if (needsLatentSync) {
									actions.push(`📐 Create ${promptCount} latent(s) at ${targetDims.aspect_label}`);
								}
							}

							if (needsRepeatSync) {
								actions.push(`🔄 Sync repeat counts to match prompts`);
							}

							if (needsSecondarySync) {
								const syncDetails = secondaryAILsNeedSync.map(s => `${s.name}: ${s.count} → ${promptCount}`).join(", ");
								actions.push(`🔗 Sync secondary AILs: ${syncDetails}`);
							}

							let confirmMsg;
							if (actions.length === 0) {
								confirmMsg = `✓ Everything is already synced!\n\nPrompts: ${promptCount}\nAIL items: ${ailItemCount}\n\nSync anyway?`;
							} else if (detectedMode === "img2img" && ailItemCount === 0) {
								alert(`Cannot sync: No images in AIL!\n\nUpload ${promptCount} image(s) first, then sync.`);
								return;
							} else {
								confirmMsg = `Sync AIL to match ${promptCount} prompt(s)?\n\n${actions.join("\n")}\n\nContinue?`;
							}

							if (!confirm(confirmMsg)) return;

							// Helper to find connected AIL node for a specific input
							const findConnectedAILForInput = (inputName) => {
								const input = node.inputs?.find(i => i.name === inputName);
								if (!input || !input.link) return null;
								const link = app.graph.links[input.link];
								if (!link) return null;
								const sourceNode = app.graph.getNodeById(link.origin_id);
								if (sourceNode && sourceNode.type === "INSTARAW_AdvancedImageLoader") {
									return sourceNode;
								}
								return null;
							};

							// 0. Sync secondary AILs to match primary image count
							if (needsSecondarySync) {
								const inputsToSync = ["images2", "images3", "images4"];
								for (const inputName of inputsToSync) {
									const secondaryAIL = findConnectedAILForInput(inputName);
									if (!secondaryAIL) continue;

									try {
										const data = JSON.parse(secondaryAIL.properties.batch_data || "{}");
										let images = data.images || [];
										let order = data.order || [];

										if (images.length === 0 || order.length === 0) continue;

										const currentCount = order.length;
										if (currentCount === promptCount) continue; // Already synced to prompt count

										if (currentCount < promptCount) {
											// Duplicate last image to fill gap
											const duplicatesNeeded = promptCount - currentCount;
											const lastImageId = order[order.length - 1];
											const lastImage = images.find(img => img.id === lastImageId);

											if (lastImage) {
												console.log(`[RPG] Syncing ${inputName}: duplicating last image ${duplicatesNeeded} times`);
												for (let i = 0; i < duplicatesNeeded; i++) {
													const newImage = {
														...lastImage,
														id: `dup_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
														repeat_count: 1
													};
													images.push(newImage);
													order.push(newImage.id);
												}
												data.images = images; // Update reference
											}
										} else if (currentCount > promptCount) {
											// Trim excess images to match prompt count - PROMPTS ARE KING
											const removeCount = currentCount - promptCount;
											console.log(`[RPG] Syncing ${inputName}: trimming ${removeCount} excess images to match ${promptCount} prompts`);
											const removedIds = order.slice(promptCount);
											order = order.slice(0, promptCount);
											images = images.filter(img => !removedIds.includes(img.id));
											data.images = images; // Update reference
										}

										// Sync repeat counts to match prompt queue
										let totalCount = 0;
										data.order = order;
										order.forEach((imgId, idx) => {
											const img = data.images.find(i => i.id === imgId);
											if (img) {
												const repeatCount = promptQueue[idx]?.repeat_count || 1;
												img.repeat_count = repeatCount;
												totalCount += repeatCount;
											}
										});
										data.total_count = totalCount;

										secondaryAIL.properties.batch_data = JSON.stringify(data);

										// Trigger AIL re-render
										if (secondaryAIL._renderGallery) {
											secondaryAIL._renderGallery();
										}

										// Dispatch update event
										window.dispatchEvent(new CustomEvent("INSTARAW_AIL_UPDATED", {
											detail: {
												nodeId: secondaryAIL.id,
												images: data.images,
												latents: [],
												total: order.length,
												mode: "img2img",
												enable_img2img: true
											}
										}));

										console.log(`[RPG] Synced ${inputName}: now has ${order.length} images`);
									} catch (e) {
										console.error(`[RPG] Failed to sync ${inputName}:`, e);
									}
								}

								// Wait for sync to complete
								await new Promise(resolve => setTimeout(resolve, 200));
							}

							// 0a. Auto-balance: Duplicate last image if needed (img2img mode only)
							if (needsAutoBalance) {
								if (ailItemCount === 0) {
									alert("Cannot auto-balance: No images in AIL to duplicate!");
									return;
								}

								console.log(`[RPG] Auto-balance: Duplicating last AIL image ${deficit} times`);
								window.dispatchEvent(new CustomEvent("INSTARAW_DUPLICATE_LAST_N", {
									detail: {
										targetNodeId: node._linkedAILNodeId,
										count: deficit
									}
								}));

								// Wait for AIL to process duplicates
								await new Promise(resolve => setTimeout(resolve, 200));
							}

							// 0b. Trimming: Remove excess images if needed (img2img mode only)
							if (needsTrimming) {
								console.log(`[RPG] Trimming: Removing ${excess} excess image${excess > 1 ? 's' : ''} from AIL`);
								window.dispatchEvent(new CustomEvent("INSTARAW_TRIM_AIL_IMAGES", {
									detail: {
										targetNodeId: node._linkedAILNodeId,
										targetCount: promptQueue.length
									}
								}));

								// Wait for AIL to process trimming
								await new Promise(resolve => setTimeout(resolve, 200));
							}

							// 1. Create/sync latents if needed (txt2img mode)
							if (needsLatentSync || detectedMode === "txt2img") {
								const latentSpecs = promptQueue.map(p => ({
									repeat_count: p.repeat_count || 1
								}));

								window.dispatchEvent(new CustomEvent("INSTARAW_SYNC_AIL_LATENTS", {
									detail: {
										targetNodeId: node._linkedAILNodeId,
										latentSpecs: latentSpecs,
										dimensions: targetDims
									}
								}));
								console.log(`[RPG] Synced ${promptQueue.length} latents to AIL`);
							}

							// 2. Sync repeat counts to primary AIL (both modes)
							window.dispatchEvent(new CustomEvent("INSTARAW_SYNC_AIL_REPEATS", {
								detail: {
									targetNodeId: node._linkedAILNodeId,
									mode: detectedMode,
									repeats: promptQueue.map(p => p.repeat_count || 1)
								}
							}));
							console.log(`[RPG] Synced repeat counts to primary AIL`);

							// 3. Sync repeat counts to secondary AILs (img2img mode)
							if (detectedMode === "img2img") {
								const secondaryInputs = ["images2", "images3", "images4"];
								for (const inputName of secondaryInputs) {
									const secondaryAIL = findConnectedAILForInput(inputName);
									if (secondaryAIL) {
										window.dispatchEvent(new CustomEvent("INSTARAW_SYNC_AIL_REPEATS", {
											detail: {
												targetNodeId: secondaryAIL.id,
												mode: "img2img",
												repeats: promptQueue.map(p => p.repeat_count || 1)
											}
										}));
										console.log(`[RPG] Synced repeat counts to ${inputName} AIL`);
									}
								}
							}

							// 4. Re-render RPG UI after all sync operations complete
							// AIL dispatches INSTARAW_AIL_UPDATED which updates _linkedImages caches
							setTimeout(() => {
								renderUI();
								console.log(`[RPG] Sync complete - refreshed UI`);
							}, 300);
						};
					}

					// Creative mode buttons
					const generateCreativeBtn = container.querySelector(".instaraw-rpg-generate-creative-btn");
					if (generateCreativeBtn) {
						generateCreativeBtn.onclick = generateCreativePrompts;
					}

					const acceptCreativeBtn = container.querySelector(".instaraw-rpg-accept-creative-btn");
					if (acceptCreativeBtn) {
						acceptCreativeBtn.onclick = acceptCreativePrompts;
					}

					const cancelCreativeBtn = container.querySelector(".instaraw-rpg-cancel-creative-btn");
					if (cancelCreativeBtn) {
						cancelCreativeBtn.onclick = cancelCreativePrompts;
					}

					// Character mode buttons
					const generateCharacterBtn = container.querySelector(".instaraw-rpg-generate-character-btn");
					if (generateCharacterBtn) {
						generateCharacterBtn.onclick = generateCharacterPrompts;
					}

					const acceptCharacterBtn = container.querySelector(".instaraw-rpg-accept-character-btn");
					if (acceptCharacterBtn) {
						acceptCharacterBtn.onclick = acceptCharacterPrompts;
					}

					const cancelCharacterBtn = container.querySelector(".instaraw-rpg-cancel-character-btn");
					if (cancelCharacterBtn) {
						cancelCharacterBtn.onclick = cancelCharacterPrompts;
					}

					// ========================================
					// === UNIFIED GENERATE TAB HANDLERS ===
					// ========================================

					// Character description generation button
					const generateCharacterDescBtn = container.querySelector(".instaraw-rpg-generate-character-desc-btn");
					if (generateCharacterDescBtn) {
						generateCharacterDescBtn.onclick = generateCharacterDescription;
					}

					// Character likeness checkbox
					const enableCharacterCheckbox = container.querySelector(".instaraw-rpg-enable-character-checkbox");
					if (enableCharacterCheckbox) {
						enableCharacterCheckbox.onchange = (e) => {
							node.properties.use_character_likeness = e.target.checked;
							renderUI(); // Re-render to show/hide character section
						};
					}

					// Generation mode toggle buttons (Reality vs Creative)
					container.querySelectorAll(".instaraw-rpg-mode-toggle-btn").forEach((btn) => {
						btn.onclick = () => {
							const mode = btn.dataset.mode;
							node.properties.generation_style = mode;
							saveSettings();
							renderUI(); // Re-render to update button styles
							console.log(`[RPG] Switched to ${mode} mode`);
						};
					});

					// Character text input (save on change + auto-resize)
					const characterTextInput = container.querySelector(".instaraw-rpg-character-text-input");
					if (characterTextInput) {
						autoResizeTextarea(characterTextInput);
						characterTextInput.oninput = (e) => autoResizeTextarea(characterTextInput);
						characterTextInput.onchange = (e) => {
							node.properties.character_text_input = e.target.value;
							saveSettings();
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Character complexity dropdown
					const characterComplexitySelect = container.querySelector(".instaraw-rpg-character-complexity");
					if (characterComplexitySelect) {
						characterComplexitySelect.onchange = (e) => {
							node.properties.character_complexity = e.target.value;
							saveSettings();

							// If no custom system prompt, update the textarea to show new default
							const systemPromptTextarea = container.querySelector(".instaraw-rpg-character-system-prompt");
							if (systemPromptTextarea && !node.properties.character_system_prompt) {
								systemPromptTextarea.value = getCharacterSystemPrompt(e.target.value);
								autoResizeTextarea(systemPromptTextarea);
							}

							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Reset system prompt button (character section)
					const resetSystemPromptBtn = container.querySelector(".instaraw-rpg-reset-system-prompt-btn");
					if (resetSystemPromptBtn) {
						resetSystemPromptBtn.onclick = () => {
							const complexity = node.properties.character_complexity || "balanced";
							const defaultPrompt = getCharacterSystemPrompt(complexity);

							// Clear custom prompt and update textarea
							node.properties.character_system_prompt = "";
							saveSettings();
							if (characterSystemPromptInput) {
								characterSystemPromptInput.value = defaultPrompt;
								autoResizeTextarea(characterSystemPromptInput);
							}

							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Reset unified system prompt button (generate section)
					const resetUnifiedSystemPromptBtn = container.querySelector(".instaraw-rpg-reset-unified-system-prompt-btn");
					if (resetUnifiedSystemPromptBtn) {
						resetUnifiedSystemPromptBtn.onclick = () => {
							// Clear custom prompt and reset to default
							node.properties.creative_system_prompt = "";
							saveSettings();

							// Determine which default to use based on current mode AND generation style
							const detectedMode = node._linkedAILMode || "txt2img";
							const generationStyle = node.properties.generation_style || "reality";

							let defaultPrompt;
							if (detectedMode === 'txt2img') {
								// txt2img: both styles use same template
								defaultPrompt = DEFAULT_RPG_SYSTEM_PROMPT;
							} else {
								// img2img: different templates for Reality vs Creative
								defaultPrompt = generationStyle === 'reality' ? DEFAULT_IMG2IMG_REALITY_SYSTEM_PROMPT : DEFAULT_IMG2IMG_CREATIVE_SYSTEM_PROMPT;
							}

							// Update textarea to show default
							const systemPromptTextarea = container.querySelector(".instaraw-rpg-system-prompt");
							if (systemPromptTextarea) {
								systemPromptTextarea.value = defaultPrompt;
								autoResizeTextarea(systemPromptTextarea);
							}

							console.log(`[RPG] Reset system prompt to ${detectedMode} ${generationStyle} default`);
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Open Library tab button
					const openLibraryTabBtn = container.querySelector(".instaraw-rpg-open-library-tab-btn");
					if (openLibraryTabBtn) {
						openLibraryTabBtn.onclick = () => {
							node.properties.active_tab = "library";
							renderUI();
						};
					}

					// User text input (txt2img mode) - unified with img2img
					const userTextInput = container.querySelector(".instaraw-rpg-user-text-input");
					if (userTextInput) {
						autoResizeTextarea(userTextInput);
						userTextInput.oninput = (e) => {
							node.properties.user_instructions = e.target.value;
							saveUserInstructions();
							autoResizeTextarea(e.target);
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// ═══════════════════════════════════════════════════════════════════
					// UNIFIED EVENT HANDLERS (work for both txt2img and img2img)
					// ═══════════════════════════════════════════════════════════════════

					// IMG2IMG User Instructions textarea - unified with txt2img
					const img2imgUserInstructions = container.querySelector(".instaraw-rpg-img2img-user-instructions");
					if (img2imgUserInstructions) {
						autoResizeTextarea(img2imgUserInstructions);
						img2imgUserInstructions.oninput = (e) => {
							node.properties.user_instructions = e.target.value;
							saveUserInstructions();
							autoResizeTextarea(e.target);
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Theme preset dropdown (unified - works for both modes)
					const themeSelect = container.querySelector(".instaraw-rpg-theme-select");
					if (themeSelect) {
						themeSelect.onchange = (e) => {
							const themeKey = e.target.value;
							node.properties.theme_preset = themeKey;
							saveSettings();
							app.graph.setDirtyCanvas(true, true);
							console.log(`[RPG] Theme changed to: ${themeKey}`);
						};
					}

					// Model instructions preset dropdown (unified - works for both modes)
					const modelPresetSelect = container.querySelector(".instaraw-rpg-model-preset-select");
					if (modelPresetSelect) {
						modelPresetSelect.onchange = (e) => {
							const newPresetKey = e.target.value;
							const currentPresetKey = node.properties.model_preset || "none";
							const currentInstructions = node.properties.model_instructions || "";

							// Check if user has custom edits (instructions differ from current preset default)
							const currentPreset = MODEL_INSTRUCTION_PRESETS[currentPresetKey];
							const currentPresetDefault = currentPreset?.instructions || "";
							const hasCustomEdits = currentInstructions.trim() !== currentPresetDefault.trim();

							const applyPreset = () => {
								node.properties.model_preset = newPresetKey;
								const preset = MODEL_INSTRUCTION_PRESETS[newPresetKey];
								if (preset) {
									node.properties.model_instructions = preset.instructions;
									const instructionsTextarea = container.querySelector(".instaraw-rpg-model-instructions");
									if (instructionsTextarea) {
										instructionsTextarea.value = preset.instructions;
										autoResizeTextarea(instructionsTextarea);
									}
								}
								saveSettings();
								app.graph.setDirtyCanvas(true, true);
								console.log(`[RPG] Model preset changed to: ${newPresetKey}`);
							};

							if (hasCustomEdits && currentInstructions.trim() !== "") {
								// User has custom edits - show confirmation
								const confirmed = confirm(
									"⚠️ You have custom edits in Model Instructions.\n\n" +
									"Changing the preset will overwrite your changes.\n\n" +
									"Tip: Copy your instructions before proceeding if you want to keep them.\n\n" +
									"Continue and overwrite?"
								);

								if (confirmed) {
									applyPreset();
								} else {
									// Revert dropdown to previous value
									e.target.value = currentPresetKey;
								}
							} else {
								// No custom edits - apply directly
								applyPreset();
							}
						};
					}

					// Model instructions textarea (unified - works for both modes)
					const modelInstructions = container.querySelector(".instaraw-rpg-model-instructions");
					if (modelInstructions) {
						autoResizeTextarea(modelInstructions);
						modelInstructions.oninput = (e) => {
							node.properties.model_instructions = e.target.value;
							saveSettings();
							autoResizeTextarea(e.target);
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Clean mode toggle (unified - works for both modes)
					const cleanModeToggle = container.querySelector(".instaraw-rpg-clean-mode-toggle");
					if (cleanModeToggle) {
						cleanModeToggle.onchange = (e) => {
							node.properties.clean_mode = e.target.checked;
							saveSettings();
							app.graph.setDirtyCanvas(true, true);
							console.log(`[RPG] Clean mode ${e.target.checked ? 'enabled' : 'disabled'}`);
						};
					}

					// Inspiration count input (txt2img mode)
					const inspirationCountInput = container.querySelector(".instaraw-rpg-inspiration-count");
					if (inspirationCountInput) {
						inspirationCountInput.onchange = (e) => {
							node.properties.inspiration_count = parseInt(e.target.value) || 3;
							saveSettings();
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Library inspiration toggle
					const enableInspirationCheckbox = container.querySelector(".instaraw-rpg-enable-inspiration-checkbox");
					if (enableInspirationCheckbox) {
						enableInspirationCheckbox.onchange = (e) => {
							node.properties.enable_library_inspiration = e.target.checked;
							saveSettings();
							app.graph.setDirtyCanvas(true, true);
							renderUI();
						};
					}

					// Generation count input (unified tab)
					const genCountInputUnified = container.querySelector(".instaraw-rpg-gen-count-input");
					if (genCountInputUnified) {
						genCountInputUnified.onchange = (e) => {
							node.properties.generation_count = parseInt(e.target.value) || 5;
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Expression control handlers
					const enableExpressionsCheckbox = container.querySelector(".instaraw-rpg-enable-expressions-checkbox");
					if (enableExpressionsCheckbox) {
						enableExpressionsCheckbox.onchange = (e) => {
							node.properties.enable_expressions = e.target.checked;
							saveSettings();
							app.graph.setDirtyCanvas(true, true);
							renderUI();
						};
					}

					// Expression checkboxes
					container.querySelectorAll(".instaraw-rpg-expression-checkbox").forEach((checkbox) => {
						checkbox.onchange = () => {
							const enabledExpressions = [];
							container.querySelectorAll(".instaraw-rpg-expression-checkbox").forEach((cb) => {
								const label = cb.closest(".instaraw-rpg-expression-toggle");
								if (cb.checked && label) {
									enabledExpressions.push(label.dataset.expression);
								}
							});
							node.properties.enabled_expressions = JSON.stringify(enabledExpressions);
							saveSettings();
							app.graph.setDirtyCanvas(true, true);
						};
					});

					// Expression Select All / Clear All buttons
					const selectAllExpressionsBtn = container.querySelector(".instaraw-rpg-expressions-select-all");
					if (selectAllExpressionsBtn) {
						selectAllExpressionsBtn.onclick = () => {
							container.querySelectorAll(".instaraw-rpg-expression-checkbox").forEach((cb) => {
								cb.checked = true;
							});
							node.properties.enabled_expressions = JSON.stringify([...EXPRESSION_LIST]);
							saveSettings();
							app.graph.setDirtyCanvas(true, true);
						};
					}

					const clearAllExpressionsBtn = container.querySelector(".instaraw-rpg-expressions-clear-all");
					if (clearAllExpressionsBtn) {
						clearAllExpressionsBtn.onclick = () => {
							container.querySelectorAll(".instaraw-rpg-expression-checkbox").forEach((cb) => {
								cb.checked = false;
							});
							node.properties.enabled_expressions = JSON.stringify([]);
							saveSettings();
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Default expression dropdown
					const defaultExpressionSelect = container.querySelector(".instaraw-rpg-default-expression-select");
					if (defaultExpressionSelect) {
						defaultExpressionSelect.onchange = (e) => {
							node.properties.default_expression = e.target.value;
							saveSettings();
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Default mix frequency slider
					const defaultMixSlider = container.querySelector(".instaraw-rpg-default-mix-slider");
					const defaultMixValue = container.querySelector(".instaraw-rpg-default-mix-value");
					if (defaultMixSlider) {
						defaultMixSlider.oninput = (e) => {
							if (defaultMixValue) {
								defaultMixValue.textContent = `${e.target.value}%`;
							}
						};
						defaultMixSlider.onchange = (e) => {
							node.properties.default_mix_frequency = parseInt(e.target.value) || 0;
							saveSettings();
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Toggle system prompt preview button (in Advanced section)
					const toggleSystemPromptPreviewBtn = container.querySelector(".instaraw-rpg-toggle-system-prompt-preview-btn");
					if (toggleSystemPromptPreviewBtn) {
						console.log("[RPG] Preview button found, attaching handler");
						toggleSystemPromptPreviewBtn.addEventListener('click', (e) => {
							console.log("[RPG] Preview button clicked!");
							// Prevent the details from toggling
							e.preventDefault();
							e.stopPropagation();
							
							// Find the details element
							const detailsElement = container.querySelector(".instaraw-rpg-advanced-settings");
							console.log("[RPG] Details element:", detailsElement, "Open:", detailsElement?.open);
							
							// Get elements first
							const textarea = container.querySelector(".instaraw-rpg-system-prompt");
							const previewContainer = container.querySelector(".instaraw-rpg-system-prompt-preview-container");
							
							// Always ensure details is open
							if (detailsElement && !detailsElement.open) {
								console.log("[RPG] Opening details...");
								detailsElement.open = true;
								
								// Force arrow rotation
								const arrow = container.querySelector(".instaraw-rpg-details-arrow");
								if (arrow) arrow.style.transform = 'rotate(0deg)';
								
								// IMMEDIATELY show textarea by default when opening
								if (textarea) textarea.style.display = 'block';
								if (previewContainer) previewContainer.style.display = 'none';
								
								setTimeout(() => {
									performToggle();
								}, 100);
							} else {
								performToggle();
							}
							
							function performToggle() {
								// Toggle the state
								node.properties.show_system_prompt_preview = !node.properties.show_system_prompt_preview;

								// Update button text
								toggleSystemPromptPreviewBtn.textContent = node.properties.show_system_prompt_preview ? '📝 Edit Template' : '👁️ Preview';

								if (node.properties.show_system_prompt_preview) {
									// Gather current settings
									const detectedMode = node._linkedAILMode || "txt2img";
									const generationStyle = node.properties.generation_style || "reality";
									const useCharacter = node.properties.use_character_likeness || false;
									const characterDescription = node.properties.character_text_input || "";
									// Get user input based on mode using unified composition
									let userInput;
									if (detectedMode === "img2img") {
										userInput = composeUserInput(
											node.properties.user_instructions || "",
											node.properties.theme_preset || DEFAULT_THEME_PRESET,
											node.properties.model_instructions || "",
											node.properties.clean_mode || false
										);
									} else {
										const userTextRaw = container.querySelector(".instaraw-rpg-user-text-input")?.value?.trim() || "";
										userInput = composeUserInput(
											userTextRaw,
											node.properties.theme_preset || DEFAULT_THEME_PRESET,
											node.properties.model_instructions || "",
											node.properties.clean_mode || false
										);
									}
									// Respect library inspiration toggle
									const inspirationCount = node.properties.enable_library_inspiration
										? parseInt(container.querySelector(".instaraw-rpg-inspiration-count")?.value || "3")
										: 0;

									// Get sample source prompts
									const filters = JSON.parse(node.properties.library_filters || "{}");
									const sourcePromptPool = filterPrompts(promptsDatabase, filters);
									const sampleCount = Math.min(inspirationCount, sourcePromptPool.length);
									const shuffled = [...sourcePromptPool].sort(() => Math.random() - 0.5);
									const sampleSources = shuffled.slice(0, sampleCount).map(p => ({
										positive_prompt: p.prompt?.positive || p.positive || "",
										negative_prompt: p.prompt?.negative || p.negative || ""
									}));

									// Get expression if enabled
									let expression = null;
									if (node.properties.enable_expressions) {
										const enabledExpressions = JSON.parse(node.properties.enabled_expressions || '[]');
										const defaultExpression = node.properties.default_expression || "Neutral/Natural";
										expression = enabledExpressions.length > 0 ? enabledExpressions[0] : defaultExpression;
									}
									
									// Collect affect elements (for img2img Creative mode)
									const affectElements = [];
									if (detectedMode === 'img2img' && generationStyle === 'creative') {
										const affectBackground = container.querySelector(".instaraw-rpg-affect-background")?.checked;
										const affectOutfit = container.querySelector(".instaraw-rpg-affect-outfit")?.checked;
										const affectPose = container.querySelector(".instaraw-rpg-affect-pose")?.checked;
										const affectLighting = container.querySelector(".instaraw-rpg-affect-lighting")?.checked;
										if (affectBackground) affectElements.push("background");
										if (affectOutfit) affectElements.push("outfit");
										if (affectPose) affectElements.push("pose");
										if (affectLighting) affectElements.push("lighting");
									}

									// Build system prompt
									const customTemplate = node.properties.creative_system_prompt;
									const systemPrompt = buildSystemPrompt(
										detectedMode,
										generationStyle,
										sampleSources,
										userInput,
										useCharacter ? characterDescription : "",
										affectElements,
										customTemplate,
										expression
									);

									// Populate the preview
									const previewText = container.querySelector(".instaraw-rpg-system-prompt-preview-text");
									if (previewText) {
										previewText.textContent = systemPrompt;
									}

									// Show preview, hide textarea
									if (textarea) textarea.style.display = 'none';
									if (previewContainer) previewContainer.style.display = 'block';
								} else {
									// Show textarea, hide preview
									if (textarea) textarea.style.display = 'block';
									if (previewContainer) previewContainer.style.display = 'none';
									
									// Auto-resize textarea after showing it
									setTimeout(() => {
										if (textarea) {
											textarea.style.height = "auto";
											textarea.style.height = `${textarea.scrollHeight}px`;
										}
									}, 0);
								}

								app.graph.setDirtyCanvas(true, true);
							}
						}, true);
					}

					// Details element toggle handler for populating content (MAIN system prompt, not character)
					console.log("[RPG] === DEBUG: Looking for MAIN details element ===");
					console.log("[RPG] Active tab:", node.properties.active_tab);
					console.log("[RPG] Total <details> elements:", container.querySelectorAll("details").length);

					// Find the details element that contains the preview toggle button (the MAIN one, not character one)
					const previewButton = container.querySelector(".instaraw-rpg-toggle-system-prompt-preview-btn");
					const detailsElement = previewButton?.closest("details.instaraw-rpg-advanced-settings");

					console.log("[RPG] Preview button found:", !!previewButton);
					console.log("[RPG] Details element (with preview) found:", !!detailsElement, "open:", detailsElement?.open, "preview mode:", node.properties.show_system_prompt_preview);
					if (detailsElement) {
						console.log("[RPG] Attaching toggle event listener to details element");
						const updateDetailsContent = () => {
							console.log("[RPG] updateDetailsContent called - open:", detailsElement.open, "preview:", node.properties.show_system_prompt_preview);

							if (detailsElement.open) {
								console.log("[RPG] Details is open, updating content...");

								// Ensure correct element is visible and populated when opening
								const doUpdate = () => {
									const textarea = container.querySelector(".instaraw-rpg-system-prompt");
									const previewContainer = container.querySelector(".instaraw-rpg-system-prompt-preview-container");
									const previewText = container.querySelector(".instaraw-rpg-system-prompt-preview-text");

									console.log("[RPG] Elements found - textarea:", !!textarea, "container:", !!previewContainer, "text:", !!previewText);

									if (textarea && previewContainer) {
										if (!node.properties.show_system_prompt_preview) {
											// Edit mode: show textarea
											console.log("[RPG] Edit mode");
											textarea.style.display = 'block';
											previewContainer.style.display = 'none';

											// Auto-resize textarea
											textarea.style.height = "auto";
											textarea.style.height = `${textarea.scrollHeight}px`;
										} else {
											// Preview mode: populate and show preview
											console.log("[RPG] Preview mode - populating...");
											const detectedMode = node._linkedAILMode || "txt2img";
											const generationStyle = node.properties.generation_style || "reality";
											const useCharacter = node.properties.use_character_likeness || false;
											const characterDescription = node.properties.character_text_input || "";
											const userTextRaw = container.querySelector(".instaraw-rpg-user-text-input")?.value?.trim() || "";
											// Respect library inspiration toggle
											const inspirationCount = node.properties.enable_library_inspiration
												? parseInt(container.querySelector(".instaraw-rpg-inspiration-count")?.value || "3")
												: 0;

											// Compose user input using unified composition helper
											let userInput;
											if (detectedMode === 'img2img') {
												userInput = composeUserInput(
													node.properties.user_instructions || "",
													node.properties.theme_preset || DEFAULT_THEME_PRESET,
													node.properties.model_instructions || "",
													node.properties.clean_mode || false
												);
											} else {
												userInput = composeUserInput(
													userTextRaw,
													node.properties.theme_preset || DEFAULT_THEME_PRESET,
													node.properties.model_instructions || "",
													node.properties.clean_mode || false
												);
											}

											// Get sample source prompts
											const filters = JSON.parse(node.properties.library_filters || "{}");
											const sourcePromptPool = filterPrompts(promptsDatabase, filters);
											const sampleCount = Math.min(inspirationCount, sourcePromptPool.length);
											const shuffled = [...sourcePromptPool].sort(() => Math.random() - 0.5);
											const sampleSources = shuffled.slice(0, sampleCount).map(p => ({
												positive_prompt: p.prompt?.positive || p.positive || "",
												negative_prompt: p.prompt?.negative || p.negative || ""
											}));

											// Get expression if enabled
											let expression = null;
											if (node.properties.enable_expressions) {
												const enabledExpressions = JSON.parse(node.properties.enabled_expressions || '[]');
												const defaultExpression = node.properties.default_expression || "Neutral/Natural";
												expression = enabledExpressions.length > 0 ? enabledExpressions[0] : defaultExpression;
											}

											// Collect affect elements (for img2img Creative mode)
											const affectElements = [];
											if (detectedMode === 'img2img' && generationStyle === 'creative') {
												const affectBackground = container.querySelector(".instaraw-rpg-affect-background")?.checked;
												const affectOutfit = container.querySelector(".instaraw-rpg-affect-outfit")?.checked;
												const affectPose = container.querySelector(".instaraw-rpg-affect-pose")?.checked;
												const affectLighting = container.querySelector(".instaraw-rpg-affect-lighting")?.checked;
												if (affectBackground) affectElements.push("background");
												if (affectOutfit) affectElements.push("outfit");
												if (affectPose) affectElements.push("pose");
												if (affectLighting) affectElements.push("lighting");
											}

											// Build system prompt
											const customTemplate = node.properties.creative_system_prompt;
											const systemPrompt = buildSystemPrompt(
												detectedMode,
												generationStyle,
												sampleSources,
												userInput,
												useCharacter ? characterDescription : "",
												affectElements,
												customTemplate,
												expression
											);

											console.log("[RPG] Built prompt, len:", systemPrompt?.length, "text elem:", !!previewText);

											// Populate the preview
											if (previewText) {
												previewText.textContent = systemPrompt;
												console.log("[RPG] Preview set! First 50:", systemPrompt.substring(0, 50));
											} else {
												console.error("[RPG] ERROR: previewText not found!");
											}

											// Show preview, hide textarea
											textarea.style.display = 'none';
											previewContainer.style.display = 'block';
											console.log("[RPG] Preview displayed");
										}
									} else {
										console.error("[RPG] Missing elements!");
									}
								};

								// Call immediately if already rendered, or wait for next tick
								if (container.querySelector(".instaraw-rpg-system-prompt")) {
									console.log("[RPG] Elements already in DOM, updating immediately");
									doUpdate();
								} else {
									console.log("[RPG] Waiting for elements to be in DOM");
									setTimeout(doUpdate, 0);
								}
							}
						};
						console.log("[RPG] About to call updateDetailsContent() and addEventListener");
						updateDetailsContent(); // Populate immediately if details is already open
						detailsElement.addEventListener('toggle', updateDetailsContent);
						console.log("[RPG] Event listener attached successfully");
					} else {
						console.error("[RPG] ERROR: detailsElement not found - probably not on Generate tab");
					}

					// Unified Generate button (MAIN HANDLER)
					const generateUnifiedBtn = container.querySelector(".instaraw-rpg-generate-unified-btn");
					if (generateUnifiedBtn) {
						generateUnifiedBtn.onclick = generateUnifiedPrompts;
					}

					// Cancel generation button (for aborting in-progress generation)
					const cancelGenerationBtn = container.querySelector(".instaraw-rpg-cancel-generation-btn");
					if (cancelGenerationBtn) {
						cancelGenerationBtn.onclick = () => {
							if (generationAbortController) {
								console.log("[RPG] 🛑 User clicked cancel - aborting generation");
								generationAbortController.abort();
							}
						};
					}

					// Accept generated prompts buttons (there are two - top quick action and bottom)
					container.querySelectorAll(".instaraw-rpg-accept-generated-btn").forEach((btn) => {
						btn.onclick = acceptGeneratedPrompts;
					});

					// Cancel generated prompts button
					const cancelGeneratedBtn = container.querySelector(".instaraw-rpg-cancel-generated-btn");
					if (cancelGeneratedBtn) {
						cancelGeneratedBtn.onclick = cancelGeneratedPrompts;
					}

					// === Custom Tab Handlers ===

					// Custom template textarea
					const customTemplateTextarea = container.querySelector(".instaraw-rpg-custom-template-textarea");
					if (customTemplateTextarea) {
						autoResizeTextarea(customTemplateTextarea);
						customTemplateTextarea.oninput = (e) => {
							node.properties.custom_template = e.target.value;
							autoResizeTextarea(e.target);
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Custom tab user input - unified with other tabs
					const customUserInput = container.querySelector(".instaraw-rpg-custom-user-input");
					if (customUserInput) {
						autoResizeTextarea(customUserInput);
						customUserInput.oninput = (e) => {
							node.properties.user_instructions = e.target.value;
							saveUserInstructions();
							autoResizeTextarea(e.target);
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Reset custom template button
					const resetCustomTemplateBtn = container.querySelector(".instaraw-rpg-reset-custom-template-btn");
					if (resetCustomTemplateBtn) {
						resetCustomTemplateBtn.onclick = () => {
							node.properties.custom_template = DEFAULT_RPG_SYSTEM_PROMPT;
							const textarea = container.querySelector(".instaraw-rpg-custom-template-textarea");
							if (textarea) {
								textarea.value = DEFAULT_RPG_SYSTEM_PROMPT;
								autoResizeTextarea(textarea);
							}
							app.graph.setDirtyCanvas(true, true);
							console.log("[RPG] Reset custom template to default");
						};
					}

					// Variable insert buttons for custom template
					container.querySelectorAll(".instaraw-rpg-insert-variable-btn").forEach((btn) => {
						btn.onclick = () => {
							const variable = btn.dataset.variable;
							const textarea = container.querySelector(".instaraw-rpg-custom-template-textarea");
							if (textarea) {
								const start = textarea.selectionStart;
								const end = textarea.selectionEnd;
								const text = textarea.value;
								const before = text.substring(0, start);
								const after = text.substring(end);
								textarea.value = before + variable + after;
								textarea.selectionStart = textarea.selectionEnd = start + variable.length;
								textarea.focus();

								// Trigger change event
								node.properties.custom_template = textarea.value;
								autoResizeTextarea(textarea);
								app.graph.setDirtyCanvas(true, true);
							}
						};
					});

					// Quick Start Templates selector
					const quickTemplateSelector = container.querySelector(".instaraw-rpg-quick-template-selector");
					if (quickTemplateSelector) {
						quickTemplateSelector.onchange = (e) => {
							const preset = e.target.value;
							if (preset && QUICK_START_TEMPLATES[preset]) {
								node.properties.custom_template = QUICK_START_TEMPLATES[preset];
								const textarea = container.querySelector(".instaraw-rpg-custom-template-textarea");
								if (textarea) {
									textarea.value = QUICK_START_TEMPLATES[preset];
									autoResizeTextarea(textarea);
								}
								app.graph.setDirtyCanvas(true, true);
								console.log(`[RPG] Loaded quick start template: ${preset}`);
								// Reset selector
								e.target.value = "";
							}
						};
					}

					// Preview custom template button
					const previewCustomTemplateBtn = container.querySelector(".instaraw-rpg-preview-custom-template-btn");
					if (previewCustomTemplateBtn) {
						previewCustomTemplateBtn.onclick = () => {
							const customTemplate = container.querySelector(".instaraw-rpg-custom-template-textarea")?.value || node.properties.custom_template || DEFAULT_RPG_SYSTEM_PROMPT;
							const detectedMode = node._linkedAILMode || "txt2img";
							const generationStyle = node.properties.generation_style || "custom";
							const useCharacter = node.properties.use_character_likeness || false;
							const characterDescription = node.properties.character_text_input || "";
							// Compose user input using unified composition helper
							let userInput;
							if (detectedMode === "img2img") {
								userInput = composeUserInput(
									node.properties.user_instructions || "",
									node.properties.theme_preset || DEFAULT_THEME_PRESET,
									node.properties.model_instructions || "",
									node.properties.clean_mode || false
								);
							} else {
								const userTextRaw = container.querySelector(".instaraw-rpg-user-text-input")?.value?.trim() || "";
								userInput = composeUserInput(
									userTextRaw,
									node.properties.theme_preset || DEFAULT_THEME_PRESET,
									node.properties.model_instructions || "",
									node.properties.clean_mode || false
								);
							}
							// Respect library inspiration toggle
							const inspirationCount = node.properties.enable_library_inspiration
								? parseInt(container.querySelector(".instaraw-rpg-custom-inspiration-count")?.value || container.querySelector(".instaraw-rpg-inspiration-count")?.value || "3")
								: 0;

							// Get sample source prompts
							const filters = JSON.parse(node.properties.library_filters || "{}");
							const sourcePromptPool = filterPrompts(promptsDatabase, filters);
							const sampleCount = Math.min(inspirationCount, sourcePromptPool.length);
							const shuffled = [...sourcePromptPool].sort(() => Math.random() - 0.5);
							const sampleSources = shuffled.slice(0, sampleCount).map(p => ({
								positive_prompt: p.prompt?.positive || p.positive || "",
								negative_prompt: p.prompt?.negative || p.negative || ""
							}));

							// Get expression if enabled
							let expression = null;
							if (node.properties.enable_expressions) {
								const enabledExpressions = JSON.parse(node.properties.enabled_expressions || '[]');
								const defaultExpression = node.properties.default_expression || "Neutral/Natural";
								expression = enabledExpressions.length > 0 ? enabledExpressions[0] : defaultExpression;
							}

							// Get affect elements for img2img
							const affectElements = [];
							if (detectedMode === 'img2img') {
								const affectBackground = container.querySelector(".instaraw-rpg-affect-background")?.checked;
								const affectOutfit = container.querySelector(".instaraw-rpg-affect-outfit")?.checked;
								const affectPose = container.querySelector(".instaraw-rpg-affect-pose")?.checked;
								const affectLighting = container.querySelector(".instaraw-rpg-affect-lighting")?.checked;
								if (affectBackground) affectElements.push("background");
								if (affectOutfit) affectElements.push("outfit");
								if (affectPose) affectElements.push("pose");
								if (affectLighting) affectElements.push("lighting");
							}

							// Build preview prompt
							const previewPrompt = buildSystemPrompt(
								detectedMode,
								generationStyle,
								sampleSources,
								userInput,
								useCharacter ? characterDescription : "",
								affectElements,
								customTemplate,
								expression
							);

							// Show preview
							node.properties.show_custom_template_preview = true;
							const previewText = container.querySelector(".instaraw-rpg-custom-template-preview-text");
							if (previewText) {
								previewText.textContent = previewPrompt;
							}
							renderUI();
							console.log("[RPG] Custom template preview generated");
						};
					}

					// Close custom preview button
					const closeCustomPreviewBtn = container.querySelector(".instaraw-rpg-close-custom-preview-btn");
					if (closeCustomPreviewBtn) {
						closeCustomPreviewBtn.onclick = () => {
							node.properties.show_custom_template_preview = false;
							renderUI();
						};
					}

					// Custom inspiration count input
					const customInspirationCountInput = container.querySelector(".instaraw-rpg-custom-inspiration-count");
					if (customInspirationCountInput) {
						customInspirationCountInput.onchange = (e) => {
							node.properties.inspiration_count = parseInt(e.target.value) || 3;
							saveSettings();
							app.graph.setDirtyCanvas(true, true);
							console.log("[RPG] Custom mode inspiration count:", node.properties.inspiration_count);
						};
					}

					// Custom library details toggle
					const customLibraryDetails = container.querySelector(".instaraw-rpg-custom-library-details");
					if (customLibraryDetails) {
						customLibraryDetails.ontoggle = () => {
							node.properties.custom_library_expanded = customLibraryDetails.open;
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Variable help details toggle
					const variableHelpDetails = container.querySelector(".instaraw-rpg-variable-help-details");
					if (variableHelpDetails) {
						variableHelpDetails.ontoggle = () => {
							node.properties.variable_help_expanded = variableHelpDetails.open;
							app.graph.setDirtyCanvas(true, true);
						};
					}

					// Preview custom prompt button
					const previewCustomPromptBtn = container.querySelector(".instaraw-rpg-preview-custom-prompt-btn");
					if (previewCustomPromptBtn) {
						previewCustomPromptBtn.onclick = () => {
							// Get custom template
							const customTemplate = container.querySelector(".instaraw-rpg-custom-template-textarea")?.value || node.properties.custom_template;
							const detectedMode = node._linkedAILMode || "txt2img";
							const useCharacter = node.properties.use_character_likeness || false;
							const characterDescription = node.properties.character_text_input || "";
							const userInput = container.querySelector(".instaraw-rpg-custom-user-input")?.value?.trim() || "";

							// Get sample source prompts
							const filters = JSON.parse(node.properties.library_filters || "{}");
							const sourcePromptPool = filterPrompts(promptsDatabase, filters);
							const sampleCount = Math.min(3, sourcePromptPool.length);
							const shuffled = [...sourcePromptPool].sort(() => Math.random() - 0.5);
							const sampleSources = shuffled.slice(0, sampleCount).map(p => ({
								positive_prompt: p.prompt?.positive || p.positive || "",
								negative_prompt: p.prompt?.negative || p.negative || ""
							}));

							// Get expression if enabled
							let expression = null;
							if (node.properties.enable_expressions) {
								const enabledExpressions = JSON.parse(node.properties.enabled_expressions || '[]');
								const defaultExpression = node.properties.default_expression || "Neutral/Natural";
								expression = enabledExpressions.length > 0 ? enabledExpressions[0] : defaultExpression;
							}

							// Build system prompt with custom template
							const systemPrompt = buildSystemPrompt(
								detectedMode,
								"reality", // Default style for preview
								sampleSources,
								userInput,
								useCharacter ? characterDescription : "",
								[],
								customTemplate,
								expression
							);

							// Show preview modal
							showPreviewModal(systemPrompt, {
								mode: `${detectedMode.toUpperCase()} (Custom Template)`,
								character: useCharacter ? characterDescription : null,
								expression: expression,
								userInput: userInput,
								inspirationCount: sampleSources.length
							});
						};
					}

					// Variable insertion buttons
					container.querySelectorAll(".instaraw-rpg-variable-insert-btn").forEach((btn) => {
						btn.onclick = () => {
							const variable = btn.dataset.variable;
							const textarea = container.querySelector(".instaraw-rpg-custom-template-textarea");
							if (textarea) {
								const start = textarea.selectionStart;
								const end = textarea.selectionEnd;
								const text = textarea.value;
								const before = text.substring(0, start);
								const after = text.substring(end);
								textarea.value = before + variable + after;
								textarea.selectionStart = textarea.selectionEnd = start + variable.length;
								textarea.focus();

								// Trigger change event
								node.properties.custom_template = textarea.value;
								app.graph.setDirtyCanvas(true, true);
							}
						};
					});

				};

				// === Drag and Drop (Exact AIL Pattern) ===
				const setupDragAndDrop = () => {
					// Drag-and-drop reordering (only when enabled)
					if (reorderModeEnabled) {
						const items = container.querySelectorAll(".instaraw-rpg-batch-item");
						let draggedItem = null;

						items.forEach((item) => {
						// Skip if already has drag listeners to prevent accumulation
						if (item._hasDragListeners) return;
						item._hasDragListeners = true;

						item.addEventListener("dragstart", (e) => {
							draggedItem = item;
							item.style.opacity = "0.5";
							e.dataTransfer.effectAllowed = "move";
							e.stopPropagation();
							e.dataTransfer.setData("text/plain", "instaraw-rpg-reorder");
						});

						item.addEventListener("dragend", () => {
							item.style.opacity = "1";
							items.forEach((i) => i.classList.remove("instaraw-rpg-drop-before", "instaraw-rpg-drop-after"));
						});

						item.addEventListener("dragover", (e) => {
							e.preventDefault();
							if (draggedItem === item) return;
							e.dataTransfer.dropEffect = "move";
							const rect = item.getBoundingClientRect();
							const midpoint = rect.top + rect.height / 2;
							items.forEach((i) => i.classList.remove("instaraw-rpg-drop-before", "instaraw-rpg-drop-after"));
							item.classList.add(e.clientY < midpoint ? "instaraw-rpg-drop-before" : "instaraw-rpg-drop-after");
						});

						item.addEventListener("drop", (e) => {
							e.preventDefault();
							if (draggedItem === item) return;

							const draggedId = draggedItem.dataset.id;
							const targetId = item.dataset.id;

								const promptQueue = parsePromptBatch();
							const draggedIndex = promptQueue.findIndex((p) => p.id === draggedId);
							const targetIndex = promptQueue.findIndex((p) => p.id === targetId);

							if (draggedIndex === -1 || targetIndex === -1) return;

							const [draggedEntry] = promptQueue.splice(draggedIndex, 1);
							const rect = item.getBoundingClientRect();
							const insertAfter = e.clientY > rect.top + rect.height / 2;

							const newTargetIndex = promptQueue.findIndex((p) => p.id === targetId);
							promptQueue.splice(insertAfter ? newTargetIndex + 1 : newTargetIndex, 0, draggedEntry);

								setPromptBatchData(promptQueue);
							renderUI();
						});
					});
					}
				};

				// === AIL Update Listener ===
				// Global listener that routes updates to the correct RPG node
				if (!window._hasRPGAILListener) {
					window._hasRPGAILListener = true;
					window._rpgNodesByAILId = new Map(); // Track which RPG nodes are connected to which AIL nodes

					window.addEventListener("INSTARAW_AIL_UPDATED", (event) => {
						const { nodeId, images, latents, total, mode, enable_img2img } = event.detail;

						// Debug log to trace event format
						console.log(`[AIL-SYNC] Event received from AIL #${nodeId}:`, {
							mode,
							imagesCount: images?.length,
							hasUrl: images?.[0]?.url ? 'YES' : 'NO',
							firstImageKeys: images?.[0] ? Object.keys(images[0]) : []
						});

						// Find all RPG nodes connected to this AIL node
						if (!app || !app.graph || !app.graph._nodes) return;

						// Input names to check for multi-image support
						const imageInputNames = ["images", "images2", "images3", "images4"];

						app.graph._nodes.forEach(rpgNode => {
							if (rpgNode.type !== "INSTARAW_RealityPromptGenerator") return;

							// Check which input(s) this AIL is connected to
							let connectedInputName = null;
							for (const inputName of imageInputNames) {
								const input = rpgNode.inputs?.find(i => i.name === inputName);
								if (!input || !input.link) continue;

								const link = app.graph.links[input.link];
								if (link && link.origin_id === nodeId) {
									connectedInputName = inputName;
									break;
								}
							}

							if (!connectedInputName) return;

							// This RPG is connected to the AIL that sent the update
							console.log(`[RPG ${rpgNode.id}] AIL ${nodeId} update on ${connectedInputName} - Mode: ${mode}, Count: ${total}, images: ${images?.length || 0}`);

							// Update the appropriate tracking array based on which input is connected
							// Filter out any images with invalid URLs to prevent broken image icons
							const imageArray = mode === "img2img" ? (images || []).filter(img => img?.url) : [];

							console.log(`[AIL-SYNC] Setting ${connectedInputName}: ${images?.length} received → ${imageArray.length} after filter`);

							if (connectedInputName === "images") {
								rpgNode._linkedAILNodeId = nodeId;
								rpgNode._linkedAILMode = mode;
								rpgNode._linkedImages = imageArray;
								rpgNode._linkedLatents = mode !== "img2img" ? (latents || []) : [];
								rpgNode._linkedImageCount = total;

								// Update expected_image_count widget for primary input only
								const widget = rpgNode.widgets?.find((w) => w.name === "expected_image_count");
								if (widget) widget.value = total;
							} else if (connectedInputName === "images2") {
								rpgNode._linkedImages2 = imageArray;
							} else if (connectedInputName === "images3") {
								rpgNode._linkedImages3 = imageArray;
							} else if (connectedInputName === "images4") {
								rpgNode._linkedImages4 = imageArray;
							}

							// Re-render this specific RPG node
							if (rpgNode._renderUI) {
								rpgNode._renderUI();
							}
						});
					});
				}

				// === Add DOM Widget (Exact AIL Pattern) ===
				const widget = node.addDOMWidget("rpg_display", "rpgpromptmanager", container, {
					getValue: () => node.properties.prompt_batch_data,
					setValue: (v) => {
						node.properties.prompt_batch_data = v;
						renderUI();
					},
					serialize: false,
				});

				widget.computeSize = (width) => [width, cachedHeight + 6];

				// Add widget change callbacks to automatically refresh UI when aspect ratio changes
				const setupWidgetCallbacks = () => {
					const widthWidget = node.widgets?.find((w) => w.name === "output_width");
					if (widthWidget && !widthWidget._instaraw_callback_added) {
						const originalCallback = widthWidget.callback;
						widthWidget.callback = function() {
							if (originalCallback) originalCallback.apply(this, arguments);
							renderUI();
						};
						widthWidget._instaraw_callback_added = true;
					}

					const heightWidget = node.widgets?.find((w) => w.name === "output_height");
					if (heightWidget && !heightWidget._instaraw_callback_added) {
						const originalCallback = heightWidget.callback;
						heightWidget.callback = function() {
							if (originalCallback) originalCallback.apply(this, arguments);
							renderUI();
						};
						heightWidget._instaraw_callback_added = true;
					}

					const aspectWidget = node.widgets?.find((w) => w.name === "aspect_label");
					if (aspectWidget && !aspectWidget._instaraw_callback_added) {
						const originalCallback = aspectWidget.callback;
						aspectWidget.callback = function() {
							if (originalCallback) originalCallback.apply(this, arguments);
							renderUI();
						};
						aspectWidget._instaraw_callback_added = true;
					}
				};

				// Periodic dimension check - checks every 2 seconds if dimensions changed
				node._dimensionCheckInterval = null;
				let lastDimensions = null;
				const startDimensionCheck = () => {
					if (node._dimensionCheckInterval) clearInterval(node._dimensionCheckInterval);
					node._dimensionCheckInterval = setInterval(() => {
						const currentDims = getTargetDimensions();
						const dimsKey = `${currentDims.width}x${currentDims.height}:${currentDims.aspect_label}`;
						if (lastDimensions !== null && lastDimensions !== dimsKey) {
							console.log(`[RPG] Dimensions changed: ${lastDimensions} -> ${dimsKey}`);
							renderUI();
						}
						lastDimensions = dimsKey;
					}, 2000);
				};

				// Periodic AIL mode sync - checks every 500ms to ensure mode stays in sync
				node._ailSyncInterval = null;
				let lastAILMode = null;
				let lastAILImageCount = null;
				let syncCheckCounter = 0;
				const startAILSync = () => {
					if (node._ailSyncInterval) clearInterval(node._ailSyncInterval);
					node._ailSyncInterval = setInterval(() => {
						syncCheckCounter++;
						const debugLog = syncCheckCounter % 10 === 0; // Log every 5 seconds (10 * 500ms)

						// Check if we have an AIL connection
						const imagesInput = node.inputs?.find(input => input.name === "images");

						if (debugLog) {
							console.log(`[RPG AIL Sync Debug] Check #${syncCheckCounter}:`, {
								hasImagesInput: !!imagesInput,
								hasLink: imagesInput?.link != null,
								linkId: imagesInput?.link,
								currentRPGMode: node._linkedAILMode,
								currentRPGNodeId: node._linkedAILNodeId
							});
						}

						if (!imagesInput || !imagesInput.link) {
							// No connection - clear AIL data if needed
							if (node._linkedAILNodeId !== null) {
								console.log("[RPG AIL Sync] ❌ No AIL connection detected, clearing data");
								node._linkedAILNodeId = null;
								node._linkedAILMode = null;
								node._linkedImageCount = 0;
								node._linkedImages = [];
								node._linkedLatents = [];
								renderUI();
							}
							return;
						}

						// Get the connected AIL node
						const link = node.graph?.links?.[imagesInput.link];
						if (!link) {
							if (debugLog) console.log("[RPG AIL Sync Debug] Link object not found");
							return;
						}

						const ailNode = node.graph.getNodeById(link.origin_id);
						if (!ailNode) {
							if (debugLog) console.log("[RPG AIL Sync Debug] AIL node not found");
							return;
						}

						if (ailNode.type !== "INSTARAW_AdvancedImageLoader") {
							if (debugLog) console.log("[RPG AIL Sync Debug] Connected node is not AIL, type:", ailNode.type);
							return;
						}

						// Read current mode from AIL - based on enable_img2img input/widget, NOT the "mode" widget
						// The "mode" widget is for Batch Tensor vs Sequential, not img2img vs txt2img
						if (debugLog) {
							console.log(`[RPG ${node.id}] AIL widgets:`, ailNode.widgets?.map(w => ({ name: w.name, type: w.type, value: typeof w.value === 'object' ? JSON.stringify(w.value).substring(0, 50) : w.value })));
						}

						const enableImg2ImgWidget = ailNode.widgets?.find(w => w.name === "enable_img2img");
						const enableImg2ImgValue = enableImg2ImgWidget?.value;

						if (debugLog) {
							console.log(`[RPG ${node.id}] enable_img2img widget:`, enableImg2ImgWidget);
						}

						// Check if enable_img2img is connected to another node
						const enableImg2ImgInput = ailNode.inputs?.find(i => i.name === "enable_img2img");
						let finalEnableImg2Img = enableImg2ImgValue;

						if (enableImg2ImgInput && enableImg2ImgInput.link != null) {
							// Connected to another node - read from source
							const link = ailNode.graph?.links?.[enableImg2ImgInput.link];
							if (link) {
								const sourceNode = ailNode.graph.getNodeById(link.origin_id);
								if (sourceNode) {
									const sourceWidget = sourceNode.widgets?.[link.origin_slot];
									if (sourceWidget) {
										finalEnableImg2Img = sourceWidget.value;
									}
								}
							}
						}

						// Read batch_data first for additional mode detection info
						let batchData;
						try {
							batchData = JSON.parse(ailNode.properties?.batch_data || "{}");
						} catch (e) {
							batchData = {};
						}

						// Convert to mode: enable_img2img === false means txt2img, === true means img2img
						// Also check batch_data.enable_img2img as a fallback, or infer from content
						let detectedMode;
						if (finalEnableImg2Img === false || finalEnableImg2Img === "false") {
							detectedMode = "txt2img";
						} else if (finalEnableImg2Img === true || finalEnableImg2Img === "true") {
							detectedMode = "img2img";
						} else if (batchData.enable_img2img !== undefined) {
							detectedMode = batchData.enable_img2img ? "img2img" : "txt2img";
						} else {
							// Final fallback: infer from content (images = img2img, latents only = txt2img)
							const hasImages = (batchData.images || []).length > 0;
							detectedMode = hasImages ? "img2img" : "txt2img";
						}

						// Read image count and data from AIL's properties.batch_data
						let imageCount = 0;
						let images = [];
						let latents = [];

						const order = batchData.order || [];
						const ailImages = batchData.images || [];
						const ailLatents = batchData.latents || [];

						// Validate that batch_data matches the detected mode
						// If there's a mismatch, AIL hasn't swapped the data yet - wait for next sync
						const hasImages = ailImages.length > 0;
						const hasLatents = ailLatents.length > 0;
						const dataMismatch = (detectedMode === "txt2img" && hasImages && !hasLatents) ||
						                     (detectedMode === "img2img" && hasLatents && !hasImages);

						if (dataMismatch) {
							// AIL's batch_data hasn't been swapped yet - skip this sync cycle
							if (debugLog) {
								console.log(`[RPG ${node.id} AIL Sync] ⏳ Data mismatch detected, waiting for AIL to swap batch_data`);
								console.log(`  - detectedMode: ${detectedMode}, hasImages: ${hasImages}, hasLatents: ${hasLatents}`);
							}
							return; // Skip this sync, try again next cycle
						}

						if (detectedMode === "img2img") {
								// IMG2IMG mode - read images
								images = order.map(imgId => {
									const img = ailImages.find(i => i.id === imgId);
									if (!img) return null;
									// Handle both url (if already computed) and thumbnail (raw batchData format)
									const imgUrl = img.url || (img.thumbnail ? `/instaraw/view/${img.thumbnail}` : null);
									// Skip entries with invalid URLs to prevent broken image icons
									if (!imgUrl) return null;
									return {
										id: img.id,
										url: imgUrl,
										thumbnail: img.thumbnail, // Preserve original thumbnail path
										repeat_count: img.repeat_count || 1
									};
								}).filter(Boolean);
								imageCount = images.reduce((sum, img) => sum + (img.repeat_count || 1), 0);
							} else {
								// TXT2IMG mode - read latents
								latents = order.map(latentId => {
									const latent = ailLatents.find(l => l.id === latentId);
									if (!latent) return null;
									return {
										id: latent.id,
										width: latent.width,
										height: latent.height,
										repeat_count: latent.repeat_count || 1
									};
								}).filter(Boolean);
								imageCount = latents.reduce((sum, lat) => sum + (lat.repeat_count || 1), 0);
						}

						if (debugLog) {
							console.log(`[RPG ${node.id} AIL Sync Debug] AIL Node #${ailNode.id} state:`, {
								enableImg2ImgWidget: enableImg2ImgValue,
								enableImg2ImgFinal: finalEnableImg2Img,
								detectedMode: detectedMode,
								imageCount: imageCount,
								imagesLength: images.length,
								latentsLength: latents.length,
								ailNodeType: ailNode.type,
								currentRPGMode: node._linkedAILMode,
								currentRPGImages: node._linkedImages?.length || 0,
								currentRPGLatents: node._linkedLatents?.length || 0
							});
						}

						// Check if anything changed
						const modeChanged = node._linkedAILMode !== detectedMode;
						const countChanged = node._linkedImageCount !== imageCount;
						const nodeIdChanged = node._linkedAILNodeId !== ailNode.id;

						if (modeChanged || countChanged || nodeIdChanged) {
							console.log(`[RPG ${node.id} AIL Sync] 🔄 Syncing changes detected:`);
							console.log(`  - Mode: ${node._linkedAILMode} -> ${detectedMode} (changed: ${modeChanged})`);
							console.log(`  - Count: ${node._linkedImageCount} -> ${imageCount} (changed: ${countChanged})`);
							console.log(`  - Node: ${node._linkedAILNodeId} -> ${ailNode.id} (changed: ${nodeIdChanged})`);
							console.log(`  - enable_img2img: ${finalEnableImg2Img} (widget: ${enableImg2ImgValue})`);
							console.log(`  - AIL _images: ${images.length}, AIL _latents: ${latents.length}`);

							// Update all AIL state
							node._linkedAILNodeId = ailNode.id;
							node._linkedAILMode = detectedMode;
							node._linkedImageCount = imageCount;

							// Update images/latents based on mode
							if (detectedMode === "img2img") {
								node._linkedImages = images;
								node._linkedLatents = [];
								console.log(`  - Set images (${images.length}), cleared latents`);
							} else {
								node._linkedImages = [];
								node._linkedLatents = latents;
								console.log(`  - Set latents (${latents.length}), cleared images`);
							}

							// Update expected_image_count widget
							const widget = node.widgets?.find((w) => w.name === "expected_image_count");
							if (widget) widget.value = imageCount;

							renderUI();
						}
					}, 500); // Check twice per second for responsiveness
				};

				// === Control After Generate (Seed Updates) ===
				const updateSeedsAfterGenerate = () => {
					const promptQueue = parsePromptBatch();
					let hasChanges = false;

					promptQueue.forEach((entry) => {
						const seedControl = entry.seed_control || "randomize";
						const currentSeed = entry.seed || 1111111;

						if (seedControl === "increment") {
							entry.seed = currentSeed + 100; // +100 to avoid overlap with repeat +1s
							hasChanges = true;
						} else if (seedControl === "decrement") {
							entry.seed = Math.max(0, currentSeed - 100); // -100 but don't go negative
							hasChanges = true;
						} else if (seedControl === "randomize") {
							entry.seed = Math.floor(Math.random() * (9999999 - 1111111 + 1)) + 1111111;
							hasChanges = true;
						}
						// "fixed" does nothing - seeds stay the same
					});

					if (hasChanges) {
						setPromptBatchData(promptQueue);
						renderUI();
						console.log("[RPG] Seeds updated based on control_after_generate mode");
					}
				};

				// Store update function for event listener
				node._updateSeeds = updateSeedsAfterGenerate;

				// Listen for execution completion to update seeds AFTER run
				if (!window._rpgExecutionHooked) {
					api.addEventListener("execution_success", (e) => {
						console.log("[RPG] Execution completed successfully, updating seeds for next run...");
						// Find all RPG nodes and update their seeds for next execution
						const rpgNodes = app.graph._nodes?.filter(n => n.type === "INSTARAW_RealityPromptGenerator") || [];

						for (const rpgNode of rpgNodes) {
							if (rpgNode._updateSeeds) {
								console.log(`[RPG] Updating seeds for node ${rpgNode.id}`);
								rpgNode._updateSeeds();
							}
						}
					});
					window._rpgExecutionHooked = true;
					console.log("[RPG] Global execution_success listener installed");
				}

				// Store references for lifecycle hooks
				node._updateCachedHeight = updateCachedHeight;
				node._renderUI = renderUI;
				node._setupWidgetCallbacks = setupWidgetCallbacks;

				// Initial setup
				setTimeout(() => {
					syncPromptBatchWidget();
					syncSDXLModeWidget();
					loadSettings();
					setupWidgetCallbacks();
					startDimensionCheck();
					startAILSync(); // Start continuous AIL mode monitoring
					loadPromptsDatabase();
					renderUI();
					// Mark as initialized after first render
					node._isInitialized = true;

					// Listen for favorites from BIG (Batch Image Generator)
					const handleBigFavorite = async (e) => {
						const { prompt: rawPrompt, seed, sourceNodeId } = e.detail;
						if (!rawPrompt) {
							console.log("[RPG] BIG favorite event received but no prompt provided");
							return;
						}

						// Decode HTML entities (BIG uses escapeHtml on data attributes)
						const decodeHtml = (html) => {
							const txt = document.createElement('textarea');
							txt.innerHTML = html;
							return txt.value;
						};
						const prompt = decodeHtml(rawPrompt);

						console.log(`[RPG] Received favorite from BIG (node ${sourceNodeId}): "${prompt.slice(0, 50)}..."`);

						// First, check if this prompt exists anywhere in the database (library, user, or generated)
						const existingPrompt = promptsDatabase.find(p =>
							p.prompt?.positive?.trim().toLowerCase() === prompt.trim().toLowerCase()
						);

						if (existingPrompt) {
							// Prompt exists - check if already bookmarked
							if (bookmarksCache.includes(existingPrompt.id)) {
								console.log(`[RPG] Prompt already bookmarked (${existingPrompt.id})`);
								alert("This prompt is already in your favorites!");
								return;
							}

							// Add to bookmarks
							await toggleBookmarkById(existingPrompt.id);
							console.log(`[RPG] Bookmarked existing prompt: ${existingPrompt.id}`);
							renderUI();
							alert(`Added to favorites! (${existingPrompt.is_user_created ? "My Prompt" : existingPrompt.is_ai_generated ? "Generated" : "Library"})`);
							return;
						}

						// Prompt doesn't exist in database - create as new user prompt and bookmark it
						try {
							const newPrompt = await addUserPrompt({
								positive: prompt,
								negative: "",
								tags: seed && seed !== "N/A" ? [`seed:${seed}`, "from-big"] : ["from-big"],
								content_type: "other",
								safety_level: "sfw",
								shot_type: "other"
							});
							console.log(`[RPG] Created user prompt from BIG: ${newPrompt.id}`);

							// Also bookmark it
							await toggleBookmarkById(newPrompt.id);
							console.log(`[RPG] Bookmarked new user prompt: ${newPrompt.id}`);

							renderUI();
							alert(`Saved as new prompt and added to favorites! Seed: ${seed || "N/A"}`);
						} catch (error) {
							console.error("[RPG] Error adding BIG favorite:", error);
							alert("Failed to save prompt. Please try again.");
						}
					};

					document.addEventListener('instaraw-rpg-add-favorite', handleBigFavorite);
					node._bigFavoriteHandler = handleBigFavorite; // Store for cleanup
				}, 100);
			};

			const onResize = nodeType.prototype.onResize;
			nodeType.prototype.onResize = function (size) {
				onResize?.apply(this, arguments);
				if (this._updateCachedHeight) {
					clearTimeout(this._resizeTimeout);
					this._resizeTimeout = setTimeout(() => this._updateCachedHeight(), 50);
				}
			};

			const onConfigure = nodeType.prototype.onConfigure;
			nodeType.prototype.onConfigure = function (data) {
				onConfigure?.apply(this, arguments);

				// MIGRATION: Auto-update old minimal template from {TASK_INSTRUCTIONS} to {USER_INPUT}
				if (this.properties.custom_template === "{TASK_INSTRUCTIONS}") {
					console.log("[RPG] 🔄 Migrating minimal template: {TASK_INSTRUCTIONS} → {USER_INPUT}");
					this.properties.custom_template = "{USER_INPUT}";
					if (app && app.graph) {
						app.graph.setDirtyCanvas(true, true);
					}
				}

				setTimeout(() => {
					const promptQueueWidget = this.widgets?.find((w) => w.name === "prompt_batch_data");
					if (promptQueueWidget) promptQueueWidget.value = this.properties.prompt_batch_data || "[]";
					if (this._setupWidgetCallbacks) this._setupWidgetCallbacks();
					if (this._renderUI) this._renderUI();
					// Mark as initialized after loading from workflow
					this._isInitialized = true;

					// Force multiple height recalculations to ensure sync
					if (this._updateCachedHeight) {
						setTimeout(() => this._updateCachedHeight(), 100);
						setTimeout(() => this._updateCachedHeight(), 500);
						setTimeout(() => this._updateCachedHeight(), 1000);
					}
				}, 200);
			};

			// === onConnectionsChange Hook (for AIL detection and reactivity) ===
			const onConnectionsChange = nodeType.prototype.onConnectionsChange;
			nodeType.prototype.onConnectionsChange = function(side, slot, connect, link_info, output) {
				const result = onConnectionsChange?.apply(this, arguments);

				// Detect AIL connection when any image input is connected/disconnected
				if (side === 1) { // INPUT side
					// Check all 4 image inputs
					const imageInputNames = ["images", "images2", "images3", "images4"];

					for (const inputName of imageInputNames) {
						const inputIndex = this.inputs?.findIndex(input => input.name === inputName);
						if (slot !== inputIndex) continue;

						if (connect && link_info) {
							// Connected - traverse to find source node
							const link = this.graph?.links?.[link_info.id];
							if (link) {
								const sourceNode = this.graph.getNodeById(link.origin_id);
								if (sourceNode && sourceNode.type === "INSTARAW_AdvancedImageLoader") {
									// Read image data from AIL's properties.batch_data
									let images = [];

									try {
										const batchData = JSON.parse(sourceNode.properties?.batch_data || "{}");
										const order = batchData.order || [];
										const ailImages = batchData.images || [];

										images = order.map(imgId => {
											const img = ailImages.find(i => i.id === imgId);
											if (!img) return null;
											// Handle both url (if already computed) and thumbnail (raw batchData format)
											const imgUrl = img.url || (img.thumbnail ? `/instaraw/view/${img.thumbnail}` : null);
											// Skip entries with invalid URLs to prevent broken image icons
											if (!imgUrl) return null;
											return {
												id: img.id,
												url: imgUrl,
												thumbnail: img.thumbnail, // Preserve original thumbnail path
												repeat_count: img.repeat_count || 1
											};
										}).filter(Boolean);
									} catch (error) {
										console.error(`[RPG] Error parsing AIL batch_data on connection for ${inputName}:`, error);
									}

									// Update the appropriate tracking array based on input name
									if (inputName === "images") {
										// Primary input - full tracking
										this._linkedAILNodeId = sourceNode.id;

										// Get mode from enable_img2img widget, connected node, or batch_data
										const enableImg2ImgWidget = sourceNode.widgets?.find(w => w.name === "enable_img2img");
										const enableImg2ImgValue = enableImg2ImgWidget?.value;

										// Check if enable_img2img is connected to another node
										const enableImg2ImgInput = sourceNode.inputs?.find(i => i.name === "enable_img2img");
										let finalEnableImg2Img = enableImg2ImgValue;

										if (enableImg2ImgInput && enableImg2ImgInput.link != null) {
											const connectedLink = this.graph?.links?.[enableImg2ImgInput.link];
											if (connectedLink) {
												const sourceNode2 = this.graph.getNodeById(connectedLink.origin_id);
												if (sourceNode2) {
													const sourceWidget = sourceNode2.widgets?.[connectedLink.origin_slot];
													if (sourceWidget) {
														finalEnableImg2Img = sourceWidget.value;
													}
												}
											}
										}

										// Determine mode with fallbacks
										let detectedMode;
										if (finalEnableImg2Img === false || finalEnableImg2Img === "false") {
											detectedMode = "txt2img";
										} else if (finalEnableImg2Img === true || finalEnableImg2Img === "true") {
											detectedMode = "img2img";
										} else {
											// Fallback: check batch_data.enable_img2img or infer from content
											try {
												const batchData = JSON.parse(sourceNode.properties?.batch_data || "{}");
												if (batchData.enable_img2img !== undefined) {
													detectedMode = batchData.enable_img2img ? "img2img" : "txt2img";
												} else {
													// Final fallback: infer from content
													detectedMode = (batchData.images || []).length > 0 ? "img2img" : "txt2img";
												}
											} catch (e) {
												detectedMode = "txt2img"; // Default to txt2img if can't parse
											}
										}
										this._linkedAILMode = detectedMode;

										if (this._linkedAILMode === "img2img") {
											this._linkedImages = images;
											this._linkedLatents = [];
											this._linkedImageCount = images.reduce((sum, img) => sum + (img.repeat_count || 1), 0);
										} else {
											this._linkedImages = [];
											// Read latents for txt2img mode
											try {
												const batchData = JSON.parse(sourceNode.properties?.batch_data || "{}");
												const order = batchData.order || [];
												const ailLatents = batchData.latents || [];
												this._linkedLatents = order.map(latentId => {
													const latent = ailLatents.find(l => l.id === latentId);
													if (!latent) return null;
													return {
														id: latent.id,
														width: latent.width,
														height: latent.height,
														repeat_count: latent.repeat_count || 1
													};
												}).filter(Boolean);
												this._linkedImageCount = this._linkedLatents.reduce((sum, lat) => sum + (lat.repeat_count || 1), 0);
											} catch (error) {
												this._linkedLatents = [];
												this._linkedImageCount = 0;
											}
										}

										console.log(`[RPG] Linked ${inputName} to AIL node ${sourceNode.id}: ${this._linkedImageCount} items, mode: ${this._linkedAILMode}`);
									} else if (inputName === "images2") {
										this._linkedImages2 = images;
										console.log(`[RPG] Linked ${inputName} to AIL node ${sourceNode.id}: ${images.length} images`);
									} else if (inputName === "images3") {
										this._linkedImages3 = images;
										console.log(`[RPG] Linked ${inputName} to AIL node ${sourceNode.id}: ${images.length} images`);
									} else if (inputName === "images4") {
										this._linkedImages4 = images;
										console.log(`[RPG] Linked ${inputName} to AIL node ${sourceNode.id}: ${images.length} images`);
									}
								}
							}
						} else if (!connect) {
							// Disconnected - clear appropriate tracking data
							if (inputName === "images") {
								this._linkedAILNodeId = null;
								this._linkedImageCount = 0;
								this._linkedAILMode = null;
								this._linkedImages = [];
								this._linkedLatents = [];
								console.log("[RPG] Disconnected from primary AIL");
							} else if (inputName === "images2") {
								this._linkedImages2 = [];
								console.log("[RPG] Disconnected from secondary AIL (images2)");
							} else if (inputName === "images3") {
								this._linkedImages3 = [];
								console.log("[RPG] Disconnected from tertiary AIL (images3)");
							} else if (inputName === "images4") {
								this._linkedImages4 = [];
								console.log("[RPG] Disconnected from quaternary AIL (images4)");
							}
						}
						// If connect is true but link_info is null, skip (shouldn't happen)
						break; // Found matching input, stop loop
					}
				}

				// Re-render when connections change
				if (this._renderUI) {
					// Use longer delay if node isn't initialized yet to avoid race with initial render
					const delay = this._isInitialized ? 100 : 250;
					setTimeout(() => {
						console.log(`[RPG] Re-rendering after connection change. AIL mode: ${this._linkedAILMode}, initialized: ${this._isInitialized}`);
						this._renderUI();
					}, delay);
				}
				return result;
			};

			// === onRemoved Hook (Cleanup) ===
			const onRemoved = nodeType.prototype.onRemoved;
			nodeType.prototype.onRemoved = function () {
				// Clean up intervals
				if (this._dimensionCheckInterval) {
					clearInterval(this._dimensionCheckInterval);
					this._dimensionCheckInterval = null;
				}
				if (this._ailSyncInterval) {
					clearInterval(this._ailSyncInterval);
					this._ailSyncInterval = null;
				}
				if (this._heightSyncInterval) {
					clearInterval(this._heightSyncInterval);
					this._heightSyncInterval = null;
				}
				// Clean up ResizeObserver
				if (this._resizeObserver) {
					this._resizeObserver.disconnect();
					this._resizeObserver = null;
				}
				// Clean up seed update reference
				if (this._updateSeeds) {
					this._updateSeeds = null;
				}
				// Clean up BIG favorite event listener
				if (this._bigFavoriteHandler) {
					document.removeEventListener('instaraw-rpg-add-favorite', this._bigFavoriteHandler);
					this._bigFavoriteHandler = null;
				}
				console.log(`[RPG] Cleaned up node ${this.id}`);
				onRemoved?.apply(this, arguments);
			};
		}
	},
});