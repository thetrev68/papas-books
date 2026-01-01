import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

describe('Modal', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders modal with title and children', () => {
    render(
      <Modal title="Test Modal" onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.getByText('Test Modal')).toBeTruthy();
    expect(screen.getByText('Modal content')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();

    render(
      <Modal title="Test Modal" onClose={onClose}>
        <p>Content</p>
      </Modal>
    );

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();

    render(
      <Modal title="Test Modal" onClose={onClose}>
        <p>Content</p>
      </Modal>
    );

    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when modal content is clicked', () => {
    const onClose = vi.fn();

    render(
      <Modal title="Test Modal" onClose={onClose}>
        <p>Content</p>
      </Modal>
    );

    fireEvent.click(screen.getByText('Content'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();

    render(
      <Modal title="Test Modal" onClose={onClose}>
        <p>Content</p>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('contains focusable elements for focus trap', () => {
    const onClose = vi.fn();

    render(
      <Modal title="Test Modal" onClose={onClose}>
        <button>First Button</button>
        <button>Second Button</button>
      </Modal>
    );

    // Verify all focusable elements are present
    const closeButton = screen.getByLabelText('Close');
    const firstButton = screen.getByText('First Button');
    const secondButton = screen.getByText('Second Button');

    expect(closeButton).toBeTruthy();
    expect(firstButton).toBeTruthy();
    expect(secondButton).toBeTruthy();

    // Verify modal container has tabindex for focus management
    const modalContainer = screen.getByText('First Button').parentElement?.parentElement;
    expect(modalContainer?.getAttribute('tabindex')).toBe('-1');
  });

  it('handles keyboard events for focus management', () => {
    const onClose = vi.fn();

    render(
      <Modal title="Test Modal" onClose={onClose}>
        <button>Test Button</button>
      </Modal>
    );

    // Test that Tab key event is processed (doesn't throw error)
    expect(() => {
      fireEvent.keyDown(document, { key: 'Tab' });
    }).not.toThrow();

    // Test that Shift+Tab key event is processed (doesn't throw error)
    expect(() => {
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    }).not.toThrow();
  });

  it('restores focus to previously focused element on unmount', () => {
    const onClose = vi.fn();
    const previousButton = document.createElement('button');
    previousButton.textContent = 'Previous Button';
    container.appendChild(previousButton);
    previousButton.focus();

    expect(document.activeElement).toBe(previousButton);

    const { unmount } = render(
      <Modal title="Test Modal" onClose={onClose}>
        <p>Content</p>
      </Modal>
    );

    // Focus should move to modal
    expect(document.activeElement).not.toBe(previousButton);

    // Unmount modal
    unmount();

    // Focus should restore to previous button
    expect(document.activeElement).toBe(previousButton);
  });

  it('applies correct size classes', () => {
    const { rerender } = render(
      <Modal title="Small Modal" onClose={vi.fn()} size="sm">
        <p>Content</p>
      </Modal>
    );

    // Get the modal container (parent of the content wrapper)
    let modalContainer = screen.getByText('Content').parentElement?.parentElement;
    expect(modalContainer?.className).toContain('max-w-md');

    rerender(
      <Modal title="Medium Modal" onClose={vi.fn()} size="md">
        <p>Content</p>
      </Modal>
    );

    modalContainer = screen.getByText('Content').parentElement?.parentElement;
    expect(modalContainer?.className).toContain('max-w-xl');

    rerender(
      <Modal title="Large Modal" onClose={vi.fn()} size="lg">
        <p>Content</p>
      </Modal>
    );

    modalContainer = screen.getByText('Content').parentElement?.parentElement;
    expect(modalContainer?.className).toContain('max-w-3xl');
  });

  it('has proper ARIA attributes', () => {
    render(
      <Modal title="Test Modal" onClose={vi.fn()}>
        <p>Content</p>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('focuses modal container on mount', () => {
    render(
      <Modal title="Test Modal" onClose={vi.fn()}>
        <p>Content</p>
      </Modal>
    );

    // The modal container (with tabIndex=-1) should have focus
    const modalContainer = screen.getByText('Content').parentElement?.parentElement;
    expect(document.activeElement).toBe(modalContainer);
  });
});
