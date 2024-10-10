// build.js
const fs = require('fs');
const ejs = require('ejs');
const path = require('path');

// Specify your EJS templates directory
const templatesDir = path.join(__dirname, 'views');
const outputDir = path.join(__dirname, 'public'); // Where you'll output HTML files

// Render EJS files to HTML
fs.readdir(templatesDir, (err, files) => {
  if (err) throw err;

  files.forEach(file => {
    if (file.endsWith('.ejs')) {
      const templatePath = path.join(templatesDir, file);
      const outputPath = path.join(outputDir, file.replace('.ejs', '.html'));

      ejs.renderFile(templatePath, {}, (err, str) => {
        if (err) throw err;

        fs.writeFileSync(outputPath, str);
        console.log(`Rendered ${file} to HTML.`);
      });
    }
  });
});
