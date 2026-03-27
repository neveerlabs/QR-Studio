const API_BASE = window.location.origin + '/api';
let deviceId = localStorage.getItem('deviceId');
let currentRole = 'user';
let currentQRDataURL = null;
let currentText = '';
let currentSekolahData = null;
let html5QrCode = null;
let scanning = false;
let overlayCanvas = null;
let overlayCtx = null;
let animationFrame = null;
let lastBoundingBox = null;

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    clearTimeout(window.toastTimeout);
    toast.innerHTML = '';
    let icon = '';
    if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
    else if (type === 'error') icon = '<i class="fas fa-exclamation-circle"></i>';
    else icon = '<i class="fas fa-info-circle"></i>';
    toast.innerHTML = `${icon}<span>${message}</span>`;
    toast.className = `toast ${type} show`;
    window.toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function checkDevice() {
    try {
        const url = deviceId ? `${API_BASE}/check-device?device_id=${deviceId}` : `${API_BASE}/check-device`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.role === 'admin') {
            currentRole = 'admin';
            deviceId = data.device_id;
            localStorage.setItem('deviceId', deviceId);
            document.getElementById('profileBtn').innerHTML = '<i class="fas fa-user-check"></i>';
        } else {
            currentRole = 'user';
            localStorage.removeItem('deviceId');
            deviceId = null;
            document.getElementById('profileBtn').innerHTML = '<i class="fas fa-user-circle"></i>';
        }
        applyRoleUI();
    } catch (err) {
        console.error(err);
        currentRole = 'user';
        applyRoleUI();
    }
}

function applyRoleUI() {
    const adminPanel = document.getElementById('adminPanel');
    const userTabs = document.getElementById('tabsContainer');
    if (currentRole === 'admin') {
        adminPanel.style.display = 'block';
        userTabs.style.display = 'none';
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById('adminPanel').classList.add('active');
        document.querySelector('#scanTabBtn').classList.add('active');
        document.getElementById('scanAdminPanel').style.display = 'block';
        document.getElementById('absensiAdminPanel').style.display = 'none';
        loadAbsensiData();
    } else {
        adminPanel.style.display = 'none';
        userTabs.style.display = 'flex';
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById('generatePanel').classList.add('active');
        document.querySelector('.tab-btn[data-tab="generate"]').classList.add('active');
    }
}

async function login(username, password) {
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            deviceId = data.device_id;
            localStorage.setItem('deviceId', deviceId);
            currentRole = 'admin';
            showToast('Login berhasil', 'success');
            checkDevice();
            document.getElementById('modalLogin').style.display = 'none';
            const errorDiv = document.getElementById('loginError');
            if (errorDiv) errorDiv.style.display = 'none';
        } else {
            const errorDiv = document.getElementById('loginError');
            if (errorDiv) {
                errorDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Username atau password salah';
                errorDiv.style.display = 'block';
            } else {
                showToast('Username atau password salah', 'error');
            }
        }
    } catch (err) {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Gagal terhubung ke server';
            errorDiv.style.display = 'block';
        } else {
            showToast('Gagal login', 'error');
        }
    }
}

async function logout() {
    if (deviceId) {
        await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: deviceId })
        });
    }
    localStorage.removeItem('deviceId');
    deviceId = null;
    currentRole = 'user';
    showToast('Logout berhasil', 'success');
    checkDevice();
}

function showLoginModal() {
    document.getElementById('modalLogin').style.display = 'flex';
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) errorDiv.style.display = 'none';
}

function showProfileModal() {
    const modal = document.getElementById('modalProfile');
    const infoDiv = document.getElementById('profileInfo');
    if (currentRole === 'admin') {
        infoDiv.innerHTML = `<p><i class="fas fa-user-shield"></i> Status: Admin</p>`;
        document.getElementById('logoutBtn').style.display = 'flex';
    } else {
        infoDiv.innerHTML = `<p><i class="fas fa-user"></i> Status: User (Belum Login)</p>`;
        document.getElementById('logoutBtn').style.display = 'none';
    }
    modal.style.display = 'flex';
}

function closeModals() {
    document.getElementById('modalLogin').style.display = 'none';
    document.getElementById('modalProfile').style.display = 'none';
}

