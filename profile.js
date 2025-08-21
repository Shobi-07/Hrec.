(function() {
	const fields = {
		name: document.getElementById('name'),
		phone: document.getElementById('phone'),
		birthdate: document.getElementById('birthdate'),
		age: document.getElementById('age')
	};
	const form = document.getElementById('profileForm');
	const resetBtn = document.getElementById('resetBtn');
	const saveStatus = document.getElementById('saveStatus');

	// Avatar
	const avatar = document.getElementById('avatar');
	const avatarInput = document.getElementById('avatarInput');
	const changePhoto = document.getElementById('changePhoto');
	const removePhoto = document.getElementById('removePhoto');
	const logoutBtn = document.getElementById('logoutBtn');

	// Theme
	const themeSelect = document.getElementById('themeSelect');

	const KEY = 'hrec.profile';
	const AVATAR_KEY = 'hrec.profile.avatar';

	function loadProfile() {
		try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
	}
	function saveProfile(data) { localStorage.setItem(KEY, JSON.stringify(data)); }

	function render() {
		const data = loadProfile();
		fields.name.value = data.name || '';
		fields.phone.value = data.phone || '';
		fields.birthdate.value = data.birthdate || '';
		fields.age.value = data.age || '';
		const avatarUrl = localStorage.getItem(AVATAR_KEY) || '';
		avatar.src = avatarUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="%239aa4b2" font-family="Arial" font-size="18">No Photo</text></svg>';
		if (window.__hrecTheme) themeSelect.value = window.__hrecTheme.get();
	}

	function calcAgeFromBirthdate(dateStr) {
		if (!dateStr) return '';
		const dob = new Date(dateStr);
		const today = new Date();
		let age = today.getFullYear() - dob.getFullYear();
		const m = today.getMonth() - dob.getMonth();
		if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
		return String(Math.max(0, age));
	}

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const data = {
			name: fields.name.value.trim(),
			phone: fields.phone.value.trim(),
			birthdate: fields.birthdate.value,
			age: fields.age.value.trim() || calcAgeFromBirthdate(fields.birthdate.value)
		};
		saveProfile(data);
		saveStatus.textContent = 'Saved!';
		setTimeout(() => saveStatus.textContent = '', 1500);
	});

	resetBtn.addEventListener('click', () => {
		localStorage.removeItem(KEY);
		localStorage.removeItem(AVATAR_KEY);
		render();
	});

	fields.birthdate.addEventListener('change', () => {
		if (!fields.age.value) fields.age.value = calcAgeFromBirthdate(fields.birthdate.value);
	});

	changePhoto.addEventListener('click', () => avatarInput.click());
	avatar.addEventListener('click', () => avatarInput.click());
	avatarInput.addEventListener('change', () => {
		const file = avatarInput.files && avatarInput.files[0];
		if (!file) return;
		const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3 MB
		if (!file.type.startsWith('image/')) { saveStatus.textContent = 'Please choose an image file.'; return; }
		if (file.size > MAX_IMAGE_SIZE) { saveStatus.textContent = 'Image must be ≤ 3 MB.'; return; }
		const reader = new FileReader();
		reader.onload = () => {
			localStorage.setItem(AVATAR_KEY, String(reader.result));
			saveStatus.textContent = 'Photo updated!';
			setTimeout(() => saveStatus.textContent = '', 1200);
			render();
		};
		reader.readAsDataURL(file);
		avatarInput.value = '';
	});

	removePhoto.addEventListener('click', () => { localStorage.removeItem(AVATAR_KEY); render(); });

	logoutBtn.addEventListener('click', () => {
		// Simulate logout: clear profile data and redirect to home
		localStorage.removeItem(KEY);
		localStorage.removeItem(AVATAR_KEY);
		window.location.href = 'index.html';
	});

	themeSelect.addEventListener('change', () => { if (window.__hrecTheme) window.__hrecTheme.set(themeSelect.value); });

	// Initial render
	render();
})();


