document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const documentsList = document.getElementById('documentsList');
    const paginationContainer = document.getElementById('pagination');
    const documentDetails = document.getElementById('documentDetails');
    const actionButtons = document.getElementById('actionButtons');
    const searchInput = document.getElementById('searchInput');
    const collectionFilter = document.getElementById('collectionFilter');
    const totalDocumentsCounter = document.getElementById('totalDocuments');
    const selectedDocumentsCounter = document.getElementById('selectedDocuments');
    const tagsFilter = document.getElementById('tagsFilter');
    const batchDeleteButton = document.getElementById('batchDeleteButton');
    const batchMoveButton = document.getElementById('batchMoveButton');
    const multiSelectToggleButton = document.getElementById('multiSelectToggle');
    const cancelMultiSelectButton = document.getElementById('cancelMultiSelect');
    const multiSelectActionsBar = document.getElementById('multiSelectActionsBar');
    
    // State variables
    let currentPage = 1;
    let totalPages = 1;
    let pageSize = 20;
    let currentDocumentId = null;
    let isMultiSelectMode = false;
    let selectedDocuments = new Set();
    let collections = [];
    let documentTags = [];
    let currentFilters = {
        search: '',
        collection_id: 'all',
        tags: []
    };
    
    // Initialize
    loadCollections().then(() => {
        loadDocuments();
        loadTags();
    });
    
    // Event Listeners
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            currentFilters.search = this.value;
            currentPage = 1;
            loadDocuments();
        }, 300));
    }
    
    if (collectionFilter) {
        collectionFilter.addEventListener('change', function() {
            currentFilters.collection_id = this.value;
            currentPage = 1;
            loadDocuments();
        });
    }
    
    if (tagsFilter) {
        $(tagsFilter).on('change', function() {
            currentFilters.tags = $(this).val();
            currentPage = 1;
            loadDocuments();
        });
    }
    
    if (multiSelectToggleButton) {
        multiSelectToggleButton.addEventListener('click', function() {
            isMultiSelectMode = !isMultiSelectMode;
            toggleMultiSelectMode();
        });
    }
    
    if (cancelMultiSelectButton) {
        cancelMultiSelectButton.addEventListener('click', function() {
            isMultiSelectMode = false;
            selectedDocuments.clear();
            toggleMultiSelectMode();
        });
    }
    
    if (batchDeleteButton) {
        batchDeleteButton.addEventListener('click', function() {
            if (selectedDocuments.size > 0) {
                if (confirm(`Are you sure you want to delete ${selectedDocuments.size} document(s)? This cannot be undone.`)) {
                    batchDeleteDocuments();
                }
            }
        });
    }
    
    if (batchMoveButton) {
        batchMoveButton.addEventListener('click', function() {
            if (selectedDocuments.size > 0) {
                // Populate collection dropdown for the move modal
                const collectionSelect = document.getElementById('moveToCollection');
                collectionSelect.innerHTML = '';
                
                // Add root option
                const rootOption = document.createElement('option');
                rootOption.value = '';
                rootOption.textContent = '-- Root (No Collection) --';
                collectionSelect.appendChild(rootOption);
                
                // Add collections recursively
                function addCollectionOptions(collections, level = 0) {
                    collections.forEach(collection => {
                        const option = document.createElement('option');
                        option.value = collection.id;
                        option.textContent = '  '.repeat(level) + collection.name + ` (${collection.document_count} docs)`;
                        collectionSelect.appendChild(option);
                        
                        if (collection.children && collection.children.length > 0) {
                            addCollectionOptions(collection.children, level + 1);
                        }
                    });
                }
                
                addCollectionOptions(collections);
                
                // Show modal
                $('#batchMoveModal').modal('show');
            }
        });
    }
    
    // Handle form submission for batch move
    const batchMoveForm = document.getElementById('batchMoveForm');
    if (batchMoveForm) {
        batchMoveForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const collectionId = document.getElementById('moveToCollection').value;
            
            fetch('/documents/api/documents/batch/move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    document_ids: Array.from(selectedDocuments),
                    collection_id: collectionId === '' ? null : collectionId
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert(`${selectedDocuments.size} document(s) moved successfully`, 'success');
                    
                    // Reset multi-select
                    isMultiSelectMode = false;
                    selectedDocuments.clear();
                    toggleMultiSelectMode();
                    
                    // Close modal
                    $('#batchMoveModal').modal('hide');
                    
                    // Reload documents
                    loadDocuments();
                } else {
                    throw new Error(data.error || 'Failed to move documents');
                }
            })
            .catch(error => {
                showAlert('Error: ' + error.message, 'danger');
            });
        });
    }
    
    // Functions
    function loadDocuments() {
        // Build query string from filters
        const params = new URLSearchParams({
            page: currentPage,
            per_page: pageSize
        });
        
        if (currentFilters.search) {
            params.append('search', currentFilters.search);
        }
        
        if (currentFilters.collection_id && currentFilters.collection_id !== 'all') {
            params.append('collection_id', currentFilters.collection_id);
        }
        
        if (currentFilters.tags && currentFilters.tags.length > 0) {
            params.append('tags', currentFilters.tags.join(','));
        }
        
        fetch(`/documents/api/documents?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                if (documentsList) {
                    renderDocuments(data.documents);
                }
                
                if (paginationContainer) {
                    renderPagination(data.total, data.page, data.per_page);
                }
                
                if (totalDocumentsCounter) {
                    totalDocumentsCounter.textContent = data.total;
                }
                
                // Update selected counter
                if (selectedDocumentsCounter) {
                    selectedDocumentsCounter.textContent = selectedDocuments.size;
                }
                
                updateMultiSelectUI();
            })
            .catch(error => {
                console.error('Failed to load documents:', error);
                showAlert('Failed to load documents. Please try again.', 'danger');
            });
    }
    
    function renderDocuments(documents) {
        documentsList.innerHTML = '';
        
        if (documents.length === 0) {
            documentsList.innerHTML = `
                <div class="text-center p-5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    <p class="text-muted">No documents found. Try different filters or upload a new document.</p>
                </div>
            `;
            return;
        }
        
        documents.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'card mb-3 document-card';
            card.setAttribute('data-document-id', doc.id);
            
            if (selectedDocuments.has(doc.id)) {
                card.classList.add('selected');
            }
            
            // Format date
            const uploadDate = new Date(doc.upload_date);
            const formattedDate = uploadDate.toLocaleDateString('en-US', {
                year: 'numeric', 
                month: 'short', 
                day: 'numeric'
            });
            
            // Limit title length
            const displayTitle = doc.title ? 
                (doc.title.length > 50 ? doc.title.substring(0, 50) + '...' : doc.title) : 
                'Untitled Document';
            
            // Format tags
            const tagsHtml = doc.tags && doc.tags.length > 0 ? 
                doc.tags.slice(0, 3).map(tag => `<span class="badge bg-secondary me-1">${tag}</span>`).join('') +
                (doc.tags.length > 3 ? `<span class="badge bg-light text-dark">+${doc.tags.length - 3}</span>` : '') :
                '<span class="text-muted small">No tags</span>';
            
            // Collection path
            const collectionPath = doc.collection_path ? 
                `<div class="small text-muted"><i class="feather feather-folder"></i> ${doc.collection_path}</div>` :
                '';
            
            card.innerHTML = `
                <div class="card-body py-2">
                    <div class="d-flex align-items-center">
                        ${isMultiSelectMode ? `
                            <div class="form-check me-2">
                                <input class="form-check-input document-select-checkbox" type="checkbox" value="${doc.id}" 
                                    ${selectedDocuments.has(doc.id) ? 'checked' : ''} 
                                    id="check-${doc.id}">
                                <label class="form-check-label" for="check-${doc.id}"></label>
                            </div>
                        ` : ''}
                        <div class="document-icon me-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <div class="flex-grow-1 document-info">
                            <h6 class="mb-0 document-title">${displayTitle}</h6>
                            <div class="small text-muted">Uploaded on ${formattedDate}</div>
                            ${collectionPath}
                            <div class="mt-1">${tagsHtml}</div>
                        </div>
                    </div>
                </div>
            `;
            
            documentsList.appendChild(card);
            
            // Add click handlers
            if (!isMultiSelectMode) {
                card.addEventListener('click', function() {
                    loadDocumentDetails(doc.id);
                });
            } else {
                const checkbox = card.querySelector('.document-select-checkbox');
                if (checkbox) {
                    checkbox.addEventListener('change', function() {
                        if (this.checked) {
                            selectedDocuments.add(doc.id);
                            card.classList.add('selected');
                        } else {
                            selectedDocuments.delete(doc.id);
                            card.classList.remove('selected');
                        }
                        
                        // Update counter
                        if (selectedDocumentsCounter) {
                            selectedDocumentsCounter.textContent = selectedDocuments.size;
                        }
                        
                        updateMultiSelectUI();
                    });
                    
                    // Make the card also toggle the checkbox
                    card.addEventListener('click', function(e) {
                        if (!e.target.matches('.form-check-input')) {
                            checkbox.checked = !checkbox.checked;
                            
                            // Trigger change event
                            const event = new Event('change');
                            checkbox.dispatchEvent(event);
                        }
                    });
                }
            }
        });
    }
    
    function renderPagination(total, currentPage, pageSize) {
        totalPages = Math.ceil(total / pageSize);
        
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        paginationContainer.innerHTML = `
            <nav aria-label="Document pagination">
                <ul class="pagination justify-content-center">
                    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
                            <span aria-hidden="true">&laquo;</span>
                        </a>
                    </li>
        `;
        
        // Add page numbers
        for (let i = 1; i <= totalPages; i++) {
            // Show limited page numbers with ellipsis
            if (
                i === 1 || 
                i === totalPages || 
                (i >= currentPage - 2 && i <= currentPage + 2)
            ) {
                paginationContainer.querySelector('ul').innerHTML += `
                    <li class="page-item ${i === currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" data-page="${i}">${i}</a>
                    </li>
                `;
            } else if (
                (i === currentPage - 3 && currentPage > 3) || 
                (i === currentPage + 3 && currentPage < totalPages - 2)
            ) {
                paginationContainer.querySelector('ul').innerHTML += `
                    <li class="page-item disabled">
                        <a class="page-link" href="#">...</a>
                    </li>
                `;
            }
        }
        
        paginationContainer.querySelector('ul').innerHTML += `
                    <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
                            <span aria-hidden="true">&raquo;</span>
                        </a>
                    </li>
                </ul>
            </nav>
        `;
        
        // Add event listeners to page links
        paginationContainer.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const page = parseInt(this.dataset.page);
                if (page && page !== currentPage && page > 0 && page <= totalPages) {
                    currentPage = page;
                    loadDocuments();
                }
            });
        });
    }
    
    function loadDocumentDetails(documentId) {
        if (!documentDetails) return;
        
        currentDocumentId = documentId;
        
        fetch(`/documents/api/documents/${documentId}`)
            .then(response => response.json())
            .then(doc => {
                // Format date
                const uploadDate = new Date(doc.upload_date);
                const formattedUploadDate = uploadDate.toLocaleDateString('en-US', {
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric'
                });
                
                let pubDateFormatted = 'Not available';
                if (doc.publication_date) {
                    const pubDate = new Date(doc.publication_date);
                    pubDateFormatted = pubDate.toLocaleDateString('en-US', {
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric'
                    });
                }
                
                // Format tags with edit capability
                const tagsHtml = doc.tags && doc.tags.length > 0 ? 
                    doc.tags.map(tag => `<div class="badge bg-secondary me-1 mb-1">${tag}</div>`).join('') :
                    '<span class="text-muted">No tags</span>';
                
                // Collection path
                const collectionPath = doc.collection_path ? 
                    `<span class="text-muted"><i class="feather feather-folder"></i> ${doc.collection_path}</span>` :
                    '<span class="text-muted"><i class="feather feather-folder"></i> No Collection</span>';
                
                // DOI display
                const doiHtml = doc.doi ? 
                    `<a href="https://doi.org/${doc.doi}" target="_blank">${doc.doi}</a>` :
                    '<span class="text-muted">Not available</span>';
                
                documentDetails.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <h4 class="card-title">${doc.title || 'Untitled Document'}</h4>
                                <div>
                                    <a href="/documents/view/${doc.id}" class="btn btn-outline-primary btn-sm" target="_blank">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        View PDF
                                    </a>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                ${collectionPath}
                            </div>
                            
                            <div class="mb-3">
                                <strong>Authors:</strong> 
                                <p>${doc.authors || 'Not available'}</p>
                            </div>
                            
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <strong>Journal:</strong> 
                                    <p>${doc.journal || 'Not available'}</p>
                                </div>
                                <div class="col-md-6">
                                    <strong>Publication Date:</strong> 
                                    <p>${pubDateFormatted}</p>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <strong>DOI:</strong> 
                                <p>${doiHtml}</p>
                            </div>
                            
                            <div class="mb-3">
                                <strong>Uploaded:</strong> 
                                <p>${formattedUploadDate}</p>
                            </div>
                            
                            <div class="mb-3">
                                <div class="d-flex justify-content-between align-items-center">
                                    <strong>Tags:</strong>
                                    <button class="btn btn-outline-secondary btn-sm" id="editTagsBtn" data-document-id="${doc.id}">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit-2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                        Edit Tags
                                    </button>
                                </div>
                                <div class="d-flex flex-wrap mt-2" id="documentTagsContainer">
                                    ${tagsHtml}
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <strong>Citation:</strong>
                                <div class="citation-container p-2 bg-light border rounded">
                                    ${doc.citation_apa || 'Citation not available'}
                                </div>
                                <button class="btn btn-outline-secondary btn-sm mt-2" onclick="navigator.clipboard.writeText('${doc.citation_apa?.replace(/'/g, "\\'") || ''}').then(() => showAlert('Citation copied to clipboard', 'success'))">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-clipboard"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                                    Copy Citation
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                
                // Add event listener to edit tags button
                const editTagsBtn = document.getElementById('editTagsBtn');
                if (editTagsBtn) {
                    editTagsBtn.addEventListener('click', function() {
                        showEditTagsModal(doc.id, doc.tags || []);
                    });
                }
                
                // Show action buttons
                if (actionButtons) {
                    actionButtons.innerHTML = `
                        <button class="btn btn-outline-primary me-2" id="editDocumentBtn" data-document-id="${doc.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            Edit Metadata
                        </button>
                        <button class="btn btn-outline-secondary me-2" id="moveDocumentBtn" data-document-id="${doc.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-folder"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            Move
                        </button>
                        <button class="btn btn-outline-danger" id="deleteDocumentBtn" data-document-id="${doc.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            Delete
                        </button>
                    `;
                    actionButtons.classList.remove('d-none');
                    
                    // Add event listeners to action buttons
                    document.getElementById('editDocumentBtn').addEventListener('click', function() {
                        showEditDocumentModal(doc.id);
                    });
                    
                    document.getElementById('moveDocumentBtn').addEventListener('click', function() {
                        showMoveDocumentModal(doc.id);
                    });
                    
                    document.getElementById('deleteDocumentBtn').addEventListener('click', function() {
                        if (confirm('Are you sure you want to delete this document? This cannot be undone.')) {
                            deleteDocument(doc.id);
                        }
                    });
                }
            })
            .catch(error => {
                console.error('Failed to load document details:', error);
                documentDetails.innerHTML = `
                    <div class="alert alert-danger">
                        Failed to load document details. Please try again.
                    </div>
                `;
            });
    }
    
    function loadCollections() {
        return fetch('/documents/api/collections')
            .then(response => response.json())
            .then(data => {
                collections = data.collections;
                
                if (collectionFilter) {
                    collectionFilter.innerHTML = '<option value="all">All Collections</option>';
                    
                    // No collection option
                    const noCollectionOption = document.createElement('option');
                    noCollectionOption.value = 'none';
                    noCollectionOption.textContent = 'No Collection';
                    collectionFilter.appendChild(noCollectionOption);
                    
                    // Add collections recursively
                    function addCollectionOptions(collections, level = 0) {
                        collections.forEach(collection => {
                            const option = document.createElement('option');
                            option.value = collection.id;
                            option.textContent = '  '.repeat(level) + collection.name + ` (${collection.document_count})`;
                            collectionFilter.appendChild(option);
                            
                            if (collection.children && collection.children.length > 0) {
                                addCollectionOptions(collection.children, level + 1);
                            }
                        });
                    }
                    
                    addCollectionOptions(collections);
                }
                
                return collections;
            });
    }
    
    function loadTags() {
        return fetch('/documents/api/tags')
            .then(response => response.json())
            .then(data => {
                documentTags = data.tags;
                
                if (tagsFilter) {
                    // Initialize select2 for tags filter
                    $(tagsFilter).empty();
                    
                    documentTags.forEach(tag => {
                        const option = new Option(tag, tag, false, false);
                        $(tagsFilter).append(option);
                    });
                    
                    $(tagsFilter).trigger('change');
                }
                
                return documentTags;
            });
    }
    
    function toggleMultiSelectMode() {
        // Toggle class on document cards based on selection state
        const documentCards = document.querySelectorAll('.document-card');
        documentCards.forEach(card => {
            if (isMultiSelectMode) {
                const docId = card.getAttribute('data-document-id');
                
                if (selectedDocuments.has(docId)) {
                    card.classList.add('selected');
                }
                
                // Remove existing click handlers
                const newCard = card.cloneNode(true);
                card.parentNode.replaceChild(newCard, card);
            }
        });
        
        // Show/hide multi-select actions bar
        if (multiSelectActionsBar) {
            if (isMultiSelectMode) {
                multiSelectActionsBar.classList.remove('d-none');
                
                // Update counter
                if (selectedDocumentsCounter) {
                    selectedDocumentsCounter.textContent = selectedDocuments.size;
                }
            } else {
                multiSelectActionsBar.classList.add('d-none');
            }
        }
        
        // Toggle buttons
        if (multiSelectToggleButton) {
            multiSelectToggleButton.textContent = isMultiSelectMode ? 'Cancel Selection' : 'Select Multiple';
        }
        
        // Reload documents to apply multi-select mode
        loadDocuments();
    }
    
    function updateMultiSelectUI() {
        // Enable/disable batch action buttons based on selection
        if (batchDeleteButton) {
            batchDeleteButton.disabled = selectedDocuments.size === 0;
        }
        
        if (batchMoveButton) {
            batchMoveButton.disabled = selectedDocuments.size === 0;
        }
    }
    
    function batchDeleteDocuments() {
        if (selectedDocuments.size === 0) return;
        
        const docIds = Array.from(selectedDocuments);
        
        fetch('/documents/api/documents/batch/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                document_ids: docIds
            })
        })
        .then(response => {
            // Always read the JSON, regardless of status code
            return response.json().then(data => {
                return { ok: response.ok, status: response.status, data };
            });
        })
        .then(result => {
            // Check if the operation was successful
            if (result.data.success) {
                showAlert(`${docIds.length} document(s) deleted successfully`, 'success');
                
                // Reset multi-select
                isMultiSelectMode = false;
                selectedDocuments.clear();
                toggleMultiSelectMode();
                
                // Reload documents
                loadDocuments();
                
                // Clear document details if current document was deleted
                if (docIds.includes(currentDocumentId)) {
                    currentDocumentId = null;
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
                }
            } else {
                // Handle error from the server
                throw new Error(result.data.error || 'Failed to delete documents');
            }
        })
        .catch(error => {
            showAlert('Error: ' + error.message, 'danger');
        });
    }
    
    function deleteDocument(documentId) {
        fetch(`/documents/api/documents/${documentId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('Document deleted successfully', 'success');
                
                // Reload documents
                loadDocuments();
                
                // Clear document details
                currentDocumentId = null;
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
            showAlert('Error: ' + error.message, 'danger');
        });
    }
    
    // Show edit document modal with current data
    function showEditDocumentModal(documentId) {
        fetch(`/documents/api/documents/${documentId}`)
            .then(response => response.json())
            .then(doc => {
                // Populate modal fields
                document.getElementById('editDocumentId').value = doc.id;
                document.getElementById('editTitle').value = doc.title || '';
                document.getElementById('editAuthors').value = doc.authors || '';
                document.getElementById('editJournal').value = doc.journal || '';
                document.getElementById('editDoi').value = doc.doi || '';
                
                // Format date for input field (YYYY-MM-DD)
                if (doc.publication_date) {
                    const pubDate = new Date(doc.publication_date);
                    const year = pubDate.getFullYear();
                    const month = String(pubDate.getMonth() + 1).padStart(2, '0');
                    const day = String(pubDate.getDate()).padStart(2, '0');
                    document.getElementById('editPublicationDate').value = `${year}-${month}-${day}`;
                } else {
                    document.getElementById('editPublicationDate').value = '';
                }
                
                // Show modal
                $('#editDocumentModal').modal('show');
            })
            .catch(error => {
                console.error('Failed to load document for editing:', error);
                showAlert('Failed to load document for editing', 'danger');
            });
    }
    
    // Show move document modal with current collection selected
    function showMoveDocumentModal(documentId) {
        fetch(`/documents/api/documents/${documentId}`)
            .then(response => response.json())
            .then(doc => {
                // Populate modal fields
                document.getElementById('moveDocumentId').value = doc.id;
                
                // Populate collection dropdown
                const collectionSelect = document.getElementById('moveToCollectionSingle');
                collectionSelect.innerHTML = '';
                
                // Add root option
                const rootOption = document.createElement('option');
                rootOption.value = '';
                rootOption.textContent = '-- Root (No Collection) --';
                collectionSelect.appendChild(rootOption);
                
                // Add collections recursively
                function addCollectionOptions(collections, level = 0) {
                    collections.forEach(collection => {
                        const option = document.createElement('option');
                        option.value = collection.id;
                        option.textContent = '  '.repeat(level) + collection.name + ` (${collection.document_count} docs)`;
                        option.selected = doc.collection_id === collection.id;
                        collectionSelect.appendChild(option);
                        
                        if (collection.children && collection.children.length > 0) {
                            addCollectionOptions(collection.children, level + 1);
                        }
                    });
                }
                
                addCollectionOptions(collections);
                
                // Show modal
                $('#moveDocumentModal').modal('show');
            })
            .catch(error => {
                console.error('Failed to load document for moving:', error);
                showAlert('Failed to load document for moving', 'danger');
            });
    }
    
    // Show edit tags modal
    function showEditTagsModal(documentId, currentTags) {
        // Populate the modal
        document.getElementById('editTagsDocumentId').value = documentId;
        
        // Initialize select2 for tags
        const tagsSelect = $('#editTagsSelect');
        tagsSelect.empty();
        
        // Add current tags and available tags
        documentTags.forEach(tag => {
            const option = new Option(tag, tag, false, currentTags.includes(tag));
            tagsSelect.append(option);
        });
        
        // Allow adding new tags
        tagsSelect.select2({
            tags: true,
            tokenSeparators: [','],
            placeholder: 'Select or type new tags',
            allowClear: true
        });
        
        // Set selected values
        tagsSelect.val(currentTags).trigger('change');
        
        // Show modal
        $('#editTagsModal').modal('show');
    }
    
    // Event handlers for form submissions
    
    // Edit document form
    const editDocumentForm = document.getElementById('editDocumentForm');
    if (editDocumentForm) {
        editDocumentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const documentId = document.getElementById('editDocumentId').value;
            const title = document.getElementById('editTitle').value;
            const authors = document.getElementById('editAuthors').value;
            const journal = document.getElementById('editJournal').value;
            const doi = document.getElementById('editDoi').value;
            const publicationDate = document.getElementById('editPublicationDate').value;
            
            fetch(`/documents/api/documents/${documentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title,
                    authors: authors,
                    journal: journal,
                    doi: doi,
                    publication_date: publicationDate
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('Document updated successfully', 'success');
                    
                    // Close modal
                    $('#editDocumentModal').modal('hide');
                    
                    // Reload document details
                    loadDocumentDetails(documentId);
                    
                    // Refresh the document list
                    loadDocuments();
                } else {
                    throw new Error(data.error || 'Failed to update document');
                }
            })
            .catch(error => {
                showAlert('Error: ' + error.message, 'danger');
            });
        });
    }
    
    // Move document form
    const moveDocumentForm = document.getElementById('moveDocumentForm');
    if (moveDocumentForm) {
        moveDocumentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const documentId = document.getElementById('moveDocumentId').value;
            const collectionId = document.getElementById('moveToCollectionSingle').value;
            
            fetch(`/documents/api/documents/${documentId}/collection`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    collection_id: collectionId === '' ? null : collectionId
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('Document moved successfully', 'success');
                    
                    // Close modal
                    $('#moveDocumentModal').modal('hide');
                    
                    // Reload document details
                    loadDocumentDetails(documentId);
                    
                    // Refresh the document list
                    loadDocuments();
                } else {
                    throw new Error(data.error || 'Failed to move document');
                }
            })
            .catch(error => {
                showAlert('Error: ' + error.message, 'danger');
            });
        });
    }
    
    // Edit tags form
    const editTagsForm = document.getElementById('editTagsForm');
    if (editTagsForm) {
        editTagsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const documentId = document.getElementById('editTagsDocumentId').value;
            const tags = $('#editTagsSelect').val();
            
            fetch(`/documents/api/documents/${documentId}/tags`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tags: tags
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('Tags updated successfully', 'success');
                    
                    // Close modal
                    $('#editTagsModal').modal('hide');
                    
                    // Reload document details
                    loadDocumentDetails(documentId);
                    
                    // Refresh the document list and tags
                    loadDocuments();
                    loadTags();
                } else {
                    throw new Error(data.error || 'Failed to update tags');
                }
            })
            .catch(error => {
                showAlert('Error: ' + error.message, 'danger');
            });
        });
    }
    
    // Utility to show alert messages
    function showAlert(message, type) {
        const alertPlaceholder = document.getElementById('alertPlaceholder');
        if (!alertPlaceholder) return;
        
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        alertPlaceholder.innerHTML = alertHtml;
        
        // Auto dismiss after 5 seconds
        setTimeout(() => {
            const alert = alertPlaceholder.querySelector('.alert');
            if (alert) {
                $(alert).alert('close');
            }
        }, 5000);
    }
    
    // Utility debounce function for search
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
});