document.getElementById('profileBtn').addEventListener('click', () => {
    if (currentRole === 'admin') showProfileModal();
    else showLoginModal();
});
document.getElementById('loginSubmit').addEventListener('click', () => {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    login(username, password);
});
document.getElementById('loginClose').addEventListener('click', closeModals);
document.getElementById('profileClose').addEventListener('click', closeModals);
document.getElementById('logoutBtn').addEventListener('click', () => {
    logout();
    closeModals();
});

const DB_NAME = 'QRKeeperDB';
const DB_VERSION = 1;
const STORE_NAME = 'qrcodes';
let db = null;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

async function getAllQRCodes() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveQRCodeLocal(data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteQRCodeLocal(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

let qrLibraryLoaded = false;
let qrLibraryPromise = null;

function loadQRCodeLibrary() {
    if (qrLibraryPromise) return qrLibraryPromise;
    qrLibraryPromise = new Promise((resolve, reject) => {
        if (typeof QRCode !== 'undefined') {
            qrLibraryLoaded = true;
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        script.onload = () => {
            qrLibraryLoaded = true;
            resolve();
        };
        script.onerror = () => {
            const fallback = document.createElement('script');
            fallback.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
            fallback.onload = () => {
                qrLibraryLoaded = true;
                resolve();
            };
            fallback.onerror = () => reject(new Error('Gagal memuat library QR Code'));
            document.head.appendChild(fallback);
        };
        document.head.appendChild(script);
    });
    return qrLibraryPromise;
}

function generateQRDataURL(text) {
    return new Promise(async (resolve, reject) => {
        try {
            await loadQRCodeLibrary();
            const tempDiv = document.createElement('div');
            if (typeof QRCode !== 'undefined' && QRCode.toString().includes('toDataURL')) {
                QRCode.toDataURL(text, { width: 256, margin: 1 }, (err, url) => {
                    if (err) reject(err);
                    else resolve(url);
                });
            } else {
                new QRCode(tempDiv, {
                    text: text,
                    width: 256,
                    height: 256,
                    correctLevel: QRCode.CorrectLevel.M
                });
                setTimeout(() => {
                    const canvas = tempDiv.querySelector('canvas');
                    if (canvas) {
                        resolve(canvas.toDataURL('image/png'));
                    } else {
                        const img = tempDiv.querySelector('img');
                        if (img && img.src) resolve(img.src);
                        else reject('Gagal generate QR');
                    }
                }, 60);
            }
        } catch (err) {
            reject(err);
        }
    });
}

async function renderVault() {
    if (!db) await openDB();
    const items = await getAllQRCodes();
    const container = document.getElementById('vaultList');
    if (!items.length) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-archive"></i><br>Belum ada QR barcode yang tersimpan</div>`;
        return;
    }
    container.innerHTML = '';
    items.slice().reverse().forEach(item => {
        const div = document.createElement('div');
        div.className = 'qr-item';
        div.innerHTML = `
            <div class="qr-item-info">
                <div class="qr-item-title"><i class="fas fa-qrcode"></i> ${escapeHtml(item.title || 'Tanpa Judul')}</div>
                <div class="qr-item-meta"><i class="far fa-calendar-alt"></i> ${new Date(item.createdAt).toLocaleString()}</div>
                <div class="qr-item-meta" style="font-size: 0.65rem; opacity: 0.7;">${escapeHtml(item.text.substring(0, 50))}${item.text.length > 50 ? '...' : ''}</div>
            </div>
            <div class="qr-item-actions">
                <button class="btn-secondary viewVault" data-id="${item.id}"><i class="fas fa-eye"></i> Lihat</button>
                <button class="btn-secondary downloadVault" data-id="${item.id}"><i class="fas fa-download"></i> Simpan</button>
                <button class="btn-secondary btn-danger deleteVault" data-id="${item.id}" data-title="${escapeHtml(item.title)}"><i class="fas fa-trash-alt"></i> Hapus</button>
            </div>
        `;
        container.appendChild(div);
    });

    document.querySelectorAll('.viewVault').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.getAttribute('data-id'));
            const all = await getAllQRCodes();
            const found = all.find(i => i.id === id);
            if (found && found.qrDataURL) {
                const modal = document.createElement('div');
                modal.style.position = 'fixed';
                modal.style.top = '0'; modal.style.left = '0';
                modal.style.width = '100%'; modal.style.height = '100%';
                modal.style.background = 'rgba(0,0,0,0.85)';
                modal.style.backdropFilter = 'blur(12px)';
                modal.style.display = 'flex';
                modal.style.justifyContent = 'center';
                modal.style.alignItems = 'center';
                modal.style.zIndex = '2000';
                modal.innerHTML = `
                    <div style="background: #11161f; border-radius: 2rem; padding: 1.5rem; max-width: 85vw; text-align: center; border: 1px solid #4f46e5;">
                        <img src="${found.qrDataURL}" style="max-width: 70vw; max-height: 70vh; border-radius: 1rem; background: white; padding: 12px;">
                        <button class="btn-secondary" style="margin-top: 1rem;" id="closeModalBtn"><i class="fas fa-times"></i> Tutup</button>
                    </div>
                `;
                document.body.appendChild(modal);
                document.getElementById('closeModalBtn').addEventListener('click', () => modal.remove());
                modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
            } else showToast('QR tidak ditemukan', 'error');
        });
    });
    document.querySelectorAll('.downloadVault').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.getAttribute('data-id'));
            const all = await getAllQRCodes();
            const found = all.find(i => i.id === id);
            if (found && found.qrDataURL) {
                const a = document.createElement('a');
                a.download = 'barcode.png';
                a.href = found.qrDataURL;
                a.click();
                showToast('QR berhasil disimpan ke device', 'success');
            } else showToast('Gagal download', 'error');
        });
    });
    document.querySelectorAll('.deleteVault').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.getAttribute('data-id'));
            const title = btn.getAttribute('data-title');
            if (confirm(`Hapus QR "${title}"?`)) {
                await deleteQRCodeLocal(id);
                renderVault();
                showToast('QR berhasil dihapus', 'success');
            }
        });
    });
}

