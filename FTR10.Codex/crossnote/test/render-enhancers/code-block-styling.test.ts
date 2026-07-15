import * as cheerio from 'cheerio';
import enhance from '../../src/render-enhancers/code-block-styling';

describe('render-enhancers/code-block-styling', () => {
  it('normalizes dot-prefixed class and outputs line-number spans', async () => {
    const initialHtml = `<pre data-role="codeBlock" data-parsed-info='{"language":"text","attributes":{"class":".line-numbers"}}' data-normalized-info='{"language":"text","attributes":{"class":".line-numbers"}}'><code>first\nsecond\nthird</code></pre>`;
    const $ = cheerio.load(initialHtml);

    await enhance($);

    const $pre = $('pre[data-role="codeBlock"]');
    expect($pre.hasClass('line-numbers')).toBe(true);
    expect($pre.attr('class')).toContain('line-numbers');
    expect($pre.find('.line-numbers-rows > span').length).toBe(3);
  });

  it('supports numberLines class as alias for line-numbers', async () => {
    const initialHtml = `<pre data-role="codeBlock" data-parsed-info='{"language":"text","attributes":{"class":"numberLines"}}' data-normalized-info='{"language":"text","attributes":{"class":"numberLines"}}'><code>one\ntwo</code></pre>`;
    const $ = cheerio.load(initialHtml);

    await enhance($);

    const $pre = $('pre[data-role="codeBlock"]');
    expect($pre.hasClass('line-numbers')).toBe(true);
    expect($pre.find('.line-numbers-rows > span').length).toBe(2);
  });
});
