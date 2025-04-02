/**
 * Initialize the monitoring dashboard
 */
function initMonitoringDashboard() {
    // Charts
    let resourceChart = null;
    let chunksChart = null;
    
    // Initialize everything
    initCharts();
    loadSystemStats();
    loadMetricsHistory();
    loadProcessingQueue();
    
    // Set up periodic refresh
    setInterval(() => {
        loadSystemStats();
        loadMetricsHistory();
        loadProcessingQueue();
        
        // Update last update time
        document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString();
    }, 30000); // Update every 30 seconds
    
    // Initial last update time
    document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString();
    
    /**
     * Initialize the charts
     */
    function initCharts() {
        // Resource chart
        const resourceCtx = document.getElementById('resourceChart').getContext('2d');
        resourceChart = new Chart(resourceCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'CPU Usage',
                        data: [],
                        borderColor: 'rgba(13, 110, 253, 1)',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Memory Usage',
                        data: [],
                        borderColor: 'rgba(13, 202, 240, 1)',
                        backgroundColor: 'rgba(13, 202, 240, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    }
                ]
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
                            text: 'Percentage (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
                            }
                        }
                    }
                }
            }
        });
        
        // Chunks chart
        const chunksCtx = document.getElementById('chunksChart').getContext('2d');
        chunksChart = new Chart(chunksCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Processed Chunks',
                        data: [],
                        borderColor: 'rgba(25, 135, 84, 1)',
                        backgroundColor: 'rgba(25, 135, 84, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Pending Chunks',
                        data: [],
                        borderColor: 'rgba(255, 193, 7, 1)',
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
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
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top'
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
                updateProgressBars(data);
            })
            .catch(error => {
                console.error('Error loading system stats:', error);
            });
    }
    
    /**
     * Load metrics history for charts
     */
    function loadMetricsHistory() {
        fetch('/monitoring/history')
            .then(response => response.json())
            .then(data => {
                updateCharts(data);
            })
            .catch(error => {
                console.error('Error loading metrics history:', error);
            });
    }
    
    /**
     * Load processing queue data
     */
    function loadProcessingQueue() {
        fetch('/monitoring/queue')
            .then(response => response.json())
            .then(data => {
                updateQueueTable(data);
            })
            .catch(error => {
                console.error('Error loading processing queue:', error);
            });
    }
    
    /**
     * Update the charts with new data
     */
    function updateCharts(history) {
        if (!history || history.length === 0) return;
        
        // Format timestamps for chart labels
        const labels = history.map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleTimeString();
        });
        
        // Update resource chart
        resourceChart.data.labels = labels;
        resourceChart.data.datasets[0].data = history.map(item => item.cpu_usage);
        resourceChart.data.datasets[1].data = history.map(item => item.memory_usage);
        resourceChart.update();
        
        // Update chunks chart
        chunksChart.data.labels = labels;
        chunksChart.data.datasets[0].data = history.map(item => item.chunks_processed);
        chunksChart.data.datasets[1].data = history.map(item => item.chunks_pending);
        chunksChart.update();
        
        // Update current metrics
        if (history.length > 0) {
            const latest = history[history.length - 1];
            
            document.getElementById('currentCPU').textContent = `${latest.cpu_usage.toFixed(1)}%`;
            document.getElementById('currentMemory').textContent = `${latest.memory_usage.toFixed(1)}%`;
            
            document.getElementById('cpuProgressBar').style.width = `${latest.cpu_usage}%`;
            document.getElementById('memoryProgressBar').style.width = `${latest.memory_usage}%`;
        }
    }
    
    /**
     * Update the processing queue table
     */
    function updateQueueTable(queue) {
        // Update queue counts
        document.getElementById('queueTotal').textContent = queue.total;
        document.getElementById('pendingCount').textContent = `Pending: ${queue.pending}`;
        document.getElementById('processingCount').textContent = `Processing: ${queue.processing}`;
        document.getElementById('completedCount').textContent = `Completed: ${queue.completed}`;
        document.getElementById('failedCount').textContent = `Failed: ${queue.failed}`;
        
        // Update queue table
        const tableBody = document.getElementById('queueTableBody');
        
        if (!tableBody) return;
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // Add new rows
        if (queue.recent_queue && queue.recent_queue.length > 0) {
            queue.recent_queue.forEach(item => {
                const row = document.createElement('tr');
                
                // Determine status badge class
                let statusBadgeClass = '';
                switch (item.status) {
                    case 'pending': statusBadgeClass = 'bg-warning'; break;
                    case 'processing': statusBadgeClass = 'bg-primary'; break;
                    case 'completed': statusBadgeClass = 'bg-success'; break;
                    case 'failed': statusBadgeClass = 'bg-danger'; break;
                    default: statusBadgeClass = 'bg-secondary';
                }
                
                row.innerHTML = `
                    <td>${item.id}</td>
                    <td>${escapeHtml(item.document_title)}</td>
                    <td><span class="badge ${statusBadgeClass}">${item.status}</span></td>
                    <td>${formatDateTime(item.queued_at)}</td>
                    <td>${item.started_at ? formatDateTime(item.started_at) : '-'}</td>
                    <td>${item.completed_at ? formatDateTime(item.completed_at) : '-'}</td>
                `;
                
                tableBody.appendChild(row);
            });
        } else {
            // No queue entries
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="6" class="text-center text-muted">No documents in queue</td>
            `;
            tableBody.appendChild(row);
        }
    }
    
    /**
     * Update progress bars with current data
     */
    function updateProgressBars(data) {
        // Documents stats
        document.getElementById('totalDocuments').textContent = data.total_documents;
        document.getElementById('processingProgressBar').style.width = `${data.processing_percentage}%`;
        document.getElementById('processingStats').textContent = 
            `${data.processed_documents} of ${data.total_documents} documents processed (${data.processing_percentage}%)`;
        
        // Chunks and embeddings stats
        document.getElementById('totalChunks').textContent = data.total_chunks;
        document.getElementById('embeddingsProgressBar').style.width = `${data.embeddings_percentage}%`;
        document.getElementById('embeddingStats').textContent = 
            `${data.total_embeddings} of ${data.total_chunks} chunks embedded (${data.embeddings_percentage}%)`;
        
        // Average processing time
        const avgTimeElement = document.getElementById('avgProcessingTime');
        if (data.avg_processing_time_seconds) {
            const minutes = Math.floor(data.avg_processing_time_seconds / 60);
            const seconds = Math.floor(data.avg_processing_time_seconds % 60);
            avgTimeElement.textContent = `${minutes}m ${seconds}s`;
        } else {
            avgTimeElement.textContent = 'N/A';
        }
    }
    
    /**
     * Format a date and time for display
     */
    function formatDateTime(dateTimeString) {
        if (!dateTimeString) return '-';
        
        const date = new Date(dateTimeString);
        return date.toLocaleString();
    }
}