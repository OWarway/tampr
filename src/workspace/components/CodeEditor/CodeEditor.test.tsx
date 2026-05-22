// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CodeEditor } from './CodeEditor';

afterEach(cleanup);

describe('CodeEditor', () => {
  it('labels its editable surface and reflects controlled value changes', () => {
    const { rerender } = render(
      <CodeEditor
        label="CSS code"
        language="css"
        value="body { color: red; }"
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'CSS code' }).textContent).toBe(
      'body { color: red; }',
    );

    rerender(
      <CodeEditor
        label="CSS code"
        language="css"
        value="main { outline: 1px solid red; }"
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'CSS code' }).textContent).toBe(
      'main { outline: 1px solid red; }',
    );
  });
});
