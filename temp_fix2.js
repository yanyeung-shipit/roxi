    function pollOcrStatus(documentId, source = 'document') {
        // Get the relevant UI elements based on source
        const ocrStatusBadge = document.getElementById(source === 'document' ? 'documentOcrStatusBadge' : 'ocrStatusBadge');
        const ocrError = document.getElementById(source === 'document' ? 'documentOcrError' : 'ocrError');
        const ocrSuccess = document.getElementById(source === 'document' ? 'documentOcrSuccess' : 'ocrSuccess');
        const ocrProgress = document.getElementById(source === 'document' ? 'documentOcrProgress' : 'ocrProgress');
        const applyOcrButton = document.getElementById(source === 'document' ? 'documentApplyOcrButton' : 'applyOcrButton');
        
        const statusCheck = setInterval(() => {
            fetch(`/api/documents/${documentId}/ocr/status`)
                .then(response => {
                    // Check if response is OK (HTTP status between 200-299)
                    if (!response.ok) {
                        // Check content type to handle HTML error pages
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('text/html')) {
                            throw new Error('Server error occurred. Please try again later.');
                        }
                    }
                    // Try to parse as JSON
                    return response.json().catch(err => {
                        console.error('JSON parse error:', err);
                        throw new Error('Invalid response from server. Please try again later.');
                    });
                })
                .then(data => {
                    if (!data.success) {
                        throw new Error(data.error || 'Failed to get OCR status');
                    }
                    
                    const status = data.ocr_status;
                    
                    // Update status badge
                    ocrStatusBadge.textContent = `OCR: ${status.charAt(0).toUpperCase() + status.slice(1)}`;
                    
                    // Process is complete or failed
                    if (status === 'completed' || status === 'failed') {
                        clearInterval(statusCheck);
                        ocrProgress.classList.add('d-none');
                        applyOcrButton.disabled = false;
                        
                        if (status === 'completed') {
                            ocrSuccess.classList.remove('d-none');
                            // Reload document details to show updated text
                            showDocumentDetails(documentId);
                        } else if (status === 'failed') {
                            ocrError.textContent = data.ocr_error || 'OCR processing failed';
                            ocrError.classList.remove('d-none');
                        }
                    }
                })
                .catch(error => {
                    console.error('Error checking OCR status:', error);
                    clearInterval(statusCheck);
                    ocrError.textContent = error.message || 'An error occurred while checking OCR status';
                    ocrError.classList.remove('d-none');
                    ocrProgress.classList.add('d-none');
                    applyOcrButton.disabled = false;
                });
        }, 3000); // Check every 3 seconds
    }
