    function requestOcrProcessing(documentId, source = 'document') {
        // Get the relevant UI elements based on source
        const ocrStatusBadge = document.getElementById(source === 'document' ? 'documentOcrStatusBadge' : 'ocrStatusBadge');
        const ocrError = document.getElementById(source === 'document' ? 'documentOcrError' : 'ocrError');
        const ocrSuccess = document.getElementById(source === 'document' ? 'documentOcrSuccess' : 'ocrSuccess');
        const ocrProgress = document.getElementById(source === 'document' ? 'documentOcrProgress' : 'ocrProgress');
        const applyOcrButton = document.getElementById(source === 'document' ? 'documentApplyOcrButton' : 'applyOcrButton');
        
        // Update UI to show processing state
        applyOcrButton.disabled = true;
        ocrProgress.classList.remove('d-none');
        ocrError.classList.add('d-none');
        ocrSuccess.classList.add('d-none');
        
        // Call API to start OCR processing
        fetch(`/api/documents/${documentId}/ocr`, {
            method: 'POST'
        })
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
                throw new Error(data.error || 'Failed to start OCR processing');
            }
            
            // If immediate processing, show result
            if (data.ocr_status === 'completed') {
                ocrSuccess.classList.remove('d-none');
                ocrProgress.classList.add('d-none');
                applyOcrButton.disabled = false;
                ocrStatusBadge.textContent = 'OCR: Completed';
                ocrStatusBadge.classList.remove('d-none');
            } 
            // If background processing, start polling
            else if (data.ocr_status === 'processing') {
                ocrStatusBadge.textContent = 'OCR: Processing';
                ocrStatusBadge.classList.remove('d-none');
                // Start polling for status updates
                pollOcrStatus(documentId, source);
            }
        })
        .catch(error => {
            console.error('Error requesting OCR processing:', error);
            ocrError.textContent = error.message || 'An error occurred during OCR processing';
            ocrError.classList.remove('d-none');
            ocrProgress.classList.add('d-none');
            applyOcrButton.disabled = false;
        });
