/**
 * Main simulation engine for language evolution and spread
 * Ported from the original Python implementation
 */

/**
 * Language Evolution Simulation class
 * Main simulation managing languages, communities, and evolution
 */
class LanguageEvolutionSimulation {
    constructor(world) {
        this.world = world;
        this.languages = new Map();
        this.tickCount = 0;

        // Contiguity tracking
        this.dirtyLanguages = new Set();

        // Initialize with starter languages
        this._initializeLanguages();

        // Add additional seeding for better island population
        this._seedDistantRegions();

        // Statistics tracking
        this.statsHistory = [];
        this.lastStatsUpdate = 0;

        // Performance tracking
        this.lastUpdateTime = Date.now();
        this.updateTimes = [];
    }

    _initializeLanguages() {
        // Create initial languages
        for (const starterWord of CONFIG.STARTER_WORDS) {
            const lang = new LanguageModule.Language();
            this.languages.set(lang.id, lang);

            // Place in random community
            const community = this.world.getRandomCommunity();
            if (community) {
                community.languageId = lang.id;
                // Add the starter word to vocabulary if meaning exists
                if (VocabularyModule.CORE_VOCABULARY.length > 0) {
                    const meaning = VocabularyModule.CORE_VOCABULARY[
                        Math.floor(Math.random() * VocabularyModule.CORE_VOCABULARY.length)];
                    const starterWordObj = new VocabularyModule.Word(starterWord, meaning, lang.id);
                    lang.lexicon.set(meaning, starterWordObj);
                }
            }
        }
    }

    _seedDistantRegions() {
        const emptyCommunities = this.world.communities.filter(c => c.languageId === -1);
        const existingLanguages = Array.from(this.languages.values());

        if (existingLanguages.length === 0 || emptyCommunities.length === 0) {
            return;
        }

        // Only seed 2-3 additional communities to keep it minimal
        const numSeeds = Math.min(3, emptyCommunities.length, existingLanguages.length);
        if (numSeeds > 0) {
            const selectedCommunities = this._shuffleArray(emptyCommunities).slice(0, numSeeds);
            for (let i = 0; i < selectedCommunities.length; i++) {
                const community = selectedCommunities[i];
                // Assign to an existing language (cycling through them)
                const language = existingLanguages[i % existingLanguages.length];
                community.languageId = language.id;
                this.dirtyLanguages.add(language.id);
            }
        }
    }

    step() {
        const startTime = Date.now();
        this.tickCount++;

        // Print statistics periodically
        if (CONFIG.PRINT_STATS && (this.tickCount % CONFIG.STATS_INTERVAL === 0)) {
            this._printStatistics();
        }

        // Shuffle communities for random processing order
        this.world.shuffleCommunities();

        // Process each community
        for (const community of this.world.getShuffledCommunities()) {
            if (community.languageId < 0) {
                continue;
            }

            const language = this.languages.get(community.languageId);
            if (!language) {
                continue;
            }

            // Language internal change
            this._applyLanguageChange(language);

            // Language spread
            if (Math.random() < CONFIG.P_SPREAD) {
                this._attemptLanguageSpread(community, language);
            }

            // Word borrowing
            if (Math.random() < CONFIG.P_BORROW) {
                this._attemptWordBorrowing(community, language);
            }

            // Language splitting
            if (Math.random() < CONFIG.P_LANGUAGE_SPLIT) {
                this._attemptLanguageSplit(community, language);
            }

            // Size-based language splitting (independent of geography)
            this._attemptSizeBasedSplit(community, language);

            // Long-distance spread (maritime migration, trade routes, etc.)
            if (Math.random() < CONFIG.P_LONG_DISTANCE_SPREAD) {
                this._attemptLongDistanceSpread(community, language);
            }

            // Prestige drift
            if (Math.random() < CONFIG.P_PRESTIGE_DRIFT) {
                const languageCommunities = this.world.getCommunitiesWithLanguage(language.id);
                const speakerCount = languageCommunities.length;
                const avgCommunityPrestige = speakerCount > 0 ?
                    languageCommunities.reduce((sum, comm) => sum + comm.prestige, 0) / speakerCount :
                    0.5;
                language._driftPrestige(speakerCount, avgCommunityPrestige);
            }
        }

        // Enforce language contiguity if enabled
        if (CONFIG.CONTIGUITY_STRICT && this.tickCount % CONFIG.CONTIGUITY_ENFORCE_INTERVAL === 0) {
            this._enforceContiguity();
        }

        // Track performance
        const endTime = Date.now();
        const updateTime = endTime - startTime;
        this.updateTimes.push(updateTime);
        if (this.updateTimes.length > 100) {
            this.updateTimes.shift();
        }
        this.lastUpdateTime = endTime;
    }

