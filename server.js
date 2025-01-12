const express = require('express');
const cors = require('cors');  // Import CORS middleware
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const SFTPClient = require('ssh2-sftp-client');

// Setup Express
const app = express();
const port = 3000;

// Enable CORS for all origins (or restrict to specific domains)
app.use(cors());  // This will allow all origins to make requests to this server

// If you want to restrict to specific origins (e.g., your Ionic frontend URL):
// app.use(cors({ origin: 'http://localhost:8100' }));

// Setup Multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// SFTP configuration
const sftp = new SFTPClient();
const sftpConfig = {
    host: '46.37.122.135',
    port: '22',
    username: 'sftpuser',
    password: 'Smart@008',
};

// Temporary directory for chunks
const tempDir = './uploads';

// Ensure the temp directory exists
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Upload file in chunks
let currentFile = null;
let totalChunks = 0;
let uploadedChunks = 0;

app.post('/upload-chunk', upload.single('file'), (req, res) => {
    const { chunkIndex, totalChunks: total, filename } = req.body;
    const chunk = req.file.buffer;

    // If new file, initialize upload process
    if (chunkIndex == 0) {
        currentFile = filename;
        totalChunks = total;
        uploadedChunks = 0;
    }

    // Save chunk to temporary directory
    const chunkPath = path.join(tempDir, `${filename}.part${chunkIndex}`);
    fs.writeFileSync(chunkPath, chunk);

    uploadedChunks++;

    // Check if all chunks are uploaded
    if (uploadedChunks == totalChunks) {
        // Combine chunks and upload to SFTP
            let combinedFilePath = path.join(tempDir, filename);
        let writeStream = fs.createWriteStream(combinedFilePath);

        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(tempDir, `${filename}.part${i}`);
            const chunkData = fs.readFileSync(chunkPath);
            writeStream.write(chunkData);
        }

        writeStream.end(() => {
            // Upload to SFTP
            console.log(sftpConfig);
            sftp.connect(sftpConfig)
                .then(() => sftp.put(combinedFilePath, `/uploads/${filename}`))
                .then(() => {
                    // Cleanup temporary files
                    fs.readdirSync(tempDir).forEach(file => fs.unlinkSync(path.join(tempDir, file)));
                    sftp.end();
                    res.status(200).json({ message: 'File uploaded successfully' });
                })
                .catch(err => {
                    console.error('Error uploading to SFTP:', err);
                    res.status(500).json({ error: 'Error uploading file' });
                });
        });
    } else {
        res.status(200).json({ message: 'Chunk uploaded' });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
