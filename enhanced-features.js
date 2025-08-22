// Enhanced Features Module for Chinese Translation Interface

class EnhancedFeatures {
    constructor(translator) {
        this.translator = translator;
        this.currentTab = 'single';
        this.batchItems = [];
        this.currentFile = null;
        
        this.initializeEnhancedFeatures();
    }

    initializeEnhancedFeatures() {
        this.initializeTabNavigation();
        this.initializeSettingsPanel();
        this.initializeBatchTranslation();
        this.initializeFileUpload();
        this.enhanceInputValidation();
    }

    // Tab Navigation
    initializeTabNavigation() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                this.switchTab(targetTab);
            });
        });
    }

    switchTab(tabName) {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Add active class to selected tab and content
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');

        this.currentTab = tabName;
    }

    // Settings Panel
    initializeSettingsPanel() {
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsPanel = document.getElementById('settingsPanel');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');
        const translationMode = document.getElementById('translationMode');
        const preserveFormatting = document.getElementById('preserveFormatting');
        const autoSave = document.getElementById('autoSave');

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                settingsPanel.classList.add('show');
            });
        }

        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => {
                settingsPanel.classList.remove('show');
            });
        }

        // Click outside to close
        if (settingsPanel) {
            settingsPanel.addEventListener('click', (e) => {
                if (e.target === settingsPanel) {
                    settingsPanel.classList.remove('show');
                }
            });
        }

        // Settings change handlers
        if (translationMode) {
            translationMode.addEventListener('change', (e) => {
                this.translator.updateSetting('translationMode', e.target.value);
                this.translator.showToast('Đã cập nhật chế độ dịch', 'success', 'fa-check');
            });
        }

        if (preserveFormatting) {
            preserveFormatting.addEventListener('change', (e) => {
                this.translator.updateSetting('preserveFormatting', e.target.checked);
                this.translator.showToast('Đã cập nhật cài đặt định dạng', 'success', 'fa-check');
            });
        }

        if (autoSave) {
            autoSave.addEventListener('change', (e) => {
                this.translator.updateSetting('autoSave', e.target.checked);
                this.translator.showToast('Đã cập nhật tự động lưu', 'success', 'fa-check');
            });
        }
    }

    // Batch Translation
    initializeBatchTranslation() {
        const addBatchBtn = document.getElementById('addBatchBtn');
        const clearBatchBtn = document.getElementById('clearBatchBtn');
        const translateBatchBtn = document.getElementById('translateBatchBtn');
        const copyAllBtn = document.getElementById('copyAllBtn');

        if (addBatchBtn) {
            addBatchBtn.addEventListener('click', () => this.addBatchItem());
        }

        if (clearBatchBtn) {
            clearBatchBtn.addEventListener('click', () => this.clearBatchItems());
        }

        if (translateBatchBtn) {
            translateBatchBtn.addEventListener('click', () => this.translateBatch());
        }

        if (copyAllBtn) {
            copyAllBtn.addEventListener('click', () => this.copyAllResults());
        }

        // Initialize with one batch item
        this.addBatchItem();
    }

    addBatchItem() {
        const batchList = document.getElementById('batchList');
        if (!batchList) return;

        const batchItem = document.createElement('div');
        batchItem.className = 'batch-item';
        batchItem.innerHTML = `
            <textarea placeholder="Nhập văn bản tiếng Trung..." maxlength="5000"></textarea>
            <button class="btn-remove-batch">
                <i class="fas fa-times"></i>
            </button>
        `;

        const removeBtn = batchItem.querySelector('.btn-remove-batch');
        removeBtn.addEventListener('click', () => {
            batchItem.remove();
            this.updateBatchItemNumbers();
        });

        const textarea = batchItem.querySelector('textarea');
        textarea.addEventListener('input', () => {
            const validation = this.translator.validateInput(textarea.value);
            this.translator.showValidationFeedback(validation, batchItem);
        });

        batchList.appendChild(batchItem);
        this.updateBatchItemNumbers();
    }

    clearBatchItems() {
        const batchList = document.getElementById('batchList');
        if (!batchList) return;

        if (confirm('Bạn có chắc muốn xóa tất cả văn bản?')) {
            batchList.innerHTML = '';
            this.addBatchItem(); // Keep at least one item
            document.getElementById('batchResults').innerHTML = `
                <div class="placeholder">
                    <i class="fas fa-robot"></i>
                    <p>Kết quả dịch loạt sẽ hiển thị ở đây...</p>
                </div>
            `;
            document.getElementById('copyAllBtn').disabled = true;
        }
    }

    updateBatchItemNumbers() {
        const batchItems = document.querySelectorAll('.batch-item');
        batchItems.forEach((item, index) => {
            const textarea = item.querySelector('textarea');
            textarea.placeholder = `Nhập văn bản tiếng Trung thứ ${index + 1}...`;
        });
    }

    async translateBatch() {
        const batchItems = document.querySelectorAll('.batch-item textarea');
        const texts = Array.from(batchItems)
            .map(textarea => textarea.value.trim())
            .filter(text => text.length > 0);

        if (texts.length === 0) {
            this.translator.showToast('Vui lòng nhập ít nhất một văn bản', 'warning', 'fa-exclamation-triangle');
            return;
        }

        // Validate all texts
        const invalidTexts = texts.filter(text => !this.translator.chineseRegex.test(text));
        if (invalidTexts.length > 0) {
            this.translator.showToast('Một số văn bản không chứa ký tự tiếng Trung', 'error', 'fa-times-circle');
            return;
        }

        const translateBtn = document.getElementById('translateBatchBtn');
        const progressContainer = document.getElementById('batchProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const resultsContainer = document.getElementById('batchResults');

        // Show progress
        progressContainer.style.display = 'block';
        translateBtn.disabled = true;
        translateBtn.classList.add('btn-loading');

        resultsContainer.innerHTML = '';
        
        let completed = 0;
        const total = texts.length;
        const results = [];

        try {
            for (let i = 0; i < texts.length; i++) {
                const text = texts[i];
                progressText.textContent = `Đang dịch ${i + 1}/${total}`;
                progressFill.style.width = `${(i / total) * 100}%`;

                try {
                    const result = await this.translateSingleText(text);
                    results.push({ original: text, translated: result, success: true });
                    
                    // Add to results immediately
                    this.addBatchResult(text, result, i + 1);
                    
                    completed++;
                    progressFill.style.width = `${(completed / total) * 100}%`;
                    progressText.textContent = `Hoàn thành ${completed}/${total}`;
                    
                    // Add delay between requests to avoid rate limiting
                    if (i < texts.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (error) {
                    results.push({ original: text, error: error.message, success: false });
                    this.addBatchResult(text, `Lỗi: ${error.message}`, i + 1, true);
                }
            }

            this.translator.showToast(`Hoàn thành dịch ${completed}/${total} văn bản`, 'success', 'fa-check-circle');
            document.getElementById('copyAllBtn').disabled = false;

        } catch (error) {
            this.translator.showToast('Có lỗi xảy ra trong quá trình dịch loạt', 'error', 'fa-exclamation-circle');
        } finally {
            progressContainer.style.display = 'none';
            translateBtn.disabled = false;
            translateBtn.classList.remove('btn-loading');
        }
    }

    async translateSingleText(text) {
        const response = await fetch(this.translator.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                metadata: {
                    sessionId: this.translator.sessionId,
                    requestId: Date.now(),
                    mode: this.translator.settings.translationMode,
                    preserveFormatting: this.translator.settings.preserveFormatting,
                    batchMode: true
                }
            })
        });

        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        } catch {
            result = responseText;
        }

        if (response.ok && result.success !== false) {
            return result.text || result.translatedText || result;
        } else {
            throw new Error(result.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }
    }

    addBatchResult(original, translated, index, isError = false) {
        const resultsContainer = document.getElementById('batchResults');
        const resultItem = document.createElement('div');
        resultItem.className = 'batch-result-item';
        resultItem.innerHTML = `
            <div class="batch-result-header">
                ${isError ? '❌' : '✅'} Văn bản ${index}
            </div>
            <div class="batch-result-text" style="color: ${isError ? 'var(--error-color)' : 'var(--text-primary)'}">
                <strong>Gốc:</strong><br>
                ${this.translator.escapeHtml(original)}<br><br>
                <strong>${isError ? 'Lỗi' : 'Dịch'}:</strong><br>
                ${this.translator.escapeHtml(translated)}
            </div>
        `;
        resultsContainer.appendChild(resultItem);
    }

    async copyAllResults() {
        const results = document.querySelectorAll('.batch-result-item .batch-result-text');
        const allText = Array.from(results).map(result => result.textContent).join('\n\n---\n\n');
        
        try {
            await navigator.clipboard.writeText(allText);
            this.translator.showToast('Đã sao chép tất cả kết quả', 'success', 'fa-copy');
        } catch (err) {
            // Fallback
            const textArea = document.createElement('textarea');
            textArea.value = allText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.translator.showToast('Đã sao chép tất cả kết quả', 'success', 'fa-copy');
        }
    }

    // File Upload and Translation
    initializeFileUpload() {
        const fileDropZone = document.getElementById('fileDropZone');
        const fileInput = document.getElementById('fileInput');
        const translateFileBtn = document.getElementById('translateFileBtn');
        const removeFileBtn = document.getElementById('removeFileBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const copyFileBtn = document.getElementById('copyFileBtn');

        if (fileDropZone) {
            fileDropZone.addEventListener('click', () => fileInput?.click());
            fileDropZone.addEventListener('dragover', this.handleDragOver.bind(this));
            fileDropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
            fileDropZone.addEventListener('drop', this.handleDrop.bind(this));
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
        }

        if (translateFileBtn) {
            translateFileBtn.addEventListener('click', () => this.translateFile());
        }

        if (removeFileBtn) {
            removeFileBtn.addEventListener('click', () => this.removeFile());
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadResult());
        }

        if (copyFileBtn) {
            copyFileBtn.addEventListener('click', () => this.copyFileResult());
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleFileSelect(files[0]);
        }
    }

    handleFileSelect(file) {
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.txt')) {
            this.translator.showToast('Chỉ hỗ trợ file .txt', 'error', 'fa-times-circle');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            this.translator.showToast('File quá lớn (tối đa 5MB)', 'error', 'fa-times-circle');
            return;
        }

        this.currentFile = file;
        this.showFileInfo(file);
        document.getElementById('translateFileBtn').disabled = false;
    }

    showFileInfo(file) {
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');

        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);
        fileInfo.style.display = 'block';
    }

    removeFile() {
        this.currentFile = null;
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('translateFileBtn').disabled = true;
        document.getElementById('downloadBtn').disabled = true;
        document.getElementById('copyFileBtn').disabled = true;
        document.getElementById('fileOutputArea').innerHTML = `
            <div class="placeholder">
                <i class="fas fa-robot"></i>
                <p>Kết quả dịch file sẽ hiển thị ở đây...</p>
            </div>
        `;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async translateFile() {
        if (!this.currentFile) return;

        const translateBtn = document.getElementById('translateFileBtn');
        const progressContainer = document.getElementById('fileProgress');
        const progressText = document.getElementById('fileProgressText');
        const outputArea = document.getElementById('fileOutputArea');

        try {
            // Show progress
            progressContainer.style.display = 'block';
            translateBtn.disabled = true;
            translateBtn.classList.add('btn-loading');
            progressText.textContent = 'Đang đọc file...';

            // Read file
            const text = await this.readFileAsText(this.currentFile);
            
            // Validate content
            if (!this.translator.chineseRegex.test(text)) {
                throw new Error('File không chứa ký tự tiếng Trung');
            }

            progressText.textContent = 'Đang dịch nội dung...';

            // Translate content
            const result = await this.translateSingleText(text);
            
            // Display result
            outputArea.innerHTML = `<div class="file-output-text">${this.translator.escapeHtml(result)}</div>`;
            
            // Enable download and copy buttons
            document.getElementById('downloadBtn').disabled = false;
            document.getElementById('copyFileBtn').disabled = false;
            
            this.translator.showToast('Dịch file thành công!', 'success', 'fa-check-circle');

        } catch (error) {
            this.translator.showToast(error.message || 'Lỗi khi dịch file', 'error', 'fa-exclamation-circle');
            outputArea.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Có lỗi xảy ra</h3>
                    <p>${this.translator.escapeHtml(error.message)}</p>
                </div>
            `;
        } finally {
            progressContainer.style.display = 'none';
            translateBtn.disabled = false;
            translateBtn.classList.remove('btn-loading');
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Không thể đọc file'));
            reader.readAsText(file, 'utf-8');
        });
    }

    downloadResult() {
        const resultText = document.querySelector('#fileOutputArea .file-output-text')?.textContent;
        if (!resultText) return;

        const blob = new Blob([resultText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `translated_${this.currentFile.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.translator.showToast('Đã tải xuống file dịch', 'success', 'fa-download');
    }

    async copyFileResult() {
        const resultText = document.querySelector('#fileOutputArea .file-output-text')?.textContent;
        if (!resultText) return;

        try {
            await navigator.clipboard.writeText(resultText);
            this.translator.showToast('Đã sao chép kết quả file', 'success', 'fa-copy');
        } catch (err) {
            // Fallback
            const textArea = document.createElement('textarea');
            textArea.value = resultText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.translator.showToast('Đã sao chép kết quả file', 'success', 'fa-copy');
        }
    }

    // Enhanced Input Validation
    enhanceInputValidation() {
        const inputText = document.getElementById('inputText');
        if (inputText) {
            inputText.addEventListener('input', () => {
                const validation = this.translator.validateInput(inputText.value);
                const inputSection = inputText.closest('.input-section');
                this.translator.showValidationFeedback(validation, inputSection);
            });
        }
    }
}

// Initialize enhanced features when translator is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for translator to be initialized
    setTimeout(() => {
        if (typeof translator !== 'undefined') {
            window.enhancedFeatures = new EnhancedFeatures(translator);
        }
    }, 100);
});