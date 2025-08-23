// Use environment configuration
const WEBHOOK_URL = window.ENV?.WEBHOOK_URL || 'https://n8n.myaloha.vn/webhook/upload-docs';

let selectedFiles = [];

// DOM elements
const fileUpload = document.getElementById('fileUpload');
const fileInput = document.getElementById('files');
const selectedFilesDiv = document.getElementById('selectedFiles');
const form = document.getElementById('qrForm');
const submitBtn = document.getElementById('submitBtn');
const loading = document.getElementById('loading');
const result = document.getElementById('result');
const error = document.getElementById('error');

// Debug logging
function debugLog(message, data = null) {
    console.log(`[QR Generator Debug] ${new Date().toISOString()}: ${message}`, data || '');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    debugLog('DOM loaded, initializing...');
    initializeEventListeners();
    addResetButton();
    debugLog('Webhook URL configured:', WEBHOOK_URL);
});

function initializeEventListeners() {
    debugLog('Setting up event listeners...');
    
    // File upload handling
    fileUpload.addEventListener('click', () => fileInput.click());

    fileUpload.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUpload.classList.add('dragover');
    });

    fileUpload.addEventListener('dragleave', (e) => {
        e.preventDefault();
        fileUpload.classList.remove('dragover');
    });

    fileUpload.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUpload.classList.remove('dragover');
        debugLog('Files dropped:', e.dataTransfer.files.length);
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        debugLog('Files selected:', e.target.files.length);
        handleFiles(e.target.files);
    });

    // Form submission
    form.addEventListener('submit', handleFormSubmit);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            if (!submitBtn.disabled) {
                form.dispatchEvent(new Event('submit'));
            }
        }
        if (e.key === 'Escape') {
            hideMessages();
        }
    });
}

function handleFiles(files) {
    const maxFileSize = 50 * 1024 * 1024; // 50MB
    const maxFiles = 10;
    
    debugLog(`Processing ${files.length} files...`);
    
    if (selectedFiles.length + files.length > maxFiles) {
        showError(`Chỉ được chọn tối đa ${maxFiles} file.`);
        return;
    }
    
    for (let file of files) {
        debugLog(`Processing file: ${file.name} (${file.size} bytes)`);
        
        if (file.size > maxFileSize) {
            showError(`File "${file.name}" quá lớn. Kích thước tối đa là 50MB.`);
            continue;
        }
        
        if (!selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
            debugLog(`Added file: ${file.name}`);
        }
    }
    displaySelectedFiles();
    updateSubmitButton();
}

function displaySelectedFiles() {
    selectedFilesDiv.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileIcon = getFileIcon(file.name);
        
        fileItem.innerHTML = `
            <div class="file-info">
                <i class="fas fa-${fileIcon}"></i>
                <span class="file-name">${truncateFileName(file.name, 30)}</span>
                <span class="file-size">${formatFileSize(file.size)}</span>
            </div>
            <button type="button" class="remove-file" onclick="removeFile(${index})" title="Xóa file">
                <i class="fas fa-times"></i>
            </button>
        `;
        selectedFilesDiv.appendChild(fileItem);
    });
}

function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
        'pdf': 'file-pdf',
        'doc': 'file-word', 'docx': 'file-word',
        'xls': 'file-excel', 'xlsx': 'file-excel',
        'ppt': 'file-powerpoint', 'pptx': 'file-powerpoint',
        'jpg': 'file-image', 'jpeg': 'file-image', 'png': 'file-image', 'gif': 'file-image',
        'mp4': 'file-video', 'avi': 'file-video', 'mov': 'file-video',
        'mp3': 'file-audio', 'wav': 'file-audio',
        'zip': 'file-archive', 'rar': 'file-archive', '7z': 'file-archive',
        'txt': 'file-alt', 'html': 'file-code', 'css': 'file-code', 'js': 'file-code'
    };
    return iconMap[ext] || 'file';
}

function truncateFileName(fileName, maxLength) {
    if (fileName.length <= maxLength) return fileName;
    const ext = fileName.split('.').pop();
    const name = fileName.substring(0, fileName.lastIndexOf('.'));
    const truncated = name.substring(0, maxLength - ext.length - 4) + '...';
    return truncated + '.' + ext;
}

