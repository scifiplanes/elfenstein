
We will be making a grid-based dungeon crawler game with first person 2.5d view. It will be web-based. It will be using 2d sprites.

The project architecture is set up for modularity and extendability, keeping content and functionality compartmentalised. All of the stats and content should support adding more.

We will be building it with future multiplayer in mind, which will be relying on a database operated by the main host player that 1-3 other players can connect to.

The UX is visual and contextual - the amount of available interactions at a given time is small, but they result in contextual interactions or modals. There is a wireframe of the main UI in hud_wireframe.jpg

Where content is missing - expand, using examples in this documentation as inspiration.

We will be maintaining an up to date design document as we go.

Mouse cursor feature:
	-The player's cursor is a hand.
	-The player can click on things to attempt using them.
	-When pointing at something active the hand changes to "Hand_Active".
	-The player is able to drag items by pressing and holding on them. (This changes the sprite of the cursor into Hand_Hold from its default Hand_Point state. The sprite of the item held follows the pointer)
	-The player can put items into their inventory.
	-Dragging and dropping an item onto another item triggers crafting and checks for compatible recipes. The order matters.
	-If compatible recipes are discovered a crafting feature is trigger.
	-If the player drags an item on top of the eye element of the player character portrait it triggers an inspect interaction.
	-If the player drags an item on top of the mouth element of the player character portrait it triggers a feeding interaction.
	-Interactions are announced with a contextual icon next to the interacting elements, informing the player of what will happen when they release the press and hold.
	

Inventory feature:
	- The inventory is shared across the entire player party. There is a large inventory panel with grid based management. 
	- Amount of available grid cells is informed by the total Endurance stats of the player party.
	- The inventory menu is scrollable (in sections, as opposed to continuously)
	- If the player drags an item out of their inventory into empty space in the 3d view they will drop that item there.
	- If the player drags an item out of their inventory onto an NPCs, the item is used on them. Some of the items will be rejected with a sound. Some of the items will be accepted and consumed, sometimes causing a change of status. Some of the items will cause an attack with that item.

Items:
	- The player discovers various items on the dungeon floor.
	- Items can be combined with other items in a large range of crafting recipes. Crafting interaction is triggered by dragging one item onto another. If a viable recipe is available - a visible timer follows, followed by a skill check and successfull craft result or failure notification. Failure has a chance of destroying one of the involved items.


NPC:
	-There are NPCs in the dungeon, spawned from a loot table which is informed by Floor Type, Floor Properties, Room function, Room properties.
	-The player can attack the NPC by dragging a weapon item onto them from inventory.
	-The player can also interact the NPC by simply walking into them or clicking them. Interaction type is contextual depending on NPC status.
	-Default walk-in attack resolves as attacks by player characters and NPCs as turns informed by Speed stats of everyone involved. 
	-Status: NPCs can be aggressive, neutral or friendly.
	-On death NPCs sometime drop items from their loot table onto the floor

NPC quests:
	-Sometimes the NPC talks to the player, asking them for an item in text. This text is in a gibberish language (but consistent, so the player can memorise the meaning).
	-Languages are: Deep Gnome, Zalgo, Mojibake.
	-If the player gives them the correct item it will change their status from Hostile to Neutral or from Neutral to Friendly.
	-Each NPC types has Hated items. Giving those to them will cause them to go Hostile always.

NPCs list(to be extended):
	-Swarm. The Swarm is Hostile, unless the player has a Swarm Queen item.
	-Catoctopus
	-Wurglepup
	-Bobr

Items list (to be extended):
	-Hive - on click spawns a Swarm. Has a small chance of spawning a Queen instead. Has a high chance of destruction on clicking.
	-Swarm Queen. Swarms are neutral to you.
	-Swarm Basket. Drag onto Swarm to capture it. Creates a Captured Swarm item out of the two.
	-Captured Swarm. Drag onto an enemy to release the swarm and cause a lot of damage.
	-Mushrooms. Feed to character to replenish Hunger, a little Stamina and a little HP. Have a tiny chance of giving Blessed status to Mycyclops species, and Sick to others.
	-Foodroot. Feed to character to replenish Hunger, a little Stamina and some HP.
	-Flourball. Feed to character to replenish Hunger, some Stamina and a little HP.
	-Waterbag (Empty). Use on well to transform into Waterbag (Full)
	-Waterbag (Full). Feed to character to replenish Thirst.
	-Club. Equip onto character to give their attacks extra damage (Blunt). Gets bonus damage from Strength
	-Bow. Equip onto character to give their attacks extra damage (Pierce). Gets bonus damage from Agility.
	-Spear. Equip onto character to give their attacks extra damage (Pierce). Gets bonus damage from Strength.
	-Stone. Equip onto character to give their attacks a bit extra damage (Blunt). Gets bonus damage from Strength. Is also used in many crafting recipes.
	-Stick.  Equip onto character to give their attacks a bit extra damage (Blunt). Gets bonus damage from Agility. Is also used in many crafting recipes.
	-Ash. Combined with Sulfur to create a Firebolt spell that attacks the enemy.
	-Sulfur. Combined with Ash to create a Fireshield spell that protects the player part temporarily.


Status effects:
	-Various status effects can be applied to player characters and NPCs. These can be positive, negative or neutral. Some of them have a decay timer, some stay until a required item is used on the character.
	-We will start with these (but will extend later): Poisoned, Blessed, Sick.



