/**
 * Main application controller for the Language Evolution Simulator
 * Handles UI interactions, simulation control, and application state
 */

class LanguageEvolutionApp {
    constructor() {
        // Application state
        this.simulation = null;
        this.renderer = null;
        this.isRunning = false;
        this.animationId = null;
        this.simulationSpeed = 20; // FPS
        this.lastFrameTime = 0;

        // UI elements
        this.initializeUIElements();

        // Initialize application
        this.initialize();
    }

    initializeUIElements() {
        // Canvas and main elements
        this.canvas = document.getElementById('world-canvas');
        this.loadingScreen = document.getElementById('loading-screen');
        this.loadingBar = document.getElementById('loading-bar');
        this.loadingText = document.querySelector('.loading-text');

        // Control elements
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.newWorldBtn = document.getElementById('new-world-btn');
        this.settingsBtn = document.getElementById('settings-btn');

        // Map mode controls
        this.mapModeSelect = document.getElementById('mapmode-select');
        this.vocabularySelect = document.getElementById('vocabulary-select');
        this.vocabularyLabel = document.getElementById('vocabulary-label');

        // Statistics display
        this.tickCounter = document.getElementById('tick-counter');
        this.languageCount = document.getElementById('language-count');
        this.communityCount = document.getElementById('community-count');

        // Language panel
        this.languagePanel = document.getElementById('language-panel');
        this.closePanelBtn = document.getElementById('close-panel-btn');

        // Settings modal
        this.settingsModal = document.getElementById('settings-modal');
        this.closeSettingsBtn = document.getElementById('close-settings-btn');
        this.applySettingsBtn = document.getElementById('apply-settings-btn');
        this.resetSettingsBtn = document.getElementById('reset-settings-btn');

        // Statistics panel
        this.statsPanel = document.getElementById('stats-panel');

        // Help overlay
        this.helpOverlay = document.getElementById('help-overlay');
        this.closeHelpBtn = document.getElementById('close-help-btn');

        // Bind event listeners
        this.bindEventListeners();
    }

    bindEventListeners() {
        // Control buttons
        this.playPauseBtn.addEventListener('click', () => this.toggleSimulation());
        this.resetBtn.addEventListener('click', () => this.resetSimulation());
        this.newWorldBtn.addEventListener('click', () => this.generateNewWorld());
        this.settingsBtn.addEventListener('click', () => this.showSettings());

        // Map mode controls
        this.mapModeSelect.addEventListener('change', (e) => this.setMapMode(e.target.value));
        this.vocabularySelect.addEventListener('change', (e) => this.setVocabularyWord(e.target.value));

        // Panel controls
        this.closePanelBtn.addEventListener('click', () => this.hideLanguagePanel());

        // Settings modal
        this.closeSettingsBtn.addEventListener('click', () => this.hideSettings());
        this.applySettingsBtn.addEventListener('click', () => this.applySettings());
        this.resetSettingsBtn.addEventListener('click', () => this.resetSettings());

        // Help
        this.closeHelpBtn.addEventListener('click', () => this.hideHelp());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Canvas events
        this.canvas.addEventListener('languageSelected', (e) => this.showLanguageDetails(e.detail));

        // Settings range inputs
        this.setupSettingsInputs();

        // Resize handling
        window.addEventListener('resize', () => this.handleResize());

        // Close modals on escape or outside click
        this.setupModalHandling();
    }

    setupSettingsInputs() {
        // Update display values for range inputs
        const rangeInputs = document.querySelectorAll('input[type="range"]');
        rangeInputs.forEach(input => {
            const valueSpan = document.getElementById(input.id + '-value');
            if (valueSpan) {
                input.addEventListener('input', () => {
                    let value = input.value;
                    if (input.id === 'simulation-speed') {
                        value += ' FPS';
                    }
                    valueSpan.textContent = value;
                });
            }
        });
    }

