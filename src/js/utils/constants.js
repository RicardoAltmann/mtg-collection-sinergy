/**
 * Constants and configuration for MTG Collection Synergy Analyzer
 * @module utils/constants
 */

/**
 * Staples categorized by function for EDH/Commander format
 * These are format staples that are commonly played across many decks
 * @type {Object.<string, string[]>}
 */
export const STAPLES = {
    ramp: ['sol ring', 'arcane signet', 'fellwar stone', 'commander sphere', 'chromatic lantern',
           'jeweled lotus', 'mana crypt', 'mana vault', 'grim monolith', 'basalt monolith',
           'worn powerstone', 'thran dynamo', 'gilded lotus', 'coalition relic', 'sisay\'s ring',
           'cultivate', 'kodama\'s reach', 'rampant growth', 'farseek', 'nature\'s lore',
           'three visits', 'skyshroud claim', 'explosive vegetation'],
    card_draw: ['rhystic study', 'mystic remora', 'esper sentinel', 'sylvan library', 'phyrexian arena',
               'necropotence', 'read the bones', 'night\'s whisper', 'sign in blood', 'harmonize',
               'elemental bond', 'guardian project', 'the great henge'],
    removal: ['path to exile', 'swords to plowshares', 'generous gift', 'beast within',
             'chaos warp', 'terminate', 'anguished unmaking', 'vindicate', 'assassin\'s trophy',
             'mortify', 'putrefy', 'abrupt decay', 'nature\'s claim', 'disenchant',
             'naturalize', 'return to dust', 'wear // tear', 'krosan grip'],
    board_wipes: ['wrath of god', 'damnation', 'blasphemous act', 'toxic deluge', 'cyclonic rift',
                 'merciless eviction', 'austere command', 'vandalblast', 'farewell'],
    tutors: ['demonic tutor', 'vampiric tutor', 'mystical tutor', 'worldly tutor', 'enlightened tutor',
            'gamble', 'diabolic tutor', 'beseech the queen', 'congregation at dawn'],
    counterspells: ['counterspell', 'swan song', 'negate', 'arcane denial', 'dispel', 'spell pierce',
                   'force of will', 'pact of negation', 'mana drain', 'fierce guardianship'],
    lands: ['command tower', 'exotic orchard', 'reflecting pool', 'city of brass', 'mana confluence',
           'command beacon', 'ancient tomb', 'reliquary tower', 'temple of the false god'],
    protection: ['heroic intervention', 'teferi\'s protection', 'boros charm', 'flawless maneuver',
                'lightning greaves', 'swiftfoot boots', 'champion\'s helm'],
    recursion: ['eternal witness', 'regrowth', 'noxious revival', 'reanimate', 'animate dead',
               'necromancy', 'dance of the dead', 'sun titan'],
    combos: ['thassa\'s oracle', 'demonic consultation', 'tainted pact', 'isochron scepter',
            'dramatic reversal', 'underworld breach', 'worldgorger dragon', 'animate dead']
};

/**
 * Known two-card combos in the format
 * Maps card names to their combo partners
 * @type {Object.<string, string[]>}
 */
export const KNOWN_COMBOS = {
    'thassa\'s oracle': ['demonic consultation', 'tainted pact'],
    'demonic consultation': ['thassa\'s oracle', 'laboratory maniac'],
    'tainted pact': ['thassa\'s oracle', 'laboratory maniac'],
    'isochron scepter': ['dramatic reversal'],
    'dramatic reversal': ['isochron scepter'],
    'worldgorger dragon': ['animate dead', 'necromancy', 'dance of the dead'],
    'animate dead': ['worldgorger dragon'],
    'kiki-jiki, mirror breaker': ['zealous conscripts', 'deceiver exarch', 'pestermite'],
    'splinter twin': ['zealous conscripts', 'deceiver exarch', 'pestermite'],
    'mikaeus, the unhallowed': ['walking ballista', 'triskelion'],
    'walking ballista': ['mikaeus, the unhallowed', 'heliod, sun-crowned'],
    'heliod, sun-crowned': ['walking ballista']
};

/**
 * Semantic concept dictionary for advanced synergy detection
 * Each concept has keywords to match and a score value
 * @type {Object.<string, {keywords: string[], score: number, description: string}>}
 */
