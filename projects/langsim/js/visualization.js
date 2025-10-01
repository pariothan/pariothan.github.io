/**
 * Visualization and rendering for the language evolution simulation
 * Ported from the original Python implementation with Canvas API
 */

// Map modes enumeration
const MapMode = {
    LANGUAGE_NAME: "language_name",
    VOCABULARY_ITEM: "vocabulary_item",
    PHONOLOGICAL_RULES: "phonological_rules",
    LANGUAGE_FAMILY: "language_family",
    PHONEME_COUNT: "phoneme_count",
    SPEAKER_COUNT: "speaker_count",
    PRESTIGE: "prestige"
};

/**
 * Hash-based color generation for consistent colors
 */
function hashToColor(key) {
    if (!key) return [200, 200, 200];

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to HSV with fixed saturation and value
    const hue = Math.abs(hash) % 360;
    const saturation = 0.7;
    const value = 0.85;

    return hsvToRgb(hue / 360, saturation, value);
}

/**
 * Language dialect color with base name and variation
 */
function languageDialectColor(baseName, languageId) {
    if (!baseName) return [200, 200, 200];

    // Get base hue from the clean language name
    let baseHash = 0;
    for (let i = 0; i < baseName.length; i++) {
        baseHash = baseName.charCodeAt(i) + ((baseHash << 5) - baseHash);
    }
    const baseHue = (Math.abs(baseHash) % 360) / 360;

    // Generate more noticeable dialect variation
    const dialectHash = Math.abs(languageId) % 100;

    // Add slight hue variation (±15 degrees) for more distinction
    const hueVariation = ((dialectHash % 30) - 15) / 360; // ±15 degrees
    const finalHue = (baseHue + hueVariation + 1) % 1; // Ensure 0-1 range

    // Vary saturation and value more noticeably
    const saturation = 0.4 + (dialectHash % 50) / 100; // 0.4 to 0.9
    const value = 0.5 + (dialectHash % 45) / 100; // 0.5 to 0.95

    return hsvToRgb(finalHue, saturation, value);
}

/**
 * Convert HSV to RGB
 */
function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m = v - c;

    let r, g, b;
    if (h < 1/6) { r = c; g = x; b = 0; }
    else if (h < 2/6) { r = x; g = c; b = 0; }
    else if (h < 3/6) { r = 0; g = c; b = x; }
    else if (h < 4/6) { r = 0; g = x; b = c; }
    else if (h < 5/6) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255)
    ];
}

/**
 * Map numeric value to color gradient
 */
function gradientColor(value, minVal, maxVal) {
    if (maxVal === minVal) return [100, 150, 200];

    const normalized = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));

    // Blue to red gradient
    const r = Math.round(normalized * 255);
    const g = Math.round((1 - normalized) * 100);
    const b = Math.round((1 - normalized) * 255);

    return [r, g, b];
}

/**
 * Convert word to RGB color based on phonological features
 */
function wordToColor(wordKey) {
    if (!wordKey) return [200, 200, 200];

    const segments = wordKey.split('');
    let r = 0, g = 0, b = 0, n = 0;

    for (const segment of segments) {
        if (PhonologyModule.PHONEMES[segment]) {
            const vec = PhonologyModule.PHONEMES[segment];
            r += dotProduct(vec, PhonologyModule.RGB_PROJ[0]);
            g += dotProduct(vec, PhonologyModule.RGB_PROJ[1]);
            b += dotProduct(vec, PhonologyModule.RGB_PROJ[2]);
            n++;
        }
    }

    if (n === 0) return [200, 200, 200];

    r /= n; g /= n; b /= n;

    // Squash function
    const squash = x => {
        x = Math.tanh(0.6 * x);
        x = 0.5 + 0.47 * x;
        return Math.max(0, Math.min(255, Math.round(x * 255)));
    };

    return [squash(r), squash(g), squash(b)];
}

/**
 * Calculate dot product
 */
