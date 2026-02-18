/* ============================================================
   COLOR PALETTE GENERATOR — Application Logic
   K-means++ color extraction, dynamic theming, clipboard copy
   ============================================================ */

(function () {
    'use strict';

    // ---- DOM Elements ----
    const uploadSection = document.getElementById('uploadSection');
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const previewSection = document.getElementById('previewSection');
    const imagePreview = document.getElementById('imagePreview');
    const replaceBtn = document.getElementById('replaceBtn');
    const controlsSection = document.getElementById('controlsSection');
    const colorCountSlider = document.getElementById('colorCount');
    const sliderValue = document.getElementById('sliderValue');
    const generateBtn = document.getElementById('generateBtn');
    const paletteSection = document.getElementById('paletteSection');
    const paletteGrid = document.getElementById('paletteGrid');
    const hiddenCanvas = document.getElementById('hiddenCanvas');
    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toastText');

    let currentImageData = null; // Stores ImageData from canvas
    let currentLang = 'pl'; // Default language

    // ---- Translations ----
    const translations = {
        pl: {
            title: 'Color Palette Generator',
            subtitle: 'Wyciągnij paletę kolorów ze swojego zdjęcia',
            uploadTitle: 'Przeciągnij zdjęcie tutaj',
            uploadSubtitle: 'lub kliknij, aby wybrać plik',
            replaceImage: 'Podmień zdjęcie',
            colorCountLabel: 'Liczba kolorów w palecie',
            generateBtn: 'Generuj paletę',
            generating: 'Generowanie...',
            paletteTitle: 'Twoja paleta kolorów',
            copied: 'Skopiowano',
            copyHex: 'Kopiuj HEX',
            copyRgb: 'Kopiuj RGB'
        },
        en: {
            title: 'Color Palette Generator',
            subtitle: 'Extract a color palette from your image',
            uploadTitle: 'Drag your image here',
            uploadSubtitle: 'or click to browse files',
            replaceImage: 'Replace image',
            colorCountLabel: 'Number of colors in palette',
            generateBtn: 'Generate palette',
            generating: 'Generating...',
            paletteTitle: 'Your color palette',
            copied: 'Copied',
            copyHex: 'Copy HEX',
            copyRgb: 'Copy RGB'
        }
    };

    function t(key) {
        return translations[currentLang][key] || key;
    }

    // ---- Initialize ----
    init();

    function init() {
        // Upload zone click
        uploadZone.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', handleFileSelect);

        // Drag & drop
        uploadZone.addEventListener('dragenter', handleDragEnter);
        uploadZone.addEventListener('dragover', handleDragOver);
        uploadZone.addEventListener('dragleave', handleDragLeave);
        uploadZone.addEventListener('drop', handleDrop);

        // Replace button
        replaceBtn.addEventListener('click', resetToUpload);

        // Slider
        colorCountSlider.addEventListener('input', () => {
            sliderValue.textContent = colorCountSlider.value;
        });

        // Generate button
        generateBtn.addEventListener('click', generatePalette);

        // Language toggle
        const langToggle = document.getElementById('langToggle');
        langToggle.addEventListener('click', toggleLanguage);
    }

    // ---- Language ----
    function toggleLanguage() {
        currentLang = currentLang === 'pl' ? 'en' : 'pl';
        applyLanguage();
        // Re-render palette if visible (so copy button titles update)
        if (!paletteSection.classList.contains('hidden') && currentImageData) {
            generatePalette();
        }
    }

    function applyLanguage() {
        const langFlag = document.getElementById('langFlag');
        const langCode = document.getElementById('langCode');

        // Toggle shows the OTHER language (the one you'd switch TO)
        if (currentLang === 'pl') {
            langFlag.textContent = '🇬🇧';
            langCode.textContent = 'EN';
            document.documentElement.lang = 'pl';
        } else {
            langFlag.textContent = '🇵🇱';
            langCode.textContent = 'PL';
            document.documentElement.lang = 'en';
        }

        // Update all data-i18n elements
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[currentLang][key]) {
                el.textContent = translations[currentLang][key];
            }
        });
    }

    // ---- File Handling ----
    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) loadImage(file);
    }

    function handleDragEnter(e) {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    }

    function handleDragOver(e) {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            loadImage(file);
        }
    }

    function loadImage(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                // Draw on hidden canvas for pixel extraction
                const ctx = hiddenCanvas.getContext('2d');
                // Limit canvas size for performance (max 300px on longest side)
                const maxSize = 300;
                let w = img.width;
                let h = img.height;
                if (w > h) {
                    if (w > maxSize) { h = (h / w) * maxSize; w = maxSize; }
                } else {
                    if (h > maxSize) { w = (w / h) * maxSize; h = maxSize; }
                }
                hiddenCanvas.width = Math.floor(w);
                hiddenCanvas.height = Math.floor(h);
                ctx.drawImage(img, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
                currentImageData = ctx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);

                // Show preview
                imagePreview.src = e.target.result;
                uploadSection.classList.add('hidden');
                previewSection.classList.remove('hidden');
                controlsSection.classList.remove('hidden');

                // Auto-generate palette
                generatePalette();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function resetToUpload() {
        uploadSection.classList.remove('hidden');
        previewSection.classList.add('hidden');
        controlsSection.classList.add('hidden');
        paletteSection.classList.add('hidden');
        paletteGrid.innerHTML = '';
        fileInput.value = '';
        currentImageData = null;
        // Reset accent colors
        resetAccentColors();
    }

    // ---- Color Extraction (K-Means++) ----

    function generatePalette() {
        if (!currentImageData) return;

        generateBtn.classList.add('loading');
        generateBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="animation: spin 1s linear infinite;">
                <path d="M10 2A8 8 0 1 0 18 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            ${t('generating')}
        `;

        // Use setTimeout to allow UI to update before heavy computation
        setTimeout(() => {
            const k = parseInt(colorCountSlider.value);
            const pixels = extractPixels(currentImageData);
            const palette = kMeansClustering(pixels, k);

            renderPalette(palette);
            updateAccentColors(palette);

            generateBtn.classList.remove('loading');
            generateBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2V5M10 15V18M18 10H15M5 10H2M15.66 4.34L13.54 6.46M6.46 13.54L4.34 15.66M15.66 15.66L13.54 13.54M6.46 6.46L4.34 4.34" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <span data-i18n="generateBtn">${t('generateBtn')}</span>
            `;
        }, 50);
    }

    function extractPixels(imageData) {
        const data = imageData.data;
        const pixels = [];
        // Sample every 4th pixel for performance
        for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            // Skip transparent/near-transparent pixels
            if (a < 128) continue;
            pixels.push([r, g, b]);
        }
        return pixels;
    }

    function kMeansClustering(pixels, k) {
        if (pixels.length === 0) return [[128, 128, 128]];
        if (pixels.length <= k) return pixels.slice(0, k);

        // K-Means++ initialization
        const centroids = kMeansPlusPlusInit(pixels, k);

        // Run iterations
        const maxIter = 20;
        let assignments = new Array(pixels.length).fill(0);

        for (let iter = 0; iter < maxIter; iter++) {
            // Assign pixels to nearest centroid
            let changed = false;
            for (let i = 0; i < pixels.length; i++) {
                let minDist = Infinity;
                let bestCluster = 0;
                for (let j = 0; j < k; j++) {
                    const dist = colorDistanceSq(pixels[i], centroids[j]);
                    if (dist < minDist) {
                        minDist = dist;
                        bestCluster = j;
                    }
                }
                if (assignments[i] !== bestCluster) {
                    assignments[i] = bestCluster;
                    changed = true;
                }
            }
            if (!changed) break;

            // Recompute centroids
            const sums = Array.from({ length: k }, () => [0, 0, 0]);
            const counts = new Array(k).fill(0);
            for (let i = 0; i < pixels.length; i++) {
                const c = assignments[i];
                sums[c][0] += pixels[i][0];
                sums[c][1] += pixels[i][1];
                sums[c][2] += pixels[i][2];
                counts[c]++;
            }
            for (let j = 0; j < k; j++) {
                if (counts[j] > 0) {
                    centroids[j] = [
                        Math.round(sums[j][0] / counts[j]),
                        Math.round(sums[j][1] / counts[j]),
                        Math.round(sums[j][2] / counts[j])
                    ];
                }
            }
        }

        // Sort centroids by luminance (dark → light)
        centroids.sort((a, b) => luminance(a) - luminance(b));

        return centroids;
    }

    function kMeansPlusPlusInit(pixels, k) {
        const centroids = [];
        // Pick first centroid randomly
        centroids.push(pixels[Math.floor(Math.random() * pixels.length)].slice());

        for (let i = 1; i < k; i++) {
            // Compute distances from each pixel to nearest centroid
            const distances = pixels.map(p => {
                let minDist = Infinity;
                for (const c of centroids) {
                    const d = colorDistanceSq(p, c);
                    if (d < minDist) minDist = d;
                }
                return minDist;
            });

            // Weighted random selection
            const totalDist = distances.reduce((a, b) => a + b, 0);
            let target = Math.random() * totalDist;
            let chosen = 0;
            for (let j = 0; j < distances.length; j++) {
                target -= distances[j];
                if (target <= 0) {
                    chosen = j;
                    break;
                }
            }
            centroids.push(pixels[chosen].slice());
        }

        return centroids;
    }

    function colorDistanceSq(a, b) {
        const dr = a[0] - b[0];
        const dg = a[1] - b[1];
        const db = a[2] - b[2];
        return dr * dr + dg * dg + db * db;
    }

    function luminance(rgb) {
        return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    }

    // ---- Rendering ----

    function renderPalette(colors) {
        paletteGrid.innerHTML = '';
        paletteSection.classList.remove('hidden');

        colors.forEach((color, index) => {
            const hex = rgbToHex(color[0], color[1], color[2]);
            const rgbStr = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

            const card = document.createElement('div');
            card.className = 'swatch-card';
            card.style.animationDelay = `${index * 0.07}s`;

            card.innerHTML = `
                <div class="swatch-color" style="background-color: ${hex};"></div>
                <div class="swatch-info">
                    <div class="color-value">
                        <div>
                            <div class="color-label">HEX</div>
                            <div class="color-text">${hex}</div>
                        </div>
                        <button class="copy-btn" data-copy="${hex}" title="${t('copyHex')}">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <rect x="4" y="4" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
                                <path d="M10 4V2.5C10 1.67 9.33 1 8.5 1H2.5C1.67 1 1 1.67 1 2.5V8.5C1 9.33 1.67 10 2.5 10H4" stroke="currentColor" stroke-width="1.5"/>
                            </svg>
                        </button>
                    </div>
                    <div class="color-value">
                        <div>
                            <div class="color-label">RGB</div>
                            <div class="color-text">${rgbStr}</div>
                        </div>
                        <button class="copy-btn" data-copy="${rgbStr}" title="${t('copyRgb')}">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <rect x="4" y="4" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
                                <path d="M10 4V2.5C10 1.67 9.33 1 8.5 1H2.5C1.67 1 1 1.67 1 2.5V8.5C1 9.33 1.67 10 2.5 10H4" stroke="currentColor" stroke-width="1.5"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;

            paletteGrid.appendChild(card);
        });

        // Attach copy listeners
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = btn.dataset.copy;
                copyToClipboard(text);
                btn.classList.add('copied');
                setTimeout(() => btn.classList.remove('copied'), 1200);
            });
        });
    }

    // ---- Dynamic Theme ----

    function updateAccentColors(colors) {
        const root = document.documentElement;
        for (let i = 0; i < 6; i++) {
            const color = colors[i % colors.length];
            const hex = rgbToHex(color[0], color[1], color[2]);
            root.style.setProperty(`--accent-${i + 1}`, hex);
        }
    }

    function resetAccentColors() {
        const defaults = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];
        const root = document.documentElement;
        defaults.forEach((c, i) => {
            root.style.setProperty(`--accent-${i + 1}`, c);
        });
    }

    // ---- Utilities ----

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(`${t('copied')}: ${text}`);
        }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast(`Skopiowano: ${text}`);
        });
    }

    let toastTimeout;
    function showToast(message) {
        toastText.textContent = message;
        toast.classList.remove('hidden');
        // Force reflow for transition
        toast.offsetHeight;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 200);
        }, 2000);
    }

    // CSS for spinner animation (injected)
    const style = document.createElement('style');
    style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);

})();
