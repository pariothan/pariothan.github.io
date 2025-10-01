/**
 * Phonological system with distinctive features and sound inventories
 * Ported from the original Python implementation
 */

// Distinctive features for phonological representation
const FEATURES = [
    "syllabic",      // + vowel, - consonant
    "consonantal",   // + consonant, - vowel/glide
    "sonorant",      // + vowels, nasals, liquids, glides; - obstruents
    "continuant",    // + fricatives/liquids/glides, - stops/nasals
    "nasal",         // + m n ŋ, - otherwise
    "lateral",       // + l
    "voice",         // + voiced
    "labial",        // + p b f v m w, rounded vowels
    "coronal",       // + t d s z ʃ ʒ n l r
    "dorsal",        // + k g j w vowels
    "high",          // + i u, - a
    "low",           // + a
    "back",          // + u o, - i e
    "round",         // + u o w; - i e
    "tense",         // + tense vowels, - lax vowels
    "distributed",   // + alveolar/dental, - palatal/retroflex
    "strident",      // + s z ʃ ʒ f v, - θ ð
    "anterior",      // + labial/dental/alveolar, - palatal/velar
];

/**
 * Create feature vector with specified values
 */
function fv(features) {
    const vec = Object.fromEntries(FEATURES.map(f => [f, 0]));
    Object.assign(vec, features);
    return FEATURES.map(f => vec[f]);
}

