import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App scaffold', () => {
  it('exports a React component', () => {
    expect(typeof App).toBe('function');
  });
});
