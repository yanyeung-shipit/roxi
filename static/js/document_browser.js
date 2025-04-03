/**
 * Initialize the document browser functionality
 */
function initDocumentBrowser() {
    // DOM Elements
    const searchInput = document.getElementById('searchInput');
    const documentList = document.getElementById('documentList');
    const documentCount = document.getElementById('documentCount');
    const pagination = document.getElementById('pagination');
    const collectionFilter = document.getElementById('collectionFilter');
    const refreshDocumentsBtn = document.getElementById('refreshDocumentsBtn');
    const batchActionsBtn = document.getElementById('batchActionsBtn');
    const multiSelectControls = document.getElementById('multiSelectControls');
    const selectedCount = document.getElementById('selectedCount');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const clearSelectionBtn = document.getElementById('clearSelectionBtn');
    const batchMoveBtn = document.getElementById('batchMoveBtn');
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    
    // Modals
    const editDocumentModal = document.getElementById('editDocumentModal') ? 
        new bootstrap.Modal(document.getElementById('editDocumentModal')) : null;
    const collectionModal = document.getElementById('collectionModal') ? 
        new bootstrap.Modal(document.getElementById('collectionModal')) : null;
    const manageCollectionsModal = document.getElementById('manageCollectionsModal') ? 
        new bootstrap.Modal(document.getElementById('manageCollectionsModal')) : null;
    const deleteConfirmModal = document.getElementById('deleteConfirmModal') ? 
        new bootstrap.Modal(document.getElementById('deleteConfirmModal')) : null;
    const batchMoveModal = document.getElementById('batchMoveModal') ? 
        new bootstrap.Modal(document.getElementById('batchMoveModal')) : null;
    
    // State variables
    let documents = [];
    let totalDocuments = 0;
    let currentPage = 1;
    let pageSize = 10;
    let totalPages = 0;
    let searchTerm = '';
    let activeTag = null;
    let activeCollection = '';
    let currentDocumentId = null;
    let multiSelectMode = false;
    let selectedDocuments = new Set();
    
    // Fetch and display documents
    function loadDocuments() {
        if (documentList) {
            documentList.innerHTML = '<div class="text-center my-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Loading documents...</p></div>';
        }
        
        // Build query parameters
        let params = new URLSearchParams({
            page: currentPage,
            per_page: pageSize
        });
        
        if (searchTerm) {
            params.append('search', searchTerm);
        }
        
        if (activeTag) {
            params.append('tag', activeTag);
        }
        
        if (activeCollection) {
            params.append('collection_id', activeCollection);
        }
        
        // Fetch documents from API
        fetch('/documents/api/documents?' + params.toString())
            .then(response => response.json())
            .then(data => {
                documents = data.documents;
                totalDocuments = data.total;
                totalPages = Math.ceil(totalDocuments / pageSize);
                
                renderDocuments();
                renderPagination();
                
                if (documentCount) {
                    documentCount.textContent = totalDocuments;
                }
            })
            .catch(error => {
                console.error('Error loading documents:', error);
                if (documentList) {
                    documentList.innerHTML = '<div class="alert alert-danger">Error loading documents. Please try again.</div>';
                }
            });
    }
    
    // Render document cards
    function renderDocuments() {
        if (!documentList) return;
        
        if (documents.length === 0) {
            documentList.innerHTML = '<div class="alert alert-info">No documents found. Upload some documents to get started.</div>';
            return;
        }
        
        let html = '<div class="row">';
        
        documents.forEach(doc => {
            let date = doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : 'Unknown';
            let tags = doc.tags || [];
            
            html += `
                <div class="col-md-12 mb-3">
                    <div class="card document-card h-100" data-id="${doc.id}">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                ${multiSelectMode ? `
                                    <div class="form-check">
                                        <input class="form-check-input document-checkbox" type="checkbox" value="${doc.id}" id="doc-check-${doc.id}">
                                    </div>
                                ` : ''}
                                <div class="flex-grow-1 ${multiSelectMode ? 'ms-2' : ''}">
                                    <h5 class="card-title">${doc.title || doc.filename}</h5>
                                    <p class="card-text text-muted">${doc.authors || 'Unknown authors'}</p>
                                    <p class="card-text text-muted small">${doc.journal || ''} ${doc.publication_date ? new Date(doc.publication_date).getFullYear() : ''}</p>
                                </div>
                            </div>
                            <div class="d-flex flex-wrap mt-2">
                                ${tags.map(tag => `<span class="badge bg-info me-1 mb-1">${tag}</span>`).join('')}
                            </div>
                            <div class="mt-2">
                                <small class="text-muted">Uploaded: ${date}</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        documentList.innerHTML = html;
        
        // Add event listeners to cards
        document.querySelectorAll('.document-card').forEach(card => {
            const id = card.dataset.id;
            const checkbox = card.querySelector('.document-checkbox');
            
            if (multiSelectMode && checkbox) {
                // Initialize checkbox state
                checkbox.checked = selectedDocuments.has(id);
                
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    if (checkbox.checked) {
                        selectedDocuments.add(id);
                    } else {
                        selectedDocuments.delete(id);
                    }
                    updateSelectedCount();
                });
                
                card.addEventListener('click', (e) => {
                    if (e.target !== checkbox) {
                        checkbox.checked = !checkbox.checked;
                        if (checkbox.checked) {
                            selectedDocuments.add(id);
                        } else {
                            selectedDocuments.delete(id);
                        }
                        updateSelectedCount();
                    }
                });
            } else {
                card.addEventListener('click', () => {
                    // Placeholder for fetchDocumentDetails - will add implementation later
                    console.log('Viewing document details for ID:', id);
                });
            }
        });
    }
    
    // Render pagination controls
    function renderPagination() {
        if (!pagination) return;
        
        pagination.innerHTML = '';
        
        if (totalPages <= 1) {
            return;
        }
        
        let html = '<ul class="pagination justify-content-center">';
        
        // Previous button
        html += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" aria-label="Previous" data-page="${currentPage - 1}">
                    <span aria-hidden="true">&laquo;</span>
                </a>
            </li>
        `;
        
        // Page numbers
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }
        
        // Next button
        html += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" aria-label="Next" data-page="${currentPage + 1}">
                    <span aria-hidden="true">&raquo;</span>
                </a>
            </li>
        `;
        
        html += '</ul>';
        pagination.innerHTML = html;
        
        // Add event listeners to pagination links
        document.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(link.dataset.page);
                if (page >= 1 && page <= totalPages) {
                    currentPage = page;
                    loadDocuments();
                }
            });
        });
    }
    
    // Handle multi-select mode
    function toggleMultiSelectMode() {
        multiSelectMode = !multiSelectMode;
        
        if (multiSelectControls) {
            multiSelectControls.style.display = multiSelectMode ? 'flex' : 'none';
        }
        
        if (batchActionsBtn) {
            batchActionsBtn.textContent = multiSelectMode ? 'Cancel Selection' : 'Batch Actions';
        }
        
        selectedDocuments.clear();
        updateSelectedCount();
        loadDocuments();
    }
    
    function updateSelectedCount() {
        if (selectedCount) {
            selectedCount.textContent = selectedDocuments.size;
        }
        
        // Enable/disable batch action buttons based on selection
        if (batchMoveBtn) {
            batchMoveBtn.disabled = selectedDocuments.size === 0;
        }
        
        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = selectedDocuments.size === 0;
        }
    }
    
    function selectAllDocuments() {
        const checkboxes = document.querySelectorAll('.document-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            selectedDocuments.add(checkbox.value);
        });
        updateSelectedCount();
    }
    
    function clearDocumentSelection() {
        const checkboxes = document.querySelectorAll('.document-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        selectedDocuments.clear();
        updateSelectedCount();
    }
    
    // Set up event listeners
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            searchTerm = searchInput.value.trim();
            currentPage = 1;
            loadDocuments();
        });
    }
    
    if (collectionFilter) {
        collectionFilter.addEventListener('change', function() {
            activeCollection = collectionFilter.value;
            currentPage = 1;
            loadDocuments();
        });
    }
    
    if (refreshDocumentsBtn) {
        refreshDocumentsBtn.addEventListener('click', function() {
            refreshDocumentsBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
            loadDocuments();
            
            // Reset icon after a short delay
            setTimeout(() => {
                refreshDocumentsBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            }, 1000);
        });
    }
    
    if (batchActionsBtn) {
        batchActionsBtn.addEventListener('click', toggleMultiSelectMode);
    }
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllDocuments);
    }
    
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', clearDocumentSelection);
    }
    
    if (batchMoveBtn) {
        batchMoveBtn.addEventListener('click', function() {
            if (batchMoveModal) {
                batchMoveModal.show();
            }
        });
    }
    
    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', function() {
            if (deleteConfirmModal) {
                deleteConfirmModal.show();
            }
        });
    }
    
    // Initialize
    loadDocuments();
}

// Initialize document browser when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initDocumentBrowser();
});