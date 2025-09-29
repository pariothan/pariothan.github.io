# Samuel Lederer Portfolio Website

## Overview
This is a personal portfolio website for Samuel Lederer, featuring a modern dark theme with LCARS-inspired design elements. The site includes multiple interactive sub-projects showcasing various programming and linguistic skills.

## Project Structure
- **Main Portfolio** (`index.html`) - Personal information, projects overview, resume
- **Letter Tree Puzzles** (`public/lettertree_puzzles_web/`) - Interactive binary tree word puzzle game
- **Gravity Simulator** (`public/gravsim_web/`) - Physics simulation with n-body gravitation  
- **Modern Gravity Sim** (`gravity/`) - Updated Vite-based gravity simulator (some asset path issues)

## Technical Setup
- **Frontend**: Static HTML/CSS/JavaScript portfolio with embedded sub-projects
- **Server**: Custom Node.js static file server on port 5000
- **Dependencies**: Node.js, http-server, words library for puzzles
- **Hosting**: Configured for Replit deployment with autoscale target

## Architecture Notes
- The main site uses a single-page application pattern with JavaScript content switching
- Sub-projects are served as separate directories with their own index.html files
- Server handles directory requests by serving index.html files
- CORS and caching headers configured for development

## Current Status
- ✅ Main portfolio site working correctly
- ✅ Letter tree puzzle game functional
- ✅ Original gravity simulator working
- ⚠️ Modern gravity simulator has asset path issues (built for root serving)
- ✅ Deployment configuration complete

## User Preferences
- Clean, minimal setup preferred
- Focus on functionality over documentation
- Dark theme with technical/sci-fi aesthetic