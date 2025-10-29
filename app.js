// Configuration
const CONFIG = {
  batchPrefix: 'medplus',
  batchLength: 12,
  supportedFormats: ['image/jpeg', 'image/png', 'image/bmp', 'image/webp'],
  messages: {
    success: 'Batch number successfully extracted!',
    notFound: 'No batch number starting with \'medplus\' found in the image.',
    invalidFormat: 'Please upload a valid image file (JPEG, PNG, BMP, WEBP)',
    uploadPrompt: 'Drag and drop an image here or click to browse'
  },
  sampleBatches: [
    'medplusABC123456789',
    'MedPlusXYZ987654321',
    'MEDPLUS1234567890AB'
  ]
};

// State management
let currentFile = null;
let currentImageData = null;
let tesseractWorker = null;
let isInitializing = false;

// DOM elements
const elements = {
  uploadZone: document.getElementById('uploadZone'),
  fileInput: document.getElementById('fileInput'),
  uploadPrompt: document.getElementById('uploadPrompt'),
  previewContainer: document.getElementById('previewContainer'),
  imagePreview: document.getElementById('imagePreview'),
  fileName: document.getElementById('fileName'),
  fileSize: document.getElementById('fileSize'),
  extractBtn: document.getElementById('extractBtn'),
  clearBtn: document.getElementById('clearBtn'),
  loading: document.getElementById('loading'),
  resultsSection: document.getElementById('resultsSection'),
  resultBox: document.getElementById('resultBox'),
  resultContent: document.getElementById('resultContent'),
  detectedText: document.getElementById('detectedText'),
  textSample: document.getElementById('textSample')
};

// Initialize Tesseract worker
async function initTesseract() {
  if (tesseractWorker || isInitializing) return;
  
  isInitializing = true;
  
  try {
    tesseractWorker = await Tesseract.createWorker({
      logger: (m) => {
        if (m.status === 'recognizing text') {
          updateLoadingProgress(m.progress);
        }
      }
    });
    
    await tesseractWorker.loadLanguage('eng');
    await tesseractWorker.initialize('eng');
    
    isInitializing = false;
  } catch (error) {
    console.error('Failed to initialize Tesseract:', error);
    isInitializing = false;
  }
}

// Initialize event listeners
function init() {
  // Initialize Tesseract in background
  initTesseract();
  // Upload zone click
  elements.uploadZone.addEventListener('click', () => {
    elements.fileInput.click();
  });

  // File input change
  elements.fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop events
  elements.uploadZone.addEventListener('dragover', handleDragOver);
  elements.uploadZone.addEventListener('dragleave', handleDragLeave);
  elements.uploadZone.addEventListener('drop', handleDrop);

  // Button events
  elements.extractBtn.addEventListener('click', handleExtract);
  elements.clearBtn.addEventListener('click', handleClear);
}

// Handle file selection
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    processFile(file);
  }
}

// Handle drag over
function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  elements.uploadZone.classList.add('drag-over');
}

// Handle drag leave
function handleDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  elements.uploadZone.classList.remove('drag-over');
}

// Handle drop
function handleDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  elements.uploadZone.classList.remove('drag-over');

  const file = event.dataTransfer.files[0];
  if (file) {
    processFile(file);
  }
}

// Process uploaded file
function processFile(file) {
  // Validate file type
  if (!CONFIG.supportedFormats.includes(file.type)) {
    alert(CONFIG.messages.invalidFormat);
    return;
  }

  currentFile = file;

  // Read file and display preview
  const reader = new FileReader();
  reader.onload = (e) => {
    currentImageData = e.target.result;
    displayPreview(file, e.target.result);
  };
  reader.readAsDataURL(file);
}

