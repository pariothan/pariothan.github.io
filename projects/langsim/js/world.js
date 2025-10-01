/**
 * World generation and geographic systems
 * Handles procedural world generation and community management
 */

// Terrain types that affect settlement and language spread
const TerrainType = {
    LOWLAND: 'lowland',        // Easy settlement, normal spread
    HIGHLAND: 'highland',      // Moderate settlement, slower spread
    MOUNTAIN: 'mountain',      // Rare settlement, very slow spread
    COASTAL: 'coastal',        // High settlement, faster maritime spread
    RIVER: 'river',            // High settlement, fast spread along rivers
    DESERT: 'desert',          // Very rare settlement, slow spread
    FOREST: 'forest',          // Moderate settlement, slower spread
    ISLAND: 'island'           // Variable settlement, maritime dependent
};

/**
 * Community class representing a settlement that can speak a language
 */
class Community {
    constructor(x, y, id = -1, elevation = 0, terrainType = TerrainType.LOWLAND) {
        this.x = x;
        this.y = y;
        this.id = id;
        this.languageId = -1;  // -1 means no language
        this.elevation = elevation;  // 0-1 scale
        this.terrainType = terrainType;

        // Terrain affects base properties
        const terrainModifiers = this._getTerrainModifiers(terrainType, elevation);
        this.prestige = Math.random() * 0.4 + 0.3 + terrainModifiers.prestigeBonus;
        this.population = Math.floor((Math.random() * 100 + 50) * terrainModifiers.populationMultiplier);
        this.lastUpdated = 0;

        // Movement costs for language spread
        this.movementCost = terrainModifiers.movementCost;
        this.isolationFactor = terrainModifiers.isolationFactor;
    }

    _getTerrainModifiers(terrainType, elevation) {
        const modifiers = {
            prestigeBonus: 0,
            populationMultiplier: 1.0,
            movementCost: 1.0,
            isolationFactor: 1.0
        };

        switch (terrainType) {
            case TerrainType.COASTAL:
                modifiers.prestigeBonus = 0.1;
                modifiers.populationMultiplier = 1.5;
                modifiers.movementCost = 0.7;  // Easier maritime spread
                break;
            case TerrainType.RIVER:
                modifiers.prestigeBonus = 0.05;
                modifiers.populationMultiplier = 1.3;
                modifiers.movementCost = 0.8;  // Rivers facilitate movement
                break;
            case TerrainType.MOUNTAIN:
                modifiers.prestigeBonus = -0.05;
                modifiers.populationMultiplier = 0.4;
                modifiers.movementCost = 2.5;  // Very slow spread
                modifiers.isolationFactor = 1.8;
                break;
            case TerrainType.HIGHLAND:
                modifiers.populationMultiplier = 0.7;
                modifiers.movementCost = 1.4;
                modifiers.isolationFactor = 1.2;
                break;
            case TerrainType.DESERT:
                modifiers.prestigeBonus = -0.1;
                modifiers.populationMultiplier = 0.3;
                modifiers.movementCost = 2.0;
                modifiers.isolationFactor = 1.6;
                break;
            case TerrainType.FOREST:
                modifiers.populationMultiplier = 0.8;
                modifiers.movementCost = 1.3;
                modifiers.isolationFactor = 1.1;
                break;
            case TerrainType.ISLAND:
                modifiers.populationMultiplier = 0.9;
                modifiers.movementCost = 1.2;
                modifiers.isolationFactor = 1.3;
                break;
            case TerrainType.LOWLAND:
            default:
                // No modifiers - baseline terrain
                break;
        }

        // Elevation affects movement cost
        modifiers.movementCost *= (1 + elevation * 0.5);

        // Keep values in reasonable ranges
        modifiers.prestigeBonus = Math.max(-0.2, Math.min(0.2, modifiers.prestigeBonus));
        modifiers.populationMultiplier = Math.max(0.1, Math.min(2.0, modifiers.populationMultiplier));

        return modifiers;
    }

    /**
     * Get distance to another community
     */
    distanceTo(other) {
        return Math.abs(this.x - other.x) + Math.abs(this.y - other.y);
    }

    /**
     * Get Euclidean distance to another community
     */
    euclideanDistanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Check if this community is adjacent to another
     */
    isAdjacentTo(other) {
        return this.distanceTo(other) === 1;
    }

    /**
     * Get community info for display
     */
    getInfo() {
        return {
            id: this.id,
            position: [this.x, this.y],
            languageId: this.languageId,
            prestige: this.prestige,
            population: this.population
        };
    }
}

