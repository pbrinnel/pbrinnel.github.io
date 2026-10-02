// ---- FOUR KEYS: lore ------------------------------------------------------------
// One line of the world, under PAUSED, and under READY once you are down a
// head, so never on the first serve of a run (Paul, 2 Oct 2026). A
// line is drawn at random when the screen comes up and holds while it stays,
// and never the same line twice running. Every line is open from the start:
// they are vague enough not to give the story away.
//
// Never a nickname here. Every character is BRANDON (see MEM_VOICE in memory.js).
const LORE = [
    'They raised you out of the army with a single touch. They never said what for.',
    'You stood at the front of the rally. You stand at the front of something else now.',
    'Everything here is Brandon: the walls, the guardians, the paddle you hold. Choose carefully which of him you break.',
    'The old champion was grey when they found him. Rest a moment. You are greying too.',
    "Once the crowd cheered a single name. It was yours. It was everyone's.",
    'Somewhere a halo is missing pieces. They keep falling into you.',

    'Keep the head in the air. The moment it touches the ground, it stops being yours.',
    'Every wall you break was built by a Brandon. Every head you send back was one too.',
    'Each guardian keeps a paddle. Each paddle belonged to someone.',
    'The head does not mind being struck. It minds being missed.',
    'Your paddle remembers every head it has turned away.',
    'Each memory you earn was dropped where you would find it.',
    'A clean run proves nothing to them. It only proves you can do it again.',
    "Don't count the bricks. They are counting you.",

    'The town was quiet when you left it. It will be quiet when you return. Quiet is not the same as safe.',
    'The FARM stands nearest to home. Nobody remembers when that became a warning.',
    'The RUINS were not ruins the last time you saw them.',
    'In the CITY there is never just one of anything.',
    'The VOLCANO lights only what burns. Keep moving.',
    'The CASTLE stood before the war began, and it means to be standing when the war ends.',

    'The five were Brandons once. You have to stop them anyway.',
    'Someone with a halo once asked whether it ever ends. Nobody gave him an answer he could live with.',
    'The army is still out there, rank on rank, waiting to be told who the enemy is.',
    'Some Brandons hang on strings. Most never look up long enough to see them.',
    'A thousand years they waited for an hour like this one. You are the hour.',
    'They promised the war would end. They never said who would end it.',

    'BRANDON WINS. The world has never finished that sentence.',
    'History belongs to whoever is still holding the paddle.',
    'Every time the head comes back to you, it has seen a little more.',
    'One day another Brandon will stand where you are standing and ask what you fought for. Have an answer ready.',
    'The war ended once before. How many more times will it end?',
    'Every hero in this world ends up on a wall, or behind a door. Keep going.',
    'You are the last thing between the town and what made it.'
];

let loreLast = -1;

function lorePick() {
    const fresh = loreLast < 0;
    let i = Math.floor(Math.random() * (fresh ? LORE.length : LORE.length - 1));
    if (!fresh && i >= loreLast) i++;            // steps over the one just shown
    loreLast = i;
    return LORE[i];
}
