/**
 * Document Browser - Client-side JavaScript functionality
 * 
 * This file handles all the client-side interactivity for the document browser page,
 * including document listing, filtering, editing, and collection management.
 */

/**
 * Initialize the document browser functionality
 */
function initDocumentBrowser() {
    // Get DOM elements with null checks
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
    
    // Modals with null checks
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
            if (batchMoveModal) {
                batchMoveModal.show();
            }
        });
    }
    
    // Handle batch delete button
    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', function() {
            if (selectedDocuments.size === 0) return;
            
            // Set up confirmation modal
            deleteType = 'batch';
            if (deleteConfirmMessage) {
                deleteConfirmMessage.textContent = `Are you sure you want to delete ${selectedDocuments.size} selected document(s)? This action cannot be undone.`;
            }
            if (deleteConfirmModal) {
                deleteConfirmModal.show();
            }
        });
    }
    
    // Handle batch move save
    if (batchMoveSaveButton && batchMoveCollection) {
        batchMoveSaveButton.addEventListener('click', function() {
            const collectionIdValue = batchMoveCollection.value;
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
                    collection_id: collectionIdValue === '' ? null : collectionIdValue
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('Documents moved successfully', 'success');
                    if (batchMoveModal) {
                        batchMoveModal.hide();
                    }
                    
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
    if (newCollectionButton && collectionModal) {
        newCollectionButton.addEventListener('click', function() {
            // Clear the form for a new collection
            if (collectionId) collectionId.value = '';
            if (collectionName) collectionName.value = '';
            if (collectionDescription) collectionDescription.value = '';
            if (collectionParent) collectionParent.value = '';
            
            // Update modal title and buttons
            if (collectionModalTitle) {
                collectionModalTitle.textContent = 'Create New Collection';
            }
            if (deleteCollectionButton) {
                deleteCollectionButton.classList.add('d-none');
            }
            
            // Show the modal
            collectionModal.show();
        });
    }
    
    // Handle the manage collections button
    if (manageCollectionsButton && manageCollectionsModal) {
        manageCollectionsButton.addEventListener('click', function() {
            // Load collections data for the table
            loadCollectionsTable();
            
            // Show the modal
            manageCollectionsModal.show();
        });
    }
    
    // Handle collection form submission
    if (saveCollectionButton && collectionName) {
        saveCollectionButton.addEventListener('click', function() {
            const isEdit = collectionId && collectionId.value !== '';
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
                description: collectionDescription ? collectionDescription.value.trim() : '',
                parent_id: collectionParent && collectionParent.value === '' ? null : (collectionParent ? collectionParent.value : null)
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
                    if (collectionModal) {
                        collectionModal.hide();
                    }
                    
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
    if (deleteCollectionButton && collectionId) {
        deleteCollectionButton.addEventListener('click', function() {
            if (!collectionId.value) return;
            
            // Set up confirmation modal
            deleteType = 'collection';
            deleteId = collectionId.value;
            if (deleteConfirmMessage) {
                deleteConfirmMessage.textContent = 'Are you sure you want to delete this collection? Documents will be moved to the root level.';
            }
            
            // Hide collection modal and show confirmation modal
            if (collectionModal) {
                collectionModal.hide();
            }
            if (deleteConfirmModal) {
                deleteConfirmModal.show();
            }
        });
    }
    
    // Handle delete confirmation
    if (confirmDeleteButton) {
        confirmDeleteButton.addEventListener('click', function() {
            if (deleteType === 'document' && deleteId) {
                deleteDocument(parseInt(deleteId));
            } else if (deleteType === 'collection' && deleteId) {
                deleteCollection(parseInt(deleteId));
            } else if (deleteType === 'batch') {
                batchDeleteDocuments();
            }
            
            // Close modal
            if (deleteConfirmModal) {
                deleteConfirmModal.hide();
            }
        });
    }
    
    // Handle document editing
    if (editDocumentButton && editDocumentModal) {
        editDocumentButton.addEventListener('click', function() {
            if (!currentDocumentId) return;
            
            // Find current document
            const doc = documents.find(d => d.id === parseInt(currentDocumentId));
            if (!doc) return;
            
            // Populate form
            if (editDocumentId) editDocumentId.value = doc.id;
            if (editDocumentTitle) editDocumentTitle.value = doc.title || '';
            if (editDocumentAuthors) editDocumentAuthors.value = doc.authors || '';
            if (editDocumentJournal) editDocumentJournal.value = doc.journal || '';
            if (editDocumentPublicationDate) editDocumentPublicationDate.value = doc.publication_date ? doc.publication_date.split('T')[0] : '';
            if (editDocumentDOI) editDocumentDOI.value = doc.doi || '';
            if (editDocumentTags) editDocumentTags.value = doc.tags ? doc.tags.join(', ') : '';
            if (editDocumentCollection) editDocumentCollection.value = doc.collection_id || '';
            
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
    if (saveDocumentButton && editDocumentId && editDocumentTitle) {
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
                authors: editDocumentAuthors ? editDocumentAuthors.value.trim() : '',
                journal: editDocumentJournal ? editDocumentJournal.value.trim() : '',
                publication_date: editDocumentPublicationDate ? editDocumentPublicationDate.value || null : null,
                doi: editDocumentDOI ? editDocumentDOI.value.trim() : '',
                tags: editDocumentTags && editDocumentTags.value.trim() ? 
                     editDocumentTags.value.split(',').map(tag => tag.trim()) : [],
                collection_id: editDocumentCollection && editDocumentCollection.value === '' ? 
                              null : (editDocumentCollection ? editDocumentCollection.value : null)
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
                    if (editDocumentModal) {
                        editDocumentModal.hide();
                    }
                    
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
    if (deleteDocumentButton && deleteConfirmModal) {
        deleteDocumentButton.addEventListener('click', function() {
            if (!currentDocumentId) return;
            
            // Set up confirmation modal
            deleteType = 'document';
            deleteId = currentDocumentId;
            if (deleteConfirmMessage) {
                deleteConfirmMessage.textContent = 'Are you sure you want to delete this document? This action cannot be undone.';
            }
            
            // Show confirmation modal
            deleteConfirmModal.show();
        });
    }
    
    /**
     * Delete a document
     */
    function deleteDocument(docId) {
        fetch(`/documents/api/documents/${docId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('Document deleted successfully', 'success');
                currentDocumentId = null;
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
            showAlert('Error: ' + error.message, 'danger');
        });
    }
    
    /**
     * Delete a collection
     */
    function deleteCollection(collId) {
        fetch(`/documents/api/collections/${collId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('Collection deleted successfully', 'success');
                loadCollections();
                loadDocuments();
            } else {
                throw new Error(data.error || 'Failed to delete collection');
            }
        })
        .catch(error => {
            showAlert('Error: ' + error.message, 'danger');
        });
    }
    
    /**
     * Delete batch of documents
     */
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
        .then(response => response.json())
        .then(data => {
            if (data.success) {
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
                throw new Error(data.error || 'Failed to delete documents');
            }
        })
        .catch(error => {
            showAlert('Error: ' + error.message, 'danger');
        });
    }
    
    /**
     * Toggle multi-select mode for documents
     */
    function toggleMultiSelectMode() {
        if (!documentList) return;
        
        const documentCards = documentList.querySelectorAll('.document-card');
        
        if (isMultiSelectMode) {
            // Enable multi-select mode
            if (toggleMultiSelectBtn) {
                toggleMultiSelectBtn.classList.add('active');
            }
            if (multiSelectActions) {
                multiSelectActions.classList.remove('d-none');
            }
            
            documentCards.forEach(card => {
                card.classList.add('multi-select-mode');
                const checkbox = document.createElement('div');
                checkbox.className = 'document-select-checkbox';
                checkbox.innerHTML = '<i class="far fa-square"></i>';
                card.prepend(checkbox);
                
                // Add click handler for checkbox
                checkbox.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const docId = card.dataset.id;
                    if (selectedDocuments.has(docId)) {
                        selectedDocuments.delete(docId);
                        checkbox.innerHTML = '<i class="far fa-square"></i>';
                        card.classList.remove('selected');
                    } else {
                        selectedDocuments.add(docId);
                        checkbox.innerHTML = '<i class="fas fa-check-square"></i>';
                        card.classList.add('selected');
                    }
                    
                    updateSelectedCount();
                });
            });
        } else {
            // Disable multi-select mode
            if (toggleMultiSelectBtn) {
                toggleMultiSelectBtn.classList.remove('active');
            }
            if (multiSelectActions) {
                multiSelectActions.classList.add('d-none');
            }
            
            selectedDocuments.clear();
            
            documentCards.forEach(card => {
                card.classList.remove('multi-select-mode');
                card.classList.remove('selected');
                const checkbox = card.querySelector('.document-select-checkbox');
                if (checkbox) {
                    checkbox.remove();
                }
            });
        }
        
        updateSelectedCount();
    }
    
    /**
     * Update the selected count display
     */
    function updateSelectedCount() {
        if (selectedCount) {
            selectedCount.textContent = `${selectedDocuments.size} selected`;
        }
        
        // Enable/disable batch action buttons based on selection
        if (batchMoveBtn) {
            batchMoveBtn.disabled = selectedDocuments.size === 0;
        }
        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = selectedDocuments.size === 0;
        }
    }
    
    /**
     * Populate the batch move modal with collections
     */
    function populateBatchMoveModal() {
        if (!batchMoveCollection) return;
        
        batchMoveCollection.innerHTML = '<option value="">None (Root Level)</option>';
        
        // Sort collections by name with root collections first
        const sortedCollections = [...collections].sort((a, b) => {
            // Sort by parent_id (null first) then by name
            if ((a.parent_id === null) !== (b.parent_id === null)) {
                return (a.parent_id === null) ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        
        sortedCollections.forEach(coll => {
            const depth = getCollectionDepth(coll);
            const prefix = '— '.repeat(depth);
            const option = document.createElement('option');
            option.value = coll.id;
            option.textContent = prefix + coll.name;
            batchMoveCollection.appendChild(option);
        });
    }
    
    /**
     * Helper function to get collection depth
     */
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
    
    /**
     * Load collections data
     */
    function loadCollections() {
        fetch('/documents/api/collections')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    collections = data.collections || [];
                    
                    // Sort collections by name with root collections first
                    const sortedCollections = [...collections].sort((a, b) => {
                        // Sort by parent_id (null first) then by name
                        if ((a.parent_id === null) !== (b.parent_id === null)) {
                            return (a.parent_id === null) ? -1 : 1;
                        }
                        return a.name.localeCompare(b.name);
                    });
                    
                    // Populate collection filters
                    if (collectionFilter) {
                        collectionFilter.innerHTML = '<option value="">All Collections</option>';
                        
                        sortedCollections.forEach(coll => {
                            const depth = getCollectionDepth(coll);
                            const prefix = '— '.repeat(depth);
                            const option = document.createElement('option');
                            option.value = coll.id;
                            option.textContent = prefix + coll.name;
                            if (coll.id === activeCollection) {
                                option.selected = true;
                            }
                            collectionFilter.appendChild(option);
                        });
                    }
                    
                    // Populate upload collection dropdown
                    if (uploadCollection) {
                        uploadCollection.innerHTML = '<option value="">None</option>';
                        
                        sortedCollections.forEach(coll => {
                            const depth = getCollectionDepth(coll);
                            const prefix = '— '.repeat(depth);
                            const option = document.createElement('option');
                            option.value = coll.id;
                            option.textContent = prefix + coll.name;
                            uploadCollection.appendChild(option);
                        });
                    }
                    
                    // Populate edit document collection dropdown
                    if (editDocumentCollection) {
                        editDocumentCollection.innerHTML = '<option value="">None</option>';
                        
                        sortedCollections.forEach(coll => {
                            const depth = getCollectionDepth(coll);
                            const prefix = '— '.repeat(depth);
                            const option = document.createElement('option');
                            option.value = coll.id;
                            option.textContent = prefix + coll.name;
                            editDocumentCollection.appendChild(option);
                        });
                    }
                    
                    // Populate collection parent dropdown
                    if (collectionParent) {
                        collectionParent.innerHTML = '<option value="">None (Root Collection)</option>';
                        
                        sortedCollections.forEach(coll => {
                            // Skip current collection as it can't be its own parent
                            if (collectionId && coll.id === collectionId.value) return;
                            
                            const depth = getCollectionDepth(coll);
                            // Skip if depth > 1 to maintain max hierarchy depth of 3
                            if (depth > 1) return;
                            
                            const prefix = '— '.repeat(depth);
                            const option = document.createElement('option');
                            option.value = coll.id;
                            option.textContent = prefix + coll.name;
                            collectionParent.appendChild(option);
                        });
                    }
                } else {
                    console.error('Failed to load collections:', data.error);
                }
            })
            .catch(error => {
                console.error('Error loading collections:', error);
                showAlert('Error loading collections', 'danger');
            });
    }
    
    /**
     * Load collections for the manage collections table
     */
    function loadCollectionsTable() {
        const collectionTableBody = document.querySelector('#manageCollectionsModal .modal-body table tbody');
        if (!collectionTableBody) return;
        
        fetch('/documents/api/collections')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Sort collections by hierarchy and name
                    const sortedCollections = [...data.collections].sort((a, b) => {
                        const pathA = a.full_path || a.name;
                        const pathB = b.full_path || b.name;
                        return pathA.localeCompare(pathB);
                    });
                    
                    // Clear existing table rows
                    collectionTableBody.innerHTML = '';
                    
                    // Add collection rows
                    sortedCollections.forEach(coll => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${coll.name}</td>
                            <td>${coll.full_path || coll.name}</td>
                            <td>${coll.total_documents || 0}</td>
                            <td>
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-primary edit-collection-btn" data-id="${coll.id}">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-outline-danger delete-collection-btn" data-id="${coll.id}">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        `;
                        collectionTableBody.appendChild(row);
                    });
                    
                    // Add event listeners to edit and delete buttons
                    const editButtons = collectionTableBody.querySelectorAll('.edit-collection-btn');
                    const deleteButtons = collectionTableBody.querySelectorAll('.delete-collection-btn');
                    
                    editButtons.forEach(btn => {
                        btn.addEventListener('click', function() {
                            const collId = btn.dataset.id;
                            editCollection(collId);
                        });
                    });
                    
                    deleteButtons.forEach(btn => {
                        btn.addEventListener('click', function() {
                            const collId = btn.dataset.id;
                            
                            // Set up confirmation modal
                            deleteType = 'collection';
                            deleteId = collId;
                            if (deleteConfirmMessage) {
                                deleteConfirmMessage.textContent = 'Are you sure you want to delete this collection? Documents will be moved to the root level.';
                            }
                            
                            // Hide manage collections modal and show confirmation modal
                            if (manageCollectionsModal) {
                                manageCollectionsModal.hide();
                            }
                            if (deleteConfirmModal) {
                                deleteConfirmModal.show();
                            }
                        });
                    });
                } else {
                    console.error('Failed to load collections:', data.error);
                }
            })
            .catch(error => {
                console.error('Error loading collections:', error);
                showAlert('Error loading collections', 'danger');
            });
    }
    
    /**
     * Edit a collection
     */
    function editCollection(collId) {
        // Find collection data
        const collection = collections.find(c => c.id === collId);
        if (!collection) return;
        
        // Populate form
        if (collectionId) collectionId.value = collection.id;
        if (collectionName) collectionName.value = collection.name;
        if (collectionDescription) collectionDescription.value = collection.description || '';
        if (collectionParent) collectionParent.value = collection.parent_id || '';
        
        // Update modal title and buttons
        if (collectionModalTitle) {
            collectionModalTitle.textContent = 'Edit Collection';
        }
        if (deleteCollectionButton) {
            deleteCollectionButton.classList.remove('d-none');
        }
        
        // Hide manage collections modal and show collection modal
        if (manageCollectionsModal) {
            manageCollectionsModal.hide();
        }
        if (collectionModal) {
            collectionModal.show();
        }
    }
    
    /**
     * Load documents with search, filtering, and pagination
     */
    function loadDocuments() {
        if (!documentList) return;
        
        // Show loading indicator
        documentList.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Loading documents...</p>
            </div>
        `;
        
        // Build query parameters
        let params = new URLSearchParams();
        params.append('page', currentPage);
        
        if (searchTerm) {
            params.append('search', searchTerm);
        }
        
        if (activeCollection) {
            params.append('collection_id', activeCollection);
        }
        
        if (activeTag) {
            params.append('tag', activeTag);
        }
        
        // Fetch documents
        fetch(`/documents/api/documents?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    documents = data.documents || [];
                    totalPages = data.total_pages || 1;
                    
                    // Update document count
                    if (documentCount) {
                        documentCount.textContent = `${data.total_documents || 0} document${data.total_documents !== 1 ? 's' : ''}`;
                    }
                    
                    displayDocuments();
                    updatePagination();
                } else {
                    console.error('Failed to load documents:', data.error);
                    documentList.innerHTML = `
                        <div class="text-center p-5">
                            <div class="alert alert-danger">
                                Error loading documents: ${data.error || 'Unknown error'}
                            </div>
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Error loading documents:', error);
                documentList.innerHTML = `
                    <div class="text-center p-5">
                        <div class="alert alert-danger">
                            Error loading documents: ${error.message || 'Network error'}
                        </div>
                    </div>
                `;
            });
    }
    
    /**
     * Display documents in the document list
     */
    function displayDocuments() {
        if (!documentList) return;
        
        if (documents.length === 0) {
            documentList.innerHTML = `
                <div class="text-center p-5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search mb-3"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <h5>No documents found</h5>
                    <p class="text-muted">Try adjusting your search or filters</p>
                </div>
            `;
            return;
        }
        
        documentList.innerHTML = '';
        
        documents.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'document-card';
            card.dataset.id = doc.id;
            
            // Format publication date
            let formattedDate = 'Unknown date';
            if (doc.publication_date) {
                const date = new Date(doc.publication_date);
                formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            }
            
            // Create tags HTML
            let tagsHtml = '';
            if (doc.tags && doc.tags.length > 0) {
                tagsHtml = `
                    <div class="document-tags">
                        ${doc.tags.slice(0, 3).map(tag => `<span class="badge bg-secondary">${tag}</span>`).join(' ')}
                        ${doc.tags.length > 3 ? `<span class="badge bg-secondary">+${doc.tags.length - 3}</span>` : ''}
                    </div>
                `;
            }
            
            // Create collection badge HTML
            let collectionHtml = '';
            if (doc.collection_id) {
                const collection = collections.find(c => c.id === doc.collection_id);
                if (collection) {
                    collectionHtml = `
                        <div class="document-collection">
                            <i class="fas fa-folder"></i> ${collection.name}
                        </div>
                    `;
                }
            }
            
            card.innerHTML = `
                <div class="document-title"><strong>${doc.title || 'Untitled Document'}</strong></div>
                <div class="document-authors">${doc.authors || 'Unknown authors'}</div>
                <div class="document-date">${formattedDate}</div>
                ${tagsHtml}
                ${collectionHtml}
                <div class="document-actions mt-2">
                    <button class="btn btn-sm btn-outline-secondary edit-doc-btn" data-id="${doc.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-doc-btn" data-id="${doc.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            // Add click handler
            card.addEventListener('click', function() {
                if (isMultiSelectMode) {
                    // Handle multi-select click
                    const checkbox = card.querySelector('.document-select-checkbox');
                    if (checkbox) {
                        checkbox.click();
                    }
                } else {
                    // Handle regular click to show document details
                    currentDocumentId = doc.id;
                    displayDocumentDetails(doc);
                    
                    // Add selected class to this card and remove from others
                    document.querySelectorAll('.document-card').forEach(c => {
                        c.classList.remove('active');
                    });
                    card.classList.add('active');
                }
            });
            
            documentList.appendChild(card);
        });
        
        // Re-apply multi-select if active
        if (isMultiSelectMode) {
            toggleMultiSelectMode();
        }
        
        // Add event listeners to document card action buttons
        const editDocBtns = document.querySelectorAll('.edit-doc-btn');
        const deleteDocBtns = document.querySelectorAll('.delete-doc-btn');
        
        // Add click handlers for edit buttons
        editDocBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent triggering the card click event
                const docId = this.dataset.id;
                // Find the document and display it in detail view
                const doc = documents.find(d => d.id === parseInt(docId));
                if (doc) {
                    currentDocumentId = docId;
                    displayDocumentDetails(doc);
                    
                    // Trigger edit modal
                    if (editDocumentButton) {
                        editDocumentButton.click();
                    }
                }
            });
        });
        
        // Add click handlers for delete buttons
        deleteDocBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent triggering the card click event
                const docId = this.dataset.id;
                
                // Set up confirmation modal
                deleteType = 'document';
                deleteId = docId;
                if (deleteConfirmMessage) {
                    deleteConfirmMessage.textContent = 'Are you sure you want to delete this document? This action cannot be undone.';
                }
                
                // Show confirmation modal
                if (deleteConfirmModal) {
                    deleteConfirmModal.show();
                }
            });
        });
    }
    
    /**
     * Display document details
     */
    function displayDocumentDetails(doc) {
        if (!documentDetails) return;
        
        // Format document data
        const publicationDate = doc.publication_date 
            ? new Date(doc.publication_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : 'Not specified';
            
        // Get collection name
        let collectionName = 'None';
        if (doc.collection_id) {
            const collection = collections.find(c => c.id === doc.collection_id);
            if (collection) {
                collectionName = collection.name;
            }
        }
        
        // Format tags
        const tagsHtml = doc.tags && doc.tags.length > 0
            ? doc.tags.map(tag => `<span class="badge bg-secondary me-1">${tag}</span>`).join(' ')
            : '<span class="text-muted">No tags</span>';
            
        // Build detail HTML
        documentDetails.innerHTML = `
            <div class="document-detail-section">
                <h5 class="mb-3">${doc.title || 'Untitled Document'}</h5>
                
                <div class="mb-3">
                    <div class="d-grid gap-2">
                        <button class="btn btn-sm btn-primary view-pdf-button" data-id="${doc.id}">
                            <i class="fas fa-file-pdf me-1"></i> View PDF
                        </button>
                    </div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Authors</div>
                    <div class="detail-value">${doc.authors || 'Unknown'}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Journal</div>
                    <div class="detail-value">${doc.journal || 'Not specified'}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Publication Date</div>
                    <div class="detail-value">${publicationDate}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">DOI</div>
                    <div class="detail-value">
                        ${doc.doi 
                            ? `<a href="https://doi.org/${doc.doi}" target="_blank">${doc.doi}</a>` 
                            : 'Not available'}
                    </div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Collection</div>
                    <div class="detail-value">${collectionName}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Upload Date</div>
                    <div class="detail-value">
                        ${new Date(doc.upload_date).toLocaleDateString('en-US', 
                            { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Tags</div>
                    <div class="detail-value tags-container">
                        ${tagsHtml}
                    </div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Citation</div>
                    <div class="detail-value citation-preview">
                        ${doc.citation_apa || 'Citation not available'}
                    </div>
                </div>
            </div>
        `;
        
        // Show action buttons
        const actionButtonsElement = document.querySelector('.action-buttons');
        if (actionButtonsElement) {
            actionButtonsElement.classList.remove('d-none');
        }
    }
    
    /**
     * Update pagination controls
     */
    function updatePagination() {
        if (!pagination) return;
        
        pagination.innerHTML = '';
        
        if (totalPages <= 1) {
            return;
        }
        
        // Previous button
        const prevItem = document.createElement('li');
        prevItem.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevItem.innerHTML = `<a class="page-link" href="#" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a>`;
        prevItem.addEventListener('click', function(e) {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                loadDocuments();
            }
        });
        pagination.appendChild(prevItem);
        
        // Page numbers
        const maxPages = 5; // Maximum number of page links to show
        let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
        let endPage = Math.min(totalPages, startPage + maxPages - 1);
        
        if (endPage - startPage + 1 < maxPages) {
            startPage = Math.max(1, endPage - maxPages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageItem = document.createElement('li');
            pageItem.className = `page-item ${i === currentPage ? 'active' : ''}`;
            pageItem.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            
            pageItem.addEventListener('click', function(e) {
                e.preventDefault();
                currentPage = i;
                loadDocuments();
            });
            
            pagination.appendChild(pageItem);
        }
        
        // Next button
        const nextItem = document.createElement('li');
        nextItem.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextItem.innerHTML = `<a class="page-link" href="#" aria-label="Next"><span aria-hidden="true">&raquo;</span></a>`;
        nextItem.addEventListener('click', function(e) {
            e.preventDefault();
            if (currentPage < totalPages) {
                currentPage++;
                loadDocuments();
            }
        });
        pagination.appendChild(nextItem);
    }
    
    /**
     * Update citation preview in edit document modal
     */
    function updateCitationPreview() {
        if (!citationPreview || !editDocumentAuthors || !editDocumentTitle || 
            !editDocumentJournal || !editDocumentPublicationDate) return;
            
        const authors = editDocumentAuthors.value.trim();
        const title = editDocumentTitle.value.trim();
        const journal = editDocumentJournal.value.trim();
        const year = editDocumentPublicationDate.value 
            ? new Date(editDocumentPublicationDate.value).getFullYear() 
            : '';
            
        if (!authors && !title && !journal && !year) {
            citationPreview.textContent = 'Citation will be generated automatically after saving';
            return;
        }
        
        let citation = '';
        
        if (authors) {
            // Format author list
            const authorList = authors.split(',').map(a => a.trim());
            if (authorList.length === 1) {
                citation += authorList[0];
            } else if (authorList.length === 2) {
                citation += `${authorList[0]} & ${authorList[1]}`;
            } else {
                citation += `${authorList[0]} et al.`;
            }
        } else {
            citation += 'Unknown Author';
        }
        
        if (year) {
            citation += ` (${year})`;
        }
        
        if (title) {
            citation += `. ${title}`;
        }
        
        if (journal) {
            citation += `. ${journal}`;
        }
        
        if (editDocumentDOI && editDocumentDOI.value.trim()) {
            citation += `. https://doi.org/${editDocumentDOI.value.trim()}`;
        }
        
        citationPreview.textContent = citation;
    }
    
    // Add event listeners for citation preview updates
    if (editDocumentAuthors) {
        editDocumentAuthors.addEventListener('input', updateCitationPreview);
    }
    if (editDocumentTitle) {
        editDocumentTitle.addEventListener('input', updateCitationPreview);
    }
    if (editDocumentJournal) {
        editDocumentJournal.addEventListener('input', updateCitationPreview);
    }
    if (editDocumentPublicationDate) {
        editDocumentPublicationDate.addEventListener('input', updateCitationPreview);
    }
    if (editDocumentDOI) {
        editDocumentDOI.addEventListener('input', updateCitationPreview);
    }
}

/**
 * Initialize file upload functionality
 */
function initFileUpload() {
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.querySelector('.upload-area');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressBar = uploadProgress ? uploadProgress.querySelector('.progress-bar') : null;
    const uploadStatus = document.getElementById('uploadStatus');
    const processingQueue = document.getElementById('processingQueue');
    const queueProgress = document.getElementById('queueProgress');
    const queueInfo = document.getElementById('queueInfo');
    
    if (!uploadForm || !fileInput) return;
    
    // Drag and drop functionality
    if (uploadArea) {
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
            
            // Check file types
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                
                // Trigger upload if auto-upload enabled
                // uploadForm.submit();
            }
        });
        
        uploadArea.addEventListener('click', function() {
            fileInput.click();
        });
    }
    
    // Handle form submission
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const files = fileInput.files;
        if (files.length === 0) {
            showAlert('Please select at least one PDF file to upload', 'warning');
            return;
        }
        
        if (files.length > 50) {
            showAlert('Maximum 50 files per upload allowed', 'warning');
            return;
        }
        
        // Check file types
        for (let i = 0; i < files.length; i++) {
            if (!files[i].name.toLowerCase().endsWith('.pdf')) {
                showAlert('Only PDF files are accepted', 'warning');
                return;
            }
        }
        
        // Start upload
        uploadFiles(new FormData(uploadForm));
    });
    
    // Function to upload files
    function uploadFiles(formData) {
        // Reset status
        if (uploadStatus) {
            uploadStatus.innerHTML = '';
        }
        
        // Show progress bar
        if (uploadProgress) {
            uploadProgress.classList.remove('d-none');
        }
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        
        // Send request
        const xhr = new XMLHttpRequest();
        
        xhr.open('POST', '/upload', true);
        
        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable && progressBar) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = percentComplete + '%';
                progressBar.setAttribute('aria-valuenow', percentComplete);
            }
        });
        
        xhr.addEventListener('load', function() {
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    
                    if (response.success) {
                        // Show success message
                        if (uploadStatus) {
                            uploadStatus.innerHTML = `
                                <div class="alert alert-success">
                                    <i class="fas fa-check-circle me-2"></i>
                                    Successfully uploaded ${response.uploaded} file(s)
                                </div>
                            `;
                        }
                        
                        // Reset form
                        uploadForm.reset();
                        
                        // Show processing queue
                        if (processingQueue) {
                            processingQueue.classList.remove('d-none');
                        }
                        
                        // Start queue monitoring
                        monitorQueue();
                        
                        // Reload documents
                        if (typeof loadDocuments === 'function') {
                            loadDocuments();
                        }
                    } else {
                        throw new Error(response.error || 'Upload failed');
                    }
                } catch (error) {
                    if (uploadStatus) {
                        uploadStatus.innerHTML = `
                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-circle me-2"></i>
                                Error: ${error.message}
                            </div>
                        `;
                    }
                }
            } else {
                if (uploadStatus) {
                    uploadStatus.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle me-2"></i>
                            Error: Server returned status ${xhr.status}
                        </div>
                    `;
                }
            }
            
            // Hide progress bar
            if (uploadProgress) {
                uploadProgress.classList.add('d-none');
            }
        });
        
        xhr.addEventListener('error', function() {
            if (uploadStatus) {
                uploadStatus.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        Network error occurred during upload
                    </div>
                `;
            }
            
            // Hide progress bar
            if (uploadProgress) {
                uploadProgress.classList.add('d-none');
            }
        });
        
        xhr.send(formData);
    }
    
    // Function to monitor processing queue
    function monitorQueue() {
        if (!processingQueue || !queueProgress || !queueInfo) return;
        
        // Check queue status every 3 seconds
        const queueInterval = setInterval(function() {
            fetch('/documents/api/processing-queue')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const processed = data.completed || 0;
                        const pending = data.pending || 0;
                        const processing = data.processing || 0;
                        const total = processed + pending + processing;
                        
                        // Update progress bar
                        if (total > 0) {
                            const percentComplete = Math.round((processed / total) * 100);
                            queueProgress.style.width = percentComplete + '%';
                            queueProgress.setAttribute('aria-valuenow', percentComplete);
                            
                            queueInfo.textContent = `${processed} / ${total} processed`;
                            
                            // If all processed, stop monitoring and hide after a delay
                            if (pending === 0 && processing === 0) {
                                clearInterval(queueInterval);
                                
                                // Hide queue progress after 5 seconds
                                setTimeout(function() {
                                    processingQueue.classList.add('d-none');
                                }, 5000);
                                
                                // Reload documents one final time
                                if (typeof loadDocuments === 'function') {
                                    loadDocuments();
                                }
                            }
                        } else {
                            // No documents in queue
                            processingQueue.classList.add('d-none');
                            clearInterval(queueInterval);
                        }
                    } else {
                        console.error('Failed to get queue status:', data.error);
                    }
                })
                .catch(error => {
                    console.error('Error checking queue status:', error);
                });
        }, 3000);
    }
}

/**
 * Show an alert message
 */
function showAlert(message, type = 'info') {
    // Create alert container if it doesn't exist
    let alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'alertContainer';
        alertContainer.className = 'alert-container';
        document.body.appendChild(alertContainer);
    }
    
    // Create alert element
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type} alert-dismissible fade show`;
    alertElement.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to container
    alertContainer.appendChild(alertElement);
    
    // Auto-dismiss after 5 seconds
    setTimeout(function() {
        if (alertElement.parentNode) {
            bootstrap.Alert.getOrCreateInstance(alertElement).close();
        }
    }, 5000);
}

/**
 * Debounce function to limit how often a function is called
 */
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            func.apply(context, args);
        }, wait);
    };
}
