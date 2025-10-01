# Newton's Universal Gravitation Simulator

A sophisticated real-time physics simulation built with React, TypeScript, and HTML5 Canvas that demonstrates gravitational dynamics with interactive 3D visualization and advanced particle analysis.

## 🌟 Features Overview

### Core Physics Engine
- **Real-time Gravitational Simulation**: Implements Newton's law of universal gravitation (F = G × m₁ × m₂ / r²) between all particle pairs
- **Particle Merging**: When particles collide, they merge using conservation of momentum principles
- **Boundary Physics**: Realistic wall collisions with 70% energy retention
- **Optimized Performance**: Efficient force calculations with 60+ FPS on hundreds of particles

### 3D Visualization System
- **True 3D Physics**: Full three-dimensional particle movement and interactions
- **Perspective Projection**: Real-time 3D to 2D projection with proper depth sorting
- **Interactive Camera**: Mouse drag to rotate, scroll to zoom in 3D space
- **Depth-based Rendering**: Particles fade and scale based on distance from camera
- **3D Boundary Cube**: Visual representation of the 800×800×800 simulation space

### Advanced Particle Management
- **Multiple Creation Methods**:
  - Batch spawning with customizable count and mass
  - Click-to-place mode for precise particle placement
  - Quick preset configurations (light dots, heavy dots, massive dots, tiny dots)
- **Smart Initial Distribution**: Particles start within 100px of center Z-axis for better clustering
- **Dynamic Trail System**: Configurable particle trails with opacity control
- **Unique Visual Identity**: Each particle gets a unique color based on its ID and mass

### Mass Distribution Analysis
- **95% Mass Ellipsoid**: Statistical analysis showing where 95% of the system's mass is contained
- **True Mathematical Representation**: Uses weighted standard deviations for accurate ellipsoid fitting
- **Real-time Calculation**: On-demand ellipsoid generation via button control
- **3D Wireframe Visualization**: Three orthogonal ellipses (XY, XZ, YZ planes) showing the complete 3D shape
- **Center of Mass Tracking**: Visual indicator of the system's gravitational center

### Interactive Controls
- **Comprehensive Physics Settings**:
  - Gravity strength (0-100g)
  - Collision distance
  - Mass range (min/max)
  - Energy loss coefficient
  - Trail length and opacity
  - Particle count
- **Real-time Adjustments**: All parameters can be modified during simulation
- **Play/Pause Control**: Freeze simulation to analyze current state
- **Reset Functionality**: Instantly regenerate particle distribution
- **2D/3D Mode Toggle**: Switch between 2D and 3D physics

### Performance Monitoring
- **Real-time FPS Counter**: Live performance monitoring
- **Frame Time Display**: Millisecond-precision timing information
- **Particle Count Tracking**: Current number of active particles
- **Optimized Rendering**: High-DPI canvas support with efficient drawing

## 🔬 Physics Implementation Details

### Gravitational Force Calculation
```typescript
F = (gravity * m1 * m2) / max(distanceSquared, 1)
```
- Prevents division by zero with minimum distance constraint
- Applies force vectors in 3D space
- Updates particle velocities using F = ma

### Particle Collision and Merging
- **Detection**: Distance-based collision detection
- **Conservation Laws**: 
  - Momentum: `p_new = (p1 + p2)`
  - Mass: `m_new = m1 + m2`
  - Position: Center of mass calculation
- **Trail Combination**: Merges particle trails for visual continuity

### Boundary Interactions
- **Elastic Collisions**: Particles bounce off simulation boundaries
- **Energy Damping**: 70% velocity retention on wall impacts
- **3D Boundaries**: Full cube containment in 3D mode

### Mass Ellipsoid Mathematics
- **Center of Mass**: Weighted average position of all particles
- **Covariance Analysis**: Statistical distribution calculation
- **95% Containment**: 2-sigma ellipsoid (2 × standard deviation)
- **True Shape Representation**: No artificial enhancement, pure statistical accuracy

