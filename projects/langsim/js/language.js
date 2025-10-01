/**
 * Language class representing a linguistic system with phonology and lexicon
 * Ported from the original Python implementation
 */

/**
 * Phonological Generator - generates words according to phonotactic constraints
 */
class PhonologicalGenerator {
    constructor(phonemeInventory, constraints, preferredPhonemeCount = 4) {
        this.phonemeInventory = phonemeInventory;
        this.constraints = constraints;
        this.preferredPhonemeCount = preferredPhonemeCount;

        // Categorize phonemes
        this.vowels = Array.from(phonemeInventory).filter(p => PhonologyModule.isSyllabic(p));
        this.consonants = Array.from(phonemeInventory).filter(p => !PhonologyModule.isSyllabic(p));

        // Emergency fallbacks
        if (this.vowels.length === 0) {
            this.vowels = ["a"];
        }
        if (this.consonants.length === 0) {
            this.consonants = ["t"];
        }
    }

    generateWord() {
        const maxAttempts = 50;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            let word;
            if (this.constraints.useMora) {
                word = this._generateMoraWord();
            } else {
                word = this._generateSyllableWord();
            }

            // Check length constraints
            const wordLength = word.length;
            if (CONFIG.MIN_WORD_LENGTH <= wordLength && wordLength <= CONFIG.MAX_WORD_LENGTH) {
                return word;
            }

            // If word is too long, truncate
            if (wordLength > CONFIG.MAX_WORD_LENGTH) {
                return word.slice(0, CONFIG.MAX_WORD_LENGTH);
            }
        }

        // Fallback: construct a word of minimum valid length
        return this._constructFallbackWord();
    }

    _generateSyllableWord() {
        // Try to match preferred phoneme count first
        let numSyllables;
        if (Math.random() < 0.7) {
            // Estimate syllables needed for preferred phoneme count (avg 2.5 phonemes per syllable)
            const targetSyllables = Math.max(1, Math.min(this.constraints.maxSyllables,
                Math.round(this.preferredPhonemeCount / 2.5)));
            numSyllables = targetSyllables;
        } else if (Math.random() < 0.6) {
            numSyllables = this.constraints.preferredSyllables;
        } else {
            numSyllables = Math.floor(Math.random() *
                (this.constraints.maxSyllables - this.constraints.minSyllables + 1)) +
                this.constraints.minSyllables;
        }

        const word = [];
        for (let i = 0; i < numSyllables; i++) {
            const syllable = this._generateSyllable(i === 0, i === numSyllables - 1);
            word.push(...syllable);

            // Add gemination between syllables
            if (i < numSyllables - 1 && this.constraints.allowGemination &&
                Math.random() < this.constraints.geminationProbability) {
                this._addGemination(word);
            }
        }

        return this._filterForbiddenSequences(word);
    }

    _constructFallbackWord() {
        // Ensure we have the minimum required length
        const targetLength = Math.max(CONFIG.MIN_WORD_LENGTH, this.preferredPhonemeCount);
        const finalLength = Math.min(targetLength, CONFIG.MAX_WORD_LENGTH);

        const word = [];
        while (word.length < finalLength) {
            // Add a simple CV pattern or just vowels if needed
            if (word.length < finalLength - 1 && this.consonants.length > 0) {
                word.push(this.consonants[Math.floor(Math.random() * this.consonants.length)]);
            }
            if (word.length < finalLength) {
                word.push(this.vowels[Math.floor(Math.random() * this.vowels.length)]);
            }
        }

        return word.slice(0, CONFIG.MAX_WORD_LENGTH);
    }

    _generateMoraWord() {
        const targetMora = Math.floor(Math.random() *
            (this.constraints.maxMora - this.constraints.minMora + 1)) + this.constraints.minMora;
        const word = [];
        let currentMora = 0;

        while (currentMora < targetMora) {
            const remainingMora = targetMora - currentMora;

            // Choose syllable type that fits remaining mora
            if (remainingMora >= 2) {
                // Can use CV (2 mora) or V (1 mora)
                if (Math.random() < 0.7) {
                    const syllable = this._generateCvSyllable();
                    word.push(...syllable);
                    currentMora += 2;
                } else {
                    const syllable = this._generateVSyllable();
                    word.push(...syllable);
                    currentMora += 1;
                }
            } else {
                // Only 1 mora left, must use V
                const syllable = this._generateVSyllable();
                word.push(...syllable);
                currentMora += 1;
            }
        }

        return this._filterForbiddenSequences(word);
    }

    _generateSyllable(isFirst, isLast) {
        // Choose syllable type based on probabilities
        const syllableTypes = Object.keys(this.constraints.syllableTypes);
        const probabilities = Object.values(this.constraints.syllableTypes);

        const syllType = this._weightedChoice(syllableTypes, probabilities);

        switch (syllType) {
            case PhonologyModule.SyllableType.V:
                return this._generateVSyllable();
            case PhonologyModule.SyllableType.CV:
                return this._generateCvSyllable();
            case PhonologyModule.SyllableType.VC:
                return this._generateVcSyllable();
            case PhonologyModule.SyllableType.CVC:
                return this._generateCvcSyllable();
            case PhonologyModule.SyllableType.CCV:
                return this._generateCcvSyllable();
            case PhonologyModule.SyllableType.CCVC:
                return this._generateCcvcSyllable();
            case PhonologyModule.SyllableType.VCC:
                return this._generateVccSyllable();
            case PhonologyModule.SyllableType.CVCC:
                return this._generateCvccSyllable();
            default:
                return this._generateCvSyllable();
        }
    }

    _generateVSyllable() {
        return [this.vowels[Math.floor(Math.random() * this.vowels.length)]];
    }

    _generateCvSyllable() {
        const onset = this._generateOnset(1);
        const vowel = this.vowels[Math.floor(Math.random() * this.vowels.length)];
        return [...onset, vowel];
    }

    _generateVcSyllable() {
        const vowel = this.vowels[Math.floor(Math.random() * this.vowels.length)];
        const coda = this._generateCoda(1);
        return [vowel, ...coda];
    }

    _generateCvcSyllable() {
        const onset = this._generateOnset(1);
        const vowel = this.vowels[Math.floor(Math.random() * this.vowels.length)];
        const coda = this._generateCoda(1);
        return [...onset, vowel, ...coda];
    }

    _generateCcvSyllable() {
        const onset = this._generateOnset(2);
        const vowel = this.vowels[Math.floor(Math.random() * this.vowels.length)];
        return [...onset, vowel];
    }

    _generateCcvcSyllable() {
        const onset = this._generateOnset(2);
        const vowel = this.vowels[Math.floor(Math.random() * this.vowels.length)];
        const coda = this._generateCoda(1);
        return [...onset, vowel, ...coda];
    }

    _generateVccSyllable() {
        const vowel = this.vowels[Math.floor(Math.random() * this.vowels.length)];
        const coda = this._generateCoda(2);
        return [vowel, ...coda];
    }

    _generateCvccSyllable() {
        const onset = this._generateOnset(1);
        const vowel = this.vowels[Math.floor(Math.random() * this.vowels.length)];
        const coda = this._generateCoda(2);
        return [...onset, vowel, ...coda];
    }

    _generateOnset(size) {
        if (size === 1) {
            return [this.consonants[Math.floor(Math.random() * this.consonants.length)]];
        } else if (size === 2) {
            // Try to use allowed onset clusters
            const availableClusters = Array.from(this.constraints.onsetClusters.allowedCombinations)
                .map(str => JSON.parse(str))
                .filter(cluster => cluster.length === 2 &&
                    cluster.every(c => this.consonants.includes(c)));

            if (availableClusters.length > 0) {
                const cluster = availableClusters[Math.floor(Math.random() * availableClusters.length)];
                return [...cluster];
            } else {
                // Fallback to single consonant
                return [this.consonants[Math.floor(Math.random() * this.consonants.length)]];
            }
        } else {
            // Fallback for larger clusters
            return [this.consonants[Math.floor(Math.random() * this.consonants.length)]];
        }
    }

    _generateCoda(size) {
        if (size === 1) {
            // Use allowed codas if specified
            const allowed = this.consonants.filter(c => this.constraints.allowedCodas.has(c));
            if (allowed.length > 0) {
                return [allowed[Math.floor(Math.random() * allowed.length)]];
            } else {
                return [this.consonants[Math.floor(Math.random() * this.consonants.length)]];
            }
        } else if (size === 2) {
            // Try to use allowed coda clusters
            const availableClusters = Array.from(this.constraints.codaClusters.allowedCombinations)
                .map(str => JSON.parse(str))
                .filter(cluster => cluster.length === 2 &&
                    cluster.every(c => this.consonants.includes(c)));

            if (availableClusters.length > 0) {
                const cluster = availableClusters[Math.floor(Math.random() * availableClusters.length)];
                return [...cluster];
            } else {
                // Fallback to single consonant
                const allowed = this.consonants.filter(c => this.constraints.allowedCodas.has(c));
                if (allowed.length > 0) {
                    return [allowed[Math.floor(Math.random() * allowed.length)]];
                } else {
                    return [this.consonants[Math.floor(Math.random() * this.consonants.length)]];
                }
            }
        } else {
            // Fallback
            return [this.consonants[Math.floor(Math.random() * this.consonants.length)]];
        }
    }

    _addGemination(word) {
        if (word.length === 0) return;

        const lastPhone = word[word.length - 1];
        if (!PhonologyModule.isSyllabic(lastPhone) &&
            this.constraints.geminableConsonants.has(lastPhone)) {
            word.push(lastPhone);
        }
    }

    _filterForbiddenSequences(word) {
        if (this.constraints.forbiddenSequences.size === 0) {
            return [...word];
        }

        const filteredWord = [...word];

        for (const forbiddenStr of this.constraints.forbiddenSequences) {
            const forbidden = JSON.parse(forbiddenStr);
            const seqLen = forbidden.length;
            let i = 0;
            while (i <= filteredWord.length - seqLen) {
                const sequence = filteredWord.slice(i, i + seqLen);
                if (JSON.stringify(sequence) === forbiddenStr) {
                    if (seqLen >= 2) {
                        const middleIdx = i + Math.floor(seqLen / 2);
                        if (PhonologyModule.isSyllabic(forbidden[Math.floor(seqLen / 2)])) {
                            filteredWord[middleIdx] = this.vowels[Math.floor(Math.random() * this.vowels.length)];
                        } else {
                            filteredWord[middleIdx] = this.consonants[Math.floor(Math.random() * this.consonants.length)];
                        }
                    }
                    i += seqLen;
                } else {
                    i += 1;
                }
            }
        }

        return filteredWord;
    }

    _weightedChoice(choices, weights) {
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < choices.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return choices[i];
            }
        }

        return choices[choices.length - 1];
    }
}