/**
 * World class managing the geographic grid and communities
 */
class World {
    constructor(landMask, elevationMap = null, terrainMap = null) {
        this.width = landMask[0].length;
        this.height = landMask.length;
        this.landMask = landMask;
        this.elevationMap = elevationMap || this._generateElevationMap(landMask);
        this.terrainMap = terrainMap || this._generateTerrainMap(landMask, this.elevationMap);
        this.communities = [];
        this.grid = Array(this.height).fill(null).map(() => Array(this.width).fill(null));

        this._generateCommunities();
        this._shuffledCommunities = [...this.communities];
    }

    _generateElevationMap(landMask) {
        const elevationMap = Array(this.height).fill(null).map(() => Array(this.width).fill(0));

        // Generate elevation using multiple octaves of noise
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (landMask[y][x]) {
                    // Base elevation from position
                    let elevation = 0;

                    // Large-scale features (mountain ranges)
                    elevation += Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.3;

                    // Medium-scale features (hills)
                    elevation += Math.sin(x * 0.3) * Math.cos(y * 0.3) * 0.2;

                    // Small-scale features (local variation)
                    elevation += (Math.random() - 0.5) * 0.3;

                    // Distance from edge affects elevation (coastal areas lower)
                    const distFromEdge = this._getDistanceFromEdge(x, y, landMask);
                    elevation += distFromEdge * 0.4;

                    // Normalize to 0-1 range
                    elevation = Math.max(0, Math.min(1, (elevation + 1) / 2));
                    elevationMap[y][x] = elevation;
                }
            }
        }

        // Smooth elevation map
        return this._smoothElevation(elevationMap, landMask, 2);
    }

    _getDistanceFromEdge(x, y, landMask) {
        let minDist = Math.min(this.width, this.height);

        for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    if (!landMask[ny][nx]) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        minDist = Math.min(minDist, dist);
                    }
                } else {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    minDist = Math.min(minDist, dist);
                }
            }
        }

        return Math.min(1, minDist / 3);
    }

    _smoothElevation(elevationMap, landMask, iterations) {
        let smoothed = elevationMap.map(row => [...row]);

        for (let iter = 0; iter < iterations; iter++) {
            const newMap = smoothed.map(row => [...row]);

            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    if (landMask[y][x]) {
                        let sum = 0;
                        let count = 0;

                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                const nx = x + dx;
                                const ny = y + dy;
                                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && landMask[ny][nx]) {
                                    sum += smoothed[ny][nx];
                                    count++;
                                }
                            }
                        }

                        if (count > 0) {
                            newMap[y][x] = sum / count;
                        }
                    }
                }
            }

            smoothed = newMap;
        }

        return smoothed;
    }

    _generateTerrainMap(landMask, elevationMap) {
        const terrainMap = Array(this.height).fill(null).map(() => Array(this.width).fill(null));

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (landMask[y][x]) {
                    terrainMap[y][x] = this._determineTerrainType(x, y, landMask, elevationMap);
                }
            }
        }

        return terrainMap;
    }

    _determineTerrainType(x, y, landMask, elevationMap) {
        const elevation = elevationMap[y][x];
        const isCoastal = this._isCoastal(x, y, landMask);
        const isRiver = this._isRiver(x, y, landMask, elevationMap);

        // Priority order for terrain assignment
        if (isRiver) return TerrainType.RIVER;
        if (isCoastal) return TerrainType.COASTAL;
        if (elevation > 0.8) return TerrainType.MOUNTAIN;
        if (elevation > 0.6) return TerrainType.HIGHLAND;
        if (elevation < 0.2 && Math.random() < 0.3) return TerrainType.DESERT;
        if (Math.random() < 0.4) return TerrainType.FOREST;

        return TerrainType.LOWLAND;
    }

    _isCoastal(x, y, landMask) {
        // Check if adjacent to water
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height || !landMask[ny][nx]) {
                    return true;
                }
            }
        }
        return false;
    }

    _isRiver(x, y, landMask, elevationMap) {
        // Simple river detection - areas that are lower than most neighbors
        if (!landMask[y][x]) return false;

        const elevation = elevationMap[y][x];
        let lowerThanNeighbors = 0;
        let totalNeighbors = 0;

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && landMask[ny][nx]) {
                    totalNeighbors++;
                    if (elevation < elevationMap[ny][nx] - 0.1) {
                        lowerThanNeighbors++;
                    }
                }
            }
        }

        // Rivers are areas lower than most neighbors, not too high elevation
        return totalNeighbors > 0 && lowerThanNeighbors >= totalNeighbors * 0.6 && elevation < 0.7 && Math.random() < 0.4;
    }

    /**
     * Generate communities on land cells
     */
    _generateCommunities() {
        let communityId = 0;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.landMask[y][x]) {
                    const community = new Community(x, y, communityId++);
                    this.communities.push(community);
                    this.grid[y][x] = community;
                }
            }
        }
    }

    /**
     * Get community at specific coordinates
     */
    getCommunityAt(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return null;
        }
        return this.grid[y][x];
    }

    /**
     * Get neighbors of a community (4-connected)
     */
    getNeighbors(community) {
        const neighbors = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

        for (const [dx, dy] of directions) {
            const nx = community.x + dx;
            const ny = community.y + dy;
            const neighbor = this.getCommunityAt(nx, ny);
            if (neighbor) {
                neighbors.push(neighbor);
            }
        }

        return neighbors;
    }

    /**
     * Get neighbors including diagonals (8-connected)
     */
    getNeighbors8(community) {
        const neighbors = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        for (const [dx, dy] of directions) {
            const nx = community.x + dx;
            const ny = community.y + dy;
            const neighbor = this.getCommunityAt(nx, ny);
            if (neighbor) {
                neighbors.push(neighbor);
            }
        }

        return neighbors;
    }

    /**
     * Get a random community
     */
    getRandomCommunity() {
        if (this.communities.length === 0) return null;
        return this.communities[Math.floor(Math.random() * this.communities.length)];
    }

    /**
     * Get communities speaking a specific language
     */
    getCommunitiesWithLanguage(languageId) {
        return this.communities.filter(c => c.languageId === languageId);
    }

    /**
     * Get distant communities within a range
     */
    getDistantCommunities(sourceCommunity, minDistance, maxDistance) {
        const distant = [];

        for (const community of this.communities) {
            const distance = sourceCommunity.distanceTo(community);
            if (distance >= minDistance && distance <= maxDistance) {
                distant.push(community);
            }
        }

        return distant;
    }

    /**
     * Shuffle communities for random processing order
     */
    shuffleCommunities() {
        for (let i = this._shuffledCommunities.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this._shuffledCommunities[i], this._shuffledCommunities[j]] =
            [this._shuffledCommunities[j], this._shuffledCommunities[i]];
        }
    }

    /**
     * Get shuffled communities for processing
     */
    getShuffledCommunities() {
        return this._shuffledCommunities;
    }

    /**
     * Find connected components of communities speaking the same language
     */
    findConnectedComponents(languageId) {
        const communities = this.getCommunitiesWithLanguage(languageId);
        if (communities.length === 0) return [];

        const visited = new Set();
        const components = [];

        for (const community of communities) {
            if (visited.has(community)) continue;

            // BFS to find connected component
            const component = [];
            const queue = [community];
            visited.add(community);

            while (queue.length > 0) {
                const current = queue.shift();
                component.push(current);

                const neighbors = this.getNeighbors(current);
                for (const neighbor of neighbors) {
                    if (neighbor.languageId === languageId && !visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }

            if (component.length > 0) {
                components.push(component);
            }
        }

        return components;
    }

    /**
     * Calculate language statistics for the world
     */
    calculateLanguageStats() {
        const languageDistribution = {};
        let speakingCommunities = 0;

        for (const community of this.communities) {
            if (community.languageId >= 0) {
                speakingCommunities++;
                languageDistribution[community.languageId] =
                    (languageDistribution[community.languageId] || 0) + 1;
            }
        }

        const languages = Object.keys(languageDistribution).length;
        const largestLanguage = Math.max(...Object.values(languageDistribution), 0);

        return {
            totalCommunities: this.communities.length,
            speakingCommunities,
            languages,
            largestLanguage,
            languageDistribution
        };
    }

    /**
     * Get world statistics
     */
    getStats() {
        const stats = this.calculateLanguageStats();
        return {
            ...stats,
            worldSize: `${this.width}×${this.height}`,
            landCells: this.communities.length,
            landRatio: this.communities.length / (this.width * this.height)
        };
    }

    /**
     * Export world data
     */
    export() {
        return {
            width: this.width,
            height: this.height,
            landMask: this.landMask,
            communities: this.communities.map(c => c.getInfo())
        };
    }

    /**
     * Import world data
     */
    static import(data) {
        const world = new World(data.landMask);

        // Restore community data
        for (let i = 0; i < data.communities.length; i++) {
            const communityData = data.communities[i];
            const community = world.communities[i];
            if (community) {
                community.languageId = communityData.languageId;
                community.prestige = communityData.prestige;
                community.population = communityData.population;
            }
        }

        return world;
    }
}

/**
 * Generate procedural world using enhanced cellular automata with multiple terrain features
 */
function generateProceduralWorld(width, height, landProbInit, islandBias, smoothSteps) {
    // Initialize with random land
    let grid = Array(height).fill(null).map(() =>
        Array(width).fill(null).map(() => Math.random() < landProbInit)
    );

    // Apply multiple center biases for more interesting landmass distribution
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

    // Create 2-4 secondary landmass centers for archipelago effects
    const numCenters = 2 + Math.floor(Math.random() * 3);
    const centers = [{x: centerX, y: centerY, strength: islandBias}];

    for (let i = 0; i < numCenters; i++) {
        const angle = (i / numCenters) * 2 * Math.PI + Math.random() * 0.5;
        const distance = 0.3 + Math.random() * 0.4; // 30-70% of max distance
        const x = centerX + Math.cos(angle) * distance * centerX;
        const y = centerY + Math.sin(angle) * distance * centerY;
        const strength = 0.3 + Math.random() * 0.4; // Weaker than main center

        if (x >= 0 && x < width && y >= 0 && y < height) {
            centers.push({x, y, strength});
        }
    }

    // Apply bias from all centers
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let maxBias = 0;

            for (const center of centers) {
                const dx = x - center.x;
                const dy = y - center.y;
                const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
                const bias = Math.max(0, (1 - dist * 1.2) * center.strength);
                maxBias = Math.max(maxBias, bias);
            }

            if (Math.random() < maxBias) {
                grid[y][x] = true;
            }
        }
    }

    // Add some linear features (mountain ranges, island chains)
    if (Math.random() < 0.7) {
        addLinearFeatures(grid, width, height);
    }

    // Enhanced cellular automata smoothing with varied rules
    for (let step = 0; step < smoothSteps; step++) {
        const newGrid = Array(height).fill(null).map(() => Array(width).fill(false));

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const neighbors = countNeighbors(grid, x, y, width, height);

                // Enhanced rules for more interesting coastlines
                if (step < smoothSteps / 2) {
                    // Early steps: more aggressive smoothing
                    if (neighbors >= 4) {
                        newGrid[y][x] = true;
                    } else if (neighbors <= 2) {
                        newGrid[y][x] = false;
                    } else {
                        newGrid[y][x] = grid[y][x];
                    }
                } else {
                    // Later steps: preserve interesting features
                    if (neighbors >= 5) {
                        newGrid[y][x] = true;
                    } else if (neighbors <= 1) {
                        newGrid[y][x] = false;
                    } else if (neighbors === 4) {
                        newGrid[y][x] = Math.random() < 0.8; // Some randomness
                    } else {
                        newGrid[y][x] = grid[y][x];
                    }
                }
            }
        }

        grid = newGrid;
    }

    // Ensure we have some land
    const landCount = grid.flat().filter(cell => cell).length;
    if (landCount < 10) {
        // Add some guaranteed land in the center
        const centerRegion = Math.min(10, Math.min(width, height) / 4);
        for (let y = centerY - centerRegion; y <= centerY + centerRegion; y++) {
            for (let x = centerX - centerRegion; x <= centerX + centerRegion; x++) {
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    grid[Math.floor(y)][Math.floor(x)] = true;
                }
            }
        }
    }

    return grid;
}

