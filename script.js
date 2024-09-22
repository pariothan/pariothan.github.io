function showContent(section) {
    const display = document.getElementById('display');
    
    let content = '';

    switch(section) {
        case 'demos':
            content = '<h3>Demos</h3><p><ul><li><a href="./public/gravsim_web/index.html">Universal Gravitation</a></li><li><a href="./public/lettertree_puzzles_web/index.html">A New Type of Binary Word Puzzle</a></li></ul></p>';
            break;
        case 'portfolio':
            content = '<h3>Portfolio</h3><p>This is my portfolio showcasing various projects I\'ve worked on...</p>';
            break;
        case 'cv':
            content = document.getElementById('cv-content').innerHTML;
            break;
        case 'contact':
            content = '<h3>Contact</h3><p>You can reach me at: example@example.com</p>';
            break;
        case 'blog':
            content = '<h3>Blog</h3><p>My Blog</p>';
            break;
        default:
            content = '<p>Welcome! Click on the sidebar to see more content.</p>';
    }

    display.innerHTML = content;
}
