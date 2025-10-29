/**
 * Configuration settings for the Language Evolution Simulator
 */

class CONFIG {
    // World generation
    static GRID_W = 60;
    static GRID_H = 60;
    static LAND_PROB_INIT = 0.08;  // increased for more interesting terrain
    static ISLAND_BIAS = 0.5;      // reduced for more varied landmass distribution
    static SMOOTH_STEPS = 4;       // reduced for more complex coastlines

    // Display
    static CANVAS_W = 1400;
    static CANVAS_H = 900;

    // Language evolution
    static STARTER_WORDS = [["k", "i", "t"], ["k", "o", "o", "t"], ["a", "p", "l"]];

    // Probabilities
    static P_MUTATE = 0.05;
    static P_SPREAD = 0.48;              // Increased from 0.12 for faster spread
    static P_BORROW = 0.12;
    static P_LANGUAGE_SPLIT = 0.03;
    static P_LONG_DISTANCE_SPREAD = 0.01; // Probability of long-distance spread
    static P_PRESTIGE_DRIFT = 0.15;       // Probability of prestige change per tick

    // Size-based splitting parameters
    static P_SIZE_SPLIT_BASE = 0.005;     // Base probability for size-based splitting
    static SIZE_SPLIT_THRESHOLD = 8;      // Minimum size before size-based splitting can occur
    static SIZE_SPLIT_SCALING = 0.002;    // Additional probability per speaker above threshold

    // Mutation weights (mutate / delete / add)
    static MUTATE_OP_WEIGHTS = [0.5, 0.25, 0.25];

    // Feature distance parameters
    static ADD_SWEET_DIST = 2.5;
    static ADD_SWEET_BETA = 0.8;
    static MUTATE_ALPHA = 0.6;

    // Borrowing parameters
    static PRESTIGE_BASE_SPREAD = 0.01;    // Base spread chance independent of prestige
    static PRESTIGE_SPREAD_WEIGHT = 0.05;  // Stronger prestige contribution to spread probability
    static PRESTIGE_BASE_BORROW = 0.03;    // Base borrowing chance independent of prestige
    static PRESTIGE_BORROW_WEIGHT = 0.2;   // Stronger prestige contribution to borrowing probability
    static ADAPTATION_STRENGTH = 0.8;

    // Prestige drift parameters
    static PRESTIGE_DRIFT_MAGNITUDE = 0.08;    // Maximum change per drift event
    static PRESTIGE_DRIFT_BIAS = 0.5;          // Bias toward middle value (0.5)
    static PRESTIGE_MIDDLE_BIAS_STRENGTH = 0.15; // Stronger pull toward middle value (increased from 0.05)
    static PRESTIGE_COMMUNITY_FEEDBACK = 3.0;   // Scales bias strength based on average prestige deviation
    static PRESTIGE_COMMUNITY_SHIFT = 0.04;     // Direct nudging based on community-wide average prestige

    // Long-distance interaction parameters
    static LONG_DISTANCE_RANGE = 8;      // Maximum distance for long-distance spread
    static LONG_DISTANCE_MIN = 3;        // Minimum distance to be considered long-distance

    // Language contiguity parameters
    static CONTIGUITY_STRICT = true;     // Enforce strict contiguity for languages
    static CONTIGUITY_ENFORCE_INTERVAL = 500; // Check contiguity every N ticks

    // Word length constraints
    static MIN_WORD_LENGTH = 2;          // Minimum phonemes per word
    static MAX_WORD_LENGTH = 12;         // Maximum phonemes per word
    static PREFERRED_PHONEME_COUNT_RANGE = [3, 7]; // Range for language's preferred phoneme count

    // Phonological inventory drift parameters
    static P_PHONEME_ADD = 0.7;          // Probability of adding phonemes to inventory
    static P_PHONEME_REMOVE = 0.7;       // Probability of removing phonemes from inventory
    static P_PHONEME_SUBSTITUTE = 0.5;   // Probability of substituting phonemes in inventory
    static MIN_PHONEME_INVENTORY_SIZE = 12; // Minimum inventory size before allowing removal
    static MIN_VOWEL_COUNT = 3;          // Minimum number of vowels to maintain

