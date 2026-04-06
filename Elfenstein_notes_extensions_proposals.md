Elfenstein notes – extension proposals

This file contains proposed additions for categories in `Elfenstein_notes.md` marked “to be extended” / “but will extend later”.
It is intentionally kept separate so the original notes document stays unchanged.

----------------------------------------------------------------------
A) Crafting rule clarification + Ash/Sulfur contradiction fix (order matters)
----------------------------------------------------------------------

Mouse cursor feature – crafting rule text (proposed wording):
	-Dragging and dropping an item onto another item triggers crafting and checks for compatible recipes. The order matters (item A dropped onto item B can differ from item B dropped onto item A).

Items list – clarify Ash/Sulfur recipes to be order-explicit:
	-Ash. Drag Ash onto Sulfur to craft Firebolt (consumable spell item) that attacks an enemy.
	-Sulfur. Drag Sulfur onto Ash to craft Fireshield (consumable spell item) that temporarily protects the player party.

(Design note: This pair becomes the canonical example of order-dependent crafting.)

----------------------------------------------------------------------
B) NPCs list (to be extended) – extensions
----------------------------------------------------------------------

NPCs list (proposals)
	-Mycyclops Forager. Neutral by default. Likes Mushrooms and Foodroot. Hates Firebolt-related items.
	-Igor Scavenger. Neutral by default. Trades for Stone/Stick/Bow-tier gear. If given Sulfur becomes Hostile.
	-Frosch Lanternbearer. Friendly if given Waterbag (Full). Can “bless” a torch-lit room (reduced ambush chance briefly).
	-Ruin Scribe. Friendly if given Ash (ink substitute). Gives a gibberish hint about nearby POI or key door type.
	-Keysniffer Mutt. Neutral. If fed Flourball, briefly highlights door/key interactions in the current room.
	-Door Warden. Hostile. Protects a door/threshold. Calms if given a matching Sigil Token.
	-Mire Leech. Hostile. Often spawned in Flooded rooms. Inflicts Drain.
	-Ember Mote. Neutral until attacked. Spawns in Burning rooms. Dropping Waterbag (Full) on it disperses it.
	-Cult Carrier. Neutral. Requests an ideology-themed item; success makes it Friendly, failure can spread Cursed.
	-Mycospore Child. Friendly to Mycyclops party members; Neutral otherwise. Can apply Blessed (rare) when fed Mushrooms.

Additional NPC proposals
	-Moss Knight. Neutral by default. Likes Waterbag (Full) and Mushrooms. Hates Ash. Becomes Friendly in Overgrown rooms if satisfied.
	-Tin Saint. Neutral. Requests Flourball. Hates Stone Shard. If helped, gives a gibberish “safe room” hint.
	-Salt Nun. Neutral. Requests Salt Pouch. Hates Captured Swarm. If satisfied, reduces Sick chance briefly (flavor: “absolves your meal”).
	-Grease Scribe. Neutral. Requests Tar Rag. Hates Waterbag (Empty). Trades in scribbled gibberish.
	-Crackbone Harrier. Hostile. Hates Bandage Strip (targets the weak). Drops Bone Key rarely.
	-Latch Wisp. Neutral. Requests Rusty Key (any key). Hates Sigil Token. If satisfied, won’t attack near doors for a while.
	-Rubble Cousin. Neutral. Requests Club/Spear. Hates Swarm Basket. If satisfied, drops Stone/Stick.

----------------------------------------------------------------------
C) Items list (to be extended) – extensions
----------------------------------------------------------------------

