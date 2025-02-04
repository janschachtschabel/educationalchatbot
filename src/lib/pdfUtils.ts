import * as pdfjsLib from 'pdfjs-dist';

// Set worker path to local file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export async function extractTextFromPDF(file: File, onProgress?: (progress: number) => void): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Initialize PDF.js document with system fonts enabled
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      disableFontFace: true
    }).promise;
    
    let fullText = '';
    const totalPages = pdf.numPages;
    
    // Extract text page by page
    for (let i = 1; i <= totalPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false
        });
        
        const pageText = content.items
          .map(item => 'str' in item ? item.str : '')
          .join(' ');
          
        fullText += pageText + '\n\n';

        // Report progress
        if (onProgress) {
          onProgress((i / totalPages) * 100);
        }
      } catch (pageError) {
        console.warn(`Error extracting text from page ${i}:`, pageError);
        continue; // Skip problematic pages
      }
    }

    // Clean up the text
    fullText = fullText
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\S\r\n]+/g, ' ') // Replace multiple spaces (but keep newlines)
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
      .trim();

    if (!fullText) {
      throw new Error(`Unable to extract text from ${file.name}. Please check the file content.`);
    }

    return fullText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`Failed to process ${file.name}. The file may be corrupted or password protected.`);
  }
}

// Split text into manageable chunks for processing
export function splitTextIntoChunks(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;
  let overlapBuffer: string[] = [];

  for (const word of words) {
    if (currentLength + word.length > chunkSize) {
      // Add overlap from previous chunk
      if (overlapBuffer.length > 0) {
        currentChunk.unshift(...overlapBuffer);
      }
      chunks.push(currentChunk.join(' '));
      
      // Keep last words for overlap
      overlapBuffer = currentChunk.slice(-Math.ceil(overlap / 10));
      
      currentChunk = [word];
      currentLength = word.length;
    } else {
      currentChunk.push(word);
      currentLength += word.length + 1;
    }
  }

  // Add the last chunk if not empty
  if (currentChunk.length > 0) {
    if (overlapBuffer.length > 0) {
      currentChunk.unshift(...overlapBuffer);
    }
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}