/**
 * Language class representing a linguistic system
 */
class Language {
    static _nextId = 1;
    static LANGUAGE_NAME_MEANING = "language_name";

    constructor(parent = null) {
        this.id = Language._nextId++;
        this.generation = parent ? parent.generation + 1 : 0;

        // Phonological system
        if (!parent) {
            this.phonemeInventory = this._selectInitialPhonemes();
            this.phonotacticConstraints = this._selectInitialConstraints();
            this.syllableProfile = this._selectInitialSyllableProfile();
        } else {
            this.phonemeInventory = new Set([...parent.phonemeInventory]);
            this.phonotacticConstraints = this._deepCopyConstraints(parent.phonotacticConstraints);
            this.syllableProfile = this._deepCopySyllableProfile(parent.syllableProfile || this._selectInitialSyllableProfile());
        }

        // Phonological evolution
        this.epentheticVowel = CONFIG.EPENTHETIC_VOWEL_CHOICES[Math.floor(Math.random() * CONFIG.EPENTHETIC_VOWEL_CHOICES.length)];
        this.lastEvolutionTick = 0;

        // Precompute phonological weights
        this._updatePhonologicalWeights();

        // Apply inheritance drift after weights are computed
        if (parent) {
            this._driftPhonemes();
            this._driftConstraints();
        }

        // Word length preferences
        if (!parent) {
            this.preferredPhonemeCount = Math.floor(Math.random() *
                (CONFIG.PREFERRED_PHONEME_COUNT_RANGE[1] - CONFIG.PREFERRED_PHONEME_COUNT_RANGE[0] + 1)) +
                CONFIG.PREFERRED_PHONEME_COUNT_RANGE[0];
        } else {
            const parentPreferred = parent.preferredPhonemeCount ||
                Math.floor(Math.random() * (CONFIG.PREFERRED_PHONEME_COUNT_RANGE[1] - CONFIG.PREFERRED_PHONEME_COUNT_RANGE[0] + 1)) +
                CONFIG.PREFERRED_PHONEME_COUNT_RANGE[0];
            const drift = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
            this.preferredPhonemeCount = Math.max(CONFIG.MIN_WORD_LENGTH,
                Math.min(CONFIG.MAX_WORD_LENGTH, parentPreferred + drift));
        }

        // Initialize phonological generator
        this.phonologicalGenerator = new PhonologicalGenerator(
            this.phonemeInventory, this.phonotacticConstraints, this.preferredPhonemeCount);

        // Lexicon
        this.lexicon = new Map();
        if (!parent) {
            this._generateInitialLexicon();
        } else {
            this._inheritLexicon(parent);
        }

        // Language properties
        this.prestige = Math.random() * (CONFIG.PRESTIGE_RANGE[1] - CONFIG.PRESTIGE_RANGE[0]) + CONFIG.PRESTIGE_RANGE[0];
        this.conservatism = Math.random() * (CONFIG.CONSERVATISM_RANGE[1] - CONFIG.CONSERVATISM_RANGE[0]) + CONFIG.CONSERVATISM_RANGE[0];

        // Ensure language name entry exists alongside the rest of the lexicon
        if (!this.lexicon.has(Language.LANGUAGE_NAME_MEANING)) {
            this.nameWord = this._generateNameWord();
        }

        // Geographic branching marker (for display only)
        this.geographicBranchMarker = "";

        // Evolution tracking
        this.parentId = parent ? parent.id : null;
        this.children = [];

        // Prestige tracking
        this.prestigeHistory = [this.prestige];
    }

