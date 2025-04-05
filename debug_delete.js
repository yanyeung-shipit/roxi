    function deleteDocument(docId) {
        console.log(`Attempting to delete document with ID: ${docId}`);
        
        if (!docId) {
            console.error('Invalid document ID for deletion:', docId);
            showAlert('Error: Missing document ID', 'danger');
            return;
        }
        
        // Show a temporary loading message
        showAlert('Deleting document...', 'info');
        
        const url = `/documents/api/documents/${docId}`;
        console.log(`Sending DELETE request to: ${url}`);
        
        fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            console.log('Delete response status:', response.status);
            if (!response.ok) {
                // Log HTTP error details
                console.error('Delete request failed with status:', response.status);
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Delete response data:', data);
            if (data.success) {
                showAlert('Document deleted successfully', 'success');
                currentDocumentId = null;
                
                // Refresh document list to reflect the change
                console.log('Refreshing document list after deletion');
                loadDocuments();
                
                // Clear document details
                if (documentDetails) {
                    documentDetails.innerHTML = `
                        <div class="text-center p-5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            <p class="text-muted">Select a document to view details</p>
                        </div>
                    `;
                }
                
                // Hide action buttons
                if (actionButtons) {
                    actionButtons.classList.add('d-none');
                }
            } else {
                throw new Error(data.error || 'Failed to delete document');
            }
        })
        .catch(error => {
            console.error('Error in delete operation:', error);
            showAlert('Error: ' + error.message, 'danger');
        });
    }
