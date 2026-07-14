// Runs the custom-trained scam classifier (ml/src/model.py, exported to ONNX)
// against a job posting. Used as an additional signal fed into the Claude
// prompt in /api/analyze-job — never as a standalone verdict, since it was
// found to false-positive on short/sparse postings the extension's scraper
// typically produces (missing company_profile/requirements/benefits/logo
// fields it was trained with).
const fs = require('fs');
const path = require('path');
const ort = require('onnxruntime-node');
const { encodeText } = require('./tokenizer');

const ARTIFACTS_DIR = path.join(__dirname, 'artifacts');

let sessionPromise = null;
let vocab, catMaps, config;

function loadArtifacts() {
  vocab = JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, 'vocab.json'), 'utf8'));
  catMaps = JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, 'cat_maps.json'), 'utf8'));
  config = JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, 'config.json'), 'utf8'));
}

function getSession() {
  if (!sessionPromise) {
    loadArtifacts();
    sessionPromise = ort.InferenceSession.create(path.join(ARTIFACTS_DIR, 'model.onnx'));
  }
  return sessionPromise;
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// Maps the extension's scraped jobData shape onto the schema the model was
// trained on. Fields the extension doesn't scrape (company_profile,
// requirements, benefits, employment_type, industry, has_company_logo, ...)
// are left at their "missing" training-time value.
function buildFeatures(jobData) {
  const fullText = [jobData.title || '', jobData.description || ''].join(' ');

  const catCols = config.cat_cols;
  const catValues = catCols.map(() => '__missing__');

  const binFeatures = [
    0, // telecommuting - not scraped
    0, // has_company_logo - not scraped
    0, // has_questions - not scraped
    jobData.salary ? 1 : 0, // has_salary
  ];

  return { fullText, catCols, catValues, binFeatures };
}

async function scoreJobPosting(jobData) {
  const session = await getSession();
  const { fullText, catCols, catValues, binFeatures } = buildFeatures(jobData);

  const { ids, attn } = encodeText(fullText, vocab, config.max_len);
  const catIds = catCols.map((col, i) => {
    const map = catMaps[col];
    const val = catValues[i];
    return BigInt(val in map ? map[val] : 0);
  });

  const feeds = {
    input_ids: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    attn_mask: new ort.Tensor('int64', BigInt64Array.from(attn.map(BigInt)), [1, attn.length]),
    cat_ids: new ort.Tensor('int64', BigInt64Array.from(catIds), [1, catIds.length]),
    bin_features: new ort.Tensor('float32', Float32Array.from(binFeatures), [1, binFeatures.length]),
  };

  const results = await session.run(feeds);
  const logit = results.logit.data[0];
  const probability = sigmoid(logit);

  return { probability };
}

module.exports = { scoreJobPosting };
