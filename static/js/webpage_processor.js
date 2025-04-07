/**
 * Webpage Processor JavaScript
 * 
 * This file contains the client-side functionality for the webpage browser feature.
 */

// Global state for the webpage browser
const webpageBrowserState = {
    currentPage: 1,
    perPage: 25,
    totalPages: 0,
    searchTerm: '',
    collectionFilter: '',
    selectedWebpageId: null,
    collections: [],
    selectedWebpageIds: [] // For batch operations
};

/**
 * Initialize the webpage browser
 */
function initWebpageBrowser() {
    // Load collections for dropdowns
    loadCollections();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial webpages
    loadWebpages();
}

/**
 * Set up all event listeners for the webpage browser
 */
function setupEventListeners() {
    // Add webpage form submission
    document.getElementById('addWebpageForm').addEventListener('submit', handleAddWebpage);
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', debounce(() => {
        webpageBrowserState.searchTerm = searchInput.value;
        webpageBrowserState.currentPage = 1;
        loadWebpages();
    }, 500));
    
    // Clear search button
    document.getElementById('clearSearchBtn').addEventListener('click', () => {
        searchInput.value = '';
        webpageBrowserState.searchTerm = '';
        loadWebpages();
    });
    
    // Collection filter change
    document.getElementById('collectionFilter').addEventListener('change', (e) => {
        webpageBrowserState.collectionFilter = e.target.value;
        webpageBrowserState.currentPage = 1;
        loadWebpages();
    });
    
    // New collection button
    document.getElementById('newCollectionBtn').addEventListener('click', () => {
        // Populate parent collection dropdown in the modal
        populateParentCollectionDropdown();
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('newCollectionModal'));
        modal.show();
    });
    
    // Create collection button
    document.getElementById('createCollectionBtn').addEventListener('click', createNewCollection);
    
    // Per page select change
    document.getElementById('perPageSelect').addEventListener('change', (e) => {
        webpageBrowserState.perPage = parseInt(e.target.value);
        webpageBrowserState.currentPage = 1;
        loadWebpages();
    });
    
    // Refresh button
    document.getElementById('refreshWebpagesBtn').addEventListener('click', loadWebpages);
    
    // Delete webpage button
    document.getElementById('deleteWebpageBtn').addEventListener('click', () => {
        if (webpageBrowserState.selectedWebpageId) {
            showDeleteConfirmation(webpageBrowserState.selectedWebpageId);
        }
    });
    
    // Confirm delete button
    document.getElementById('confirmDeleteButton').addEventListener('click', () => {
        if (webpageBrowserState.selectedWebpageId) {
            deleteWebpage(webpageBrowserState.selectedWebpageId);
        }
    });
    
    // Reprocess webpage button
    document.getElementById('reprocessWebpageBtn').addEventListener('click', () => {
        if (webpageBrowserState.selectedWebpageId) {
            reprocessWebpage(webpageBrowserState.selectedWebpageId);
        }
    });
    
    // Open webpage button
    document.getElementById('openWebpageBtn').addEventListener('click', () => {
        const selectedWebpage = webpageBrowserState.webpages.find(
            wp => wp.id === webpageBrowserState.selectedWebpageId
        );
        
        if (selectedWebpage && selectedWebpage.url) {
            window.open(selectedWebpage.url, '_blank');
        }
    });

    // Batch move button
    document.getElementById('batchMoveBtn').addEventListener('click', () => {
        if (webpageBrowserState.selectedWebpageIds.length === 0) {
            showError('Please select at least one webpage to move');
            return;
        }
        
        // Populate collections dropdown
        const batchMoveCollectionSelect = document.getElementById('batchMoveCollectionSelect');
        batchMoveCollectionSelect.innerHTML = '<option value="">None</option>';
        
        webpageBrowserState.collections.forEach(collection => {
            const option = document.createElement('option');
            option.value = collection.id;
            option.textContent = collection.name;
            batchMoveCollectionSelect.appendChild(option);
        });
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('batchMoveModal'));
        modal.show();
    });
    
    // Confirm batch move button
    document.getElementById('confirmBatchMoveBtn').addEventListener('click', () => {
        const collectionId = document.getElementById('batchMoveCollectionSelect').value;
        
        if (webpageBrowserState.selectedWebpageIds.length === 0) {
            showError('Please select at least one webpage to move');
            return;
        }
        
        // Call API to move webpages
        batchMoveWebpages(webpageBrowserState.selectedWebpageIds, collectionId);
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('batchMoveModal')).hide();
    });
}

