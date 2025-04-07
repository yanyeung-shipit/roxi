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
    webpages: [],
    selectedWebpageIds: [] // For batch operations
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
    // New collection button
    document.getElementById("newCollectionBtn").addEventListener("click", () => {
        // Populate parent collection dropdown in the modal
        populateParentCollectionDropdown();
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById("newCollectionModal"));
        modal.show();
    });
    
    // Create collection button
    document.getElementById("createCollectionBtn").addEventListener("click", createNewCollection);
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
        
        if (selectedWebpage && selectedWebpage.url) {
            window.open(selectedWebpage.url, '_blank');
        }
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
 * Render webpages list
 */
function renderPagination(currentPage, totalPages) {
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
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    
    if (totalPages <= 1) {
        return;
    }
    
    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Previous">
        <span aria-hidden="true">&laquo;</span>
    </a>`;
    
    if (currentPage > 1) {
        prevLi.addEventListener('click', (e) => {
            e.preventDefault();
            webpageBrowserState.currentPage--;
            loadWebpages();
        });
    }
    
    pagination.appendChild(prevLi);
    
    // Calculate range of pages to show
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    // Adjust if we're at the end
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }
    
    // Page links
    for (let i = startPage; i <= endPage; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
        pageLi.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        
        pageLi.addEventListener('click', (e) => {
            e.preventDefault();
            webpageBrowserState.currentPage = i;
            loadWebpages();
        });
        
        pagination.appendChild(pageLi);
    }
    
    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Next">
        <span aria-hidden="true">&raquo;</span>
    </a>`;
    
    if (currentPage < totalPages) {
        nextLi.addEventListener('click', (e) => {
            e.preventDefault();
            webpageBrowserState.currentPage++;
            loadWebpages();
        });
    }
    
    pagination.appendChild(nextLi);
}

/**
 * Show webpage details in the details panel
 */