// Phoneme inventory with distinctive features
const PHONEMES = {
    // Basic vowels
    "i": fv({syllabic: +1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, high: +1, low: -1, back: -1, round: -1, tense: +1}),
    "ɪ": fv({syllabic: +1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, high: +1, low: -1, back: -1, round: -1, tense: -1}),
    "e": fv({syllabic: +1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, high: 0, low: 0, back: -1, round: -1, tense: +1}),
    "ɛ": fv({syllabic: +1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, high: -1, low: 0, back: -1, round: -1, tense: -1}),
    "æ": fv({syllabic: +1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, high: -1, low: +1, back: -1, round: -1, tense: -1}),
    "a": fv({syllabic: +1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, high: -1, low: +1, back: 0, round: -1, tense: +1}),
    "ɑ": fv({syllabic: +1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, high: -1, low: +1, back: +1, round: -1, tense: +1}),
    "ɔ": fv({syllabic: +1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: +1, coronal: -1, dorsal: +1, high: -1, low: 0, back: +1, round: +1, tense: -1}),
    "o": fv({syllabic: +1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: +1, coronal: -1, dorsal: +1, high: 0, low: 0, back: +1, round: +1, tense: +1}),
    "ʊ": fv({syllabic: +1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: +1, coronal: -1, dorsal: +1, high: +1, low: -1, back: +1, round: +1, tense: -1}),
    "u": fv({syllabic: +1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: +1, coronal: -1, dorsal: +1, high: +1, low: -1, back: +1, round: +1, tense: +1}),
    "ə": fv({syllabic: +1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, high: 0, low: 0, back: 0, round: -1, tense: -1}),

    // Central vowels
    "ɨ": fv({syllabic: +1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, high: +1, low: -1, back: 0, round: -1, tense: +1}),

    // Front rounded vowels
    "y": fv({syllabic: +1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: +1, coronal: -1, dorsal: +1, high: +1, low: -1, back: -1, round: +1, tense: +1}),

    // Bilabial stops
    "p": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: -1,
             labial: +1, coronal: -1, dorsal: -1, anterior: +1}),
    "b": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: +1,
             labial: +1, coronal: -1, dorsal: -1, anterior: +1}),

    // Dental/alveolar stops
    "t": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: -1,
             labial: -1, coronal: +1, dorsal: -1, distributed: +1, anterior: +1}),
    "d": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: +1,
             labial: -1, coronal: +1, dorsal: -1, distributed: +1, anterior: +1}),

    // Retroflex stops
    "ʈ": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: -1,
             labial: -1, coronal: +1, dorsal: -1, distributed: -1, anterior: -1}),
    "ɖ": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: +1,
             labial: -1, coronal: +1, dorsal: -1, distributed: -1, anterior: -1}),

    // Palatal stops
    "c": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: -1,
             labial: -1, coronal: -1, dorsal: +1, anterior: -1}),

    // Velar stops
    "k": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: -1,
             labial: -1, coronal: -1, dorsal: +1, anterior: -1}),
    "g": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, anterior: -1}),

    // Uvular stops
    "q": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: -1,
             labial: -1, coronal: -1, dorsal: +1, anterior: -1}),
    "ɢ": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, anterior: -1}),

    // Glottal stop
    "ʔ": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: -1,
             labial: 0, coronal: 0, dorsal: 0, anterior: 0}),

    // Labiodental fricatives
    "f": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: -1,
             labial: +1, coronal: -1, dorsal: -1, strident: +1, anterior: +1}),
    "v": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: +1,
             labial: +1, coronal: -1, dorsal: -1, strident: +1, anterior: +1}),

    // Dental fricatives
    "θ": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: -1,
             labial: -1, coronal: +1, dorsal: -1, strident: -1, distributed: +1, anterior: +1}),
    "ð": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: +1,
             labial: -1, coronal: +1, dorsal: -1, strident: -1, distributed: +1, anterior: +1}),

    // Alveolar fricatives
    "s": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: -1,
             labial: -1, coronal: +1, dorsal: -1, strident: +1, distributed: +1, anterior: +1}),
    "z": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: +1,
             labial: -1, coronal: +1, dorsal: -1, strident: +1, distributed: +1, anterior: +1}),

    // Postalveolar fricatives
    "ʃ": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: -1,
             labial: -1, coronal: +1, dorsal: -1, strident: +1, distributed: -1, anterior: -1}),
    "ʒ": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: +1,
             labial: -1, coronal: +1, dorsal: -1, strident: +1, distributed: -1, anterior: -1}),

    // Retroflex fricatives
    "ʂ": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: -1,
             labial: -1, coronal: +1, dorsal: -1, strident: +1, distributed: -1, anterior: -1}),
    "ʐ": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: +1,
             labial: -1, coronal: +1, dorsal: -1, strident: +1, distributed: -1, anterior: -1}),

    // Palatal fricatives
    "ç": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: -1,
             labial: -1, coronal: -1, dorsal: +1, strident: -1, anterior: -1}),
    "ʝ": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, strident: -1, anterior: -1}),

    // Velar fricatives
    "x": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: -1,
             labial: -1, coronal: -1, dorsal: +1, strident: -1, anterior: -1}),
    "ɣ": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, strident: -1, anterior: -1}),

    // Glottal fricative
    "h": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: +1, voice: -1,
             labial: 0, coronal: 0, dorsal: 0, strident: -1, anterior: 0}),

    // Affricates
    "ts": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: -1,
              labial: -1, coronal: +1, dorsal: -1, strident: +1, distributed: +1, anterior: +1}),
    "dz": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: +1,
              labial: -1, coronal: +1, dorsal: -1, strident: +1, distributed: +1, anterior: +1}),
    "tʃ": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: -1,
              labial: -1, coronal: +1, dorsal: -1, strident: +1, distributed: -1, anterior: -1}),
    "dʒ": fv({syllabic: -1, consonantal: +1, sonorant: -1, continuant: -1, voice: +1,
              labial: -1, coronal: +1, dorsal: -1, strident: +1, distributed: -1, anterior: -1}),

    // Nasals
    "m": fv({syllabic: -1, consonantal: +1, sonorant: +1, continuant: -1, nasal: +1, voice: +1,
             labial: +1, coronal: -1, dorsal: -1, anterior: +1}),
    "n": fv({syllabic: -1, consonantal: +1, sonorant: +1, continuant: -1, nasal: +1, voice: +1,
             labial: -1, coronal: +1, dorsal: -1, distributed: +1, anterior: +1}),
    "ɳ": fv({syllabic: -1, consonantal: +1, sonorant: +1, continuant: -1, nasal: +1, voice: +1,
             labial: -1, coronal: +1, dorsal: -1, distributed: -1, anterior: -1}),
    "ŋ": fv({syllabic: -1, consonantal: +1, sonorant: +1, continuant: -1, nasal: +1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, anterior: -1}),

    // Liquids
    "l": fv({syllabic: -1, consonantal: +1, sonorant: +1, continuant: +1, lateral: +1, voice: +1,
             labial: -1, coronal: +1, dorsal: -1, distributed: +1, anterior: +1}),
    "ɭ": fv({syllabic: -1, consonantal: +1, sonorant: +1, continuant: +1, lateral: +1, voice: +1,
             labial: -1, coronal: +1, dorsal: -1, distributed: -1, anterior: -1}),
    "r": fv({syllabic: -1, consonantal: +1, sonorant: +1, continuant: +1, voice: +1,
             labial: -1, coronal: +1, dorsal: -1, distributed: +1, anterior: +1}),
    "ɾ": fv({syllabic: -1, consonantal: +1, sonorant: +1, continuant: +1, voice: +1,
             labial: -1, coronal: +1, dorsal: -1, distributed: +1, anterior: +1}),
    "ɽ": fv({syllabic: -1, consonantal: +1, sonorant: +1, continuant: +1, voice: +1,
             labial: -1, coronal: +1, dorsal: -1, distributed: -1, anterior: -1}),
    "ʀ": fv({syllabic: -1, consonantal: +1, sonorant: +1, continuant: +1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, anterior: -1}),

    // Glides
    "j": fv({syllabic: -1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: -1, coronal: -1, dorsal: +1, high: +1, back: -1, round: -1, anterior: -1}),
    "w": fv({syllabic: -1, consonantal: -1, sonorant: +1, continuant: +1, voice: +1,
             labial: +1, coronal: -1, dorsal: +1, high: +1, back: +1, round: +1, anterior: -1}),
};

