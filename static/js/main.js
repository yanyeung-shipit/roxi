/**
 * Initialize the file upload functionality
 */
function initFileUpload() {
    const uploadForm = document.getElementById('upload-form');
    const uploadStatus = document.getElementById('upload-status');
    const uploadMessage = document.getElementById('upload-message');
    const processingProgress = document.getElementById('processing-progress');
    const processingStatus = document.getElementById('processing-status');
    
    if (!uploadForm) return;
    
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(uploadForm);
        const files = formData.getAll('files[]');
        
        if (files.length === 0 || (files.length === 1 && files[0].size === 0)) {
            showAlert('Please select at least one PDF file to upload.', 'warning');
            return;
        }
        
        if (files.length > 50) {
            showAlert('Maximum 50 files allowed per upload.', 'warning');
            return;
        }
        
        // Update UI to show upload in progress
        uploadStatus.classList.remove('d-none');
        uploadStatus.classList.remove('alert-danger', 'alert-success');
        uploadStatus.classList.add('alert-info');
        uploadMessage.textContent = 'Uploading files...';
        
        // Send the files to the server
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                uploadStatus.classList.remove('alert-info', 'alert-danger');
                uploadStatus.classList.add('alert-success');
                uploadMessage.textContent = data.message;
                
                // Reset the form
                uploadForm.reset();
                
                // Update processing status
                processingProgress.style.width = '5%';
                processingProgress.textContent = '5%';
                processingStatus.textContent = 'Processing queued documents...';
                
                // Check status periodically
                checkProcessingStatus();
            } else {
                uploadStatus.classList.remove('alert-info', 'alert-success');
                uploadStatus.classList.add('alert-danger');
                uploadMessage.textContent = data.error || 'Upload failed';
                
                if (data.errors && data.errors.length > 0) {
                    const errorList = document.createElement('ul');
                    errorList.className = 'mt-2 mb-0';
                    
                    data.errors.forEach(error => {
                        const li = document.createElement('li');
                        li.textContent = error;
                        errorList.appendChild(li);
                    });
                    
                    uploadMessage.appendChild(errorList);
                }
            }
        })
        .catch(error => {
            uploadStatus.classList.remove('alert-info', 'alert-success');
            uploadStatus.classList.add('alert-danger');
            uploadMessage.textContent = 'Error: ' + error.message;
        });
    });
    
    // Check processing status periodically
    function checkProcessingStatus() {
        fetch('/monitoring/queue')
        .then(response => response.json())
        .then(data => {
            const { pending, processing, completed, failed, total } = data;
            
            if (total === 0) {
                processingProgress.style.width = '100%';
                processingProgress.textContent = 'Complete';
                processingStatus.textContent = 'No documents in processing queue.';
                return;
            }
            
            const progress = Math.round(((completed + failed) / total) * 100);
            processingProgress.style.width = progress + '%';
            processingProgress.textContent = progress + '%';
            
            if (pending === 0 && processing === 0) {
                processingStatus.textContent = `All documents processed (${completed} completed, ${failed} failed).`;
            } else {
                processingStatus.textContent = `${processing} processing, ${pending} pending, ${completed} completed, ${failed} failed.`;
                // Check again in 5 seconds
                setTimeout(checkProcessingStatus, 5000);
            }
        })
        .catch(error => {
            console.error('Error checking processing status:', error);
            processingStatus.textContent = 'Error checking processing status.';
        });
    }
    
    // Initial check for processing status
    checkProcessingStatus();
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
    
    // Find the container and prepend the alert
    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Automatically dismiss after 5 seconds
    setTimeout(() => {
        const bsAlert = new bootstrap.Alert(alertDiv);
        bsAlert.close();
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

// Initialize everything when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initFileUpload();
});