    _selectInitialPhonemes() {
        const vowels = PhonologyModule.INVENTORY.filter(p => PhonologyModule.isSyllabic(p));
        const consonants = PhonologyModule.INVENTORY.filter(p => !PhonologyModule.isSyllabic(p));

        // Ensure minimum vowel system
        const selected = new Set();
        const selectedVowels = this._shuffleArray([...vowels]).slice(0, Math.min(CONFIG.MIN_INITIAL_VOWELS, vowels.length));
        selectedVowels.forEach(v => selected.add(v));

        // Add consonants using feature dispersion
        const remaining = new Set([...consonants]);
        const targetSize = Math.floor(Math.random() *
            (CONFIG.INITIAL_INVENTORY_SIZE_RANGE[1] - CONFIG.INITIAL_INVENTORY_SIZE_RANGE[0] + 1)) +
            CONFIG.INITIAL_INVENTORY_SIZE_RANGE[0];

        while (selected.size < targetSize && remaining.size > 0) {
            let nextPhone;
            if (selected.size === 0) {
                nextPhone = this._shuffleArray([...remaining])[0];
            } else {
                // Choose phoneme most different from current inventory
                let bestPhone = null;
                let maxDistance = -1;
                for (const candidate of remaining) {
                    const totalDistance = Array.from(selected).reduce((sum, existing) =>
                        sum + this._featureDistance(candidate, existing), 0);
                    if (totalDistance > maxDistance) {
                        maxDistance = totalDistance;
                        bestPhone = candidate;
                    }
                }
                nextPhone = bestPhone;
            }

            if (nextPhone) {
                selected.add(nextPhone);
                remaining.delete(nextPhone);
            } else {
                break;
            }
        }

        return selected;
    }

    _selectInitialConstraints() {
        const constraintTypes = [
            PhonologyModule.getDefaultConstraints,
            PhonologyModule.getComplexConstraints,
            PhonologyModule.getMoraConstraints
        ];
        const weights = CONFIG.CONSTRAINT_PROFILE_WEIGHTS;
        const selectedType = this._weightedChoice(constraintTypes, weights);
        return selectedType();
    }

    _selectInitialSyllableProfile() {
        const profile = new PhonologyModule.SyllableProfile();

        // Add some random variation to syllable shape preferences
        const variationFactor = Math.random() * 0.4 + 0.8; // 0.8 to 1.2
        const shapes = Object.assign({}, profile.shapes);

        // Randomly emphasize or de-emphasize certain syllable types
        for (const shape in shapes) {
            if (Math.random() < 0.3) {
                shapes[shape] *= Math.random() * 1.0 + 0.5; // 0.5 to 1.5
                shapes[shape] *= variationFactor;
            }
        }

        // Normalize to sum to 1.0
        const total = Object.values(shapes).reduce((sum, val) => sum + val, 0);
        if (total > 0) {
            for (const shape in shapes) {
                shapes[shape] /= total;
            }
        }

        profile.shapes = shapes;

        // Vary structural preferences
        profile.maxOnset = this._weightedChoice([1, 2, 3], [0.3, 0.6, 0.1]);
        profile.maxCoda = this._weightedChoice([0, 1, 2], [0.2, 0.6, 0.2]);
        profile.allowCoda = this._weightedChoice([true, false], [0.8, 0.2]);
        profile.allowComplexOnset = this._weightedChoice([true, false], [0.7, 0.3]);

        // Vary penalty strengths
        profile.hiatusPenalty = Math.random() * 0.6 - 0.8; // -0.8 to -0.2
        profile.codaPenalty = profile.allowCoda ?
            Math.random() * 0.2 - 0.2 : // -0.2 to 0.0
            Math.random() * 0.4 - 0.5;  // -0.5 to -0.1
        profile.sonorityViolationPenalty = Math.random() * 0.4 - 0.5; // -0.5 to -0.1

        return profile;
    }

    _deepCopyConstraints(constraints) {
        const copy = new PhonologyModule.PhonotacticConstraints();
        copy.syllableTypes = Object.assign({}, constraints.syllableTypes);
        copy.onsetClusters = new PhonologyModule.ClusterConstraint(
            constraints.onsetClusters.position,
            new Set([...constraints.onsetClusters.allowedCombinations])
        );
        copy.codaClusters = new PhonologyModule.ClusterConstraint(
            constraints.codaClusters.position,
            new Set([...constraints.codaClusters.allowedCombinations])
        );
        copy.allowedCodas = new Set([...constraints.allowedCodas]);
        copy.minSyllables = constraints.minSyllables;
        copy.maxSyllables = constraints.maxSyllables;
        copy.preferredSyllables = constraints.preferredSyllables;
        copy.useMora = constraints.useMora;
        copy.minMora = constraints.minMora;
        copy.maxMora = constraints.maxMora;
        copy.allowGemination = constraints.allowGemination;
        copy.geminationProbability = constraints.geminationProbability;
        copy.geminableConsonants = new Set([...constraints.geminableConsonants]);
        copy.forbiddenSequences = new Set([...constraints.forbiddenSequences]);
        copy.requiredSequences = new Map([...constraints.requiredSequences]);
        return copy;
    }

    _deepCopySyllableProfile(profile) {
        const copy = new PhonologyModule.SyllableProfile();
        copy.shapes = Object.assign({}, profile.shapes);
        copy.maxOnset = profile.maxOnset;
        copy.maxCoda = profile.maxCoda;
        copy.allowCoda = profile.allowCoda;
        copy.allowComplexOnset = profile.allowComplexOnset;
        copy.hiatusPenalty = profile.hiatusPenalty;
        copy.illegalClusterPenalty = profile.illegalClusterPenalty;
        copy.codaPenalty = profile.codaPenalty;
        copy.sonorityViolationPenalty = profile.sonorityViolationPenalty;
        copy.sonorityScale = Object.assign({}, profile.sonorityScale);
        return copy;
    }

    _featureDistance(p1, p2) {
        if (!PhonologyModule.IDX[p1] || !PhonologyModule.IDX[p2]) {
            return 10; // Max distance for unknown phonemes
        }
        const idx1 = PhonologyModule.IDX[p1];
        const idx2 = PhonologyModule.IDX[p2];
        return PhonologyModule.DIST[idx1][idx2];
    }

