(function() {
	// Data schema: { id, round, text, options: [a,b,c,d], correctIndex }
	const DB_NAME = 'hrec';
	const STORE = 'questions';

	const adminToggle = document.getElementById('adminToggle');
	const adminPanel = document.getElementById('adminPanel');
	const exportBtn = document.getElementById('exportBtn');
	const importBtn = document.getElementById('importBtn');
	const importInput = document.getElementById('importInput');

	const form = document.getElementById('questionForm');
	const roundSelect = document.getElementById('roundSelect');
	const questionText = document.getElementById('questionText');
	const seedBtn = document.getElementById('seedBtn');
	const questionList = document.getElementById('questionList');

	const quizSection = document.getElementById('quiz');
	const quizForm = document.getElementById('quizForm');
	const quizTitle = document.getElementById('quizTitle');
	const submitQuiz = document.getElementById('submitQuiz');
	const quizResult = document.getElementById('quizResult');
	const quitQuiz = document.getElementById('quitQuiz');
	const timerEl = document.getElementById('timer');

	// Round status elements
	const statusAssessment = document.getElementById('status-assessment');
	const statusOps = document.getElementById('status-ops');
	const statusHr = document.getElementById('status-hr');
	const buttonAssessment = document.getElementById('round-assessment');
	const buttonOps = document.getElementById('round-ops');
	const buttonHr = document.getElementById('round-hr');

	// Quiz state
	const PASS_THRESHOLD = 60; // percent
	const QUIZ_SECONDS = 5 * 60; // five minutes
	let currentRound = null;
	let currentQuestions = [];
	let timerId = null;
	let remainingSeconds = 0;

	const roundButtons = document.querySelectorAll('.button-card');

	function openDb() {
		return new Promise((resolve, reject) => {
			const req = indexedDB.open(DB_NAME, 1);
			req.onupgradeneeded = () => {
				const db = req.result;
				if (!db.objectStoreNames.contains('resumes')) db.createObjectStore('resumes', { keyPath: 'id', autoIncrement: true });
				if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
			};
			req.onerror = () => reject(req.error);
			req.onsuccess = () => resolve(req.result);
		});
	}

	async function withStore(mode, fn) {
		const db = await openDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE, mode);
			const store = tx.objectStore(STORE);
			const res = fn(store);
			tx.oncomplete = () => resolve(res);
			tx.onerror = () => reject(tx.error);
		});
	}

	function addQuestion(q) { return withStore('readwrite', s => s.add(q)); }
	function deleteQuestion(id) { return withStore('readwrite', s => s.delete(id)); }
	function getAllQuestions() {
		return withStore('readonly', s => new Promise(r => { const req = s.getAll(); req.onsuccess = () => r(req.result || []); }));
	}

	function getOptionsFromForm() {
		const optionInputs = form.querySelectorAll('input.opt');
		const radios = form.querySelectorAll('input[type="radio"][name="correct"]');
		const options = Array.from(optionInputs).map(i => i.value.trim());
		const checked = Array.from(radios).find(r => r.checked);
		const correctIndex = checked ? Number(checked.value) : 0;
		return { options, correctIndex };
	}

	function clearQuestionForm() {
		questionText.value = '';
		form.querySelectorAll('input.opt').forEach((i, idx) => i.value = `Option ${idx+1}`);
		form.querySelector('input[type="radio"][value="0"]').checked = true;
	}

	function renderQuestionList() {
		getAllQuestions().then(list => {
			if (!list.length) { questionList.innerHTML = '<p class="muted">No questions added yet.</p>'; return; }
			questionList.innerHTML = '';
			for (const q of list) {
				const el = document.createElement('div');
				el.className = 'upload-item';
				el.innerHTML = `
					<div class="meta">
						<strong>[${q.round}]</strong>
						<span>${escapeHtml(q.text)}</span>
					</div>
					<div class="actions">
						<button class="btn subtle del" data-id="${q.id}">Delete</button>
					</div>
				`;
				questionList.appendChild(el);
			}
		});
	}

	function buildQuiz(round) {
		getAllQuestions().then(list => {
			currentRound = round;
			currentQuestions = list.filter(q => q.round === round);
			quizForm.innerHTML = '';
			quizResult.textContent = '';
			quizTitle.textContent = roundTitle(round);
			if (!currentQuestions.length) {
				quizForm.innerHTML = '<p class="muted">No questions available for this round yet.</p>';
				return;
			}
			currentQuestions.forEach((q, idx) => {
				const field = document.createElement('fieldset');
				field.className = 'quiz-card';
				field.innerHTML = `<legend>Q${idx+1}. ${escapeHtml(q.text)}</legend>`;
				q.options.forEach((opt, oIdx) => {
					const id = `q${q.id}_${oIdx}`;
					const row = document.createElement('div');
					row.innerHTML = `
						<input type="radio" id="${id}" name="q_${q.id}" value="${oIdx}" required />
						<label for="${id}">${escapeHtml(opt)}</label>
					`;
					field.appendChild(row);
				});
				quizForm.appendChild(field);
			});

			startTimer(QUIZ_SECONDS);
		});
	}

	function evaluateQuiz() {
		stopTimer();
		const data = new FormData(quizForm);
		let total = 0, correct = 0;
		for (const q of currentQuestions) {
			const value = data.get(`q_${q.id}`);
			if (value === null) continue;
			total++;
			if (Number(value) === Number(q.correctIndex)) correct++;
		}
		const percent = total ? Math.round((correct * 100) / total) : 0;
		const passed = percent >= PASS_THRESHOLD;
		quizResult.textContent = total ? `Score: ${correct}/${total} (${percent}%) — ${passed ? 'Passed' : 'Failed'}` : 'No answers provided.';
		saveResult(currentRound, { correct, total, percent, passed, timestamp: Date.now() });
		updateRoundStatuses();
	}

	function startTimer(seconds) {
		remainingSeconds = seconds;
		updateTimerLabel();
		clearInterval(timerId);
		timerId = setInterval(() => {
			remainingSeconds--;
			updateTimerLabel();
			if (remainingSeconds <= 0) {
				clearInterval(timerId);
				evaluateQuiz();
			}
		}, 1000);
	}

	function stopTimer() { clearInterval(timerId); timerId = null; }
	function updateTimerLabel() {
		if (!timerEl) return;
		const m = String(Math.max(0, Math.floor(remainingSeconds / 60))).padStart(2, '0');
		const s = String(Math.max(0, remainingSeconds % 60)).padStart(2, '0');
		timerEl.textContent = `${m}:${s}`;
	}

	// Results persistence in localStorage
	const RESULTS_KEY = 'hrec.results';
	function getResults() {
		try { return JSON.parse(localStorage.getItem(RESULTS_KEY) || '{}'); } catch { return {}; }
	}
	function setResults(obj) { localStorage.setItem(RESULTS_KEY, JSON.stringify(obj)); }
	function saveResult(round, data) { const r = getResults(); r[round] = data; setResults(r); }

	function updateRoundStatuses() {
		const r = getResults();
		const assess = r.assessment; const ops = r.ops; const hr = r.hr;
		statusAssessment.textContent = assess ? `${assess.percent}% ${assess.passed ? 'Passed' : 'Failed'}` : 'Not taken';
		statusOps.textContent = ops ? `${ops.percent}% ${ops.passed ? 'Passed' : 'Failed'}` : 'Locked until Assessment passed';
		statusHr.textContent = hr ? `${hr.percent}% ${hr.passed ? 'Passed' : 'Failed'}` : 'Locked until Ops passed';

		// Gating
		buttonAssessment.disabled = false;
		buttonOps.disabled = !(assess && assess.passed);
		buttonHr.disabled = !(ops && ops.passed);
	}

	function exportQuestions() {
		getAllQuestions().then(list => {
			const blob = new Blob([JSON.stringify(list)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url; a.download = 'questions.json'; a.click();
			URL.revokeObjectURL(url);
		});
	}

	function importQuestions(file) {
		const reader = new FileReader();
		reader.onload = async () => {
			try {
				const items = JSON.parse(String(reader.result || '[]'));
				for (const it of items) {
					const q = { round: it.round, text: it.text, options: it.options, correctIndex: it.correctIndex };
					await addQuestion(q);
				}
				renderQuestionList();
			} catch (e) {
				alert('Invalid JSON');
			}
		};
		reader.readAsText(file);
	}

	function roundTitle(key) {
		return key === 'assessment' ? 'Assessment' : key === 'ops' ? 'Ops' : 'HR';
	}

	function escapeHtml(str) {
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	// Events
	adminToggle.addEventListener('click', () => {
		adminPanel.classList.toggle('hidden');
	});

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const { options, correctIndex } = getOptionsFromForm();
		if (options.some(o => !o)) return;
		const q = { round: roundSelect.value, text: questionText.value.trim(), options, correctIndex };
		await addQuestion(q);
		clearQuestionForm();
		renderQuestionList();
	});

	questionList.addEventListener('click', async (e) => {
		const target = e.target;
		if (!(target instanceof HTMLElement)) return;
		const id = target.getAttribute('data-id');
		if (!id) return;
		await deleteQuestion(Number(id));
		renderQuestionList();
	});

	seedBtn.addEventListener('click', async () => {
		const samples = [
			{ round: 'assessment', text: 'What does HTML stand for?', options: ['HyperText Markup Language', 'HighText Machine Language', 'Hyperlinking Textual Mark Language', 'Home Tool Markup Language'], correctIndex: 0 },
			{ round: 'ops', text: 'Which command lists files in Unix?', options: ['ps', 'ls', 'cd', 'pwd'], correctIndex: 1 },
			{ round: 'hr', text: 'What is important in teamwork?', options: ['Blame', 'Silence', 'Communication', 'Competition'], correctIndex: 2 },
		];
		for (const s of samples) await addQuestion(s);
		renderQuestionList();
	});

	roundButtons.forEach(btn => btn.addEventListener('click', () => {
		if (btn.hasAttribute('disabled')) return;
		const round = btn.getAttribute('data-round');
		quizSection.classList.remove('hidden');
		buildQuiz(round);
		window.scrollTo({ top: quizSection.offsetTop - 20, behavior: 'smooth' });
	}));

	submitQuiz.addEventListener('click', evaluateQuiz);
	quitQuiz.addEventListener('click', () => { stopTimer(); quizForm.innerHTML = ''; quizSection.classList.add('hidden'); });

	exportBtn.addEventListener('click', exportQuestions);
	importBtn.addEventListener('click', () => importInput.click());
	importInput.addEventListener('change', (e) => { const f = importInput.files && importInput.files[0]; if (f) importQuestions(f); importInput.value = ''; });

	// Init
	renderQuestionList();
	updateRoundStatuses();
})();