## 🎮 User Interface Features

### Control Panels
- **Main Controls**: Play/pause, reset, 2D/3D toggle
- **Advanced Physics**: Collapsible panel with detailed parameter control
- **Particle Creation**: Batch spawning and click-to-place modes
- **Quick Presets**: One-click particle configurations

### Visual Feedback
- **Mode Indicators**: Clear visual cues for active modes (3D, click-to-place)
- **Performance Stats**: Real-time FPS and particle count display
- **Interactive Canvas**: Responsive mouse controls with visual feedback
- **Color-coded UI**: Intuitive color scheme for different control categories

### Responsive Design
- **Adaptive Layout**: Works on various screen sizes
- **High-DPI Support**: Crisp rendering on retina displays
- **Smooth Animations**: CSS transitions and hover effects
- **Professional Styling**: Modern dark theme with accent colors

## 🛠 Technical Architecture

### Component Structure
- **App.tsx**: Main application orchestration
- **SimulationCanvas**: Canvas rendering and user interaction
- **ControlPanel**: Physics parameter controls
- **DotCreationPanel**: Particle creation interface
- **useSimulation**: Custom hook managing simulation state

### Utility Classes
- **PhysicsEngine**: Core physics calculations and particle updates
- **Renderer**: 3D projection and canvas drawing operations
- **MassAnalysis**: Statistical analysis and ellipsoid calculations

### Type Safety
- **Comprehensive Types**: Full TypeScript coverage for all simulation objects
- **Vector Mathematics**: Proper 3D vector type definitions
- **State Management**: Strongly typed simulation state

## 🚀 Performance Optimizations

### Rendering Optimizations
- **Depth Sorting**: Proper 3D rendering order
- **Culling**: Skip rendering of very small/distant particles
- **Efficient Canvas Operations**: Minimized context state changes
- **Gradient Caching**: Optimized particle glow effects

### Physics Optimizations
- **Collision Detection**: Spatial optimization for particle interactions
- **Force Calculation**: Efficient N-body simulation
- **Memory Management**: Proper trail length limiting
- **Frame Rate Control**: Adaptive time stepping

### User Experience
- **Smooth Interactions**: Responsive camera controls
- **Visual Feedback**: Immediate response to parameter changes
- **Progressive Enhancement**: Graceful degradation for lower-end devices

## 🎯 Educational Value

This simulator demonstrates key physics concepts:
- **Newton's Laws**: Universal gravitation and conservation of momentum
- **Statistical Mechanics**: Mass distribution analysis
- **3D Mathematics**: Vector operations and coordinate transformations
- **Numerical Methods**: Real-time physics integration
- **Computer Graphics**: 3D projection and rendering techniques

## 🔧 Development Features

### Code Quality
- **TypeScript**: Full type safety and IntelliSense support
- **Modular Architecture**: Clean separation of concerns
- **Custom Hooks**: Reusable React patterns
- **Performance Monitoring**: Built-in FPS tracking

### Extensibility
- **Plugin Architecture**: Easy to add new physics features
- **Configurable Parameters**: Extensive customization options
- **Component-based UI**: Modular interface components
- **Type-safe APIs**: Well-defined interfaces for all systems

## 🎨 Visual Design

### Modern Aesthetics
- **Dark Theme**: Professional space-themed color scheme
- **Smooth Animations**: Micro-interactions and hover effects
- **Consistent Typography**: Clear hierarchy and readability
- **Intuitive Icons**: Lucide React icon library integration

### Information Architecture
- **Logical Grouping**: Related controls grouped together
- **Progressive Disclosure**: Advanced options in collapsible panels
- **Visual Hierarchy**: Clear importance levels for different features
- **Contextual Help**: Inline descriptions and tooltips

This gravity simulator represents a comprehensive implementation of real-time physics simulation with advanced visualization capabilities, making complex gravitational dynamics accessible and interactive for educational and research purposes.