Paperdoll:
	-Clicking on a character portrait opens a paperdoll modal. It is positioned in a way that keeps inventory accessible. The player can drag and drop equipment items between inventory and paperdoll equipment slots.
	-Equipment slots depend on the character species (some are unavailable for certain species): Head (hats and helmets), left/right hand, feet, clothing, accesories.

UX:
	-Interactions resolve with a short animation of relevant elements (e.g. mouth or eyes moving) a sound, and a subtle camera shake for key interactions.

Portraits feature:
	- There are 4 portrait UI slots for player characters.
	- A player character is constructed out of base sprite, eyes sprite and mouth sprite. These are selected from a library of sprites categorised per species.
	- The middle third of the portrait is an interactive area that is split between the eyes area (top) and the mouth area (bottom), with little buffer between them.

Characters properties:
	- Species (we will start with Igor (goatmen race), Mycyclops (one-eyed mushroom person), Frosch (frog person), but will extend later)
	- Class (we will start with Warrior, Wizard, Cleric, but will extend later)
	- Culture (we will start with Barbarian, Villager, Nomad, but will extend later)
	- Ideology (we will start with Animist, Ancients, The One, but will extend later)
	- Sign (we will start with Arrow, Circle, Flame, but will extend later)
	- -
	- Experience
	- Level
	- HP
	- Stamina
	- Armor
	- Hunger
	- Thirst
	- Resistances: Blunt, Pierce, Cut, Fire, Water, Thunder, Earth
	- -
	- Stats: Strength, Agility, Speed, Perception, Endurance, Intelligence, Wisdom, Luck (keep it extendable)
	- -
	- -
	- Skills: weaving, chipping, cooking, foraging


Dungeon generation:
	- Floor types: Ruins, Dungeon, Cave. Floor type influences the generation algorithm. 
	- Floor properties: Infested, Cursed, Destroyed, Overgrown, None (not shown). Influences loot tables for POIs and NPCs.
	- Room function: Passage, Habitat, Workshop, Communal, Storage.
	- Room properties: Burning, Flooded, Infected. (These cause a resistance check and can cause damage if failed)
	- Room status: Overgrown, Destroyed, Collapsed.
	- Some of the passages are blocked by Doors of various types, which require an appropriate key.
	- There are areas with higher ceilings and deep pits, but the player can't look up or down, or fall into the pit.

Debug menu:
	- There should be a debug menu button in the main settings. It should be scrollable and have sections and search, as it will eventually have a lot of options.
	- Light slider
	- Distance Lowpass filter settings
	- Distance volume settings


Art content:
	- We will create a range of image files in the "placeholders" folder. We will use these as placeholder sprites that we will be gradually replacing with finished content. Duplicate files accordingly when needed.
	- Item (png with transparency)
	- Tile texture
	- NPC sprite (png with transparency)
	- Portrait
	- Mouth (png with transparency)
	- Eyes (png with transparency)

POIs
	- Occasionally the player encounters static points of interest. These can be interacted with by dragging items onto them or, clicking or "walking into" them.
	- We will start with the following, but will extend later:
	- Well - save point (with a clear notification)
	- Chest - opens (changes sprite) and drops a random item
	- Bed - full HP and Stamina

Audio:
	- NPCs and POIs emit sound from a few cells afar, attenuated by lowpass filter and volume


Graphics:
The renderer is Three.js WebGL with MeshStandardMaterial on all dungeon geometry. Antialiasing is off and pixel ratio is capped at 1.5×, keeping edges sharp in favour of the dithered look.
Lighting uses a warm PointLight on the camera (player lantern) plus up to six wall torch PointLights within the visible radius. Torch flicker is a per-torch sine wave on intensity. Ambient is near-zero so darkness is the actual default. FogExp2 handles depth falloff. All lighting parameters are live-tunable in the F2 debug panel.
Post-process ordered dithering runs as a ShaderPass in an EffectComposer chain. The fragment shader applies a Bayer matrix to the full rendered frame and exposes six controls:

Strength — blends dithered output against raw passthrough
Colour preserve — 0% is luminance-only (palette tint dominates); 100% dithers R/G/B independently, preserving the original hue of torchlight and enemies
Pixel size — pixelates before dithering, so the pattern tiles within blocks
Levels — quantisation steps from stark woodcut (2) to fine grain (24)
Matrix — Bayer 2×2 / 4×4 / 8×8, all baked as GLSL constants, switched at runtime via a float uniform without recompiling
Palette — five options compiled as GLSL vec3 arrays: Dungeon warm, Cold crypt, Monochrome, Sepia print, No palette snap



Dungeon generation strategy (starting point to iterate on):

1. BSP partition
Recursively split canvas into leaf rects. Min leaf size ~7×7. Max depth ~5. Store as binary tree.
2. Room carve
In each leaf, carve a room 60–80% of leaf size. Random offset. Mark as floor.
3. Corridor stitch
Walk tree bottom-up, L-bend corridors connecting sibling rooms. Guarantees full connectivity.
4. CA smoothing
1–2 passes of cellular automata on wall cells. Softens jagged edges, creates alcoves.
5. Room tagging
Classify rooms by size: tiny (closets), medium (fights), large (boss / special). Tag by depth in tree.
6. Population pass
Enemies, items, doors, torches placed per room tag + loot table. Entrance and exit guaranteed.
7. Theme injection
Tile variant selection from themes.json — crypt, sewer, fortress. Drives sprite + light palette.


Ideas (do not implement for now):
	-Left hand feature - there is a left hand on the screen that can hold an item from your inventory permanently. Useful for things like torches.
