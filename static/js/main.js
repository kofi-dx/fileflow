// Global variables
let currentFiles = [];
let toast;

// Initialize toast on page load
document.addEventListener('DOMContentLoaded', function() {
    toast = new bootstrap.Toast(document.getElementById('notificationToast'));
});

// Show notification
function showNotification(message, type = 'info') {
    const toastElement = document.getElementById('notificationToast');
    const toastBody = document.getElementById('toastMessage');
    const toastHeader = toastElement.querySelector('.toast-header');
    
    // Change icon based on type
    let icon = 'info-circle';
    let bgClass = '';
    
    switch(type) {
        case 'success':
            icon = 'check-circle';
            bgClass = 'text-success';
            break;
        case 'error':
            icon = 'exclamation-circle';
            bgClass = 'text-danger';
            break;
        case 'warning':
            icon = 'exclamation-triangle';
            bgClass = 'text-warning';
            break;
    }
    
    toastHeader.querySelector('i').className = `fas fa-${icon} me-2 ${bgClass}`;
    toastBody.textContent = message;
    toast.show();
}

// Load files from server
function loadFiles() {
    fetch('/api/files')
        .then(response => response.json())
        .then(files => {
            currentFiles = files;
            displayFiles(files);
        })
        .catch(error => {
            console.error('Error loading files:', error);
            showNotification('Error loading files', 'error');
        });
}

// Load statistics
function loadStats() {
    fetch('/stats')
        .then(response => response.json())
        .then(stats => {
            document.getElementById('totalFiles').textContent = stats.total_files;
            document.getElementById('totalStorage').textContent = stats.total_size;
            document.getElementById('mostDownloaded').textContent = stats.most_downloaded;
            document.getElementById('downloadCount').textContent = `${stats.most_downloaded_count} downloads`;
        })
        .catch(error => {
            console.error('Error loading stats:', error);
        });
}

// Display files in table
function displayFiles(files) {
    const tbody = document.getElementById('fileList');
    
    if (files.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted">
                    <div class="empty-state">
                        <i class="fas fa-folder-open"></i>
                        <p>No files uploaded yet</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    files.forEach(file => {
        const fileIcon = getFileIcon(file.file_type);
        const fileType = getFileTypeName(file.file_type);
        
        html += `
            <tr class="fade-in">
                <td>
                    <i class="fas ${fileIcon} file-icon file-icon-${fileType.toLowerCase()} me-2"></i>
                    ${escapeHtml(file.original_filename)}
                </td>
                <td>
                    <span class="file-type-badge">${fileType}</span>
                </td>
                <td>${file.size_formatted}</td>
                <td>${file.upload_date}</td>
                <td>
                    <span class="badge bg-info">${file.download_count}</span>
                </td>
                <td>
                    <button class="btn btn-sm action-btn btn-download" onclick="downloadFile(${file.id})" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn btn-sm action-btn btn-delete" onclick="deleteFile(${file.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Get appropriate icon for file type
function getFileIcon(mimeType) {
    if (mimeType.includes('pdf')) return 'fa-file-pdf';
    if (mimeType.includes('image')) return 'fa-file-image';
    if (mimeType.includes('word')) return 'fa-file-word';
    if (mimeType.includes('excel')) return 'fa-file-excel';
    if (mimeType.includes('powerpoint')) return 'fa-file-powerpoint';
    if (mimeType.includes('text')) return 'fa-file-alt';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'fa-file-archive';
    return 'fa-file';
}

// Get friendly file type name
function getFileTypeName(mimeType) {
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('image')) return 'Image';
    if (mimeType.includes('word')) return 'Document';
    if (mimeType.includes('excel')) return 'Spreadsheet';
    if (mimeType.includes('powerpoint')) return 'Presentation';
    if (mimeType.includes('text')) return 'Text';
    if (mimeType.includes('zip')) return 'Archive';
    return 'File';
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Upload file
function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('Please select a file', 'warning');
        return;
    }
    
    // Check file size (16MB limit)
    if (file.size > 16 * 1024 * 1024) {
        showNotification('File size exceeds 16MB limit', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Show progress bar
    const progress = document.getElementById('uploadProgress');
    const progressBar = progress.querySelector('.progress-bar');
    progress.classList.remove('d-none');
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('uploadModal'));
    modal.hide();
    
    // Upload file
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('File uploaded successfully!', 'success');
            loadFiles(); // Reload file list
            loadStats(); // Reload statistics
            
            // Reset form
            document.getElementById('uploadForm').reset();
        } else {
            showNotification(data.error || 'Upload failed', 'error');
        }
    })
    .catch(error => {
        console.error('Error uploading file:', error);
        showNotification('Error uploading file', 'error');
    })
    .finally(() => {
        // Hide progress bar
        setTimeout(() => {
            progress.classList.add('d-none');
            progressBar.style.width = '0%';
            progressBar.textContent = '0%';
        }, 1000);
    });
    
    // Simulate progress (since fetch doesn't provide upload progress)
    let width = 0;
    const interval = setInterval(() => {
        if (width >= 90) {
            clearInterval(interval);
        } else {
            width += 10;
            progressBar.style.width = width + '%';
            progressBar.textContent = width + '%';
        }
    }, 200);
}

// Download file
function downloadFile(fileId) {
    window.location.href = `/download/${fileId}`;
    
    // Update download count after a short delay
    setTimeout(() => {
        loadFiles();
        loadStats();
    }, 1000);
}

// Delete file
function deleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }
    
    fetch(`/delete/${fileId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('File deleted successfully', 'success');
            loadFiles(); // Reload file list
            loadStats(); // Reload statistics
        } else {
            showNotification(data.error || 'Delete failed', 'error');
        }
    })
    .catch(error => {
        console.error('Error deleting file:', error);
        showNotification('Error deleting file', 'error');
    });
}

// Search files
function searchFiles() {
    const query = document.getElementById('searchInput').value;
    const type = document.getElementById('fileTypeFilter').value;
    
    let url = '/search?';
    if (query) url += `q=${encodeURIComponent(query)}&`;
    if (type) url += `type=${encodeURIComponent(type)}`;
    
    fetch(url)
        .then(response => response.json())
        .then(files => {
            displayFiles(files);
        })
        .catch(error => {
            console.error('Error searching files:', error);
            showNotification('Error searching files', 'error');
        });
}

// Debounce search input
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(searchFiles, 500);
});

// Filter on type change
document.getElementById('fileTypeFilter').addEventListener('change', searchFiles);

// Drag and drop upload (bonus feature)
const uploadModal = document.getElementById('uploadModal');
uploadModal.addEventListener('show.bs.modal', function() {
    // Add drag and drop functionality when modal opens
    const fileInput = document.getElementById('fileInput');
    const modalBody = document.querySelector('#uploadModal .modal-body');
    
    modalBody.addEventListener('dragover', (e) => {
        e.preventDefault();
        modalBody.classList.add('bg-light');
    });
    
    modalBody.addEventListener('dragleave', (e) => {
        e.preventDefault();
        modalBody.classList.remove('bg-light');
    });
    
    modalBody.addEventListener('drop', (e) => {
        e.preventDefault();
        modalBody.classList.remove('bg-light');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
        }
    });
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + U to open upload modal
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        const modal = new bootstrap.Modal(document.getElementById('uploadModal'));
        modal.show();
    }
    
    // Escape to clear search
    if (e.key === 'Escape') {
        document.getElementById('searchInput').value = '';
        searchFiles();
    }
});