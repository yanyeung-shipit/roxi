/**
 * Initialize the document browser functionality
 */
function initDocumentBrowser() {
    const searchInput = document.getElementById('searchInput');
    const documentList = document.getElementById('documentList');
    const documentCount = document.getElementById('documentCount');
    const documentDetails = document.getElementById('documentDetails');
    const pagination = document.getElementById('pagination');
    const collectionFilter = document.getElementById('collectionFilter');
    const uploadCollection = document.getElementById('uploadCollection');
    const actionButtons = document.querySelector('.action-buttons');
    const newCollectionButton = document.getElementById('newCollectionButton');
    const manageCollectionsButton = document.getElementById('manageCollectionsButton');
    const editDocumentButton = document.getElementById('editDocumentButton');
    const deleteDocumentButton = document.getElementById('deleteDocumentButton');
    const refreshDocumentsBtn = document.getElementById('refreshDocumentsBtn');
    const toggleMultiSelectBtn = document.getElementById('toggleMultiSelectBtn');
    const multiSelectActions = document.getElementById('multiSelectActions');
    const selectedCount = document.getElementById('selectedCount');
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
    
    // Modal elements
    const editDocumentId = document.getElementById('editDocumentId');
    const editDocumentTitle = document.getElementById('editDocumentTitle');
    const editDocumentAuthors = document.getElementById('editDocumentAuthors');
    const editDocumentJournal = document.getElementById('editDocumentJournal');
    const editDocumentPublicationDate = document.getElementById('editDocumentPublicationDate');
    const editDocumentDOI = document.getElementById('editDocumentDOI');
    const editDocumentTags = document.getElementById('editDocumentTags');
    const editDocumentCollection = document.getElementById('editDocumentCollection');
    const saveDocumentButton = document.getElementById('saveDocumentButton');
    const citationPreview = document.getElementById('citationPreview');
    
    const collectionId = document.getElementById('collectionId');
    const collectionName = document.getElementById('collectionName');
    const collectionDescription = document.getElementById('collectionDescription');
    const collectionParent = document.getElementById('collectionParent');
    const collectionModalTitle = document.getElementById('collectionModalTitle');
    const saveCollectionButton = document.getElementById('saveCollectionButton');
    const deleteCollectionButton = document.getElementById('deleteCollectionButton');
    
    const deleteConfirmMessage = document.getElementById('deleteConfirmMessage');
    const confirmDeleteButton = document.getElementById('confirmDeleteButton');
    
    const batchMoveCollection = document.getElementById('batchMoveCollection');
    const batchMoveSaveButton = document.getElementById('batchMoveSaveButton');
    
    // State
    let currentPage = 1;
    let totalPages = 1;
    let activeTag = null;
    let activeCollection = '';
    let searchTerm = '';
    let documents = [];
    let collections = [];
    let currentDocumentId = null;
    let deleteType = null; // 'document' or 'collection'
    let deleteId = null;
    let isMultiSelectMode = false;
    let selectedDocuments = new Set();
    
    // Initial load
    if (documentList) {
        loadDocuments();
    }
    if (collectionFilter) {
        loadCollections();
    }
    
    // Handle search input
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            searchTerm = searchInput.value.trim();
            currentPage = 1;
            loadDocuments();
        }, 300));
    }
    
    // Handle collection filter change
    if (collectionFilter) {
        collectionFilter.addEventListener('change', function() {
            activeCollection = collectionFilter.value;
            currentPage = 1;
            loadDocuments();
        });
    }
    
    // Handle refresh button
    if (refreshDocumentsBtn) {
        refreshDocumentsBtn.addEventListener('click', function() {
            loadDocuments();
            loadCollections();
        });
    }
    
    // Handle multi-select toggle
    if (toggleMultiSelectBtn) {
        toggleMultiSelectBtn.addEventListener('click', function() {
            isMultiSelectMode = !isMultiSelectMode;
            toggleMultiSelectMode();
        });
    }
    
    // Handle batch move button
    if (batchMoveBtn) {
        batchMoveBtn.addEventListener('click', function() {
            if (selectedDocuments.size === 0) return;
            
            // Populate the batch move modal
            populateBatchMoveModal();
            batchMoveModal.show();
        });
    }
    
    // Handle batch delete button
    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', function() {
            if (selectedDocuments.size === 0) return;
            
            // Set up confirmation modal
            deleteType = 'batch';
            deleteConfirmMessage.textContent = `Are you sure you want to delete ${selectedDocuments.size} selected document(s)? This action cannot be undone.`;
            deleteConfirmModal.show();
        });
    }
    
    // Handle batch move save
    if (batchMoveSaveButton) {
        batchMoveSaveButton.addEventListener('click', function() {
            const collectionId = batchMoveCollection.value;
            if (selectedDocuments.size === 0) return;
            
            const docIds = Array.from(selectedDocuments);
            
            // Send request to move documents
            fetch('/documents/api/documents/batch/move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    document_ids: docIds,
                    collection_id: collectionId === '' ? null : collectionId
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('Documents moved successfully', 'success');
                    batchMoveModal.hide();
                    
                    // Reset multi-select
                    isMultiSelectMode = false;
                    selectedDocuments.clear();
                    toggleMultiSelectMode();
                    
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
    
    // Handle the new collection button
    if (newCollectionButton) {
        newCollectionButton.addEventListener('click', function() {
            // Clear the form for a new collection
            collectionId.value = '';
            collectionName.value = '';
            collectionDescription.value = '';
            collectionParent.value = '';
            
            // Update modal title and buttons
            collectionModalTitle.textContent = 'Create New Collection';
            deleteCollectionButton.classList.add('d-none');
            
            // Show the modal
            collectionModal.show();
        });
    }
    
    // Handle the manage collections button
    if (manageCollectionsButton) {
        manageCollectionsButton.addEventListener('click', function() {
            // Load collections data for the table
            loadCollectionsTable();
            
            // Show the modal
            manageCollectionsModal.show();
        });
    }
    
    // Handle collection form submission
    if (saveCollectionButton) {
        saveCollectionButton.addEventListener('click', function() {
            const isEdit = collectionId.value !== '';
            const url = isEdit 
                ? `/documents/api/collections/${collectionId.value}` 
                : '/documents/api/collections';
            const method = isEdit ? 'PUT' : 'POST';
            
            // Validate form
            if (!collectionName.value.trim()) {
                showAlert('Collection name is required', 'warning');
                return;
            }
            
            // Prepare data
            const data = {
                name: collectionName.value.trim(),
                description: collectionDescription.value.trim(),
                parent_id: collectionParent.value === '' ? null : collectionParent.value
            };
            
            // Send request
            fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success message
                    showAlert(`Collection ${isEdit ? 'updated' : 'created'} successfully`, 'success');
                    
                    // Close modal
                    collectionModal.hide();
                    
                    // Reload collections
                    loadCollections();
                } else {
                    throw new Error(data.error || `Failed to ${isEdit ? 'update' : 'create'} collection`);
                }
            })
            .catch(error => {
                showAlert('Error: ' + error.message, 'danger');
            });
        });
    }
    
    // Handle collection deletion
    if (deleteCollectionButton) {
        deleteCollectionButton.addEventListener('click', function() {
            if (!collectionId.value) return;
            
            // Set up confirmation modal
            deleteType = 'collection';
            deleteId = collectionId.value;
            deleteConfirmMessage.textContent = 'Are you sure you want to delete this collection? Documents will be moved to the root level.';
            
            // Hide collection modal and show confirmation modal
            collectionModal.hide();
            deleteConfirmModal.show();
        });
    }
    
    // Handle delete confirmation
    if (confirmDeleteButton) {
        confirmDeleteButton.addEventListener('click', function() {
            if (deleteType === 'document' && deleteId) {
                deleteDocument(deleteId);
            } else if (deleteType === 'collection' && deleteId) {
                deleteCollection(deleteId);
            } else if (deleteType === 'batch') {
                batchDeleteDocuments();
            }
            
            // Close modal
            deleteConfirmModal.hide();
        });
    }
    
    // Handle document editing
    if (editDocumentButton) {
        editDocumentButton.addEventListener('click', function() {
            if (!currentDocumentId) return;
            
            // Find current document
            const doc = documents.find(d => d.id === currentDocumentId);
            if (!doc) return;
            
            // Populate form
            editDocumentId.value = doc.id;
            editDocumentTitle.value = doc.title || '';
            editDocumentAuthors.value = doc.authors || '';
            editDocumentJournal.value = doc.journal || '';
            editDocumentPublicationDate.value = doc.publication_date ? doc.publication_date.split('T')[0] : '';
            editDocumentDOI.value = doc.doi || '';
            editDocumentTags.value = doc.tags ? doc.tags.join(', ') : '';
            editDocumentCollection.value = doc.collection_id || '';
            
            // Update citation preview
            updateCitationPreview();
            
            // Show modal
            editDocumentModal.show();
        });
    }

    // Handle document view PDF (opens in new tab)
    document.addEventListener('click', function(e) {
        if (e.target.matches('.view-pdf-button') || e.target.closest('.view-pdf-button')) {
            const button = e.target.matches('.view-pdf-button') ? e.target : e.target.closest('.view-pdf-button');
            const documentId = button.dataset.id;
            if (documentId) {
                window.open(`/documents/view/${documentId}`, '_blank');
            }
        }
    });
    
    // Handle document form submission
    if (saveDocumentButton) {
        saveDocumentButton.addEventListener('click', function() {
            if (!editDocumentId.value) return;
            
            // Validate form
            if (!editDocumentTitle.value.trim()) {
                showAlert('Document title is required', 'warning');
                return;
            }
            
            // Prepare data
            const data = {
                title: editDocumentTitle.value.trim(),
                authors: editDocumentAuthors.value.trim(),
                journal: editDocumentJournal.value.trim(),
                publication_date: editDocumentPublicationDate.value || null,
                doi: editDocumentDOI.value.trim(),
                tags: editDocumentTags.value.trim() ? editDocumentTags.value.split(',').map(tag => tag.trim()) : [],
                collection_id: editDocumentCollection.value === '' ? null : editDocumentCollection.value
            };
            
            // Send request
            fetch(`/documents/api/documents/${editDocumentId.value}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success message
                    showAlert('Document updated successfully', 'success');
                    
                    // Close modal
                    editDocumentModal.hide();
                    
                    // Reload documents and show updated document
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
    
    // Handle document deletion
    if (deleteDocumentButton) {
        deleteDocumentButton.addEventListener('click', function() {
            if (!currentDocumentId) return;
            
            // Set up confirmation modal
            deleteType = 'document';
            deleteId = currentDocumentId;
            deleteConfirmMessage.textContent = 'Are you sure you want to delete this document? This action cannot be undone.';
            
            // Show confirmation modal
            deleteConfirmModal.show();
        });
    }
    
    // Form input change handlers for citation preview
    if (editDocumentTitle) editDocumentTitle.addEventListener('input', updateCitationPreview);
    if (editDocumentAuthors) editDocumentAuthors.addEventListener('input', updateCitationPreview);
    if (editDocumentJournal) editDocumentJournal.addEventListener('input', updateCitationPreview);
    if (editDocumentPublicationDate) editDocumentPublicationDate.addEventListener('input', updateCitationPreview);
    
    // Load collections into drop-down selectors
    function populateCollectionSelectors() {
        // Clear current options except the "None" option
        if (collectionFilter) {
            const firstOption = collectionFilter.options[0];
            collectionFilter.innerHTML = '';
            collectionFilter.appendChild(firstOption);
        }
        
        if (uploadCollection) {
            uploadCollection.innerHTML = '<option value="">None</option>';
        }
        
        if (editDocumentCollection) {
            editDocumentCollection.innerHTML = '<option value="">None</option>';
        }
        
        if (collectionParent) {
            collectionParent.innerHTML = '<option value="">None (Root Collection)</option>';
        }
        
        if (batchMoveCollection) {
            batchMoveCollection.innerHTML = '<option value="">None (Root Level)</option>';
        }
        
        // Add collection options
        collections.forEach(collection => {
            // Create option with indentation based on nesting level
            const indent = '\u00A0\u00A0'.repeat(getCollectionDepth(collection));
            const label = indent + collection.name;
            
            // Add to collection filter
            if (collectionFilter) {
                const option = new Option(label, collection.id);
                collectionFilter.appendChild(option);
            }
            
            // Add to upload collection select
            if (uploadCollection) {
                const option = new Option(label, collection.id);
                uploadCollection.appendChild(option);
            }
            
            // Add to edit document collection select
            if (editDocumentCollection) {
                const option = new Option(label, collection.id);
                editDocumentCollection.appendChild(option);
            }
            
            // Add to collection parent select (except when editing to prevent circular references)
            if (collectionParent) {
                // Skip this collection if it's the one being edited
                if (collection.id.toString() !== collectionId.value) {
                    const option = new Option(label, collection.id);
                    collectionParent.appendChild(option);
                }
            }
            
            // Add to batch move collection select
            if (batchMoveCollection) {
                const option = new Option(label, collection.id);
                batchMoveCollection.appendChild(option);
            }
        });
    }
    
    // Helper function to get collection depth
    function getCollectionDepth(collection) {
        let depth = 0;
        let curr = collection;
        
        while (curr.parent_id !== null) {
            depth++;
            const parent = collections.find(c => c.id === curr.parent_id);
            if (!parent) break;
            curr = parent;
        }
        
        return depth;
    }
    
    // Load collections data
    function loadCollections() {
        fetch('/documents/api/collections')
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load collections');
                }
                
                // Store collections sorted by hierarchy
                collections = data.collections;
                
                // Populate collection selectors
                populateCollectionSelectors();
            })
            .catch(error => {
                console.error('Error loading collections:', error);
                showAlert('Error loading collections: ' + error.message, 'danger');
            });
    }
    
    // Load collections into the manage collections table
    function loadCollectionsTable() {
        const tableBody = document.querySelector('#manageCollectionsTable tbody');
        if (!tableBody) return;
        
        // Show loading indicator
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">
                    <div class="spinner-border spinner-border-sm text-secondary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <span class="ms-2">Loading collections...</span>
                </td>
            </tr>
        `;
        
        fetch('/documents/api/collections')
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load collections');
                }
                
                // Clear table
                tableBody.innerHTML = '';
                
                if (data.collections.length === 0) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="4" class="text-center">
                                No collections found
                            </td>
                        </tr>
                    `;
                    return;
                }
                
                // Add collections to table
                data.collections.forEach(collection => {
                    const row = document.createElement('tr');
                    const indent = '\u00A0\u00A0'.repeat(getCollectionDepth(collection));
                    
                    row.innerHTML = `
                        <td>${indent}${escapeHtml(collection.name)}</td>
                        <td>${escapeHtml(collection.full_path)}</td>
                        <td>${collection.document_count} document${collection.document_count !== 1 ? 's' : ''}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary edit-collection" data-collection-id="${collection.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                        </td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                // Add event listeners for edit buttons
                document.querySelectorAll('.edit-collection').forEach(button => {
                    button.addEventListener('click', () => {
                        const collectionId = button.dataset.collectionId;
                        editCollection(collectionId);
                    });
                });
            })
            .catch(error => {
                console.error('Error loading collections:', error);
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center text-danger">
                            Error loading collections: ${error.message}
                        </td>
                    </tr>
                `;
            });
    }
    
    // Edit collection
    function editCollection(id) {
        fetch(`/documents/api/collections/${id}`)
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load collection');
                }
                
                const collection = data.collection;
                
                // Populate the form
                collectionId.value = collection.id;
                collectionName.value = collection.name;
                collectionDescription.value = collection.description || '';
                collectionParent.value = collection.parent_id || '';
                
                // Refresh the dropdown to prevent circular references
                loadCollections();
                
                // Update modal title and buttons
                collectionModalTitle.textContent = 'Edit Collection';
                deleteCollectionButton.classList.remove('d-none');
                
                // Hide manage collections modal and show edit modal
                manageCollectionsModal.hide();
                collectionModal.show();
            })
            .catch(error => {
                console.error('Error loading collection:', error);
                showAlert('Error loading collection: ' + error.message, 'danger');
            });
    }
    
    // Delete collection
    function deleteCollection(id) {
        fetch(`/documents/api/collections/${id}`, {
            method: 'DELETE'
        })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to delete collection');
                }
                
                // Show success message
                showAlert('Collection deleted successfully', 'success');
                
                // Reload collections
                loadCollections();
                
                // Reload documents if they were filtered by this collection
                if (activeCollection === id) {
                    activeCollection = '';
                    if (collectionFilter) collectionFilter.value = '';
                    loadDocuments();
                }
            })
            .catch(error => {
                console.error('Error deleting collection:', error);
                showAlert('Error deleting collection: ' + error.message, 'danger');
            });
    }
    
    // Delete document
    function deleteDocument(id) {
        fetch(`/documents/api/documents/${id}`, {
            method: 'DELETE'
        })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to delete document');
                }
                
                // Show success message
                showAlert('Document deleted successfully', 'success');
                
                // Reload documents
                loadDocuments();
            })
            .catch(error => {
                console.error('Error deleting document:', error);
                showAlert('Error deleting document: ' + error.message, 'danger');
            });
    }
    
    // Batch delete documents
    function batchDeleteDocuments() {
        if (selectedDocuments.size === 0) return;
        
        const docIds = Array.from(selectedDocuments);
        
        // Send request to delete documents
        fetch('/documents/api/documents/batch/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                document_ids: docIds
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert(`${docIds.length} document${docIds.length !== 1 ? 's' : ''} deleted successfully`, 'success');
                
                // Reset multi-select
                isMultiSelectMode = false;
                selectedDocuments.clear();
                toggleMultiSelectMode();
                
                // Reload documents
                loadDocuments();
            } else {
                throw new Error(data.error || 'Failed to delete documents');
            }
        })
        .catch(error => {
            showAlert('Error: ' + error.message, 'danger');
        });
    }
    
    // Toggle multi-select mode
    function toggleMultiSelectMode() {
        // Update button appearance
        if (toggleMultiSelectBtn) {
            if (isMultiSelectMode) {
                toggleMultiSelectBtn.classList.add('btn-primary');
                toggleMultiSelectBtn.classList.remove('btn-outline-primary');
            } else {
                toggleMultiSelectBtn.classList.remove('btn-primary');
                toggleMultiSelectBtn.classList.add('btn-outline-primary');
                selectedDocuments.clear();
            }
        }
        
        // Show/hide multi-select action bar
        if (multiSelectActions) {
            if (isMultiSelectMode) {
                multiSelectActions.classList.remove('d-none');
            } else {
                multiSelectActions.classList.add('d-none');
            }
        }
        
        // Update document cards
        document.querySelectorAll('.document-card').forEach(card => {
            if (isMultiSelectMode) {
                // Add checkbox
                if (!card.querySelector('.document-select-checkbox')) {
                    const checkbox = document.createElement('div');
                    checkbox.className = 'document-select-checkbox form-check';
                    checkbox.innerHTML = `<input type="checkbox" class="form-check-input" id="select-${card.dataset.id}">`;
                    card.querySelector('.card-body').prepend(checkbox);
                    
                    // Add event listener for checkbox
                    const input = checkbox.querySelector('input');
                    input.addEventListener('change', function() {
                        if (this.checked) {
                            selectedDocuments.add(parseInt(card.dataset.id));
                        } else {
                            selectedDocuments.delete(parseInt(card.dataset.id));
                        }
                        updateSelectedCount();
                    });
                    
                    // Check if document is already selected
                    if (selectedDocuments.has(parseInt(card.dataset.id))) {
                        input.checked = true;
                    }
                }
            } else {
                // Remove checkbox
                const checkbox = card.querySelector('.document-select-checkbox');
                if (checkbox) checkbox.remove();
            }
        });
        
        // Update selected count
        updateSelectedCount();
    }
    
    // Update selected count and button states
    function updateSelectedCount() {
        if (selectedCount) {
            selectedCount.textContent = `${selectedDocuments.size} selected`;
        }
        
        // Enable/disable batch action buttons
        if (batchMoveBtn) {
            batchMoveBtn.disabled = selectedDocuments.size === 0;
        }
        
        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = selectedDocuments.size === 0;
        }
    }
    
    // Populate the batch move modal
    function populateBatchMoveModal() {
        // Title should reflect number of documents being moved
        const batchMoveTitle = document.getElementById('batchMoveTitle');
        if (batchMoveTitle) {
            batchMoveTitle.textContent = `Move ${selectedDocuments.size} Document${selectedDocuments.size !== 1 ? 's' : ''}`;
        }
    }
    
    /**
     * Update citation preview based on form data
     */
    function updateCitationPreview() {
        if (!citationPreview) return;
        
        const title = editDocumentTitle.value.trim();
        const authors = editDocumentAuthors.value.trim();
        const journal = editDocumentJournal.value.trim();
        let pubDate = editDocumentPublicationDate.value;
        
        if (!title) {
            citationPreview.textContent = 'Citation will be generated automatically after saving';
            return;
        }
        
        // Format the citation (simplified APA-like format)
        let citation = '';
        
        // Authors
        if (authors) {
            const authorList = authors.split(',').map(author => author.trim());
            if (authorList.length === 1) {
                citation += authorList[0];
            } else if (authorList.length === 2) {
                citation += `${authorList[0]} & ${authorList[1]}`;
            } else {
                citation += `${authorList[0]} et al.`;
            }
            citation += ' ';
        }
        
        // Year
        if (pubDate) {
            const year = new Date(pubDate).getFullYear();
            citation += `(${year}). `;
        } else {
            citation += '. ';
        }
        
        // Title
        citation += `${title}. `;
        
        // Journal and other info
        if (journal) {
            citation += `${journal}`;
            
            if (pubDate) {
                citation += '.';
            }
        }
        
        citationPreview.textContent = citation;
    }
    
    /**
     * Load documents with current filters and pagination
     */
    function loadDocuments() {
        if (!documentList) return;
        
        // Reset selected documents if changing page
        if (isMultiSelectMode) {
            selectedDocuments.clear();
            updateSelectedCount();
        }
        
        // Show loading state
        documentList.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Loading documents...</p>
            </div>
        `;
        
        // Clear document details if needed
        if (currentDocumentId && documentDetails) {
            documentDetails.innerHTML = `
                <div class="text-center p-5">
                    <div class="spinner-border text-secondary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-3 text-muted">Loading document details...</p>
                </div>
            `;
        }
        
        // Build query parameters
        let params = new URLSearchParams();
        params.append('page', currentPage);
        params.append('per_page', 10);
        
        if (activeTag) {
            params.append('tag', activeTag);
        }
        
        if (activeCollection) {
            params.append('collection_id', activeCollection);
        }
        
        if (searchTerm) {
            params.append('search', searchTerm);
        }
        
        // Fetch documents
        fetch(`/documents/api/documents?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load documents');
                }
                
                // Store data
                documents = data.documents;
                totalPages = data.pages;
                currentPage = data.current_page;
                
                // Update count badge
                if (documentCount) {
                    documentCount.textContent = `${data.total} documents`;
                }
                
                // Clear document list
                documentList.innerHTML = '';
                
                // Handle empty results
                if (documents.length === 0) {
                    documentList.innerHTML = `
                        <div class="text-center p-5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            <p class="text-muted">No documents found</p>
                            <a href="#uploadForm" class="btn btn-outline-primary mt-3">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-upload me-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Upload Documents
                            </a>
                        </div>
                    `;
                    
                    // Clear document details
                    if (documentDetails) {
                        documentDetails.innerHTML = `
                            <div class="text-center p-5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                <p class="text-muted">No documents found</p>
                            </div>
                        `;
                    }
                    
                    // Hide action buttons
                    if (actionButtons) {
                        actionButtons.classList.add('d-none');
                    }
                    
                    // Hide pagination
                    if (pagination) {
                        pagination.innerHTML = '';
                    }
                    
                    return;
                }
                
                // Render documents
                renderDocuments(documents);
                
                // Render pagination
                renderPagination();
                
                // If in multi-select mode, update UI
                if (isMultiSelectMode) {
                    toggleMultiSelectMode();
                }
                
                // Select first document by default if not in multi-select mode
                if (documents.length > 0 && !isMultiSelectMode) {
                    const firstDoc = documents[0];
                    const firstCard = documentList.querySelector(`.document-card[data-id="${firstDoc.id}"]`);
                    if (firstCard) {
                        firstCard.classList.add('border-primary');
                        showDocumentDetails(firstDoc.id);
                    }
                }
            })
            .catch(error => {
                console.error('Error loading documents:', error);
                documentList.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Error loading documents.</strong> Please try again.
                    </div>
                `;
            });
    }
    
    /**
     * Render documents in the document list
     */
    function renderDocuments(documents) {
        // Clear document list
        documentList.innerHTML = '';
        
        // Create document cards
        documents.forEach(doc => {
            const tags = doc.tags ? doc.tags.slice(0, 5).map(tag => 
                `<span class="badge bg-secondary tag-badge">${escapeHtml(tag)}</span>`
            ).join('') : '';
            
            const statusIcon = doc.processed ? 
                '<span class="document-status-processed"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></span>' : 
                '<span class="document-status-pending"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-clock"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></span>';
            
            // Show collection badge if available
            const collectionBadge = doc.collection 
                ? `<span class="badge bg-primary collection-badge me-2"><i class="fas fa-folder me-1"></i>${escapeHtml(doc.collection.name)}</span>` 
                : '';
            
            const card = document.createElement('div');
            card.className = 'card document-card mb-3';
            card.dataset.id = doc.id;
            
            // Create card content (with or without checkbox)
            const cardContent = `
                <div class="card-body">
                    ${isMultiSelectMode ? `<div class="document-select-checkbox form-check">
                        <input type="checkbox" class="form-check-input" id="select-${doc.id}">
                    </div>` : ''}
                    <div class="d-flex justify-content-between align-items-start">
                        <h5 class="card-title">${escapeHtml(doc.title || 'Untitled Document')}</h5>
                        ${statusIcon}
                    </div>
                    <h6 class="card-subtitle mb-2 text-muted">${escapeHtml(doc.authors || 'Unknown Authors')}</h6>
                    <p class="card-text small text-muted">
                        ${doc.journal ? `${escapeHtml(doc.journal)} - ` : ''}
                        ${formatDate(doc.publication_date || doc.upload_date)}
                    </p>
                    <div class="d-flex flex-wrap mt-2 align-items-center">
                        ${collectionBadge}
                        ${tags}
                    </div>
                </div>
            `;
            
            card.innerHTML = cardContent;
            
            // Add event listeners
            card.addEventListener('click', (e) => {
                // If clicking checkbox, don't do anything else
                if (e.target.type === 'checkbox') return;
                
                if (isMultiSelectMode) {
                    // Toggle checkbox
                    const checkbox = card.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        checkbox.checked = !checkbox.checked;
                        // Trigger change event
                        const event = new Event('change');
                        checkbox.dispatchEvent(event);
                    }
                } else {
                    // Remove active class from all cards
                    document.querySelectorAll('.document-card').forEach(card => {
                        card.classList.remove('border-primary');
                    });
                    
                    // Add active class to clicked card
                    card.classList.add('border-primary');
                    
                    // Show document details
                    showDocumentDetails(doc.id);
                }
            });
            
            // Add event listener for checkbox if in multi-select mode
            if (isMultiSelectMode) {
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = selectedDocuments.has(parseInt(doc.id));
                    
                    checkbox.addEventListener('change', function() {
                        if (this.checked) {
                            selectedDocuments.add(parseInt(doc.id));
                        } else {
                            selectedDocuments.delete(parseInt(doc.id));
                        }
                        updateSelectedCount();
                    });
                }
            }
            
            documentList.appendChild(card);
        });
    }
    
    /**
     * Render pagination controls
     */
    function renderPagination() {
        if (!pagination) return;
        
        // Clear pagination
        pagination.innerHTML = '';
        
        // Handle single page
        if (totalPages <= 1) {
            return;
        }
        
        // Previous button
        const prevButton = document.createElement('li');
        prevButton.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevButton.innerHTML = `
            <a class="page-link" href="#" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </a>
        `;
        prevButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                loadDocuments();
            }
        });
        pagination.appendChild(prevButton);
        
        // Page numbers
        const maxPages = Math.min(totalPages, 5);
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + maxPages - 1);
        
        // Adjust start page if needed
        if (endPage - startPage < maxPages - 1) {
            startPage = Math.max(1, endPage - maxPages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('li');
            pageButton.className = `page-item ${i === currentPage ? 'active' : ''}`;
            pageButton.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            pageButton.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = i;
                loadDocuments();
            });
            pagination.appendChild(pageButton);
        }
        
        // Next button
        const nextButton = document.createElement('li');
        nextButton.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextButton.innerHTML = `
            <a class="page-link" href="#" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </a>
        `;
        nextButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPage < totalPages) {
                currentPage++;
                loadDocuments();
            }
        });
        pagination.appendChild(nextButton);
    }
    
    /**
     * Show document details
     */
    function showDocumentDetails(documentId) {
        if (!documentDetails) return;
        
        // Store current document ID
        currentDocumentId = documentId;
        
        // Show loading state
        documentDetails.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Loading document details...</p>
            </div>
        `;
        
        // Hide action buttons while loading
        if (actionButtons) {
            actionButtons.classList.add('d-none');
        }
        
        // Fetch document details
        fetch(`/documents/api/documents/${documentId}`)
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load document details');
                }
                
                const doc = data.document;
                
                // Format tags with click handlers
                const tags = doc.tags && doc.tags.length > 0 
                    ? doc.tags.map(tag => 
                        `<span class="badge bg-secondary tag-badge me-1 mb-1">${escapeHtml(tag)}</span>`
                      ).join('') 
                    : '<span class="text-muted">No tags</span>';
                
                // Format status and additional status information
                const status = doc.processed ? 
                    '<span class="badge bg-success">Processed</span>' : 
                    '<span class="badge bg-warning">Processing...</span>';
                
                // Format collection information
                const collectionInfo = doc.collection 
                    ? `<a href="#" class="collection-link" data-collection-id="${doc.collection.id}">${escapeHtml(doc.collection.name)}</a>` 
                    : '<span class="text-muted">None</span>';
                
                // Create the document details HTML
                let detailsHtml = `
                    <div class="document-details-content">
                        <h4 class="mb-3">${escapeHtml(doc.title || 'Untitled Document')}</h4>
                        
                        <div class="d-flex justify-content-between mb-4">
                            <div>
                                <span class="badge bg-dark me-2">Status: ${status}</span>
                                ${doc.doi ? `<span class="badge bg-info me-2">DOI: ${escapeHtml(doc.doi)}</span>` : ''}
                            </div>
                            <button class="btn btn-sm btn-outline-primary view-pdf-button" data-id="${doc.id}">
                                <i class="fas fa-file-pdf me-1"></i> View PDF
                            </button>
                        </div>
                        
                        <div class="row mb-4">
                            <div class="col-md-6 mb-3">
                                <h6 class="text-muted mb-2">Authors</h6>
                                <p>${escapeHtml(doc.authors || 'Unknown')}</p>
                            </div>
                            <div class="col-md-6 mb-3">
                                <h6 class="text-muted mb-2">Journal</h6>
                                <p>${escapeHtml(doc.journal || 'Unknown')}</p>
                            </div>
                        </div>
                        
                        <div class="row mb-4">
                            <div class="col-md-6 mb-3">
                                <h6 class="text-muted mb-2">Publication Date</h6>
                                <p>${doc.publication_date ? formatDate(doc.publication_date) : 'Unknown'}</p>
                            </div>
                            <div class="col-md-6 mb-3">
                                <h6 class="text-muted mb-2">Upload Date</h6>
                                <p>${formatDate(doc.upload_date)}</p>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <h6 class="text-muted mb-2">Collection</h6>
                            <p>${collectionInfo}</p>
                        </div>
                        
                        <div class="mb-4">
                            <h6 class="text-muted mb-2">Tags</h6>
                            <div class="tags-container">
                                ${tags}
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <h6 class="text-muted mb-2">Citation</h6>
                            <div class="citation-container p-3 bg-dark text-light">
                                ${doc.citation_apa ? escapeHtml(doc.citation_apa) : 'Citation not available'}
                            </div>
                        </div>
                    </div>
                `;
                
                // Update the document details
                documentDetails.innerHTML = detailsHtml;
                
                // Show action buttons
                if (actionButtons) {
                    actionButtons.classList.remove('d-none');
                }
            })
            .catch(error => {
                console.error('Error loading document details:', error);
                documentDetails.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Error loading document details.</strong> Please try again.
                    </div>
                `;
            });
    }
    
    /**
     * Format date for display
     */
    function formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';
        
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString(undefined, options);
    }
}

/**
 * Helper function to debounce inputs
 */
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

/**
 * Helper function to escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', initDocumentBrowser);