// Create inventory and indexes
const INVENTORY = Object.keys(PHONEMES).sort();
const IDX = Object.fromEntries(INVENTORY.map((p, i) => [p, i]));
const SYLLABIC_IDX = FEATURES.indexOf("syllabic");

// Color projection for visualization
const RGB_PROJ = [
    [0.8, -0.4, 0.2, 0.3, 0.1, 0.2, 0.3, 0.6, -0.2, 0.1, 0.9, -0.3, -0.5, -0.6, 0.4, -0.3, 0.5, -0.2],  // R
    [-0.4, 0.8, 0.1, 0.5, 0.2, -0.2, 0.3, 0.1, 0.6, 0.2, -0.5, 0.7, 0.4, -0.2, -0.3, 0.6, -0.1, 0.4],   // G
    [0.1, 0.2, 0.8, -0.4, -0.2, 0.5, -0.3, -0.2, 0.2, 0.7, 0.3, 0.1, -0.1, 0.9, -0.5, 0.2, 0.7, -0.4],  // B
];

/**
 * Calculate feature distance between two phonemes
 */
function featureDistance(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i++) {
        const x = a[i];
        const y = b[i];
        if (x === 0 && y === 0) {
            continue;
        }
        if (x === 0 || y === 0) {
            d += 2;
        } else if (x !== y) {
            d += 1;
        }
    }
    return d;
}

/**
 * Check if phoneme is syllabic (vowel)
 */
function isSyllabic(phon) {
    return PHONEMES[phon] && PHONEMES[phon][SYLLABIC_IDX] > 0;
}

/**
 * Count syllables in a word
 */
function syllableCount(word) {
    return word.filter(p => isSyllabic(p)).length;
}

/**
 * Ensure word has at least one vowel
 */
