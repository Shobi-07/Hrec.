// Utilities for localStorage
const storageKeys = {
	about: 'hrec.about',
	widgets: 'hrec.widgets'
};

/** @returns {Array<{id:string,title:string,value:string}>} */
function getWidgets() {
	try {
		const raw = localStorage.getItem(storageKeys.widgets);
		return raw ? JSON.parse(raw) : [];
	} catch (_) {
		return [];
	}
}

function setWidgets(widgets) {
	localStorage.setItem(storageKeys.widgets, JSON.stringify(widgets));
}

function uid() {
	return Math.random().toString(36).slice(2, 10);
}

// Elements
const aboutInput = document.getElementById('aboutInput');
const aboutPreview = document.getElementById('aboutPreview');
const saveAboutBtn = document.getElementById('saveAboutBtn');

const addWidgetBtn = document.getElementById('addWidgetBtn');
const resetBtn = document.getElementById('resetBtn');
const grid = document.getElementById('dashboardGrid');

// Modal elements
const dialog = document.getElementById('widgetDialog');
const widgetForm = document.getElementById('widgetForm');
const widgetTitle = document.getElementById('widgetTitle');
const widgetValue = document.getElementById('widgetValue');
const cancelDialog = document.getElementById('cancelDialog');

let editingId = null;

// About section
const savedAbout = localStorage.getItem(storageKeys.about) || '';
aboutInput.value = savedAbout;
aboutPreview.textContent = savedAbout ? savedAbout : '';

saveAboutBtn.addEventListener('click', () => {
	const value = aboutInput.value.trim();
	localStorage.setItem(storageKeys.about, value);
	aboutPreview.textContent = value;
});

// Dashboard
function renderGrid() {
	const widgets = getWidgets();
	grid.innerHTML = '';
	if (widgets.length === 0) {
		for (let i = 0; i < 4; i++) {
			const placeholder = document.createElement('div');
			placeholder.className = 'card';
			placeholder.innerHTML = `<div class="card-title">&nbsp;</div><div class="card-value">&nbsp;</div>`;
			grid.appendChild(placeholder);
		}
		return;
	}

	for (const w of widgets) {
		const el = document.createElement('div');
		el.className = 'card';
		el.innerHTML = `
			<div class="card-title">${escapeHtml(w.title)}</div>
			<div class="card-value">${escapeHtml(w.value)}</div>
			<div class="card-actions">
				<button class="icon-btn" data-action="edit" data-id="${w.id}">Edit</button>
				<button class="icon-btn" data-action="delete" data-id="${w.id}">Delete</button>
			</div>
		`;
		grid.appendChild(el);
	}
}

grid.addEventListener('click', (e) => {
	const target = e.target;
	if (!(target instanceof HTMLElement)) return;
	const action = target.getAttribute('data-action');
	const id = target.getAttribute('data-id');
	if (!action || !id) return;
	if (action === 'edit') {
		openDialog(id);
	} else if (action === 'delete') {
		const widgets = getWidgets().filter(w => w.id !== id);
		setWidgets(widgets);
		renderGrid();
	}
});

addWidgetBtn.addEventListener('click', () => openDialog());
resetBtn.addEventListener('click', () => {
	localStorage.removeItem(storageKeys.about);
	localStorage.removeItem(storageKeys.widgets);
	aboutInput.value = '';
	aboutPreview.textContent = '';
	renderGrid();
});

// Modal behavior
function openDialog(id) {
	const widgets = getWidgets();
	editingId = id || null;
	const current = widgets.find(w => w.id === id);
	widgetTitle.value = current ? current.title : '';
	widgetValue.value = current ? current.value : '';
	dialog.classList.remove('hidden');
	widgetTitle.focus();
}

function closeDialog() {
	dialog.classList.add('hidden');
	widgetForm.reset();
	editingId = null;
}

cancelDialog.addEventListener('click', closeDialog);
dialog.addEventListener('click', (e) => {
	if (e.target === dialog) closeDialog();
});

widgetForm.addEventListener('submit', (e) => {
	e.preventDefault();
	const title = widgetTitle.value.trim();
	const value = widgetValue.value.trim();
	if (!title || !value) return;
	const widgets = getWidgets();
	if (editingId) {
		const idx = widgets.findIndex(w => w.id === editingId);
		if (idx !== -1) widgets[idx] = { id: editingId, title, value };
	} else {
		widgets.push({ id: uid(), title, value });
	}
	setWidgets(widgets);
	renderGrid();
	closeDialog();
});

function escapeHtml(str) {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

// Initial bootstrap
renderGrid();


