/**
 * ULTRA-FAST AI COMPLIANCE AUDITOR (NVIDIA NIM / LLAMA 3.1 8B)
 */

export async function generateComplianceInsights(facts) {
  const apiKey = process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('API key is not set in backend/.env');
  }

  const prompt = buildPrompt(facts);
  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

  const payload = {
    model: 'meta/llama-3.1-8b-instruct',
    messages: [
      {
        role: 'system',
        content:
          'You are a senior real estate compliance analyst. You MUST return ONLY a valid JSON object without markdown formatting.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.1,
    max_tokens: 350,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.text();
      throw new Error(`AI API Error (${response.status}): ${errData}`);
    }

    const data = await response.json();
    let responseText = data.choices[0].message.content.trim();

    if (responseText.startsWith('```json')) {
      responseText = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/```/g, '').trim();
    }

    const parsed = JSON.parse(responseText);

    if (!parsed.summary || !parsed.recommendation) {
      throw new Error(
        'AI response missing required "summary" or "recommendation" fields.'
      );
    }

    return {
      summary: parsed.summary,
      recommendation: parsed.recommendation,
    };
  } catch (err) {
    console.error('[AI Audit Error]:', err);
    throw new Error(`AI generation failed: ${err.message}`);
  }
}

/**
 * High-Level BI Prompt: Strictly compliance-focused analysis & prediction
 */
function buildPrompt(facts) {
  const verifiedListStr =
    facts.verifiedList && facts.verifiedList.length > 0
      ? facts.verifiedList.join(', ')
      : 'None';

  const missingListStr =
    facts.missingItems && facts.missingItems.length > 0
      ? facts.missingItems.join(', ')
      : 'None';

  return `You are an expert real estate compliance analyst writing a brief, executive findings report. Treat these facts as ground truth:

PROPERTY FACTS:
- Listing: "${facts.propertyName}" (${facts.propertyType} in ${facts.location})
- Verified Documents: ${facts.verifiedDocuments} out of ${facts.totalDocuments} (${verifiedListStr})
- Pending / Missing Documents: ${missingListStr}
- Compliance Score: ${facts.complianceScore}%
- Risk Level: ${facts.riskLevel}
- Current Estimated Success Rate: ${facts.estimatedSuccessRate}%
- Projected Success Rate upon completion: ${facts.potentialSuccessRate}%

INSTRUCTIONS:
1. "summary" (AI Findings):
   - Write 2 concise sentences explaining administrative readiness and buyer uncertainty caused by missing items (${missingListStr}).
   - Mention that comparable ${facts.propertyType} listings with complete documentation average an 81% success rate benchmark.
   - DO NOT talk about listing price or valuation.

2. "recommendation" (Predictive Analysis):
   - Write 1 forward-looking sentence stating that completing the ${missingListStr} verification is expected to raise the property's compliance score from ${facts.complianceScore}% to 100%, boosting its estimated success rate from ${facts.estimatedSuccessRate}% to ${facts.potentialSuccessRate}%.

Respond EXACTLY with this JSON structure and nothing else:
{
  "summary": "...",
  "recommendation": "..."
}`;
}