    _updatePhonologicalWeights() {
        this.mutWeights = PhonologyModule.computeMutationWeights(CONFIG.MUTATE_ALPHA);
        this.addWeights = PhonologyModule.computeAdditionWeights(CONFIG.ADD_SWEET_DIST, CONFIG.ADD_SWEET_BETA);
    }

    _driftPhonemes() {
        // Chance to add phonemes (bias toward better dispersion)
        if (Math.random() < CONFIG.P_PHONEME_ADD) {
            const available = new Set(PhonologyModule.INVENTORY.filter(p => !this.phonemeInventory.has(p)));
            if (available.size > 0) {
                if (Math.random() < CONFIG.P_OPTIMIZE_ADD) {
                    const optimalPhoneme = this._findOptimalPhonemeToAdd(this.phonemeInventory);
                    if (optimalPhoneme) {
                        this.phonemeInventory.add(optimalPhoneme);
                    }
                } else {
                    const availableArray = Array.from(available);
                    this.phonemeInventory.add(availableArray[Math.floor(Math.random() * availableArray.length)]);
                }
            }
        }

        // Chance to remove phonemes
        if (Math.random() < CONFIG.P_PHONEME_REMOVE && this.phonemeInventory.size > CONFIG.MIN_PHONEME_INVENTORY_SIZE) {
            if (Math.random() < CONFIG.P_OPTIMIZE_REMOVE) {
                const phonemeToRemove = this._findPhonemeToRemove(this.phonemeInventory);
                if (phonemeToRemove) {
                    this.phonemeInventory.delete(phonemeToRemove);
                }
            } else {
                const vowelsInInv = Array.from(this.phonemeInventory).filter(p => PhonologyModule.isSyllabic(p));
                if (vowelsInInv.length > CONFIG.MIN_VOWEL_COUNT) {
                    const candidates = Array.from(this.phonemeInventory).filter(p =>
                        !PhonologyModule.isSyllabic(p) || vowelsInInv.length > CONFIG.MIN_VOWEL_COUNT + 1);
                    if (candidates.length > 0) {
                        this.phonemeInventory.delete(candidates[Math.floor(Math.random() * candidates.length)]);
                    }
                }
            }
        }

        // Chance to substitute phonemes
        if (Math.random() < CONFIG.P_PHONEME_SUBSTITUTE) {
            if (this.phonemeInventory.size > CONFIG.MIN_VOWEL_COUNT) {
                const oldPhoneme = this._findSuboptimalPhonemeForSubstitution();
                if (oldPhoneme) {
                    const vowelsInInv = Array.from(this.phonemeInventory).filter(p => PhonologyModule.isSyllabic(p));
                    if (!(PhonologyModule.isSyllabic(oldPhoneme) && vowelsInInv.length <= CONFIG.MIN_VOWEL_COUNT)) {
                        const availablePhonemes = new Set(PhonologyModule.INVENTORY.filter(p => !this.phonemeInventory.has(p)));
                        if (availablePhonemes.size > 0) {
                            const replacement = this._findBestReplacement(oldPhoneme, availablePhonemes);
                            if (replacement) {
                                this.phonemeInventory.delete(oldPhoneme);
                                this.phonemeInventory.add(replacement);
                            }
                        }
                    }
                }
            }
        }

        // Update phonological generator after inventory changes
        this.phonologicalGenerator = new PhonologicalGenerator(
            this.phonemeInventory, this.phonotacticConstraints, this.preferredPhonemeCount);
    }

    _driftConstraints() {
        // Small chance to modify constraints
        let changed = false;
        if (Math.random() < CONFIG.P_CONSTRAINT_DRIFT) {

            // Modify syllable type preferences slightly
            if (Math.random() < CONFIG.P_SYLLABLE_DRIFT) {
                this._modifySyllablePreferences();
                changed = true;
            }

            // Change gemination settings
            if (Math.random() < CONFIG.P_GEMINATION_DRIFT) {
                this.phonotacticConstraints.allowGemination = !this.phonotacticConstraints.allowGemination;
                if (this.phonotacticConstraints.allowGemination) {
                    this.phonotacticConstraints.geminationProbability =
                        Math.random() * (CONFIG.GEMINATION_PROB_RANGE[1] - CONFIG.GEMINATION_PROB_RANGE[0]) +
                        CONFIG.GEMINATION_PROB_RANGE[0];
                }
                changed = true;
            }

            // Modify word length preferences
            if (Math.random() < CONFIG.P_WORD_LENGTH_DRIFT) {
                this.phonotacticConstraints.preferredSyllables =
                    Math.floor(Math.random() * (CONFIG.SYLLABLE_COUNT_RANGE[1] - CONFIG.SYLLABLE_COUNT_RANGE[0] + 1)) +
                    CONFIG.SYLLABLE_COUNT_RANGE[0];
                this.phonotacticConstraints.maxSyllables = Math.max(
                    this.phonotacticConstraints.preferredSyllables + 1,
                    this.phonotacticConstraints.maxSyllables
                );
                changed = true;
            }
        }

        // Update phonological generator with new constraints
        this.phonologicalGenerator = new PhonologicalGenerator(
            this.phonemeInventory, this.phonotacticConstraints, this.preferredPhonemeCount);

        if (changed) {
            this._recheckLexiconPhonotactics();
        }
    }

    _modifySyllablePreferences() {
        // Add some randomness to syllable preferences
        const currentPrefs = this.phonotacticConstraints.syllableTypes;
        const newPrefs = Object.assign({}, currentPrefs);

        // Randomly increase or decrease some preferences
        for (const syllType in currentPrefs) {
            if (Math.random() < 0.3) {
                const change = Math.random() * 0.2 - 0.1; // -0.1 to +0.1
                newPrefs[syllType] = Math.max(0.01, currentPrefs[syllType] + change);
            }
        }

        // Normalize to sum to 1.0
        const total = Object.values(newPrefs).reduce((sum, val) => sum + val, 0);
        if (total > 0) {
            for (const syllType in newPrefs) {
                newPrefs[syllType] /= total;
            }
        }

        this.phonotacticConstraints.syllableTypes = newPrefs;
    }

    _generateInitialLexicon() {
        const meanings = VocabularyModule.getVocabularySubset(120);
        for (const meaning of meanings) {
            const wordForm = this._generateWord();
            const repaired = this._enforcePhonotactics(wordForm);
            const word = new VocabularyModule.Word(repaired, meaning, this.id);
            this.lexicon.set(meaning, word);
        }

        // Language names live in the lexicon but remain immune to borrowing
        this.nameWord = this._generateNameWord();
    }