function ensureHasVowel(word) {
    if (syllableCount(word) === 0) {
        const vowels = INVENTORY.filter(p => isSyllabic(p));
        const insertPos = Math.floor(word.length / 2);
        word.splice(insertPos, 0, vowels[Math.floor(Math.random() * vowels.length)]);
    }
    return word;
}

// Precompute distance matrices and weights
const VECS = INVENTORY.map(p => PHONEMES[p]);
const DIST = VECS.map((vec1, i) =>
    VECS.map((vec2, j) => featureDistance(vec1, vec2))
);

/**
 * Compute mutation weights based on feature similarity
 */
function computeMutationWeights(alpha) {
    return DIST.map(row => row.map(d => Math.exp(-alpha * d)));
}

/**
 * Compute addition weights with sweet spot preference
 */
function computeAdditionWeights(sweetDist, beta) {
    return DIST.map(row => row.map(d => Math.exp(-beta * Math.pow(d - sweetDist, 2))));
}

// Syllable structure types
const SyllableType = {
    V: "V",         // Vowel only
    CV: "CV",       // Consonant-Vowel
    VC: "VC",       // Vowel-Consonant
    CVC: "CVC",     // Consonant-Vowel-Consonant
    CCV: "CCV",     // Consonant-Consonant-Vowel
    CCVC: "CCVC",   // Consonant-Consonant-Vowel-Consonant
    VCC: "VCC",     // Vowel-Consonant-Consonant
    CVCC: "CVCC",   // Consonant-Vowel-Consonant-Consonant
};

/**
 * Cluster constraint class
 */
class ClusterConstraint {
    constructor(position, allowedCombinations = new Set()) {
        this.position = position;  // "onset" or "coda"
        this.allowedCombinations = allowedCombinations;  // Set of tuples (as arrays)
    }
}

/**
 * Phonotactic constraints for a language
 */
class PhonotacticConstraints {
    constructor(config = {}) {
        // Syllable structure preferences (probabilities sum to 1.0)
        this.syllableTypes = config.syllableTypes || {
            [SyllableType.CV]: 0.6,
            [SyllableType.CVC]: 0.3,
            [SyllableType.V]: 0.1
        };

        // Consonant cluster constraints
        this.onsetClusters = config.onsetClusters || new ClusterConstraint("onset");
        this.codaClusters = config.codaClusters || new ClusterConstraint("coda");

        // Coda restrictions
        this.allowedCodas = config.allowedCodas || new Set(["t", "n", "m", "s", "k", "p"]);

        // Word length preferences
        this.minSyllables = config.minSyllables || 1;
        this.maxSyllables = config.maxSyllables || 4;
        this.preferredSyllables = config.preferredSyllables || 2;

        // Mora constraints
        this.useMora = config.useMora || false;
        this.minMora = config.minMora || 1;
        this.maxMora = config.maxMora || 6;

        // Gemination rules
        this.allowGemination = config.allowGemination || false;
        this.geminationProbability = config.geminationProbability || 0.05;
        this.geminableConsonants = config.geminableConsonants || new Set();

        // Phoneme sequence constraints
        this.forbiddenSequences = config.forbiddenSequences || new Set();
        this.requiredSequences = config.requiredSequences || new Map();
    }
}

/**
 * Syllable structure preferences for biasing evolution
 */
class SyllableProfile {
    constructor(config = {}) {
        this.shapes = config.shapes || Object.assign({}, CONFIG.DEFAULT_SYLLABLE_SHAPES);
        this.maxOnset = config.maxOnset || 2;
        this.maxCoda = config.maxCoda || 2;
        this.allowCoda = config.allowCoda !== undefined ? config.allowCoda : true;
        this.allowComplexOnset = config.allowComplexOnset !== undefined ? config.allowComplexOnset : true;

        // Penalties for undesired patterns
        this.hiatusPenalty = config.hiatusPenalty || -0.5;
        this.illegalClusterPenalty = config.illegalClusterPenalty || -1.0;
        this.codaPenalty = config.codaPenalty || -0.1;
        this.sonorityViolationPenalty = config.sonorityViolationPenalty || -0.3;

        // Sonority scale
        this.sonorityScale = config.sonorityScale || this.computeSonorityScale();
    }