    _applyLanguageChange(language) {
        // Apply phonological evolution with contact influence
        const contactLanguages = this._getContactLanguages(language.id);
        // language.evolve(this.tickCount, contactLanguages); // Simplified for now

        // Mutate random words
        if (Math.random() < CONFIG.P_MUTATE) {
            const meanings = Array.from(language.lexicon.keys());
            if (meanings.length > 0) {
                const meaning = meanings[Math.floor(Math.random() * meanings.length)];
                const word = language.lexicon.get(meaning);
                if (word) {
                    language.mutateWord(word);
                }
            }
        }
    }

    _attemptLanguageSpread(sourceCommunity, language) {
        const neighbors = this.world.getNeighbors(sourceCommunity);
        if (neighbors.length === 0) {
            return;
        }

        // Calculate spread probability based on prestige (softly weighted)
        const prestigeProduct = language.prestige * sourceCommunity.prestige;
        const prestigeInfluence = CONFIG.PRESTIGE_BASE_SPREAD + prestigeProduct * CONFIG.PRESTIGE_SPREAD_WEIGHT;

        for (const neighbor of neighbors) {
            if (neighbor.languageId === sourceCommunity.languageId) {
                continue;
            }

            // Distance-based probability (already neighbors, so base probability)
            const spreadProb = Math.max(0, prestigeInfluence);

            if (Math.random() < spreadProb) {
                // Language spreads
                const oldLangId = neighbor.languageId;
                neighbor.languageId = sourceCommunity.languageId;

                // If neighbor had a different language, it might be lost
                // Track language changes for contiguity
                this.dirtyLanguages.add(sourceCommunity.languageId);
                if (oldLangId >= 0) {
                    this.dirtyLanguages.add(oldLangId);
                    const remainingSpeakers = this.world.getCommunitiesWithLanguage(oldLangId);
                    if (remainingSpeakers.length === 0) {
                        // Language went extinct
                        if (this.languages.has(oldLangId)) {
                            this.languages.delete(oldLangId);
                        }
                    }
                }

                return; // Only spread to one neighbor per step
            }
        }
    }

    _attemptWordBorrowing(community, language) {
        const neighbors = this.world.getNeighbors(community);
        if (neighbors.length === 0) {
            return;
        }

        // Find neighbors with different languages
        const sourceNeighbors = neighbors.filter(n =>
            n.languageId !== community.languageId && n.languageId >= 0);

        if (sourceNeighbors.length === 0) {
            return;
        }

        // Choose source based on prestige
        const sourceCommunity = sourceNeighbors.reduce((best, current) =>
            current.prestige > best.prestige ? current : best);
        const sourceLanguage = this.languages.get(sourceCommunity.languageId);

        if (!sourceLanguage) {
            return;
        }

        // Borrow a random word
        const sourceMeanings = sourceLanguage.getBorrowableMeanings();
        if (sourceMeanings.length > 0) {
            const meaning = sourceMeanings[Math.floor(Math.random() * sourceMeanings.length)];
            const prestigeBorrowProb = CONFIG.PRESTIGE_BASE_BORROW + sourceCommunity.prestige * CONFIG.PRESTIGE_BORROW_WEIGHT;
            if (Math.random() < prestigeBorrowProb) {
                language.borrowWord(sourceLanguage, meaning);
            }
        }
    }