    _inheritLexicon(parent) {
        for (const [meaning, parentWord] of parent.lexicon) {
            // Copy with potential sound change
            const newForm = [...parentWord.form];
            if (Math.random() < 0.1) { // 10% chance of sound change
                this._applySoundChange(newForm);
            }

            const repaired = this._enforcePhonotactics(newForm);
            const word = new VocabularyModule.Word(repaired, meaning, parentWord.originLangId,
                parentWord.borrowedFrom, parentWord.generation + 1);
            this.lexicon.set(meaning, word);
        }
    }

    _generateWord() {
        const raw = this.phonologicalGenerator.generateWord();
        return this._enforcePhonotactics(raw);
    }

    _generateNameWord() {
        let nameForm = this._generateWord();

        // Fallback if name generation fails
        if (!nameForm || nameForm.length < 2) {
            const vowels = Array.from(this.phonemeInventory).filter(p => PhonologyModule.isSyllabic(p));
            const consonants = Array.from(this.phonemeInventory).filter(p => !PhonologyModule.isSyllabic(p));

            if (vowels.length > 0 && consonants.length > 0) {
                // Create a simple CV-CV pattern
                nameForm = [
                    consonants[Math.floor(Math.random() * consonants.length)],
                    vowels[Math.floor(Math.random() * vowels.length)],
                    consonants[Math.floor(Math.random() * consonants.length)],
                    vowels[Math.floor(Math.random() * vowels.length)]
                ];
            } else if (vowels.length > 0) {
                // Vowel-only fallback
                nameForm = Array(3).fill().map(() => vowels[Math.floor(Math.random() * vowels.length)]);
            } else if (consonants.length > 0) {
                // Consonant-vowel fallback with default vowel
                nameForm = [
                    consonants[Math.floor(Math.random() * consonants.length)], "a",
                    consonants[Math.floor(Math.random() * consonants.length)], "a"
                ];
            } else {
                // Ultimate fallback
                nameForm = `Lang${this.id}`.split('');
            }
        }

        const repaired = this._enforcePhonotactics(nameForm);
        return new VocabularyModule.Word(repaired, Language.LANGUAGE_NAME_MEANING, this.id);
    }

    get name() {
        const baseName = this.nameWord ? this.nameWord.stringForm : "";
        return baseName + this.geographicBranchMarker;
    }

    get nameWord() {
        return this.lexicon.get(Language.LANGUAGE_NAME_MEANING) || null;
    }

    set nameWord(word) {
        if (!word) {
            this.lexicon.delete(Language.LANGUAGE_NAME_MEANING);
            return;
        }

        let normalized = word;
        if (!(word instanceof VocabularyModule.Word)) {
            normalized = new VocabularyModule.Word(word, Language.LANGUAGE_NAME_MEANING, this.id);
        } else if (word.meaning !== Language.LANGUAGE_NAME_MEANING) {
            normalized = new VocabularyModule.Word(
                [...word.form],
                Language.LANGUAGE_NAME_MEANING,
                word.originLangId,
                word.borrowedFrom,
                word.generation
            );
        }

        const repaired = this._enforcePhonotactics(normalized.form);
        if (!this._arraysEqual(repaired, normalized.form)) {
            normalized.form = repaired;
        }

        this.lexicon.set(Language.LANGUAGE_NAME_MEANING, normalized);
    }

    _applySoundChange(wordForm) {
        if (wordForm.length === 0) return;

        const changeType = Math.random() < 0.33 ? "substitute" :
                          Math.random() < 0.5 ? "delete" : "insert";

        if (changeType === "substitute" && wordForm.length > 0) {
            const idx = Math.floor(Math.random() * wordForm.length);
            const oldPhone = wordForm[idx];
            if (this.phonemeInventory.has(oldPhone)) {
                // Find similar phoneme
                const candidates = Array.from(this.phonemeInventory).filter(p =>
                    this._featureDistance(oldPhone, p) <= 2);
                if (candidates.length > 0) {
                    wordForm[idx] = candidates[Math.floor(Math.random() * candidates.length)];
                }
            }
        } else if (changeType === "delete" && wordForm.length > 1) {
            // Don't delete if it would remove all vowels
            const idx = Math.floor(Math.random() * wordForm.length);
            if (!PhonologyModule.isSyllabic(wordForm[idx]) || PhonologyModule.syllableCount(wordForm) > 1) {
                wordForm.splice(idx, 1);
            }
        } else if (changeType === "insert") {
            const idx = Math.floor(Math.random() * (wordForm.length + 1));
            const phonemeArray = Array.from(this.phonemeInventory);
            const newPhone = phonemeArray[Math.floor(Math.random() * phonemeArray.length)];
            wordForm.splice(idx, 0, newPhone);
        }
    }

    _enforcePhonotactics(form) {
        let word = Array.isArray(form) ? [...form] : (form ? form.split('') : []);
        if (word.length === 0) {
            return word;
        }

        PhonologyModule.ensureHasVowel(word);
        this._repairOnsets(word);
        this._repairCodas(word);
        word = this._filterForbiddenSequencesForLanguage(word);
        PhonologyModule.ensureHasVowel(word);

        while (word.length > CONFIG.MAX_WORD_LENGTH) {
            word.pop();
        }

        PhonologyModule.ensureHasVowel(word);
        return word;
    }

    _filterForbiddenSequencesForLanguage(word) {
        const forbidden = this.phonotacticConstraints.forbiddenSequences;
        if (!forbidden || forbidden.size === 0) {
            return [...word];
        }

        const filtered = [...word];
        const vowels = this._getVowels();
        const consonants = this._getConsonants();
        const fallbackVowel = vowels.length > 0 ? vowels : [this.epentheticVowel];
        const fallbackConsonant = consonants.length > 0 ? consonants : Array.from(this.phonemeInventory);

        for (const serialized of forbidden) {
            const pattern = JSON.parse(serialized);
            const seqLen = pattern.length;
            let i = 0;
            while (i <= filtered.length - seqLen) {
                const sequence = filtered.slice(i, i + seqLen);
                if (JSON.stringify(sequence) === serialized) {
                    if (seqLen >= 2) {
                        const middleIdx = i + Math.floor(seqLen / 2);
                        const replacementSource = PhonologyModule.isSyllabic(pattern[Math.floor(seqLen / 2)]) ?
                            fallbackVowel : fallbackConsonant;
                        filtered[middleIdx] = replacementSource[Math.floor(Math.random() * replacementSource.length)];
                    }
                    i += seqLen;
                } else {
                    i += 1;
                }
            }
        }

        return filtered;
    }