    // Phoneme inventory optimization biases
    static P_OPTIMIZE_ADD = 0.7;         // Probability of optimization when adding phonemes
    static P_OPTIMIZE_REMOVE = 0.8;      // Probability of optimization when removing phonemes

    // Syllable structure biasing parameters
    static SYLLABLE_PREF_WEIGHT = 0.3;   // Weight for syllable structure preferences
    static SYLLABLE_BETA = 2.0;          // Strength of syllable structure biasing

    // Default syllable structure weights
    static DEFAULT_SYLLABLE_SHAPES = {
        "CV": 0.4,    // Most preferred (consonant-vowel)
        "CVC": 0.3,   // Second most preferred
        "V": 0.15,    // Vowel-only syllables
        "CCV": 0.1,   // Complex onset
        "VC": 0.05    // Vowel + coda
    };
    static DISPERSION_WEIGHT = 0.7;      // Weight for dispersion in substitution (vs similarity)
    static SIMILARITY_WEIGHT = 0.3;      // Weight for similarity in substitution
    static DISPERSION_TOLERANCE = -0.1;  // Minimum allowed dispersion change in substitution

    // Phonotactic constraint drift parameters
    static P_CONSTRAINT_DRIFT = 0.15;    // Overall probability of constraint changes
    static P_SYLLABLE_DRIFT = 0.5;       // Probability of syllable preference changes
    static P_GEMINATION_DRIFT = 0.3;     // Probability of gemination setting changes
    static P_WORD_LENGTH_DRIFT = 0.4;    // Probability of word length preference changes
    static GEMINATION_PROB_RANGE = [0.02, 0.15]; // Range for gemination probability
    static SYLLABLE_COUNT_RANGE = [1, 4]; // Range for preferred syllable count

    // Language evolution timing parameters
    static EVOLUTION_INTERVAL = 50;      // Minimum ticks between evolution cycles
    static SAMPLE_SIZE_LEXICON = 20;     // Number of words to sample for sound changes

    // Constraint evolution parameters
    static P_SYLLABLE_EVOLUTION = 0.05;  // Probability of syllable structure evolution
    static P_CLUSTER_EVOLUTION = 0.03;   // Probability of consonant cluster evolution
    static P_CODA_EVOLUTION = 0.04;      // Probability of coda restriction evolution

    // Name evolution parameters
    static P_NAME_MUTATION = 0.05;       // Probability of random name mutation per cycle

    // Phonological rule system parameters
    static P_RULE_GENERATION_BASE = 0.05; // Base probability for generating new rules
    static RULE_PRODUCTIVITY_THRESHOLD = 0.001; // Minimum productivity before rule removal
    static RULE_DECAY_RATE_DEFAULT = 0.0; // Default decay rate for new rules
    static RULE_STRENGTH_DEFAULT = 1.0;   // Default strength for new rules
    static RULE_PRODUCTIVITY_DEFAULT = 1.0; // Default productivity for new rules

    // Sound change application parameters
    static SOUND_CHANGE_CONSERVATISM_FACTOR = 1.0; // Multiplier for conservatism effects
    static CONTACT_PRESSURE_CAP = 0.5;     // Maximum contact pressure influence
    static CONTACT_INFLUENCE_FACTOR = 0.1; // Base contact influence per language
    static MAX_CONTACT_LANGUAGES = 3;      // Maximum number of contact languages considered

    // Phonological weight and distance parameters
    static SUBSTITUTION_FEATURE_THRESHOLD = 0.7; // Threshold for feature-based substitution
    static PHONEME_DISTANCE_SCALING = 1.0; // Scaling factor for phonological distances