    computeSonorityScale() {
        const sonorityMap = {};

        for (const [phoneme, features] of Object.entries(PHONEMES)) {
            const syllabic = features[FEATURES.indexOf("syllabic")];
            const consonantal = features[FEATURES.indexOf("consonantal")];
            const sonorant = features[FEATURES.indexOf("sonorant")];
            const continuant = features[FEATURES.indexOf("continuant")];
            const nasal = features[FEATURES.indexOf("nasal")];
            const lateral = features[FEATURES.indexOf("lateral")];
            const voice = features[FEATURES.indexOf("voice")];

            let sonority;
            if (syllabic === 1) {  // Vowels
                sonority = 10;
            } else if (sonorant === 1) {  // Sonorant consonants
                if (lateral === 1) {  // Laterals (l)
                    sonority = 6;
                } else if (nasal === 1) {  // Nasals (m, n, ŋ)
                    sonority = 5;
                } else {  // Approximants/glides (r, w, j)
                    sonority = 7;
                }
            } else {  // Obstruents
                if (continuant === 1) {  // Fricatives
                    sonority = voice === 1 ? 3 : 2;
                } else {  // Stops
                    sonority = voice === 1 ? 1 : 0;
                }
            }

            sonorityMap[phoneme] = sonority;
        }

        return sonorityMap;
    }
}

/**
 * Get default phonotactic constraints (simple CV system)
 */
function getDefaultConstraints() {
    return new PhonotacticConstraints({
        syllableTypes: {
            [SyllableType.CV]: 0.6,
            [SyllableType.CVC]: 0.3,
            [SyllableType.V]: 0.1
        },
        onsetClusters: new ClusterConstraint("onset", new Set()),
        codaClusters: new ClusterConstraint("coda", new Set()),
        allowedCodas: new Set(["t", "n", "m", "s", "k", "p"]),
        minSyllables: 1,
        maxSyllables: 3,
        preferredSyllables: 2,
        forbiddenSequences: new Set(),
        requiredSequences: new Map()
    });
}

/**
 * Get more complex phonotactic constraints with clusters
 */
function getComplexConstraints() {
    return new PhonotacticConstraints({
        syllableTypes: {
            [SyllableType.CV]: 0.4,
            [SyllableType.CVC]: 0.25,
            [SyllableType.CCV]: 0.15,
            [SyllableType.CCVC]: 0.1,
            [SyllableType.V]: 0.05,
            [SyllableType.VC]: 0.05
        },
        onsetClusters: new ClusterConstraint("onset", new Set([
            ["p", "r"], ["t", "r"], ["k", "r"], ["b", "r"], ["d", "r"],
            ["g", "r"], ["p", "l"], ["t", "l"], ["k", "l"], ["b", "l"],
            ["d", "l"], ["g", "l"], ["f", "r"], ["f", "l"], ["s", "t"],
            ["s", "p"], ["s", "k"], ["s", "m"], ["s", "n"], ["ʃ", "t"],
            ["ʃ", "p"], ["ʃ", "k"]
        ].map(arr => JSON.stringify(arr)))),  // Store as strings for Set compatibility
        codaClusters: new ClusterConstraint("coda", new Set([
            ["n", "t"], ["m", "p"], ["ŋ", "k"], ["l", "t"], ["r", "t"],
            ["s", "t"], ["l", "s"], ["r", "s"], ["n", "s"]
        ].map(arr => JSON.stringify(arr)))),
        allowedCodas: new Set(["t", "n", "m", "s", "k", "p", "l", "r", "ŋ"]),
        minSyllables: 1,
        maxSyllables: 4,
        preferredSyllables: 2,
        allowGemination: true,
        geminationProbability: 0.08,
        geminableConsonants: new Set(["t", "k", "p", "s", "n", "m", "l", "r"]),
        forbiddenSequences: new Set([["h", "h"], ["j", "j"], ["w", "w"]].map(arr => JSON.stringify(arr))),
        requiredSequences: new Map()
    });
}

