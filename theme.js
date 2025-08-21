(function() {
	const KEY = 'hrec.theme';
	function apply(theme) {
		document.documentElement.setAttribute('data-theme', theme);
		const btn = document.getElementById('themeSwitch');
		if (btn) btn.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
		window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
	}

	function getDefault() {
		try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
		catch { return 'light'; }
	}

	const current = localStorage.getItem(KEY) || getDefault();
	apply(current);

	window.__hrecTheme = {
		get: () => localStorage.getItem(KEY) || getDefault(),
		set: (theme) => { localStorage.setItem(KEY, theme); apply(theme); }
	};

	document.addEventListener('DOMContentLoaded', () => {
		const btn = document.getElementById('themeSwitch');
		if (!btn) return;
		btn.addEventListener('click', () => {
			const next = (window.__hrecTheme.get() === 'dark') ? 'light' : 'dark';
			window.__hrecTheme.set(next);
		});
		btn.textContent = window.__hrecTheme.get() === 'dark' ? '☀️ Light' : '🌙 Dark';
	});
})();