function showWebpageDetails(webpage) {
    const detailsDiv = document.getElementById('webpageDetails');
    const actionsDiv = document.getElementById('webpageActions');
    
    // Show actions
    actionsDiv.classList.remove('d-none');
    
    // Format dates
    const crawlDate = webpage.crawl_date ? new Date(webpage.crawl_date).toLocaleString() : 'Unknown';
    const lastUpdated = webpage.last_updated ? new Date(webpage.last_updated).toLocaleString() : 'Not yet processed';
    
    // Get status
    let statusBadge = '';
    let statusDetails = '';
    
    if (webpage.processed) {
        statusBadge = '<span class="badge bg-success">Processed</span>';
    } else {
        const status = webpage.processing_status?.status || 'unknown';
        
        switch (status) {
            case 'pending':
                statusBadge = '<span class="badge bg-warning">Pending</span>';
                statusDetails = '<p class="mb-0 text-warning"><i class="fas fa-clock me-2"></i>Waiting to be processed</p>';
                break;
    const collectionName = webpage.collection_name ? 
        `<div class="d-flex align-items-center"><span class="badge bg-secondary collection-badge me-2">${escapeHtml(webpage.collection_name)}</span><button class="btn btn-sm btn-link p-0" id="changeCollectionBtn" title="Change Collection"><i class="fas fa-edit"></i></button></div>` : 
        `<div class="d-flex align-items-center"><span class="text-muted me-2">None</span><button class="btn btn-sm btn-link p-0" id="changeCollectionBtn" title="Change Collection"><i class="fas fa-edit"></i></button></div>`;
                break;
            case 'completed':
                statusBadge = '<span class="badge bg-success">Completed</span>';
                break;
            case 'failed':
                statusBadge = '<span class="badge bg-danger">Failed</span>';
                const errorMsg = webpage.processing_status?.error || 'Unknown error';
                statusDetails = `
                    <div class="alert alert-danger mt-3">
                        <h6 class="alert-heading">Processing Error</h6>
                        <p class="mb-0">${escapeHtml(errorMsg)}</p>
                    </div>
                `;
                break;
            default:
                statusBadge = '<span class="badge bg-secondary">Unknown</span>';
        }
    }
    
    // Collection info
    const collectionInfo = webpage.collection_name ? 
        `<li class="list-group-item"><strong>Collection:</strong> ${escapeHtml(webpage.collection_name)}</li>` : 
        '<li class="list-group-item"><strong>Collection:</strong> <span class="text-muted">None</span></li>';
    
    detailsDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-start p-3 border-bottom">
            <div>
                <h5 class="mb-1">${escapeHtml(webpage.title || 'Untitled Webpage')}</h5>
                <p class="mb-0 text-break">
                    <a href="${escapeHtml(webpage.url)}" target="_blank">${escapeHtml(webpage.url)}</a>
                </p>
            </div>
            <div>
                ${statusBadge}
            </div>
                <div class="mt-2">
                    <small class="text-muted">Collection:</small>
                    ${collectionName}
                </div>
        </div>
        ${statusDetails ? `<div class="p-3 border-bottom">${statusDetails}</div>` : ''}
        <ul class="list-group list-group-flush">
            ${collectionInfo}
            <li class="list-group-item"><strong>Added on:</strong> ${crawlDate}</li>
            <li class="list-group-item"><strong>Last updated:</strong> ${lastUpdated}</li>
            <li class="list-group-item"><strong>Processing status:</strong> ${statusBadge}</li>
        </ul>
    `;
    
    // Disable reprocess button if already processing
    const reprocessBtn = document.getElementById('reprocessWebpageBtn');
    if (webpage.processing_status?.status === 'processing' || 
        webpage.processing_status?.status === 'pending') {
        reprocessBtn.disabled = true;
        reprocessBtn.title = "Cannot reprocess while webpage is being processed";
    } else {
        reprocessBtn.disabled = false;
        reprocessBtn.title = "Reprocess this webpage";
    }
}

/**
 * Clear the webpage details panel
 */
function clearWebpageDetails() {
    const detailsDiv = document.getElementById('webpageDetails');
    const actionsDiv = document.getElementById('webpageActions');
    
    // Hide actions
    actionsDiv.classList.add('d-none');
    // Set up collection change button event listener
    const changeCollectionBtn = document.getElementById("changeCollectionBtn");
    if (changeCollectionBtn) {
        changeCollectionBtn.addEventListener("click", () => {
            showChangeCollectionModal(webpage.id);
        });
    }
    
    // Clear details
    detailsDiv.innerHTML = `
        <div class="text-center text-muted py-5">
            <i class="fas fa-info-circle fa-2x mb-3"></i>
            <p>Select a webpage to view details</p>
        </div>
    `;
    
    // Clear selected ID
    webpageBrowserState.selectedWebpageId = null;
}

/**
 * Handle adding a new webpage
 */
async function handleAddWebpage(e) {
    e.preventDefault();
    
    const form = e.target;
    const urlInput = form.querySelector('#webpageUrl');
    const collectionSelect = form.querySelector('#collectionSelect');
    
    // Validate URL
    const url = urlInput.value.trim();
    if (!url) {
        showError('Please enter a URL');
        return;
    }
    
    // Disable form and show loading
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';
    
    try {
        // Prepare data
        const data = {
            url: url,
            collection_id: collectionSelect.value || null
        };
        
        // Send request
        const response = await fetch('/api/webpages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Clear form
            form.reset();
            
            // Refresh webpages
            loadWebpages();
            
            // Show success message
            showSuccessToast('Webpage added successfully and queued for processing');
        } else {
            // Show error
            showError(result.error || 'Failed to add webpage');
        }
    } catch (error) {
        console.error('Error adding webpage:', error);
        showError('Failed to add webpage. Please try again.');
    } finally {
        // Re-enable form
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    }
}

/**
 * Delete a webpage
 */
async function deleteWebpage(webpageId) {
    try {
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal'));
        modal.hide();
        
        // Send delete request
        const response = await fetch(`/api/webpage/${webpageId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Clear selected webpage if it was the deleted one
            if (webpageBrowserState.selectedWebpageId === webpageId) {
                clearWebpageDetails();
            }
            
            // Refresh webpages
            loadWebpages();
            
            // Show success message
            showSuccessToast('Webpage deleted successfully');
        } else {
            // Show error
            showError(result.error || 'Failed to delete webpage');
        }
    } catch (error) {
        console.error('Error deleting webpage:', error);
        showError('Failed to delete webpage. Please try again.');
    }
}

