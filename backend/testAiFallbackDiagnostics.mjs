import assert from 'node:assert/strict';
import {
  callNvidiaModel,
  generateComplianceInsights,
  getAiFailureDiagnostics,
  logComplianceNarrativeFallback,
  validateComplianceNarrative,
} from './src/services/aiService.js';

const originalFetch = globalThis.fetch;
const originalKey = process.env.NVIDIA_API_KEY;

const facts = {
  readinessClassification: 'HOLD_FOR_REVIEW',
  readinessCriticalIssues: [{ code: 'REQUIRED_DOCUMENT_MISSING', message: 'Deed of Sale is missing.' }],
  readinessPendingItems: [],
  readinessNonCriticalIssues: [],
};

try {
  delete process.env.NVIDIA_API_KEY;
  await assert.rejects(() => generateComplianceInsights(facts), (error) => {
    const diagnostics = getAiFailureDiagnostics(error);
    assert.equal(error.code, 'AI_CONFIGURATION_ERROR');
    assert.equal(diagnostics.errorCategory, 'configuration');
    assert.equal(diagnostics.providerStatus, null);
    return true;
  });

  assert.equal(
    getAiFailureDiagnostics({ statusCode: 429, message: 'rate limited' }).errorCategory,
    'usage_limit'
  );
  assert.equal(
    getAiFailureDiagnostics({ message: 'AI usage reservation failed' }).errorCategory,
    'usage_reservation'
  );

  for (const status of [401, 429, 500]) {
    globalThis.fetch = async () => ({ ok: false, status });
    await assert.rejects(() => callNvidiaModel('test-key', 'test prompt'), (error) => {
      const diagnostics = getAiFailureDiagnostics(error);
      assert.equal(diagnostics.errorCategory, 'provider');
      assert.equal(diagnostics.providerStatus, status);
      assert.doesNotMatch(diagnostics.message, /secret|authorization|bearer|raw response/i);
      return true;
    });
  }

  globalThis.fetch = async () => {
    throw Object.assign(new Error('request exceeded timeout'), { name: 'TimeoutError' });
  };
  await assert.rejects(() => callNvidiaModel('test-key', 'test prompt'), (error) => {
    assert.equal(getAiFailureDiagnostics(error).errorCategory, 'timeout');
    return true;
  });

  globalThis.fetch = async () => {
    throw new TypeError('network unavailable');
  };
  await assert.rejects(() => callNvidiaModel('test-key', 'test prompt'), (error) => {
    assert.equal(getAiFailureDiagnostics(error).errorCategory, 'network');
    return true;
  });

  let contradictoryError;
  try {
    validateComplianceNarrative(
      { summary: 'Critical findings remain.', recommendation: 'We recommend to proceed.' },
      facts
    );
  } catch (error) {
    contradictoryError = error;
  }
  assert.equal(contradictoryError.code, 'AI_CONTRADICTORY_RESPONSE');
  const contradictionDiagnostics = getAiFailureDiagnostics(contradictoryError);
  assert.equal(contradictionDiagnostics.errorCategory, 'validation');
  assert.equal(contradictionDiagnostics.validationRule, 'HOLD_PROCESSING_RECOMMENDATION');

  const jsonDiagnostics = getAiFailureDiagnostics({
    aiCategory: 'json',
    validationRule: 'JSON_OBJECT',
    safeMessage: 'AI response was not valid JSON.',
  });
  assert.equal(jsonDiagnostics.errorCategory, 'json');
  assert.equal(jsonDiagnostics.validationRule, 'JSON_OBJECT');

  const unsafeError = {
    aiCategory: 'provider',
    providerStatus: 500,
    safeMessage: 'Authorization: Bearer super-secret NVIDIA_API_KEY=super-secret https://provider.invalid/raw-body',
  };
  const safeDiagnostics = getAiFailureDiagnostics(unsafeError);
  assert.doesNotMatch(JSON.stringify(safeDiagnostics), /super-secret|provider\.invalid|prompt|raw response/i);

  assert.doesNotThrow(() => {
    logComplianceNarrativeFallback({
      propertyId: 'property-1',
      fallbackReason: 'AI_UNAVAILABLE',
      error: unsafeError,
      logger: { warn: () => { throw new Error('logger unavailable'); } },
    });
  });

  console.log('AI fallback diagnostics tests passed.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
  else process.env.NVIDIA_API_KEY = originalKey;
}