Items list (proposals)
	-Ropecoil. Drag onto a pit edge POI to secure it (unlocks a shortcut / prevents a hazard check in that cell).
	-Rusty Key. Opens some common doors (consumed on use). Can be inspected for hints (shows Floor Type glyph).
	-Bone Key. Opens cursed doors. Using it has a small chance to apply Cursed to the party.
	-Torch. Drag into the 3d view to place as a temporary light source (consumed over time).
	-Tar Rag. Combine with Torch to extend duration. Drag onto a door hinge to reduce “jam” chance.
	-Salt Pouch. Drag onto the floor to repel Swarm/Leeches for a few turns.
	-Bandage Strip. Apply to a character to remove Bleeding and restore a little HP.
	-Antitoxin Vial. Apply to remove Poisoned.
	-Herb Poultice. Apply to remove Sick. Small chance to apply Drowsy.
	-Stone Shard. Crafting byproduct. Equip as tiny Pierce damage; also used to chip Cracked Walls. Also found as loose debris in Ruins / Destroyed rooms (common), and occasionally drops from Cracked Wall attempts.
	-Chisel. Drag onto Cracked Wall to open it (skill check: chipping). Can break on failure.
	-Lockpick Reed. Drag onto locked chest/door (skill check: weaving or Perception). Consumed on use. Usually found as loot in Storage/Workshop rooms (so locked containers are not self-gating).
	-Idol Fragment. Drag onto portrait eye to “remember” (inspect) and reveal a room tag on the current floor.
	-Sigil Token (Arrow/Circle/Flame/etc). Used on Door Warden / sigil doors to pacify or open. Found as: rare Chest loot, Altar Bowl outcomes, and occasional NPC quest rewards (Ruin Scribe / Cult Carrier).
	-Map Scrap. Use to reveal a small cluster of rooms (one-time).
	-Bell Pebble. Throw/drop to lure Neutral NPCs or distract Hostile ones for one turn (sound).

Additional items to support chains and loot texture
	-Resin Lump. Sticky crafting component. Often found in Cave floors.
	-Twine Bundle. Crafting component (weaving).
	-Cloth Scrap. Crafting component; can be made into Bandage Strips.
	-Grease Candle. Temporary light source (short duration, low radius).
	-Bone Shard. Crafting component; sometimes dropped by Harriers/Leeches.
	-Charcoal. Crafting component; common in Burning rooms / near Campfire Remains.
	-Metal Scrap. Crafting component; common in Dungeon floors / Workshop rooms.
	-Grease. Crafting component; can be smeared into candles/torches.

Door/key mapping (content rule of thumb)
	-Common locks -> Rusty Key or Lockpick Reed
	-Cursed locks -> Bone Key (risky)
	-Sigil locks -> matching Sigil Token (preferred) or a rare key outcome

----------------------------------------------------------------------
D) Status effects (but will extend later) – extensions
----------------------------------------------------------------------

Status effects (proposals)
	-Bleeding (negative, decay): takes small HP damage per turn; removed by Bandage Strip.
	-Burning (negative, short): takes fire damage; removed by Waterbag (Full) or time.
	-Drain (negative, short/decay): reduces Stamina each turn (or reduces Stamina regen). Common from Mire Leech. Removed by rest (Bed) or time.
	-Drenched (neutral, short): increases Water resistance, decreases Fire resistance; common in Flooded rooms.
	-Drowsy (negative, short): lowers Speed; can happen from Herb Poultice.
	-Focused (positive, short): raises Perception; gained from successful Inspect interactions.
	-Cursed (negative, persistent): lowers Luck; removed by a Shrine POI or rare item.
	-Frightened (negative, short): reduces damage dealt; common after ambush / loud NPC roar.
	-Rooted (negative, short): can’t move for 1–2 turns; common from Swarm/Leech effects.
	-Shielded (positive, short): reduces incoming damage; gained from Fireshield (Ash/Sulfur order-dependent craft).
	-Starving (negative, persistent until fed): lowers Endurance/Strength; triggered at 0 Hunger.
	-Dehydrated (negative, persistent until watered): lowers Speed/Perception; triggered at 0 Thirst.

----------------------------------------------------------------------
E) Character properties (but will extend later) – extensions
----------------------------------------------------------------------

Character properties (proposals)
	- Species additions: Ratling, Wispkin, Golemlet, Crowfolk.
	- Class additions: Ranger, Rogue, Alchemist, Bard.
	- Culture additions: Monastic, Delver, Merchant, Outcast.
	- Ideology additions: The Lantern, The Maw, The Garden, The Forge.
	- Sign additions: Key, Eye, Crown, Wave, Stone.