/**
 * Reprocess a webpage
 */
async function reprocessWebpage(webpageId) {
    try {
        // Disable button
        const reprocessBtn = document.getElementById('reprocessWebpageBtn');
        reprocessBtn.disabled = true;
        
        // Send reprocess request
        const response = await fetch(`/api/webpage/${webpageId}/reprocess`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Refresh webpages
            loadWebpages();
            
            // Show success message
            showSuccessToast('Webpage queued for reprocessing');
        } else {
            // Show error
            showError(result.error || 'Failed to reprocess webpage');
            
            // Re-enable button
            reprocessBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error reprocessing webpage:', error);
        showError('Failed to reprocess webpage. Please try again.');
        
        // Re-enable button
        const reprocessBtn = document.getElementById('reprocessWebpageBtn');
        reprocessBtn.disabled = false;
    }
}

/**
 * Show delete confirmation modal
 */
function showDeleteConfirmation(webpageId) {
    const webpage = webpageBrowserState.webpages.find(wp => wp.id === webpageId);
    
    if (!webpage) {
        return;
    }
    
    const message = document.getElementById('deleteConfirmMessage');
    message.textContent = `Are you sure you want to delete the webpage "${webpage.title || 'Untitled Webpage'}"?`;
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    modal.show();
}

/**
 * Show error in the error modal
 */
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('errorModal'));
    modal.show();
}

/**
 * Show success toast message
 */
function showSuccessToast(message) {
    // Create toast if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastId = 'toast-' + Date.now();
    const toastEl = document.createElement('div');
    toastEl.className = 'toast bg-success text-white';
    toastEl.id = toastId;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    
    toastEl.innerHTML = `
        <div class="toast-header bg-success text-white">
            <strong class="me-auto">Success</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${escapeHtml(message)}
        </div>
    `;
    
    toastContainer.appendChild(toastEl);
    
    // Show toast
    const toast = new bootstrap.Toast(toastEl, {
        autohide: true,
        delay: 5000
    });
    toast.show();
    
    // Remove after hidden
    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

/**
 * Debounce function to limit function calls
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
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        return '';
    }
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
/**
 * Populate the parent collection dropdown in the new collection modal
 */
function populateParentCollectionDropdown() {
    const parentCollection = document.getElementById('parentCollection');
    
    // Clear existing options except the first one
    parentCollection.innerHTML = '<option value="">None</option>';
    
    // Add collection options
    webpageBrowserState.collections.forEach(collection => {
        const option = document.createElement('option');
        option.value = collection.id;
        option.textContent = collection.name;
        parentCollection.appendChild(option);
    });
}

/**
 * Create a new collection
 */
async function createNewCollection() {
    const name = document.getElementById('collectionName').value.trim();
    const description = document.getElementById('collectionDescription').value.trim();
    const parentId = document.getElementById('parentCollection').value;
    
    if (!name) {
        showError('Collection name is required');
        return;
    }
    
    try {
        // Show loading state
        const button = document.getElementById('createCollectionBtn');
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Creating...';
        button.disabled = true;
        
        // Send API request
        const response = await fetch('/api/collections', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                description: description,
                parent_id: parentId || null
            })
        });
        
        const data = await response.json();
        
        // Reset button state
        button.innerHTML = originalText;
        button.disabled = false;
        
        if (data.success) {
            // Hide modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('newCollectionModal'));
            modal.hide();
            
            // Reset form
            document.getElementById('newCollectionForm').reset();
            
            // Reload collections
            loadCollections();
            
            // Show success message
            showSuccess(data.message || 'Collection created successfully');
        } else {
            showError(data.error || 'Failed to create collection');
        }
    } catch (error) {
        console.error('Error creating collection:', error);
        showError('Failed to create collection. Please try again.');
        
        // Reset button state
        const button = document.getElementById('createCollectionBtn');
        button.innerHTML = 'Create Collection';
        button.disabled = false;
    }
}

