(() => {
  'use strict';

  const STORAGE_KEY = 'pizarron-estudio-notas-v1';
  const NOTE_COLORS = ['#fff1f3', '#f2edfb', '#fff7e9'];
  const UNITS = {
    longitud: {
      m: { label: 'metros (m)', factor: 1 },
      km: { label: 'kilómetros (km)', factor: 1000 },
      cm: { label: 'centímetros (cm)', factor: 0.01 },
      mm: { label: 'milímetros (mm)', factor: 0.001 },
      mi: { label: 'millas (mi)', factor: 1609.344 },
      ft: { label: 'pies (ft)', factor: 0.3048 },
      in: { label: 'pulgadas (in)', factor: 0.0254 }
    },
    peso: {
      kg: { label: 'kilogramos (kg)', factor: 1 },
      g: { label: 'gramos (g)', factor: 0.001 },
      mg: { label: 'miligramos (mg)', factor: 0.000001 },
      lb: { label: 'libras (lb)', factor: 0.45359237 },
      oz: { label: 'onzas (oz)', factor: 0.028349523125 }
    },
    temperatura: {
      c: { label: 'Celsius (°C)' },
      f: { label: 'Fahrenheit (°F)' },
      k: { label: 'Kelvin (K)' }
    }
  };
  const CATEGORY_COLORS = { Ideas: '#e996a8', Estudio: '#a48ac1', Cuentas: '#d5a655', Recordatorios: '#dc8c78' };

  const $ = (id) => document.getElementById(id);
  const form = $('nota-form');
  const noteText = $('texto-nota');
  const noteCategory = $('categoria-nota');
  const board = $('tablero-notas');
  const filter = $('filtro-categoria');
  const noteMessage = $('note-message');
  const conversionForm = $('conversion-form');
  const conversionType = $('tipo-conversion');
  const sourceUnit = $('unidad-origen');
  const targetUnit = $('unidad-destino');
  const sourceValue = $('valor-origen');
  const resultOutput = $('resultado-conversion');
  const conversionMessage = $('conversion-message');
  const saveResultButton = $('guardar-resultado');
  const emptyState = $('empty-state');
  const announcement = $('screen-reader-announcement');
  let notes = loadNotes();
  let editingId = null;
  let lastConversion = null;

  function loadNotes() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter((note) => note && typeof note.id === 'string' && typeof note.text === 'string' && typeof note.category === 'string');
    } catch {
      return [];
    }
  }

  function persistNotes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      return true;
    } catch {
      noteMessage.textContent = 'No se pudieron guardar los cambios en este dispositivo. Revisá el espacio disponible del navegador.';
      return false;
    }
  }

  function announce(message) {
    announcement.textContent = '';
    window.setTimeout(() => { announcement.textContent = message; }, 20);
  }

  function refreshFilterOptions() {
    const selected = filter.value || 'todas';
    const categories = [...new Set([...Array.from(noteCategory.options, (option) => option.value), ...notes.map((note) => note.category)])]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es'));
    filter.replaceChildren(new Option('Todas las categorías', 'todas'));
    for (const category of categories) filter.add(new Option(category, category));
    filter.value = categories.includes(selected) || selected === 'todas' ? selected : 'todas';
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'recién';
    return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function renderNotes() {
    refreshFilterOptions();
    const visibleNotes = notes
      .filter((note) => filter.value === 'todas' || note.category === filter.value)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    board.replaceChildren();
    emptyState.hidden = visibleNotes.length !== 0;

    for (const note of visibleNotes) {
      const card = document.createElement('article');
      card.className = 'note-card';
      card.style.setProperty('--note-accent', CATEGORY_COLORS[note.category] || NOTE_COLORS[0]);

      const category = document.createElement('p');
      category.className = 'note-category';
      category.textContent = note.category;
      const content = document.createElement('p');
      content.className = 'note-text';
      content.textContent = note.text;
      const meta = document.createElement('div');
      meta.className = 'note-meta';
      const date = document.createElement('time');
      date.dateTime = note.updatedAt || note.createdAt;
      date.textContent = formatDate(note.updatedAt || note.createdAt);
      const actions = document.createElement('div');
      actions.className = 'note-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'note-action';
      editButton.textContent = 'Editar';
      editButton.setAttribute('aria-label', `Editar nota: ${note.text.slice(0, 45)}`);
      editButton.addEventListener('click', () => startEditing(note));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'note-action';
      deleteButton.textContent = 'Borrar';
      deleteButton.setAttribute('aria-label', `Borrar nota: ${note.text.slice(0, 45)}`);
      deleteButton.addEventListener('click', () => deleteNote(note.id));

      actions.append(editButton, deleteButton);
      meta.append(date, actions);
      card.append(category, content, meta);
      board.append(card);
    }
  }

  function startEditing(note) {
    editingId = note.id;
    noteText.value = note.text;
    if (![...noteCategory.options].some((option) => option.value === note.category)) {
      noteCategory.add(new Option(note.category, note.category));
    }
    noteCategory.value = note.category;
    $('note-form-title').textContent = 'EDITAR NOTA';
    $('agregar-nota').innerHTML = 'Guardar cambios <span aria-hidden="true">✦</span>';
    $('cancelar-edicion').hidden = false;
    noteText.focus();
    noteMessage.textContent = 'Estás editando esta nota.';
  }

  function resetEditor() {
    editingId = null;
    form.reset();
    $('note-form-title').textContent = 'NUEVA NOTA';
    $('agregar-nota').innerHTML = '<span aria-hidden="true">＋</span> Agregar';
    $('cancelar-edicion').hidden = true;
  }

  function saveNote(text, category, { announceResult = true } = {}) {
    const wasEditing = Boolean(editingId);
    const previousNotes = JSON.stringify(notes);
    const now = new Date().toISOString();
    if (editingId) {
      const existing = notes.find((note) => note.id === editingId);
      if (existing) {
        existing.text = text;
        existing.category = category;
        existing.updatedAt = now;
      }
    } else {
      notes.unshift({ id: makeId(), text, category, createdAt: now, updatedAt: now });
    }
    const saved = persistNotes();
    if (!saved) {
      notes = JSON.parse(previousNotes);
      renderNotes();
      return false;
    }
    resetEditor();
    noteMessage.textContent = wasEditing ? 'Nota actualizada.' : 'Nota guardada en tu tablero.';
    filter.value = 'todas';
    renderNotes();
    if (announceResult) announce('La nota se guardó en el pizarrón.');
    return true;
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `nota-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function deleteNote(id) {
    const note = notes.find((item) => item.id === id);
    if (!note) return;
    notes = notes.filter((item) => item.id !== id);
    if (!persistNotes()) {
      notes.push(note);
      return;
    }
    if (editingId === id) resetEditor();
    noteMessage.textContent = 'Nota eliminada.';
    renderNotes();
    announce('Nota eliminada.');
  }

  function populateUnits({ reset = false } = {}) {
    const type = conversionType.value;
    const unitMap = UNITS[type];
    const previousSource = reset ? '' : sourceUnit.value;
    const previousTarget = reset ? '' : targetUnit.value;
    sourceUnit.replaceChildren();
    targetUnit.replaceChildren();
    for (const [value, unit] of Object.entries(unitMap)) {
      sourceUnit.add(new Option(unit.label, value));
      targetUnit.add(new Option(unit.label, value));
    }
    sourceUnit.value = unitMap[previousSource] ? previousSource : Object.keys(unitMap)[0];
    const secondUnit = Object.keys(unitMap)[1] || Object.keys(unitMap)[0];
    targetUnit.value = unitMap[previousTarget] && previousTarget !== sourceUnit.value ? previousTarget : secondUnit;
    clearConversionResult();
  }

  function clearConversionResult() {
    lastConversion = null;
    resultOutput.textContent = 'Todavía no hay resultado';
    saveResultButton.disabled = true;
    conversionMessage.textContent = '';
  }

  function toCanonical(value, unit, type) {
    if (type !== 'temperatura') return value * UNITS[type][unit].factor;
    if (unit === 'c') return value;
    if (unit === 'f') return (value - 32) * 5 / 9;
    return value - 273.15;
  }

  function fromCanonical(value, unit, type) {
    if (type !== 'temperatura') return value / UNITS[type][unit].factor;
    if (unit === 'c') return value;
    if (unit === 'f') return value * 9 / 5 + 32;
    return value + 273.15;
  }

  function getUnitSymbol(type, unit) {
    const symbols = {
      longitud: { m: 'm', km: 'km', cm: 'cm', mm: 'mm', mi: 'mi', ft: 'ft', in: 'in' },
      peso: { kg: 'kg', g: 'g', mg: 'mg', lb: 'lb', oz: 'oz' },
      temperatura: { c: '°C', f: '°F', k: 'K' }
    };
    return symbols[type][unit];
  }

  function displayNumber(value) {
    return new Intl.NumberFormat('es-AR', { maximumSignificantDigits: 10 }).format(value);
  }

  conversionType.addEventListener('change', () => populateUnits({ reset: true }));
  conversionForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const rawValue = sourceValue.value.trim();
    const value = Number(rawValue);
    if (rawValue === '' || !Number.isFinite(value)) {
      clearConversionResult();
      conversionMessage.textContent = 'Escribí un valor numérico válido para convertir.';
      sourceValue.focus();
      return;
    }

    const type = conversionType.value;
    const from = sourceUnit.value;
    const to = targetUnit.value;
    if (type === 'temperatura' && from === 'k' && value < 0) {
      clearConversionResult();
      conversionMessage.textContent = 'La temperatura en Kelvin no puede ser menor que 0 K.';
      sourceValue.focus();
      return;
    }
    const result = fromCanonical(toCanonical(value, from, type), to, type);
    if (!Number.isFinite(result) || (type === 'temperatura' && to === 'k' && result < -1e-10)) {
      clearConversionResult();
      conversionMessage.textContent = 'Ese valor queda fuera del rango posible para esta conversión.';
      return;
    }

    const safeResult = Object.is(result, -0) || Math.abs(result) < 1e-12 ? 0 : result;
    const fromSymbol = getUnitSymbol(type, from);
    const toSymbol = getUnitSymbol(type, to);
    resultOutput.textContent = `${displayNumber(safeResult)} ${toSymbol}`;
    conversionMessage.textContent = `${displayNumber(value)} ${fromSymbol} equivale a ${displayNumber(safeResult)} ${toSymbol}.`;
    lastConversion = { text: `${displayNumber(value)} ${fromSymbol} = ${displayNumber(safeResult)} ${toSymbol}`, category: 'Cuentas' };
    saveResultButton.disabled = false;
    announce(`Resultado: ${displayNumber(safeResult)} ${toSymbol}.`);
  });

  saveResultButton.addEventListener('click', () => {
    if (!lastConversion) return;
    if (![...noteCategory.options].some((option) => option.value === lastConversion.category)) {
      noteCategory.add(new Option(lastConversion.category, lastConversion.category));
    }
    noteCategory.value = lastConversion.category;
    if (saveNote(lastConversion.text, lastConversion.category)) {
      noteMessage.textContent = 'Conversión guardada como nota en Cuentas.';
      filter.value = 'todas';
      renderNotes();
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = noteText.value.trim();
    if (!text) {
      noteMessage.textContent = 'Escribí algo en la nota antes de guardarla.';
      noteText.focus();
      return;
    }
    saveNote(text, noteCategory.value);
  });

  $('cancelar-edicion').addEventListener('click', () => {
    resetEditor();
    noteMessage.textContent = 'Edición cancelada.';
    noteText.focus();
  });
  filter.addEventListener('change', renderNotes);

  populateUnits();
  renderNotes();
})();
