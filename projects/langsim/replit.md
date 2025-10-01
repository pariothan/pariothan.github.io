# Language Evolution Simulator

## Overview

A sophisticated Python application that simulates the evolution and geographic spread of languages over time. The simulator models realistic linguistic phenomena including phonological change, lexical borrowing, language contact, and family formation using principles from historical linguistics. The system generates procedural worlds with geographic features and tracks how languages evolve and spread across communities based on distinctive phonological features and semantic vocabularies.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**September 18, 2025:**
- **COMPLETED**: Comprehensive 6-mode mapmode system allowing users to view linguistic landscapes through different perspectives: language names, vocabulary items, phonological rules, language families, phoneme counts, and speaker counts
- **IMPLEMENTED**: Interactive mapmode controls with M key to cycle viewing modes and V key to cycle vocabulary words, all with proper redraw triggering
- **ENHANCED**: Advanced color mapping systems with hash-based colors for categorical modes, gradient colors for numeric modes, and phoneme-based colors for vocabulary visualization
- **FIXED**: Language family ancestry tracking now traces to root ancestors rather than immediate parents, providing true family groupings across generations
- **OPTIMIZED**: Numeric gradient calculations pre-computed for consistent scaling and improved rendering performance
- **RESOLVED**: All visualization issues including boundary rendering (2px black lines), text placement (8-cell spacing), and phonological space optimization for maximum language distinctiveness
- **IMPLEMENTED**: Complete language contiguity enforcement system using BFS-based connected components analysis to automatically split geographically separated languages
- **ADDED**: Geographic language branching mechanism that creates new languages without phonological drift when territories become non-contiguous
- **ENHANCED**: Contiguity-aware seeding system that prevents non-contiguous languages from forming during initialization
- **OPTIMIZED**: Dirty language tracking system for efficient contiguity checking only on languages that have changed territories

## System Architecture

### Core Simulation Engine
The application uses an object-oriented architecture with separate concerns for world generation, language modeling, and visualization. The main simulation loop (`LanguageEvolutionSimulation`) coordinates all components and manages the temporal evolution of the linguistic landscape.

### World Generation System
Uses cellular automata-based procedural generation to create realistic geographic layouts with islands and land masses. The world is represented as a grid where each cell can contain communities that host languages. The generation algorithm applies radial bias toward the center and multiple smoothing passes to create natural-looking landforms.

### Language Modeling Framework
Languages are modeled using distinctive feature theory from phonology, where each phoneme is represented as a vector of binary features (syllabic, consonantal, sonorant, etc.). This enables realistic sound change calculations based on phonological distance. Languages maintain:
- Phoneme inventories with feature specifications
- Phonotactic constraints for valid sound combinations
- Lexicons mapping meanings to word forms
- Evolutionary history and relationships

### Phonological Evolution System
Implements sophisticated sound change mechanisms including:
- Feature-based mutation using phonological distance calculations
- Adaptation rules for borrowed words
- Phonotactic repair strategies (epenthesis, deletion)
- Language splitting based on accumulated changes

### Geographic Spread Model
Languages spread between adjacent communities based on configurable probabilities. The system tracks prestige relationships and implements borrowing mechanics where communities can adopt words from neighboring languages while adapting them to local phonological constraints.

### Geographic Contiguity System
Enforces realistic territorial constraints by automatically detecting when languages become geographically separated and splitting them into new contiguous languages. Uses breadth-first search algorithms to identify connected components of speaker communities. When non-contiguous regions are detected, the system preserves the largest territory as the original language and creates new "branch" languages for separated regions without phonological change, reflecting realistic scenarios of political or geographic separation rather than linguistic evolution.

### Visualization Engine
Uses Tkinter for real-time rendering of the simulation. Colors are generated from phonological features using projection matrices that map feature vectors to RGB space, creating visually coherent color schemes where phonologically similar words appear in similar colors.

### Configuration Management
Centralized configuration system (`CONFIG` class) controls all simulation parameters including world generation settings, evolution probabilities, phonological constraints, and display options. This allows easy tuning of the simulation behavior without code changes.

## External Dependencies

### Core Python Libraries
- **tkinter**: GUI framework for visualization and user interface
- **random**: Probabilistic operations for mutations, borrowing, and world generation
- **math**: Mathematical operations for distance calculations and feature projections
- **typing**: Type hints for better code documentation and IDE support
- **dataclasses**: Structured data representation for words and linguistic objects
- **functools**: Performance optimization through LRU caching for color calculations

### Data Resources
- **Swadesh vocabulary list**: Core semantic concepts for universal vocabulary initialization
- **IPA phoneme inventory**: International Phonetic Alphabet symbols with distinctive features
- **Phonological feature matrix**: Binary feature specifications for realistic sound change modeling

The application is self-contained with no external API dependencies or database requirements, making it easily portable and runnable in various environments.