    _repairOnsets(word) {
        let i = 0;
        while (i < word.length) {
            if (PhonologyModule.isSyllabic(word[i])) {
                i++;
                continue;
            }

            const isOnset = (i === 0) || PhonologyModule.isSyllabic(word[i - 1]);
            if (!isOnset) {
                i++;
                continue;
            }

            const start = i;
            let end = i;
            while (end < word.length && !PhonologyModule.isSyllabic(word[end])) {
                end++;
            }

            let allowedLen = 1;
            if ((end - start) >= 2 && this.syllableProfile.allowComplexOnset) {
                const candidate = [word[start], word[start + 1]];
                const serialized = JSON.stringify(candidate);
                if (this.phonotacticConstraints.onsetClusters.allowedCombinations.has(serialized)) {
                    allowedLen = 2;
                }
            }

            let excess = (end - start) - allowedLen;
            while (excess > 0) {
                word.splice(start + allowedLen, 0, this.epentheticVowel);
                excess--;
                end++;
            }

            i = end;
        }
    }

    _repairCodas(word) {
        let lastVowelIdx = word.length - 1;
        while (lastVowelIdx >= 0 && !PhonologyModule.isSyllabic(word[lastVowelIdx])) {
            lastVowelIdx--;
        }

        const clusterStart = lastVowelIdx + 1;
        if (clusterStart >= word.length) {
            return;
        }

        let pos = clusterStart;
        while (pos < word.length) {
            if (!this.syllableProfile.allowCoda) {
                word.splice(pos + 1, 0, this.epentheticVowel);
                pos += 2;
                continue;
            }

            const remaining = word.length - pos;
            if (remaining >= 2) {
                const pair = [word[pos], word[pos + 1]];
                const serialized = JSON.stringify(pair);
                if (remaining > 2 || !this.phonotacticConstraints.codaClusters.allowedCombinations.has(serialized)) {
                    word.splice(pos + 1, 0, this.epentheticVowel);
                    pos += 2;
                } else {
                    pos += 2;
                }
            } else {
                const consonant = word[pos];
                if (!this.phonotacticConstraints.allowedCodas.has(consonant)) {
                    word.splice(pos + 1, 0, this.epentheticVowel);
                    pos += 2;
                } else {
                    pos += 1;
                }
            }
        }
    }

    _getVowels() {
        return Array.from(this.phonemeInventory).filter(p => PhonologyModule.isSyllabic(p));
    }

    _getConsonants() {
        return Array.from(this.phonemeInventory).filter(p => !PhonologyModule.isSyllabic(p));
    }

    _arraysEqual(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }

    _recheckLexiconPhonotactics() {
        if (!this.lexicon || typeof this.lexicon.values !== 'function') {
            return;
        }
        try {
            for (const word of this.lexicon.values()) {
                const repaired = this._enforcePhonotactics(word.form);
                if (!this._arraysEqual(repaired, word.form)) {
                    word.form = repaired;
                }
            }
        } catch (err) {
            console.warn('Phonotactic recheck skipped (lexicon unavailable):', err);
        }
    }

    mutateWord(word) {
        if (!word.form || word.form.length === 0) {
            return false;
        }

        // Bias operations based on word length relative to preferred phoneme count
        const currentLength = word.form.length;
        const weights = [...CONFIG.MUTATE_OP_WEIGHTS];

        // If word is shorter than preferred, favor addition
        if (currentLength < this.preferredPhonemeCount) {
            weights[2] *= 2.0;  // Increase add weight
            weights[1] *= 0.3;  // Decrease delete weight
        }
        // If word is longer than preferred, favor deletion
        else if (currentLength > this.preferredPhonemeCount) {
            weights[1] *= 2.0;  // Increase delete weight
            weights[2] *= 0.3;  // Decrease add weight
        }

        const op = this._weightedChoice(["mutate", "delete", "add"], weights);

        let changed = false;

        if (op === "mutate") {
            const idx = Math.floor(Math.random() * word.form.length);
            const oldPhone = word.form[idx];
            if (PhonologyModule.IDX[oldPhone] !== undefined) {
                const oldIdx = PhonologyModule.IDX[oldPhone];
                const weightsForOld = this.mutWeights[oldIdx];
                const newIdx = this._weightedChoice(
                    PhonologyModule.INVENTORY.map((_, i) => i), weightsForOld);
                const newPhone = PhonologyModule.INVENTORY[newIdx];
                if (this.phonemeInventory.has(newPhone) && newPhone !== oldPhone) {
                    word.form[idx] = newPhone;
                    changed = true;
                }
            }
        } else if (op === "delete" && word.form.length > CONFIG.MIN_WORD_LENGTH) {
            const vowelPositions = word.form.map((p, i) => PhonologyModule.isSyllabic(p) ? i : -1)
                .filter(i => i !== -1);
            if (vowelPositions.length > 1) {
                const idx = Math.floor(Math.random() * word.form.length);
                word.form.splice(idx, 1);
                changed = true;
            } else {
                const consPositions = word.form.map((p, i) => !PhonologyModule.isSyllabic(p) ? i : -1)
                    .filter(i => i !== -1);
                if (consPositions.length > 0 && word.form.length > CONFIG.MIN_WORD_LENGTH) {
                    const idx = consPositions[Math.floor(Math.random() * consPositions.length)];
                    word.form.splice(idx, 1);
                    changed = true;
                }
            }
        } else if (op === "add" && word.form.length < CONFIG.MAX_WORD_LENGTH) {
            const anchorIdx = word.form.length > 0 ?
                Math.floor(Math.random() * word.form.length) : 0;
            const anchor = word.form.length > 0 ? word.form[anchorIdx] :
                Array.from(this.phonemeInventory)[Math.floor(Math.random() * this.phonemeInventory.size)];

            if (PhonologyModule.IDX[anchor] !== undefined) {
                const anchorIdxGlobal = PhonologyModule.IDX[anchor];
                const weightsForAnchor = this.addWeights[anchorIdxGlobal];
                const newIdx = this._weightedChoice(
                    PhonologyModule.INVENTORY.map((_, i) => i), weightsForAnchor);
                const newPhone = PhonologyModule.INVENTORY[newIdx];

                if (this.phonemeInventory.has(newPhone)) {
                    const pos = Math.floor(Math.random() * (word.form.length + 1));
                    word.form.splice(pos, 0, newPhone);
                    changed = true;
                }
            }
        }

        if (!changed) {
            return false;
        }

        const repaired = this._enforcePhonotactics(word.form);
        if (!this._arraysEqual(repaired, word.form)) {
            word.form = repaired;
        }

        word.generation += 1;
        return true;
    }

    borrowWord(sourceLang, meaning) {
        if (meaning === Language.LANGUAGE_NAME_MEANING) {
            return false;
        }

        if (!sourceLang.lexicon.has(meaning)) {
            return false;
        }

        const sourceWord = sourceLang.lexicon.get(meaning);
        const adaptedWord = this.adaptBorrowedWord(sourceWord);

        // Replace existing word
        this.lexicon.set(meaning, adaptedWord);
        return true;
    }

    getBorrowableMeanings() {
        return Array.from(this.lexicon.keys()).filter(
            meaning => meaning !== Language.LANGUAGE_NAME_MEANING
        );
    }

