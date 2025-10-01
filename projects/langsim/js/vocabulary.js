/**
 * Vocabulary system for the Language Evolution Simulator
 * Contains core vocabulary sets and word management utilities
 */

// Core vocabulary based on Swadesh list and common concepts
const CORE_VOCABULARY = [
    // Basic pronouns and relations
    "I", "you", "he", "she", "we", "they", "this", "that", "here", "there",
    "who", "what", "where", "when", "how", "not", "all", "many", "some", "few",
    "other", "one", "two", "three", "four", "five", "big", "long", "wide",
    "thick", "heavy", "small", "short", "narrow", "thin", "woman", "man",
    "person", "child", "wife", "husband", "mother", "father", "animal", "fish",
    "bird", "dog", "louse", "snake", "worm", "tree", "forest", "stick", "fruit",
    "seed", "leaf", "root", "bark", "flower", "grass", "rope", "skin", "meat",
    "blood", "bone", "fat", "egg", "horn", "tail", "feather", "hair", "head",
    "ear", "eye", "nose", "mouth", "tooth", "tongue", "fingernail", "foot",
    "leg", "knee", "hand", "wing", "belly", "guts", "neck", "back", "breast",
    "heart", "liver", "drink", "eat", "bite", "suck", "spit", "vomit", "blow",
    "breathe", "laugh", "see", "hear", "know", "think", "smell", "fear", "sleep",
    "live", "die", "kill", "fight", "hunt", "hit", "cut", "split", "stab",
    "scratch", "dig", "swim", "fly", "walk", "come", "lie", "sit", "stand",
    "turn", "fall", "give", "hold", "squeeze", "rub", "wash", "wipe", "pull",
    "push", "throw", "tie", "sew", "count", "say", "sing", "play", "float",
    "flow", "freeze", "swell", "sun", "moon", "star", "water", "rain", "river",
    "lake", "sea", "salt", "stone", "sand", "dust", "earth", "cloud", "fog",
    "sky", "wind", "snow", "ice", "smoke", "fire", "ash", "burn", "road", "mountain",
    "red", "green", "yellow", "white", "black", "night", "day", "year", "warm",
    "cold", "full", "new", "old", "good", "bad", "rotten", "dirty", "straight",
    "round", "sharp", "dull", "smooth", "wet", "dry", "correct", "near", "far",
    "right", "left", "at", "in", "with", "and", "if", "because", "name"
];

// Extended vocabulary for richer linguistic diversity
const EXTENDED_VOCABULARY = [
    // Nature and environment
    "valley", "hill", "cave", "cliff", "beach", "desert", "field", "meadow",
    "swamp", "island", "peninsula", "volcano", "earthquake", "thunder", "lightning",
    "rainbow", "dawn", "dusk", "shadow", "light", "darkness", "storm", "calm",

    // Animals and creatures
    "cat", "wolf", "bear", "deer", "rabbit", "mouse", "rat", "squirrel", "beaver",
    "fox", "lion", "tiger", "elephant", "horse", "cow", "pig", "sheep", "goat",
    "chicken", "duck", "goose", "eagle", "hawk", "owl", "crow", "sparrow", "bee",
    "ant", "spider", "butterfly", "mosquito", "fly", "frog", "turtle", "lizard",
    "crocodile", "shark", "whale", "dolphin", "octopus", "crab", "shrimp",

    // Plants and food
    "wheat", "rice", "corn", "potato", "carrot", "onion", "garlic", "bean",
    "nut", "apple", "orange", "grape", "banana", "berry", "mushroom", "herb",
    "spice", "honey", "milk", "cheese", "bread", "soup", "stew", "medicine",

    // Tools and technology
    "knife", "spear", "bow", "arrow", "axe", "hammer", "needle", "thread",
    "pot", "bowl", "cup", "plate", "basket", "box", "bag", "clothes", "shoe",
    "hat", "blanket", "bed", "house", "door", "window", "roof", "wall", "floor",
    "chair", "table", "fire", "torch", "candle", "boat", "paddle", "wheel",

    // Social and abstract concepts
    "village", "tribe", "chief", "warrior", "hunter", "farmer", "merchant",
    "friend", "enemy", "guest", "stranger", "ancestor", "spirit", "god", "magic",
    "dream", "soul", "mind", "memory", "wisdom", "truth", "lie", "promise",
    "law", "custom", "ceremony", "dance", "music", "song", "story", "word",
    "language", "writing", "book", "number", "time", "past", "future", "beginning",
    "end", "life", "death", "birth", "marriage", "peace", "war", "victory",
    "defeat", "honor", "shame", "pride", "joy", "sadness", "anger", "love", "hate",

    // Actions and states
    "create", "destroy", "build", "break", "repair", "paint", "draw", "write",
    "read", "learn", "teach", "understand", "forget", "remember", "choose",
    "decide", "agree", "disagree", "help", "hurt", "heal", "protect", "attack",
    "defend", "escape", "catch", "release", "find", "lose", "search", "hide",
    "show", "tell", "ask", "answer", "call", "whisper", "shout", "listen",
    "watch", "look", "touch", "feel", "taste", "smell", "run", "jump", "climb",
    "crawl", "roll", "slide", "dance", "work", "rest", "play", "compete", "win",
    "lose", "try", "succeed", "fail", "start", "stop", "continue", "finish",

    // Qualities and descriptions
    "beautiful", "ugly", "strong", "weak", "fast", "slow", "high", "low",
    "deep", "shallow", "wide", "narrow", "thick", "thin", "hard", "soft",
    "rough", "smooth", "sharp", "blunt", "hot", "cold", "warm", "cool",
    "bright", "dark", "clean", "dirty", "pure", "mixed", "simple", "complex",
    "easy", "difficult", "safe", "dangerous", "calm", "excited", "happy", "sad",
    "angry", "peaceful", "noisy", "quiet", "busy", "lazy", "careful", "careless",
    "brave", "afraid", "wise", "foolish", "kind", "cruel", "generous", "selfish"
];