    // Initial language generation parameters
    static MIN_INITIAL_VOWELS = 3;        // Minimum vowels in initial phoneme inventory
    static INITIAL_INVENTORY_SIZE_RANGE = [15, 25]; // Range for initial inventory size
    static CONSTRAINT_PROFILE_WEIGHTS = [0.5, 0.3, 0.2]; // Weights for constraint profile selection
    static EPENTHETIC_VOWEL_CHOICES = ["ə", "i", "a"]; // Available epenthetic vowels
    static PRESTIGE_RANGE = [0.1, 0.9];    // Range for initial language prestige
    static CONSERVATISM_RANGE = [0.3, 0.8]; // Range for initial language conservatism

    // Display
    static DRAW_BOUNDARIES = true;
    static MAX_FONT_PX = 16;
    static MIN_FONT_PX = 8;

    // Console output
    static PRINT_STATS = true;
    static STATS_INTERVAL = 50;
    static LEADERBOARD_TOPK = 8;

    // Web-specific settings
    static DEFAULT_FPS = 20;              // Default simulation speed
    static MIN_FPS = 1;
    static MAX_FPS = 100;
    static AUTOSAVE_INTERVAL = 1000;      // Autosave every N ticks
    static MAX_HISTORY_LENGTH = 100;      // Maximum length of prestige history

    /**
     * Get a configuration value with validation
     */
    static get(key) {
        if (this.hasOwnProperty(key)) {
            return this[key];
        }
        console.warn(`Configuration key '${key}' not found`);
        return undefined;
    }

    /**
     * Set a configuration value with validation
     */
    static set(key, value) {
        if (this.hasOwnProperty(key)) {
            this[key] = value;
            return true;
        }
        console.warn(`Configuration key '${key}' not found`);
        return false;
    }

    /**
     * Export current configuration as JSON
     */
    static export() {
        const config = {};
        for (const key of Object.getOwnPropertyNames(this)) {
            if (!key.startsWith('_') && typeof this[key] !== 'function') {
                config[key] = this[key];
            }
        }
        return JSON.stringify(config, null, 2);
    }

    /**
     * Import configuration from JSON
     */
    static import(jsonString) {
        try {
            const config = JSON.parse(jsonString);
            for (const [key, value] of Object.entries(config)) {
                if (this.hasOwnProperty(key)) {
                    this[key] = value;
                }
            }
            return true;
        } catch (error) {
            console.error('Failed to import configuration:', error);
            return false;
        }
    }

    /**
     * Reset to default values
     */
    static reset() {
        // Reset to original values - this would need to be updated if defaults change
        this.GRID_W = 60;
        this.GRID_H = 60;
        this.LAND_PROB_INIT = 0.08;
        this.ISLAND_BIAS = 0.5;
        this.SMOOTH_STEPS = 4;
        this.P_MUTATE = 0.05;
        this.P_SPREAD = 0.48;
        this.P_BORROW = 0.12;
        this.P_LANGUAGE_SPLIT = 0.03;
        this.P_LONG_DISTANCE_SPREAD = 0.01;
        this.DRAW_BOUNDARIES = true;
        this.PRINT_STATS = true;
        // Add other defaults as needed
    }

    /**
     * Validate configuration values
     */
    static validate() {
        const errors = [];

        if (this.GRID_W < 10 || this.GRID_W > 500) {
            errors.push('GRID_W must be between 10 and 500');
        }

        if (this.GRID_H < 10 || this.GRID_H > 500) {
            errors.push('GRID_H must be between 10 and 500');
        }

        if (this.LAND_PROB_INIT < 0.001 || this.LAND_PROB_INIT > 0.5) {
            errors.push('LAND_PROB_INIT must be between 0.001 and 0.5');
        }

        if (this.ISLAND_BIAS < 0 || this.ISLAND_BIAS > 1) {
            errors.push('ISLAND_BIAS must be between 0 and 1');
        }

        // Add more validation as needed

        return errors;
    }
}

// Make CONFIG available globally
window.CONFIG = CONFIG;
