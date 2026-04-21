import { parseDeckList } from './parser.js';
import { getFormat } from './formats/index.js';

const form      = document.getElementById('validator-form');
const resultDiv = document.getElementById('result');
const submitBtn = document.getElementById('submit-btn');
const helpBtn   = document.getElementById('help-btn');
const helpPanel = document.getElementById('help-panel');

helpBtn.addEventListener('click', () => {
  const isOpen = !helpPanel.hidden;
  helpPanel.hidden = isOpen;
  helpBtn.setAttribute('aria-expanded', String(!isOpen));
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formatId  = form.format.value;
  const deckText  = form.decklist.value.trim();

  if (!deckText) {
    showError(['Please enter a deck list.']);
    return;
  }

  const format = getFormat(formatId);
  if (!format) {
    showError([`Unknown format: "${formatId}".`]);
    return;
  }

  resultDiv.innerHTML = '<div class="result-loading">Looking up cards via Scryfall&hellip;</div>';
  submitBtn.disabled = true;

  try {
    const deck   = parseDeckList(deckText);
    const result = await format.validate(deck);

    if (result.valid) {
      showValid(format.name);
    } else {
      showError(result.errors, format.name);
    }
  } catch (err) {
    showError([`Unexpected error: ${err.message}`]);
  } finally {
    submitBtn.disabled = false;
  }
});

function showValid(formatName) {
  resultDiv.innerHTML =
    `<div class="result-valid">This deck is <strong>legal</strong> for ${esc(formatName)}.</div>`;
}

function showError(errors, formatName) {
  const items = errors.map(e => `<li>${esc(e)}</li>`).join('');
  resultDiv.innerHTML =
    `<div class="result-error"><p>This deck is <strong>illegal</strong>${formatName ? ` for ${esc(formatName)}` : ''}.</p><ul>${items}</ul></div>`;
}

function esc(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g, '&#039;');
}