// Combine vocabularies
const ALL_VOCABULARY = [...CORE_VOCABULARY, ...EXTENDED_VOCABULARY];

/**
 * Get a subset of vocabulary for language initialization
 */
function getVocabularySubset(size = 120) {
    if (size >= ALL_VOCABULARY.length) {
        return [...ALL_VOCABULARY];
    }

    // Always include core vocabulary first
    const result = [...CORE_VOCABULARY];

    if (size <= CORE_VOCABULARY.length) {
        return result.slice(0, size);
    }

    // Add additional words from extended vocabulary
    const remaining = size - CORE_VOCABULARY.length;
    const extendedShuffled = [...EXTENDED_VOCABULARY].sort(() => Math.random() - 0.5);
    result.push(...extendedShuffled.slice(0, remaining));

    return result;
}

/**
 * Get vocabulary by semantic category
 */
function getVocabularyByCategory(category) {
    const categories = {
        pronouns: ["I", "you", "he", "she", "we", "they", "this", "that"],
        family: ["mother", "father", "child", "wife", "husband", "ancestor"],
        body: ["head", "eye", "nose", "mouth", "hand", "foot", "heart", "blood"],
        nature: ["sun", "moon", "star", "water", "fire", "tree", "stone", "earth"],
        animals: ["dog", "cat", "bird", "fish", "snake", "horse", "cow", "bear"],
        colors: ["red", "green", "yellow", "white", "black", "blue", "brown"],
        numbers: ["one", "two", "three", "four", "five", "six", "seven", "eight"],
        actions: ["eat", "drink", "walk", "run", "see", "hear", "speak", "sleep"],
        qualities: ["big", "small", "good", "bad", "hot", "cold", "new", "old"],
        tools: ["knife", "spear", "pot", "bowl", "clothes", "house", "boat"],
        social: ["friend", "enemy", "chief", "village", "tribe", "peace", "war"]
    };

    return categories[category] || [];
}

/**
 * Check if a word is in the core vocabulary
 */
function isCoreVocabulary(word) {
    return CORE_VOCABULARY.includes(word);
}

/**
 * Get random vocabulary words
 */
