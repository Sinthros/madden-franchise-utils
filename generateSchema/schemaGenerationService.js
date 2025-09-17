const fs = require('fs');
//const LZ4 = require('lz4');
const zlib = require('zlib');
const path = require('path');
const schemaGenerator = require('madden-franchise').schemaGenerator;
const outputPath = 'output';

let schemaGenerationService = {};


const readFileSyncUtf8 = (filePath) => fs.readFileSync(filePath, 'utf8');

const parseXmlIncludes = (xmlContent) => {
  const includes = [];
  const includePattern = /<IncludeFile fileName="([^"]+)" \/>/g;
  let match;
  while ((match = includePattern.exec(xmlContent)) !== null) {
    includes.push(match[1]);
  }
  return includes;
};

const extractSchemasContent = (xmlContent) => {
  const schemasPattern = /<schemas>([\s\S]*?)<\/schemas>/g;
  let match = schemasPattern.exec(xmlContent);
  return match ? match[1] : '';
};

const removeIncludesSection = (xmlContent) => {
  return xmlContent.replace(/<Includes>[\s\S]*?<\/Includes>/g, '');
};

schemaGenerationService.generate = (data) => {
  return new Promise((resolve, reject) => {
    // Check if outputPath directory exists, create it if it doesn't
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    const mainSchemaPath = './franchise-schemas.FTX';
    let mainSchemaContent = readFileSyncUtf8(mainSchemaPath);

    // Parse the main schema file to get included files
    const includedFiles = parseXmlIncludes(mainSchemaContent);

    // Extract the content of the <schemas> section from the main schema
    const mainSchemasContent = extractSchemasContent(mainSchemaContent);

    let mergedSchemasContent = mainSchemasContent;
    // Read and concatenate the content of each included file
    includedFiles.forEach((includeFile) => {
      const includeFilePath = path.join(path.dirname(mainSchemaPath), `${includeFile}.FTX`);
      if (fs.existsSync(includeFilePath)) {
        let includeFileContent = readFileSyncUtf8(includeFilePath);
        // Remove the <Includes> section
        includeFileContent = removeIncludesSection(includeFileContent);
        // Extract the content of the <schemas> section
        const schemasContent = extractSchemasContent(includeFileContent);
        mergedSchemasContent += schemasContent;
      } else {
        console.warn(`Included schema file ${includeFilePath} does not exist. Skipping.`);
      }
    });

    // Replace the main schema's <schemas> section with the merged content
    mainSchemaContent = mainSchemaContent.replace(
      /<schemas>[\s\S]*?<\/schemas>/,
      `<schemas>${mergedSchemasContent}</schemas>`
    );

    // Write the combined schema to a temporary file
    const combinedSchemaPath = path.join(outputPath, 'combined-schema.FTX');
    fs.writeFileSync(combinedSchemaPath, mainSchemaContent, 'utf8');

    // Generate schema using the combined schema file
    schemaGenerator.generate(combinedSchemaPath, false, outputPath);

    schemaGenerator.eventEmitter.once('schemas:done', (root) => {
      const newData = {
        'meta': root.meta,
        'schemas': root.schemas
      };

      const compressedData = zlib.gzipSync(JSON.stringify(newData));

      resolve({
        'meta': {
          'gameYear': root.meta.gameYear,
          'major': root.meta.major,
          'minor': root.meta.minor,
          'fileExtension': '.gz'
        },
        'data': compressedData
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