    _attemptLanguageSplit(community, language) {
        // Only split if language has enough speakers
        const speakers = this.world.getCommunitiesWithLanguage(language.id);
        if (speakers.length < 5) {
            return;
        }

        // Find connected components to choose a contiguous cluster
        const components = this.world.findConnectedComponents(language.id);
        if (components.length <= 1) {
            return; // Already contiguous, can't split meaningfully
        }

        // Choose a smaller component to split off (not the largest)
        components.sort((a, b) => b.length - a.length);
        const splitCandidates = components.slice(1); // All except the largest

        if (splitCandidates.length === 0) {
            return;
        }

        // Select a component to split off
        const componentToSplit = splitCandidates[Math.floor(Math.random() * splitCandidates.length)];

        // Only proceed if the component is substantial enough
        if (componentToSplit.length < 2) {
            return;
        }

        // Create daughter language
        const daughter = language.split();
        this.languages.set(daughter.id, daughter);

        // Assign the entire connected component to daughter language
        for (const comm of componentToSplit) {
            comm.languageId = daughter.id;
        }

        // Track language changes for contiguity
        this.dirtyLanguages.add(language.id);
        this.dirtyLanguages.add(daughter.id);
    }

    _attemptSizeBasedSplit(community, language) {
        const speakers = this.world.getCommunitiesWithLanguage(language.id);
        const speakerCount = speakers.length;

        // Only split if language is large enough
        if (speakerCount < CONFIG.SIZE_SPLIT_THRESHOLD) {
            return;
        }

        // Calculate size-based split probability
        const sizeExcess = speakerCount - CONFIG.SIZE_SPLIT_THRESHOLD;
        const splitProbability = CONFIG.P_SIZE_SPLIT_BASE + (sizeExcess * CONFIG.SIZE_SPLIT_SCALING);

        if (Math.random() > splitProbability) {
            return;
        }

        // Split the territory roughly in half
        const communities = [...speakers];
        this._shuffleArray(communities); // Randomize which half gets which communities

        const splitSize = Math.floor(communities.length / 2);
        if (splitSize < 2) { // Need at least 2 communities for meaningful split
            return;
        }

        // Create daughter language
        const daughter = language.split();
        this.languages.set(daughter.id, daughter);

        // Assign roughly half the communities to daughter language
        const communitiesToSplit = communities.slice(0, splitSize);
        for (const comm of communitiesToSplit) {
            comm.languageId = daughter.id;
        }

        // Track language changes for contiguity
        this.dirtyLanguages.add(language.id);
        this.dirtyLanguages.add(daughter.id);
    }

    _enforceContiguity() {
        // Work on a copy since we'll be modifying the set
        const languagesToCheck = Array.from(this.dirtyLanguages);
        this.dirtyLanguages.clear();

        for (const langId of languagesToCheck) {
            if (!this.languages.has(langId)) {
                continue;
            }

            const language = this.languages.get(langId);
            const components = this.world.findConnectedComponents(langId);

            if (components.length <= 1) {
                continue; // Language is contiguous or extinct
            }

            // Keep the largest component as the original language
            const largestComponent = components.reduce((largest, current) =>
                current.length > largest.length ? current : largest);

            // Create new languages for other components
            for (const component of components) {
                if (component === largestComponent) {
                    continue;
                }

                // Create a geographic branch
                const branch = language.branchGeographic();
                this.languages.set(branch.id, branch);

                // Assign communities to the new language
                for (const community of component) {
                    community.languageId = branch.id;
                }
            }
        }
    }