// Display image preview
function displayPreview(file, imageData) {
  // Hide upload prompt, show preview
  elements.uploadPrompt.style.display = 'none';
  elements.previewContainer.style.display = 'block';

  // Set image
  elements.imagePreview.src = imageData;

  // Set file info
  elements.fileName.textContent = file.name;
  elements.fileSize.textContent = formatFileSize(file.size);

  // Enable extract button
  elements.extractBtn.disabled = false;

  // Show clear button
  elements.clearBtn.style.display = 'flex';

  // Hide results if any
  elements.resultsSection.style.display = 'none';
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Update loading progress
function updateLoadingProgress(progress) {
  const percentage = Math.round(progress * 100);
  const loadingText = elements.loading.querySelector('p');
  if (loadingText) {
    loadingText.textContent = `Recognizing text... ${percentage}%`;
  }
}

// Handle extract button click
async function handleExtract() {
  if (!currentFile || !currentImageData) return;

  // Show loading
  elements.loading.style.display = 'block';
  elements.resultsSection.style.display = 'none';
  
  const loadingText = elements.loading.querySelector('p');
  loadingText.textContent = 'Loading OCR Engine...';

  try {
    // Ensure Tesseract is initialized
    if (!tesseractWorker) {
      await initTesseract();
    }
    
    if (!tesseractWorker) {
      throw new Error('Failed to initialize OCR engine');
    }

    loadingText.textContent = 'Recognizing text... 0%';

    // Run OCR on the image
    const result = await tesseractWorker.recognize(currentImageData);
    const extractedText = result.data.text;

    // Search for batch number
    const batchNumber = extractBatchNumber(extractedText);

    // Hide loading
    elements.loading.style.display = 'none';

    // Display results
    displayResults(batchNumber, extractedText);
  } catch (error) {
    console.error('OCR Error:', error);
    elements.loading.style.display = 'none';
    displayResults(null, 'Error: Could not process image. Please try again with a clearer image.');
  }
}

// Extract batch number from text
function extractBatchNumber(text) {
  if (!text) return null;

  // Split text into lines
  const lines = text.split('\n');

  // Search each line for batch number
  for (const line of lines) {
    const regex = new RegExp(CONFIG.batchPrefix + '([a-z0-9]{' + CONFIG.batchLength + '})', 'i');
    const match = line.match(regex);
    
    if (match) {
      // Return the full match (prefix + 12 characters)
      return match[0];
    }
  }

  return null;
}

// Display results
function displayResults(batchNumber, extractedText) {
  elements.resultsSection.style.display = 'block';

  if (batchNumber) {
    // Success - batch found
    elements.resultBox.className = 'result-box success';
    elements.resultContent.innerHTML = `
      <svg class="result-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--color-success);">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <div class="result-text">
        <div class="result-label">${CONFIG.messages.success}</div>
        <div class="batch-number">${batchNumber}</div>
      </div>
    `;
  } else {
    // Error - batch not found
    elements.resultBox.className = 'result-box error';
    elements.resultContent.innerHTML = `
      <svg class="result-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--color-error);">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      <div class="result-text">
        <div class="result-label">Batch Not Found</div>
        <div class="error-message">${CONFIG.messages.notFound}</div>
      </div>
    `;
  }

  // Show detected text sample
  if (extractedText) {
    elements.detectedText.style.display = 'block';
    elements.textSample.textContent = extractedText;
  } else {
    elements.detectedText.style.display = 'none';
  }

  // Scroll to results
  elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Handle clear button click
function handleClear() {
  // Reset state
  currentFile = null;
  currentImageData = null;

  // Reset file input
  elements.fileInput.value = '';

  // Hide preview, show upload prompt
  elements.previewContainer.style.display = 'none';
  elements.uploadPrompt.style.display = 'block';

  // Disable extract button
  elements.extractBtn.disabled = true;

  // Hide clear button
  elements.clearBtn.style.display = 'none';

  // Hide results
  elements.resultsSection.style.display = 'none';
  elements.loading.style.display = 'none';

  // Clear image preview
  elements.imagePreview.src = '';
}

// Initialize app
init();