    setupModalHandling() {
        // Close modals on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideSettings();
                this.hideLanguagePanel();
                this.hideHelp();
            }
        });

        // Close modals on outside click
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.hideSettings();
            }
        });

        this.helpOverlay.addEventListener('click', (e) => {
            if (e.target === this.helpOverlay) {
                this.hideHelp();
            }
        });
    }

    async initialize() {
        try {
            this.showLoading('Initializing application...');
            await this.sleep(100);

            // Generate initial world
            await this.generateNewWorld();

            this.updateUI();

            console.log('Language Evolution Simulator initialized');
            console.log('Controls:');
            console.log('  Space - Pause/Resume simulation');
            console.log('  R - Reset simulation');
            console.log('  N - Generate new world');
            console.log('  M - Cycle map modes');
            console.log('  V - Cycle vocabulary words');
            console.log('  S - Toggle statistics panel');
            console.log('  H or ? - Show/hide help');
            console.log('  Click on a language area to view details');

        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showError('Failed to initialize application');
        }
    }

    async generateNewWorld() {
        this.showLoading('Generating new world...');
        this.pauseSimulation();

        try {
            console.log('Starting world generation...');
            this.updateProgress(10);
            await this.sleep(50);

            // Generate world using current settings
            const width = this.getSettingValue('grid-width', CONFIG.GRID_W);
            const height = this.getSettingValue('grid-height', CONFIG.GRID_H);
            const landProb = this.getSettingValue('land-prob', CONFIG.LAND_PROB_INIT);
            const islandBias = this.getSettingValue('island-bias', CONFIG.ISLAND_BIAS);
            const smoothSteps = this.getSettingValue('smooth-steps', CONFIG.SMOOTH_STEPS);

            console.log(`World params: ${width}x${height}, landProb: ${landProb}, islandBias: ${islandBias}, smoothSteps: ${smoothSteps}`);
            this.updateProgress(30);
            await this.sleep(50);

            console.log('Generating world mask...');
            const worldMask = WorldModule.generateProceduralWorld(width, height, landProb, islandBias, smoothSteps);
            console.log('World mask generated');
            this.updateProgress(50);
            await this.sleep(50);

            console.log('Creating world object...');
            const world = new WorldModule.World(worldMask);
            console.log(`World created with ${world.communities.length} communities`);
            this.updateProgress(70);
            await this.sleep(50);

            console.log('Creating simulation...');
            this.simulation = new SimulationModule.LanguageEvolutionSimulation(world);
            console.log(`Simulation created with ${this.simulation.languages.size} languages`);
            this.updateProgress(85);
            await this.sleep(50);

            console.log('Creating renderer...');
            this.renderer = new VisualizationModule.LanguageRenderer(this.canvas, world, this.simulation);

            // Ensure canvas is properly sized
            this.handleResize();
            console.log('Canvas resized');
            this.updateProgress(95);
            await this.sleep(50);

            console.log('Drawing initial state...');
            this.renderer.draw();
            console.log('Initial draw complete');
            this.updateProgress(100);
            await this.sleep(50);

            // Update UI
            console.log('Updating UI...');
            this.updateMapModeUI();
            this.updateUI();

            // Hide loading screen
            console.log('Hiding loading screen...');
            this.hideLoading();
            console.log('World generation complete!');

        } catch (error) {
            console.error('Failed to generate world:', error);
            this.showError('Failed to generate world');
            this.hideLoading();
        }
    }

    async resetSimulation() {
        if (!this.simulation) return;

        this.showLoading('Resetting simulation...');
        this.pauseSimulation();

        try {
            await this.sleep(100);

            // Create new simulation with same world
            this.simulation = new SimulationModule.LanguageEvolutionSimulation(this.simulation.world);
            this.renderer.simulation = this.simulation;

            this.renderer.draw();
            this.updateUI();

        } catch (error) {
            console.error('Failed to reset simulation:', error);
            this.showError('Failed to reset simulation');
        } finally {
            this.hideLoading();
        }
    }

    toggleSimulation() {
        if (this.isRunning) {
            this.pauseSimulation();
        } else {
            this.startSimulation();
        }
    }

    startSimulation() {
        if (!this.simulation || this.isRunning) return;

        this.isRunning = true;
        this.playPauseBtn.textContent = '⏸️ Pause';
        this.playPauseBtn.classList.remove('paused');
        this.playPauseBtn.classList.add('playing');

        this.lastFrameTime = performance.now();
        this.animationLoop();

        console.log('Simulation started');
    }

    pauseSimulation() {
        this.isRunning = false;
        this.playPauseBtn.textContent = '▶️ Play';
        this.playPauseBtn.classList.remove('playing');
        this.playPauseBtn.classList.add('paused');

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        console.log('Simulation paused');
    }

    animationLoop(currentTime = performance.now()) {
        if (!this.isRunning) return;

        const deltaTime = currentTime - this.lastFrameTime;
        const targetFrameTime = 1000 / this.simulationSpeed;

        if (deltaTime >= targetFrameTime) {
            // Update simulation
            if (this.simulation) {
                this.simulation.step();
                this.renderer.draw();
                this.updateUI();
            }

            this.lastFrameTime = currentTime;
        }

        this.animationId = requestAnimationFrame((time) => this.animationLoop(time));
    }

    setMapMode(mode) {
        if (this.renderer && Object.values(VisualizationModule.MapMode).includes(mode)) {
            this.renderer.mapMode = mode;
            this.updateMapModeUI();
            this.renderer.draw();
        }
    }

    setVocabularyWord(word) {
        if (this.renderer) {
            this.renderer.vocabularyWord = word;
            if (this.renderer.mapMode === VisualizationModule.MapMode.VOCABULARY_ITEM) {
                this.renderer.draw();
            }
        }
    }

    updateMapModeUI() {
        if (!this.renderer) return;

        const isVocabMode = this.renderer.mapMode === VisualizationModule.MapMode.VOCABULARY_ITEM;
        this.vocabularySelect.style.display = isVocabMode ? 'inline-block' : 'none';
        this.vocabularyLabel.style.display = isVocabMode ? 'inline-block' : 'none';
    }

    updateUI() {
        if (!this.simulation) return;

        const stats = this.simulation.getDetailedStats();

        // Update header statistics
        this.tickCounter.textContent = `Tick: ${stats.tick}`;
        this.languageCount.textContent = `Languages: ${stats.languages}`;
        this.communityCount.textContent = `Communities: ${stats.speakingCommunities}/${stats.totalCommunities}`;

        // Update statistics panel if visible
        this.updateStatsPanel(stats);
    }

    updateStatsPanel(stats) {
        const leaderboard = document.getElementById('language-leaderboard');
        const sampleWords = document.getElementById('sample-words-list');

        if (leaderboard && stats.topLanguages) {
            leaderboard.innerHTML = '';
            stats.topLanguages.slice(0, 8).forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'leaderboard-item';
                div.innerHTML = `
                    <span>${index + 1}. ${item.language.name}</span>
                    <span>${item.speakers} speakers</span>
                `;
                leaderboard.appendChild(div);
            });
        }

        if (sampleWords && this.simulation.languages.size > 0) {
            const languages = Array.from(this.simulation.languages.values());
            const sampleLang = languages[Math.floor(Math.random() * languages.length)];
            const sampleWordEntries = Array.from(sampleLang.lexicon.entries()).slice(0, 5);

            sampleWords.innerHTML = '';
            sampleWordEntries.forEach(([meaning, word]) => {
                const div = document.createElement('div');
                div.className = 'sample-word';
                div.textContent = `${word.stringForm} = "${meaning}"`;
                sampleWords.appendChild(div);
            });
        }
    }

    showLanguageDetails(language) {
        const detail = new VisualizationModule.LanguageDetailDisplay(language);

        // Update language panel content
        this.updateLanguagePanel(detail);
        this.showLanguagePanel();
    }

    updateLanguagePanel(detail) {
        const overviewData = detail.getOverviewData();
        const phonologyData = detail.getPhonologyData();

        // Update overview section
        document.getElementById('language-title').textContent = `Language: ${overviewData.name}`;
        document.getElementById('lang-id').textContent = overviewData.id;
        document.getElementById('lang-generation').textContent = overviewData.generation;
        document.getElementById('lang-prestige').textContent = overviewData.prestige;
        document.getElementById('lang-conservatism').textContent = overviewData.conservatism;
        document.getElementById('lang-phonemes').textContent = overviewData.phonemes;
        document.getElementById('lang-vocabulary').textContent = overviewData.vocabulary;

        // Update phonology section
        document.getElementById('vowel-count').textContent = phonologyData.vowels.length;
        document.getElementById('vowel-list').textContent = phonologyData.vowels.join(' ');
        document.getElementById('consonant-count').textContent = phonologyData.consonants.length;
        document.getElementById('consonant-list').textContent = phonologyData.consonants.join(' ');
        document.getElementById('constraints-summary').textContent = phonologyData.constraintsSummary;

        // Update vocabulary section
        this.updateVocabularyDisplay(detail);

        // Set up vocabulary search
        const vocabSearch = document.getElementById('vocab-search');
        vocabSearch.value = '';
        vocabSearch.oninput = (e) => {
            this.updateVocabularyDisplay(detail, e.target.value);
        };
    }

    updateVocabularyDisplay(detail, searchTerm = '') {
        const vocabularyList = document.getElementById('vocabulary-list');
        const vocabData = detail.searchVocabulary(searchTerm);

        vocabularyList.innerHTML = '';

        if (vocabData.length === 0) {
            const div = document.createElement('div');
            div.className = 'vocab-item';
            div.textContent = 'No matching vocabulary found.';
            vocabularyList.appendChild(div);
            return;
        }

        vocabData.slice(0, 100).forEach(item => { // Limit to 100 items for performance
            const div = document.createElement('div');
            div.className = 'vocab-item';

            let originText = '';
            if (item.borrowed) {
                originText = ` (borrowed from lang ${item.borrowed})`;
            } else if (item.generation > 0) {
                originText = ` (gen ${item.generation})`;
            }

            div.innerHTML = `
                <div>
                    <span class="vocab-meaning">${item.meaning}</span>
                    <span class="vocab-word">${item.form}</span>
                </div>
                ${originText ? `<div class="vocab-origin">${originText}</div>` : ''}
            `;
            vocabularyList.appendChild(div);
        });

        if (vocabData.length > 100) {
            const div = document.createElement('div');
            div.className = 'vocab-item';
            div.style.fontStyle = 'italic';
            div.textContent = `... and ${vocabData.length - 100} more words`;
            vocabularyList.appendChild(div);
        }
    }

    showLanguagePanel() {
        this.languagePanel.classList.remove('hidden');
    }

    hideLanguagePanel() {
        this.languagePanel.classList.add('hidden');
    }

    showSettings() {
        this.loadCurrentSettings();
        this.settingsModal.classList.remove('hidden');
    }

    hideSettings() {
        this.settingsModal.classList.add('hidden');
    }

    showHelp() {
        this.helpOverlay.classList.remove('hidden');
    }

    hideHelp() {
        this.helpOverlay.classList.add('hidden');
    }

    toggleStatsPanel() {
        this.statsPanel.classList.toggle('hidden');
    }

    loadCurrentSettings() {
        // Load current settings into the form
        document.getElementById('grid-width').value = CONFIG.GRID_W;
        document.getElementById('grid-height').value = CONFIG.GRID_H;
        document.getElementById('land-prob').value = CONFIG.LAND_PROB_INIT;
        document.getElementById('island-bias').value = CONFIG.ISLAND_BIAS;
        document.getElementById('smooth-steps').value = CONFIG.SMOOTH_STEPS;

        document.getElementById('p-mutate').value = CONFIG.P_MUTATE;
        document.getElementById('p-spread').value = CONFIG.P_SPREAD;
        document.getElementById('p-borrow').value = CONFIG.P_BORROW;
        document.getElementById('p-split').value = CONFIG.P_LANGUAGE_SPLIT;
        document.getElementById('p-long-distance').value = CONFIG.P_LONG_DISTANCE_SPREAD;

        document.getElementById('draw-boundaries').checked = CONFIG.DRAW_BOUNDARIES;
        document.getElementById('print-stats').checked = CONFIG.PRINT_STATS;
        document.getElementById('simulation-speed').value = this.simulationSpeed;

        // Trigger input events to update displays
        document.querySelectorAll('input[type="range"]').forEach(input => {
            input.dispatchEvent(new Event('input'));
        });
    }

    applySettings() {
        try {
            // Update CONFIG values
            CONFIG.GRID_W = parseInt(document.getElementById('grid-width').value);
            CONFIG.GRID_H = parseInt(document.getElementById('grid-height').value);
            CONFIG.LAND_PROB_INIT = parseFloat(document.getElementById('land-prob').value);
            CONFIG.ISLAND_BIAS = parseFloat(document.getElementById('island-bias').value);
            CONFIG.SMOOTH_STEPS = parseInt(document.getElementById('smooth-steps').value);

            CONFIG.P_MUTATE = parseFloat(document.getElementById('p-mutate').value);
            CONFIG.P_SPREAD = parseFloat(document.getElementById('p-spread').value);
            CONFIG.P_BORROW = parseFloat(document.getElementById('p-borrow').value);
            CONFIG.P_LANGUAGE_SPLIT = parseFloat(document.getElementById('p-split').value);
            CONFIG.P_LONG_DISTANCE_SPREAD = parseFloat(document.getElementById('p-long-distance').value);

            CONFIG.DRAW_BOUNDARIES = document.getElementById('draw-boundaries').checked;
            CONFIG.PRINT_STATS = document.getElementById('print-stats').checked;
            this.simulationSpeed = parseInt(document.getElementById('simulation-speed').value);

            this.hideSettings();

            // Redraw if renderer exists
            if (this.renderer) {
                this.renderer.draw();
            }

            console.log('Settings applied');

        } catch (error) {
            console.error('Failed to apply settings:', error);
            this.showError('Failed to apply settings');
        }
    }

    resetSettings() {
        CONFIG.reset();
        this.simulationSpeed = CONFIG.DEFAULT_FPS;
        this.loadCurrentSettings();
        console.log('Settings reset to defaults');
    }

    getSettingValue(id, defaultValue) {
        const element = document.getElementById(id);
        if (element) {
            return element.type === 'checkbox' ? element.checked :
                   element.type === 'number' ? parseInt(element.value) :
                   parseFloat(element.value);
        }
        return defaultValue;
    }

    handleKeyboard(event) {
        // Don't handle keys when typing in inputs
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (event.code) {
            case 'Space':
                event.preventDefault();
                this.toggleSimulation();
                break;
            case 'KeyR':
                event.preventDefault();
                this.resetSimulation();
                break;
            case 'KeyN':
                event.preventDefault();
                this.generateNewWorld();
                break;
            case 'KeyM':
                event.preventDefault();
                if (this.renderer) {
                    this.renderer.cycleMapMode();
                    this.mapModeSelect.value = this.renderer.mapMode;
                    this.updateMapModeUI();
                    this.renderer.draw();
                }
                break;
            case 'KeyV':
                event.preventDefault();
                if (this.renderer) {
                    this.renderer.cycleVocabularyWord();
                    this.vocabularySelect.value = this.renderer.vocabularyWord;
                    if (this.renderer.mapMode === VisualizationModule.MapMode.VOCABULARY_ITEM) {
                        this.renderer.draw();
                    }
                }
                break;
            case 'KeyS':
                event.preventDefault();
                this.toggleStatsPanel();
                break;
            case 'KeyH':
            case 'Slash': // '?' key
                if (event.shiftKey && event.code === 'Slash') {
                    event.preventDefault();
                    this.showHelp();
                } else if (event.code === 'KeyH') {
                    event.preventDefault();
                    this.showHelp();
                }
                break;
            case 'Escape':
                this.hideSettings();
                this.hideLanguagePanel();
                this.hideHelp();
                break;
        }
    }

    handleResize() {
        if (this.renderer) {
            const container = this.canvas.parentElement;
            const rect = container.getBoundingClientRect();
            this.renderer.resize(rect.width, rect.height);
            this.renderer.draw();
        }
    }

    showLoading(text = 'Loading...') {
        this.loadingText.textContent = text;
        this.loadingScreen.classList.remove('hidden');
        this.updateProgress(0);
    }

    hideLoading() {
        this.loadingScreen.classList.add('hidden');
    }

    updateProgress(percent) {
        this.loadingBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }

    showError(message) {
        console.error(message);
        // Could implement a toast notification system here
        alert(message);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LanguageEvolutionApp();
});

// Export for global access
window.LanguageEvolutionApp = LanguageEvolutionApp;