    _attemptLongDistanceSpread(sourceCommunity, language) {
        // Only spread from communities that already have this language
        if (sourceCommunity.languageId !== language.id) {
            return;
        }

        // Find distant communities
        const distantCommunities = this.world.getDistantCommunities(
            sourceCommunity,
            CONFIG.LONG_DISTANCE_MIN,
            CONFIG.LONG_DISTANCE_RANGE
        );

        if (distantCommunities.length === 0) {
            return;
        }

        // Calculate long-distance spread probability (much lower than local spread)
        const prestigeProduct = language.prestige * sourceCommunity.prestige;
        const prestigeInfluence = CONFIG.PRESTIGE_BASE_SPREAD + prestigeProduct * CONFIG.PRESTIGE_SPREAD_WEIGHT;

        // Choose a random distant community
        const target = distantCommunities[Math.floor(Math.random() * distantCommunities.length)];

        // Distance-based probability reduction (farther = less likely)
        const distance = sourceCommunity.distanceTo(target);
        const distanceFactor = Math.max(0.1, 1.0 - (distance - CONFIG.LONG_DISTANCE_MIN) / CONFIG.LONG_DISTANCE_RANGE);

        // Long-distance spread probability (higher than before to allow maritime/trade connections)
        const spreadProb = Math.max(0, prestigeInfluence * distanceFactor);

        if (Math.random() < spreadProb) {
            // Long-distance language spread occurs
            const oldLangId = target.languageId;
            target.languageId = language.id;

            // Track language changes for contiguity
            this.dirtyLanguages.add(language.id);
            if (oldLangId >= 0) {
                this.dirtyLanguages.add(oldLangId);
            }

            // If target had a different language, it might be lost
            if (oldLangId >= 0) {
                const remainingSpeakers = this.world.getCommunitiesWithLanguage(oldLangId);
                if (remainingSpeakers.length === 0) {
                    // Language went extinct
                    if (this.languages.has(oldLangId)) {
                        this.languages.delete(oldLangId);
                    }
                }
            }
        }
    }

    _printStatistics() {
        const worldStats = this.world.calculateLanguageStats();

        console.log(`\n=== Tick ${this.tickCount} ===`);
        console.log(`Communities: ${worldStats.speakingCommunities}/${worldStats.totalCommunities}`);
        console.log(`Languages: ${worldStats.languages}`);
        console.log(`Largest language: ${worldStats.largestLanguage} speakers`);

        // Show top languages
        if (Object.keys(worldStats.languageDistribution).length > 0) {
            const sortedLangs = Object.entries(worldStats.languageDistribution)
                .sort(([, a], [, b]) => b - a);

            console.log(`Top ${Math.min(CONFIG.LEADERBOARD_TOPK, sortedLangs.length)} languages:`);
            for (let i = 0; i < Math.min(CONFIG.LEADERBOARD_TOPK, sortedLangs.length); i++) {
                const [langId, count] = sortedLangs[i];
                const language = this.languages.get(parseInt(langId));
                const name = language ? language.name : `Lang${langId}`;
                console.log(`  ${i + 1}. ${name}: ${count} speakers`);
            }
        }

        // Show sample words
        if (this.languages.size > 0) {
            const sampleLang = Array.from(this.languages.values())[
                Math.floor(Math.random() * this.languages.size)];
            const sampleWords = Array.from(sampleLang.lexicon.entries()).slice(0, 3);
            console.log(`Sample words from ${sampleLang.name}:`);
            for (const [meaning, word] of sampleWords) {
                console.log(`  ${word.stringForm} = '${meaning}'`);
            }
        }

        // Store statistics for display
        this.statsHistory.push({
            tick: this.tickCount,
            ...worldStats,
            averageUpdateTime: this.updateTimes.length > 0 ?
                this.updateTimes.reduce((a, b) => a + b, 0) / this.updateTimes.length : 0
        });

        // Keep history manageable
        if (this.statsHistory.length > 1000) {
            this.statsHistory = this.statsHistory.slice(-500);
        }

        this.lastStatsUpdate = this.tickCount;
    }

    getLanguageById(langId) {
        return this.languages.get(langId) || null;
    }

    getAllLanguages() {
        return Array.from(this.languages.values());
    }

    getCommunityLanguageName(community) {
        if (community.languageId < 0) {
            return "";
        }
        const language = this.languages.get(community.languageId);
        return language ? language.name : `Lang${community.languageId}`;
    }

