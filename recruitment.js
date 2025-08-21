(function() {
	const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
	const ACCEPTED = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

	const dropzone = document.getElementById('dropzone');
	const input = document.getElementById('fileInput');
	const pickBtn = document.getElementById('pickBtn');
	const statusEl = document.getElementById('status');
	const listEl = document.getElementById('list');

	// IndexedDB helpers
	const DB_NAME = 'hrec';
	const STORE = 'resumes';

	function openDb() {
		return new Promise((resolve, reject) => {
			const req = indexedDB.open(DB_NAME, 1);
			req.onerror = () => reject(req.error);
			req.onupgradeneeded = () => {
				const db = req.result;
				if (!db.objectStoreNames.contains(STORE)) {
					db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
				}
			};
			req.onsuccess = () => resolve(req.result);
		});
	}

	async function withStore(mode, fn) {
		const db = await openDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE, mode);
			const store = tx.objectStore(STORE);
			const result = fn(store);
			tx.oncomplete = () => resolve(result);
			tx.onerror = () => reject(tx.error);
		});
	}

	function addResume(file) {
		return withStore('readwrite', (store) => {
			store.add({ name: file.name, type: file.type, size: file.size, createdAt: Date.now(), blob: file });
		});
	}

	function getAll() {
		return withStore('readonly', (store) => {
			return new Promise((resolve) => {
				const req = store.getAll();
				req.onsuccess = () => resolve(req.result || []);
			});
		});
	}

	function deleteOne(id) {
		return withStore('readwrite', (store) => store.delete(id));
	}

	function setStatus(msg) {
		statusEl.textContent = msg || '';
	}

	function validate(file) {
		if (!file) return 'No file selected';
		if (!ACCEPTED.includes(file.type)) return 'Only PDF, DOC, DOCX are allowed';
		if (file.size > MAX_SIZE) return 'Max size is 5 MB';
		return '';
	}

	async function handleFiles(files) {
		const file = files && files[0];
		const error = validate(file);
		if (error) { setStatus(error); return; }
		setStatus('Saving...');
		await addResume(file);
		setStatus('Uploaded successfully');
		renderList();
	}

	function renderList() {
		getAll().then(items => {
			if (!items.length) {
				listEl.innerHTML = '<p class="muted">No resumes uploaded yet.</p>';
				return;
			}
			listEl.innerHTML = '';
			for (const it of items) {
				const url = URL.createObjectURL(it.blob);
				const item = document.createElement('div');
				item.className = 'upload-item';
				item.innerHTML = `
					<div class="meta">
						<strong>${escapeHtml(it.name)}</strong>
						<span class="muted">${formatBytes(it.size)} • ${new Date(it.createdAt).toLocaleString()}</span>
					</div>
					<div class="actions">
						<a class="btn" href="${url}" download="${escapeAttr(it.name)}">Download</a>
						<button class="btn subtle" data-id="${it.id}">Delete</button>
					</div>
				`;
				listEl.appendChild(item);
			}
		});
	}

	// UI wiring
	pickBtn.addEventListener('click', () => input.click());
	input.addEventListener('change', (e) => handleFiles(e.target.files));
	
	dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
	dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
	dropzone.addEventListener('drop', (e) => {
		e.preventDefault();
		dropzone.classList.remove('dragover');
		handleFiles(e.dataTransfer.files);
	});
	dropzone.addEventListener('click', () => input.click());
	dropzone.addEventListener('keypress', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });

	listEl.addEventListener('click', async (e) => {
		const target = e.target;
		if (!(target instanceof HTMLElement)) return;
		const id = target.getAttribute('data-id');
		if (!id) return;
		await deleteOne(Number(id));
		renderList();
	});

	function formatBytes(bytes) {
		const units = ['B','KB','MB','GB'];
		let i = 0, num = bytes;
		while (num >= 1024 && i < units.length - 1) { num /= 1024; i++; }
		return `${num.toFixed(num >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
	}

	function escapeHtml(str) {
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}
	function escapeAttr(str) { return escapeHtml(str).replace(/\s+/g, '_'); }

	// Init
	renderList();
})();