/**
 * Load collections for collection dropdowns
 */
async function loadCollections() {
    try {
        const response = await fetch('/api/collections');
        const data = await response.json();
        
        if (data.success) {
            webpageBrowserState.collections = data.collections;
            
            // Populate collection selects
            const collectionSelect = document.getElementById('collectionSelect');
            const collectionFilter = document.getElementById('collectionFilter');
            
            // Clear existing options except the first one
            collectionSelect.innerHTML = '<option value="">None</option>';
            collectionFilter.innerHTML = '<option value="">All Collections</option>';
            
            // Add collection options
            data.collections.forEach(collection => {
                // Add to select dropdown
                const selectOption = document.createElement('option');
                selectOption.value = collection.id;
                selectOption.textContent = collection.name;
                collectionSelect.appendChild(selectOption);
                
                // Add to filter dropdown
                const filterOption = document.createElement('option');
                filterOption.value = collection.id;
                filterOption.textContent = collection.name;
                collectionFilter.appendChild(filterOption);
            });
        }
    } catch (error) {
        console.error('Error loading collections:', error);
        showError('Failed to load collections. Please try again.');
    }
}

/**
 * Load webpages with current filters and pagination
 */
async function loadWebpages() {
    try {
        // Show loading state
        document.getElementById('webpageList').innerHTML = `
            <li class="list-group-item text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3">Loading webpages...</p>
            </li>
        `;
        
        // Build query params
        const params = new URLSearchParams({
            page: webpageBrowserState.currentPage,
            per_page: webpageBrowserState.perPage
        });
        
        if (webpageBrowserState.searchTerm) {
            params.append('search', webpageBrowserState.searchTerm);
        }
        
        if (webpageBrowserState.collectionFilter) {
            params.append('collection_id', webpageBrowserState.collectionFilter);
        }
        
        // Fetch webpages
        const response = await fetch(`/api/webpages?${params.toString()}`);
        const data = await response.json();
        
        // Update state
        webpageBrowserState.webpages = data.webpages;
        webpageBrowserState.totalPages = data.pages;
        
        // Render webpages
        renderWebpages(data);
        
        // Render pagination
        renderPagination(data.page, data.pages);
        
        // Update count
        document.getElementById('webpageCount').textContent = data.total;
        
        // If we had a selected webpage, check if it's still in the results
        if (webpageBrowserState.selectedWebpageId) {
            const stillExists = data.webpages.some(wp => wp.id === webpageBrowserState.selectedWebpageId);
            if (!stillExists) {
                clearWebpageDetails();
            } else {
                // Refresh the details view
                const selectedWebpage = data.webpages.find(wp => wp.id === webpageBrowserState.selectedWebpageId);
                if (selectedWebpage) {
                    showWebpageDetails(selectedWebpage);
                }
            }
        }
    } catch (error) {
        console.error('Error loading webpages:', error);
        document.getElementById('webpageList').innerHTML = `
            <li class="list-group-item text-center text-danger py-5">
                <i class="fas fa-exclamation-circle fa-2x mb-3"></i>
                <p>Failed to load webpages. Please try again.</p>
                <button class="btn btn-sm btn-outline-primary mt-2" onclick="loadWebpages()">
                    <i class="fas fa-sync-alt me-1"></i>Retry
                </button>
            </li>
        `;
    }
}