    adaptBorrowedWord(sourceWord) {
        const adaptedForm = [];

        for (const phone of sourceWord.form) {
            if (this.phonemeInventory.has(phone)) {
                adaptedForm.push(phone);
            } else {
                // Find closest phoneme in our inventory
                if (PhonologyModule.IDX[phone] !== undefined) {
                    let closest = phone;
                    let minDistance = Infinity;
                    for (const p of this.phonemeInventory) {
                        const distance = this._featureDistance(phone, p);
                        if (distance < minDistance) {
                            minDistance = distance;
                            closest = p;
                        }
                    }
                    adaptedForm.push(closest);
                } else {
                    // Fallback to random phoneme
                    const phonemeArray = Array.from(this.phonemeInventory);
                    adaptedForm.push(phonemeArray[Math.floor(Math.random() * phonemeArray.length)]);
                }
            }
        }

        PhonologyModule.ensureHasVowel(adaptedForm);
        const repaired = this._enforcePhonotactics(adaptedForm);

        return new VocabularyModule.Word(repaired, sourceWord.meaning, sourceWord.originLangId,
            sourceWord.originLangId, sourceWord.generation + 1);
    }

    split() {
        const daughter = new Language(this);
        this.children.push(daughter.id);
        return daughter;
    }

    branchGeographic() {
        // Create new language with same ID allocation system
        const branch = new Language(this);

        // Copy everything exactly (no drift for geographic branches)
        branch.phonemeInventory = new Set([...this.phonemeInventory]);
        branch.phonotacticConstraints = this._deepCopyConstraints(this.phonotacticConstraints);
        branch.phonologicalGenerator = new PhonologicalGenerator(
            branch.phonemeInventory, branch.phonotacticConstraints, branch.preferredPhonemeCount);
        branch.epentheticVowel = this.epentheticVowel;
        branch.lastEvolutionTick = this.lastEvolutionTick;

        // Copy lexicon exactly
        branch.lexicon = new Map();
        for (const [meaning, word] of this.lexicon) {
            const newWord = new VocabularyModule.Word([...word.form], meaning, word.originLangId,
                word.borrowedFrom, word.generation);
            branch.lexicon.set(meaning, newWord);
        }

        // Copy language properties
        branch.prestige = this.prestige;
        branch.conservatism = this.conservatism;
        // Copy name word exactly (no phonological change for geographic branches)
        if (this.nameWord) {
            branch.nameWord = new VocabularyModule.Word(
                [...this.nameWord.form],
                Language.LANGUAGE_NAME_MEANING,
                this.nameWord.originLangId,
                this.nameWord.borrowedFrom,
                this.nameWord.generation
            );
        }
        // Add geographic branch marker for display
        branch.geographicBranchMarker = this.geographicBranchMarker + "'";

        // Set up family relationships
        branch.parentId = this.id;
        branch.children = [];
        this.children.push(branch.id);

        // Copy prestige history
        branch.prestigeHistory = [...this.prestigeHistory];

        // Copy phonological weights
        branch._updatePhonologicalWeights();

        return branch;
    }

    getWordForMeaning(meaning) {
        return this.lexicon.get(meaning) || null;
    }

    getVocabularySize() {
        return this.lexicon.size;
    }

    getPhonemeCount() {
        return this.phonemeInventory.size;
    }

    getPhonotacticInfo() {
        const constraints = this.phonotacticConstraints;

        const info = {
            syllableTypes: constraints.syllableTypes,
            wordLength: {
                minSyllables: constraints.minSyllables,
                maxSyllables: constraints.maxSyllables,
                preferredSyllables: constraints.preferredSyllables
            },
            allowedCodas: Array.from(constraints.allowedCodas),
            onsetClusters: constraints.onsetClusters.allowedCombinations.size,
            codaClusters: constraints.codaClusters.allowedCombinations.size,
            gemination: {
                allowed: constraints.allowGemination,
                probability: constraints.allowGemination ? constraints.geminationProbability : 0,
                geminableConsonants: constraints.allowGemination ? Array.from(constraints.geminableConsonants) : []
            },
            moraBased: constraints.useMora,
            forbiddenSequences: constraints.forbiddenSequences.size
        };

        if (constraints.useMora) {
            info.moraConstraints = {
                minMora: constraints.minMora,
                maxMora: constraints.maxMora
            };
        }

        return info;
    }

    getConstraintSummary() {
        const constraints = this.phonotacticConstraints;

        // Determine system type
        let systemType;
        if (constraints.useMora) {
            systemType = "Mora-based";
        } else if (constraints.onsetClusters.allowedCombinations.size > 0) {
            systemType = "Complex (with consonant clusters)";
        } else {
            systemType = "Simple (basic syllable structure)";
        }

        // Most common syllable types
        const topSyllables = Object.entries(constraints.syllableTypes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3);
        const syllSummary = topSyllables
            .map(([syll, prob]) => `${syll} (${(prob * 100).toFixed(0)}%)`)
            .join(", ");

        const parts = [
            `System: ${systemType}`,
            `Common syllables: ${syllSummary}`,
            `Word length: ${constraints.minSyllables}-${constraints.maxSyllables} syllables`
        ];

        if (constraints.allowGemination) {
            parts.push(`Gemination: ${(constraints.geminationProbability * 100).toFixed(0)}% chance`);
        }

        if (constraints.forbiddenSequences.size > 0) {
            parts.push(`Forbidden sequences: ${constraints.forbiddenSequences.size}`);
        }

        return parts.join("; ");
    }