----------------------------------------------------------------------
F) POIs (but will extend later) – extensions
----------------------------------------------------------------------

POIs (proposals)
	- Shrine - removes Cursed (or applies a blessing with a small risk)
	- Cracked Wall - can be opened with Chisel/Stone Shard (chipping skill check) to reveal a cache/shortcut
	- Locked Door (Sigil) - requires matching Sigil Token or a key; wrong attempt may trigger an ambush
	- Pit Edge - risk check on “walk into”; can be secured with Ropecoil to unlock safe passage/shortcut
	- Campfire Remains - drag Foodroot/Flourball to cook (cooking check) for stronger food
	- Mushroom Patch - harvest Mushrooms (foraging check); failure can apply Sick
	- Torch Sconce - place Torch to increase local light radius; may attract some NPCs
	- Notice Board / Carving - inspect to get a gibberish hint about floor properties or nearby quest NPC
	- Altar Bowl - drag items to “offer”; outcome depends on Ideology and Sign (can spawn items/status)

----------------------------------------------------------------------
G) Crafting chains (examples using existing + proposed items)
----------------------------------------------------------------------

Notes:
- Crafting is order-dependent; chains below specify “Drag X onto Y -> Result”.
- These are content examples compatible with the existing drag-to-craft UX (timer + skill check).

1) Cloth -> healing supply
	-Drag Cloth Scrap onto Twine Bundle -> Bandage Strip (bundle)
	-Drag Bandage Strip onto Antitoxin Vial -> Treated Bandage (removes Poisoned on use; consumed)
	-Drag Bandage Strip onto Herb Poultice -> Herbal Wrap (removes Sick on use; consumed)

2) Torch duration (existing Torch + Tar Rag)
	-Drag Tar Rag onto Torch -> Torch (Long Burn)

3) Cheap light (candle)
	-Drag Grease onto Cloth Scrap -> Grease Candle
	-Drag Grease Candle onto Torch Sconce (POI) -> Sconce Lit (local light increase)

4) Entry tools (support POIs)
	-Drag Metal Scrap onto Stone Shard -> Chisel
	-Drag Metal Scrap onto Twine Bundle -> Lockpick Reed

5) Fire components (order-dependent Ash/Sulfur)
	-Drag Ash onto Sulfur -> Firebolt
	-Drag Sulfur onto Ash -> Fireshield
	-Drag Charcoal onto Ash -> Ember Dust
	-Drag Ember Dust onto Torch -> Torch (Hot) (brighter but shorter; optional outcome)

6) Swarm kit extensions (builds on existing Swarm Basket path)
	-Drag Swarm Basket onto Swarm -> Captured Swarm (existing)
	-Drag Salt Pouch onto floor -> Repel zone (few turns) (field use)
	-Drag Captured Swarm onto enemy -> Release (existing)

7) Exploration intel (items + inspect loop)
	-Drag Idol Fragment onto portrait eye -> Floor Memory (reveals a room tag on the current floor)
	-Drag Map Scrap onto Idol Fragment -> Annotated Map Scrap (reveals a slightly larger cluster)

----------------------------------------------------------------------
H) Logical bug fixes + hard-lock prevention rules (additions to proposals)
----------------------------------------------------------------------

Add these rules to the `Elfenstein_notes.md` Dungeon generation / Population pass section (proposal-only; do not implement yet):

	-Guaranteed unlock sources per floor:
		-Each floor guarantees at least one of: Rusty Key, Lockpick Reed, or a non-locked alternate route that bypasses at least one locked threshold.

	-No critical path behind Sigil gating unless tokens are guaranteed:
		-Sigil-locked doors cannot be on the only Entrance->Exit critical path unless at least one matching Sigil Token is guaranteed earlier on the floor (Chest/Notice Board/Altar Bowl loot or an NPC trade).

	-Cracked Wall cannot be required unless at least one opener is guaranteed:
		-Cracked Walls never block the only Entrance->Exit critical path unless a Stone Shard or Chisel is guaranteed earlier on the floor.

	-Consumable key safety:
		-If Rusty Key is consumed on use, critical path locks must not require more than the number of guaranteed keys/lockpicks available before them.