function getRandomWords(count = 10, useCore = true) {
    const source = useCore ? CORE_VOCABULARY : ALL_VOCABULARY;
    const shuffled = [...source].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Get vocabulary words by frequency/importance
 */
function getVocabularyByFrequency(tier = 1) {
    switch (tier) {
        case 1: // Most essential
            return CORE_VOCABULARY.slice(0, 50);
        case 2: // Important
            return CORE_VOCABULARY.slice(50, 100);
        case 3: // Extended
            return CORE_VOCABULARY.slice(100).concat(EXTENDED_VOCABULARY.slice(0, 50));
        default: // All extended
            return EXTENDED_VOCABULARY;
    }
}

/**
 * Search vocabulary by pattern
 */
function searchVocabulary(pattern, caseSensitive = false) {
    const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    return ALL_VOCABULARY.filter(word => regex.test(word));
}

/**
 * Get vocabulary statistics
 */
function getVocabularyStats() {
    return {
        core: CORE_VOCABULARY.length,
        extended: EXTENDED_VOCABULARY.length,
        total: ALL_VOCABULARY.length,
        categories: {
            pronouns: getVocabularyByCategory('pronouns').length,
            family: getVocabularyByCategory('family').length,
            body: getVocabularyByCategory('body').length,
            nature: getVocabularyByCategory('nature').length,
            animals: getVocabularyByCategory('animals').length,
            colors: getVocabularyByCategory('colors').length,
            numbers: getVocabularyByCategory('numbers').length,
            actions: getVocabularyByCategory('actions').length,
            qualities: getVocabularyByCategory('qualities').length,
            tools: getVocabularyByCategory('tools').length,
            social: getVocabularyByCategory('social').length
        }
    };
}

/**
 * Word class for representing words with metadata
 */
class Word {
    constructor(form, meaning, originLangId, borrowedFrom = null, generation = 0) {
        this.form = Array.isArray(form) ? form : form.split('');  // phoneme sequence
        this.meaning = meaning;                                   // semantic content
        this.originLangId = originLangId;                        // language of origin
        this.borrowedFrom = borrowedFrom;                        // source language if borrowed
        this.generation = generation;                            // how many changes from original
        this.lastChanged = 0;                                   // tick when last changed
        this.stability = 1.0;                                   // resistance to change (0-1)
    }

    get stringForm() {
        return this.form.join('');
    }

    /**
     * Create a copy of this word
     */
    copy() {
        return new Word(
            [...this.form],
            this.meaning,
            this.originLangId,
            this.borrowedFrom,
            this.generation
        );
    }

    /**
     * Check if this word was borrowed
     */
    isBorrowed() {
        return this.borrowedFrom !== null;
    }

    /**
     * Get the age of this word (generations)
     */
    getAge() {
        return this.generation;
    }

    /**
     * Update the word form and increment generation
     */
    evolve(newForm, tick = 0) {
        this.form = Array.isArray(newForm) ? newForm : newForm.split('');
        this.generation += 1;
        this.lastChanged = tick;
    }

    /**
     * Get word info for display
     */
    getInfo() {
        return {
            form: this.stringForm,
            meaning: this.meaning,
            origin: this.originLangId,
            borrowed: this.borrowedFrom,
            generation: this.generation,
            age: this.getAge(),
            borrowed: this.isBorrowed()
        };
    }

    /**
     * Get similarity to another word (0-1, higher = more similar)
     */
    getSimilarity(other) {
        if (this.meaning !== other.meaning) {
            return 0;  // Different meanings
        }

        const form1 = this.stringForm;
        const form2 = other.stringForm;

        // Simple edit distance-based similarity
        const maxLen = Math.max(form1.length, form2.length);
        if (maxLen === 0) return 1;

        const editDistance = this.calculateEditDistance(form1, form2);
        return 1 - (editDistance / maxLen);
    }

    /**
     * Calculate edit distance between two strings
     */
    calculateEditDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() =>
            Array(str1.length + 1).fill(null));

        for (let i = 0; i <= str1.length; i++) {
            matrix[0][i] = i;
        }

        for (let j = 0; j <= str2.length; j++) {
            matrix[j][0] = j;
        }

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                if (str1[i - 1] === str2[j - 1]) {
                    matrix[j][i] = matrix[j - 1][i - 1];
                } else {
                    matrix[j][i] = Math.min(
                        matrix[j - 1][i] + 1,     // deletion
                        matrix[j][i - 1] + 1,     // insertion
                        matrix[j - 1][i - 1] + 1  // substitution
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }
}

// Export vocabulary utilities
window.VocabularyModule = {
    CORE_VOCABULARY,
    EXTENDED_VOCABULARY,
    ALL_VOCABULARY,
    getVocabularySubset,
    getVocabularyByCategory,
    isCoreVocabulary,
    getRandomWords,
    getVocabularyByFrequency,
    searchVocabulary,
    getVocabularyStats,
    Word
};