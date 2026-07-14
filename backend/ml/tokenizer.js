// Mirrors ml/src/preprocess.py's tokenize()/encode_text() exactly, so the
// Node inference path produces identical input tensors to what the model
// was trained on.
const TOKEN_RE = /[a-z0-9']+/g;

function tokenize(text) {
  return (text || '').toLowerCase().match(TOKEN_RE) || [];
}

function encodeText(text, vocab, maxLen) {
  const clsId = vocab['<cls>'];
  const unkId = vocab['<unk>'];
  const padId = vocab['<pad>'];

  const tokens = tokenize(text);
  let ids = [clsId, ...tokens.map((tok) => (tok in vocab ? vocab[tok] : unkId))];
  ids = ids.slice(0, maxLen);

  const attn = new Array(ids.length).fill(1);
  while (ids.length < maxLen) {
    ids.push(padId);
    attn.push(0);
  }
  return { ids, attn };
}

module.exports = { tokenize, encodeText };
