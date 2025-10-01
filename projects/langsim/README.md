# Language Evolution Simulator - Web Version

A comprehensive web-based port of the Language Evolution Simulator, featuring real-time visualization of how languages evolve, spread, and interact across procedurally generated worlds.

## Features

### Core Simulation
- **Procedural World Generation**: Creates realistic archipelagos and continents using cellular automata
- **Phonological Systems**: 80+ phonemes with distinctive feature-based representation
- **Language Evolution**: Sound changes, borrowing, splitting, and geographic spread
- **Lexical Development**: 300+ word vocabulary with borrowing and mutation
- **Phonotactic Constraints**: Complex syllable structure rules and evolution

### Interactive Visualization
- **Multiple Map Modes**:
  - Language Names (with dialect variations)
  - Vocabulary Words (phonologically colored)
  - Phonological Rules complexity
  - Language Families (genealogical relationships)
  - Phoneme Inventory sizes
  - Speaker Population counts
  - Language Prestige levels

### Advanced Features
- **Real-time Statistics**: Live tracking of language spread and evolution
- **Language Details Panel**: Deep inspection of phonology, vocabulary, and constraints
- **Configurable Parameters**: Adjust evolution rates, world generation, and display options
- **Geographic Constraints**: Optional language contiguity enforcement
- **Long-distance Spread**: Maritime and trade route connections
- **Size-based Splitting**: Large languages naturally fragment

## Getting Started

### Quick Start
1. Open `test.html` in a web browser to run system tests
2. If all tests pass, click "Launch Full Application" or open `index.html`
3. The simulation starts automatically with a procedurally generated world

### Controls
- **Space**: Pause/Resume simulation
- **R**: Reset simulation (same world)
- **N**: Generate new world
- **M**: Cycle through map display modes
- **V**: Cycle vocabulary words (in vocabulary mode)
- **S**: Toggle statistics panel
- **H** or **?**: Show keyboard shortcuts
- **Click**: View detailed language information
- **Settings**: Configure simulation parameters

### Map Modes
1. **Language Names**: Shows language names with color-coded dialects
2. **Vocabulary**: Displays how specific words look in each language (phonologically colored)
3. **Phonological Rules**: Complexity of phonotactic constraints (Simple/Medium/Complex)
4. **Language Families**: Colors languages by their ancestral relationships
5. **Phoneme Count**: Gradient from small to large phoneme inventories
6. **Speaker Count**: Population density of language communities
7. **Prestige**: Language prestige levels affecting spread and borrowing

## Technical Architecture

### Module Structure
- `config.js`: Global configuration and parameters
- `phonology.js`: Distinctive features, phoneme inventory, and constraints
- `vocabulary.js`: Word management and Swadesh list implementation
- `world.js`: Procedural generation and geographic systems
- `language.js`: Language class with phonology and lexicon
- `simulation.js`: Main evolution engine and mechanics
- `visualization.js`: Canvas-based rendering and map modes
- `app.js`: Application controller and UI management

### Key Algorithms
- **Cellular Automata**: For realistic world generation
- **Feature Geometry**: Phonological distances and mutations
- **Graph Algorithms**: Language contiguity and connected components
- **Stochastic Processes**: All evolution events are probabilistic
- **Color Mapping**: Hash-based consistent coloring for languages

## Configuration

### World Generation
- Grid size (50-200x50-200 recommended)
- Land probability and island bias
- Smoothing iterations for terrain

### Evolution Parameters
- Mutation rates (phonological and lexical)
- Language spread probability
- Borrowing frequency
- Splitting thresholds
- Long-distance contact rates

### Display Options
- Simulation speed (1-100 FPS)
- Boundary drawing
- Statistics output
- Font sizes and colors

## Advanced Usage

### Custom Vocabularies
Modify `VocabularyModule.CORE_VOCABULARY` to add domain-specific terms.

### Phonological Systems
Adjust `PhonologyModule.PHONEMES` to experiment with different sound systems.

### Evolution Models
Tune parameters in `CONFIG` to model specific linguistic scenarios:
- Island chains (high fragmentation)
- Continental spread (large language areas)
- Contact zones (high borrowing rates)

## Performance

- Optimized for smooth real-time simulation
- Handles worlds up to 200x200 cells
- Efficient Canvas rendering with boundary caching
- Memory management for long-running simulations

## Browser Compatibility

- Modern browsers with Canvas 2D support
- Chrome, Firefox, Safari, Edge (latest versions)
- Mobile browsers supported (with touch controls)

## Educational Applications

Perfect for:
- Historical linguistics courses
- Computational modeling classes
- Geography and anthropology studies
- Interactive demonstrations of language change
- Research into contact linguistics and areal features

## Scientific Accuracy

The simulation implements real linguistic principles:
- Distinctive feature theory for phonology
- Sound change patterns from historical linguistics
- Borrowing hierarchies and contact effects
- Geographic constraints on language spread
- Family tree models with horizontal transfer

## Troubleshooting

### Common Issues
- **Blank screen**: Check browser console for JavaScript errors
- **Slow performance**: Reduce world size or simulation speed
- **No languages appearing**: Increase land probability in world generation
- **Crashes on large worlds**: Use smaller grid sizes (under 150x150)

### Debug Mode
Open browser developer tools to see detailed console output including:
- Language statistics every 50 ticks
- Sample vocabulary from random languages
- Performance timing information
- Error messages and warnings

## License

This is a web port of the original Language Evolution Simulator. See original documentation for licensing information.

## Contributing

The codebase is modular and well-documented. Key areas for enhancement:
- Additional map visualization modes
- More sophisticated phonological processes
- Historical reconstruction features
- Export capabilities for linguistic data
- Advanced statistical analysis tools