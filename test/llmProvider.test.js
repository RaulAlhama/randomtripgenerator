// The LLM fallback chain. This exists because a model alias moved: LLM_MODEL was
// set to gemini-flash-latest, the alias rolled onto a model whose free tier is 20
// requests a day, and every description on the site silently became a template.
// The chain is what makes running out survivable, so its order is worth pinning.
const test = require('node:test');
const assert = require('node:assert');

// Requiring server.js is side-effect-free by design (it only listens when run
// directly), but it reads env at call time, so each test sets what it needs.
const { llmCandidates } = require('../server');

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const BASE = {
  LLM_API_KEY: 'k-primary',
  LLM_API_BASE_URL: 'https://example.test/v1/',
  LLM_MODEL: 'pinned-model',
  LLM_FALLBACK_MODELS: undefined,
  NEBIUS_API_KEY: undefined,
  NEBIUS_API_BASE_URL: undefined,
  NEBIUS_MODEL: undefined,
};

test('a single configured model yields one candidate', () => {
  withEnv(BASE, () => {
    const c = llmCandidates();
    assert.strictEqual(c.length, 1);
    assert.strictEqual(c[0].model, 'pinned-model');
    assert.strictEqual(c[0].apiKey, 'k-primary');
  });
});

test('fallback models follow the primary, in order, on the same provider', () => {
  withEnv({ ...BASE, LLM_FALLBACK_MODELS: 'second, third' }, () => {
    const c = llmCandidates();
    assert.deepStrictEqual(c.map((x) => x.model), ['pinned-model', 'second', 'third']);
    // Same key and endpoint: these are alternative models, not another provider.
    assert.ok(c.every((x) => x.apiKey === 'k-primary' && x.apiBaseUrl === 'https://example.test/v1/'));
  });
});

test('a fallback repeating the primary model is not tried twice', () => {
  withEnv({ ...BASE, LLM_FALLBACK_MODELS: 'pinned-model, second' }, () => {
    assert.deepStrictEqual(llmCandidates().map((x) => x.model), ['pinned-model', 'second']);
  });
});

test('the legacy Nebius provider goes last, with its own key and endpoint', () => {
  withEnv({
    ...BASE,
    LLM_FALLBACK_MODELS: 'second',
    NEBIUS_API_KEY: 'k-nebius',
    NEBIUS_API_BASE_URL: 'https://nebius.test/v1/',
    NEBIUS_MODEL: 'nemotron',
  }, () => {
    const c = llmCandidates();
    assert.deepStrictEqual(c.map((x) => x.model), ['pinned-model', 'second', 'nemotron']);
    assert.strictEqual(c[2].apiKey, 'k-nebius');
    assert.strictEqual(c[2].apiBaseUrl, 'https://nebius.test/v1/');
  });
});

test('Nebius alone still works, which is what keeps NEBIUS_API_KEY a valid setup', () => {
  withEnv({ ...BASE, LLM_API_KEY: undefined, LLM_API_BASE_URL: undefined, LLM_MODEL: undefined, NEBIUS_API_KEY: 'k-nebius' }, () => {
    const c = llmCandidates();
    assert.strictEqual(c.length, 1);
    assert.strictEqual(c[0].apiKey, 'k-nebius');
  });
});

test('no keys at all yields no candidates, so callers fall back to templates', () => {
  withEnv({ ...BASE, LLM_API_KEY: undefined, NEBIUS_API_KEY: undefined }, () => {
    assert.deepStrictEqual(llmCandidates(), []);
  });
});

test('the same key under both names is not treated as two providers', () => {
  withEnv({ ...BASE, NEBIUS_API_KEY: 'k-primary' }, () => {
    assert.strictEqual(llmCandidates().length, 1);
  });
});