function dotProduct(a, b) {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

/**
 * Convert RGB to hex string
 */
function rgbToHex(rgb) {
    return `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Choose text color based on background
 */
function textColorForBg(rgb) {
    const [r, g, b] = rgb;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 135 ? "#000000" : "#ffffff";
}

/**
 * Language Renderer class for canvas-based visualization
 */
class LanguageRenderer {
    constructor(canvas, world, simulation) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.world = world;
        this.simulation = simulation;
        this.labelPositions = new Map();

        // Display metrics
        this.pixelRatio = window.devicePixelRatio || 1;
        this.displayWidth = canvas.clientWidth || canvas.width;
        this.displayHeight = canvas.clientHeight || canvas.height;

        // Map mode state
        this.currentMapMode = MapMode.LANGUAGE_NAME;
        this.currentVocabularyWord = "water";

        // Calculate cell size (use display size, not actual canvas size)
        const displayWidth = this.displayWidth;
        const displayHeight = this.displayHeight;
        this.cellWidth = Math.max(1, displayWidth / Math.max(1, world.width));
        this.cellHeight = Math.max(1, displayHeight / Math.max(1, world.height));

        // Font size based on cell size - increased multiplier for better readability
        this.fontSize = Math.max(CONFIG.MIN_FONT_PX,
            Math.min(CONFIG.MAX_FONT_PX, Math.round(Math.min(this.cellWidth, this.cellHeight) * 0.7)));

        // Click handler
        this.canvas.addEventListener('click', (e) => this._onCanvasClick(e));

        // Resize handler
        this.canvas.addEventListener('resize', () => this._onResize());
    }

    _onResize() {
        const displayWidth = this.displayWidth || this.canvas.clientWidth || (this.canvas.width / this.pixelRatio);
        const displayHeight = this.displayHeight || this.canvas.clientHeight || (this.canvas.height / this.pixelRatio);
        this.cellWidth = Math.max(1, displayWidth / Math.max(1, this.world.width));
        this.cellHeight = Math.max(1, displayHeight / Math.max(1, this.world.height));
        this.fontSize = Math.max(CONFIG.MIN_FONT_PX,
            Math.min(CONFIG.MAX_FONT_PX, Math.round(Math.min(this.cellWidth, this.cellHeight) * 0.7)));
    }

    _onCanvasClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Calculate which cell was clicked
        const gridX = Math.floor(x / this.cellWidth);
        const gridY = Math.floor(y / this.cellHeight);

        // Check bounds
        if (gridX < 0 || gridX >= this.world.width || gridY < 0 || gridY >= this.world.height) {
            return;
        }

        // Get the community at that position
        const community = this.world.getCommunityAt(gridX, gridY);
        if (!community || community.languageId < 0) {
            return;
        }

        // Get the language
        const language = this.simulation.getLanguageById(community.languageId);
        if (!language) {
            return;
        }

        // Trigger language detail display
        this._showLanguageDetails(language);
    }

    _showLanguageDetails(language) {
        // Dispatch custom event for language selection
        const event = new CustomEvent('languageSelected', { detail: language });
        this.canvas.dispatchEvent(event);
    }

    cycleMapMode() {
        const modes = Object.values(MapMode);
        const currentIndex = modes.indexOf(this.currentMapMode);
        this.currentMapMode = modes[(currentIndex + 1) % modes.length];

        const modeDescriptions = {
            [MapMode.LANGUAGE_NAME]: "Language Names",
            [MapMode.VOCABULARY_ITEM]: `Vocabulary: ${this.currentVocabularyWord}`,
            [MapMode.PHONOLOGICAL_RULES]: "Phonological Rules",
            [MapMode.LANGUAGE_FAMILY]: "Language Families",
            [MapMode.PHONEME_COUNT]: "Phoneme Counts",
            [MapMode.SPEAKER_COUNT]: "Speaker Counts",
            [MapMode.PRESTIGE]: "Language Prestige"
        };

        console.log(`Map Mode: ${modeDescriptions[this.currentMapMode]}`);
        return this.currentMapMode;
    }

    cycleVocabularyWord() {
        const commonWords = ["water", "fire", "tree", "stone", "fish", "bird", "sun", "moon", "hand", "head"];
        const currentIndex = commonWords.indexOf(this.currentVocabularyWord);
        this.currentVocabularyWord = commonWords[(currentIndex + 1) % commonWords.length];

        console.log(`Vocabulary word: ${this.currentVocabularyWord}`);
        if (this.currentMapMode === MapMode.VOCABULARY_ITEM) {
            console.log(`Map Mode: Vocabulary: ${this.currentVocabularyWord}`);
        }
        return this.currentVocabularyWord;
    }

    _shouldShowText(x, y, languageId) {
        const W = this.world.width;
        const H = this.world.height;

        // Get the base name (without apostrophes) for the current language
        const currentLanguage = this.simulation.getLanguageById(languageId);
        if (!currentLanguage) return true;

        const currentBaseName = currentLanguage.name.replace(/'/g, '');

        // Count neighbors with same base name (4-connected only)
        let neighborsSame = 0;
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
                const neighbor = this.world.getCommunityAt(nx, ny);
                if (neighbor && neighbor.languageId >= 0) {
                    const neighborLanguage = this.simulation.getLanguageById(neighbor.languageId);
                    if (neighborLanguage) {
                        const neighborBaseName = neighborLanguage.name.replace(/'/g, '');
                        if (neighborBaseName === currentBaseName) {
                            neighborsSame++;
                        }
                    }
                }
            }
        }

        // Always show text for completely isolated cells
        if (neighborsSame === 0) return true;

        // Show text for small clusters (1-2 neighbors)
        if (neighborsSame <= 1) return true;

        // For larger areas, sparse grid pattern to avoid crowding
        const textSpacing = 8;
        const offsetX = (y % 2) * Math.floor(textSpacing / 2);
        if ((x + offsetX) % textSpacing === 3 && y % textSpacing === 3) {
            return true;
        }

        // Show text at language borders
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
                const neighbor = this.world.getCommunityAt(nx, ny);
                if (!neighbor) {
                    // Border with empty space
                    return true;
                } else if (neighbor.languageId >= 0) {
                    const neighborLanguage = this.simulation.getLanguageById(neighbor.languageId);
                    if (neighborLanguage) {
                        const neighborBaseName = neighborLanguage.name.replace(/'/g, '');
                        if (neighborBaseName !== currentBaseName) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    _getMapModeDisplayInfo(language, communityCount) {
        switch (this.currentMapMode) {
            case MapMode.LANGUAGE_NAME:
                return this._getLanguageNameInfo(language);
            case MapMode.VOCABULARY_ITEM:
                return this._getVocabularyItemInfo(language);
            case MapMode.PHONOLOGICAL_RULES:
                return this._getPhonologicalRulesInfo(language);
            case MapMode.LANGUAGE_FAMILY:
                return this._getLanguageFamilyInfo(language);
            case MapMode.PHONEME_COUNT:
                return this._getPhonemeCountInfo(language);
            case MapMode.SPEAKER_COUNT:
                return this._getSpeakerCountInfo(language, communityCount);
            case MapMode.PRESTIGE:
                return this._getPrestigeInfo(language);
            default:
                return this._getLanguageNameInfo(language);
        }
    }

    _getLanguageNameInfo(language) {
        const languageName = language.name || `Lang${language.id}`;
        const cleanName = languageName.replace(/'/g, '');
        const colorKey = `dialect:${cleanName}:${language.id}`;
        const displayText = cleanName.length <= 12 ? cleanName : cleanName.substring(0, 9) + "...";
        return [colorKey, displayText];
    }

    _getVocabularyItemInfo(language) {
        if (language.lexicon && language.lexicon.has(this.currentVocabularyWord)) {
            const wordObj = language.lexicon.get(this.currentVocabularyWord);
            const wordForm = wordObj.stringForm;
            const displayText = wordForm.length <= 12 ? wordForm : wordForm.substring(0, 9) + "...";
            return [wordForm, displayText];
        }
        return ["", "---"];
    }

    _getPhonologicalRulesInfo(language) {
        // Summarize phonotactic constraints
        const constraints = language.phonotacticConstraints;
        if (constraints && constraints.syllableTypes) {
            // Get dominant syllable type
            const syllableEntries = Object.entries(constraints.syllableTypes);
            if (syllableEntries.length > 0) {
                const dominantType = syllableEntries.reduce((a, b) => a[1] > b[1] ? a : b);
                const ruleSummary = dominantType[0].substring(0, 4);
                return [ruleSummary, ruleSummary];
            }
        }

        // Fallback: use phoneme count as proxy for rule complexity
        const phonemeCount = language.getPhonemeCount();
        let ruleSummary;
        if (phonemeCount < 20) {
            ruleSummary = "SIMP";
        } else if (phonemeCount < 40) {
            ruleSummary = "MED";
        } else {
            ruleSummary = "COMP";
        }
        return [ruleSummary, ruleSummary];
    }

    _getLanguageFamilyInfo(language) {
        // Find root ancestor by walking parent chain
        let rootAncestor = language;
        const visited = new Set([language.id]);

        while (rootAncestor.parentId !== null && !visited.has(rootAncestor.parentId)) {
            const parent = this.simulation.getLanguageById(rootAncestor.parentId);
            if (parent) {
                visited.add(rootAncestor.parentId);
                rootAncestor = parent;
            } else {
                break;
            }
        }

        const familyId = `family_${rootAncestor.id}`;
        return [familyId, `F${rootAncestor.id}`];
    }

    _getPhonemeCountInfo(language) {
        const count = language.getPhonemeCount();
        return [count.toString(), count.toString()];
    }

    _getSpeakerCountInfo(language, communityCount) {
        return [communityCount.toString(), communityCount.toString()];
    }

    _getPrestigeInfo(language) {
        const prestigeInt = Math.round(language.prestige * 1000);
        const prestigeDisplay = `${Math.round(language.prestige * 100)}%`;
        return [prestigeInt.toString(), prestigeDisplay];
    }

    draw() {
        const currentDisplayWidth = this.canvas.clientWidth || this.displayWidth || (this.canvas.width / this.pixelRatio);
        const currentDisplayHeight = this.canvas.clientHeight || this.displayHeight || (this.canvas.height / this.pixelRatio);
        if (currentDisplayWidth) {
            this.displayWidth = currentDisplayWidth;
        }
        if (currentDisplayHeight) {
            this.displayHeight = currentDisplayHeight;
        }

        const W = this.world.width;
        const H = this.world.height;
        const cw = this.cellWidth;
        const ch = this.cellHeight;

        // Prepare high-DPI canvas
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // First pass: count communities per language for speaker count mapmode
        const languageCommunityCounts = new Map();
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const community = this.world.getCommunityAt(x, y);
                if (community && community.languageId >= 0) {
                    const count = languageCommunityCounts.get(community.languageId) || 0;
                    languageCommunityCounts.set(community.languageId, count + 1);
                }
            }
        }

        // Pre-compute numeric values for gradient modes
        const languageNumericValues = new Map();
        let gradientMin = 0;
        let gradientMax = 1;
        if ([MapMode.PHONEME_COUNT, MapMode.SPEAKER_COUNT, MapMode.PRESTIGE].includes(this.currentMapMode)) {
            for (const [langId, count] of languageCommunityCounts) {
                const language = this.simulation.getLanguageById(langId);
                if (language) {
                    let value;
                    if (this.currentMapMode === MapMode.PHONEME_COUNT) {
                        value = language.getPhonemeCount();
                    } else if (this.currentMapMode === MapMode.SPEAKER_COUNT) {
                        value = count;
                    } else {
                        value = Math.round(language.prestige * 1000);
                    }
                    languageNumericValues.set(langId, value);
                }
            }

            if (languageNumericValues.size > 0) {
                const allValues = Array.from(languageNumericValues.values());
                gradientMin = Math.min(...allValues);
                gradientMax = Math.max(...allValues);
            }
        }

        // Cache mapmode display info per language
        const languageDisplayInfo = new Map();
        const labelData = new Map();

        // Draw communities and gather label anchors
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const community = this.world.getCommunityAt(x, y);
                const x0 = x * cw;
                const y0 = y * ch;

                if (!community) {
                    const waterColor = this._getWaterColor(x, y);
                    this.ctx.fillStyle = rgbToHex(waterColor);
                    this.ctx.fillRect(x0, y0, cw, ch);
                    continue;
                }

                let rgb = [30, 30, 30];
                let displayText = "";

                if (community.languageId >= 0) {
                    const languageId = community.languageId;
                    const language = this.simulation.getLanguageById(languageId);

                    if (language) {
                        if (!languageDisplayInfo.has(languageId)) {
                            const communityCount = languageCommunityCounts.get(languageId) || 0;
                            const info = this._getMapModeDisplayInfo(language, communityCount);
                            languageDisplayInfo.set(languageId, info);
                        }

                        const [colorKey, cachedDisplayText] = languageDisplayInfo.get(languageId);
                        displayText = cachedDisplayText;

                        if (this.currentMapMode === MapMode.VOCABULARY_ITEM) {
                            rgb = wordToColor(colorKey);
                        } else if ([MapMode.PHONEME_COUNT, MapMode.SPEAKER_COUNT, MapMode.PRESTIGE].includes(this.currentMapMode)) {
                            const value = languageNumericValues.get(languageId) || 0;
                            rgb = gradientColor(value, gradientMin, gradientMax);
                        } else if (colorKey && colorKey.startsWith("dialect:")) {
                            const parts = colorKey.split(":");
                            if (parts.length >= 3) {
                                const baseName = parts[1];
                                const langId = parseInt(parts[2], 10);
                                rgb = languageDialectColor(baseName, langId);
                            } else {
                                rgb = hashToColor(colorKey);
                            }
                        } else {
                            rgb = hashToColor(colorKey || languageId.toString());
                        }

                        if (displayText) {
                            let labelEntry = labelData.get(languageId);
                            if (!labelEntry) {
                                labelEntry = {
                                    id: languageId,
                                    text: displayText,
                                    sumX: 0,
                                    sumY: 0,
                                    count: 0,
                                    sumR: 0,
                                    sumG: 0,
                                    sumB: 0,
                                    minX: Infinity,
                                    maxX: -Infinity,
                                    minY: Infinity,
                                    maxY: -Infinity
                                };
                                labelData.set(languageId, labelEntry);
                            }

                            const cellCenterX = x0 + cw / 2;
                            const cellCenterY = y0 + ch / 2;

                            labelEntry.sumX += cellCenterX;
                            labelEntry.sumY += cellCenterY;
                            labelEntry.count += 1;
                            labelEntry.sumR += rgb[0];
                            labelEntry.sumG += rgb[1];
                            labelEntry.sumB += rgb[2];
                            labelEntry.minX = Math.min(labelEntry.minX, x0);
                            labelEntry.maxX = Math.max(labelEntry.maxX, x0 + cw);
                            labelEntry.minY = Math.min(labelEntry.minY, y0);
                            labelEntry.maxY = Math.max(labelEntry.maxY, y0 + ch);

                            if (!labelEntry.text) {
                                labelEntry.text = displayText;
                            }
                        }
                    } else {
                        rgb = [100, 100, 100];
                        displayText = "???";
                    }
                }

                rgb = this._lightenLandColor(rgb);

                this.ctx.fillStyle = rgbToHex(rgb);
                this.ctx.fillRect(x0, y0, cw, ch);
            }
        }

        // Draw boundaries between different languages
        if (CONFIG.DRAW_BOUNDARIES) {
            this._drawLanguageBoundaries();
        }

        this._drawLabels(labelData);
    }

    _drawLabels(labelData) {
        if (!labelData || labelData.size === 0) {
            return;
        }

        const rawLabels = Array.from(labelData.values()).filter(entry => entry.text && entry.text.trim().length > 0);
        if (rawLabels.length === 0) {
            return;
        }

        // Keep only the largest region per unique text label to avoid redundant repeats
        const deduped = new Map();
        for (const entry of rawLabels) {
            const key = entry.text.toLowerCase();
            const existing = deduped.get(key);
            if (!existing || entry.count > existing.count) {
                deduped.set(key, entry);
            }
        }

        const labels = Array.from(deduped.values()).filter(entry => entry.count >= 3);
        if (labels.length === 0) {
            return;
        }

        // Larger language areas render first to reserve space
        labels.sort((a, b) => b.count - a.count);

        const placedRects = [];
        const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

        for (const entry of labels) {
            const avgX = entry.sumX / entry.count;
            const avgY = entry.sumY / entry.count;

            const baseFont = this.fontSize || CONFIG.MIN_FONT_PX;
            const scale = 1 + Math.log10(entry.count + 1) * 0.25;
            let fontPx = Math.max(
                CONFIG.MIN_FONT_PX + 2,
                Math.min(Math.round(baseFont * scale), Math.round(CONFIG.MAX_FONT_PX * 1.6))
            );

            const regionWidth = Math.max(12, entry.maxX - entry.minX);
            const regionHeight = Math.max(12, entry.maxY - entry.minY);
            const availableWidth = Math.max(18, regionWidth - 12);
            const availableHeight = Math.max(18, regionHeight - 12);

            this.ctx.font = `600 ${fontPx}px 'Segoe UI', Arial, sans-serif`;

            let paddingX = Math.max(6, fontPx * 0.4);
            let paddingY = Math.max(4, fontPx * 0.3);
            let metrics = this.ctx.measureText(entry.text);
            let textWidth = metrics.width;
            let labelWidth = textWidth + paddingX * 2;
            let labelHeight = fontPx + paddingY * 2;

            const fitScale = Math.min(
                availableWidth / Math.max(labelWidth, 1),
                availableHeight / Math.max(labelHeight, 1)
            );

            if (isFinite(fitScale) && fitScale > 0) {
                const clampedScale = Math.min(Math.max(fitScale, 0.6), 3.0);
                const desiredFont = fontPx * clampedScale;
                const adjustedFont = Math.max(
                    CONFIG.MIN_FONT_PX,
                    Math.min(Math.round(desiredFont), Math.round(CONFIG.MAX_FONT_PX * 2))
                );

                if (Math.abs(adjustedFont - fontPx) >= 1) {
                    fontPx = adjustedFont;
                    this.ctx.font = `600 ${fontPx}px 'Segoe UI', Arial, sans-serif`;
                    paddingX = Math.max(6, fontPx * 0.4);
                    paddingY = Math.max(4, fontPx * 0.3);
                    metrics = this.ctx.measureText(entry.text);
                    textWidth = metrics.width;
                    labelWidth = textWidth + paddingX * 2;
                    labelHeight = fontPx + paddingY * 2;
                }
            }

            if (labelWidth > availableWidth * 1.1 || labelHeight > availableHeight * 1.1) {
                continue;
            }

            const avgRgb = entry.count > 0 ? [
                Math.round(entry.sumR / entry.count),
                Math.round(entry.sumG / entry.count),
                Math.round(entry.sumB / entry.count)
            ] : [200, 200, 200];

            const bgRgb = avgRgb.map(component => Math.round(component * 0.35 + 160));
            const backgroundColor = `rgba(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]}, 0.9)`;
            const textColor = textColorForBg(bgRgb);

            const baseCenterX = (entry.minX + entry.maxX) / 2;
            const baseCenterY = (entry.minY + entry.maxY) / 2;
            const anchorMinX = entry.minX + labelWidth / 2;
            const anchorMaxX = entry.maxX - labelWidth / 2;
            const anchorMinY = entry.minY + labelHeight / 2;
            const anchorMaxY = entry.maxY - labelHeight / 2;

            const cacheKey = `${entry.text.toLowerCase()}-${entry.id}`;
            const previousPlacement = this.labelPositions.get(cacheKey);

            const offsets = [
                [0, 0],
                [0, labelHeight + 8],
                [0, -(labelHeight + 8)],
                [labelWidth + 8, 0],
                [-(labelWidth + 8), 0],
                [labelWidth + 8, labelHeight + 8],
                [-(labelWidth + 8), labelHeight + 8],
                [labelWidth + 8, -(labelHeight + 8)],
                [-(labelWidth + 8), -(labelHeight + 8)]
            ];

            let chosenRect = null;
            const clampToRegion = (value, min, max) => {
                if (!isFinite(min) || !isFinite(max) || min > max) {
                    return value;
                }
                return Math.min(Math.max(value, min), max);
            };

            const clampToScreenX = (value) => Math.min(
                this.displayWidth - labelWidth / 2,
                Math.max(labelWidth / 2, value)
            );

            const clampToScreenY = (value) => Math.min(
                this.displayHeight - labelHeight / 2,
                Math.max(labelHeight / 2, value)
            );

            if (previousPlacement) {
                offsets.unshift([previousPlacement.dx, previousPlacement.dy]);
            }

            let selectedOffset = null;
            for (const [dx, dy] of offsets) {
                const targetCenterX = clampToRegion(baseCenterX + dx, anchorMinX, anchorMaxX);
                const targetCenterY = clampToRegion(baseCenterY + dy, anchorMinY, anchorMaxY);

                const candidateCenterX = clampToScreenX(targetCenterX);
                const candidateCenterY = clampToScreenY(targetCenterY);

                const rect = {
                    x: candidateCenterX - labelWidth / 2,
                    y: candidateCenterY - labelHeight / 2,
                    w: labelWidth,
                    h: labelHeight,
                    cx: candidateCenterX,
                    cy: candidateCenterY
                };

                const paddedRect = {
                    x: rect.x - 6,
                    y: rect.y - 6,
                    w: rect.w + 12,
                    h: rect.h + 12
                };

                if (!placedRects.some(existing => overlaps(paddedRect, existing))) {
                    chosenRect = rect;
                    placedRects.push(paddedRect);
                    selectedOffset = { dx, dy };
                    break;
                }
            }

            if (!chosenRect) {
                const clampedCenterX = Math.min(
                    this.displayWidth - labelWidth / 2,
                    Math.max(labelWidth / 2, avgX)
                );
                const clampedCenterY = Math.min(
                    this.displayHeight - labelHeight / 2,
                    Math.max(labelHeight / 2, avgY)
                );
                chosenRect = {
                    x: clampedCenterX - labelWidth / 2,
                    y: clampedCenterY - labelHeight / 2,
                    w: labelWidth,
                    h: labelHeight,
                    cx: clampedCenterX,
                    cy: clampedCenterY
                };
                selectedOffset = { dx: 0, dy: 0 };
                placedRects.push({
                    x: chosenRect.x - 6,
                    y: chosenRect.y - 6,
                    w: chosenRect.w + 12,
                    h: chosenRect.h + 12
                });
            }

            this.ctx.fillStyle = backgroundColor;
            this.ctx.fillRect(chosenRect.x, chosenRect.y, labelWidth, labelHeight);

            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(chosenRect.x, chosenRect.y, labelWidth, labelHeight);

            this.ctx.fillStyle = textColor;
            this.ctx.fillText(entry.text, chosenRect.cx, chosenRect.cy);

            if (selectedOffset) {
                this.labelPositions.set(cacheKey, {
                    dx: selectedOffset.dx,
                    dy: selectedOffset.dy,
                    labelWidth,
                    labelHeight
                });
            }
        }
    }

    _drawLanguageBoundaries() {
        const W = this.world.width;
        const H = this.world.height;
        const cw = this.cellWidth;
        const ch = this.cellHeight;

        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 2;

        const shouldDrawBoundary = (community1, community2) => {
            if (community1.languageId === community2.languageId) {
                return false;
            }

            // Get languages and compare names without apostrophes
            const lang1 = this.simulation.getLanguageById(community1.languageId);
            const lang2 = this.simulation.getLanguageById(community2.languageId);

            if (lang1 && lang2) {
                const name1 = (lang1.name || `Lang${lang1.id}`).replace(/'/g, '');
                const name2 = (lang2.name || `Lang${lang2.id}`).replace(/'/g, '');
                return name1 !== name2;
            }

            return true;
        };

        this.ctx.beginPath();

        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const community = this.world.getCommunityAt(x, y);
                if (!community || community.languageId < 0) continue;

                const rightNeighbor = this.world.getCommunityAt(x + 1, y);
                if (rightNeighbor && shouldDrawBoundary(community, rightNeighbor)) {
                    const lineX = (x + 1) * cw;
                    this.ctx.moveTo(lineX, y * ch);
                    this.ctx.lineTo(lineX, (y + 1) * ch);
                }

                const bottomNeighbor = this.world.getCommunityAt(x, y + 1);
                if (bottomNeighbor && shouldDrawBoundary(community, bottomNeighbor)) {
                    const lineY = (y + 1) * ch;
                    this.ctx.moveTo(x * cw, lineY);
                    this.ctx.lineTo((x + 1) * cw, lineY);
                }
            }
        }

        this.ctx.stroke();
    }

    _getWaterColor() {
        return [0, 0, 0];
    }

    _lightenLandColor(rgb) {
        const blend = 0.35;
        return rgb.map(component => {
            const lightened = component + (255 - component) * blend;
            return Math.max(0, Math.min(255, Math.round(lightened)));
        });
    }
    // Getter methods for UI integration
    get mapMode() {
        return this.currentMapMode;
    }

    set mapMode(mode) {
        if (Object.values(MapMode).includes(mode)) {
            this.currentMapMode = mode;
        }
    }

    get vocabularyWord() {
        return this.currentVocabularyWord;
    }

    set vocabularyWord(word) {
        this.currentVocabularyWord = word;
    }

    // Resize canvas to fit container - simple approach
    resize(width, height) {
        const dpr = window.devicePixelRatio || 1;
        this.pixelRatio = dpr;
        this.displayWidth = Math.max(1, Math.round(width));
        this.displayHeight = Math.max(1, Math.round(height));

        this.canvas.style.width = `${this.displayWidth}px`;
        this.canvas.style.height = `${this.displayHeight}px`;
        this.canvas.width = Math.round(this.displayWidth * dpr);
        this.canvas.height = Math.round(this.displayHeight * dpr);

        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this._onResize();
    }
}

/**
 * Language Detail Display utilities
 */
class LanguageDetailDisplay {
    constructor(language) {
        this.language = language;
    }

    getOverviewData() {
        return {
            id: this.language.id,
            name: this.language.name,
            generation: this.language.generation,
            prestige: `${(this.language.prestige * 100).toFixed(1)}%`,
            conservatism: `${(this.language.conservatism * 100).toFixed(1)}%`,
            phonemes: this.language.getPhonemeCount(),
            vocabulary: this.language.getVocabularySize(),
            parentId: this.language.parentId
        };
    }

    getPhonologyData() {
        const inventory = Array.from(this.language.phonemeInventory);
        const vowels = inventory.filter(p => PhonologyModule.isSyllabic(p));
        const consonants = inventory.filter(p => !PhonologyModule.isSyllabic(p));

        return {
            vowels: vowels.sort(),
            consonants: consonants.sort(),
            total: inventory.length,
            constraintsSummary: this.language.getConstraintSummary(),
            phonotacticInfo: this.language.getPhonotacticInfo()
        };
    }

    getVocabularyData() {
        const lexicon = Array.from(this.language.lexicon.entries());
        return lexicon.map(([meaning, word]) => ({
            meaning,
            form: word.stringForm,
            origin: word.originLangId,
            borrowed: word.borrowedFrom,
            generation: word.generation
        })).sort((a, b) => a.meaning.localeCompare(b.meaning));
    }

    searchVocabulary(searchTerm) {
        if (!searchTerm.trim()) {
            return this.getVocabularyData();
        }

        const term = searchTerm.toLowerCase();
        return this.getVocabularyData().filter(item =>
            item.meaning.toLowerCase().includes(term) ||
            item.form.toLowerCase().includes(term)
        );
    }
}

// Export visualization utilities
window.VisualizationModule = {
    MapMode,
    LanguageRenderer,
    LanguageDetailDisplay,
    hashToColor,
    languageDialectColor,
    gradientColor,
    wordToColor,
    rgbToHex,
    textColorForBg
};
