import { parseDeckList } from './parser.js';
import { getFormat } from './formats/index.js';

const form      = document.getElementById('validator-form');
const resultDiv = document.getElementById('result');
const submitBtn = document.getElementById('submit-btn');

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

  resultDiv.innerHTML = '<div class="result-loading">Validating — looking up cards via Scryfall&hellip;</div>';
  submitBtn.disabled = true;

  try {
    const deck   = parseDeckList(deckText);
    const result = await format.validate(deck);

    if (result.valid) {
      showValid(format.name);
    } else {
      showError(result.errors);
    }
  } catch (err) {
    showError([`Unexpected error: ${err.message}`]);
  } finally {
    submitBtn.disabled = false;
  }
});

function showValid(formatName) {
  resultDiv.innerHTML =
    `<div class="result-valid">Valid — this deck is legal for ${esc(formatName)}.</div>`;
}

function showError(errors) {
  const items = errors.map(e => `<li>${esc(e)}</li>`).join('');
  resultDiv.innerHTML =
    `<div class="result-error"><strong>Invalid deck:</strong><ul>${items}</ul></div>`;
}

function esc(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g, '&#039;');
}