    // Utility functions
    _shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    _weightedChoice(choices, weights) {
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < choices.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return choices[i];
            }
        }

        return choices[choices.length - 1];
    }

    _calculateInventoryDispersion(inventory) {
        if (inventory.size <= 1) {
            return 0.0;
        }

        let totalDistance = 0.0;
        let count = 0;

        const inventoryArray = Array.from(inventory);
        for (let i = 0; i < inventoryArray.length; i++) {
            for (let j = i + 1; j < inventoryArray.length; j++) {
                totalDistance += this._featureDistance(inventoryArray[i], inventoryArray[j]);
                count += 1;
            }
        }

        return count > 0 ? totalDistance / count : 0.0;
    }

    _findOptimalPhonemeToAdd(currentInventory) {
        const available = new Set(PhonologyModule.INVENTORY.filter(p => !currentInventory.has(p)));
        if (available.size === 0) {
            return null;
        }

        let bestPhoneme = null;
        let bestDispersion = -1.0;

        for (const candidate of available) {
            const testInventory = new Set([...currentInventory, candidate]);
            const dispersion = this._calculateInventoryDispersion(testInventory);

            if (dispersion > bestDispersion) {
                bestDispersion = dispersion;
                bestPhoneme = candidate;
            }
        }

        return bestPhoneme;
    }

    _findPhonemeToRemove(currentInventory) {
        if (currentInventory.size <= CONFIG.MIN_VOWEL_COUNT) {
            return null;
        }

        // Don't remove if it would leave too few vowels
        const vowelsInInv = Array.from(currentInventory).filter(p => PhonologyModule.isSyllabic(p));

        let bestPhoneme = null;
        let bestDispersion = -1.0;

        for (const candidate of currentInventory) {
            // Preserve vowel minimum
            if (PhonologyModule.isSyllabic(candidate) && vowelsInInv.length <= CONFIG.MIN_VOWEL_COUNT) {
                continue;
            }

            const testInventory = new Set([...currentInventory]);
            testInventory.delete(candidate);
            const dispersion = this._calculateInventoryDispersion(testInventory);

            if (dispersion > bestDispersion) {
                bestDispersion = dispersion;
                bestPhoneme = candidate;
            }
        }

        return bestPhoneme;
    }

    _findSuboptimalPhonemeForSubstitution() {
        if (this.phonemeInventory.size <= CONFIG.MIN_VOWEL_COUNT) {
            return null;
        }

        // Don't substitute if it would leave too few vowels
        const vowelsInInv = Array.from(this.phonemeInventory).filter(p => PhonologyModule.isSyllabic(p));

        let bestPhoneme = null;
        let bestDispersion = -1.0;

        for (const candidate of this.phonemeInventory) {
            // Preserve vowel minimum
            if (PhonologyModule.isSyllabic(candidate) && vowelsInInv.length <= CONFIG.MIN_VOWEL_COUNT) {
                continue;
            }

            // Test what happens if we remove this phoneme
            const testInventory = new Set([...this.phonemeInventory]);
            testInventory.delete(candidate);
            const dispersion = this._calculateInventoryDispersion(testInventory);

            // Find phoneme whose removal LEAST harms dispersion (contributes least)
            if (dispersion > bestDispersion) {
                bestDispersion = dispersion;
                bestPhoneme = candidate;
            }
        }

        return bestPhoneme;
    }

    _findBestReplacement(oldPhoneme, availablePhonemes) {
        const currentDispersion = this._calculateInventoryDispersion(this.phonemeInventory);

        const candidates = [];
        const dispersionImprovements = [];
        const similarityWeights = [];
        const oldIdx = PhonologyModule.IDX[oldPhoneme];

        if (oldIdx === undefined) return null;

        for (const candidate of availablePhonemes) {
            const candidateIdx = PhonologyModule.IDX[candidate];
            if (candidateIdx !== undefined) {
                // Preserve vowel/consonant type preference
                if (PhonologyModule.isSyllabic(oldPhoneme) === PhonologyModule.isSyllabic(candidate)) {
                    // Test inventory with substitution
                    const testInventory = new Set([...this.phonemeInventory]);
                    testInventory.delete(oldPhoneme);
                    testInventory.add(candidate);
                    const newDispersion = this._calculateInventoryDispersion(testInventory);

                    // Collect metrics for normalization
                    const dispersionImprovement = Math.max(0, newDispersion - currentDispersion);
                    const similarityWeight = this.mutWeights[oldIdx][candidateIdx];

                    candidates.push(candidate);
                    dispersionImprovements.push(dispersionImprovement);
                    similarityWeights.push(similarityWeight);
                }
            }
        }

        // Normalize both components and combine with proper weighting
        const weights = [];
        if (candidates.length > 0) {
            // Normalize dispersion improvements
            const maxDisp = Math.max(...dispersionImprovements);
            const normDispersion = dispersionImprovements.map(d => maxDisp > 0 ? d / maxDisp : 0);

            // Normalize similarity weights
            const maxSim = Math.max(...similarityWeights);
            const normSimilarity = similarityWeights.map(s => maxSim > 0 ? s / maxSim : 0);

            // Combine with 70/30 weighting (dispersion/similarity)
            for (let i = 0; i < candidates.length; i++) {
                const combinedWeight = maxDisp > 0 ?
                    CONFIG.DISPERSION_WEIGHT * normDispersion[i] + CONFIG.SIMILARITY_WEIGHT * normSimilarity[i] :
                    normSimilarity[i];
                weights.push(combinedWeight);
            }
        }

        if (candidates.length > 0 && weights.length > 0 && Math.max(...weights) > 0) {
            // Choose replacement based on combined score
            const newPhoneme = this._weightedChoice(candidates, weights);

            // Safeguard: verify substitution doesn't significantly harm dispersion
            const testInventory = new Set([...this.phonemeInventory]);
            testInventory.delete(oldPhoneme);
            testInventory.add(newPhoneme);
            const finalDispersion = this._calculateInventoryDispersion(testInventory);
            const dispersionChange = finalDispersion - currentDispersion;

            // Only proceed if dispersion doesn't decrease significantly
            if (dispersionChange >= CONFIG.DISPERSION_TOLERANCE) {
                return newPhoneme;
            }
        }

        return null;
    }

    // Prestige drift method
    _driftPrestige(speakerCount, avgCommunityPrestige = 0.5) {
        // Prestige drift with bias toward middle values and speaker count influence
        const drift = (Math.random() - 0.5) * CONFIG.PRESTIGE_DRIFT_MAGNITUDE;

        const clampedAvg = Math.max(0, Math.min(1, avgCommunityPrestige));
        const avgDelta = clampedAvg - 0.5;
        const adaptiveFactor = 1 + Math.abs(avgDelta) * CONFIG.PRESTIGE_COMMUNITY_FEEDBACK;

        // Bias toward middle value (0.5) adaptively scaled by community average
        const middleBias = (0.5 - this.prestige) * CONFIG.PRESTIGE_MIDDLE_BIAS_STRENGTH * adaptiveFactor;

        // Community-wide shift nudges prestige opposite the average deviation
        const communityBias = -avgDelta * CONFIG.PRESTIGE_COMMUNITY_SHIFT;

        // Speaker count influence (more speakers = slight prestige boost)
        const speakerInfluence = Math.log(speakerCount + 1) * 0.01;

        this.prestige += drift + middleBias + communityBias + speakerInfluence;
        this.prestige = Math.max(0.01, Math.min(0.99, this.prestige));

        // Update prestige history
        this.prestigeHistory.push(this.prestige);
        if (this.prestigeHistory.length > CONFIG.MAX_HISTORY_LENGTH) {
            this.prestigeHistory.shift();
        }
    }

    // Evolution method (simplified)
    evolve(tick, contactLanguages = []) {
        // Basic evolution - mainly for compatibility
        // In the original this was much more complex
        if (tick - this.lastEvolutionTick > CONFIG.EVOLUTION_INTERVAL) {
            // Apply some phonological drift
            if (Math.random() < 0.1) {
                this._driftPhonemes();
            }

            // Apply constraint drift
            if (Math.random() < 0.05) {
                this._driftConstraints();
            }

            this.lastEvolutionTick = tick;
        }
    }
}

// Export language utilities
window.LanguageModule = {
    Language,
    PhonologicalGenerator
};