/**
 * Add linear features like island chains and continental shelves
 */
function addLinearFeatures(grid, width, height) {
    const numFeatures = 1 + Math.floor(Math.random() * 3);

    for (let f = 0; f < numFeatures; f++) {
        // Random start point
        const startX = Math.floor(Math.random() * width);
        const startY = Math.floor(Math.random() * height);

        // Random direction and length
        const angle = Math.random() * 2 * Math.PI;
        const length = 10 + Math.floor(Math.random() * Math.min(width, height) * 0.4);
        const thickness = 1 + Math.floor(Math.random() * 3);

        // Draw line with some waviness
        for (let i = 0; i < length; i++) {
            const progress = i / length;
            const wave = Math.sin(progress * Math.PI * 3) * 3; // Wavy line
            const x = Math.round(startX + Math.cos(angle + wave * 0.1) * i);
            const y = Math.round(startY + Math.sin(angle + wave * 0.1) * i);

            // Draw thick line
            for (let dx = -thickness; dx <= thickness; dx++) {
                for (let dy = -thickness; dy <= thickness; dy++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        if (Math.sqrt(dx * dx + dy * dy) <= thickness) {
                            grid[ny][nx] = true;
                        }
                    }
                }
            }
        }
    }
}

/**
 * Count land neighbors for cellular automata
 */
