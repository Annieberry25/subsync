import { supportsBrowserSearch, extractSources } from '@/lib/ai/server';

describe('supportsBrowserSearch', () => {
  it('accepts the GPT-OSS browser-search-capable models', () => {
    expect(supportsBrowserSearch('openai/gpt-oss-20b')).toBe(true);
    expect(supportsBrowserSearch('openai/gpt-oss-120b')).toBe(true);
    expect(supportsBrowserSearch('openai/gpt-oss-safeguard-20b')).toBe(true);
  });

  it('rejects models without the built-in browser search tool', () => {
    expect(supportsBrowserSearch('groq/compound-mini')).toBe(false);
    expect(supportsBrowserSearch('qwen/qwen3.8-27b')).toBe(false);
    expect(supportsBrowserSearch('')).toBe(false);
  });
});

describe('extractSources', () => {
  it('parses the legacy Compound executed_tools search_results shape', () => {
    const sources = extractSources({
      content: 'answer',
      executed_tools: [
        {
          search_results: {
            results: [
              { title: 'Groq Docs', url: 'https://console.groq.com/docs', content: 'snippet' },
              { title: '', url: 'https://example.com', content: '' },
            ],
          },
        },
      ],
    });
    expect(sources).toEqual([
      { title: 'Groq Docs', uri: 'https://console.groq.com/docs' },
      { title: 'https://example.com', uri: 'https://example.com' },
    ]);
  });

  it('parses the flat citations array returned by browser search', () => {
    const sources = extractSources({
      content: 'answer',
      citations: [
        { title: 'Exa', url: 'https://exa.ai' },
        { title: 'Broken', uri: 'https://broken.example', url: '' },
      ],
    });
    expect(sources).toEqual([
      { title: 'Exa', uri: 'https://exa.ai' },
      { title: 'Broken', uri: 'https://broken.example' },
    ]);
  });

  it('falls back to the uri field when title and url are both present in different shapes', () => {
    const sources = extractSources({
      content: '',
      citations: [{ title: 'Only URI', uri: 'https://only.example' }],
    });
    expect(sources).toEqual([{ title: 'Only URI', uri: 'https://only.example' }]);
  });

  it('filters out entries without any usable uri and tolerates undefined input', () => {
    expect(
      extractSources({
        citations: [{ title: 'No URL', url: '' }],
      })
    ).toEqual([]);
    expect(extractSources(undefined)).toEqual([]);
  });
});