/**
 * Show a success message
 */
function showSuccess(message) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        // Create toast container if it doesn't exist
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'position-fixed bottom-0 end-0 p-3 toast-container';
        document.body.appendChild(container);
    }
    
    const toastId = `toast-${Date.now()}`;
    const toastHtml = `
        <div class="toast" id="${toastId}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header bg-success text-white">
                <i class="fas fa-check-circle me-2"></i>
                <strong class="me-auto">Success</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    document.getElementById('toastContainer').insertAdjacentHTML('beforeend', toastHtml);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
    toast.show();
    
    // Remove toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

/**
 * Show an error message
 */
function showError(message) {
    // Check if we have a modal error element
    const errorModal = document.getElementById('errorModal');
    if (errorModal) {
        document.getElementById('errorMessage').textContent = message;
        const modal = new bootstrap.Modal(errorModal);
        modal.show();
    } else {
        // Fallback to console error if no error modal is available
        console.error(message);
        alert(message);
    }
}

/**
 * Utility function to escape HTML
 */
function escapeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

/**
 * Utility function to debounce function calls
 */
function debounce(func, delay) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// Initialize webpage browser when document is loaded
document.addEventListener('DOMContentLoaded', initWebpageBrowser);
/**
 * Update a webpage's collection
 */
async function updateWebpageCollection(webpageId, collectionId) {
    try {
        // Send API request
        const response = await fetch(`/api/webpage/${webpageId}/collection`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                collection_id: collectionId || null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Reload webpages to reflect the change
            loadWebpages();
            showSuccess(data.message || 'Webpage collection updated successfully');
        } else {
            showError(data.error || 'Failed to update webpage collection');
        }
    } catch (error) {
        console.error('Error updating webpage collection:', error);
        showError('Failed to update webpage collection. Please try again.');
    }
}

/**
 * Show the change collection modal
 */
function showChangeCollectionModal(webpageId) {
    // Populate collection dropdown
    const changeCollectionSelect = document.getElementById('changeCollectionSelect');
    
    // Clear existing options except the first one
    changeCollectionSelect.innerHTML = '<option value="">None</option>';
    
    // Add collection options
    webpageBrowserState.collections.forEach(collection => {
        const option = document.createElement('option');
        option.value = collection.id;
        option.textContent = collection.name;
        changeCollectionSelect.appendChild(option);
    });
    
    // Set current collection if any
    const webpage = webpageBrowserState.webpages.find(wp => wp.id === webpageId);
    if (webpage && webpage.collection_id) {
        changeCollectionSelect.value = webpage.collection_id;
    }
    
    // Set up confirmation button click handler
    const confirmBtn = document.getElementById('confirmChangeCollectionBtn');
    
    // Remove existing event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    // Add new event listener
    newConfirmBtn.addEventListener('click', () => {
        const collectionId = changeCollectionSelect.value;
        updateWebpageCollection(webpageId, collectionId);
        
        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('changeCollectionModal'));
        modal.hide();
    });
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('changeCollectionModal'));
    modal.show();
}

/**
 * Move multiple webpages to a collection
 */
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
        showError('Failed to move webpages. Please try again.');
    }
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${type}`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                    data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // Add to container
    toastContainer.appendChild(toastEl);
    
    // Initialize and show toast
    const toast = new bootstrap.Toast(toastEl, {
        autohide: true,
        delay: 3000
    });
    toast.show();
    
    // Remove toast after it's hidden
    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}
