// Import necessary modules
const sharp = require('sharp');
const fs = require('fs'); // Using the built-in file system module
const path = require('path');

// --- Configuration ---
const sourceDir = path.join(__dirname, 'source_images'); // Folder with your full-size images
const outputDir = path.join(__dirname, 'public', 'images', 'thumbnails'); // Where thumbnails will be saved
const thumbnailWidth = 300; // Target width in pixels (height scales automatically)
const thumbnailQuality = 85; // JPEG quality (1-100, higher is better quality/larger file)
// --- End Configuration ---
console.log('test');
// 1. Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
    try {
        fs.mkdirSync(outputDir, { recursive: true }); // Create parent folders if needed
        console.log(`Created thumbnail directory: ${outputDir}`);
    } catch (err) {
        console.error(`Error creating directory ${outputDir}:`, err);
        process.exit(1); // Exit if we can't create the output folder
    }
}

console.log(`Scanning ${sourceDir} for images to generate thumbnails...`);

// 2. Read the source directory
fs.readdir(sourceDir, (err, files) => {
    if (err) {
        console.error(`Error reading source directory ${sourceDir}:`, err);
        return;
    }

    let imageCount = 0;
    let processedCount = 0;

    // 3. Process each file
    files.forEach(file => {
        const sourceFilePath = path.join(sourceDir, file);
        const fileExt = path.extname(file).toLowerCase();
        const fileNameWithoutExt = path.basename(file, fileExt);

        // Check if it's likely an image file sharp supports
        if (['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.avif', '.gif'].includes(fileExt)) {
            imageCount++; // Count as an image file we'll potentially process
            const outputFileName = `${fileNameWithoutExt}.jpg`; // Standardize output to JPG
            const outputFilePath = path.join(outputDir, outputFileName);

            // 4. Check if thumbnail already exists
            if (!fs.existsSync(outputFilePath)) {
                console.log(`Generating thumbnail for ${file}...`);
                // 5. Use sharp to resize and save
                sharp(sourceFilePath)
                    .resize({ width: thumbnailWidth }) // Resize based on width, auto height
                    .toFormat('jpeg', { quality: thumbnailQuality }) // Convert to JPG
                    .toFile(outputFilePath)
                    .then(() => {
                        processedCount++;
                        console.log(` -> Successfully created ${outputFileName}`);
                    })
                    .catch(resizeErr => {
                        processedCount++; // Still counts as processed, even if error
                        console.error(` -> Error processing ${file}:`, resizeErr);
                    });
            } else {
                processedCount++; // Count as processed because we checked it
                // Optional: Log skipping message
                // console.log(`Skipping ${file}, thumbnail already exists.`);
            }
        }
    });

    // Basic check to indicate when processing might be done (won't wait for async sharp operations)
    const checkCompletion = setInterval(() => {
        if (processedCount >= imageCount) {
            console.log("Thumbnail generation process finished.");
            clearInterval(checkCompletion);
        }
    }, 100);

});