function buildSekolahForm() {
    return `
        <div class="input-group"><label><i class="fas fa-user"></i> Nama Lengkap</label><input type="text" id="namaLengkap" required></div>
        <div class="input-group"><label><i class="fas fa-user-tag"></i> Nama Panggilan</label><input type="text" id="namaPanggilan" required></div>
        <div class="input-group"><label><i class="fas fa-briefcase"></i> Role</label><select id="roleSelect"><option value="siswa">Siswa</option><option value="guru">Guru</option></select></div>
        <div id="roleFields"></div>
        <div class="input-group"><label><i class="fas fa-calendar-alt"></i> Tempat Tanggal Lahir</label><input type="text" id="ttl" placeholder="Contoh: Jakarta, 10 Mei 2005" required></div>
    `;
}

function updateRoleFields() {
    const role = document.getElementById('roleSelect').value;
    const container = document.getElementById('roleFields');
    if (role === 'siswa') {
        container.innerHTML = `
            <div class="input-group"><label><i class="fas fa-school"></i> Status</label><select id="statusSiswa"><option value="SMP">SMP</option><option value="SMK">SMK</option></select></div>
            <div class="input-group"><label><i class="fas fa-id-card"></i> NIS (Opsional)</label><input type="text" id="nis"></div>
            <div class="input-group"><label><i class="fas fa-id-card"></i> NISN (Opsional)</label><input type="text" id="nisn"></div>
            <div class="input-group"><label><i class="fas fa-chalkboard"></i> Kelas</label><select id="kelas" required><option value="">Pilih Kelas</option><option value="Kelas 7">Kelas 7</option><option value="Kelas 8">Kelas 8</option><option value="Kelas 9">Kelas 9</option><option value="Kelas 10">Kelas 10</option><option value="Kelas 11">Kelas 11</option><option value="Kelas 12">Kelas 12</option></select></div>
        `;
    } else {
        container.innerHTML = `
            <div class="input-group"><label><i class="fas fa-chalkboard-teacher"></i> Status (Bagian)</label><input type="text" id="statusGuru" placeholder="Contoh: Guru Olahraga, Guru Bahasa, TU" required></div>
        `;
    }
}