/**
 * Render pagination
 */
function renderPagination(currentPage, totalPages) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    
    if (totalPages <= 1) {
        return;
    }
    
    // Generate pagination links
    // ... (pagination implementation)
}

/**
 * Render webpages list
 */
function renderWebpages(data) {
    const webpageList = document.getElementById('webpageList');
    
    if (!data.webpages || data.webpages.length === 0) {
        webpageList.innerHTML = `
            <li class="list-group-item text-center text-muted py-5">
                <i class="fas fa-globe fa-2x mb-3"></i>
                <p>No webpages found</p>
            </li>
        `;
        return;
    }
    
    webpageList.innerHTML = '';
    
    data.webpages.forEach(webpage => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item webpage-list-item';
        if (webpage.id === webpageBrowserState.selectedWebpageId) {
            listItem.classList.add('active');
        }
        
        // Get status icon and badge
        let statusBadge = '';
        
        if (!webpage.processed) {
            const status = webpage.processing_status?.status || 'unknown';
            
            switch (status) {
                case 'pending':
                    statusBadge = '<span class="badge bg-warning">Pending</span>';
                    break;
                case 'processing':
                    statusBadge = '<span class="badge bg-info">Processing</span>';
                    break;
                case 'completed':
                    statusBadge = '<span class="badge bg-success">Completed</span>';
                    break;
                case 'failed':
                    statusBadge = '<span class="badge bg-danger">Failed</span>';
                    break;
                default:
                    statusBadge = '<span class="badge bg-secondary">Unknown</span>';
            }
        }
        
        // Format date
        const dateStr = webpage.crawl_date ? new Date(webpage.crawl_date).toLocaleString() : 'Unknown';
        
        // Collection name
        const collectionName = webpage.collection_name ? 
            `<span class="badge bg-secondary collection-badge">${escapeHtml(webpage.collection_name)}</span>` : '';
        
        // Check if item is selected in batch
        const isChecked = webpageBrowserState.selectedWebpageIds.includes(webpage.id) ? 'checked' : '';
        
        listItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div class="d-flex">
                    <div class="me-2 align-self-center">
                        <input type="checkbox" class="webpage-checkbox form-check-input" 
                               data-webpage-id="${webpage.id}" ${isChecked}>
                    </div>
                    <div>
                        <h6 class="mb-1">${escapeHtml(webpage.title || 'Untitled Webpage')}</h6>
                        <p class="mb-1 text-muted small text-truncate">${escapeHtml(webpage.url)}</p>
                        <div class="small mt-1 d-flex justify-content-between">
                            <span>Added: ${dateStr}</span>
                            ${collectionName}
                        </div>
                    </div>
                </div>
                <div>
                    ${statusBadge}
                </div>
            </div>
        `;
        
        // Add click event - only to main content, not the checkbox
        listItem.querySelector('.d-flex > div:nth-child(2)').addEventListener('click', (e) => {
            // Remove active class from all items
            document.querySelectorAll('.webpage-list-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Add active class to clicked item
            listItem.classList.add('active');
            
            // Show details
            webpageBrowserState.selectedWebpageId = webpage.id;
            showWebpageDetails(webpage);
        });
        
        // Add checkbox click event
        listItem.querySelector('.webpage-checkbox').addEventListener('change', (e) => {
            e.stopPropagation(); // Prevent triggering the list item click
            
            const webpageId = parseInt(e.target.getAttribute('data-webpage-id'));
            
            if (e.target.checked) {
                // Add to selected IDs if not already present
                if (!webpageBrowserState.selectedWebpageIds.includes(webpageId)) {
                    webpageBrowserState.selectedWebpageIds.push(webpageId);
                }
            } else {
                // Remove from selected IDs
                webpageBrowserState.selectedWebpageIds = webpageBrowserState.selectedWebpageIds.filter(id => id !== webpageId);
            }
            
            // Update batch action button state
            updateBatchActionButtonState();
        });
        
        webpageList.appendChild(listItem);
    });
}

/**
 * Update the state of batch action buttons based on selection
 */
function updateBatchActionButtonState() {
    const batchActionsBtn = document.getElementById('batchActionsBtn');
    
    if (webpageBrowserState.selectedWebpageIds.length > 0) {
        batchActionsBtn.classList.remove('btn-outline-secondary');
        batchActionsBtn.classList.add('btn-primary');
        batchActionsBtn.innerHTML = `<i class="fas fa-cog me-1"></i>Batch Actions (${webpageBrowserState.selectedWebpageIds.length})`;
    } else {
        batchActionsBtn.classList.remove('btn-primary');
        batchActionsBtn.classList.add('btn-outline-secondary');
        batchActionsBtn.innerHTML = `<i class="fas fa-cog me-1"></i>Batch Actions`;
    }
}
async function batchMoveWebpages(webpageIds, collectionId) {
    try {
        // Show loading message
        showToast('Moving webpages...', 'info');
        
        // Make API request
        const response = await fetch('/api/webpages/batch-move', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                webpage_ids: webpageIds,
                collection_id: collectionId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Successfully moved ${webpageIds.length} webpages`, 'success');
            
            // Clear selected IDs
            webpageBrowserState.selectedWebpageIds = [];
            
            // Reload webpages to update UI
            loadWebpages();
        } else {
            showError(data.message || 'Failed to move webpages');
        }
    } catch (error) {
        console.error('Error moving webpages:', error);

/**
 * Show webpage details in the sidebar
 */
function showWebpageDetails(webpage) {
    const detailsContainer = document.getElementById('webpageDetails');
    detailsContainer.classList.remove('d-none');
    document.getElementById('noSelectionMessage').classList.add('d-none');
    
    // Set title and URL
    document.getElementById('webpageTitle').textContent = webpage.title || 'Untitled Webpage';
    document.getElementById('webpageUrl').textContent = webpage.url;
    document.getElementById('webpageUrl').href = webpage.url;
    
    // Set crawl date
    document.getElementById('webpageCrawlDate').textContent = 
        webpage.crawl_date ? new Date(webpage.crawl_date).toLocaleString() : 'Unknown';
    
    // Set processing status
    let statusText = 'Processed';
    let statusClass = 'success';
    
    if (!webpage.processed) {
        const status = webpage.processing_status?.status || 'unknown';
        
        switch (status) {
            case 'pending':
                statusText = 'Pending';
                statusClass = 'warning';
                break;
            case 'processing':
                statusText = 'Processing';
                statusClass = 'info';
                break;
            case 'completed':
                statusText = 'Processed';
                statusClass = 'success';
                break;
            case 'failed':
                statusText = 'Failed';
                statusClass = 'danger';
                break;
            default:
                statusText = 'Unknown';
                statusClass = 'secondary';
        }
    }
    
    document.getElementById('webpageStatus').innerHTML = 
        `<span class="badge bg-${statusClass}">${statusText}</span>`;
    
    // Set collection
    const collectionNameElement = document.getElementById('webpageCollection');
    
    if (webpage.collection_name) {
        collectionNameElement.innerHTML = `
            <span class="badge bg-secondary collection-badge d-inline-flex align-items-center">
                ${escapeHtml(webpage.collection_name)}
                <button class="btn btn-sm text-white ms-2 p-0" 
                        onclick="showChangeCollectionModal(${webpage.id})">
                    <i class="fas fa-pen-to-square"></i>
                </button>
            </span>
        `;
    } else {
        collectionNameElement.innerHTML = `
            <span class="fst-italic text-muted">None</span>
            <button class="btn btn-sm btn-outline-secondary ms-2 py-0 px-1" 
                    onclick="showChangeCollectionModal(${webpage.id})">
                <i class="fas fa-plus"></i> Add
            </button>
        `;
    }
    
    // Set content preview
    const contentElement = document.getElementById('webpageContent');
    if (webpage.content) {
        // Limit to first ~500 characters with ellipsis
        const previewText = webpage.content.length > 500 
            ? webpage.content.slice(0, 500) + '...' 
            : webpage.content;
            
        contentElement.innerHTML = `
            <div class="content-preview p-3 bg-light rounded">
                ${escapeHtml(previewText)}
            </div>
        `;
    } else {
        contentElement.innerHTML = '<p class="text-muted fst-italic">No content available</p>';
    }
    
    // Update action buttons
    document.getElementById('deleteWebpageBtn').disabled = false;
    document.getElementById('reprocessWebpageBtn').disabled = false;
    document.getElementById('openWebpageBtn').disabled = false;
    
    // Store selected webpage ID
    webpageBrowserState.selectedWebpageId = webpage.id;
}

/**
 * Clear the webpage details sidebar
 */
function clearWebpageDetails() {
    const detailsContainer = document.getElementById('webpageDetails');
    detailsContainer.classList.add('d-none');
    document.getElementById('noSelectionMessage').classList.remove('d-none');
    
    // Clear fields
    document.getElementById('webpageTitle').textContent = '';
    document.getElementById('webpageUrl').textContent = '';
    document.getElementById('webpageUrl').href = '#';
    document.getElementById('webpageCrawlDate').textContent = '';
    document.getElementById('webpageStatus').innerHTML = '';
    document.getElementById('webpageCollection').innerHTML = '';
    document.getElementById('webpageContent').innerHTML = '';
    
    // Disable action buttons
    document.getElementById('deleteWebpageBtn').disabled = true;
    document.getElementById('reprocessWebpageBtn').disabled = true;
    document.getElementById('openWebpageBtn').disabled = true;
    
    // Clear selected webpage ID
    webpageBrowserState.selectedWebpageId = null;
}

/**
 * Show delete confirmation modal
 */
function showDeleteConfirmation(webpageId) {
    const confirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    confirmModal.show();
}

/**
 * Show change collection modal for a webpage
 */
function showChangeCollectionModal(webpageId) {
    // Populate collections dropdown
    const changeCollectionSelect = document.getElementById('changeCollectionSelect');
    changeCollectionSelect.innerHTML = '<option value="">None</option>';
    
    webpageBrowserState.collections.forEach(collection => {
        const option = document.createElement('option');
        option.value = collection.id;
        option.textContent = collection.name;
        changeCollectionSelect.appendChild(option);
    });
    
    // Set current collection if any
    const selectedWebpage = webpageBrowserState.webpages.find(wp => wp.id === webpageId);
    if (selectedWebpage && selectedWebpage.collection_id) {
        changeCollectionSelect.value = selectedWebpage.collection_id;
    }
    
    // Set up confirm button event
    const confirmBtn = document.getElementById('confirmChangeCollectionBtn');
    confirmBtn.onclick = async () => {
        const collectionId = changeCollectionSelect.value;
        
        try {
            const response = await fetch(`/api/webpages/${webpageId}/collection`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ collection_id: collectionId || null })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Collection updated successfully', 'success');
                
                // Close modal
                bootstrap.Modal.getInstance(document.getElementById('changeCollectionModal')).hide();
                
                // Reload webpages to reflect changes
                loadWebpages();
            } else {
                showToast('Failed to update collection: ' + (data.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Error updating collection:', error);
            showToast('Error updating collection', 'error');
        }
    };
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('changeCollectionModal'));
    modal.show();
}

/**
 * Batch move webpages to a different collection
 */
async function batchMoveWebpages(webpageIds, collectionId) {
    try {
        const response = await fetch('/api/webpages/batch/move', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                webpage_ids: webpageIds,
                collection_id: collectionId || null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`${webpageIds.length} webpages moved successfully`, 'success');
            
            // Clear selected webpages
            webpageBrowserState.selectedWebpageIds = [];
            
            // Reload webpages to reflect changes
            loadWebpages();
            
            // Update batch action button state
            updateBatchActionButtonState();
        } else {
            showToast('Failed to move webpages: ' + (data.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error moving webpages:', error);
        showToast('Error moving webpages', 'error');
    }
}

/**
 * Handle adding a new webpage from the form
 */
function handleAddWebpage(e) {
    e.preventDefault();
    
    const urlInput = document.getElementById('webpageUrl');
    const url = urlInput.value.trim();
    
    if (!url) {
        showToast('Please enter a valid URL', 'error');
        return;
    }
    
    // Get collection ID if selected
    const collectionId = document.getElementById('collectionSelect').value;
    
    // Show loading state in button
    const submitBtn = document.querySelector('#addWebpageForm button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...';
    
    // Add webpage API call
    fetch('/api/webpages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            url: url,
            collection_id: collectionId || null
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('Webpage added successfully', 'success');
            urlInput.value = '';
            loadWebpages(); // Reload webpages list
        } else {
            showToast('Failed to add webpage: ' + (data.message || 'Unknown error'), 'error');
        }
    })
    .catch(error => {
        console.error('Error adding webpage:', error);
        showToast('Error adding webpage', 'error');
    })
    .finally(() => {
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    });
}

/**
 * Delete a webpage
 */
async function deleteWebpage(webpageId) {
    try {
        const response = await fetch(`/api/webpages/${webpageId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal')).hide();
            
            showToast('Webpage deleted successfully', 'success');
            
            // Clear details panel
            clearWebpageDetails();
            
            // Reload webpages
            loadWebpages();
        } else {
            showToast('Failed to delete webpage: ' + (data.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error deleting webpage:', error);
        showToast('Error deleting webpage', 'error');
    }
}

/**
 * Reprocess a webpage
 */
async function reprocessWebpage(webpageId) {
    try {
        const response = await fetch(`/api/webpages/${webpageId}/reprocess`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Webpage reprocessing started', 'success');
            
            // Reload webpages
            loadWebpages();
        } else {
            showToast('Failed to reprocess webpage: ' + (data.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error reprocessing webpage:', error);
        showToast('Error reprocessing webpage', 'error');
    }
}

/**
 * Create a new collection
 */
async function createNewCollection() {
    const nameInput = document.getElementById('newCollectionName');
    const name = nameInput.value.trim();
    
    if (!name) {
        showToast('Please enter a collection name', 'error');
        return;
    }
    
    // Get parent collection ID if selected
    const parentId = document.getElementById('parentCollectionSelect').value;
    
    // Show loading state in button
    const submitBtn = document.getElementById('createCollectionBtn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating...';
    
    try {
        const response = await fetch('/api/collections', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                name: name,
                parent_id: parentId || null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Collection created successfully', 'success');
            nameInput.value = '';
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('newCollectionModal')).hide();
            
            // Reload collections
            loadCollections();
        } else {
            showToast('Failed to create collection: ' + (data.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error creating collection:', error);
        showToast('Error creating collection', 'error');
    } finally {
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

/**
 * Populate parent collection dropdown
 */
function populateParentCollectionDropdown() {
    const parentSelect = document.getElementById('parentCollectionSelect');
    parentSelect.innerHTML = '<option value="">None</option>';
    
    webpageBrowserState.collections.forEach(collection => {
        const option = document.createElement('option');
        option.value = collection.id;
        option.textContent = collection.name;
        parentSelect.appendChild(option);
    });
}

/**
 * Show a toast message
 */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${escapeHtml(message)}
            </div>
            <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 5000 });
    bsToast.show();
    
    // Remove from DOM after hidden
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Debounce function to limit rate of function calls
 */
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}
