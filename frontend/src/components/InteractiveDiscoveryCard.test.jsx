import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InteractiveDiscoveryCard from './InteractiveDiscoveryCard';
import { readUploadedFile } from '../utils/fileUtils';

vi.mock('../utils/fileUtils', () => ({
  readUploadedFile: vi.fn(),
}));

describe('InteractiveDiscoveryCard resource submission', () => {
  let container;
  let root;

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const renderCard = async (onSubmitPreferences) => {
    await act(async () => {
      root.render(<InteractiveDiscoveryCard onSubmitPreferences={onSubmitPreferences} />);
    });
  };

  const changeInput = (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const submitForm = async () => {
    await act(async () => {
      container.querySelector('form').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      );
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  };

  it('submits extracted PDF text and supplied resource URLs', async () => {
    const onSubmitPreferences = vi.fn().mockResolvedValue(undefined);
    readUploadedFile.mockResolvedValue({
      content: 'PDF syllabus text: arrays, graphs, and trees.',
    });
    await renderCard(onSubmitPreferences);

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find(button => button.textContent.trim() === 'Yes')
        .click();
    });
    await act(async () => {
      changeInput(
        container.querySelector('input[placeholder^="Paste YouTube"]'),
        'https://www.youtube.com/playlist?list=course123'
      );
      changeInput(
        container.querySelector('input[placeholder="https://geeksforgeeks.org/..."]'),
        'https://example.org/course'
      );
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', {
        configurable: true,
        value: [new File(['pdf bytes'], 'syllabus.pdf', { type: 'application/pdf' })],
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await submitForm();

    expect(onSubmitPreferences).toHaveBeenCalledWith(expect.objectContaining({
      playlistUrl: 'https://www.youtube.com/playlist?list=course123',
      websiteUrl: 'https://example.org/course',
      referenceText: 'PDF syllabus text: arrays, graphs, and trees.',
    }));
  });

  it('does not submit when PDF extraction fails', async () => {
    const onSubmitPreferences = vi.fn();
    readUploadedFile.mockRejectedValue(new Error('Could not read syllabus.pdf'));
    await renderCard(onSubmitPreferences);

    await act(async () => {
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', {
        configurable: true,
        value: [new File(['pdf bytes'], 'syllabus.pdf', { type: 'application/pdf' })],
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await submitForm();

    expect(container.querySelector('[role="alert"]').textContent).toContain('Could not read syllabus.pdf');
    expect(onSubmitPreferences).not.toHaveBeenCalled();
  });
});