document.getElementById('qrTypeSelect').addEventListener('change', function() {
    const type = this.value;
    if (type === 'catatan') {
        document.getElementById('catatanFields').style.display = 'block';
        document.getElementById('sekolahFields').style.display = 'none';
        document.getElementById('sekolahFields').innerHTML = '';
    } else {
        document.getElementById('catatanFields').style.display = 'none';
        document.getElementById('sekolahFields').style.display = 'block';
        document.getElementById('sekolahFields').innerHTML = buildSekolahForm();
        document.getElementById('roleSelect').addEventListener('change', updateRoleFields);
        updateRoleFields();
    }
});

document.getElementById('generateBtn').addEventListener('click', async () => {
    const type = document.getElementById('qrTypeSelect').value;
    let text = '';
    let sekolahData = null;
    if (type === 'catatan') {
        text = document.getElementById('qrTextInput').value.trim();
        if (!text) {
            showToast('Masukkan teks atau URL', 'error');
            return;
        }
        currentSekolahData = null;
        try {
            const dataURL = await generateQRDataURL(text);
            currentQRDataURL = dataURL;
            currentText = text;
            const previewDiv = document.getElementById('genPreview');
            const previewImg = document.getElementById('qrPreviewImg');
            previewImg.innerHTML = `<img src="${dataURL}" alt="QR">`;
            previewDiv.style.display = 'block';
            showToast('QR berhasil dibuat', 'success');
        } catch(e) {
            console.error('QR generation error:', e);
            showToast('Gagal membuat QR: ' + e.message, 'error');
        }
    } else {
        const namaLengkap = document.getElementById('namaLengkap').value.trim();
        const namaPanggilan = document.getElementById('namaPanggilan').value.trim();
        const role = document.getElementById('roleSelect').value;
        let status, nis = null, nisn = null, kelas = null;
        if (role === 'siswa') {
            status = document.getElementById('statusSiswa').value;
            nis = document.getElementById('nis').value.trim() || null;
            nisn = document.getElementById('nisn').value.trim() || null;
            kelas = document.getElementById('kelas').value.trim();
        } else {
            status = document.getElementById('statusGuru').value.trim();
        }
        const ttl = document.getElementById('ttl').value.trim();
        if (!namaLengkap || !namaPanggilan || !ttl || (role === 'siswa' && !kelas) || (role === 'guru' && !status)) {
            showToast('Semua field wajib diisi', 'error');
            return;
        }
        sekolahData = { nama_lengkap: namaLengkap, nama_panggilan: namaPanggilan, role, status, nis, nisn, kelas, tempat_tanggal_lahir: ttl };
        try {
            const res = await fetch(`${API_BASE}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sekolahData)
            });
            const result = await res.json();
            if (!result.success) {
                showToast('Gagal menyimpan data ke server: ' + result.message, 'error');
                return;
            }
            const id = result.id;
            const dataWithId = { ...sekolahData, id };
            text = JSON.stringify(dataWithId);
            currentSekolahData = dataWithId;
            const dataURL = await generateQRDataURL(text);
            currentQRDataURL = dataURL;
            currentText = text;
            const previewDiv = document.getElementById('genPreview');
            const previewImg = document.getElementById('qrPreviewImg');
            previewImg.innerHTML = `<img src="${dataURL}" alt="QR">`;
            previewDiv.style.display = 'block';
            showToast('QR berhasil dibuat dan data tersimpan di server', 'success');
        } catch (err) {
            console.error('Error in sekolah QR generation:', err);
            showToast('Gagal membuat QR: ' + (err.message || 'Unknown error'), 'error');
        }
    }
});

document.getElementById('saveGenBtn').addEventListener('click', async () => {
    if (!currentQRDataURL) {
        showToast('Hasilkan QR terlebih dahulu', 'error');
        return;
    }
    const type = document.getElementById('qrTypeSelect').value;
    const title = prompt('Masukkan judul untuk QR ini:', 'QR ' + new Date().toLocaleString());
    const newQR = {
        title: title || 'QR ' + new Date().toLocaleString(),
        text: currentText,
        qrDataURL: currentQRDataURL,
        createdAt: new Date().toISOString(),
        type: type
    };
    try {
        await saveQRCodeLocal(newQR);
        showToast('QR tersimpan di vault', 'success');
        renderVault();
    } catch(e) {
        showToast('Gagal simpan ke vault', 'error');
    }
});

function switchTab(tabId) {
    document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
    document.getElementById(`${tabId}Panel`).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    if (tabId === 'vault') renderVault();
}

document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        switchTab(target);
    });
});

function drawOverlay() {
    if (!overlayCtx || !overlayCanvas) return;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (lastBoundingBox && lastBoundingBox.length === 4) {
        const [x, y, width, height] = lastBoundingBox;
        overlayCtx.strokeStyle = '#4f46e5';
        overlayCtx.fillStyle = 'rgba(79, 70, 229, 0.2)';
        overlayCtx.lineWidth = 3;
        overlayCtx.strokeRect(x, y, width, height);
        overlayCtx.fillRect(x, y, width, height);
    }
    animationFrame = requestAnimationFrame(drawOverlay);
}

async function startScanner() {
    if (scanning) {
        showToast('Scanner sudah aktif', 'info');
        return;
    }
    const scannerElem = document.getElementById('qr-reader');
    if (!scannerElem) {
        showToast('Elemen scanner tidak ditemukan', 'error');
        return;
    }
    overlayCanvas = document.getElementById('overlayCanvas');
    overlayCtx = overlayCanvas.getContext('2d');
    const updateCanvasSize = () => {
        const video = scannerElem.querySelector('video');
        if (video && video.videoWidth > 0) {
            overlayCanvas.width = video.videoWidth;
            overlayCanvas.height = video.videoHeight;
            overlayCanvas.style.width = '100%';
            overlayCanvas.style.height = '100%';
        }
    };
    html5QrCode = new Html5Qrcode("qr-reader");
    try {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const facingMode = isMobile ? { exact: "environment" } : "environment";
        await html5QrCode.start(
            { facingMode: facingMode },
            {
                fps: 15,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            async (decodedText, decodedResult) => {
                if (decodedResult && decodedResult.result && decodedResult.result.boundingBox) {
                    const box = decodedResult.result.boundingBox;
                    if (Array.isArray(box) && box.length === 4) {
                        const minX = Math.min(...box.map(p => p.x));
                        const minY = Math.min(...box.map(p => p.y));
                        const maxX = Math.max(...box.map(p => p.x));
                        const maxY = Math.max(...box.map(p => p.y));
                        lastBoundingBox = [minX, minY, maxX - minX, maxY - minY];
                    } else if (box.x !== undefined && box.y !== undefined && box.width && box.height) {
                        lastBoundingBox = [box.x, box.y, box.width, box.height];
                    } else {
                        lastBoundingBox = null;
                    }
                } else {
                    lastBoundingBox = null;
                }
                document.getElementById('scannedText').innerText = decodedText;
                document.getElementById('scanResult').style.display = 'block';
                try {
                    const parsed = JSON.parse(decodedText);
                    if (parsed.id && parsed.nama_panggilan && parsed.role) {
                        const res = await fetch(`${API_BASE}/absen`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: parsed.id, device_id: deviceId })
                        });
                        const result = await res.json();
                        if (result.success) {
                            showToast(`Absen berhasil untuk ${parsed.nama_panggilan}`, 'success');
                            loadAbsensiData();
                        } else {
                            showToast(result.message || 'Gagal absen', 'error');
                        }
                    } else {
                        showToast('QR bukan data sekolah, hanya ditampilkan di bawah', 'info');
                    }
                } catch (e) {
                    showToast('QR bukan data sekolah, hanya ditampilkan di bawah', 'info');
                }
            },
            (error) => {}
        );
        scanning = true;
        showToast('Scanner aktif', 'info');
        animationFrame = requestAnimationFrame(drawOverlay);
        const interval = setInterval(() => {
            if (scanning) updateCanvasSize();
            else clearInterval(interval);
        }, 500);
    } catch(err) {
        console.error('Scanner start error:', err);
        let errorMsg = 'Gagal akses kamera';
        if (err.message && err.message.includes('Permission')) {
            errorMsg = 'Izin kamera ditolak. Periksa pengaturan browser.';
        } else if (err.message && err.message.includes('NotAllowedError')) {
            errorMsg = 'Izin kamera diperlukan. Klik izinkan.';
        }
        showToast(errorMsg, 'error');
        scanning = false;
        html5QrCode = null;
    }
}

function stopScanner() {
    if (html5QrCode && scanning) {
        html5QrCode.stop().then(() => {
            scanning = false;
            if (animationFrame) cancelAnimationFrame(animationFrame);
            showToast('Scanner dihentikan', 'info');
            lastBoundingBox = null;
            if (overlayCtx) overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }).catch(() => {});
    }
}

document.getElementById('startScanBtn')?.addEventListener('click', startScanner);
document.getElementById('stopScanBtn')?.addEventListener('click', stopScanner);

const fileInput = document.getElementById('fileInput');
const fileUploadArea = document.getElementById('fileUploadArea');
const uploadLabel = document.getElementById('uploadLabel');
const fileScanStatus = document.getElementById('fileScanStatus');

if (fileUploadArea) {
    fileUploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        uploadLabel.innerHTML = '<i class="fas fa-spinner spinner"></i> Memproses...';
        fileScanStatus.innerHTML = '<i class="fas fa-spinner spinner"></i> Membaca barcode...';
        const tempDiv = document.createElement('div');
        tempDiv.id = 'temp-scanner';
        tempDiv.style.display = 'none';
        document.body.appendChild(tempDiv);
        const html5QrCodeFile = new Html5Qrcode("temp-scanner");
        try {
            const result = await html5QrCodeFile.scanFile(file, true);
            document.getElementById('scannedText').innerText = result;
            document.getElementById('scanResult').style.display = 'block';
            try {
                const parsed = JSON.parse(result);
                if (parsed.id && parsed.nama_panggilan && parsed.role) {
                    const res = await fetch(`${API_BASE}/absen`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: parsed.id, device_id: deviceId })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast(`Absen berhasil untuk ${parsed.nama_panggilan}`, 'success');
                        loadAbsensiData();
                    } else {
                        showToast(data.message || 'Gagal absen', 'error');
                    }
                } else {
                    showToast('QR bukan data sekolah, hanya ditampilkan di bawah', 'info');
                }
            } catch (e) {
                showToast('QR bukan data sekolah, hanya ditampilkan di bawah', 'info');
            }
            fileScanStatus.innerHTML = '<i class="fas fa-check-circle"></i> Barcode ditemukan!';
            uploadLabel.innerHTML = '<i class="fas fa-upload"></i> Pilih gambar lain';
        } catch (err) {
            let errorMsg = 'Tidak dapat membaca barcode';
            const msg = err.message ? err.message.toLowerCase() : '';
            if (msg.includes('no qr code') || msg.includes('could not find')) {
                errorMsg = 'Tidak ditemukan barcode dalam gambar';
            } else if (msg.includes('blur') || msg.includes('out of focus')) {
                errorMsg = 'Gambar terlalu buram';
            }
            showToast(errorMsg, 'error');
            fileScanStatus.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${errorMsg}`;
            uploadLabel.innerHTML = '<i class="fas fa-upload"></i> Pilih gambar lain';
        } finally {
            fileInput.value = '';
            setTimeout(() => { fileScanStatus.innerHTML = ''; }, 3000);
            html5QrCodeFile.clear();
            tempDiv.remove();
        }
    });
}

async function loadAbsensiData() {
    const date = document.getElementById('filterDate')?.value || new Date().toISOString().slice(0,10);
    const res = await fetch(`${API_BASE}/absen?date=${date}`);
    const users = await res.json();
    const container = document.getElementById('absensiTableContainer');
    if (!container) return;
    container.innerHTML = `
        <table class="absensi-table">
            <thead>
                <tr>
                    <th>Nama Panggilan</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Kelas</th>
                    <th>Kehadiran</th>
                    <th>Aksi</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(u => `
                    <tr>
                        <td>${escapeHtml(u.nama_panggilan)}</td>
                        <td>${escapeHtml(u.role)}</td>
                        <td>${escapeHtml(u.status)}</td>
                        <td>${escapeHtml(u.kelas || '-')}</td>
                        <td class="${u.absen_tanggal ? 'hadir' : 'belum'}">${u.absen_tanggal ? '<i class="fas fa-check-circle"></i> Hadir' : '<i class="fas fa-clock"></i> Belum'}</td>
                        <td><button class="delete-user-btn" data-id="${u.id}" data-name="${escapeHtml(u.nama_panggilan)}"><i class="fas fa-trash-alt"></i></button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            if (confirm(`Hapus data ${name}?`)) {
                await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
                showToast('Data dihapus', 'success');
                loadAbsensiData();
            }
        });
    });
}