/**
 * Get mora-based phonotactic constraints (Japanese-style)
 */
function getMoraConstraints() {
    return new PhonotacticConstraints({
        syllableTypes: {
            [SyllableType.CV]: 0.7,
            [SyllableType.V]: 0.2,
            [SyllableType.CVC]: 0.1  // Only with moraic consonants
        },
        onsetClusters: new ClusterConstraint("onset", new Set()),
        codaClusters: new ClusterConstraint("coda", new Set()),
        allowedCodas: new Set(["n", "m", "ŋ"]),  // Only moraic consonants
        minSyllables: 1,
        maxSyllables: 5,
        preferredSyllables: 3,
        useMora: true,
        minMora: 2,
        maxMora: 8,
        allowGemination: true,
        geminationProbability: 0.12,
        geminableConsonants: new Set(["t", "k", "p", "s"]),
        forbiddenSequences: new Set([["j", "j"], ["w", "w"]].map(arr => JSON.stringify(arr))),
        requiredSequences: new Map()
    });
}

/**
 * Check if phoneme is a consonant
 */
function isConsonant(phon) {
    return !isSyllabic(phon);
}

/**
 * Check if phoneme is voiced
 */
function isVoiced(phon) {
    if (!PHONEMES[phon]) return false;
    const voiceIdx = FEATURES.indexOf("voice");
    return PHONEMES[phon][voiceIdx] > 0;
}

/**
 * Check if phoneme is nasal
 */
function isNasal(phon) {
    if (!PHONEMES[phon]) return false;
    const nasalIdx = FEATURES.indexOf("nasal");
    return PHONEMES[phon][nasalIdx] > 0;
}

/**
 * Check if phoneme is a liquid (l, r)
 */
function isLiquid(phon) {
    return ["l", "r"].includes(phon);
}

/**
 * Check if phoneme is a fricative
 */
function isFricative(phon) {
    if (!PHONEMES[phon]) return false;
    const continuantIdx = FEATURES.indexOf("continuant");
    const consonantalIdx = FEATURES.indexOf("consonantal");
    const sonorantIdx = FEATURES.indexOf("sonorant");
    const features = PHONEMES[phon];
    return features[continuantIdx] > 0 && features[consonantalIdx] > 0 && features[sonorantIdx] <= 0;
}

/**
 * Check if phoneme is an obstruent (stop or fricative)
 */
function isObstruent(phon) {
    if (!PHONEMES[phon]) return false;
    const consonantalIdx = FEATURES.indexOf("consonantal");
    const sonorantIdx = FEATURES.indexOf("sonorant");
    const features = PHONEMES[phon];
    return features[consonantalIdx] > 0 && features[sonorantIdx] <= 0;
}

/**
 * Check if phoneme is a sonorant
 */
function isSonorant(phon) {
    if (!PHONEMES[phon]) return false;
    const sonorantIdx = FEATURES.indexOf("sonorant");
    return PHONEMES[phon][sonorantIdx] > 0;
}

// Export all the phonology utilities
window.PhonologyModule = {
    FEATURES,
    PHONEMES,
    INVENTORY,
    IDX,
    RGB_PROJ,
    DIST,
    featureDistance,
    isSyllabic,
    syllableCount,
    ensureHasVowel,
    computeMutationWeights,
    computeAdditionWeights,
    SyllableType,
    ClusterConstraint,
    PhonotacticConstraints,
    SyllableProfile,
    getDefaultConstraints,
    getComplexConstraints,
    getMoraConstraints,
    isConsonant,
    isVoiced,
    isNasal,
    isLiquid,
    isFricative,
    isObstruent,
    isSonorant
};