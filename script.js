(() => {
  'use strict';

  const STORAGE_KEY = 'pizarron-estudio-notas-v1';
  const CATEGORY_LABELS = {
    ideas: 'Ideas', pendientes: 'Pendientes', calculos: 'Cálculos',
    preguntas: 'Preguntas', apuntes: 'Apuntes'
  };
  const UNITS = {
    longitud: {
      mm: { label: 'Milímetros (mm)', factor: 0.001 },
      cm: { label: 'Centímetros (cm)', factor: 0.01 },
      m: { label: 'Metros (m)', factor: 1 },
      km: { label: 'Kilómetros (km)', factor: 1000 },
      in: { label: 'Pulgadas (in)', factor: 0.0254 },
      ft: { label: 'Pies (ft)', factor: 0.3048 }
    },
    peso: {
      mg: { label: 'Miligramos (mg)', factor: 0.001 },
      g: { label: 'Gramos (g)', factor: 1 },
      kg: { label: 'Kilogramos (kg)', factor: 1000 },
      oz: { label: 'Onzas (oz)', factor: 28.349523125 },
      lb: { label: 'Libras (lb)', factor: 453.59237 }
    },
    temperatura: {
      c: { label: 'Celsius (°C)' },
      f: { label: 'Fahrenheit (°F)' },
      k: { label: 'Kelvin (K)' }
    }
  };
  const PALETTE_CLASSES = ['tilt-left', 'tilt-right', 'tilt-straight'];
  const elements = {
    noteForm: document.querySelector('#note-form'),
    noteText: document.querySelector('#texto-nota'),
    noteCategory: document.querySelector('#categoria-nota'),
    board: document.querySelector('#tablero-notas'),
    filter: document.querySelector('#filtro-categoria'),
    empty: document.querySelector('#empty-state'),
    noteCount: document.querySelector('#note-count'),
    converterForm: document.querySelector('#converter-form'),
    conversionType: document.querySelector('#tipo-conversion'),
    value: document.querySelector('#valor-origen'),
    from: document.querySelector('#unidad-origen'),
    to: document.querySelector('#unidad-destino'),
    result: document.querySelector('#resultado-conversion'),
    conversionMessage: document.querySelector('#conversion-message'),
    saveConversion: document.querySelector('#guardar-resultado'),
    dialog: document.querySelector('#edit-dialog'),
    editForm: document.querySelector('#edit-form'),
    editText: document.querySelector('#edit-text'),
    editCategory: document.querySelector('#edit-category'),
    cancelEdit: document.querySelector('#cancel-edit'),
    toast: document.querySelector('#toast')
  };

  let notes = readNotes();
  let editingId = null;
  let latestConversion = null;
  let toastTimer;

  function readNotes() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter((note) => note && typeof note.id === 'string' && typeof note.text === 'string' && CATEGORY_LABELS[note.category]);
    } catch {
      showToast('No se pudieron leer las notas guardadas. Podés empezar una nueva.');
      return [];
    }
  }

  function persistNotes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      return true;
    } catch {
      showToast('El navegador no pudo guardar los cambios. Revisá el espacio disponible.');
      return false;
    }
  }

  function makeId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function renderNotes() {
    const selectedCategory = elements.filter.value;
    const visibleNotes = notes.filter((note) => selectedCategory === 'todas' || note.category === selectedCategory);
    elements.board.replaceChildren();
    visibleNotes.forEach((note, index) => {
      const card = document.createElement('article');
      card.className = `note-card ${PALETTE_CLASSES[index % PALETTE_CLASSES.length]}`;
      card.dataset.category = note.category;

      const top = document.createElement('div');
      top.className = 'note-card-top';
      const category = document.createElement('span');
      category.className = 'note-category';
      category.textContent = CATEGORY_LABELS[note.category];
      const tools = document.createElement('div');
      tools.className = 'note-tools';
      tools.append(
        makeIconButton('Editar nota', '✎', () => openEditor(note.id)),
        makeIconButton('Eliminar nota', '×', () => deleteNote(note.id))
      );
      top.append(category, tools);

      const text = document.createElement('p');
      text.className = 'note-text';
      text.textContent = note.text;
      const date = document.createElement('p');
      date.className = 'note-date';
      date.textContent = formatDate(note.updatedAt || note.createdAt);
      card.append(top, text, date);
      elements.board.append(card);
    });

    elements.empty.hidden = visibleNotes.length > 0;
    elements.board.hidden = visibleNotes.length === 0;
    if (notes.length === 0) {
      elements.empty.innerHTML = '<span aria-hidden="true">✿</span><br>Este espacio todavía está en blanco.<br>Agregá una nota y empezá tu colección.';
      elements.noteCount.textContent = 'Tus apuntes, a mano y en orden.';
    } else if (visibleNotes.length === 0) {
      elements.empty.innerHTML = '<span aria-hidden="true">✿</span><br>No hay notas en esta categoría todavía.<br>Probá con otro filtro o agregá una nueva.';
      elements.noteCount.textContent = `Mostrando 0 de ${notes.length} ${notes.length === 1 ? 'nota' : 'notas'}.`;
    } else {
      elements.noteCount.textContent = `${visibleNotes.length} ${visibleNotes.length === 1 ? 'nota' : 'notas'}${selectedCategory === 'todas' ? ' en tu tablero.' : ` en ${CATEGORY_LABELS[selectedCategory].toLowerCase()}.`}`;
    }
  }

  function makeIconButton(label, symbol, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-button';
    button.setAttribute('aria-label', label);
    button.textContent = symbol;
    button.addEventListener('click', action);
    return button;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return 'recién';
    return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function addNote(text, category) {
    const normalized = text.trim();
    if (!normalized) return false;
    const now = new Date().toISOString();
    notes.unshift({ id: makeId(), text: normalized, category, createdAt: now, updatedAt: now });
    persistNotes();
    renderNotes();
    return true;
  }

  function deleteNote(id) {
    const note = notes.find((item) => item.id === id);
    if (!note) return;
    notes = notes.filter((item) => item.id !== id);
    persistNotes();
    renderNotes();
    showToast('Nota eliminada del pizarrón.');
  }

  function openEditor(id) {
    const note = notes.find((item) => item.id === id);
    if (!note) return;
    editingId = id;
    elements.editText.value = note.text;
    elements.editCategory.value = note.category;
    elements.dialog.showModal();
    elements.editText.focus();
  }

  function refillUnits(keepSelection = false) {
    const previousFrom = keepSelection ? elements.from.value : '';
    const previousTo = keepSelection ? elements.to.value : '';
    const units = UNITS[elements.conversionType.value];
    for (const select of [elements.from, elements.to]) {
      select.replaceChildren();
      Object.entries(units).forEach(([value, unit]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = unit.label;
        select.append(option);
      });
    }
    if (units[previousFrom]) elements.from.value = previousFrom;
    if (units[previousTo]) elements.to.value = previousTo;
    if (!keepSelection && elements.to.options.length > 1) elements.to.selectedIndex = 1;
    clearConversion();
  }

  function clearConversion() {
    latestConversion = null;
    elements.result.textContent = 'El resultado aparece acá.';
    elements.saveConversion.disabled = true;
    elements.conversionMessage.textContent = '';
    elements.value.removeAttribute('aria-invalid');
  }

  function convertTemperature(value, from, to) {
    const toCelsius = {
      c: (number) => number,
      f: (number) => (number - 32) * 5 / 9,
      k: (number) => number - 273.15
    };
    const fromCelsius = {
      c: (number) => number,
      f: (number) => number * 9 / 5 + 32,
      k: (number) => number + 273.15
    };
    return fromCelsius[to](toCelsius[from](value));
  }

  function convert(event) {
    event.preventDefault();
    clearConversion();
    const value = elements.value.valueAsNumber;
    if (elements.value.value.trim() === '' || !Number.isFinite(value)) {
      elements.conversionMessage.textContent = 'Escribí un número válido para hacer la conversión.';
      elements.value.setAttribute('aria-invalid', 'true');
      elements.value.focus();
      return;
    }

    const kind = elements.conversionType.value;
    const from = elements.from.value;
    const to = elements.to.value;
    let converted;
    if (kind === 'temperatura') {
      const kelvin = from === 'k' ? value : convertTemperature(value, from, 'k');
      if (kelvin < 0) {
        elements.conversionMessage.textContent = 'La temperatura no puede ser menor al cero absoluto (−273,15 °C).';
        elements.value.setAttribute('aria-invalid', 'true');
        elements.value.focus();
        return;
      }
      converted = convertTemperature(value, from, to);
    } else {
      const baseValue = value * UNITS[kind][from].factor;
      converted = baseValue / UNITS[kind][to].factor;
    }

    if (!Number.isFinite(converted)) {
      elements.conversionMessage.textContent = 'Ese valor es demasiado grande para convertirlo.';
      return;
    }
    const formattedInput = formatNumber(value);
    const formattedOutput = formatNumber(converted);
    const sourceLabel = shortUnit(kind, from);
    const targetLabel = shortUnit(kind, to);
    const summary = `${formattedInput} ${sourceLabel} = ${formattedOutput} ${targetLabel}`;
    elements.result.textContent = summary;
    elements.saveConversion.disabled = false;
    latestConversion = summary;
  }

  function formatNumber(number) {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 8 }).format(number);
  }

  function shortUnit(kind, unit) {
    if (kind === 'temperatura') return ({ c: '°C', f: '°F', k: 'K' })[unit];
    return unit;
  }

  function showToast(message) {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 2800);
  }

  elements.noteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (addNote(elements.noteText.value, elements.noteCategory.value)) {
      elements.noteText.value = '';
      elements.noteText.focus();
      showToast('Tu idea ya está en el pizarrón.');
    }
  });

  elements.filter.addEventListener('change', renderNotes);
  elements.conversionType.addEventListener('change', () => refillUnits());
  elements.converterForm.addEventListener('submit', convert);
  elements.value.addEventListener('input', () => {
    elements.conversionMessage.textContent = '';
    elements.value.removeAttribute('aria-invalid');
  });

  elements.saveConversion.addEventListener('click', () => {
    if (!latestConversion) return;
    elements.noteText.value = latestConversion;
    elements.noteCategory.value = 'calculos';
    addNote(latestConversion, 'calculos');
    elements.noteText.value = '';
    showToast('Conversión guardada en la categoría Cálculos.');
  });

  elements.editForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const note = notes.find((item) => item.id === editingId);
    const text = elements.editText.value.trim();
    if (!note || !text) return;
    note.text = text;
    note.category = elements.editCategory.value;
    note.updatedAt = new Date().toISOString();
    persistNotes();
    renderNotes();
    elements.dialog.close();
    showToast('Cambios guardados.');
  });

  elements.cancelEdit.addEventListener('click', () => elements.dialog.close());
  elements.dialog.addEventListener('close', () => { editingId = null; });
  elements.dialog.addEventListener('click', (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });

  refillUnits();
  renderNotes();
})();
