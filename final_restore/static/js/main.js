/**
 * Initialize the file upload functionality
 */
function initFileUpload() {
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadStatus = document.getElementById('uploadStatus');
    const processingQueue = document.getElementById('processingQueue');
    const queueInfo = document.getElementById('queueInfo');
    const queueProgress = document.getElementById('queueProgress');
    
    if (!uploadForm) return;
    
    // Handle drag and drop events
    uploadForm.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadForm.classList.add('drag-over');
    });
    
    uploadForm.addEventListener('dragleave', () => {
        uploadForm.classList.remove('drag-over');
    });
    
    uploadForm.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadForm.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            const fileCount = fileInput.files.length;
            uploadButton.textContent = `Upload ${fileCount} file${fileCount !== 1 ? 's' : ''}`;
        }
    });
    
    // Update button text when files are selected
    fileInput.addEventListener('change', () => {
        const fileCount = fileInput.files.length;
        uploadButton.textContent = fileCount > 0 
            ? `Upload ${fileCount} file${fileCount !== 1 ? 's' : ''}`
            : 'Upload PDFs';
    });
    
    // Handle form submission
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (fileInput.files.length === 0) {
            showAlert('Please select at least one PDF file to upload.', 'warning');
            return;
        }
        
        if (fileInput.files.length > 50) {
            showAlert('Maximum 50 files allowed per upload.', 'warning');
            return;
        }
        
        const formData = new FormData(uploadForm);
        
        // Show progress
        uploadButton.disabled = true;
        uploadProgress.classList.remove('d-none');
        uploadProgress.querySelector('.progress-bar').style.width = '0%';
        uploadStatus.innerHTML = '<div class="alert alert-info">Uploading files...</div>';
        
        try {
            const xhr = new XMLHttpRequest();
            
            xhr.open('POST', '/upload');
            
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    uploadProgress.querySelector('.progress-bar').style.width = percentComplete + '%';
                }
            });
            
            xhr.onload = function() {
                uploadButton.disabled = false;
                
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    
                    if (response.success) {
                        // Show success message
                        uploadStatus.innerHTML = `<div class="alert alert-success">${response.message}</div>`;
                        
                        // Reset form
                        uploadForm.reset();
                        uploadButton.textContent = 'Upload PDFs';
                        
                        // Check processing status periodically
                        checkProcessingStatus();
                        
                        // If there were some errors with individual files
                        if (response.errors && response.errors.length > 0) {
                            const errorList = response.errors.map(err => `<li>${err}</li>`).join('');
                            uploadStatus.innerHTML += `
                                <div class="alert alert-warning mt-2">
                                    <strong>Some files had issues:</strong>
                                    <ul>${errorList}</ul>
                                </div>
                            `;
                        }
                    } else {
                        // Show error message
                        let errorMsg = response.error;
                        if (response.errors && response.errors.length > 0) {
                            const errorList = response.errors.map(err => `<li>${err}</li>`).join('');
                            errorMsg += `<ul>${errorList}</ul>`;
                        }
                        uploadStatus.innerHTML = `<div class="alert alert-danger">${errorMsg}</div>`;
                    }
                } else {
                    // Show error message
                    uploadStatus.innerHTML = '<div class="alert alert-danger">Upload failed. Please try again.</div>';
                }
                
                uploadProgress.classList.add('d-none');
            };
            
            xhr.onerror = function() {
                uploadButton.disabled = false;
                uploadProgress.classList.add('d-none');
                uploadStatus.innerHTML = '<div class="alert alert-danger">Network error. Please try again.</div>';
            };
            
            xhr.send(formData);
            
        } catch (error) {
            uploadButton.disabled = false;
            uploadProgress.classList.add('d-none');
            uploadStatus.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
        }
    });
    
    function checkProcessingStatus() {
        // Show processing queue status
        processingQueue.classList.remove('d-none');
        
        // Store the current batch of files to track completion
        let currentBatchTotal = 0;
        let startingTotal = 0;  // Track the initial state when we first check
        let startingCompleted = 0; // Track completed at the start
        let startingFailed = 0; // Track failed at the start
        let batchStarted = false;
        
        // Start checking queue status
        const checkQueue = () => {
            fetch('/monitoring/queue')
                .then(response => response.json())
                .then(data => {
                    const total = data.total;
                    const pending = data.pending;
                    const processing = data.processing;
                    const completed = data.completed;
                    const failed = data.failed;
                    
                    // If this is the first time we're checking, record the current batch size
                    // and the starting counts
                    if (!batchStarted) {
                        startingTotal = total;
                        startingCompleted = completed;
                        startingFailed = failed;
                        currentBatchTotal = pending + processing; // Only count pending and in-progress
                        batchStarted = true;
                    }
                    
                    // Calculate the number of newly processed documents since we started checking
                    const newlyCompleted = completed - startingCompleted;
                    const newlyFailed = failed - startingFailed;
                    const batchProcessed = newlyCompleted + newlyFailed;
                    
                    // Update queue info - only count the current batch
                    queueInfo.textContent = `${batchProcessed} / ${currentBatchTotal} processed`;
                    
                    // Update progress bar
                    const percentComplete = (batchProcessed / currentBatchTotal) * 100;
                    queueProgress.style.width = percentComplete + '%';
                    
                    // Continue checking if there are still pending or processing documents for this batch
                    if (batchProcessed < currentBatchTotal) {
                        setTimeout(checkQueue, 5000); // Check again in 5 seconds
                    } else {
                        // All documents in this batch processed
                        setTimeout(() => {
                            processingQueue.classList.add('d-none');
                            batchStarted = false; // Reset for next batch
                        }, 3000); // Hide after 3 seconds
                    }
                })
                .catch(error => {
                    console.error('Error checking queue status:', error);
                    processingQueue.classList.add('d-none');
                    batchStarted = false; // Reset for next batch
                });
        };
        
        // Start checking
        checkQueue();
    }
}

/**
 * Show an alert message
 */
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Find a good place to show the alert
    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 150);
    }, 5000);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}