document.getElementById('scanTabBtn')?.addEventListener('click', () => {
    document.getElementById('scanAdminPanel').style.display = 'block';
    document.getElementById('absensiAdminPanel').style.display = 'none';
    document.querySelector('#scanTabBtn').classList.add('active');
    document.querySelector('#absensiTabBtn').classList.remove('active');
});
document.getElementById('absensiTabBtn')?.addEventListener('click', () => {
    document.getElementById('scanAdminPanel').style.display = 'none';
    document.getElementById('absensiAdminPanel').style.display = 'block';
    document.querySelector('#absensiTabBtn').classList.add('active');
    document.querySelector('#scanTabBtn').classList.remove('active');
    loadAbsensiData();
});
document.getElementById('applyFilterBtn')?.addEventListener('click', loadAbsensiData);

async function exportToExcel(data, filename) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Absensi');
    XLSX.writeFile(wb, filename);
}

async function backupData(role) {
    let month = prompt('Masukkan bulan (1-12):', new Date().getMonth() + 1);
    if (!month) return;
    month = parseInt(month);
    if (isNaN(month) || month < 1 || month > 12) {
        showToast('Bulan tidak valid', 'error');
        return;
    }
    let year = prompt('Masukkan tahun (YYYY):', new Date().getFullYear());
    if (!year) return;
    year = parseInt(year);
    if (isNaN(year) || year < 2000 || year > 2100) {
        showToast('Tahun tidak valid', 'error');
        return;
    }
    try {
        let url = `${API_BASE}/absen/month?month=${month}&year=${year}`;
        if (role !== 'all') url += `&role=${role}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.length) {
            showToast('Tidak ada data untuk periode ini', 'error');
            return;
        }
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const formatted = data.map(row => {
            const dateObj = new Date(row.tanggal);
            const formattedDate = `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
            return {
                'Nama Panggilan': row.nama_panggilan,
                'Nama Lengkap': row.nama_lengkap,
                'Role': row.role,
                'Status': row.status,
                'Kelas': row.kelas || '-',
                'Waktu': formattedDate,
                'Status Kehadiran': 'Hadir'
            };
        });
        const filename = `absensi_${role}_${month}_${year}.xlsx`;
        await exportToExcel(formatted, filename);
        showToast(`Backup ${role} berhasil`, 'success');
    } catch (err) {
        console.error(err);
        showToast('Gagal backup data', 'error');
    }
}

document.getElementById('backupBtn')?.addEventListener('click', () => {
    const options = ['Siswa', 'Guru', 'Semua'];
    const optionButtons = options.map(opt => `
        <button class="btn-secondary backup-option" data-role="${opt.toLowerCase()}">Backup ${opt}</button>
    `).join('');
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <h3><i class="fas fa-database"></i> Backup Data Absensi</h3>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 1rem;">
                ${optionButtons}
            </div>
            <div class="modal-buttons">
                <button id="closeBackupModal" class="btn-secondary">Batal</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.querySelectorAll('.backup-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const role = btn.getAttribute('data-role');
            modal.remove();
            backupData(role);
        });
    });
    document.getElementById('closeBackupModal').addEventListener('click', () => modal.remove());
});

window.addEventListener('load', async () => {
    await openDB();
    await checkDevice();
    renderVault();
    document.getElementById('qrTypeSelect').dispatchEvent(new Event('change'));
    await loadQRCodeLibrary();
});
