function einsprechen(feldId, button) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { setStatus('Die Spracheingabe wird in diesem Browser nicht unterstützt. Bitte Text eintippen.', 'warning'); return; }
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
    return;
  }
  try {
    const rec = new SR();
    recognition = rec;
    const label = button.textContent;
    rec.lang = 'de-DE'; rec.interimResults = false; rec.continuous = false;
    button.textContent = 'Aufnahme beenden';
    rec.onresult = event => {
      const field = $(feldId);
      if (!field) return;
      const words = Array.from(event.results).slice(event.resultIndex || 0).map(r => r[0].transcript).join(' ').trim();
      if (!words) return;
      field.value += (field.value && !/\s$/.test(field.value) ? ' ' : '') + words;
      field.dispatchEvent(new Event('input',{bubbles:true}));
    };
    rec.onerror = event => setStatus('Spracheingabe nicht möglich (' + (event.error || 'Browserfehler') + '). Bitte eingeben oder erneut versuchen.', 'warning');
    rec.onend = () => {
      if (recognition === rec) recognition = null;
      button.textContent = label;
    };
    rec.start();
    setStatus('Spracheingabe aktiv …');
  } catch (e) {
    recognition = null;
    button.textContent = '🎙 Einsprechen';
    setStatus('Spracheingabe konnte nicht gestartet werden.', 'warning');
  }
}

