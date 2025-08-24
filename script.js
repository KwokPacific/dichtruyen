const WEBHOOK_URL = window.ENV?.WEBHOOK_URL || 'https://n8n.myaloha.vn/webhook/translate-chinesee';

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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    addResetButton();
    console.log('QR Generator initialized for user: KwokPacific');
});

function initializeEventListeners() {
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
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
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
    
    if (selectedFiles.length + files.length > maxFiles) {
        showError(`Chỉ được chọn tối đa ${maxFiles} file.`);
        return;
    }
    
    for (let file of files) {
        if (file.size > maxFileSize) {
            showError(`File "${file.name}" quá lớn. Kích thước tối đa là 50MB.`);
            continue;
        }
        
        if (!selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
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
}

// Form submission với format đúng cho n8n workflow
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (selectedFiles.length === 0) {
        showError('Vui lòng chọn ít nhất một file để upload.');
        return;
    }

    const email = document.getElementById('email').value;
    const newQR = document.getElementById('newQR').checked;

    if (!validateEmail(email)) {
        showError('Vui lòng nhập địa chỉ email hợp lệ.');
        return;
    }

    let controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
        showLoading(true, 'Đang chuẩn bị dữ liệu...');
        hideMessages();

        // Chuẩn bị data theo format mà n8n workflow expect
        const formData = new FormData();
        
        // Gửi email trong body như workflow expect: $json.body.email
        const bodyData = {
            email: email,
            newQR: newQR,
            dateFormatted: new Date().toISOString().split('T')[0],
            user: 'KwokPacific',
            timestamp: new Date().toISOString()
        };
        
        // Append body data as JSON string hoặc individual fields
        Object.keys(bodyData).forEach(key => {
            formData.append(key, bodyData[key].toString());
        });

        // Append files
        selectedFiles.forEach((file, index) => {
            formData.append('files', file);
            console.log(`Adding file ${index + 1}: ${file.name} (${file.size} bytes)`);
        });

        console.log('Sending request with body data:', bodyData);
        console.log('Total files:', selectedFiles.length);

        showLoading(true, 'Đang gửi dữ liệu đến n8n...');

        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        // Get response text first
        const responseText = await response.text();
        console.log('Raw response:', responseText);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}\n\nResponse: ${responseText}`);
        }

        // Parse response
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            throw new Error(`Invalid JSON response: ${responseText}`);
        }

        console.log('Parsed response:', data);
        
        // Handle response based on n8n workflow behavior
        if (data.shareLink && data.qrCode) {
            // Success - got immediate result
            showResult(data);
            setTimeout(() => {
                result.scrollIntoView({ behavior: 'smooth' });
            }, 300);
        } else if (data.message === "Workflow was started") {
            // Workflow started but running async
            showAsyncWorkflowMessage(email);
        } else if (data.error) {
            throw new Error('Workflow error: ' + data.error);
        } else {
            // Unknown response format
            console.warn('Unexpected response format:', data);
            throw new Error('Unexpected response format: ' + JSON.stringify(data));
        }

    } catch (err) {
        clearTimeout(timeoutId);
        console.error('Request failed:', err);
        
        let errorMessage = 'Có lỗi xảy ra khi tạo QR code.\n\n';
        
        if (err.name === 'AbortError') {
            errorMessage += '⏱️ Timeout: Quá trình xử lý mất quá nhiều thời gian.\nVui lòng thử lại.';
        } else if (err.message.includes('Invalid Value')) {
            errorMessage += '❌ Lỗi parameter trong n8n workflow.\nVui lòng kiểm tra:\n• Email có đúng format không\n• Workflow có được configure đúng không';
        } else if (err.message.includes('Bad request')) {
            errorMessage += '❌ Bad Request từ n8n.\nCó thể do:\n• Format dữ liệu không đúng\n• Missing required parameters\n• Workflow configuration issue';
        } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
            errorMessage += '🌐 Không thể kết nối đến n8n server.\nVui lòng kiểm tra:\n• Internet connection\n• n8n server status\n• Webhook URL';
        } else {
            errorMessage += '❌ ' + err.message;
        }
        
        showError(errorMessage);
    } finally {
        showLoading(false);
    }
}

function showAsyncWorkflowMessage(email) {
    showLoading(false);
    
    const asyncMessage = `
🚀 Workflow đã được khởi động thành công!

📧 Kết quả sẽ được gửi đến: ${email}

⏱️ Thời gian xử lý: 2-5 phút

💡 Bạn có thể:
• Đóng trang này và chờ email
• Hoặc thử lại sau vài phút để kiểm tra

✉️ Nếu không nhận được email, vui lòng liên hệ Thái Bình Dương
    `;
    
    // Create custom success message
    const asyncDiv = document.createElement('div');
    asyncDiv.style.cssText = `
        margin-top: 25px;
        padding: 25px;
        background: linear-gradient(135deg, rgba(0, 123, 255, 0.1), rgba(0, 123, 255, 0.05));
        border-radius: 15px;
        border: 2px solid rgba(0, 123, 255, 0.3);
        color: #0056b3;
        white-space: pre-line;
        text-align: left;
    `;
    asyncDiv.innerHTML = `
        <h3 style="color: #0056b3; margin-bottom: 15px;">
            <i class="fas fa-rocket"></i> Workflow đang chạy...
        </h3>
        <div style="font-size: 1em; line-height: 1.6;">
            ${asyncMessage.replace(/\n/g, '<br>')}
        </div>
    `;
    
    // Insert after form
    form.parentNode.insertBefore(asyncDiv, result);
    
    // Auto scroll to message
    setTimeout(() => {
        asyncDiv.scrollIntoView({ behavior: 'smooth' });
    }, 300);
    
    showNotification('🚀 Workflow đã được khởi động! Kiểm tra email sau vài phút.');
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showLoading(show, message = 'Đang xử lý...') {
    loading.style.display = show ? 'block' : 'none';
    submitBtn.disabled = show;
    
    if (show) {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
        const loadingText = loading.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
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
            showNotification('✅ Đã sao chép link vào clipboard!');
        }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = data.shareLink;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('✅ Đã sao chép link!');
        });
    });
    shareLink.style.cursor = 'pointer';
    shareLink.title = 'Click để sao chép link';
    
    result.style.display = 'block';
    showNotification('🎉 QR Code đã được tạo thành công!');
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.style.whiteSpace = 'pre-line';
    errorMessage.textContent = message;
    error.style.display = 'block';
    
    setTimeout(() => {
        error.style.display = 'none';
    }, 15000);
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
        max-width: 300px;
        word-wrap: break-word;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

function hideMessages() {
    result.style.display = 'none';
    error.style.display = 'none';
    
    // Remove any async workflow messages
    const asyncMessages = document.querySelectorAll('div[style*="rgba(0, 123, 255"]');
    asyncMessages.forEach(msg => msg.remove());
}

function resetForm() {
    selectedFiles = [];
    displaySelectedFiles();
    form.reset();
    hideMessages();
    updateSubmitButton();
    fileInput.value = '';
    showNotification('🔄 Form đã được làm mới!');
}

function addResetButton() {
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'submit-btn reset-btn';
    resetBtn.innerHTML = '<i class="fas fa-redo"></i> Làm mới';
    resetBtn.addEventListener('click', resetForm);
    
    form.appendChild(resetBtn);
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
});

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