function countNeighbors(grid, x, y, width, height) {
    let count = 0;

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;  // Skip center cell

            const nx = x + dx;
            const ny = y + dy;

            // Treat out-of-bounds as water
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                continue;
            }

            if (grid[ny][nx]) {
                count++;
            }
        }
    }

    return count;
}

/**
 * Generate world with specific characteristics
 */
function generateWorldWithCharacteristics(width, height, options = {}) {
    const {
        landCoverage = 0.3,        // Target land coverage ratio
        islandCount = 'medium',    // 'few', 'medium', 'many'
        connectivity = 'medium',   // 'low', 'medium', 'high'
        complexity = 'medium'      // 'simple', 'medium', 'complex'
    } = options;

    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
        // Adjust parameters based on desired characteristics
        let landProbInit = 0.05;
        let islandBias = 0.6;
        let smoothSteps = 6;

        switch (islandCount) {
            case 'few':
                islandBias = 0.8;
                landProbInit = 0.03;
                break;
            case 'many':
                islandBias = 0.4;
                landProbInit = 0.08;
                break;
        }

        switch (connectivity) {
            case 'low':
                smoothSteps = 3;
                break;
            case 'high':
                smoothSteps = 10;
                break;
        }

        switch (complexity) {
            case 'simple':
                smoothSteps += 3;
                break;
            case 'complex':
                smoothSteps -= 2;
                landProbInit += 0.02;
                break;
        }

        const world = generateProceduralWorld(width, height, landProbInit, islandBias, smoothSteps);
        const landRatio = world.flat().filter(cell => cell).length / (width * height);

        // Check if land coverage is acceptable
        if (Math.abs(landRatio - landCoverage) < 0.1) {
            return world;
        }

        attempts++;
    }

    // Fallback to default generation
    return generateProceduralWorld(width, height, 0.05, 0.6, 6);
}