function removeFile(index) {
    const removedFile = selectedFiles[index];
    debugLog(`Removing file: ${removedFile.name}`);
    selectedFiles.splice(index, 1);
    displaySelectedFiles();
    updateSubmitButton();
    fileInput.value = '';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateSubmitButton() {
    const email = document.getElementById('email').value;
    const hasFiles = selectedFiles.length > 0;
    const hasEmail = email.length > 0;
    
    submitBtn.disabled = !(hasFiles && hasEmail);
    debugLog(`Submit button state: disabled=${submitBtn.disabled}, hasFiles=${hasFiles}, hasEmail=${hasEmail}`);
}

// Form submission handler
async function handleFormSubmit(e) {
    e.preventDefault();
    
    debugLog('Form submission started...');
    
    if (selectedFiles.length === 0) {
        showError('Vui lòng chọn ít nhất một file để upload.');
        return;
    }

    const email = document.getElementById('email').value;
    const newQR = document.getElementById('newQR').checked;

    debugLog('Form data:', {
        email: email,
        newQR: newQR,
        filesCount: selectedFiles.length,
        totalSize: selectedFiles.reduce((sum, file) => sum + file.size, 0)
    });

    if (!validateEmail(email)) {
        showError('Vui lòng nhập địa chỉ email hợp lệ.');
        return;
    }

    try {
        showLoading(true);
        hideMessages();

        // Prepare FormData
        const formData = new FormData();
        formData.append('email', email);
        formData.append('newQR', newQR.toString());
        formData.append('dateFormatted', new Date().toISOString().split('T')[0]);

        selectedFiles.forEach((file, index) => {
            debugLog(`Appending file ${index + 1}: ${file.name}`);
            formData.append('files', file);
        });

        debugLog('Sending request to:', WEBHOOK_URL);
        debugLog('FormData entries:', Array.from(formData.entries()).map(([key, value]) => ({
            key,
            value: value instanceof File ? `File: ${value.name} (${value.size} bytes)` : value
        })));

        const requestOptions = {
            method: 'POST',
            body: formData,
            // Don't set Content-Type header, let browser set it with boundary
        };

        debugLog('Request options:', requestOptions);

        const response = await fetch(WEBHOOK_URL, requestOptions);

        debugLog('Response received:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
            const errorText = await response.text();
            debugLog('Error response body:', errorText);
            throw new Error(`Lỗi HTTP: ${response.status} - ${response.statusText}\nChi tiết: ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        debugLog('Response content-type:', contentType);

        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const textData = await response.text();
            debugLog('Non-JSON response:', textData);
            try {
                data = JSON.parse(textData);
            } catch {
                throw new Error('Phản hồi không phải JSON hợp lệ: ' + textData);
            }
        }
        
        debugLog('Parsed response data:', data);
        
        if (data.shareLink && data.qrCode) {
            showResult(data);
            setTimeout(() => {
                result.scrollIntoView({ behavior: 'smooth' });
            }, 300);
        } else {
            debugLog('Invalid response structure:', data);
            throw new Error('Phản hồi thiếu dữ liệu: ' + JSON.stringify(data));
        }

    } catch (err) {
        debugLog('Request failed:', err);
        console.error('Detailed error:', err);
        
        let errorMessage = 'Có lỗi xảy ra khi tạo QR code. ';
        
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
            errorMessage += 'Không thể kết nối đến server. Vui lòng kiểm tra:\n';
            errorMessage += '• Kết nối internet\n';
            errorMessage += '• URL webhook có đúng không\n';
            errorMessage += '• Server n8n có đang chạy không';
        } else if (err.message.includes('HTTP')) {
            errorMessage += err.message;
        } else {
            errorMessage += err.message || 'Lỗi không xác định';
        }
        
        showError(errorMessage);
    } finally {
        showLoading(false);
    }
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showLoading(show) {
    loading.style.display = show ? 'block' : 'none';
    submitBtn.disabled = show;
    
    if (show) {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
    } else {
        submitBtn.innerHTML = '<i class="fas fa-magic"></i> Tạo QR Code';
        updateSubmitButton();
    }
}

function showResult(data) {
    const qrImage = document.getElementById('qrImage');
    const shareLink = document.getElementById('shareLink');
    
    qrImage.src = `data:image/png;base64,${data.qrCode}`;
    qrImage.alt = 'QR Code';
    shareLink.textContent = data.shareLink;
    
    // Add click to copy functionality
    shareLink.addEventListener('click', () => {
        navigator.clipboard.writeText(data.shareLink).then(() => {
            showNotification('Đã sao chép link vào clipboard!');
        });
    });
    shareLink.style.cursor = 'pointer';
    shareLink.title = 'Click để sao chép link';
    
    result.style.display = 'block';
    debugLog('Result displayed successfully');
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.style.whiteSpace = 'pre-line'; // Allow line breaks
    errorMessage.textContent = message;
    error.style.display = 'block';
    
    debugLog('Error displayed:', message);
    
    // Auto hide error after 10 seconds for debug version
    setTimeout(() => {
        error.style.display = 'none';
    }, 10000);
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(45deg, #28a745, #20c997);
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function hideMessages() {
    result.style.display = 'none';
    error.style.display = 'none';
}

function resetForm() {
    debugLog('Resetting form...');
    selectedFiles = [];
    displaySelectedFiles();
    form.reset();
    hideMessages();
    updateSubmitButton();
    fileInput.value = '';
    showNotification('Form đã được làm mới!');
}

function addResetButton() {
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'submit-btn reset-btn';
    resetBtn.innerHTML = '<i class="fas fa-redo"></i> Làm mới';
    resetBtn.addEventListener('click', resetForm);
    
    form.appendChild(resetBtn);
}

// Add debug panel
function addDebugPanel() {
    const debugPanel = document.createElement('div');
    debugPanel.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-size: 12px;
        max-width: 300px;
        z-index: 1000;
    `;
    debugPanel.innerHTML = `
        <strong>Debug Info:</strong><br>
        Webhook: ${WEBHOOK_URL}<br>
        User: KwokPacific<br>
        <button onclick="this.parentElement.style.display='none'" style="float: right; background: red; color: white; border: none; padding: 2px 5px; border-radius: 3px;">×</button>
    `;
    document.body.appendChild(debugPanel);
}

// Email input validation
document.addEventListener('DOMContentLoaded', function() {
    const emailInput = document.getElementById('email');
    emailInput.addEventListener('input', updateSubmitButton);
    emailInput.addEventListener('blur', function() {
        if (this.value && !validateEmail(this.value)) {
            this.style.borderColor = '#dc3545';
        } else {
            this.style.borderColor = '#e1e1e1';
        }
    });
    
    // Add debug panel in development
    addDebugPanel();
});

// Test webhook connectivity
async function testWebhook() {
    debugLog('Testing webhook connectivity...');
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'GET',
        });
        debugLog('Webhook test response:', response.status);
    } catch (err) {
        debugLog('Webhook test failed:', err.message);
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Test webhook on load
setTimeout(testWebhook, 1000);