export const SYNERGY_CONCEPTS = {
    card_advantage: {
        keywords: [
            'draw', 'draws', 'drawing',
            'look at the top',
            'reveal.*card',
            'search your library',
            'scry', 'surveil'
        ],
        score: 10,
        description: 'generación de ventaja de cartas'
    },

    mana_ramp: {
        keywords: [
            'search.*land', 'search.*basic',
            'search your library for a.*land',
            'add \\{c\\}', 'add \\{w\\}', 'add \\{u\\}', 'add \\{b\\}', 'add \\{r\\}', 'add \\{g\\}',
            'add one mana', 'add two mana', 'add three mana',
            'untap.*land',
            'put.*land.*battlefield'
        ],
        score: 12,
        description: 'aceleración de maná'
    },

    token_generation: {
        keywords: [
            'create.*token',
            'put.*token.*battlefield',
            'populate',
            'copy.*creature'
        ],
        score: 10,
        description: 'generación de tokens'
    },

    graveyard_recursion: {
        keywords: [
            'return.*from.*graveyard',
            'return.*graveyard.*battlefield',
            'return.*graveyard.*hand',
            'reanimate', 'unearth', 'flashback',
            'escape', 'disturb', 'embalm', 'eternalize'
        ],
        score: 12,
        description: 'recursión de cementerio'
    },

    sacrifice_outlet: {
        keywords: [
            'sacrifice',
            'as an additional cost',
            'dies', 'when.*dies', 'whenever.*dies'
        ],
        score: 12,
        description: 'mecánicas de sacrificio'
    },

    counter_theme: {
        keywords: [
            '\\+1/\\+1 counter',
            'proliferate',
            'adapt', 'monstrosity', 'bolster',
            'put.*counter'
        ],
        score: 18,
        description: 'tema de contadores'
    },

    lifegain_theme: {
        keywords: [
            'gain.*life', 'you gain',
            'whenever you gain life',
            'lifelink',
            'extort'
        ],
        score: 10,
        description: 'tema de ganancia de vida'
    },

    artifact_synergy: {
        keywords: [
            'artifact you control',
            'whenever.*artifact enters',
            'sacrifice an artifact',
            'affinity for artifacts',
            'improvise'
        ],
        score: 12,
        description: 'sinergia con artefactos'
    },

    enchantment_synergy: {
        keywords: [
            'enchantment you control',
            'whenever.*enchantment enters',
            'constellation',
            'enchant'
        ],
        score: 12,
        description: 'sinergia con encantamientos'
    },

    spellslinger: {
        keywords: [
            'whenever you cast an instant',
            'whenever you cast a sorcery',
            'instant or sorcery',
            'prowess', 'storm',
            'magecraft', 'copy.*instant', 'copy.*sorcery'
        ],
        score: 15,
        description: 'tema de instant/sorcery'
    },

    etb_triggers: {
        keywords: [
            'enters the battlefield',
            'when.*enters', 'whenever.*enters',
            'blink', 'flicker'
        ],
        score: 10,
        description: 'disparadores de entrar al campo'
    },

    combat_matters: {
        keywords: [
            'whenever.*attacks',
            'whenever.*deals combat damage',
            'combat damage to a player',
            'exalted', 'battle cry'
        ],
        score: 12,
        description: 'estrategia de combate'
    },

    discard_matters: {
        keywords: [
            'discard',
            'whenever.*discard',
            'madness', 'cycling',
            'hellbent'
        ],
        score: 10,
        description: 'mecánicas de descarte'
    },

    mill_matters: {
        keywords: [
            'mill', 'put.*cards.*graveyard.*library',
            'whenever.*card.*put into.*graveyard'
        ],
        score: 10,
        description: 'mecánicas de mill'
    },

    tribal_support: {
        keywords: [
            'shares a creature type',
            'choose a creature type',
            'of the chosen type',
            'tribal'
        ],
        score: 15,
        description: 'soporte tribal genérico'
    }
};

/**
 * Role weighting by archetype for deck balance analysis
 * Higher values mean the role is more important for that archetype
 * @type {Object.<string, Object.<string, number>>}
 */
export const ARCHETYPE_WEIGHTS = {
    aggro: {
        ramp: 1.3,
        card_draw: 1.0,
        removal: 0.8,
        board_wipes: 0.5,
        tutors: 0.9,
        counterspells: 0.6,
        protection: 1.4,
        threat: 1.5,
        value_engine: 0.8,
        win_condition: 1.2
    },
    control: {
        ramp: 1.2,
        card_draw: 1.8,
        removal: 1.8,
        board_wipes: 1.8,
        tutors: 1.3,
        counterspells: 2.0,
        protection: 1.3,
        threat: 0.7,
        value_engine: 1.4,
        win_condition: 1.5
    },
    combo: {
        ramp: 1.5,
        card_draw: 1.6,
        removal: 1.0,
        board_wipes: 0.8,
        tutors: 2.5,
        counterspells: 1.5,
        protection: 1.8,
        threat: 0.5,
        value_engine: 1.0,
        win_condition: 2.0,
        combos: 2.5
    },
    midrange: {
        ramp: 1.4,
        card_draw: 1.4,
        removal: 1.5,
        board_wipes: 1.3,
        tutors: 1.2,
        counterspells: 1.0,
        protection: 1.2,
        threat: 1.3,
        value_engine: 1.6,
        win_condition: 1.4
    },
    ramp: {
        ramp: 2.0,
        card_draw: 1.5,
        removal: 1.0,
        board_wipes: 1.2,
        tutors: 1.4,
        counterspells: 0.8,
        protection: 1.0,
        threat: 1.0,
        value_engine: 1.3,
        win_condition: 1.8
    },
    voltron: {
        ramp: 1.3,
        card_draw: 1.2,
        removal: 1.0,
        board_wipes: 0.6,
        tutors: 1.5,
        counterspells: 0.8,
        protection: 2.5,
        threat: 0.6,
        value_engine: 0.8,
        win_condition: 1.8,
        equipment: 2.0,
        aura: 2.0
    },
    stax: {
        ramp: 1.4,
        card_draw: 1.6,
        removal: 1.5,
        board_wipes: 1.5,
        tutors: 1.8,
        counterspells: 1.6,
        protection: 1.4,
        threat: 0.8,
        value_engine: 1.3,
        win_condition: 1.5,
        stax_piece: 2.0
    }
};