/**
 * Validate world generation parameters
 */
function validateWorldParams(width, height, landProbInit, islandBias, smoothSteps) {
    const errors = [];

    if (width < 10 || width > 500) {
        errors.push('Width must be between 10 and 500');
    }

    if (height < 10 || height > 500) {
        errors.push('Height must be between 10 and 500');
    }

    if (landProbInit < 0.001 || landProbInit > 0.5) {
        errors.push('Land probability must be between 0.001 and 0.5');
    }

    if (islandBias < 0 || islandBias > 1) {
        errors.push('Island bias must be between 0 and 1');
    }

    if (smoothSteps < 0 || smoothSteps > 50) {
        errors.push('Smooth steps must be between 0 and 50');
    }

    return errors;
}

/**
 * Get world generation presets
 */
function getWorldPresets() {
    return {
        archipelago: {
            name: "Archipelago",
            description: "Many scattered islands",
            width: 100,
            height: 100,
            landProbInit: 0.08,
            islandBias: 0.4,
            smoothSteps: 4
        },
        continent: {
            name: "Continental",
            description: "Large landmasses with some islands",
            width: 100,
            height: 100,
            landProbInit: 0.04,
            islandBias: 0.8,
            smoothSteps: 8
        },
        balanced: {
            name: "Balanced",
            description: "Mix of continents and islands",
            width: 100,
            height: 100,
            landProbInit: 0.05,
            islandBias: 0.6,
            smoothSteps: 6
        },
        fragmented: {
            name: "Fragmented",
            description: "Highly fragmented terrain",
            width: 100,
            height: 100,
            landProbInit: 0.07,
            islandBias: 0.3,
            smoothSteps: 2
        },
        simple: {
            name: "Simple",
            description: "Clean, simple geography",
            width: 80,
            height: 80,
            landProbInit: 0.04,
            islandBias: 0.7,
            smoothSteps: 10
        }
    };
}

// Export world utilities
window.WorldModule = {
    Community,
    World,
    generateProceduralWorld,
    generateWorldWithCharacteristics,
    validateWorldParams,
    getWorldPresets,
    countNeighbors
};