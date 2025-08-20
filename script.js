class ChineseTranslator {
    constructor() {
        this.apiEndpoint = 'https://n8n.myaloha.vn/webhook/translate-chinese'; // n8n webhook endpoint
        this.timeout = 30000; // 30 seconds timeout
        this.retryAttempts = 3; // Number of retry attempts
        this.translationHistory = JSON.parse(localStorage.getItem('translationHistory') || '[]');
        this.translationCount = parseInt(localStorage.getItem('translationCount') || '0');
        this.currentTheme = localStorage.getItem('theme') || 'light';
        
        this.initializeElements();
        this.bindEvents();
        this.loadTheme();
        this.updateStats();
        this.renderHistory();
    }

    initializeElements() {
        this.inputText = document.getElementById('inputText');
        this.outputArea = document.getElementById('outputArea');
        this.translateBtn = document.getElementById('translateBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.charCount = document.getElementById('charCount');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.themeToggle = document.getElementById('themeToggle');
        this.translationTime = document.getElementById('translationTime');
        this.translationLength = document.getElementById('translationLength');
        this.translationCountEl = document.getElementById('translationCount');
        this.historyList = document.getElementById('historyList');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        this.toastContainer = document.getElementById('toastContainer');
    }

    bindEvents() {
        this.inputText.addEventListener('input', () => this.updateCharCount());
        this.inputText.addEventListener('paste', () => {
            setTimeout(() => this.updateCharCount(), 0);
        });
        
        this.translateBtn.addEventListener('click', () => this.translateText());
        this.clearBtn.addEventListener('click', () => this.clearInput());
        this.copyBtn.addEventListener('click', () => this.copyResult());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());

        // Enter để dịch (Ctrl+Enter)
        this.inputText.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.translateText();
            }
        });
    }

    updateCharCount() {
        const count = this.inputText.value.length;
        this.charCount.textContent = count;
        
        if (count > 4500) {
            this.charCount.style.color = 'var(--error-color)';
        } else if (count > 4000) {
            this.charCount.style.color = 'var(--warning-color)';
        } else {
            this.charCount.style.color = 'var(--text-muted)';
        }
    }

    async translateText() {
        const text = this.inputText.value.trim();
        
        if (!text) {
            this.showToast('Vui lòng nhập văn bản cần dịch', 'warning', 'fa-exclamation-triangle');
            return;
        }

        // Kiểm tra có ký tự tiếng Trung không
        const chineseRegex = /[\u4e00-\u9fff]/;
        if (!chineseRegex.test(text)) {
            this.showToast('Văn bản phải chứa ký tự tiếng Trung', 'error', 'fa-times-circle');
            return;
        }

        const startTime = Date.now();
        this.showLoading(true);
        this.translateBtn.disabled = true;

        // Retry logic
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                if (attempt > 1) {
                    this.showLoading(true, `Đang thử lại... (lần ${attempt}/${this.retryAttempts})`, true);
                }

                const translatedText = await this.performTranslation(text, attempt);
                const endTime = Date.now();
                const duration = ((endTime - startTime) / 1000).toFixed(1);

                this.displayResult(translatedText);
                this.updateTranslationStats(duration, translatedText.length);
                this.addToHistory(text, translatedText);
                this.showToast('Dịch thành công!', 'success', 'fa-check-circle');
                
                this.showLoading(false);
                this.translateBtn.disabled = false;
                return;

            } catch (error) {
                console.error(`Translation attempt ${attempt} failed:`, error);
                
                // If this is the last attempt, show error
                if (attempt === this.retryAttempts) {
                    this.showToast(this.getErrorMessage(error), 'error', 'fa-exclamation-circle');
                    this.displayError(this.getErrorMessage(error));
                } else {
                    // Show retry message
                    this.showToast(`Thử lại lần ${attempt + 1}...`, 'warning', 'fa-sync-alt');
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Progressive delay
                }
            }
        }

        this.showLoading(false);
        this.translateBtn.disabled = false;
    }

    async performTranslation(text, attempt) {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ text: text }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 0 || response.status >= 500) {
                    throw new Error('Lỗi server, đang thử lại...');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            // Handle different response formats from n8n workflow
            if (result.success === false) {
                throw new Error(result.error?.message || result.message || 'Workflow trả về lỗi');
            }

            // Extract translated text from various possible response formats
            const translatedText = result.text || result.translatedText || result.data?.text || result.translation || result;
            
            if (typeof translatedText !== 'string' || !translatedText.trim()) {
                throw new Error('Không nhận được kết quả dịch từ workflow');
            }

            return translatedText;

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Thời gian chờ quá lâu, vui lòng thử lại');
            }
            
            throw error;
        }
    }

    getErrorMessage(error) {
        if (error.message.includes('fetch')) {
            return 'Lỗi kết nối đến n8n workflow. Kiểm tra CORS và network.';
        }
        if (error.message.includes('HTTP 404')) {
            return 'Không tìm thấy webhook n8n. Kiểm tra đường dẫn API.';
        }
        if (error.message.includes('HTTP 500')) {
            return 'Lỗi server n8n. Vui lòng thử lại sau.';
        }
        if (error.message.includes('timeout') || error.message.includes('Thời gian chờ')) {
            return 'Hết thời gian chờ. Workflow có thể đang xử lý quá lâu.';
        }
        return error.message || 'Có lỗi không xác định xảy ra';
    }

    displayResult(translatedText) {
        this.outputArea.innerHTML = `<div class="translation-result">${this.escapeHtml(translatedText)}</div>`;
        this.copyBtn.disabled = false;
    }

    displayError(message) {
        this.outputArea.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Có lỗi xảy ra</h3>
                <p>${this.escapeHtml(message)}</p>
            </div>
        `;
        this.copyBtn.disabled = true;
    }

    clearInput() {
        this.inputText.value = '';
        this.updateCharCount();
        this.inputText.focus();
    }

    async copyResult() {
        const resultText = this.outputArea.querySelector('.translation-result')?.textContent;
        if (!resultText) return;

        try {
            await navigator.clipboard.writeText(resultText);
            this.showToast('Đã sao chép kết quả', 'success', 'fa-copy');
        } catch (err) {
            // Fallback cho trình duyệt cũ
            const textArea = document.createElement('textarea');
            textArea.value = resultText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('Đã sao chép kết quả', 'success', 'fa-copy');
        }
    }

    showLoading(show, message = null, isRetry = false) {
        if (show) {
            this.loadingOverlay.classList.add('show');
            
            // Update loading message if provided
            if (message) {
                const loadingContent = this.loadingOverlay.querySelector('.loading-content');
                const existingMessage = loadingContent.querySelector('.loading-message');
                
                if (existingMessage) {
                    existingMessage.textContent = message;
                } else {
                    const messageElement = document.createElement('p');
                    messageElement.className = 'loading-message';
                    messageElement.textContent = message;
                    messageElement.style.marginTop = '1rem';
                    messageElement.style.fontWeight = '500';
                    if (isRetry) messageElement.style.color = 'var(--warning-color)';
                    loadingContent.appendChild(messageElement);
                }
            }
        } else {
            this.loadingOverlay.classList.remove('show');
            
            // Remove any custom loading message
            const existingMessage = this.loadingOverlay.querySelector('.loading-message');
            if (existingMessage) {
                existingMessage.remove();
            }
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.loadTheme();
        localStorage.setItem('theme', this.currentTheme);
    }

    loadTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        const icon = this.themeToggle.querySelector('i');
        if (this.currentTheme === 'dark') {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }

    updateTranslationStats(time, length) {
        this.translationTime.textContent = `${time}s`;
        this.translationLength.textContent = `${length} ký tự`;
        this.translationCount++;
        this.translationCountEl.textContent = this.translationCount;
        localStorage.setItem('translationCount', this.translationCount.toString());
    }

    updateStats() {
        this.translationCountEl.textContent = this.translationCount;
    }

    addToHistory(originalText, translatedText) {
        const historyItem = {
            id: Date.now(),
            timestamp: new Date().toLocaleString('vi-VN'),
            original: originalText.substring(0, 200),
            translated: translatedText.substring(0, 200),
            originalFull: originalText,
            translatedFull: translatedText
        };

        this.translationHistory.unshift(historyItem);
        
        // Giữ tối đa 20 lịch sử
        if (this.translationHistory.length > 20) {
            this.translationHistory = this.translationHistory.slice(0, 20);
        }

        localStorage.setItem('translationHistory', JSON.stringify(this.translationHistory));
        this.renderHistory();
    }

    renderHistory() {
        if (this.translationHistory.length === 0) {
            this.historyList.innerHTML = `
                <div class="no-history">
                    <i class="fas fa-inbox"></i>
                    <p>Chưa có lịch sử dịch</p>
                </div>
            `;
            return;
        }

        this.historyList.innerHTML = this.translationHistory.map(item => `
            <div class="history-item">
                <div class="history-header">
                    <span><i class="fas fa-clock"></i> ${item.timestamp}</span>
                    <button class="btn-history-action" onclick="translator.useHistoryItem(${item.id})">
                        <i class="fas fa-redo"></i> Sử dụng lại
                    </button>
                </div>
                <div class="history-content">
                    <div class="history-text">
                        <strong>Tiếng Trung:</strong><br>
                        ${this.escapeHtml(item.original)}${item.originalFull.length > 200 ? '...' : ''}
                    </div>
                    <div class="history-text">
                        <strong>Tiếng Việt:</strong><br>
                        ${this.escapeHtml(item.translated)}${item.translatedFull.length > 200 ? '...' : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    useHistoryItem(id) {
        const item = this.translationHistory.find(h => h.id === id);
        if (item) {
            this.inputText.value = item.originalFull;
            this.displayResult(item.translatedFull);
            this.updateCharCount();
            this.copyBtn.disabled = false;
            this.showToast('Đã tải lại từ lịch sử', 'success', 'fa-history');
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    clearHistory() {
        if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử dịch?')) {
            this.translationHistory = [];
            localStorage.removeItem('translationHistory');
            this.renderHistory();
            this.showToast('Đã xóa lịch sử', 'success', 'fa-trash');
        }
    }

    showToast(message, type = 'success', icon = 'fa-check') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${this.escapeHtml(message)}</span>
        `;

        this.toastContainer.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the translator
const translator = new ChineseTranslator();

// Service Worker for PWA (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .catch(err => console.log('SW registration failed'));
    });
}
