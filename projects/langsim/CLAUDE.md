# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
- `python3 -m http.server 8000` - Start local development server from project root
- Navigate to `http://localhost:8000/index.html` for the main application
- Open `test.html` directly in browser or via `open test.html` (macOS) / `xdg-open test.html` (Linux) to run system tests

### Code Formatting
- `npx prettier --check js/*.js` - Check JavaScript formatting
- `npx prettier --write js/*.js` - Auto-fix JavaScript formatting

### Testing
- Always run `test.html` after making changes to verify all modules load correctly
- Tests validate module loading, world generation, language creation, and basic simulation functionality

## Architecture Overview

### Module Structure
The simulator is built as a collection of ES6 modules with clear separation of concerns:

- **config.js**: Central configuration with 200+ parameters for world generation, evolution mechanics, and display
- **phonology.js**: Distinctive feature-based phoneme system with 80+ phonemes and phonotactic constraints
- **vocabulary.js**: Core vocabulary management with Swadesh list and borrowing mechanics
- **world.js**: Procedural world generation using cellular automata for realistic terrain
- **language.js**: Language class containing phonological inventories, lexicons, and evolution rules
- **simulation.js**: Main evolution engine handling spread, mutation, borrowing, and splitting
- **visualization.js**: Canvas-based rendering with 7 different map visualization modes
- **app.js**: Application controller managing UI state, controls, and event handling

### Core Systems

#### Language Evolution
- Phonological evolution through feature-based sound changes
- Lexical borrowing with prestige-based probability weighting
- Geographic spread constrained by terrain and language contiguity
- Size-based splitting when languages grow too large
- Long-distance maritime/trade connections

#### World Generation
- Cellular automata for realistic archipelagos and continents
- Community placement on land tiles
- Geographic constraints on language spread
- Configurable parameters for different terrain types

#### Visualization Modes
1. Language Names - Color-coded dialect variations
2. Vocabulary - Phonologically colored word displays
3. Phonological Rules - Constraint complexity visualization
4. Language Families - Genealogical relationship colors
5. Phoneme Count - Inventory size gradients
6. Speaker Count - Population density mapping
7. Prestige - Language prestige level visualization

## Configuration Management

All simulation parameters are centralized in `CONFIG` class in `config.js`:
- World generation parameters (grid size, land probability, smoothing)
- Evolution probabilities (mutation, spread, borrowing, splitting)
- Display settings (boundaries, fonts, statistics)
- Advanced linguistic parameters (phoneme inventories, constraints)

Settings can be modified via the in-app settings modal or directly in config.js.

## Development Guidelines

### Code Style
- Use 4 spaces for JavaScript indentation (2 spaces for HTML/CSS)
- PascalCase for classes, camelCase for functions, UPPER_SNAKE_CASE for constants
- Keep DOM access out of core model modules for reusability
- Favor small, pure functions for simulation mechanics

### File Organization
- Core simulation logic stays in respective modules (simulation.js, language.js, etc.)
- Rendering logic isolated to visualization.js
- UI coordination handled by app.js
- Test assets and screenshots go in `attached_assets/`

### Testing Approach
- Use `test.html` for integration testing of all modules
- Browser devtools for debugging and console assertions
- Extend test.html with new scenarios when adding features
- Capture behavioral changes with screenshots for documentation

### Configuration Changes
- Add new parameters to CONFIG class in config.js
- Surface important settings in the settings modal UI
- Document new parameters in README.md
- Validate parameter ranges in CONFIG.validate() method