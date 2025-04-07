/**
 * Document Browser Module
 * 
 * This module handles all document browser interactions including:
 * - Loading and displaying documents
 * - Filtering and searching
 * - Document metadata editing
 * - Collection management
 * - Batch operations
 */

document.addEventListener('DOMContentLoaded', function() {
    const documentBrowser = document.querySelector('.document-browser');
    if (!documentBrowser) return;
    
    // Get DOM elements
    const documentList = document.querySelector('.document-list');
    const documentDetails = document.querySelector('.document-details');
    const loadingIndicator = document.querySelector('.document-loading');
    const searchInput = document.getElementById('documentSearch');
    const tagsFilter = document.getElementById('tagsFilter');
    const collectionFilter = document.getElementById('collectionFilter');
    const pagination = document.querySelector('.pagination');
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
    const deleteConfirmMessage = document.getElementById('deleteConfirmMessage');
    const editDocumentButton = document.getElementById('editDocumentButton');
    const editDocumentModal = new bootstrap.Modal(document.getElementById('editDocumentModal'));
    const editDocumentForm = document.getElementById('editDocumentForm');
    const editDocumentTitle = document.getElementById('editDocumentTitle');
    const editDocumentAuthors = document.getElementById('editDocumentAuthors');
    const editDocumentJournal = document.getElementById('editDocumentJournal');
    const editDocumentDoi = document.getElementById('editDocumentDoi');
    const editDocumentDate = document.getElementById('editDocumentDate');
    const editDocumentCollection = document.getElementById('editDocumentCollection');
    const saveDocumentButton = document.getElementById('saveDocumentButton');
    const deleteDocumentButton = document.getElementById('deleteDocumentButton');
    const tagsContainer = document.getElementById('tagsContainer');
    const addTagButton = document.getElementById('addTagButton');
    const tagInput = document.getElementById('tagInput');
    const viewModeButtons = document.querySelectorAll('.view-mode-btn');
    const batchActionbar = document.querySelector('.batch-actionbar');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const batchMoveBtn = document.getElementById('batchMoveBtn');
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    const moveToCollectionModal = new bootstrap.Modal(document.getElementById('moveToCollectionModal'));
    const moveToCollectionSelect = document.getElementById('moveToCollectionSelect');
    const confirmMoveBtn = document.getElementById('confirmMoveBtn');
    const manageCollectionsButton = document.getElementById('manageCollectionsButton');
    const manageCollectionsModal = new bootstrap.Modal(document.getElementById('manageCollectionsModal'));
    const newCollectionButton = document.getElementById('newCollectionButton');
    const collectionModal = new bootstrap.Modal(document.getElementById('collectionModal'));
    const collectionId = document.getElementById('collectionId');
    const collectionName = document.getElementById('collectionName');
    const collectionDescription = document.getElementById('collectionDescription');
    const collectionParent = document.getElementById('collectionParent');
    const saveCollectionButton = document.getElementById('saveCollectionButton');
    const collectionModalTitle = document.getElementById('collectionModalTitle');
    const deleteCollectionButton = document.getElementById('deleteCollectionButton');
    const uploadCollection = document.getElementById('uploadCollection');

    // State variables
    let documents = [];
    let collections = [];
    let currentPage = 1;
    let totalPages = 1;
    let itemsPerPage = 20;
    let currentSearch = '';
    let currentTags = [];
    let currentCollection = '';
    let currentDocumentId = null;
    let deleteType = null;
    let deleteId = null;
    let isMultiSelectMode = false;
    let selectedDocuments = new Set();
    let activeCollection = '';
    
    /**
     * Initialize the document browser
     */
    function initDocumentBrowser() {
        // Initial load
        loadCollections();
        loadDocuments();
        
        // Set up event listeners
        setupEventListeners();
    }
    
    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // Search input
        if (searchInput) {
            searchInput.addEventListener('input', debounce(function() {
                currentSearch = this.value.trim();
                currentPage = 1;
                loadDocuments();
            }, 300));
        }
        
        // Tags filter
        if (tagsFilter) {
            tagsFilter.addEventListener('change', function() {
                const options = tagsFilter.selectedOptions;
                currentTags = [];
                for (let i = 0; i < options.length; i++) {
                    currentTags.push(options[i].value);
                }
                currentPage = 1;
                loadDocuments();
            });
            
            // Load tag options
            fetch('/documents/api/tags')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const tags = data.tags.sort();
                        tagsFilter.innerHTML = '<option value="">All Tags</option>';
                        tags.forEach(tag => {
                            const option = document.createElement('option');
                            option.value = tag;
                            option.textContent = tag;
                            tagsFilter.appendChild(option);
                        });
                    }
                })
                .catch(error => {
                    console.error('Error loading tags:', error);
                });
        }
        
        // Collection filter
        if (collectionFilter) {
            collectionFilter.addEventListener('change', function() {
                currentCollection = this.value;
                activeCollection = this.value;
                currentPage = 1;
                loadDocuments();
            });
        }
        
        // Edit document button
        if (editDocumentButton) {
            editDocumentButton.addEventListener('click', function() {
                // Get the current document
                const documentId = parseInt(currentDocumentId);
                if (isNaN(documentId)) return;
                
                const document = documents.find(doc => doc.id === documentId);
                if (!document) return;
                
                // Populate the edit form
                if (editDocumentTitle) editDocumentTitle.value = document.title || '';
                if (editDocumentAuthors) editDocumentAuthors.value = document.authors || '';
                if (editDocumentJournal) editDocumentJournal.value = document.journal || '';
                if (editDocumentDoi) editDocumentDoi.value = document.doi || '';
                if (editDocumentDate) {
                    if (document.publication_date) {
                        // Format the date as YYYY-MM-DD for the input
                        const date = new Date(document.publication_date);
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        editDocumentDate.value = `${year}-${month}-${day}`;
                    } else {
                        editDocumentDate.value = '';
                    }
                }
                
                // Set the collection dropdown
                if (editDocumentCollection) {
                    if (document.collection_id) {
                        editDocumentCollection.value = document.collection_id;
                    } else {
                        editDocumentCollection.value = '';
                    }
                }
                
                // Populate tags
                if (tagsContainer) {
                    tagsContainer.innerHTML = '';
                    if (document.tags && document.tags.length > 0) {
                        document.tags.forEach(tag => addTagToContainer(tag));
                    }
                }
                
                // Show the modal
                editDocumentModal.show();
            });
        }
        
        // Save document button
        if (saveDocumentButton && editDocumentForm) {
            saveDocumentButton.addEventListener('click', function() {
                const documentId = parseInt(currentDocumentId);
                if (isNaN(documentId)) return;
                
                // Get tags from the container
                const tagElements = tagsContainer.querySelectorAll('.tag-badge');
                const tags = [];
                tagElements.forEach(el => {
                    tags.push(el.getAttribute('data-tag'));
                });
                
                // Prepare the data to send
                const data = {
                    title: editDocumentTitle.value,
                    authors: editDocumentAuthors.value,
                    journal: editDocumentJournal.value,
                    doi: editDocumentDoi.value,
                    publication_date: editDocumentDate.value || null,
                    tags: tags,
                    collection_id: editDocumentCollection.value || null
                };
                
                // Send update request
                fetch(`/documents/api/documents/${documentId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Hide the modal
                        editDocumentModal.hide();
                        
                        // Show success message
                        showAlert('Document updated successfully', 'success');
                        
                        // Refresh document details and list
                        fetch(`/documents/api/documents/${documentId}`)
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    displayDocumentDetails(data.document);
                                    // Also update the document in the documents array
                                    const index = documents.findIndex(doc => doc.id === data.document.id);
                                    if (index !== -1) {
                                        documents[index] = data.document;
                                        renderDocumentList(documents);
                                    }
                                }
                            })
                            .catch(error => {
                                console.error('Error fetching updated document:', error);
                            });
                    } else {
                        showAlert(`Failed to update document: ${data.error}`, 'danger');
                    }
                })
                .catch(error => {
                    console.error('Error updating document:', error);
                    showAlert('An error occurred while updating the document', 'danger');
                });
            });
        }
        
        // Delete document button
        if (deleteDocumentButton) {
            deleteDocumentButton.addEventListener('click', function() {
                const documentId = parseInt(currentDocumentId);
                if (isNaN(documentId)) return;
                
                // Set up confirmation modal
                deleteType = 'document';
                deleteId = documentId;
                if (deleteConfirmMessage) {
                    deleteConfirmMessage.textContent = 'Are you sure you want to delete this document? This action cannot be undone.';
                }
                
                // Hide edit modal and show confirmation modal
                editDocumentModal.hide();
                if (deleteConfirmModal) {
                    deleteConfirmModal.show();
                }
            });
        }
        
        // Handle confirmation of delete
        if (deleteConfirmBtn) {
            deleteConfirmBtn.addEventListener('click', function() {
                // Check what type of deletion we're confirming
                if (deleteType === 'document') {
                    deleteDocument(deleteId);
                } else if (deleteType === 'collection') {
                    deleteCollectionItem(deleteId);
                } else if (deleteType === 'batch') {
                    batchDeleteDocuments();
                }
                
                // Hide the confirmation modal
                if (deleteConfirmModal) {
                    deleteConfirmModal.hide();
                }
            });
        }
        
        // Add tag button
        if (addTagButton && tagInput) {
            addTagButton.addEventListener('click', function() {
                const tagValue = tagInput.value.trim();
                if (tagValue) {
                    addTagToContainer(tagValue);
                    tagInput.value = '';
                }
            });
            
            tagInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addTagButton.click();
                }
            });
        }
        
        // View mode toggle
        if (viewModeButtons.length > 0) {
            viewModeButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    // Remove active class from all buttons
                    viewModeButtons.forEach(b => b.classList.remove('active'));
                    
                    // Add active class to clicked button
                    this.classList.add('active');
                    
                    // Get view mode
                    const viewMode = this.getAttribute('data-view');
                    
                    // Update list view
                    if (documentList) {
                        if (viewMode === 'grid') {
                            documentList.classList.add('grid-view');
                            documentList.classList.remove('list-view');
                        } else {
                            documentList.classList.add('list-view');
                            documentList.classList.remove('grid-view');
                        }
                    }
                });
            });
        }
        
        // Select all button
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', function() {
                const checkboxes = document.querySelectorAll('.document-select-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = true;
                    const docId = parseInt(checkbox.getAttribute('data-id'));
                    if (!isNaN(docId)) {
                        selectedDocuments.add(docId);
                    }
                });
                
                updateBatchActionButtonState();
            });
        }
        
        // Deselect all button
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', function() {
                const checkboxes = document.querySelectorAll('.document-select-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                selectedDocuments.clear();
                updateBatchActionButtonState();
            });
        }
        
        // Batch move button
        if (batchMoveBtn) {
            batchMoveBtn.addEventListener('click', function() {
                if (selectedDocuments.size === 0) return;
                
                // Populate the collection dropdown
                if (moveToCollectionSelect) {
                    moveToCollectionSelect.innerHTML = '<option value="">None (Root)</option>';
                    collections.forEach(collection => {
                        const option = document.createElement('option');
                        option.value = collection.id;
                        option.textContent = collection.name;
                        moveToCollectionSelect.appendChild(option);
                    });
                }
                
                // Show the modal
                moveToCollectionModal.show();
            });
        }
        
        // Confirm move button
        if (confirmMoveBtn) {
            confirmMoveBtn.addEventListener('click', function() {
                if (selectedDocuments.size === 0) return;
                
                const collectionId = moveToCollectionSelect.value;
                const documentIds = Array.from(selectedDocuments);
                
                // Call API to move documents
                fetch('/documents/api/documents/batch/move', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        document_ids: documentIds,
                        collection_id: collectionId || null
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Hide the modal
                        moveToCollectionModal.hide();
                        
                        // Exit multi-select mode
                        toggleMultiSelectMode();
                        
                        // Show success message
                        showAlert(`${documentIds.length} documents moved successfully`, 'success');
                        
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
                
                // Prepare data
                const data = {
                    name: collectionName.value,
                    description: collectionDescription ? collectionDescription.value : '',
                    parent_id: collectionParent && collectionParent.value ? collectionParent.value : null
                };
                
                // Send request
                fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Hide the modal
                        collectionModal.hide();
                        
                        // Show success message
                        const action = isEdit ? 'updated' : 'created';
                        showAlert(`Collection ${action} successfully`, 'success');
                        
                        // Reload collections
                        loadCollections();
                        
                        // Reload collections table if manage collections modal is open
                        if (manageCollectionsModal._isShown) {
                            loadCollectionsTable();
                        }
                    } else {
                        throw new Error(data.error || 'Failed to save collection');
                    }
                })
                .catch(error => {
                    showAlert('Error: ' + error.message, 'danger');
                });
            });
        }
        
        // Handle collection delete button
        if (deleteCollectionButton) {
            deleteCollectionButton.addEventListener('click', function() {
                if (!collectionId || !collectionId.value) return;
                
                // Set up confirmation modal
                deleteType = 'collection';
                deleteId = collectionId.value;
                if (deleteConfirmMessage) {
                    deleteConfirmMessage.textContent = 'Are you sure you want to delete this collection? Documents will be moved to the root level.';
                }
                
                // Hide collection modal and show confirmation modal
                collectionModal.hide();
                if (deleteConfirmModal) {
                    deleteConfirmModal.show();
                }
            });
        }
        
        // Batch delete button
        if (batchDeleteBtn) {
            batchDeleteBtn.addEventListener('click', function() {
                if (selectedDocuments.size === 0) return;
                
                // Set up confirmation modal
                deleteType = 'batch';
                if (deleteConfirmMessage) {
                    deleteConfirmMessage.textContent = `Are you sure you want to delete ${selectedDocuments.size} document(s)? This action cannot be undone.`;
                }
                
                // Show confirmation modal
                if (deleteConfirmModal) {
                    deleteConfirmModal.show();
                }
            });
        }
        
        // Toggle multi-select mode button
        const multiSelectBtn = document.getElementById('toggleMultiSelectBtn');
        if (multiSelectBtn) {
            multiSelectBtn.addEventListener('click', toggleMultiSelectMode);
        }
    }
    
    /**
     * Add a tag to the tag container
     */
    function addTagToContainer(tag) {
        if (!tagsContainer) return;
        
        // Check if tag already exists
        const existingTag = tagsContainer.querySelector(`.tag-badge[data-tag="${tag}"]`);
        if (existingTag) return;
        
        // Create tag element
        const tagEl = document.createElement('span');
        tagEl.className = 'badge bg-secondary me-1 mb-1 tag-badge';
        tagEl.setAttribute('data-tag', tag);
        tagEl.innerHTML = `
            ${tag}
            <button type="button" class="btn-close btn-close-white ms-1" aria-label="Remove tag"></button>
        `;
        
        // Add remove handler
        const closeBtn = tagEl.querySelector('.btn-close');
        closeBtn.addEventListener('click', function() {
            tagEl.remove();
        });
        
        tagsContainer.appendChild(tagEl);
    }
    
    /**
     * Toggle multi-select mode for documents
     */
    function toggleMultiSelectMode() {
        isMultiSelectMode = !isMultiSelectMode;
        
        // Toggle button text
        const multiSelectBtn = document.getElementById('toggleMultiSelectBtn');
        if (multiSelectBtn) {
            if (isMultiSelectMode) {
                multiSelectBtn.innerHTML = '<i class="fas fa-times me-1"></i> Cancel Selection';
                multiSelectBtn.classList.remove('btn-secondary');
                multiSelectBtn.classList.add('btn-danger');
            } else {
                multiSelectBtn.innerHTML = '<i class="fas fa-check-square me-1"></i> Select Documents';
                multiSelectBtn.classList.remove('btn-danger');
                multiSelectBtn.classList.add('btn-secondary');
                
                // Clear selections when exiting multi-select mode
                selectedDocuments.clear();
            }
        }
        
        // Show/hide batch action bar
        if (batchActionbar) {
            if (isMultiSelectMode) {
                batchActionbar.classList.remove('d-none');
            } else {
                batchActionbar.classList.add('d-none');
            }
        }
        
        // Add checkboxes to document cards
        if (documentList) {
            const cards = documentList.querySelectorAll('.document-card');
            cards.forEach(card => {
                const docId = card.getAttribute('data-id');
                
                if (isMultiSelectMode) {
                    // Add checkbox
                    const checkboxDiv = document.createElement('div');
                    checkboxDiv.className = 'document-select-checkbox-container';
                    checkboxDiv.innerHTML = `
                        <input type="checkbox" class="document-select-checkbox" data-id="${docId}">
                    `;
                    card.insertBefore(checkboxDiv, card.firstChild);
                    
                    // Add checkbox event listener
                    const checkbox = checkboxDiv.querySelector('input');
                    checkbox.addEventListener('change', function() {
                        const docId = parseInt(this.getAttribute('data-id'));
                        if (this.checked) {
                            selectedDocuments.add(docId);
                        } else {
                            selectedDocuments.delete(docId);
                        }
                        
                        updateBatchActionButtonState();
                    });
                } else {
                    // Remove checkbox
                    const checkboxContainer = card.querySelector('.document-select-checkbox-container');
                    if (checkboxContainer) {
                        checkboxContainer.remove();
                    }
                }
            });
        }
        
        // Update batch action button state
        updateBatchActionButtonState();
    }
    
    /**
     * Update the state of batch action buttons based on selection
     */
    function updateBatchActionButtonState() {
        if (batchMoveBtn) {
            batchMoveBtn.disabled = selectedDocuments.size === 0;
        }
        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = selectedDocuments.size === 0;
        }
        
        // Update counter
        const selectionCounter = document.getElementById('selectionCounter');
        if (selectionCounter) {
            selectionCounter.textContent = selectedDocuments.size;
        }
    }
    
    /**
     * Delete a collection by ID
     */
    function deleteCollectionItem(collectionId) {
        fetch(`/documents/api/collections/${collectionId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success message
                showAlert('Collection deleted successfully', 'success');
                
                // Reload collections
                loadCollections();
                
                // Reload collections table if manage collections modal is open
                if (manageCollectionsModal._isShown) {
                    loadCollectionsTable();
                }
            } else {
                throw new Error(data.error || 'Failed to delete collection');
            }
        })
        .catch(error => {
            showAlert('Error: ' + error.message, 'danger');
        });
    }
    
    /**
     * Delete a document by ID
     */
    function deleteDocument(documentId) {
        fetch(`/documents/api/documents/${documentId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success message
                showAlert('Document deleted successfully', 'success');
                
                // Clear document details
                if (documentDetails) {
                    documentDetails.innerHTML = '<div class="text-center text-muted my-5">Select a document to view details</div>';
                }
                
                // Hide action buttons
                const actionButtonsElement = document.querySelector('.action-buttons');
                if (actionButtonsElement) {
                    actionButtonsElement.classList.add('d-none');
                }
                
                // Reload documents
                loadDocuments();
            } else {
                throw new Error(data.error || 'Failed to delete document');
            }
        })
        .catch(error => {
            showAlert('Error: ' + error.message, 'danger');
        });
    }
    
    /**
     * Batch delete multiple documents
     */
    function batchDeleteDocuments() {
        if (selectedDocuments.size === 0) return;
        
        const documentIds = Array.from(selectedDocuments);
        
        // Call API to delete documents
        fetch('/documents/api/documents/batch/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                document_ids: documentIds
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Exit multi-select mode
                toggleMultiSelectMode();
                
                // Show success message
                showAlert(`${documentIds.length} documents deleted successfully`, 'success');
                
                // Clear document details if the current document was deleted
                if (currentDocumentId && documentIds.includes(parseInt(currentDocumentId))) {
                    if (documentDetails) {
                        documentDetails.innerHTML = '<div class="text-center text-muted my-5">Select a document to view details</div>';
                    }
                    
                    // Hide action buttons
                    const actionButtonsElement = document.querySelector('.action-buttons');
                    if (actionButtonsElement) {
                        actionButtonsElement.classList.add('d-none');
                    }
                }
                
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
    
    /**
     * Load collections from API
     */
    function loadCollections() {
        fetch('/documents/api/collections')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    collections = data.collections;
                    
                    // Sort collections by depth and name
                    // Helper function to get collection depth
                    function getCollectionDepth(collection) {
                        if (!collection.parent_id) return 0;
                        const parent = collections.find(p => p.id === collection.parent_id);
                        return parent ? getCollectionDepth(parent) + 1 : 1;
                    }
                    
                    const sortedCollections = [...collections].sort((a, b) => {
                        const depthA = getCollectionDepth(a);
                        const depthB = getCollectionDepth(b);
                        
                        // Sort by depth first
                        if (depthA !== depthB) {
                            return depthA - depthB;
                        }
                        
                        // Then sort root collections first
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
        if (loadingIndicator) {
            loadingIndicator.classList.remove('d-none');
        }
        
        // Hide document details
        if (documentDetails) {
            documentDetails.innerHTML = '<div class="text-center text-muted my-5">Select a document to view details</div>';
        }
        
        // Hide action buttons
        const actionButtonsElement = document.querySelector('.action-buttons');
        if (actionButtonsElement) {
            actionButtonsElement.classList.add('d-none');
        }
        
        // Build query parameters
        const params = new URLSearchParams({
            page: currentPage,
            per_page: itemsPerPage
        });
        
        if (currentSearch) {
            params.append('search', currentSearch);
        }
        
        if (currentTags.length > 0) {
            currentTags.forEach(tag => {
                params.append('tags', tag);
            });
        }
        
        if (currentCollection) {
            params.append('collection_id', currentCollection);
        }
        
        // Fetch documents
        fetch(`/documents/api/documents?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    documents = data.documents;
                    totalPages = data.total_pages;
                    
                    // Update pagination
                    updatePagination();
                    
                    // Render the document list
                    renderDocumentList(documents);
                    
                    // Show "no results" message if no documents found
                    if (documents.length === 0) {
                        documentList.innerHTML = `
                            <div class="no-documents text-center p-4">
                                <i class="fas fa-search fa-3x mb-3 text-muted"></i>
                                <p class="text-muted">No documents found matching your criteria.</p>
                                <button class="btn btn-sm btn-secondary" onclick="window.location.reload()">
                                    <i class="fas fa-sync me-1"></i> Reset Filters
                                </button>
                            </div>
                        `;
                    }
                } else {
                    throw new Error(data.error || 'Failed to load documents');
                }
            })
            .catch(error => {
                console.error('Error loading documents:', error);
                documentList.innerHTML = `
                    <div class="alert alert-danger m-3">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Error loading documents: ${error.message}
                    </div>
                `;
            })
            .finally(() => {
                // Hide loading indicator
                if (loadingIndicator) {
                    loadingIndicator.classList.add('d-none');
                }
            });
    }
    
    /**
     * Render the document list
     */
    function renderDocumentList(documents) {
        if (!documentList) return;
        
        documentList.innerHTML = '';
        
        documents.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'document-card';
            card.setAttribute('data-id', doc.id);
            
            // Format date
            const formattedDate = doc.publication_date 
                ? new Date(doc.publication_date).getFullYear()
                : 'Date unknown';
                
            // Format tags (up to 3)
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
                <div class="document-title">${doc.title || 'Untitled Document'}</div>
                <div class="document-authors">${doc.authors || 'Unknown authors'}</div>
                <div class="document-date">${formattedDate}</div>
                ${tagsHtml}
                ${collectionHtml}
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
                            ? `<div>
                                <a href="https://doi.org/${doc.doi}" target="_blank">${doc.doi}</a>
                                <button id="updateFromDoiBtn" class="btn btn-sm btn-secondary ms-2" data-id="${doc.id}" title="Update metadata from DOI">
                                    <i class="fas fa-sync-alt"></i> Update Metadata
                                </button>
                               </div>` 
                            : `<div class="doi-input-group d-flex align-items-center">
                                <input type="text" id="manualDoiInput" class="form-control form-control-sm" placeholder="Enter DOI (e.g., 10.1136/ard.2023.1234)">
                                <button id="updateFromManualDoiBtn" class="btn btn-sm btn-secondary ms-2" data-id="${doc.id}" title="Fetch metadata from DOI">
                                    <i class="fas fa-search"></i> Fetch
                                </button>
                               </div>`}
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
     * Show alert message
     */
    function showAlert(message, type = 'info') {
        const alertContainer = document.querySelector('.alert-container');
        if (!alertContainer) return;
    
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

    /**
     * Handle document metadata updates from DOI
     */
    function setupDoiUpdateListener() {
        // Use event delegation to handle clicks on the Update Metadata button
        if (documentDetails) {
            documentDetails.addEventListener('click', function(event) {
                // Check if the clicked element is the update from DOI button
                if (event.target.closest('#updateFromDoiBtn')) {
                    const button = event.target.closest('#updateFromDoiBtn');
                    const documentId = button.getAttribute('data-id');
                    
                    // Disable button and show loading state
                    button.disabled = true;
                    const originalText = button.innerHTML;
                    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
                    
                    // Call API to update metadata from DOI
                    fetch(`/documents/api/documents/${documentId}/update-from-doi`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        button.disabled = false;
                        button.innerHTML = originalText;
                        
                        if (data.success) {
                            // Show success message
                            showAlert('Document metadata updated successfully from DOI', 'success');
                            
                            // Update document details with the new data
                            const documentId = parseInt(currentDocumentId);
                            if (!isNaN(documentId)) {
                                fetch(`/documents/api/documents/${documentId}`)
                                    .then(response => response.json())
                                    .then(data => {
                                        if (data.success) {
                                            displayDocumentDetails(data.document);
                                            // Also update the document in the documents array
                                            const index = documents.findIndex(doc => doc.id === data.document.id);
                                            if (index !== -1) {
                                                documents[index] = data.document;
                                                renderDocumentList(documents);
                                            }
                                        }
                                    })
                                    .catch(error => {
                                        console.error('Error fetching updated document:', error);
                                    });
                            }
                        } else {
                            // Show error message
                            showAlert(`Failed to update metadata: ${data.error}`, 'danger');
                        }
                    })
                    .catch(error => {
                        button.disabled = false;
                        button.innerHTML = originalText;
                        console.error('Error updating metadata from DOI:', error);
                        showAlert('An error occurred while updating metadata', 'danger');
                    });
                }
                
                // Check if the clicked element is the update from manual DOI button
                if (event.target.closest('#updateFromManualDoiBtn')) {
                    const button = event.target.closest('#updateFromManualDoiBtn');
                    const documentId = button.getAttribute('data-id');
                    const doiInput = document.getElementById('manualDoiInput');
                    
                    if (!doiInput || !doiInput.value.trim()) {
                        showAlert('Please enter a DOI', 'warning');
                        return;
                    }
                    
                    const manualDoi = doiInput.value.trim();
                    
                    // Disable button and show loading state
                    button.disabled = true;
                    const originalText = button.innerHTML;
                    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
                    
                    // Call API to update document with the manually entered DOI
                    fetch(`/documents/api/documents/${documentId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ doi: manualDoi })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            // Now call the update-from-doi endpoint to fetch metadata
                            fetch(`/documents/api/documents/${documentId}/update-from-doi`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            })
                            .then(response => response.json())
                            .then(updateData => {
                                button.disabled = false;
                                button.innerHTML = originalText;
                                
                                if (updateData.success) {
                                    // Show success message
                                    showAlert('Document metadata updated successfully from DOI', 'success');
                                    
                                    // Update document details with the new data
                                    const documentId = parseInt(currentDocumentId);
                                    if (!isNaN(documentId)) {
                                        fetch(`/documents/api/documents/${documentId}`)
                                            .then(response => response.json())
                                            .then(data => {
                                                if (data.success) {
                                                    displayDocumentDetails(data.document);
                                                    // Also update the document in the documents array
                                                    const index = documents.findIndex(doc => doc.id === data.document.id);
                                                    if (index !== -1) {
                                                        documents[index] = data.document;
                                                        renderDocumentList(documents);
                                                    }
                                                }
                                            })
                                            .catch(error => {
                                                console.error('Error fetching updated document:', error);
                                            });
                                    }
                                } else {
                                    // Show error message
                                    showAlert(`Failed to update metadata: ${updateData.error}`, 'danger');
                                }
                            })
                            .catch(error => {
                                button.disabled = false;
                                button.innerHTML = originalText;
                                console.error('Error updating metadata from DOI:', error);
                                showAlert('An error occurred while updating metadata from DOI', 'danger');
                            });
                        } else {
                            button.disabled = false;
                            button.innerHTML = originalText;
                            showAlert(`Failed to update DOI: ${data.error}`, 'danger');
                        }
                    })
                    .catch(error => {
                        button.disabled = false;
                        button.innerHTML = originalText;
                        console.error('Error updating DOI:', error);
                        showAlert('An error occurred while updating the DOI', 'danger');
                    });
                }
            });
        }
    }
    
    // Set up document handlers
    setupDoiUpdateListener();
    
    // Event delegation for View PDF buttons
    if (documentDetails) {
        documentDetails.addEventListener('click', function(event) {
            const viewPdfButton = event.target.closest('.view-pdf-button');
            if (viewPdfButton) {
                const documentId = viewPdfButton.getAttribute('data-id');
                window.open(`/documents/api/documents/${documentId}/pdf`, '_blank');
            }
        });
    }
    
    // Initialize
    initDocumentBrowser();
});
