const fs = require('fs');
const LZ4 = require('lz4');
const zlib = require('zlib');
const Readable = require('stream').Readable;
const schemaGenerator = require('madden-franchise/services/schemaGenerator');
const outputPath = 'output';

let schemaGenerationService = {};

schemaGenerationService.generate = (data) => {
  return new Promise((resolve, reject) => {
    //const uncompressedSchema = generateUncompressedSchema(data);
    
    // Check if outputPath directory exists, create it if it doesn't
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    schemaGenerator.generate('./franchise-schemas.FTX',false,outputPath)


    schemaGenerator.eventEmitter.once('schemas:done', (root) => {
      const newData = {
        'meta': root.meta,
        'schemas': root.schemas
      };

      const data = zlib.gzipSync(JSON.stringify(newData));

      resolve({
        'meta': {
          'gameYear': root.meta.gameYear,
          'major': root.meta.major,
          'minor': root.meta.minor,
          'fileExtension': '.gz'
        },
        'data': data
      });
    });
  });
};

schemaGenerationService.writeXmlSchema = (data, outputPath) => {
  return new Promise((resolve, reject) => {
    const uncompressedSchema = generateUncompressedSchema(data);

    if (fs.existsSync(outputPath)) {
      outputPath += '_1';
    }

    fs.writeFile(outputPath, uncompressedSchema, function (err) {
      if (err) reject(err);
      resolve();
    });
  });
};

schemaGenerationService._generateUncompressedSchema = generateUncompressedSchema;

module.exports = schemaGenerationService;

function decompressBlock(block) {
  let uncompressedBlock = Buffer.alloc(block.meta.size);
  let uncompressedSize = LZ4.decodeBlock(block.data, uncompressedBlock);
  return uncompressedBlock.slice(0, uncompressedSize);
};

function generateUncompressedSchema(chunk) {
  let uncompressed = Buffer.alloc(0);

  chunk.blocks.forEach((block) => {
    const uncompressedBlock = decompressBlock(block);
    uncompressed = Buffer.concat([uncompressed, uncompressedBlock]);
  });

  return uncompressed;
}