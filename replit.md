# Samuel Lederer Portfolio Website

## Overview

This is a personal portfolio website showcasing Samuel Lederer's work through an interactive dark-themed interface with multiple embedded projects. The site features a main portfolio with sections for demos, portfolio, CV, contact, and blog, along with three distinct sub-projects: a Letter Tree Puzzle game, a Legacy Gravity Simulator, and a Modern Gravity Simulator. The design follows a LCARS-inspired aesthetic with sci-fi styling and smooth animations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Single Page Application**: The main portfolio uses vanilla JavaScript with dynamic content switching through the `showContent()` function
- **Static File Structure**: Each sub-project exists as a separate directory with its own complete HTML/CSS/JS setup
- **Font Integration**: Consistent use of Google Fonts (Quantico, Fira Code, JetBrains Mono) across all projects for unified branding
- **Responsive Design**: CSS Grid and Flexbox layouts with viewport-based sizing

### Backend Architecture
- **Custom Static Server**: Node.js server (`server.js`) handles file serving with directory index support
- **CORS Configuration**: Development-friendly headers with disabled caching for real-time updates
- **Port Configuration**: Runs on port 5000 with host binding to 0.0.0.0 for Replit compatibility
- **MIME Type Handling**: Comprehensive content-type mapping for various file formats

### Sub-Project Architecture

#### Letter Tree Puzzles
- **Game Logic**: Binary tree word construction using vanilla JavaScript
- **Dictionary Integration**: Uses external `words_dictionary.json` for word validation
- **Audio System**: Sound effects for user interactions (bubble pop, button clicks, scoring)
- **Visual Effects**: SVG line drawing between tree nodes with collision detection

#### Legacy Gravity Simulator  
- **Canvas Rendering**: HTML5 Canvas-based physics simulation with real-time particle interactions
- **3D Camera System**: Spherical coordinate camera with rotation controls
- **Physics Engine**: N-body gravitational simulation with energy conservation tracking
- **Interactive Controls**: Real-time parameter adjustment for gravity, collision distance, and particle spawning

#### Modern Gravity Simulator
- **React Framework**: Built with modern React and TypeScript for component-based architecture
- **Vite Build System**: Modern build tooling with optimized asset bundling
- **Enhanced UI**: More sophisticated control interface with improved styling
- **Asset Issues**: Currently has path resolution problems due to build configuration expecting root serving

### Data Management
- **Client-Side Storage**: No persistent database; all state managed in browser memory
- **JSON Data**: Word dictionary loaded asynchronously for puzzle validation
- **Real-Time Physics**: Continuous simulation state updates with energy tracking

## External Dependencies

### Core Dependencies
- **Node.js Runtime**: Server execution environment
- **http-server**: Alternative static file serving (installed but not used in favor of custom server)
- **words**: JavaScript word list library for puzzle generation

### Frontend Libraries
- **Google Fonts**: Quantico, Fira Code, and JetBrains Mono for consistent typography
- **Vanilla JavaScript**: No framework dependencies for main portfolio and legacy projects
- **React/TypeScript**: Modern framework stack for the updated gravity simulator

### Asset Dependencies
- **Sound Effects**: Creative Commons audio files for game interactions
- **Custom CSS**: Extensive LCARS-inspired styling with animations and particle effects
- **SVG Graphics**: Dynamic line drawing for tree visualization

### Build and Deployment
- **Vite**: Modern build system for the React-based gravity simulator
- **Static File Serving**: Custom Node.js server optimized for development workflow
- **Replit Integration**: Configured for seamless cloud deployment with autoscaling