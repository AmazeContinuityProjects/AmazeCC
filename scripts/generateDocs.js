const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '../..');
const amazeCCRoot = path.join(projectRoot, 'AmazeCC');
const amazeUIRoot = path.join(projectRoot, 'AmazeUI');

const docsDir = path.join(amazeCCRoot, 'docs');

if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
}

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            if (EXTENSIONS.includes(path.extname(file))) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

function extractDetails(content) {
    const imports = [];
    const exports = [];
    
    const lines = content.split('\n');
    lines.forEach(line => {
        if (line.trim().startsWith('import ')) {
            imports.push(line.trim());
        }
        if (line.trim().startsWith('export ')) {
            exports.push(line.trim());
        }
    });

    return { imports, exports };
}

function generateMarkdownForDirectory(dirPath, outputFileName, title) {
    console.log(`Generating docs for ${title}...`);
    if (!fs.existsSync(dirPath)) {
        console.warn(`Directory not found: ${dirPath}`);
        return;
    }
    
    const files = getAllFiles(dirPath);
    let mdContent = `# ${title} Documentation\n\n`;
    mdContent += `> This document was automatically generated to assist in translating and understanding the codebase.\n\n`;
    mdContent += `Total Files: ${files.length}\n\n`;
    mdContent += `---\n\n`;

    files.forEach(file => {
        const relativePath = path.relative(projectRoot, file);
        const content = fs.readFileSync(file, 'utf-8');
        const { imports, exports } = extractDetails(content);

        mdContent += `## File: \`${relativePath}\`\n\n`;
        
        if (imports.length > 0) {
            mdContent += `### Imports\n\`\`\`typescript\n${imports.join('\n')}\n\`\`\`\n\n`;
        }

        if (exports.length > 0) {
            mdContent += `### Exports\n\`\`\`typescript\n${exports.join('\n')}\n\`\`\`\n\n`;
        }

        mdContent += `### Source Code\n`;
        mdContent += `<details><summary>Click to view full source code</summary>\n\n`;
        mdContent += `\`\`\`typescript\n${content}\n\`\`\`\n`;
        mdContent += `</details>\n\n`;
        mdContent += `---\n\n`;
    });

    const outputPath = path.join(docsDir, outputFileName);
    fs.writeFileSync(outputPath, mdContent);
    console.log(`Saved ${outputPath} (${mdContent.split('\\n').length} lines)`);
}

// Map of documentation tasks
const documentationTasks = [
    { dir: path.join(amazeUIRoot, 'src'), out: 'AmazeUI_Docs.md', title: 'AmazeUI' },
    { dir: path.join(amazeCCRoot, 'src/types'), out: 'AmazeCC_Types.md', title: 'AmazeCC Types' },
    { dir: path.join(amazeCCRoot, 'src/data'), out: 'AmazeCC_Data.md', title: 'AmazeCC Data Models' },
    { dir: path.join(amazeCCRoot, 'src/components'), out: 'AmazeCC_Components.md', title: 'AmazeCC Components' },
    { dir: path.join(amazeCCRoot, 'src/hooks'), out: 'AmazeCC_Hooks.md', title: 'AmazeCC Hooks' },
    { dir: path.join(amazeCCRoot, 'src/app'), out: 'AmazeCC_App_Routes.md', title: 'AmazeCC App Routes' },
    { dir: path.join(amazeCCRoot, 'src/lib'), out: 'AmazeCC_Logic_Core.md', title: 'AmazeCC Logic Core' },
];

documentationTasks.forEach(task => {
    generateMarkdownForDirectory(task.dir, task.out, task.title);
});

console.log('Documentation generation complete.');
