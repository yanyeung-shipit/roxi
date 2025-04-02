document.addEventListener('DOMContentLoaded', function() {
    // Initialize the monitoring dashboard
    initMonitoringDashboard();
});

/**
 * Initialize the monitoring dashboard
 */
function initMonitoringDashboard() {
    // Charts
    let cpuChart = null;
    let memoryChart = null;
    let chunksChart = null;
    
    // System stats elements
    const totalDocumentsElement = document.getElementById('total-documents');
    const processedDocumentsElement = document.getElementById('processed-documents');
    const pendingDocumentsElement = document.getElementById('pending-documents');
    const queuePendingElement = document.getElementById('queue-pending');
    const queueProcessingElement = document.getElementById('queue-processing');
    const queueCompletedElement = document.getElementById('queue-completed');
    const queueFailedElement = document.getElementById('queue-failed');
    
    // CPU/Memory charts
    const cpuChartElement = document.getElementById('cpu-chart');
    const memoryChartElement = document.getElementById('memory-chart');
    
    // Chunks chart
    const chunksChartElement = document.getElementById('chunks-chart');
    
    // Processing queue table
    const queueTableBody = document.getElementById('queue-table-body');
    
    // Check if we're on the monitoring page
    if (!cpuChartElement || !memoryChartElement || !chunksChartElement) {
        return;
    }
    
    // Initialize charts
    initCharts();
    
    // Initial data load
    loadSystemStats();
    loadMetricsHistory();
    loadProcessingQueue();
    
    // Set up auto-refresh
    const refreshInterval = 10000; // 10 seconds
    setInterval(() => {
        loadSystemStats();
        loadMetricsHistory();
        loadProcessingQueue();
    }, refreshInterval);
    
    /**
     * Initialize the charts
     */
    function initCharts() {
        // CPU usage chart
        cpuChart = new Chart(cpuChartElement, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'CPU Usage (%)',
                    data: [],
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'CPU Usage (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    }
                }
            }
        });
        
        // Memory usage chart
        memoryChart = new Chart(memoryChartElement, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Memory Usage (%)',
                    data: [],
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Memory Usage (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    }
                }
            }
        });
        
        // Chunks processed/pending chart
        chunksChart = new Chart(chunksChartElement, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Chunks Processed',
                        data: [],
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 2,
                        tension: 0.2
                    },
                    {
                        label: 'Chunks Pending',
                        data: [],
                        backgroundColor: 'rgba(255, 159, 64, 0.2)',
                        borderColor: 'rgba(255, 159, 64, 1)',
                        borderWidth: 2,
                        tension: 0.2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Chunks'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Load current system statistics
     */
    function loadSystemStats() {
        fetch('/monitoring/stats')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error loading system stats:', data.error);
                    return;
                }
                
                // Update document stats
                if (totalDocumentsElement) totalDocumentsElement.textContent = data.documents.total;
                if (processedDocumentsElement) processedDocumentsElement.textContent = data.documents.processed;
                if (pendingDocumentsElement) pendingDocumentsElement.textContent = data.documents.pending;
                
                // Update queue stats
                if (queuePendingElement) queuePendingElement.textContent = data.queue.pending;
                if (queueProcessingElement) queueProcessingElement.textContent = data.queue.processing;
                if (queueCompletedElement) queueCompletedElement.textContent = data.queue.completed;
                if (queueFailedElement) queueFailedElement.textContent = data.queue.failed;
                
                // Update progress bars
                updateProgressBars(data);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }
    
    /**
     * Load metrics history for charts
     */
    function loadMetricsHistory() {
        fetch('/monitoring/history')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error loading metrics history:', data.error);
                    return;
                }
                
                updateCharts(data.history);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }
    
    /**
     * Load processing queue data
     */
    function loadProcessingQueue() {
        if (!queueTableBody) return;
        
        fetch('/monitoring/queue')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error loading processing queue:', data.error);
                    return;
                }
                
                updateQueueTable(data.queue);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }
    
    /**
     * Update the charts with new data
     */
    function updateCharts(history) {
        if (!history || history.length === 0) return;
        
        // Format labels (time)
        const labels = history.map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleTimeString();
        });
        
        // Get data for each chart
        const cpuData = history.map(item => item.cpu_usage);
        const memoryData = history.map(item => item.memory_usage);
        const chunksProcessedData = history.map(item => item.chunks_processed);
        const chunksPendingData = history.map(item => item.chunks_pending);
        
        // Update CPU chart
        cpuChart.data.labels = labels;
        cpuChart.data.datasets[0].data = cpuData;
        cpuChart.update();
        
        // Update memory chart
        memoryChart.data.labels = labels;
        memoryChart.data.datasets[0].data = memoryData;
        memoryChart.update();
        
        // Update chunks chart
        chunksChart.data.labels = labels;
        chunksChart.data.datasets[0].data = chunksProcessedData;
        chunksChart.data.datasets[1].data = chunksPendingData;
        chunksChart.update();
    }
    
    /**
     * Update the processing queue table
     */
    function updateQueueTable(queue) {
        if (!queueTableBody) return;
        
        // Clear the table
        queueTableBody.innerHTML = '';
        
        if (!queue || queue.length === 0) {
            queueTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No documents in the processing queue</td></tr>';
            return;
        }
        
        // Sort queue entries by status and time
        queue.sort((a, b) => {
            // First by status priority
            const statusPriority = {
                'processing': 1,
                'pending': 2,
                'completed': 3,
                'failed': 4
            };
            
            const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
            if (priorityDiff !== 0) return priorityDiff;
            
            // Then by timestamp
            return new Date(b.queued_at) - new Date(a.queued_at);
        });
        
        // Add queue entries to the table
        queue.forEach(entry => {
            const tr = document.createElement('tr');
            
            // Status class
            let statusClass = '';
            switch (entry.status) {
                case 'pending': statusClass = 'bg-warning text-dark'; break;
                case 'processing': statusClass = 'bg-info text-white'; break;
                case 'completed': statusClass = 'bg-success text-white'; break;
                case 'failed': statusClass = 'bg-danger text-white'; break;
            }
            
            // Format timestamps
            const queuedAt = new Date(entry.queued_at).toLocaleString();
            const startedAt = entry.started_at ? new Date(entry.started_at).toLocaleString() : '-';
            const completedAt = entry.completed_at ? new Date(entry.completed_at).toLocaleString() : '-';
            
            tr.innerHTML = `
                <td>${entry.document_id}</td>
                <td>${entry.document_title}</td>
                <td><span class="badge ${statusClass}">${entry.status}</span></td>
                <td class="text-nowrap">
                    Queued: ${queuedAt}<br>
                    Started: ${startedAt}<br>
                    ${entry.completed_at ? `Completed: ${completedAt}` : ''}
                </td>
                <td>${entry.error || '-'}</td>
            `;
            
            queueTableBody.appendChild(tr);
        });
    }
    
    /**
     * Update progress bars with current data
     */
    function updateProgressBars(data) {
        // Document processing progress
        const docProgressBar = document.getElementById('document-progress');
        if (docProgressBar && data.documents.total > 0) {
            const processedPercentage = Math.round((data.documents.processed / data.documents.total) * 100);
            docProgressBar.style.width = `${processedPercentage}%`;
            docProgressBar.setAttribute('aria-valuenow', processedPercentage);
            docProgressBar.textContent = `${processedPercentage}%`;
        }
        
        // Queue progress
        const queueTotal = data.queue.pending + data.queue.processing + data.queue.completed + data.queue.failed;
        
        // Pending documents progress
        const pendingProgressBar = document.getElementById('pending-progress');
        if (pendingProgressBar && queueTotal > 0) {
            const pendingPercentage = Math.round((data.queue.pending / queueTotal) * 100);
            pendingProgressBar.style.width = `${pendingPercentage}%`;
            pendingProgressBar.setAttribute('aria-valuenow', pendingPercentage);
        }
        
        // Processing documents progress
        const processingProgressBar = document.getElementById('processing-progress');
        if (processingProgressBar && queueTotal > 0) {
            const processingPercentage = Math.round((data.queue.processing / queueTotal) * 100);
            processingProgressBar.style.width = `${processingPercentage}%`;
            processingProgressBar.setAttribute('aria-valuenow', processingPercentage);
        }
        
        // Completed documents progress
        const completedProgressBar = document.getElementById('completed-progress');
        if (completedProgressBar && queueTotal > 0) {
            const completedPercentage = Math.round((data.queue.completed / queueTotal) * 100);
            completedProgressBar.style.width = `${completedPercentage}%`;
            completedProgressBar.setAttribute('aria-valuenow', completedPercentage);
        }
        
        // Failed documents progress
        const failedProgressBar = document.getElementById('failed-progress');
        if (failedProgressBar && queueTotal > 0) {
            const failedPercentage = Math.round((data.queue.failed / queueTotal) * 100);
            failedProgressBar.style.width = `${failedPercentage}%`;
            failedProgressBar.setAttribute('aria-valuenow', failedPercentage);
        }
        
        // Update current metrics values
        const currentCpu = document.getElementById('current-cpu');
        const currentMemory = document.getElementById('current-memory');
        
        if (currentCpu && data.current_metrics) {
            currentCpu.textContent = `${Math.round(data.current_metrics.cpu_usage)}%`;
        }
        
        if (currentMemory && data.current_metrics) {
            currentMemory.textContent = `${Math.round(data.current_metrics.memory_usage)}%`;
        }
    }
}
