const fs = require('fs');

const path = 'src/core/world/GridRoadNetwork.ts';
let code = fs.readFileSync(path, 'utf8');

// I will write a custom script to completely rewrite generateChunkRoadGeometry
// Or I can use edit_file if the scope is constrained.