    _getContactLanguages(languageId) {
        const contactLanguages = [];

        // Find communities speaking this language
        const speakingCommunities = this.world.getCommunitiesWithLanguage(languageId);
        const contactLangIds = new Set();

        // Find neighboring languages
        for (const community of speakingCommunities) {
            const neighbors = this.world.getNeighbors(community);
            for (const neighbor of neighbors) {
                if (neighbor.languageId !== languageId && neighbor.languageId >= 0) {
                    contactLangIds.add(neighbor.languageId);
                }
            }
        }

        // Get Language objects for contact languages
        for (const langId of contactLangIds) {
            if (this.languages.has(langId)) {
                contactLanguages.push(this.languages.get(langId));
            }
        }

        // Sort by prestige (most influential first)
        contactLanguages.sort((a, b) => b.prestige - a.prestige);

        return contactLanguages.slice(0, 5); // Limit to top 5 contact languages
    }

    // Performance and statistics methods
    getPerformanceStats() {
        return {
            averageUpdateTime: this.updateTimes.length > 0 ?
                this.updateTimes.reduce((a, b) => a + b, 0) / this.updateTimes.length : 0,
            lastUpdateTime: this.lastUpdateTime,
            tickCount: this.tickCount,
            languageCount: this.languages.size,
            totalCommunities: this.world.communities.length
        };
    }

    getDetailedStats() {
        const worldStats = this.world.calculateLanguageStats();
        const languagesBySize = Array.from(this.languages.values())
            .map(lang => ({
                language: lang,
                speakers: this.world.getCommunitiesWithLanguage(lang.id).length
            }))
            .sort((a, b) => b.speakers - a.speakers);

        return {
            tick: this.tickCount,
            ...worldStats,
            topLanguages: languagesBySize.slice(0, 10),
            performance: this.getPerformanceStats(),
            evolutionStats: this._getEvolutionStats()
        };
    }

    _getEvolutionStats() {
        const languages = Array.from(this.languages.values());
        if (languages.length === 0) return {};

        const generations = languages.map(l => l.generation);
        const phonemeCounts = languages.map(l => l.getPhonemeCount());
        const vocabularySizes = languages.map(l => l.getVocabularySize());

        return {
            averageGeneration: generations.reduce((a, b) => a + b, 0) / generations.length,
            maxGeneration: Math.max(...generations),
            averagePhonemeCount: phonemeCounts.reduce((a, b) => a + b, 0) / phonemeCounts.length,
            averageVocabularySize: vocabularySizes.reduce((a, b) => a + b, 0) / vocabularySizes.length,
            languageFamilies: this._countLanguageFamilies()
        };
    }

    _countLanguageFamilies() {
        const rootAncestors = new Set();
        for (const language of this.languages.values()) {
            // Find root ancestor
            let root = language;
            const visited = new Set([language.id]);

            while (root.parentId !== null && !visited.has(root.parentId)) {
                const parent = this.languages.get(root.parentId);
                if (parent) {
                    visited.add(root.parentId);
                    root = parent;
                } else {
                    break;
                }
            }

            rootAncestors.add(root.id);
        }
        return rootAncestors.size;
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

    // Save/Load functionality
    export() {
        return {
            tickCount: this.tickCount,
            languages: Array.from(this.languages.entries()).map(([id, lang]) => [id, this._exportLanguage(lang)]),
            world: this.world.export(),
            dirtyLanguages: Array.from(this.dirtyLanguages),
            statsHistory: this.statsHistory.slice(-100) // Only recent history
        };
    }

    _exportLanguage(language) {
        return {
            id: language.id,
            generation: language.generation,
            phonemeInventory: Array.from(language.phonemeInventory),
            prestige: language.prestige,
            conservatism: language.conservatism,
            parentId: language.parentId,
            children: language.children,
            name: language.nameWord.stringForm,
            geographicBranchMarker: language.geographicBranchMarker,
            lexicon: Array.from(language.lexicon.entries()).map(([meaning, word]) => [meaning, {
                form: word.form,
                meaning: word.meaning,
                originLangId: word.originLangId,
                borrowedFrom: word.borrowedFrom,
                generation: word.generation
            }])
        };
    }

    static import(data) {
        // This would need to reconstruct the simulation from saved data
        // Implementation depends on specific requirements
        console.warn('Import functionality not yet implemented');
        return null;
    }
}

// Export simulation utilities
window.SimulationModule = {
    LanguageEvolutionSimulation
};
